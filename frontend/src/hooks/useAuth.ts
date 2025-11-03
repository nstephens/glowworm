import { useState, useEffect } from 'react';
import { apiService } from '../services/api';

// Cache auth state in memory to avoid repeated API calls
let authCache: {
  isAuthenticated: boolean | null;
  user: any;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 30000; // 30 seconds cache
const AUTH_TIMEOUT = 3000; // 3 second timeout for auth requests

export const useAuth = () => {
  // Initialize with optimistic state from localStorage
  const getOptimisticAuthState = () => {
    try {
      const lastAuth = localStorage.getItem('glowworm_last_auth');
      if (lastAuth) {
        const parsed = JSON.parse(lastAuth);
        // Only use if less than 5 minutes old
        if (Date.now() - parsed.timestamp < 300000) {
          return parsed.isAuthenticated;
        }
      }
    } catch (error) {
      console.warn('Failed to parse localStorage auth state:', error);
    }
    return null;
  };

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(getOptimisticAuthState());
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    checkAuthStatus();
    
    // Listen for visibility changes (phone unlock, tab switch, etc.)
    // This helps catch cases where cookies might not be immediately available
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Small delay to allow cookies to be available
        setTimeout(() => {
          checkAuthStatus(true); // Force fresh check
        }, 500);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Also listen for focus events (iOS web app specific)
    const handleFocus = () => {
      setTimeout(() => {
        checkAuthStatus(true);
      }, 500);
    };
    
    window.addEventListener('focus', handleFocus);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const checkAuthStatus = async (forceFresh = false) => {
    try {
      // Check if we have recent cached auth data (unless forced fresh)
      if (!forceFresh && authCache && (Date.now() - authCache.timestamp) < CACHE_DURATION) {
        console.log('🚀 Using cached auth state');
        setIsAuthenticated(authCache.isAuthenticated);
        setCurrentUser(authCache.user);
        setIsLoading(false);
        return;
      }

      console.log('🔄 Performing fresh auth check...');

      // Create a timeout promise to fail fast
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Auth check timeout')), AUTH_TIMEOUT)
      );

      // Race between API call and timeout
      const response = await Promise.race([
        apiService.getUserProfile(),
        timeoutPromise
      ]) as any;

      const isAuth = response.success;
      const user = response.success ? response.data : null;

      // Update cache
      authCache = {
        isAuthenticated: isAuth,
        user: user,
        timestamp: Date.now()
      };

      // Persist optimistic auth state to localStorage
      try {
        localStorage.setItem('glowworm_last_auth', JSON.stringify({
          isAuthenticated: isAuth,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.warn('Failed to save auth state to localStorage:', error);
      }

      setIsAuthenticated(isAuth);
      setCurrentUser(user);
    } catch (error: any) {
      console.warn('Auth check failed:', error);
      
      // If we get a 401, try refreshing the session before giving up
      if (error.response?.status === 401 || error.status === 401) {
        try {
          console.log('🔄 Attempting session refresh...');
          const refreshResponse = await apiService.refreshSession();
          if (refreshResponse.success && refreshResponse.data) {
            console.log('✅ Session refreshed successfully');
            // Update cache with refreshed state
            authCache = {
              isAuthenticated: true,
              user: refreshResponse.data,
              timestamp: Date.now()
            };
            setIsAuthenticated(true);
            setCurrentUser(refreshResponse.data);
            setIsLoading(false);
            
            // Save optimistic auth state
            try {
              localStorage.setItem('glowworm_last_auth', JSON.stringify({
                isAuthenticated: true,
                timestamp: Date.now()
              }));
            } catch (e) {
              console.warn('Failed to save auth state:', e);
            }
            return;
          }
        } catch (refreshError) {
          console.warn('Session refresh failed:', refreshError);
          // Fall through to normal error handling
        }
      }
      
      // Update cache with failed state
      authCache = {
        isAuthenticated: false,
        user: null,
        timestamp: Date.now()
      };

      // Clear optimistic auth state from localStorage
      try {
        localStorage.removeItem('glowworm_last_auth');
      } catch (error) {
        console.warn('Failed to clear auth state from localStorage:', error);
      }

      setIsAuthenticated(false);
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiService.logout();
      // Clear auth cache and localStorage
      authCache = null;
      localStorage.removeItem('glowworm_last_auth');
      setIsAuthenticated(false);
      setCurrentUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      // Clear auth cache and localStorage even on error
      authCache = null;
      localStorage.removeItem('glowworm_last_auth');
      setIsAuthenticated(false);
      setCurrentUser(null);
    }
  };

  const clearAuthCache = () => {
    console.log('🗑️ Clearing auth cache');
    authCache = null;
    localStorage.removeItem('glowworm_last_auth');
  };

  return {
    isAuthenticated,
    isLoading,
    currentUser,
    checkAuthStatus,
    logout,
    clearAuthCache
  };
};
