const express = require('express');
const axios = require('axios');
const router = express.Router();
const auth = require('../middleware/auth');
const Transaction = require('../models/Transaction');
const Task = require('../models/Task');
const User = require('../models/User');
const mpesaAuth = require('../utils/mpesaAuth');
const { createNotification } = require('./notifications');

// M-Pesa configuration
const SHORTCODE = process.env.MPESA_SHORTCODE || '174379';
const BASE_URL = process.env.MPESA_BASE_URL || 'https://sandbox.safaricom.co.ke';
const SERVER_BASE_URL = process.env.SERVER_BASE_URL || 'http://localhost:5000';

/**
 * STEP 1: Register C2B URLs
 * This tells M-Pesa where to send confirmation and validation callbacks
 */
router.post('/register', auth, async (req, res) => {
  try {
    console.log('📋 Registering M-Pesa URLs...');
    
    const accessToken = await mpesaAuth.getAccessToken();
    
    const requestBody = {
      ShortCode: SHORTCODE,
      ResponseType: 'Completed', // Only send confirmation, skip validation for simplicity
      ConfirmationURL: `${SERVER_BASE_URL}/api/mpesa/confirmation`,
      ValidationURL: `${SERVER_BASE_URL}/api/mpesa/validation`
    };

    const response = await axios.post(`${BASE_URL}/mpesa/c2b/v1/registerurl`, requestBody, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('✅ M-Pesa URLs registered successfully:', response.data);
    
    res.json({
      success: true,
      message: 'M-Pesa URLs registered successfully',
      data: response.data
    });

  } catch (error) {
    console.error('❌ Failed to register M-Pesa URLs:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to register M-Pesa URLs',
      error: error.response?.data || error.message
    });
  }
});

/**
 * STEP 2: Simulate C2B Payment (Client pays Campus Hub)
 * In production, this would be a real customer payment
 */
router.post('/simulate-c2b', auth, async (req, res) => {
  try {
    const { taskId, phoneNumber, amount } = req.body;

    // Validate required fields
    if (!taskId || !phoneNumber || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Task ID, phone number, and amount are required'
      });
    }

    // Validate task exists and user owns it
    const task = await Task.findById(taskId).populate('postedBy assignedTo');
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (task.postedBy._id.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Only task owner can initiate payment'
      });
    }

    // Validate phone number format
    const formattedPhone = mpesaAuth.validatePhoneNumber(phoneNumber);
    
    console.log('💰 Simulating C2B payment:', {
      taskId,
      amount,
      phone: formattedPhone,
      userId: req.userId
    });

    // Create transaction record
    const transaction = new Transaction({
      transactionType: 'C2B',
      amount: parseFloat(amount),
      phoneNumber: formattedPhone,
      fromUser: req.userId,
      task: taskId,
      status: 'PENDING'
    });
    await transaction.save();

    const accessToken = await mpesaAuth.getAccessToken();
    
    const requestBody = {
      ShortCode: SHORTCODE,
      CommandID: 'CustomerPayBillOnline',
      Amount: amount,
      Msisdn: formattedPhone,
      BillRefNumber: `TASK_${taskId}` // Reference for this payment
    };

    const response = await axios.post(`${BASE_URL}/mpesa/c2b/v1/simulate`, requestBody, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('✅ C2B simulation response:', response.data);

    // Update transaction with M-Pesa response
    transaction.responseCode = response.data.ResponseCode;
    transaction.responseDescription = response.data.ResponseDescription;
    transaction.conversationId = response.data.ConversationID;
    transaction.originatorConversationId = response.data.OriginatorConversationID;
    await transaction.save();

    res.json({
      success: true,
      message: 'C2B payment simulated successfully',
      transactionId: transaction._id,
      data: response.data
    });

  } catch (error) {
    console.error('❌ C2B simulation failed:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to simulate C2B payment',
      error: error.response?.data || error.message
    });
  }
});

/**
 * STEP 3: C2B Confirmation Callback
 * M-Pesa calls this when payment is confirmed
 */
router.post('/confirmation', async (req, res) => {
  try {
    console.log('🎯 C2B Confirmation received:', req.body);
    
    const {
      TransID,
      TransTime,
      TransAmount,
      BusinessShortCode,
      BillRefNumber,
      InvoiceNumber,
      OrgAccountBalance,
      ThirdPartyTransID,
      MSISDN,
      FirstName,
      MiddleName,
      LastName
    } = req.body;

    // Extract task ID from BillRefNumber
    const taskId = BillRefNumber?.replace('TASK_', '');
    
    if (!taskId) {
      console.log('⚠️ No task ID found in BillRefNumber:', BillRefNumber);
      return res.json({ ResultCode: 0, ResultDesc: 'Success' });
    }

    // Find and update transaction
    const transaction = await Transaction.findOne({
      task: taskId,
      transactionType: 'C2B',
      status: 'PENDING'
    }).populate('task fromUser');

    if (transaction) {
      transaction.status = 'COMPLETED';
      transaction.mpesaTransactionId = TransID;
      transaction.mpesaReceiptNumber = TransID;
      transaction.completedAt = new Date();
      transaction.callbackReceived = true;
      transaction.callbackData = req.body;
      await transaction.save();

      // Update task payment status
      const task = await Task.findById(taskId);
      if (task) {
        task.paymentStatus = 'paid';
        task.paidAt = new Date();
        await task.save();

        console.log('✅ Task payment confirmed:', taskId);

        // Create notification for task owner
        try {
          const notification = await createNotification(
            transaction.fromUser._id,
            `Payment of KES ${TransAmount} confirmed for task "${task.title}"`,
            'payment',
            taskId
          );

          // Emit socket notification
          const io = req.app?.get('socketio');
          if (io) {
            io.to(`user_${transaction.fromUser._id}`).emit('newNotification', notification);
          }
        } catch (notifError) {
          console.error('Failed to create payment confirmation notification:', notifError);
        }
      }
    }

    // Always respond with success to M-Pesa
    res.json({ ResultCode: 0, ResultDesc: 'Success' });

  } catch (error) {
    console.error('❌ C2B confirmation processing failed:', error);
    // Still respond with success to avoid M-Pesa retries
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  }
});

/**
 * STEP 4: C2B Validation Callback (Optional)
 * M-Pesa calls this to validate payment before processing
 */
router.post('/validation', async (req, res) => {
  try {
    console.log('🔍 C2B Validation received:', req.body);
    
    // In sandbox, we'll accept all payments
    // In production, you might want to validate the BillRefNumber exists
    const { BillRefNumber, TransAmount } = req.body;
    
    // Extract task ID and validate
    const taskId = BillRefNumber?.replace('TASK_', '');
    
    if (!taskId) {
      console.log('❌ Invalid BillRefNumber:', BillRefNumber);
      return res.json({
        ResultCode: 'C2B00011',
        ResultDesc: 'Invalid Bill Reference'
      });
    }

    // Check if task exists
    const task = await Task.findById(taskId);
    if (!task) {
      console.log('❌ Task not found:', taskId);
      return res.json({
        ResultCode: 'C2B00012',
        ResultDesc: 'Task not found'
      });
    }

    // Validate amount matches task budget
    if (parseFloat(TransAmount) !== parseFloat(task.budget)) {
      console.log('❌ Amount mismatch:', TransAmount, 'vs', task.budget);
      return res.json({
        ResultCode: 'C2B00013',
        ResultDesc: 'Amount does not match task budget'
      });
    }

    console.log('✅ Payment validation passed');
    res.json({ ResultCode: 0, ResultDesc: 'Success' });

  } catch (error) {
    console.error('❌ C2B validation failed:', error);
    res.json({
      ResultCode: 'C2B00014',
      ResultDesc: 'Validation failed'
    });
  }
});

/**
 * STEP 5: B2C Payment Request (Campus Hub pays student)
 * Triggered when task owner approves completed work
 */
router.post('/b2c-payment', auth, async (req, res) => {
  try {
    const { taskId, phoneNumber } = req.body;

    if (!taskId || !phoneNumber) {
      return res.status(400).json({
        success: false,
        message: 'Task ID and phone number are required'
      });
    }

    // Validate task and permissions
    const task = await Task.findById(taskId)
      .populate('postedBy assignedTo');

    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    if (task.postedBy._id.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Only task owner can trigger payment'
      });
    }

    if (task.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Task must be completed before payment'
      });
    }

    if (!task.assignedTo) {
      return res.status(400).json({
        success: false,
        message: 'Task has no assigned user to pay'
      });
    }

    // Check if C2B payment was received for this task
    const c2bTransaction = await Transaction.findOne({
      task: taskId,
      transactionType: 'C2B',
      status: 'COMPLETED'
    });

    if (!c2bTransaction) {
      return res.status(400).json({
        success: false,
        message: 'No confirmed payment found for this task'
      });
    }

    // Check if B2C already processed
    const existingB2C = await Transaction.findOne({
      task: taskId,
      transactionType: 'B2C',
      status: { $in: ['PENDING', 'COMPLETED'] }
    });

    if (existingB2C) {
      return res.status(400).json({
        success: false,
        message: 'Payment already processed for this task'
      });
    }

    const formattedPhone = mpesaAuth.validatePhoneNumber(phoneNumber);
    
    // Calculate amounts with 10% commission
    const totalAmount = c2bTransaction.amount;
    const commission = totalAmount * 0.10;
    const payoutAmount = totalAmount - commission;

    console.log('💸 Processing B2C payment:', {
      taskId,
      totalAmount,
      commission,
      payoutAmount,
      phone: formattedPhone,
      assignedTo: task.assignedTo._id
    });

    // Create B2C transaction record
    const transaction = new Transaction({
      transactionType: 'B2C',
      amount: totalAmount,
      commission: commission,
      netAmount: payoutAmount,
      phoneNumber: formattedPhone,
      fromUser: req.userId,
      toUser: task.assignedTo._id,
      task: taskId,
      status: 'PENDING'
    });
    await transaction.save();

    const accessToken = await mpesaAuth.getAccessToken();

    const requestBody = {
      InitiatorName: 'testapi',
      SecurityCredential: mpesaAuth.generateSecurityCredential(),
      CommandID: 'BusinessPayment',
      Amount: Math.round(payoutAmount), // M-Pesa requires integer amount
      PartyA: SHORTCODE,
      PartyB: formattedPhone,
      Remarks: `Payment for task: ${task.title}`,
      QueueTimeOutURL: `${SERVER_BASE_URL}/api/mpesa/b2c-timeout`,
      ResultURL: `${SERVER_BASE_URL}/api/mpesa/b2c-result`,
      Occasion: `Task_${taskId}_Payment`
    };

    const response = await axios.post(`${BASE_URL}/mpesa/b2c/v1/paymentrequest`, requestBody, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('✅ B2C request response:', response.data);

    // Update transaction with M-Pesa response
    transaction.conversationId = response.data.ConversationID;
    transaction.originatorConversationId = response.data.OriginatorConversationID;
    transaction.responseCode = response.data.ResponseCode;
    transaction.responseDescription = response.data.ResponseDescription;
    await transaction.save();

    res.json({
      success: true,
      message: 'B2C payment initiated successfully',
      transactionId: transaction._id,
      payoutAmount,
      commission,
      data: response.data
    });

  } catch (error) {
    console.error('❌ B2C payment failed:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate B2C payment',
      error: error.response?.data || error.message
    });
  }
});

/**
 * STEP 6: B2C Result Callback
 * M-Pesa calls this with the final result of B2C payment
 */
router.post('/b2c-result', async (req, res) => {
  try {
    console.log('🎯 B2C Result received:', JSON.stringify(req.body, null, 2));

    const { Result } = req.body;
    const { ConversationID, OriginatorConversationID, ResultCode, ResultDesc } = Result;

    // Find transaction by conversation ID
    const transaction = await Transaction.findOne({
      $or: [
        { conversationId: ConversationID },
        { originatorConversationId: OriginatorConversationID }
      ],
      transactionType: 'B2C'
    }).populate('task toUser');

    if (!transaction) {
      console.log('⚠️ B2C transaction not found for conversation:', ConversationID);
      return res.json({ ResultCode: 0, ResultDesc: 'Success' });
    }

    // Update transaction status
    if (ResultCode === 0) {
      transaction.status = 'COMPLETED';
      transaction.completedAt = new Date();
      
      // Extract transaction ID from ResultParameters if available
      const resultParameters = Result.ResultParameters?.ResultParameter || [];
      const transactionIdParam = resultParameters.find(param => 
        param.Key === 'TransactionReceipt' || param.Key === 'TransactionID'
      );
      
      if (transactionIdParam) {
        transaction.mpesaTransactionId = transactionIdParam.Value;
        transaction.mpesaReceiptNumber = transactionIdParam.Value;
      }

      // Update task final status
      if (transaction.task) {
        await Task.findByIdAndUpdate(transaction.task._id, {
          paymentStatus: 'paid',
          status: 'paid'
        });

        console.log('✅ Task payment completed:', transaction.task._id);
      }

      // Create notification for student
      if (transaction.toUser) {
        try {
          const notification = await createNotification(
            transaction.toUser._id,
            `Payment of KES ${transaction.netAmount} received for completed task!`,
            'payment',
            transaction.task._id
          );

          // Emit socket notification
          const io = req.app?.get('socketio');
          if (io) {
            io.to(`user_${transaction.toUser._id}`).emit('newNotification', notification);
          }
        } catch (notifError) {
          console.error('Failed to create payment notification:', notifError);
        }
      }

    } else {
      transaction.status = 'FAILED';
      transaction.errorMessage = ResultDesc;
      console.log('❌ B2C payment failed:', ResultDesc);
    }

    transaction.responseCode = ResultCode.toString();
    transaction.responseDescription = ResultDesc;
    transaction.callbackReceived = true;
    transaction.callbackData = req.body;
    await transaction.save();

    res.json({ ResultCode: 0, ResultDesc: 'Success' });

  } catch (error) {
    console.error('❌ B2C result processing failed:', error);
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  }
});

/**
 * STEP 7: B2C Timeout Callback
 * M-Pesa calls this when B2C request times out
 */
router.post('/b2c-timeout', async (req, res) => {
  try {
    console.log('⏰ B2C Timeout received:', JSON.stringify(req.body, null, 2));

    const { Result } = req.body;
    const { ConversationID, OriginatorConversationID, ResultCode, ResultDesc } = Result;

    // Find transaction by conversation ID
    const transaction = await Transaction.findOne({
      $or: [
        { conversationId: ConversationID },
        { originatorConversationId: OriginatorConversationID }
      ],
      transactionType: 'B2C',
      status: 'PENDING'
    }).populate('task toUser fromUser');

    if (transaction) {
      transaction.status = 'TIMEOUT';
      transaction.errorMessage = ResultDesc || 'Transaction timed out';
      transaction.responseCode = ResultCode?.toString() || 'TIMEOUT';
      transaction.responseDescription = ResultDesc || 'Request timed out';
      transaction.callbackReceived = true;
      transaction.callbackData = req.body;
      await transaction.save();

      console.log('⏰ B2C transaction timed out:', transaction._id);

      // Create notification for task owner about timeout
      if (transaction.fromUser) {
        try {
          const notification = await createNotification(
            transaction.fromUser._id,
            `Payment to student timed out. Please try again or contact support.`,
            'error',
            transaction.task?._id
          );

          // Emit socket notification
          const io = req.app?.get('socketio');
          if (io) {
            io.to(`user_${transaction.fromUser._id}`).emit('newNotification', notification);
          }
        } catch (notifError) {
          console.error('Failed to create timeout notification:', notifError);
        }
      }
    } else {
      console.log('⚠️ B2C transaction not found for timeout callback:', ConversationID);
    }

    res.json({ ResultCode: 0, ResultDesc: 'Success' });

  } catch (error) {
    console.error('❌ B2C timeout processing failed:', error);
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  }
});

/**
 * STEP 8: Get Transaction History
 * Fetch transaction history for a user or task
 */
router.get('/transactions', auth, async (req, res) => {
  try {
    const { taskId, type, page = 1, limit = 10 } = req.query;
    const userId = req.userId;

    let query = {
      $or: [
        { fromUser: userId },
        { toUser: userId }
      ]
    };

    // Filter by task if provided
    if (taskId) {
      query.task = taskId;
    }

    // Filter by transaction type if provided
    if (type && ['C2B', 'B2C'].includes(type.toUpperCase())) {
      query.transactionType = type.toUpperCase();
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const transactions = await Transaction.find(query)
      .populate('task', 'title description budget')
      .populate('fromUser', 'name email')
      .populate('toUser', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Transaction.countDocuments(query);

    res.json({
      success: true,
      transactions,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });

  } catch (error) {
    console.error('❌ Failed to fetch transactions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: error.message
    });
  }
});

/**
 * STEP 9: Get Single Transaction
 * Get details of a specific transaction
 */
router.get('/transaction/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const transaction = await Transaction.findOne({
      _id: id,
      $or: [
        { fromUser: userId },
        { toUser: userId }
      ]
    })
    .populate('task', 'title description budget status')
    .populate('fromUser', 'name email phone')
    .populate('toUser', 'name email phone');

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found or access denied'
      });
    }

    res.json({
      success: true,
      transaction
    });

  } catch (error) {
    console.error('❌ Failed to fetch transaction:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction',
      error: error.message
    });
  }
});

/**
 * STEP 10: Get M-Pesa Balance (Optional utility)
 * Check M-Pesa account balance
 */
router.get('/balance', auth, async (req, res) => {
  try {
    const accessToken = await mpesaAuth.getAccessToken();

    const requestBody = {
      Initiator: 'testapi',
      SecurityCredential: mpesaAuth.generateSecurityCredential(),
      CommandID: 'AccountBalance',
      PartyA: SHORTCODE,
      IdentifierType: '4',
      Remarks: 'Balance inquiry',
      QueueTimeOutURL: `${SERVER_BASE_URL}/api/mpesa/balance-timeout`,
      ResultURL: `${SERVER_BASE_URL}/api/mpesa/balance-result`
    };

    const response = await axios.post(`${BASE_URL}/mpesa/accountbalance/v1/query`, requestBody, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('✅ Balance inquiry response:', response.data);

    res.json({
      success: true,
      message: 'Balance inquiry initiated',
      data: response.data
    });

  } catch (error) {
    console.error('❌ Balance inquiry failed:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to check balance',
      error: error.response?.data || error.message
    });
  }
});

module.exports = router;