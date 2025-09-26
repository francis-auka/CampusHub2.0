import { useState, useEffect } from 'react';
import AuthProvider from '../context/AuthContext';

const Profile = () => {
  const { user, token, updateProfile } = AuthProvider.useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    university: '',
    course: ''
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber ? user.phoneNumber.replace('+', '') : '',
        university: user.university || '',
        course: user.course || ''
      });
    }
  }, [user]);

  const handleChange = (e) => {
    let value = e.target.value;
    
    // Format phone number as user types
    if (e.target.name === 'phoneNumber') {
      value = value.replace(/\D/g, '');
      
      if (value.startsWith('254')) {
        if (value.length > 12) value = value.slice(0, 12);
      } else if (value.startsWith('0')) {
        if (value.length > 10) value = value.slice(0, 10);
      } else if (value.length > 0 && !value.startsWith('0') && !value.startsWith('254')) {
        value = '0' + value;
        if (value.length > 10) value = value.slice(0, 10);
      }
    }
    
    setFormData({
      ...formData,
      [e.target.name]: value
    });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({
      ...passwordData,
      [e.target.name]: e.target.value
    });
  };

  const validatePhone = (phone) => {
    const phoneRegex = /^(\+?254|0)[17]\d{8}$/;
    return phoneRegex.test(phone);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    // Validate phone number
    if (formData.phoneNumber && !validatePhone(formData.phoneNumber)) {
      setError('Please enter a valid Kenyan phone number');
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

    try {
      const response = await fetch('http://localhost:5000/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update profile');
      }

      // Update user context if updateProfile method exists
      if (updateProfile) {
        updateProfile(data.user);
      }

      setSuccess('Profile updated successfully!');
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      setLoading(false);
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('New password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('http://localhost:5000/api/users/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update password');
      }

      setSuccess('Password updated successfully!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setShowPasswordForm(false);
    } catch (err) {
      setError(err.message);
    }

    setLoading(false);
  };

  const formatPhoneForDisplay = (phone) => {
    if (!phone) return '';
    
    const cleaned = phone.replace(/[^\d]/g, '');
    
    if (cleaned.startsWith('254')) {
      return `+${cleaned}`;
    } else if (cleaned.startsWith('0') && cleaned.length === 10) {
      return cleaned.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
    }
    
    return cleaned;
  };

  if (!user) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Header */}
          <div className="bg-green-500 px-6 py-4">
            <h1 className="text-2xl font-bold text-white">My Profile</h1>
            <p className="text-green-100">Manage your account information</p>
          </div>

          <div className="p-6">
            {/* Success/Error Messages */}
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                {error}
              </div>
            )}
            
            {success && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                {success}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Profile Stats */}
              <div className="lg:col-span-1">
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Profile Stats</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Rating</span>
                      <span className="font-medium text-yellow-600">
                        ⭐ {user.rating.toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tasks Completed</span>
                      <span className="font-medium text-green-600">
                        {user.tasksCompleted}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Phone Status</span>
                      <span className={`font-medium ${user.phoneNumber ? 'text-green-600' : 'text-red-600'}`}>
                        {user.phoneNumber ? '✓ Verified' : '✗ Missing'}
                      </span>
                    </div>
                  </div>
                  
                  {!user.phoneNumber && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                      <p className="text-sm text-yellow-800">
                        <strong>M-Pesa Integration:</strong> Add your phone number to enable payments
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Profile Form */}
              <div className="lg:col-span-2">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  </div>

                  <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Phone Number *
                      <span className="text-green-600 text-xs ml-1">(Required for M-Pesa)</span>
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
                      Use your M-Pesa registered number for seamless payments
                    </p>
                    {formData.phoneNumber && (
                      <p className="text-xs text-green-600 mt-1">
                        Display format: {formatPhoneForDisplay(formData.phoneNumber)}
                      </p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  </div>
                  
                  <button 
                    type="submit" 
                    disabled={loading}
                    className="w-full bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Updating Profile...' : 'Update Profile'}
                  </button>
                </form>

                {/* Password Change Section */}
                <div className="mt-8 pt-6 border-t border-gray-200">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-800">Change Password</h3>
                    <button
                      type="button"
                      onClick={() => setShowPasswordForm(!showPasswordForm)}
                      className="text-green-500 hover:text-green-600 font-medium"
                    >
                      {showPasswordForm ? 'Cancel' : 'Change Password'}
                    </button>
                  </div>

                  {showPasswordForm && (
                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                      <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2">
                          Current Password *
                        </label>
                        <input 
                          type="password" 
                          name="currentPassword"
                          value={passwordData.currentPassword}
                          onChange={handlePasswordChange}
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                          placeholder="Enter current password"
                          required
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-gray-700 text-sm font-bold mb-2">
                            New Password *
                          </label>
                          <input 
                            type="password" 
                            name="newPassword"
                            value={passwordData.newPassword}
                            onChange={handlePasswordChange}
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                            placeholder="Enter new password"
                            minLength="6"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-gray-700 text-sm font-bold mb-2">
                            Confirm New Password *
                          </label>
                          <input 
                            type="password" 
                            name="confirmPassword"
                            value={passwordData.confirmPassword}
                            onChange={handlePasswordChange}
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
                            placeholder="Confirm new password"
                            minLength="6"
                            required
                          />
                        </div>
                      </div>
                      
                      <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading ? 'Updating Password...' : 'Update Password'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
  export default Profile;