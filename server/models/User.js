const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6
  },
  phoneNumber: {
    type: String,
    required: [true, 'Phone number is required'],
    trim: true,
    validate: {
      validator: function(v) {
        if (!v) return false;
        // Kenyan phone number validation
        return /^(\+?254|0)[17]\d{8}$/.test(v);
      },
      message: 'Please enter a valid Kenyan phone number (e.g., 254712345678 or 0712345678)'
    },
    unique: true
  },
  university: {
    type: String,
    trim: true
  },
  course: {
    type: String,
    trim: true
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  tasksCompleted: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Normalize phone number before saving
userSchema.pre('save', function(next) {
  if (this.isModified('phoneNumber') && this.phoneNumber) {
    let phone = this.phoneNumber.toString().replace(/\s+/g, '');

    if (phone.startsWith('+254')) {
      phone = phone.substring(1); // strip '+'
    } else if (phone.startsWith('0')) {
      phone = '254' + phone.substring(1); // convert 07... → 2547...
    }

    this.phoneNumber = phone;
  }
  next();
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Get formatted phone number for display
userSchema.methods.getFormattedPhone = function() {
  const phone = this.phoneNumber;
  if (!phone) return ''; // prevent crash for old users
  if (phone.startsWith('254')) {
    return `+${phone}`;
  }
  return phone;
};

module.exports = mongoose.model('User', userSchema);
