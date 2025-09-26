const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Task title is required'],
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: [true, 'Task description is required'],
    trim: true,
    maxlength: 1000
  },
  budget: {
    type: Number,
    required: [true, 'Budget is required'],
    min: 0
  },
  category: {
    type: String,
    enum: ['Academic', 'Technical', 'Creative', 'Research', 'Other'],
    default: 'Other'
  },
  status: {
    type: String,
    enum: ['open', 'in-progress', 'completed', 'paid', 'cancelled'],
    default: 'open'
  },
  paymentStatus: {
    type: String,
    enum: ['unpaid', 'paid'],
    default: 'unpaid'
  },
  deadline: {
    type: Date
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  applicants: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    appliedAt: {
      type: Date,
      default: Date.now
    }
  }],
  completedAt: {
    type: Date
  },
  paidAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

taskSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Task', taskSchema);
