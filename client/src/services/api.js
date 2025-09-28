import axios from 'axios';

// CORRECT: Backend does use /api prefix based on server.js
const API_URL = 'https://campushub2-0-kwrg.onrender.com/api';

// Debug logs to verify
console.log('🚨 CAMPUS HUB API DEBUG');
console.log('🌐 API URL:', API_URL);
console.log('🌍 Current hostname:', window.location.hostname);
console.log('📍 Frontend URL:', window.location.href);

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 15000
});

// Add token to requests if available
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  console.log('📤 Making request to:', config.baseURL + config.url);
  return config;
});

// Enhanced error handling interceptor
api.interceptors.response.use(
  (response) => {
    console.log('✅ Success:', response.status, response.config.url);
    return response;
  },
  (error) => {
    console.error('❌ API Error Details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      message: error.response?.data?.message || error.message,
      url: error.config?.url,
      method: error.config?.method,
      baseURL: error.config?.baseURL,
      fullUrl: error.config?.baseURL + error.config?.url
    });
    return Promise.reject(error);
  }
);

// Auth services
export const authService = {
  register: async (userData) => {
    console.log('🔐 Attempting registration...');
    const response = await api.post('/auth/register', userData);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  login: async (credentials) => {
    console.log('🔐 Attempting login...');
    const response = await api.post('/auth/login', credentials);
    if (response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getCurrentUser: () => {
    return JSON.parse(localStorage.getItem('user'));
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  }
};

// Enhanced task services
export const taskService = {
  getAllTasks: async () => {
    const response = await api.get('/tasks');
    return response.data;
  },

  createTask: async (taskData) => {
    const response = await api.post('/tasks', taskData);
    return response.data;
  },

  getMyTasks: async () => {
    const response = await api.get('/tasks/my-tasks');
    return response.data;
  },

  getAppliedTasks: async () => {
    const response = await api.get('/tasks/applied');
    return response.data;
  },

  getAssignedTasks: async () => {
    const response = await api.get('/tasks/assigned');
    return response.data;
  },

  getCompletedTasks: async () => {
    const response = await api.get('/tasks/completed');
    return response.data;
  },

  getTaskById: async (taskId) => {
    const response = await api.get(`/tasks/${taskId}`);
    return response.data;
  },

  applyToTask: async (taskId, message = '') => {
    const response = await api.post(`/tasks/${taskId}/apply`, { message });
    return response.data;
  },

  assignTask: async (taskId, applicantId) => {
    const response = await api.post(`/tasks/${taskId}/assign`, { applicantId });
    return response.data;
  },

  completeTask: async (taskId) => {
    try {
      console.log('📄 Completing task:', taskId);
      const response = await api.patch(`/tasks/${taskId}/complete`);
      console.log('✅ Task completion response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Task completion failed:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Failed to complete task');
    }
  },

  payTask: async (taskId) => {
    try {
      console.log('📄 Processing payment for task:', taskId);
      
      // Check if we have a token
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required. Please log in again.');
      }

      const response = await api.patch(`/tasks/${taskId}/pay`);
      console.log('✅ Payment response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Payment failed:', error.response?.data || error.message);
      
      // Provide specific error messages based on status
      if (error.response?.status === 401) {
        throw new Error('Authentication failed. Please log in again.');
      } else if (error.response?.status === 403) {
        throw new Error('You are not authorized to pay for this task.');
      } else if (error.response?.status === 404) {
        throw new Error('Task not found.');
      } else if (error.response?.status === 400) {
        throw new Error(error.response.data?.message || 'Invalid payment request.');
      } else {
        throw new Error(error.response?.data?.message || 'Payment failed. Please try again.');
      }
    }
  },

  deleteTask: async (taskId) => {
    const response = await api.delete(`/tasks/${taskId}`);
    return response.data;
  },

  getStats: async () => {
    try {
      const response = await api.get('/tasks/stats/summary');
      return response.data;
    } catch (error) {
      console.warn('Failed to fetch stats:', error);
      return {
        posted: 0,
        assigned: 0,
        completed: 0,
        totalEarned: 0,
        activeTasks: 0
      };
    }
  }
};

// Notification services
export const notificationService = {
  getAllNotifications: async () => {
    const response = await api.get('/notifications');
    return response.data;
  },

  getUnreadCount: async () => {
    const response = await api.get('/notifications/unread-count');
    return response.data;
  },

  markAsRead: async (notificationId) => {
    const response = await api.patch(`/notifications/${notificationId}/read`);
    return response.data;
  },

  markAllAsRead: async () => {
    const response = await api.patch('/notifications/mark-all-read');
    return response.data;
  },

  deleteNotification: async (notificationId) => {
    const response = await api.delete(`/notifications/${notificationId}`);
    return response.data;
  }
};

// Message services for chat functionality
export const messageService = {
  getMessages: async (taskId) => {
    const response = await api.get(`/messages/${taskId}`);
    return response.data;
  },

  sendMessage: async (taskId, content) => {
    const response = await api.post('/messages', { taskId, content });
    return response.data;
  }
};

export default api;