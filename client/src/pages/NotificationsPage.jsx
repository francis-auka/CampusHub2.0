import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';

const NotificationsPage = () => {
  const {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    formatNotificationTime,
    getNotificationIcon,
    fetchNotifications
  } = useNotifications();

  const [filter, setFilter] = useState('all'); // all, unread, read
  const [selectedNotifications, setSelectedNotifications] = useState(new Set());
  const [actionLoading, setActionLoading] = useState(false);

  // Refresh notifications on page load
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Filter notifications based on selected filter
  const filteredNotifications = notifications.filter(notification => {
    if (filter === 'unread') return !notification.isRead;
    if (filter === 'read') return notification.isRead;
    return true; // all
  });

  // Group notifications by date
  const groupedNotifications = filteredNotifications.reduce((groups, notification) => {
    const date = new Date(notification.createdAt).toDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(notification);
    return groups;
  }, {});

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      await markAsRead(notification._id);
    }
  };

  const handleSelectAll = () => {
    if (selectedNotifications.size === filteredNotifications.length) {
      setSelectedNotifications(new Set());
    } else {
      setSelectedNotifications(new Set(filteredNotifications.map(n => n._id)));
    }
  };

  const handleSelectNotification = (notificationId) => {
    const newSelected = new Set(selectedNotifications);
    if (newSelected.has(notificationId)) {
      newSelected.delete(notificationId);
    } else {
      newSelected.add(notificationId);
    }
    setSelectedNotifications(newSelected);
  };

  const handleBulkMarkAsRead = async () => {
    setActionLoading(true);
    try {
      const unreadSelected = Array.from(selectedNotifications).filter(id => {
        const notification = notifications.find(n => n._id === id);
        return notification && !notification.isRead;
      });

      await Promise.all(unreadSelected.map(id => markAsRead(id)));
      setSelectedNotifications(new Set());
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedNotifications.size} selected notifications?`)) {
      return;
    }

    setActionLoading(true);
    try {
      await Promise.all(Array.from(selectedNotifications).map(id => deleteNotification(id)));
      setSelectedNotifications(new Set());
    } catch (error) {
      console.error('Error deleting notifications:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const getNotificationTypeColor = (type) => {
    const colors = {
      application: 'border-blue-400 bg-blue-50',
      assignment: 'border-green-400 bg-green-50',
      completion: 'border-purple-400 bg-purple-50',
      payment: 'border-yellow-400 bg-yellow-50',
      general: 'border-gray-400 bg-gray-50'
    };
    return colors[type] || colors.general;
  };

  if (loading && notifications.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading notifications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Notifications</h1>
          <p className="text-gray-600">
            Stay updated with your Campus Hub activities
            {unreadCount > 0 && (
              <span className="ml-2 bg-red-100 text-red-800 text-sm font-medium px-2.5 py-0.5 rounded-full">
                {unreadCount} unread
              </span>
            )}
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex">
              <svg className="h-5 w-5 text-red-400 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Filter Tabs */}
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  filter === 'all'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setFilter('unread')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  filter === 'unread'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Unread ({unreadCount})
              </button>
              <button
                onClick={() => setFilter('read')}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  filter === 'read'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Read ({notifications.length - unreadCount})
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              {filteredNotifications.length > 0 && (
                <>
                  <button
                    onClick={handleSelectAll}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {selectedNotifications.size === filteredNotifications.length ? 'Deselect All' : 'Select All'}
                  </button>
                  
                  {selectedNotifications.size > 0 && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">
                        {selectedNotifications.size} selected
                      </span>
                      <button
                        onClick={handleBulkMarkAsRead}
                        disabled={actionLoading}
                        className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 transition-colors"
                      >
                        Mark as Read
                      </button>
                      <button
                        onClick={handleBulkDelete}
                        disabled={actionLoading}
                        className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </>
              )}
              
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                >
                  Mark All Read
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Notifications List */}
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12">
            <div className="text-center">
              <div className="text-gray-400 mb-4">
                <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-5 5v-5zM8 17H3l5 5v-5zM12 3a6.364 6.364 0 016 6v6a6.364 6.364 0 01-6 6 6.364 6.364 0 01-6-6V9a6.364 6.364 0 016-6z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {filter === 'all' ? 'No notifications yet' : 
                 filter === 'unread' ? 'No unread notifications' : 'No read notifications'}
              </h3>
              <p className="text-gray-500 mb-6">
                {filter === 'all' ? 
                  "When you get task updates and interactions, they'll appear here." :
                  filter === 'unread' ?
                  "All caught up! No unread notifications at the moment." :
                  "No read notifications to show."}
              </p>
              <Link
                to="/dashboard"
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedNotifications)
              .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
              .map(([dateString, dayNotifications]) => (
                <div key={dateString}>
                  {/* Date Header */}
                  <h2 className="text-lg font-semibold text-gray-900 mb-3 sticky top-4 bg-gray-50 py-2 z-10">
                    {new Date(dateString).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </h2>

                  {/* Notifications for this date */}
                  <div className="space-y-3">
                    {dayNotifications.map((notification) => (
                      <div
                        key={notification._id}
                        className={`bg-white rounded-lg shadow-sm border border-l-4 transition-all hover:shadow-md ${
                          notification.isRead ? 'border-l-gray-300' : 'border-l-blue-500'
                        } ${getNotificationTypeColor(notification.type)}`}
                      >
                        <div className="p-6">
                          <div className="flex items-start space-x-4">
                            {/* Selection Checkbox */}
                            <input
                              type="checkbox"
                              checked={selectedNotifications.has(notification._id)}
                              onChange={() => handleSelectNotification(notification._id)}
                              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />

                            {/* Notification Icon */}
                            <div className="flex-shrink-0">
                              <span className="text-2xl">
                                {getNotificationIcon(notification.type)}
                              </span>
                            </div>

                            {/* Notification Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className={`text-sm ${
                                    notification.isRead ? 'text-gray-600' : 'text-gray-900 font-medium'
                                  }`}>
                                    {notification.message}
                                  </p>
                                  
                                  {/* Related Task/User Info */}
                                  <div className="mt-2 flex items-center text-xs text-gray-500 space-x-4">
                                    <span>{formatNotificationTime(notification.createdAt)}</span>
                                    
                                    {notification.relatedTask && (
                                      <Link
                                        to={`/task/${notification.relatedTask._id}`}
                                        className="text-blue-600 hover:text-blue-800 underline"
                                        onClick={() => handleNotificationClick(notification)}
                                      >
                                        View Task: {notification.relatedTask.title}
                                      </Link>
                                    )}
                                    
                                    {notification.relatedUser && (
                                      <span>from {notification.relatedUser.name}</span>
                                    )}
                                  </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex items-center space-x-2 ml-4">
                                  {!notification.isRead && (
                                    <button
                                      onClick={() => markAsRead(notification._id)}
                                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                    >
                                      Mark as read
                                    </button>
                                  )}
                                  
                                  <button
                                    onClick={() => deleteNotification(notification._id)}
                                    className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;