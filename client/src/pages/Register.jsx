import { useState } from 'react';
import AuthProvider from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phoneNumber: '',
    university: '',
    course: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = AuthProvider.useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    let value = e.target.value;
    
    // Format phone number as user types
    if (e.target.name === 'phoneNumber') {
      // Remove all non-digits
      value = value.replace(/\D/g, '');
      
      // Format based on length and starting digits
      if (value.startsWith('254')) {
        // International format: 254XXXXXXXXX
        if (value.length > 12) value = value.slice(0, 12);
      } else if (value.startsWith('0')) {
        // Local format: 0XXXXXXXXX
        if (value.length > 10) value = value.slice(0, 10);
      } else if (value.length > 0 && !value.startsWith('0') && !value.startsWith('254')) {
        // If user starts typing without 0 or 254, assume local format
        value = '0' + value;
        if (value.length > 10) value = value.slice(0, 10);
      }
    }
    
    setFormData({
      ...formData,
      [e.target.name]: value
    });
  };

  const validatePhone = (phone) => {
    // Kenyan phone number validation
    const phoneRegex = /^(\+?254|0)[17]\d{8}$/;
    return phoneRegex.test(phone);
  };

  const formatPhoneForDisplay = (phone) => {
    if (!phone) return '';
    
    // Remove any spaces or special characters except +
    const cleaned = phone.replace(/[^\d+]/g, '');
    
    if (cleaned.startsWith('254')) {
      return `+${cleaned}`;
    } else if (cleaned.startsWith('0') && cleaned.length === 10) {
      return cleaned.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
    }
    
    return cleaned;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate phone number
    if (!validatePhone(formData.phoneNumber)) {
      setError('Please enter a valid Kenyan phone number (e.g., 0712345678 or 254712345678)');
      setLoading(false);
      return;
    }

    // Validate required fields
    if (!formData.name.trim()) {
      setError('Name is required');
      setLoading(false);
      return;
    }

    if (!formData.email.trim()) {
      setError('Email is required');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    const result = await register(formData);
    
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
          Join Campus Hub
        </h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Full Name *
            </label>
            <input 
              type="text" 
              name="name"
              value={formData.name}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              placeholder="Enter your full name"
              required
            />
          </div>
          
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Email *
            </label>
            <input 
              type="email" 
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              placeholder="Enter your email"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Phone Number *
            </label>
            <input 
              type="tel" 
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              placeholder="0712345678 or 254712345678"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter your M-Pesa registered phone number
            </p>
          </div>
          
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Password *
            </label>
            <input 
              type="password" 
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              placeholder="Enter your password"
              minLength="6"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Must be at least 6 characters
            </p>
          </div>
          
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              University
            </label>
            <input 
              type="text" 
              name="university"
              value={formData.university}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              placeholder="Enter your university"
            />
          </div>
          
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Course
            </label>
            <input 
              type="text" 
              name="course"
              value={formData.course}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
              placeholder="Enter your course"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
          >
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <div className="text-center mt-4">
          <p className="text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-green-500 hover:text-green-600 font-medium">
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;