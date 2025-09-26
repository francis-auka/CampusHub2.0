import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import AuthProvider from '../context/AuthContext';
import { taskService } from '../services/api';

const TaskDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [completing, setCompleting] = useState(false);
  const [paying, setPaying] = useState(false);

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [socket, setSocket] = useState(null);

  const { token, user, isAuthenticated } = AuthProvider.useAuth();
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ✅ IMPROVED: Memoized fetch function to prevent infinite re-renders
  const fetchTask = useCallback(async () => {
    if (!token && !isAuthenticated) {
      setError('Please log in to view task details');
      setLoading(false);
      return;
    }

    try {
      setError(''); // Clear any previous errors
      const headers = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`http://localhost:5000/api/tasks/${id}`, {
        method: 'GET',
        headers: headers
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch task');
      setTask(data);
    } catch (err) {
      console.error('Error fetching task:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, token, isAuthenticated]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  useEffect(() => {
    if (!task || !isAuthenticated || !token) return;

    const isOwner = user && task.postedBy && (
      user.id === task.postedBy._id ||
      user._id === task.postedBy._id ||
      user.id?.toString() === task.postedBy._id?.toString() ||
      user._id?.toString() === task.postedBy._id?.toString()
    );

    const isAssigned = user && task.assignedTo && (
      user.id === task.assignedTo._id ||
      user._id === task.assignedTo._id ||
      user.id?.toString() === task.assignedTo._id?.toString() ||
      user._id?.toString() === task.assignedTo._id?.toString()
    );

    const canChat = (isOwner || isAssigned) && task.assignedTo;
    if (canChat) {
      setMessages([]);
      setChatError('');
      initializeChat();
    }
    return () => {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
    };
  }, [task, isAuthenticated, token, user]);

  const initializeChat = async () => {
    try {
      setChatLoading(true);
      setChatError('');
      await loadMessages();
      const newSocket = io('http://localhost:5000', {
        auth: { token: token }
      });
      newSocket.on('connect', () => {
        newSocket.emit('joinTaskRoom', id);
      });
      newSocket.on('newMessage', (message) => {
        setMessages(prev => {
          const exists = prev.some(msg => msg._id === message._id);
          if (exists) return prev;
          return [...prev, message];
        });
      });
      newSocket.on('connect_error', () => {
        setChatError('Failed to connect to chat server');
      });
      setSocket(newSocket);
    } catch {
      setChatError('Failed to initialize chat');
    } finally {
      setChatLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const response = await fetch(`http://localhost:5000/api/messages/${id}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        setMessages(await response.json());
      } else if (response.status === 404) {
        setMessages([]);
      } else {
        throw new Error();
      }
    } catch {
      setChatError('Failed to load chat history');
      setMessages([]);
    }
  };

  const formatDate = (date) =>
    new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const formatTime = (date) =>
    new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const applyToTask = async () => {
    if (!isAuthenticated) {
      setApplyMessage('You must be logged in to apply.');
      return;
    }
    try {
      setIsApplying(true);
      setApplyMessage('');
      const response = await fetch(`http://localhost:5000/api/tasks/${id}/apply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Application failed');
      
      setApplyMessage('✅ Successfully applied to this task.');
      
      // ✅ IMPROVED: Refresh task data instead of reloading the page
      setTimeout(() => {
        fetchTask();
      }, 1000);
    } catch (error) {
      setApplyMessage(`❌ ${error.message}`);
    } finally {
      setIsApplying(false);
    }
  };

  const deleteTask = async () => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      setDeleting(true);
      const response = await fetch(`http://localhost:5000/api/tasks/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to delete task');
      alert('✅ Task deleted successfully');
      navigate('/BrowseTask');
    } catch (error) {
      alert(`❌ ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const assignTask = async (applicantId) => {
    if (!window.confirm('Assign task to this applicant?')) return;
    try {
      const response = await fetch(`http://localhost:5000/api/tasks/${id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ applicantId })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      
      alert('✅ Task assigned successfully');
      
      // ✅ IMPROVED: Refresh task data instead of reloading the page
      fetchTask();
    } catch (err) {
      alert(`❌ Failed to assign task: ${err.message}`);
    }
  };

  const completeTask = async () => {
    if (!window.confirm('Mark this task as completed?')) return;
    try {
      setCompleting(true);
      await taskService.completeTask(id);
      alert('✅ Task marked as completed');
      
      // ✅ IMPROVED: Refresh task data instead of reloading the page
      fetchTask();
    } catch (err) {
      alert(`❌ Failed to complete task: ${err.message}`);
    } finally {
      setCompleting(false);
    }
  };

  const payTask = async () => {
    if (!window.confirm('Confirm payment for this task?')) return;
    try {
      setPaying(true);
      await taskService.payTask(id);
      alert('✅ Payment confirmed');
      
      // ✅ IMPROVED: Refresh task data instead of reloading the page
      fetchTask();
    } catch (err) {
      alert(`❌ Failed to confirm payment: ${err.message}`);
    } finally {
      setPaying(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sendingMessage || !socket) return;
    setSendingMessage(true);
    try {
      const response = await fetch(`http://localhost:5000/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ taskId: id, content: newMessage.trim() })
      });
      if (!response.ok) throw new Error((await response.json()).message || 'Failed to send message');
      setNewMessage('');
      setChatError('');
    } catch {
      setChatError('Failed to send message. Please try again.');
    } finally {
      setSendingMessage(false);
    }
  };

  // ✅ IMPROVED: Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading task details...</p>
        </div>
      </div>
    );
  }

  // ✅ IMPROVED: Better error handling for authentication
  if (!isAuthenticated && !token) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">Please log in to view task details</p>
          <button 
            onClick={() => navigate('/login')}
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || 'Task not found'}</p>
          <button 
            onClick={fetchTask}
            className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const isOwner = user && task.postedBy && (
    user.id === task.postedBy._id ||
    user._id === task.postedBy._id ||
    user.id?.toString() === task.postedBy._id?.toString() ||
    user._id?.toString() === task.postedBy._id?.toString()
  );

  const isAssigned = user && task.assignedTo && (
    user.id === task.assignedTo._id ||
    user._id === task.assignedTo._id ||
    user.id?.toString() === task.assignedTo._id?.toString() ||
    user._id?.toString() === task.assignedTo._id?.toString()
  );

  const canChat = isAuthenticated && (isOwner || isAssigned) && task.assignedTo;

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-3 sm:py-10 sm:px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-white p-4 sm:p-8 rounded-lg shadow">
          <h1 className="text-2xl sm:text-3xl font-bold text-green-600 mb-4 break-words">{task.title}</h1>
          <p className="text-gray-700 mb-6 whitespace-pre-line break-words">{task.description}</p>

          <div className="text-sm text-gray-600 space-y-2 mb-6">
            <p><strong>Budget:</strong> KES {task.budget.toLocaleString()}</p>
            <p><strong>Category:</strong> {task.category}</p>
            {task.deadline && <p><strong>Deadline:</strong> {formatDate(task.deadline)}</p>}
            <p><strong>Status:</strong> {task.status}</p>
            <p><strong>Posted on:</strong> {formatDate(task.createdAt)}</p>
            {task.postedBy && (<><p><strong>Posted by:</strong> {task.postedBy.name}</p><p><strong>University:</strong> {task.postedBy.university}</p></>)}
            {task.assignedTo && (<p><strong>Assigned To:</strong> {task.assignedTo.name}</p>)}
          </div>

          {/* Action buttons */}
          {isOwner ? (
            <>
              {task.status === 'completed' && (
                <button
                  onClick={payTask}
                  disabled={paying}
                  className="w-full bg-purple-500 text-white px-4 py-3 rounded-lg hover:bg-purple-600 transition duration-200 disabled:opacity-50 mb-4"
                >
                  {paying ? 'Processing Payment...' : 'Confirm & Pay'}
                </button>
              )}
              <button
                onClick={deleteTask}
                disabled={deleting}
                className="w-full bg-red-500 text-white px-4 py-3 rounded-lg hover:bg-red-600 transition duration-200 disabled:opacity-50 mb-6"
              >
                {deleting ? 'Deleting...' : 'Delete Task'}
              </button>
              {/* Applicants list */}
              <div className="border-t pt-6">
                <h2 className="text-lg sm:text-xl font-semibold mb-3">Applicants ({task.applicants?.length || 0})</h2>
                {!task.applicants || task.applicants.length === 0 ? (
                  <p className="text-gray-500">No applicants yet.</p>
                ) : (
                  <div className="space-y-3">
                    {task.applicants.map((applicant, index) => (
                      <div key={index} className="border p-4 rounded bg-gray-50">
                        <p><strong>Name:</strong> {applicant.user?.name || 'Unknown'}</p>
                        <p><strong>Email:</strong> {applicant.user?.email || 'N/A'}</p>
                        <p><strong>University:</strong> {applicant.user?.university || 'N/A'}</p>
                        <p><strong>Applied:</strong> {formatDate(applicant.appliedAt)}</p>
                        {applicant.message && (<p><strong>Message:</strong> {applicant.message}</p>)}
                        {task.assignedTo?._id === applicant.user?._id ? (
                          <p className="text-green-600 font-semibold mt-2">✅ Assigned</p>
                        ) : (
                          <button onClick={() => assignTask(applicant.user._id)} className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                            Assign Task
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {isAssigned && task.status === 'in-progress' && (
                <button
                  onClick={completeTask}
                  disabled={completing}
                  className="w-full bg-orange-500 text-white px-4 py-3 rounded-lg hover:bg-orange-600 transition duration-200 disabled:opacity-50 mb-4"
                >
                  {completing ? 'Marking as Completed...' : 'Mark as Completed'}
                </button>
              )}
              {applyMessage && <p className="mb-4 text-sm text-center text-blue-600">{applyMessage}</p>}
              {!isAssigned && (
                <button
                  onClick={applyToTask}
                  disabled={isApplying || !isAuthenticated}
                  className="w-full bg-green-500 text-white px-4 py-3 rounded-lg hover:bg-green-600 transition duration-200 disabled:opacity-50"
                >
                  {!isAuthenticated ? 'Login to Apply' : isApplying ? 'Applying...' : 'Apply to this Task'}
                </button>
              )}
            </>
          )}
        </div>

        {/* Chat section */}
        {canChat && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b bg-green-50">
              <h3 className="text-lg font-semibold text-gray-800 flex flex-wrap items-center gap-2">
                💬 Task Discussion
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Live Chat</span>
              </h3>
              <p className="text-sm text-gray-600">Chat between task owner and assignee</p>
              {chatError && <p className="text-xs text-red-600 mt-1">⚠️ {chatError}</p>}
            </div>
            <div className="h-80 overflow-y-auto p-3 sm:p-4 space-y-3 bg-gray-50">
              {chatLoading ? (
                <div className="text-center text-gray-500 py-8">Loading chat history...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">No messages yet. Start the conversation!</div>
              ) : (
                messages.map((message) => (
                  <div key={message._id} className={`flex ${message.sender._id === (user?.id || user?._id) ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] sm:max-w-xs lg:max-w-md px-3 py-2 rounded-lg break-words ${
                      message.sender._id === (user?.id || user?._id)
                        ? 'bg-green-500 text-white'
                        : 'bg-white text-gray-800 border'
                    }`}>
                      <p className="text-sm font-medium mb-1">{message.sender.name}</p>
                      <p className="break-words">{message.content}</p>
                      <p className={`text-xs mt-1 ${
                        message.sender._id === (user?.id || user?._id)
                          ? 'text-green-100'
                          : 'text-gray-500'
                      }`}>
                        {formatTime(message.createdAt || message.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} className="p-3 sm:p-4 border-t">
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={socket ? "Type your message..." : "Connecting to chat..."}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  maxLength={1000}
                  disabled={!socket}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sendingMessage || !socket}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition duration-200 disabled:opacity-50"
                >
                  {sendingMessage ? '...' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskDetails;