import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AuthProvider from "../../context/AuthContext";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = AuthProvider.useAuth();
  const navigate = useNavigate();
  const location = useLocation(); // New: Added location for better redirect handling

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      // New: Navigate with state to preserve the intended destination
      navigate('/login', { state: { from: location }, replace: true });
    }
  }, [isAuthenticated, loading, navigate, location]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div> {/* Updated: Added mb-4 for better spacing */}
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect to login via useEffect
  }

  return children;
};

export default ProtectedRoute;