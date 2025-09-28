const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const messageRoutes = require('./routes/messages');
const notificationRoutes = require('./routes/notifications');

const app = express();
const server = http.createServer(app);

// CORS configuration - allow your Vercel domain
const corsOptions = {
  origin: [
    "http://localhost:3000", 
    "http://localhost:5173",
    "https://campus-hub2-0-atcenjzi3-francis-aukas-projects.vercel.app", // ✅ Your actual Vercel URL
    "https://campus-hub2-0.vercel.app", // In case Vercel gives you a shorter URL later
    process.env.FRONTEND_URL // You can also set this as an environment variable
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

// Socket.IO setup with updated CORS
const io = socketIo(server, {
  cors: corsOptions
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Make io available to routes
app.set('socketio', io);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/notifications', notificationRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Campus Hub API is running!' });
});

// Test endpoint to verify API routes work
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Campus Hub API routes are working!',
    timestamp: new Date().toISOString(),
    availableRoutes: [
      'POST /api/auth/login',
      'POST /api/auth/register',
      'GET /api/tasks',
      'GET /api/notifications'
    ]
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Enhanced Socket.IO connection handling with authentication
io.on('connection', (socket) => {
  console.log('👤 User connected:', socket.id);

  // Handle user authentication and join user-specific room
  socket.on('authenticate', (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      socket.userId = decoded.userId;
      
      // Join user-specific room for notifications
      socket.join(`user_${decoded.userId}`);
      console.log(`✅ User ${decoded.userId} authenticated and joined their notification room`);
      
      // Emit successful authentication
      socket.emit('authenticated', { userId: decoded.userId });
    } catch (error) {
      console.error('❌ Socket authentication failed:', error.message);
      socket.emit('authError', { message: 'Authentication failed' });
    }
  });

  // Join a task room for task-specific messaging
  socket.on('joinTaskRoom', (taskId) => {
    socket.join(`task_${taskId}`);
    console.log(`📋 Socket ${socket.id} joined task room: task_${taskId}`);
  });

  // Leave a task room
  socket.on('leaveTaskRoom', (taskId) => {
    socket.leave(`task_${taskId}`);
    console.log(`📋 Socket ${socket.id} left task room: task_${taskId}`);
  });

  // Handle new messages in task rooms
  socket.on('sendMessage', (messageData) => {
    // Emit to all users in the task room except sender
    socket.to(`task_${messageData.taskId}`).emit('newMessage', messageData);
    console.log(`💬 Message sent to task room: task_${messageData.taskId}`);
  });

  // Handle marking notifications as read
  socket.on('markNotificationRead', (notificationId) => {
    // This could trigger a database update if needed
    console.log(`📖 Notification ${notificationId} marked as read by user ${socket.userId}`);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('👤 User disconnected:', socket.id);
    if (socket.userId) {
      console.log(`📤 User ${socket.userId} left their notification room`);
    }
  });

  // Handle connection errors
  socket.on('error', (error) => {
    console.error('🔌 Socket error:', error);
  });
});

// Database connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/campushub');
    console.log('🔗 MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Connect to database
connectDB();

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🔔 Real-time notifications enabled via Socket.IO`);
});