const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  taskId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for efficient queries
messageSchema.index({ taskId: 1, timestamp: 1 });

module.exports = mongoose.model('Message', messageSchema);