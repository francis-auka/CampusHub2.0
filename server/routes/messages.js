const express = require('express');
const Message = require('../models/Message');
const Task = require('../models/Task');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Test route to verify message routes work
router.get('/test', (req, res) => {
  res.json({ message: 'Message routes working!' });
});

// Get messages for a specific task
router.get('/:taskId', auth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.userId; // Using your auth pattern

    // First, verify the user has access to this task (is owner or assigned)
    const task = await Task.findById(taskId).populate('postedBy assignedTo');
   
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Check if user is authorized to view messages
    const isOwner = task.postedBy._id.toString() === userId.toString();
    const isAssigned = task.assignedTo && task.assignedTo._id.toString() === userId.toString();
   
    if (!isOwner && !isAssigned) {
      return res.status(403).json({ message: 'Not authorized to view these messages' });
    }

    // Get messages for this task
    const messages = await Message.find({ taskId })
      .populate('sender', 'name')
      .sort({ timestamp: 1 });

    res.json(messages);

  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// FIXED: Send a new message - changed from POST /:taskId to POST /
router.post('/', auth, async (req, res) => {
  try {
    const { taskId, content } = req.body; // Get taskId from body, not params
    const userId = req.userId; // Using your auth pattern

    if (!content || !content.trim()) {
      return res.status(400).json({ message: 'Message content is required' });
    }

    if (!taskId) {
      return res.status(400).json({ message: 'Task ID is required' });
    }

    // Get user info for the message
    const user = await User.findById(userId).select('name');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Verify the user has access to this task
    const task = await Task.findById(taskId).populate('postedBy assignedTo');
   
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const isOwner = task.postedBy._id.toString() === userId.toString();
    const isAssigned = task.assignedTo && task.assignedTo._id.toString() === userId.toString();
   
    if (!isOwner && !isAssigned) {
      return res.status(403).json({ message: 'Not authorized to send messages for this task' });
    }

    // Create new message
    const message = new Message({
      taskId,
      sender: userId,
      senderName: user.name,
      content: content.trim()
    });

    await message.save();

    // Populate sender info for response
    await message.populate('sender', 'name');

    // Emit the message to all clients in the task room via Socket.IO
    const io = req.app.get('socketio');
    if (io) {
      io.to(`task_${taskId}`).emit('newMessage', {
        _id: message._id,
        taskId: message.taskId,
        sender: message.sender,
        senderName: message.senderName || user.name,
        content: message.content,
        timestamp: message.timestamp,
        createdAt: message.timestamp // FIXED: Add createdAt for frontend compatibility
      });
    }

    res.status(201).json({
      _id: message._id,
      taskId: message.taskId,
      sender: message.sender,
      senderName: message.senderName,
      content: message.content,
      timestamp: message.timestamp,
      createdAt: message.timestamp // FIXED: Add createdAt for frontend compatibility
    });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Mark messages as read
router.put('/:taskId/read', auth, async (req, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.userId; // Using your auth pattern

    // Mark all unread messages in this task as read (except sender's own messages)
    await Message.updateMany(
      {
        taskId,
        sender: { $ne: userId },
        isRead: false
      },
      { isRead: true }
    );

    res.json({ message: 'Messages marked as read' });

  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;