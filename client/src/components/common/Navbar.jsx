import { Link, useNavigate } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import AuthProvider from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";

const Navbar = () => {
  const { user, logout, isAuthenticated } = AuthProvider.useAuth();
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    formatNotificationTime,
    getNotificationIcon
  } = useNotifications();

  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const handleDashboardClick = () => {
    if (isAuthenticated) {
      navigate("/dashboard");
    } else {
      navigate("/login");
    }
  };

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setIsNotificationOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      await markAsRead(notification._id);
    }
    if (notification.relatedTask?._id) {
      navigate(`/task/${notification.relatedTask._id}`);
    }
    setIsNotificationOpen(false);
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  const handleDeleteNotification = async (e, notificationId) => {
    e.stopPropagation();
    await deleteNotification(notificationId);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 w-full z-50 bg-green-600 text-white shadow-lg">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            {/* Logo */}
            <Link to="/" className="text-2xl font-bold">
              Campus Hub
            </Link>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden text-white focus:outline-none text-2xl"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              ☰
            </button>

            {/* Desktop Menu */}
            <div className="hidden md:flex items-center space-x-6">
              <Link to="/" className="hover:text-green-200 transition duration-200">
                Home
              </Link>
              <Link
                to="/BrowseTask"
                className="hover:text-green-200 transition duration-200"
              >
                Browse Tasks
              </Link>
              {isAuthenticated && (
                <>
                  <Link
                    to="/PostTask"
                    className="hover:text-green-200 transition duration-200"
                  >
                    Post Task
                  </Link>
                  <button
                    onClick={handleDashboardClick}
                    className="hover:text-green-200 transition duration-200"
                  >
                    Dashboard
                  </button>
                  <Link
                    to="/profile"
                    className="hover:text-green-200 transition duration-200"
                  >
                    Profile
                  </Link>
                </>
              )}

              {isAuthenticated ? (
                <div className="flex items-center space-x-4">
                  {/* Notifications */}
                  <div className="relative" ref={notificationRef}>
                    <button
                      onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                      className="relative focus:outline-none"
                    >
                      🔔
                      {unreadCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                          {unreadCount > 99 ? "99+" : unreadCount}
                        </span>
                      )}
                    </button>

                    {/* Notification Dropdown */}
                    {isNotificationOpen && (
                      <div className="absolute right-0 mt-2 w-80 bg-white text-black rounded-lg shadow-lg overflow-hidden z-50">
                        <div className="flex justify-between items-center px-4 py-2 border-b">
                          <span className="font-semibold">Notifications</span>
                          {notifications.length > 0 && (
                            <button
                              onClick={handleMarkAllRead}
                              className="text-sm text-green-600 hover:underline"
                            >
                              Mark all as read
                            </button>
                          )}
                        </div>
                        <div className="max-h-80 overflow-y-auto">
                          {notifications.length > 0 ? (
                            notifications.map((n) => (
                              <div
                                key={n._id}
                                onClick={() => handleNotificationClick(n)}
                                className={`flex items-start px-4 py-3 cursor-pointer hover:bg-gray-100 ${
                                  !n.isRead ? "bg-green-50" : ""
                                }`}
                              >
                                <div className="mr-2">
                                  {getNotificationIcon(n.type)}
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm">{n.message}</p>
                                  <p className="text-xs text-gray-500">
                                    {formatNotificationTime(n.createdAt)}
                                  </p>
                                </div>
                                <button
                                  onClick={(e) =>
                                    handleDeleteNotification(e, n._id)
                                  }
                                  className="text-gray-400 hover:text-red-500 ml-2"
                                >
                                  ✖
                                </button>
                              </div>
                            ))
                          ) : (
                            <p className="text-center py-4 text-gray-500">
                              No notifications
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <span className="text-green-200">
                    Welcome, {user?.name}!
                  </span>
                  <button
                    onClick={handleLogout}
                    className="bg-green-500 px-4 py-2 rounded-lg hover:bg-green-400 transition duration-200"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <div className="space-x-2">
                  <Link
                    to="/login"
                    className="hover:text-green-200 transition duration-200"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="bg-green-500 px-4 py-2 rounded-lg hover:bg-green-400 transition duration-200"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Dropdown Menu */}
          <div
            className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${
              isMenuOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
            }`}
          >
            <div className="flex flex-col space-y-2 pb-4">
              <Link
                to="/"
                className="hover:text-green-200 transition duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Home
              </Link>
              <Link
                to="/BrowseTask"
                className="hover:text-green-200 transition duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                Browse Tasks
              </Link>
              {isAuthenticated && (
                <>
                  <Link
                    to="/PostTask"
                    className="hover:text-green-200 transition duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Post Task
                  </Link>
                  <button
                    onClick={() => {
                      handleDashboardClick();
                      setIsMenuOpen(false);
                    }}
                    className="hover:text-green-200 transition duration-200 text-left"
                  >
                    Dashboard
                  </button>
                  <Link
                    to="/profile"
                    className="hover:text-green-200 transition duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Profile
                  </Link>

                  {/* Mobile Notifications */}
                  <Link
                    to="/notifications"
                    className="hover:text-green-200 transition duration-200 flex items-center"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Notifications
                    {unreadCount > 0 && (
                      <span className="ml-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    )}
                  </Link>
                </>
              )}

              {isAuthenticated ? (
                <div className="flex flex-col space-y-2">
                  <span className="text-green-200">
                    Welcome, {user?.name}!
                  </span>
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMenuOpen(false);
                    }}
                    className="bg-green-500 px-4 py-2 rounded-lg hover:bg-green-400 transition duration-200"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="hover:text-green-200 transition duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="bg-green-500 px-4 py-2 rounded-lg hover:bg-green-400 transition duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Spacer so content isn't hidden behind navbar */}
      <div className="pt-20"></div>
    </>
  );
};

export default Navbar;
