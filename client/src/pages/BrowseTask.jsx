import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import AuthProvider from '../context/AuthContext';

const BrowseTask = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { isAuthenticated, token } = AuthProvider.useAuth(); // Get token from context

  useEffect(() => {
    fetchTasks();
  }, [token]); // Re-fetch when token changes

  const fetchTasks = async () => {
    try {
      // Create headers object
      const headers = {
        'Content-Type': 'application/json'
      };

      // Add Authorization header if token exists
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch('http://localhost:5000/api/tasks', {
        method: 'GET',
        headers: headers
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      setTasks(data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getCategoryColor = (category) => {
    const colors = {
      Academic: 'bg-blue-100 text-blue-800',
      Technical: 'bg-purple-100 text-purple-800',
      Creative: 'bg-pink-100 text-pink-800',
      Research: 'bg-orange-100 text-orange-800',
      Other: 'bg-gray-100 text-gray-800'
    };
    return colors[category] || colors.Other;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tasks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          {!isAuthenticated && (
            <p className="text-gray-600 mb-4">Please log in to view tasks.</p>
          )}
          <button 
            onClick={fetchTasks}
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 w-full sm:w-auto"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Browse Tasks</h1>
          <div className="text-sm sm:text-base text-gray-600">
            {tasks.length} task{tasks.length !== 1 ? 's' : ''} available
          </div>
        </div>

        {tasks.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 sm:p-8 text-center">
            <div className="text-gray-500 mb-4">
              <svg className="mx-auto h-12 w-12 sm:h-16 sm:w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-2">No tasks available</h3>
            <p className="text-gray-600 mb-4 text-sm sm:text-base">Be the first to post a task and get help from fellow students!</p>
            {isAuthenticated && (
              <a 
                href="/PostTask" 
                className="inline-block bg-green-500 text-white px-5 sm:px-6 py-2 rounded-lg hover:bg-green-600 transition duration-200 w-full sm:w-auto"
              >
                Post Your First Task
              </a>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {tasks.map((task) => (
              <Link to={`/task/${task._id}`} key={task._id}>
                <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition duration-200 cursor-pointer h-full flex flex-col">
                  <div className="p-4 sm:p-6 flex flex-col flex-1">
                    <div className="flex flex-wrap justify-between items-start mb-3 gap-2">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-800 line-clamp-2">
                        {task.title}
                      </h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(task.category)}`}>
                        {task.category}
                      </span>
                    </div>
                    
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                      {task.description}
                    </p>
                    
                    <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
                      <div className="text-green-600 font-bold text-base sm:text-lg">
                        KES {task.budget.toLocaleString()}
                      </div>
                      {task.deadline && (
                        <div className="text-xs sm:text-sm text-gray-500">
                          Due: {formatDate(task.deadline)}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap justify-between text-xs sm:text-sm text-gray-500 mb-4 gap-2">
                      <div>
                        By: {task.postedBy?.name}
                      </div>
                      <div>
                        {formatDate(task.createdAt)}
                      </div>
                    </div>
                    
                    {task.postedBy?.university && (
                      <div className="text-xs text-gray-400 mt-auto">
                        📍 {task.postedBy.university}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default BrowseTask;