const express = require('express');
const auth = require('../middleware/auth');
const userController = require('../controllers/userController');

const router = express.Router();

// All routes require authentication
router.use(auth);

// GET /api/users/profile - Get user profile
router.get('/profile', userController.getProfile);

// PUT /api/users/profile - Update user profile
router.put('/profile', userController.updateProfile);

// DELETE /api/users/account - Delete user account
router.delete('/account', userController.deleteAccount);

// GET /api/users/stats - Get user statistics
router.get('/stats', userController.getUserStats);

module.exports = router;