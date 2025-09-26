const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const router = express.Router();

// Register route
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phoneNumber, university, course } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { phoneNumber: phoneNumber }] 
    });
    
    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({ message: 'User with this email already exists' });
      }
      if (existingUser.phoneNumber === phoneNumber) {
        return res.status(400).json({ message: 'User with this phone number already exists' });
      }
    }

    // Create new user
    const user = new User({
      name,
      email,
      password,
      phoneNumber,
      university,
      course
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return user data without password
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      phoneNumber: user.getFormattedPhone(),
      university: user.university,
      course: user.course,
      rating: user.rating,
      tasksCompleted: user.tasksCompleted
    };

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: userData
    });

  } catch (error) {
    console.error('Registration error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ message: messages.join(', ') });
    }
    
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({ 
        message: `User with this ${field} already exists` 
      });
    }

    res.status(500).json({ message: 'Server error during registration' });
  }
});

// Login route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Return user data without password
    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      phoneNumber: user.getFormattedPhone(),
      university: user.university,
      course: user.course,
      rating: user.rating,
      tasksCompleted: user.tasksCompleted
    };

    res.json({
      message: 'Login successful',
      token,
      user: userData
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// Get current user route (protected)
router.get('/me', require('../middleware/auth'), async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const userData = {
      id: user._id,
      name: user.name,
      email: user.email,
      phoneNumber: user.getFormattedPhone(),
      university: user.university,
      course: user.course,
      rating: user.rating,
      tasksCompleted: user.tasksCompleted
    };

    res.json({ user: userData });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;