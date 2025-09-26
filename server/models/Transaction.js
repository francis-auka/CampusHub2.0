const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  // Core transaction details
  transactionType: {
    type: String,
    enum: ['C2B', 'B2C', 'REVERSAL'],
    required: true
  },
  
  // M-Pesa transaction details
  mpesaTransactionId: {
    type: String,
    sparse: true // Allows null values but ensures uniqueness when present
  },
  mpesaReceiptNumber: {
    type: String,
    sparse: true
  },
  conversationId: String,
  originatorConversationId: String,
  
  // Amount details
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  commission: {
    type: Number,
    default: 0,
    min: 0
  },
  netAmount: {
    type: Number, // Amount after commission
    min: 0
  },
  
  // Phone numbers
  phoneNumber: {
    type: String,
    required: true,
    match: /^254\d{9}$/ // Kenyan phone number format
  },
  
  // Users involved
  fromUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  toUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Related task
  task: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  },
  
  // Transaction status
  status: {
    type: String,
    enum: ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'],
    default: 'PENDING'
  },
  
  // M-Pesa response details
  responseCode: String,
  responseDescription: String,
  
  // Error handling
  errorMessage: String,
  
  // Callback data
  callbackReceived: {
    type: Boolean,
    default: false
  },
  callbackData: mongoose.Schema.Types.Mixed,
  
  // Timestamps
  initiatedAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date,
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Middleware to update updatedAt
transactionSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Calculate net amount after commission
transactionSchema.pre('save', function (next) {
  if (this.transactionType === 'B2C' && this.amount && !this.netAmount) {
    this.commission = this.amount * 0.10; // 10% commission
    this.netAmount = this.amount - this.commission;
  }
  next();
});

// Indexes for better query performance
transactionSchema.index({ mpesaTransactionId: 1 });
transactionSchema.index({ task: 1 });
transactionSchema.index({ fromUser: 1 });
transactionSchema.index({ toUser: 1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);