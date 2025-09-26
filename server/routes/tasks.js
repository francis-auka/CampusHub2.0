const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const auth = require('../middleware/auth');
const User = require('../models/User');
const { createNotification } = require('./notifications');

/**
 * Create a new task
 */
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, budget } = req.body;

    if (!title || !description || !budget) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const task = new Task({
      title,
      description,
      budget,
      postedBy: req.userId
    });

    await task.save();
    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ message: 'Server error creating task', error: error.message });
  }
});

/**
 * Dashboard routes - MOVED BEFORE /:id route
 */

// Tasks posted by logged-in user
router.get('/my-tasks', auth, async (req, res) => {
  try {
    console.log('📋 Fetching my-tasks for user:', req.userId);
    if (!req.userId) throw new Error('Missing userId from auth middleware');
    
    const tasks = await Task.find({ postedBy: req.userId })
      .populate('assignedTo', 'name email')
      .populate('applicants.user', 'name email')
      .sort({ createdAt: -1 });
    
    console.log('✅ Found', tasks.length, 'tasks posted by user');
    res.json(tasks);
  } catch (error) {
    console.error('Error in /api/tasks/my-tasks:', error);
    res.status(500).json({ message: 'Server error in /my-tasks', error: error.message });
  }
});

// Tasks user has applied to
router.get('/applied', auth, async (req, res) => {
  try {
    console.log('📋 Fetching applied tasks for user:', req.userId);
    if (!req.userId) throw new Error('Missing userId from auth middleware');
    
    const tasks = await Task.find({
      'applicants.user': req.userId,
      assignedTo: { $ne: req.userId } // Exclude tasks already assigned to this user
    })
      .populate('postedBy', 'name university')
      .populate('applicants.user', 'name email')
      .sort({ createdAt: -1 });
    
    console.log('✅ Found', tasks.length, 'applied tasks for user');
    res.json(tasks);
  } catch (error) {
    console.error('Error in /api/tasks/applied:', error);
    res.status(500).json({ message: 'Server error in /applied', error: error.message });
  }
});

// Tasks assigned to logged-in user (only in-progress)
router.get('/assigned', auth, async (req, res) => {
  try {
    console.log('📋 Fetching assigned tasks for user:', req.userId);
    if (!req.userId) throw new Error('Missing userId from auth middleware');
    
    const tasks = await Task.find({
      assignedTo: req.userId,
      status: 'in-progress'
    })
      .populate('postedBy', 'name university')
      .sort({ createdAt: -1 });
    
    console.log('✅ Found', tasks.length, 'assigned tasks for user');
    res.json(tasks);
  } catch (error) {
    console.error('Error in /api/tasks/assigned:', error);
    res.status(500).json({ message: 'Server error in /assigned', error: error.message });
  }
});

// Completed tasks (both completed and paid)
router.get('/completed', auth, async (req, res) => {
  try {
    console.log('📋 Fetching completed tasks for user:', req.userId);
    if (!req.userId) throw new Error('Missing userId from auth middleware');
    
    // Get both completed and paid tasks where user was assigned
    const tasks = await Task.find({
      $or: [
        // Tasks assigned to user that are completed (regardless of payment status)
        {
          assignedTo: req.userId,
          status: 'completed'
        },
        // Tasks assigned to user that are paid
        {
          assignedTo: req.userId,
          paymentStatus: 'paid'
        },
        // Tasks posted by user that are paid
        {
          postedBy: req.userId,
          paymentStatus: 'paid'
        }
      ]
    })
      .populate('postedBy', 'name university')
      .populate('assignedTo', 'name email')
      .sort({ updatedAt: -1 });
    
    console.log('✅ Found', tasks.length, 'completed tasks for user');
    res.json(tasks);
  } catch (error) {
    console.error('Error in /api/tasks/completed:', error);
    res.status(500).json({ message: 'Server error in /completed', error: error.message });
  }
});

/**
 * Get all tasks (general listing)
 */
router.get('/', auth, async (req, res) => {
  try {
    const tasks = await Task.find()
      .populate('postedBy', 'name university')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ message: 'Server error fetching tasks', error: error.message });
  }
});

/**
 * Get a single task by ID - MOVED AFTER specific routes
 */
router.get('/:id', auth, async (req, res) => {
  try {
    console.log('📋 Fetching single task:', req.params.id);
    
    const task = await Task.findById(req.params.id)
      .populate('postedBy', 'name university')
      .populate('applicants.user', 'name email')
      .populate('assignedTo', 'name email');

    if (!task) return res.status(404).json({ message: 'Task not found' });

    res.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ message: 'Server error fetching task', error: error.message });
  }
});

/**
 * Apply to a task - ENHANCED WITH NOTIFICATIONS
 */
router.post('/:id/apply', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id).populate('postedBy', 'name');

    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.postedBy._id.toString() === req.userId) {
      return res.status(400).json({ message: 'You cannot apply to your own task' });
    }
    if (task.applicants.some(app => app.user.toString() === req.userId)) {
      return res.status(400).json({ message: 'You already applied to this task' });
    }

    // Get applicant details
    const applicant = await User.findById(req.userId);

    task.applicants.push({ user: req.userId });
    await task.save();

    // 🔔 CREATE NOTIFICATION for task poster
    try {
      const notification = await createNotification(
        task.postedBy._id,
        `${applicant.name} applied to your task "${task.title}"`,
        'application',
        task._id,
        req.userId
      );

      // 📡 EMIT SOCKET EVENT to task poster
      const io = req.app.get('socketio');
      if (io) {
        io.to(`user_${task.postedBy._id}`).emit('newNotification', notification);
        console.log('✅ Notification sent via socket to user:', task.postedBy._id);
      }
    } catch (notifError) {
      console.error('Failed to create application notification:', notifError);
      // Don't fail the entire operation if notification fails
    }

    res.json({ message: 'Applied successfully', task });
  } catch (error) {
    console.error('Error applying to task:', error);
    res.status(500).json({ message: 'Server error applying to task', error: error.message });
  }
});

/**
 * Assign a task to an applicant - ENHANCED WITH NOTIFICATIONS
 */
router.post('/:id/assign', auth, async (req, res) => {
  try {
    const { applicantId } = req.body;
    const task = await Task.findById(req.params.id).populate('postedBy', 'name');

    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.postedBy._id.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Get assignee details
    const assignee = await User.findById(applicantId);

    task.assignedTo = applicantId;
    task.status = 'in-progress';
    await task.save();

    // 🔔 CREATE NOTIFICATION for assigned user
    try {
      const notification = await createNotification(
        applicantId,
        `You have been assigned to the task "${task.title}"`,
        'assignment',
        task._id,
        req.userId
      );

      // 📡 EMIT SOCKET EVENT to assigned user
      const io = req.app.get('socketio');
      if (io) {
        io.to(`user_${applicantId}`).emit('newNotification', notification);
        console.log('✅ Assignment notification sent via socket to user:', applicantId);
      }
    } catch (notifError) {
      console.error('Failed to create assignment notification:', notifError);
      // Don't fail the entire operation if notification fails
    }

    res.json({ message: 'Task assigned successfully', task });
  } catch (error) {
    console.error('Error assigning task:', error);
    res.status(500).json({ message: 'Server error assigning task', error: error.message });
  }
});

/**
 * Mark task as completed - ENHANCED WITH NOTIFICATIONS
 */
router.patch('/:id/complete', auth, async (req, res) => {
  try {
    console.log('📋 Completing task:', req.params.id, 'by user:', req.userId);
    
    const task = await Task.findById(req.params.id).populate('postedBy', 'name');

    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.assignedTo.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only the assigned user can complete this task' });
    }

    // Get completer details
    const completer = await User.findById(req.userId);

    task.status = 'completed';
    task.completedAt = new Date();
    await task.save();

    // 🔔 CREATE NOTIFICATION for task poster
    try {
      const notification = await createNotification(
        task.postedBy._id,
        `${completer.name} completed your task "${task.title}"`,
        'completion',
        task._id,
        req.userId
      );

      // 📡 EMIT SOCKET EVENT to task poster
      const io = req.app.get('socketio');
      if (io) {
        io.to(`user_${task.postedBy._id}`).emit('newNotification', notification);
        console.log('✅ Completion notification sent via socket to user:', task.postedBy._id);
      }
    } catch (notifError) {
      console.error('Failed to create completion notification:', notifError);
      // Don't fail the entire operation if notification fails
    }

    console.log('✅ Task completed successfully');
    res.json({ message: 'Task marked as completed', task });
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({ message: 'Server error completing task', error: error.message });
  }
});

/**
 * Process payment for a completed task - ENHANCED WITH NOTIFICATIONS
 */
router.patch('/:id/pay', auth, async (req, res) => {
  try {
    console.log('💰 Payment request received:', {
      taskId: req.params.id,
      userId: req.userId,
      headers: req.headers.authorization ? 'Bearer token present' : 'No token'
    });

    const task = await Task.findById(req.params.id).populate('assignedTo', 'name');

    console.log('📋 Task details:', {
      postedBy: task?.postedBy?.toString(),
      requestUserId: req.userId,
      status: task?.status,
      paymentStatus: task?.paymentStatus
    });

    if (!task) return res.status(404).json({ message: 'Task not found' });
    if (task.postedBy.toString() !== req.userId) {
      return res.status(403).json({ message: 'Only the task owner can process payment' });
    }
    if (task.status !== 'completed') {
      return res.status(400).json({ message: 'Task must be completed before payment' });
    }
    if (task.paymentStatus === 'paid') {
      return res.status(400).json({ message: 'Task already paid' });
    }

    // Get payer details
    const payer = await User.findById(req.userId);

    task.paymentStatus = 'paid';
    task.paidAt = new Date();
    await task.save();

    // 🔔 CREATE NOTIFICATION for assigned user
    try {
      const notification = await createNotification(
        task.assignedTo._id,
        `Payment of KES ${task.budget} has been processed for task "${task.title}"`,
        'payment',
        task._id,
        req.userId
      );

      // 📡 EMIT SOCKET EVENT to assigned user
      const io = req.app.get('socketio');
      if (io) {
        io.to(`user_${task.assignedTo._id}`).emit('newNotification', notification);
        console.log('✅ Payment notification sent via socket to user:', task.assignedTo._id);
      }
    } catch (notifError) {
      console.error('Failed to create payment notification:', notifError);
      // Don't fail the entire operation if notification fails
    }

    console.log('✅ Payment processed successfully');
    res.json({ message: 'Payment processed successfully', task });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ message: 'Server error processing payment', error: error.message });
  }
});

module.exports = router;