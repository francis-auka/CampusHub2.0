import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AuthProvider from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import Navbar from './components/common/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';
import BrowseTask from './pages/BrowseTask';
import PostTask from './pages/PostTask';
import TaskDetail from './pages/TaskDetails';
import NotificationsPage from './pages/NotificationsPage';
import ProtectedRoute from './components/common/ProtectedRoute';

function App() {
  return (
    <Router>
      <AuthProvider>
        <NotificationProvider>
          <div className="App">
            <Navbar />
            
            <main className="min-h-screen bg-gray-50">
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                
                {/* Protected Routes */}
                <Route 
                  path="/dashboard" 
                  element={
                    <ProtectedRoute>
                      <Dashboard />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/profile" 
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/BrowseTask" 
                  element={
                    <ProtectedRoute>
                      <BrowseTask />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/PostTask" 
                  element={
                    <ProtectedRoute>
                      <PostTask />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/task/:id" 
                  element={
                    <ProtectedRoute>
                      <TaskDetail />
                    </ProtectedRoute>
                  } 
                />
                
                <Route 
                  path="/notifications" 
                  element={
                    <ProtectedRoute>
                      <NotificationsPage />
                    </ProtectedRoute>
                  } 
                />
                
                <Route path="*" element={<div className="p-8 text-center"><h1 className="text-2xl">Page Not Found</h1></div>} />
              </Routes>
            </main>
          </div>
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;