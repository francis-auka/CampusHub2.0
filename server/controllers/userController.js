const User = require('../models/User');
const bcrypt = require('bcryptjs');

const userController = {
  // Get user profile
  getProfile: async (req, res) => {
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
        tasksCompleted: user.tasksCompleted,
        createdAt: user.createdAt
      };

      res.json({ user: userData });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  },

  // Update user profile
  updateProfile: async (req, res) => {
    try {
      const { name, email, phoneNumber, university, course, currentPassword, newPassword } = req.body;
      
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check if email is being changed and if it already exists
      if (email && email !== user.email) {
        const emailExists = await User.findOne({ email, _id: { $ne: req.userId } });
        if (emailExists) {
          return res.status(400).json({ message: 'Email already in use' });
        }
        user.email = email;
      }

      // Check if phone number is being changed and if it already exists
      if (phoneNumber && phoneNumber !== user.phoneNumber) {
        const phoneExists = await User.findOne({ 
          phoneNumber: phoneNumber, 
          _id: { $ne: req.userId } 
        });
        if (phoneExists) {
          return res.status(400).json({ message: 'Phone number already in use' });
        }
        user.phoneNumber = phoneNumber;
      }

      // Update basic info
      if (name) user.name = name;
      if (university !== undefined) user.university = university;
      if (course !== undefined) user.course = course;

      // Handle password change
      if (newPassword) {
        if (!currentPassword) {
          return res.status(400).json({ 
            message: 'Current password is required to set new password' 
          });
        }

        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
          return res.status(400).json({ message: 'Current password is incorrect' });
        }

        if (newPassword.length < 6) {
          return res.status(400).json({ 
            message: 'New password must be at least 6 characters long' 
          });
        }

        user.password = newPassword; // Will be hashed by pre-save middleware
      }

      await user.save();

      // Return updated user data without password
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
        message: 'Profile updated successfully',
        user: userData
      });

    } catch (error) {
      console.error('Update profile error:', error);
      
      if (error.name === 'ValidationError') {
        const messages = Object.values(error.errors).map(err => err.message);
        return res.status(400).json({ message: messages.join(', ') });
      }
      
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(400).json({ 
          message: `${field === 'phoneNumber' ? 'Phone number' : 'Email'} already in use` 
        });
      }

      res.status(500).json({ message: 'Server error during profile update' });
    }
  },

  // Delete user account (optional)
  deleteAccount: async (req, res) => {
    try {
      const { password } = req.body;
      
      const user = await User.findById(req.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Verify password before deletion
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: 'Password is incorrect' });
      }

      await User.findByIdAndDelete(req.userId);

      res.json({ message: 'Account deleted successfully' });
    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({ message: 'Server error during account deletion' });
    }
  },

  // Get user stats (for dashboard)
  getUserStats: async (req, res) => {
    try {
      const user = await User.findById(req.userId).select('-password');
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // You can expand this to include more stats from Task model
      const stats = {
        rating: user.rating,
        tasksCompleted: user.tasksCompleted,
        memberSince: user.createdAt,
        profileComplete: !!(user.name && user.email && user.phoneNumber)
      };

      res.json({ stats });
    } catch (error) {
      console.error('Get user stats error:', error);
      res.status(500).json({ message: 'Server error' });
    }
  }
};

module.exports = userController;