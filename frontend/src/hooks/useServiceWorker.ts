import { useState, useEffect, useCallback } from 'react';
import { 
  initializeServiceWorker, 
  getServiceWorkerManager,
  isServiceWorkerSupported,
  isOnline 
} from '@/utils/serviceWorker';

interface UseServiceWorkerOptions {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onOfflineReady?: () => void;
  onError?: (error: Error) => void;
  autoRegister?: boolean;
}

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isUpdated: boolean;
  isOfflineReady: boolean;
  isOnline: boolean;
  registration: ServiceWorkerRegistration | null;
  cacheSize: number;
}

export function useServiceWorker(options: UseServiceWorkerOptions = {}) {
  const [state, setState] = useState<ServiceWorkerState>({
    isSupported: isServiceWorkerSupported(),
    isRegistered: false,
    isUpdated: false,
    isOfflineReady: false,
    isOnline: isOnline(),
    registration: null,
    cacheSize: 0,
  });

  const { autoRegister = true, ...config } = options;

  // Initialize service worker
  useEffect(() => {
    if (!state.isSupported) return;

    const manager = initializeServiceWorker({
      onUpdate: (registration) => {
        setState(prev => ({ ...prev, isUpdated: true, registration }));
        config.onUpdate?.(registration);
      },
      onSuccess: (registration) => {
        setState(prev => ({ ...prev, isRegistered: true, registration }));
        config.onSuccess?.(registration);
      },
      onOfflineReady: () => {
        setState(prev => ({ ...prev, isOfflineReady: true }));
        config.onOfflineReady?.();
      },
      onError: (error) => {
        console.error('Service Worker Error:', error);
        config.onError?.(error);
      },
    });

    if (autoRegister) {
      manager.register().then(() => {
        setState(prev => ({ ...prev, ...manager.getState() }));
      });
    }
  }, [state.isSupported, autoRegister]);

  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => setState(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setState(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update cache size periodically
  useEffect(() => {
    const updateCacheSize = async () => {
      const manager = getServiceWorkerManager();
      if (manager) {
        const size = await manager.getCacheSize();
        setState(prev => ({ ...prev, cacheSize: size }));
      }
    };

    updateCacheSize();
    const interval = setInterval(updateCacheSize, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  const update = useCallback(async () => {
    const manager = getServiceWorkerManager();
    if (manager) {
      await manager.update();
    }
  }, []);

  const skipWaiting = useCallback(async () => {
    const manager = getServiceWorkerManager();
    if (manager) {
      await manager.skipWaiting();
    }
  }, []);

  const clearCache = useCallback(async () => {
    const manager = getServiceWorkerManager();
    if (manager) {
      await manager.clearCache();
      setState(prev => ({ ...prev, cacheSize: 0 }));
    }
  }, []);

  const unregister = useCallback(async () => {
    const manager = getServiceWorkerManager();
    if (manager) {
      const result = await manager.unregister();
      setState(prev => ({ 
        ...prev, 
        isRegistered: !result,
        registration: null 
      }));
      return result;
    }
    return false;
  }, []);

  return {
    ...state,
    update,
    skipWaiting,
    clearCache,
    unregister,
  };
}

// Hook for offline detection
export function useOfflineDetection() {
  const [isOnline, setIsOnline] = useState(isOnline());

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

// Hook for cache management
export function useCacheManagement() {
  const [cacheSize, setCacheSize] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const updateCacheSize = useCallback(async () => {
    setIsLoading(true);
    try {
      const manager = getServiceWorkerManager();
      if (manager) {
        const size = await manager.getCacheSize();
        setCacheSize(size);
      }
    } catch (error) {
      console.error('Failed to get cache size:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearCache = useCallback(async () => {
    setIsLoading(true);
    try {
      const manager = getServiceWorkerManager();
      if (manager) {
        await manager.clearCache();
        setCacheSize(0);
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    updateCacheSize();
  }, [updateCacheSize]);

  return {
    cacheSize,
    isLoading,
    updateCacheSize,
    clearCache,
  };
}
