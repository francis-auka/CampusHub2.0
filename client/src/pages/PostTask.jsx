import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PostTask = () => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    budget: '',
    category: 'Other',
    deadline: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:5000/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          budget: parseFloat(formData.budget)
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create task');
      }

      setSuccess(true);
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        budget: '',
        category: 'Other',
        deadline: ''
      });

      // Redirect after success message
      setTimeout(() => {
        navigate('/BrowseTask');
      }, 2000);

    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-8">Post a Task</h1>
        <div className="bg-white rounded-lg shadow-md p-6 max-w-2xl mx-auto">
          
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              Task posted successfully! Redirecting to browse tasks...
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Task Title *
              </label>
              <input 
                type="text" 
                name="title"
                value={formData.title}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                placeholder="What do you need help with?"
                required
              />
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Category *
              </label>
              <select 
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                required
              >
                <option value="Academic">Academic (Essays, Research, Tutoring)</option>
                <option value="Technical">Technical (Programming, Web Design)</option>
                <option value="Creative">Creative (Design, Writing, Video)</option>
                <option value="Research">Research (Data Collection, Analysis)</option>
                <option value="Other">Other</option>
              </select>
            </div>
            
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Description *
              </label>
              <textarea 
                rows="4"
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                placeholder="Describe your task in detail. Include specific requirements, deliverables, and any relevant information..."
                required
              ></textarea>
              <p className="text-sm text-gray-500 mt-1">
                Be specific about what you need. Clear descriptions get better responses!
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Budget (KES) *
                </label>
                <input 
                  type="number" 
                  name="budget"
                  value={formData.budget}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                  placeholder="Enter your budget"
                  min="50"
                  step="10"
                  required
                />
                <p className="text-sm text-gray-500 mt-1">Minimum: KES 50</p>
              </div>
              
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Deadline (Optional)
                </label>
                <input 
                  type="date" 
                  name="deadline"
                  value={formData.deadline}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:border-green-500 focus:ring-2 focus:ring-green-200"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
            
            <div className="flex space-x-4">
              <button 
                type="submit" 
                disabled={loading || success}
                className="flex-1 bg-green-500 text-white py-3 px-6 rounded-lg hover:bg-green-600 transition duration-200 disabled:opacity-50 font-medium"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Posting Task...
                  </div>
                ) : success ? (
                  '✓ Task Posted!'
                ) : (
                  'Post Task'
                )}
              </button>
              
              <button 
                type="button" 
                onClick={() => navigate('/BrowseTask')}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition duration-200"
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default PostTask;