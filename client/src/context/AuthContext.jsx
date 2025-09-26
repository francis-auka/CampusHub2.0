import React, { createContext, useState, useEffect, useContext } from 'react';

const AuthContext = createContext();
const API_URL = 'http://localhost:5000/api';

const authAPI = {
  register: async (userData) => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Registration failed');
    }

    return response.json();
  },

  login: async (credentials) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(credentials)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Login failed');
    }

    return response.json();
  },

  getCurrentUser: async (token) => {
    const response = await fetch(`${API_URL}/auth/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get user data');
    }

    return response.json();
  }
};

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        try {
          // Verify token is still valid and get fresh user data
          const userData = await authAPI.getCurrentUser(storedToken);
          setToken(storedToken);
          setUser(userData.user);
          
          // Update localStorage with fresh user data
          localStorage.setItem('user', JSON.stringify(userData.user));
        } catch (error) {
          console.error('Token validation failed:', error);
          // Clear invalid token/user data
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
        }
      }

      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (credentials) => {
    try {
      const data = await authAPI.login(credentials);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Login failed'
      };
    }
  };

  const register = async (userData) => {
    try {
      const data = await authAPI.register(userData);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error.message || 'Registration failed'
      };
    }
  };

  const updateProfile = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
  };

  const refreshUser = async () => {
    if (!token) return;

    try {
      const userData = await authAPI.getCurrentUser(token);
      setUser(userData.user);
      localStorage.setItem('user', JSON.stringify(userData.user));
      return userData.user;
    } catch (error) {
      console.error('Failed to refresh user data:', error);
      // If refresh fails, user might need to login again
      logout();
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  // Check if user has completed their profile (including phone number)
  const isProfileComplete = () => {
    return user && user.name && user.email && user.phoneNumber;
  };

  // Check if user needs to add phone number (for existing users)
  const needsPhoneNumber = () => {
    return user && !user.phoneNumber;
  };

  const value = {
    user,
    token,
    login,
    register,
    logout,
    updateProfile,
    refreshUser,
    isAuthenticated: !!token,
    loading,
    isProfileComplete,
    needsPhoneNumber
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

AuthProvider.useAuth = function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthProvider;