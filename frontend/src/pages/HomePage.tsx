import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { apiService } from '../services/api';

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading, currentUser } = useAuth();
  const [isCheckingDevice, setIsCheckingDevice] = useState(false);

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      // If still loading auth, wait
      if (isLoading) return;

      // If user is authenticated, redirect to admin dashboard
      if (isAuthenticated && currentUser) {
        console.log('🔐 User authenticated, redirecting to admin dashboard');
        navigate('/admin');
        return;
      }

      // Check if this is a display device
      try {
        setIsCheckingDevice(true);
        const deviceResponse = await apiService.validateDeviceCookie();
        
        if (deviceResponse.success && deviceResponse.data) {
          console.log('📺 Display device detected, redirecting to display view');
          // Get the device slug from the response or use a default
          const deviceSlug = deviceResponse.data.slug || 'default';
          navigate(`/display/${deviceSlug}`);
          return;
        }
      } catch (error) {
        console.log('📺 Not a display device or validation failed:', error);
      } finally {
        setIsCheckingDevice(false);
      }

      // If no authentication and not a display device, redirect to login
      console.log('🔐 No authentication found, redirecting to login');
      navigate('/login');
    };

    checkAuthAndRedirect();
  }, [isAuthenticated, isLoading, currentUser, navigate]);

  // Show loading while checking authentication
  if (isLoading || isCheckingDevice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading GlowWorm...</p>
        </div>
      </div>
    );
  }

  // This should rarely be seen as we redirect immediately
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-secondary-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting...</p>
      </div>
    </div>
  );
};

export default HomePage;
