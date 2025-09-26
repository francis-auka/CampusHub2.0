import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import AuthProvider from './AuthContext';

const NotificationContext = createContext();

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { token, isAuthenticated, user } = AuthProvider.useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const API_BASE = 'http://localhost:5000';

  // Initialize socket connection
  useEffect(() => {
    if (isAuthenticated && token && user) {
      console.log('🔌 Initializing socket connection...');
      
      const newSocket = io('http://localhost:5000', {
        transports: ['websocket'],
        upgrade: true
      });

      newSocket.on('connect', () => {
        console.log('✅ Socket connected:', newSocket.id);
        // Authenticate with the server
        newSocket.emit('authenticate', token);
      });

      newSocket.on('authenticated', (data) => {
        console.log('✅ Socket authenticated for user:', data.userId);
      });

      newSocket.on('authError', (error) => {
        console.error('❌ Socket authentication error:', error.message);
        setError('Failed to establish real-time connection');
      });

      // Listen for new notifications
      newSocket.on('newNotification', (notification) => {
        console.log('🔔 New notification received:', notification);
        
        // Add to notifications list
        setNotifications(prev => [notification, ...prev]);
        
        // Update unread count
        setUnreadCount(prev => prev + 1);
        
        // Show browser notification if permitted
        if (Notification.permission === 'granted') {
          new Notification('Campus Hub', {
            body: notification.message,
            icon: '/favicon.ico'
          });
        }
      });

      newSocket.on('disconnect', () => {
        console.log('🔌 Socket disconnected');
      });

      newSocket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
        setError('Connection error. Real-time notifications may not work.');
      });

      setSocket(newSocket);

      return () => {
        console.log('🔌 Cleaning up socket connection');
        newSocket.disconnect();
      };
    }
  }, [isAuthenticated, token, user]);

  // Fetch notifications from server
  const fetchNotifications = useCallback(async () => {
    if (!token || !isAuthenticated) return;

    try {
      setLoading(true);
      setError('');

      const response = await fetch(`${API_BASE}/api/notifications`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setNotifications(data);
      
      // Calculate unread count
      const unread = data.filter(n => !n.isRead).length;
      setUnreadCount(unread);

    } catch (error) {
      console.error('Error fetching notifications:', error);
      setError('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [token, isAuthenticated]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!token || !isAuthenticated) return;

    try {
      const response = await fetch(`${API_BASE}/api/notifications/unread-count`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count);
      }
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  }, [token, isAuthenticated]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Update local state
        setNotifications(prev => 
          prev.map(n => 
            n._id === notificationId ? { ...n, isRead: true } : n
          )
        );
        
        // Decrease unread count
        setUnreadCount(prev => Math.max(0, prev - 1));
        
        // Emit socket event for real-time update
        if (socket) {
          socket.emit('markNotificationRead', notificationId);
        }
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }, [token, socket]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/notifications/mark-all-read`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Update local state
        setNotifications(prev => 
          prev.map(n => ({ ...n, isRead: true }))
        );
        
        // Reset unread count
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }, [token]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId) => {
    if (!token) return;

    try {
      const response = await fetch(`${API_BASE}/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Remove from local state
        const notification = notifications.find(n => n._id === notificationId);
        setNotifications(prev => prev.filter(n => n._id !== notificationId));
        
        // Decrease unread count if it was unread
        if (notification && !notification.isRead) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  }, [token, notifications]);

  // Request browser notification permission
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      requestNotificationPermission();
    } else {
      // Clear state when not authenticated
      setNotifications([]);
      setUnreadCount(0);
      setError('');
    }
  }, [isAuthenticated, fetchNotifications, requestNotificationPermission]);

  // Format notification time
  const formatNotificationTime = useCallback((createdAt) => {
    const now = new Date();
    const notifTime = new Date(createdAt);
    const diffMs = now - notifTime;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return notifTime.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  }, []);

  // Get notification icon based on type
  const getNotificationIcon = useCallback((type) => {
    const icons = {
      application: '📝',
      assignment: '✅',
      completion: '🎉',
      payment: '💰',
      general: '🔔'
    };
    return icons[type] || icons.general;
  }, []);

  const value = {
    notifications,
    unreadCount,
    loading,
    error,
    socket,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    formatNotificationTime,
    getNotificationIcon,
    requestNotificationPermission
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;