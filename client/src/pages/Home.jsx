import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-800 mb-6">
            Welcome to Campus Hub
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Connect with fellow students for task assistance. Post tasks you need help with 
            or browse available opportunities to earn money while helping others.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Need Help?</h3>
            <p className="text-gray-600 mb-6">
              Post a task and get assistance from fellow students
            </p>
            <Link 
              to="/PostTask"
              className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition duration-200 inline-block"
            >
              Post a Task
            </Link>
          </div>
          
          <div className="bg-white p-8 rounded-lg shadow-md text-center">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Want to Help?</h3>
            <p className="text-gray-600 mb-6">
              Browse available tasks and earn money by helping others
            </p>
            <Link 
              to="/BrowseTask"
              className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition duration-200 inline-block"
            >
              Browse Tasks
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;