import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import AuthProvider from "../context/AuthContext";

const Dashboard = () => {
  const { token, user } = AuthProvider.useAuth();
  const [postedTasks, setPostedTasks] = useState([]);
  const [appliedTasks, setAppliedTasks] = useState([]);
  const [assignedTasks, setAssignedTasks] = useState([]);
  const [completedTasks, setCompletedTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [completing, setCompleting] = useState(null);
  const [paying, setPaying] = useState(null);
  const [paymentError, setPaymentError] = useState("");

  const API_BASE = "http://localhost:5000";

  const getHeaders = useCallback(() => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }), [token]);

  const handleApiError = useCallback((error, context) => {
    console.error(`Error in ${context}:`, error);
    if (error?.name === "AbortError") return;
    
    let message = `Failed to ${context}. `;
    if (error?.message?.includes('Failed to fetch')) {
      message += "Please check your internet connection.";
    } else if (error?.status === 401) {
      message += "Please log in again.";
    } else if (error?.status >= 500) {
      message += "Server error. Please try again later.";
    } else {
      message += "Please try again.";
    }
    
    setError(message);
  }, []);

  const generateNotifications = useCallback((posted = [], applied = [], assigned = []) => {
    const newNotifications = [];

    // Notifications for new applicants
    posted.forEach((task) => {
      if (!task?.applicents?.length && !task?.applicants?.length) return;
      const applicants = task.applicants || task.applicents || [];
      
      const recentApplicants = applicants.filter((app) => {
        try {
          const appliedDate = new Date(app.appliedAt);
          const oneDayAgo = new Date(Date.now() - 86400000);
          return !isNaN(appliedDate.getTime()) && appliedDate > oneDayAgo;
        } catch {
          return false;
        }
      });

      if (recentApplicants.length) {
        newNotifications.push({
          id: `applicants-${task._id}`,
          type: 'info',
          message: `${recentApplicants.length} new applicant${recentApplicants.length > 1 ? "s" : ""} for "${task.title}"`,
          taskId: task._id,
        });
      }
    });

    // Notifications for completed tasks awaiting payment
    const completedUnpaidTasks = posted.filter(task => 
      task.status === 'completed' && task.paymentStatus === 'unpaid'
    );
    
    if (completedUnpaidTasks.length > 0) {
      newNotifications.push({
        id: 'awaiting-payment',
        type: 'warning',
        message: `${completedUnpaidTasks.length} completed task${completedUnpaidTasks.length > 1 ? 's' : ''} awaiting payment`,
      });
    }

    // Notifications for overdue tasks
    assigned.forEach((task) => {
      if (task.deadline && task.status === "in-progress") {
        try {
          const deadline = new Date(task.deadline);
          const now = new Date();
          const timeDiff = deadline.getTime() - now.getTime();
          const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
          
          if (!isNaN(deadline.getTime())) {
            if (daysDiff < 0) {
              newNotifications.push({
                id: `overdue-${task._id}`,
                type: 'error',
                message: `Task "${task.title}" is ${Math.abs(daysDiff)} day${Math.abs(daysDiff) > 1 ? 's' : ''} overdue`,
                taskId: task._id,
              });
            } else if (daysDiff <= 1) {
              newNotifications.push({
                id: `due-soon-${task._id}`,
                type: 'warning',
                message: `Task "${task.title}" is due ${daysDiff === 0 ? 'today' : 'tomorrow'}`,
                taskId: task._id,
              });
            }
          }
        } catch {
          console.warn("Invalid deadline date:", task.deadline);
        }
      }
    });

    setNotifications(newNotifications);
  }, []);

  const fetchEndpoint = useCallback(async (url, signal) => {
    try {
      const res = await fetch(url, {
        headers: getHeaders(),
        signal
      });
      
      if (!res.ok) {
        console.warn(`Failed to fetch ${url}: ${res.status}`);
        return [];
      }
      
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn(`Error fetching ${url}:`, err);
      }
      return [];
    }
  }, [getHeaders]);

  const fetchDashboardData = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");
    setPaymentError("");

    try {
      const [postedData, appliedData, assignedDataRaw, completedDataRaw] = await Promise.all([
        fetchEndpoint(`${API_BASE}/api/tasks/my-tasks`, controller.signal),
        fetchEndpoint(`${API_BASE}/api/tasks/applied`, controller.signal),
        fetchEndpoint(`${API_BASE}/api/tasks/assigned`, controller.signal),
        fetchEndpoint(`${API_BASE}/api/tasks/completed`, controller.signal),
      ]);

      // 🛠 FIX: Keep previously known completed/paid assigned tasks even if /assigned hides them after completion
      setAssignedTasks((prev) => {
        const prevDone = prev.filter(t => t.status === "completed" || t.status === "paid");
        const merged = [...assignedDataRaw, ...prevDone];
        const map = new Map(merged.map(t => [t._id, t]));
        return Array.from(map.values());
      });

      setPostedTasks(postedData);
      setAppliedTasks(appliedData);

      // 🛠 FIX: Build a robust completed list that includes:
      // - /completed endpoint
      // - completed/paid items from assigned (assignee view)
      // - paid (or completed+paid) items from posted (owner view)
      setCompletedTasks((prev) => {
        const map = new Map(prev.map(t => [t._id, t]));
        completedDataRaw.forEach(t => map.set(t._id, t));
        assignedDataRaw.forEach(t => {
          if (t.status === "completed" || t.status === "paid") map.set(t._id, t);
        });
        postedData.forEach(t => {
          if (t.status === "paid" || (t.status === "completed" && t.paymentStatus === "paid")) {
            map.set(t._id, t);
          }
        });
        return Array.from(map.values());
      });

      generateNotifications(postedData, appliedData, assignedDataRaw);
    } catch (err) {
      if (err.name !== 'AbortError') {
        handleApiError(err, "load dashboard data");
      }
    } finally {
      setLoading(false);
    }

    return () => controller.abort();
  }, [fetchEndpoint, token, generateNotifications, handleApiError]);

  const completeTask = async (taskId) => {
    if (!taskId) return;
    if (!window.confirm("Mark this task as completed?")) return;

    try {
      setCompleting(taskId);
      setError("");
      
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}/complete`, {
        method: "PATCH",
        headers: getHeaders(),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${res.status}: ${res.statusText}`);
      }

      // 🛠 FIX: Update assignedTasks AND immediately mirror into completedTasks using the updated object
      let justCompleted = null;
      setAssignedTasks((prev) => {
        const updated = prev.map((t) =>
          t._id === taskId
            ? { ...t, status: "completed", completedAt: new Date().toISOString() }
            : t
        );
        justCompleted = updated.find(t => t._id === taskId);
        return updated;
      });

      if (justCompleted) {
        setCompletedTasks((prev) => {
          const map = new Map(prev.map(t => [t._id, t]));
          map.set(justCompleted._id, justCompleted);
          return Array.from(map.values());
        });
      }

      // Optional: refresh to sync with server (kept as-is)
      setTimeout(() => fetchDashboardData(), 1000);
      
    } catch (err) {
      handleApiError(err, "complete task");
    } finally {
      setCompleting(null);
    }
  };

  const payTask = async (taskId) => {
    if (!taskId) return;
    if (!window.confirm("Confirm payment for this task?")) return;

    try {
      setPaying(taskId);
      setPaymentError("");
      setError("");
      
      const res = await fetch(`${API_BASE}/api/tasks/${taskId}/pay`, {
        method: "PATCH",
        headers: getHeaders(),
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMessage = errorData.message || `Payment failed with status ${res.status}`;
        
        setPaymentError(`Task ${taskId.slice(-8)}: ${errorMessage}`);
        
        console.error('Payment error details:', {
          taskId,
          status: res.status,
          statusText: res.statusText,
          errorData
        });
        
        return;
      }

      // Update task status to paid in local state
      setPostedTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { 
          ...t, 
          status: "paid", 
          paymentStatus: "paid",
          paidAt: new Date().toISOString()
        } : t))
      );

      // 🛠 FIX: Ensure the paid task also shows up in Completed section immediately
      setCompletedTasks((prev) => {
        const map = new Map(prev.map(t => [t._id, t]));
        // try to find from postedTasks/assignedTasks to carry full details
        const fromPosted = postedTasks.find(t => t._id === taskId);
        const fromAssigned = assignedTasks.find(t => t._id === taskId);
        const base = fromPosted || fromAssigned || { _id: taskId };
        map.set(taskId, { ...base, status: "paid", paymentStatus: "paid", paidAt: new Date().toISOString() });
        return Array.from(map.values());
      });
      
      generateNotifications(postedTasks, appliedTasks, assignedTasks);
      
      console.log("Payment processed successfully for task:", taskId);
      
    } catch (err) {
      console.error('Unexpected payment error:', err);
      setPaymentError(`Unexpected error processing payment for task ${taskId.slice(-8)}`);
    } finally {
      setPaying(null);
    }
  };

  // FIXED: Improved completed tasks computation
  const allCompletedTasks = useMemo(() => {
    const completedTasksMap = new Map();
    
    // Add tasks from the dedicated completed endpoint (highest priority)
    completedTasks.forEach(task => {
      completedTasksMap.set(task._id, task);
    });
    
    // Add completed tasks from assigned tasks (for tasks completed by this user)
    assignedTasks.forEach(task => {
      if (task.status === "completed" || task.status === "paid") {
        const existing = completedTasksMap.get(task._id);
        if (!existing || new Date(task.updatedAt || 0) > new Date(existing.updatedAt || 0)) {
          completedTasksMap.set(task._id, task);
        }
      }
    });
    
    // Add paid tasks from posted tasks (for tasks the user posted that are now paid)
    postedTasks.forEach(task => {
      if (task.status === "paid" || (task.status === "completed" && task.paymentStatus === "paid")) {
        const existing = completedTasksMap.get(task._id);
        if (!existing || new Date(task.updatedAt || 0) > new Date(existing.updatedAt || 0)) {
          completedTasksMap.set(task._id, task);
        }
      }
    });
    
    return Array.from(completedTasksMap.values()).sort((a, b) => {
      const dateA = new Date(a.completedAt || a.paidAt || a.updatedAt || 0);
      const dateB = new Date(b.completedAt || b.paidAt || b.updatedAt || 0);
      return dateB - dateA; // Most recent first
    });
  }, [postedTasks, assignedTasks, completedTasks]);

  // NEW: Calculate earnings data
  const earningsData = useMemo(() => {
    console.log('DEBUG - assignedTasks:', assignedTasks.map(t => ({ id: t._id, title: t.title, status: t.status })));
    console.log('DEBUG - allCompletedTasks:', allCompletedTasks.map(t => ({ id: t._id, title: t.title, status: t.status })));
    console.log('DEBUG - postedTasks:', postedTasks.map(t => ({ id: t._id, title: t.title, status: t.status })));
    
    // Since completed tasks disappear from assignedTasks after completion,
    // we need a different approach:
    // - If user has NO postedTasks, they're likely a task completer (not poster)
    // - If user has postedTasks, only count completedTasks that are NOT in their postedTasks
    
    const userEarnings = allCompletedTasks.filter(task => {
      const isPaidTask = task.status === "paid" || (task.status === "completed" && task.paymentStatus === "paid");
      
      if (!isPaidTask) return false;
      
      // Check if the current user is NOT the poster of this task
      const isNotTaskPoster = !postedTasks.some(postedTask => postedTask._id === task._id);
      
      console.log('Task:', task.title, {
        isPaidTask,
        isNotTaskPoster,
        shouldCount: isPaidTask && isNotTaskPoster,
        budget: task.budget,
        taskStatus: task.status,
        paymentStatus: task.paymentStatus,
        reasoning: isNotTaskPoster ? 'User completed this task' : 'User posted this task (no earnings)'
      });
      
      // Simple logic: If task is paid AND user didn't post it, they must have completed it
      return isPaidTask && isNotTaskPoster;
    });


    const totalEarnings = userEarnings.reduce((sum, task) => {
      const budget = parseFloat(task.budget) || 0;
      return sum + budget;
    }, 0);

    // Group earnings by month for the chart
    const earningsByMonth = userEarnings.reduce((acc, task) => {
      const date = new Date(task.paidAt || task.completedAt || task.updatedAt);
      if (isNaN(date.getTime())) return acc;
      
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
      
      if (!acc[monthKey]) {
        acc[monthKey] = {
          month: monthName,
          earnings: 0,
          tasks: 0
        };
      }
      
      acc[monthKey].earnings += parseFloat(task.budget) || 0;
      acc[monthKey].tasks += 1;
      
      return acc;
    }, {});

    // Convert to array and sort by month
    const chartData = Object.entries(earningsByMonth)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([_, data]) => data)
      .slice(-6); // Show last 6 months

    return {
      totalEarnings,
      totalTasks: userEarnings.length,
      chartData
    };
  }, [allCompletedTasks, user?.id]);

  // FIXED: Filter assigned tasks to only show in-progress tasks
  const activeAssignedTasks = useMemo(() => {
    return assignedTasks.filter(task => task.status === "in-progress");
  }, [assignedTasks]);

  const filteredAppliedTasks = useMemo(() => {
    // Remove tasks that are already assigned to avoid duplication
    return appliedTasks.filter((appliedTask) =>
      !assignedTasks.some((assignedTask) => assignedTask._id === appliedTask._id)
    );
  }, [appliedTasks, assignedTasks]);

  const formatDate = useCallback((date) => {
    if (!date) return "No date";
    try {
      const d = new Date(date);
      if (isNaN(d.getTime())) return "Invalid date";
      
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Invalid date";
    }
  }, []);

  const getStatusBadge = (status, paymentStatus) => {
    let displayStatus = status;
    let config;

    if (status === 'completed' && paymentStatus === 'unpaid') {
      displayStatus = 'awaiting-payment';
      config = { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Awaiting Payment' };
    } else if (status === 'completed' && paymentStatus === 'paid') {
      displayStatus = 'paid';
      config = { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Paid' };
    } else {
      const statusConfig = {
        'in-progress': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'In Progress' },
        'completed': { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' },
        'paid': { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Paid' },
        'open': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Open' },
        'cancelled': { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' },
      };
      
      config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status || 'Unknown' };
    }
    
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const TaskList = ({ title, tasks, action, emptyMessage }) => (
    <section className="bg-white p-6 rounded-lg shadow-md mb-8">
      <h2 className="text-xl font-semibold mb-4 flex justify-between items-center">
        <span className="text-gray-800">{title}</span>
        <span className="text-sm font-normal text-gray-500">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </span>
      </h2>
      
      {tasks.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-gray-400 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <div key={task._id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
              <div className="flex flex-col md:flex-row md:justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-800 mb-2">
                    {task.title || "Untitled Task"}
                  </h3>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {task.description || "No description available"}
                  </p>
                  
                  <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    {task.deadline && (
                      <span>Deadline: {formatDate(task.deadline)}</span>
                    )}
                    {getStatusBadge(task.status, task.paymentStatus)}
                    {task.budget && (
                      <span className="font-medium text-green-600">
                        KES {typeof task.budget === 'number' ? task.budget.toLocaleString() : task.budget}
                      </span>
                    )}
                    {task.completedAt && (
                      <span>Completed: {formatDate(task.completedAt)}</span>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col gap-2 md:ml-4">
                  <Link
                    to={`/task/${task._id}`}
                    className="bg-blue-500 text-white px-4 py-2 rounded text-sm hover:bg-blue-600 transition-colors text-center font-medium"
                  >
                    View Details
                  </Link>
                  {action && action(task)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  // Effect for fetching data
  useEffect(() => {
    const cleanup = fetchDashboardData();
    return () => cleanup?.then?.(fn => fn?.());
  }, [fetchDashboardData]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full mx-4">
          <div className="text-center">
            <div className="text-red-500 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold mb-2 text-gray-800">Something went wrong</h2>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <button
              onClick={() => {
                setError("");
                fetchDashboardData();
              }}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  // Notification filtering
  const overdueTasks = notifications.filter(n => n.type === 'error');
  const awaitingPayment = notifications.filter(n => n.id === 'awaiting-payment');
  const newApplicants = notifications.filter(n => n.id.startsWith('applicants-'));
  const otherNotifications = notifications.filter(n => 
    n.id.startsWith('due-soon-') || 
    (n.type !== 'error' && !n.id.startsWith('applicants-') && n.id !== 'awaiting-payment')
  );

  // Main render
  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {user?.name || "User"}!
          </h1>
          <p className="text-gray-600">Here's an overview of your tasks and activities.</p>
        </div>

        {/* Payment Error Alert */}
        {paymentError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Payment Error</h3>
                <p className="mt-1 text-sm text-red-700">{paymentError}</p>
                <button
                  onClick={() => setPaymentError("")}
                  className="mt-2 text-sm text-red-600 hover:text-red-500 underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard Grid */}
        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          {/* Summary Column */}
          <div className="lg:col-span-1">
            
            {/* NEW: Earnings Summary Card */}
            <section className="bg-gradient-to-br from-green-50 to-emerald-50 p-6 rounded-lg shadow-md mb-8 border border-green-100">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-800">Your Earnings</h2>
                <div className="p-2 bg-green-100 rounded-lg">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Total Earnings</p>
                  <p className="text-2xl font-bold text-green-600">
                    KES {earningsData.totalEarnings.toLocaleString()}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-green-200">
                  <div>
                    <p className="text-xs text-gray-500">Tasks Completed</p>
                    <p className="text-lg font-semibold text-gray-800">{earningsData.totalTasks}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Avg. per Task</p>
                    <p className="text-lg font-semibold text-gray-800">
                      KES {earningsData.totalTasks > 0 ? Math.round(earningsData.totalEarnings / earningsData.totalTasks).toLocaleString() : 0}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* NEW: Earnings Chart */}
            {earningsData.chartData.length > 0 && (
              <section className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Earnings Over Time</h2>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={earningsData.chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="month" 
                        tick={{ fontSize: 12 }}
                        stroke="#666"
                      />
                      <YAxis 
                        tick={{ fontSize: 12 }}
                        stroke="#666"
                        tickFormatter={(value) => `KES ${value.toLocaleString()}`}
                      />
                      <Tooltip 
                        formatter={(value, name) => [`KES ${value.toLocaleString()}`, 'Earnings']}
                        labelStyle={{ color: '#374151' }}
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="earnings" 
                        stroke="#10b981" 
                        strokeWidth={3}
                        dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Monthly breakdown */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Monthly Breakdown</h3>
                  <div className="space-y-2">
                    {earningsData.chartData.slice(-3).reverse().map((data, index) => (
                      <div key={index} className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">{data.month}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-gray-500">{data.tasks} task{data.tasks !== 1 ? 's' : ''}</span>
                          <span className="font-medium text-green-600">KES {data.earnings.toLocaleString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            )}
            
            {/* Urgent Actions Section */}
            {(overdueTasks.length > 0 || awaitingPayment.length > 0 || newApplicants.length > 0) && (
              <section className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Urgent Actions</h2>
                <div className="space-y-4">
                  {overdueTasks.length > 0 && (
                    <div className="p-4 bg-red-100 rounded-lg border border-red-200">
                      <div className="flex items-start">
                        <svg className="h-6 w-6 text-red-500 flex-shrink-0 mr-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                        </svg>
                        <div>
                          <h3 className="text-lg font-bold text-red-800">
                            You have {overdueTasks.length} overdue task{overdueTasks.length > 1 ? 's' : ''}!
                          </h3>
                          <p className="text-sm text-red-700 mt-1">
                            Don't forget to complete them as soon as possible.
                          </p>
                          <Link to="/tasks/assigned" className="text-red-600 text-sm font-medium hover:underline mt-2 inline-block">
                            View Overdue Tasks →
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}

                  {awaitingPayment.length > 0 && (
                    <div className="p-4 bg-yellow-100 rounded-lg border border-yellow-200">
                      <div className="flex items-start">
                        <svg className="h-6 w-6 text-yellow-500 flex-shrink-0 mr-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                        </svg>
                        <div>
                          <h3 className="text-lg font-bold text-yellow-800">
                            {awaitingPayment.length} task{awaitingPayment.length > 1 ? 's are' : ' is'} awaiting payment.
                          </h3>
                          <p className="text-sm text-yellow-700 mt-1">
                            Complete payments to finalize the tasks.
                          </p>
                          <Link to="/tasks/posted" className="text-yellow-600 text-sm font-medium hover:underline mt-2 inline-block">
                            Process Payments →
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}

                  {newApplicants.length > 0 && (
                    <div className="p-4 bg-blue-100 rounded-lg border border-blue-200">
                      <div className="flex items-start">
                        <svg className="h-6 w-6 text-blue-500 flex-shrink-0 mr-3" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                        </svg>
                        <div>
                          <h3 className="text-lg font-bold text-blue-800">
                            You have new applicants!
                          </h3>
                          <p className="text-sm text-blue-700 mt-1">
                            {newApplicants.map(n => n.message).join(' | ')}
                          </p>
                          <Link to="/tasks/posted" className="text-blue-600 text-sm font-medium hover:underline mt-2 inline-block">
                            Review Applicants →
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Other Notifications Section */}
            {otherNotifications.length > 0 && (
              <section className="bg-white p-6 rounded-lg shadow-md mb-8">
                <h2 className="text-xl font-semibold mb-4 text-gray-800">Other Notifications</h2>
                <div className="space-y-2">
                  {otherNotifications.map(notification => (
                    <div key={notification.id} className={`p-3 rounded-lg border-l-4 ${
                      notification.type === 'warning' ? 'bg-yellow-50 border-yellow-400 text-yellow-700' :
                      'bg-blue-50 border-blue-400 text-blue-700'
                    }`}>
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          {notification.type === 'warning' ? (
                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className="ml-3">
                          <p className="text-sm font-medium">{notification.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            
          </div>
          
          {/* Main Task Lists Column */}
          <div className="lg:col-span-2">
            <TaskList
              title="Tasks Assigned to You"
              tasks={activeAssignedTasks}
              emptyMessage="No assigned tasks yet. Check back later!"
              action={(task) =>
                task.status === "in-progress" && (
                  <button
                    onClick={() => completeTask(task._id)}
                    disabled={completing === task._id}
                    className="bg-green-500 text-white px-4 py-2 rounded text-sm hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {completing === task._id ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Marking...
                      </span>
                    ) : (
                      "Mark Completed"
                    )}
                  </button>
                )
              }
            />

            <TaskList
              title="Tasks You Posted"
              tasks={postedTasks}
              emptyMessage="You haven't posted any tasks yet."
              action={(task) =>
                task.status === "completed" && task.paymentStatus === "unpaid" && (
                  <button
                    onClick={() => payTask(task._id)}
                    disabled={paying === task._id}
                    className="bg-yellow-500 text-white px-4 py-2 rounded text-sm hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {paying === task._id ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      "Process Payment"
                    )}
                  </button>
                )
              }
            />

            <TaskList
              title="Tasks You Applied To"
              tasks={filteredAppliedTasks}
              emptyMessage="You haven't applied to any tasks yet."
            />
            
            <TaskList
              title="Completed & Paid Tasks"
              tasks={allCompletedTasks}
              emptyMessage="No completed and paid tasks yet."
            />
          </div>
        </div>
      </div>
    </main>
  );
};

export default Dashboard;