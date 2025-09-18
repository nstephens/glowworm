import React from 'react';
import { useNavigate } from 'react-router-dom';

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <img 
              src="/glowworm_icon.png" 
              alt="Glowworm Logo" 
              className="w-12 h-12 object-contain"
            />
            <h1 className="text-3xl font-bold text-gray-900">Glowworm</h1>
          </div>
          <p className="text-gray-600">Digital Photo Display System</p>
        </div>
        
        <div className="space-y-4">
          <button 
            onClick={() => navigate('/login')}
            className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors"
          >
            Admin Login
          </button>
          
          <button 
            onClick={() => navigate('/admin')}
            className="w-full bg-secondary-600 text-white py-3 px-4 rounded-lg hover:bg-secondary-700 transition-colors"
          >
            Admin Dashboard
          </button>
          
          <button 
            onClick={() => navigate('/display')}
            className="w-full bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Display View
          </button>
        </div>
        
        <div className="mt-6 text-sm text-gray-500">
          <p>Version 0.1.0</p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
