const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const auth = require('../middleware/auth');

/**
 * Get all notifications for the logged-in user
 */
router.get('/', auth, async (req, res) => {
  try {
    console.log('🔔 Fetching notifications for user:', req.userId);
    
    const notifications = await Notification.find({ user: req.userId })
      .populate('relatedTask', 'title')
      .populate('relatedUser', 'name email')
      .sort({ createdAt: -1 })
      .limit(50); // Limit to latest 50 notifications
    
    console.log('✅ Found', notifications.length, 'notifications');
    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error fetching notifications', error: error.message });
  }
});

/**
 * Get unread notification count
 */
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ 
      user: req.userId, 
      isRead: false 
    });
    
    res.json({ count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ message: 'Server error fetching unread count', error: error.message });
  }
});

/**
 * Mark a specific notification as read
 */
router.patch('/:id/read', auth, async (req, res) => {
  try {
    console.log('📖 Marking notification as read:', req.params.id);
    
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    console.log('✅ Notification marked as read');
    res.json(notification);
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Server error marking notification as read', error: error.message });
  }
});

/**
 * Mark all notifications as read for the user
 */
router.patch('/mark-all-read', auth, async (req, res) => {
  try {
    console.log('📖 Marking all notifications as read for user:', req.userId);
    
    const result = await Notification.updateMany(
      { user: req.userId, isRead: false },
      { isRead: true }
    );

    console.log('✅ Marked', result.modifiedCount, 'notifications as read');
    res.json({ message: 'All notifications marked as read', count: result.modifiedCount });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Server error marking notifications as read', error: error.message });
  }
});

/**
 * Delete a notification
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.userId
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Server error deleting notification', error: error.message });
  }
});

/**
 * Utility function to create notifications (for use in other routes)
 */
const createNotification = async (userId, message, type, relatedTask = null, relatedUser = null) => {
  try {
    const notification = new Notification({
      user: userId,
      message,
      type,
      relatedTask,
      relatedUser
    });

    await notification.save();
    
    // Populate the notification for socket emission
    const populatedNotification = await Notification.findById(notification._id)
      .populate('relatedTask', 'title')
      .populate('relatedUser', 'name email');

    return populatedNotification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

module.exports = router;
module.exports.createNotification = createNotification;