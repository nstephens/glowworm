import { useState, useEffect, useCallback } from 'react';
import { useOfflineQueue } from './useOfflineQueue';

interface UseOfflineModeOptions {
  enableQueue?: boolean;
  showNotifications?: boolean;
  autoProcessOnOnline?: boolean;
}

export const useOfflineMode = (options: UseOfflineModeOptions = {}) => {
  const {
    enableQueue = true,
    showNotifications = true,
    autoProcessOnOnline = true,
  } = options;

  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [lastOnlineTime, setLastOnlineTime] = useState<number | null>(null);
  const [lastOfflineTime, setLastOfflineTime] = useState<number | null>(null);

  const offlineQueue = useOfflineQueue({
    autoProcess: autoProcessOnOnline,
    onActionComplete: (action) => {
      if (showNotifications) {
        console.log(`Offline action completed: ${action.type}`);
      }
    },
    onActionFailed: (action, error) => {
      if (showNotifications) {
        console.error(`Offline action failed: ${action.type}`, error);
      }
    },
  });

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      setLastOnlineTime(Date.now());
      
      if (showNotifications) {
        console.log('Connection restored');
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(false);
      setLastOfflineTime(Date.now());
      
      if (showNotifications) {
        console.log('Connection lost - entering offline mode');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showNotifications]);

  // Queue actions when offline
  const queueAction = useCallback((type: string, payload: any) => {
    if (!enableQueue) {
      return null;
    }

    if (isOnline) {
      // If online, execute immediately
      return executeOnlineAction(type, payload);
    } else {
      // If offline, add to queue
      return offlineQueue.addAction(type, payload);
    }
  }, [isOnline, enableQueue, offlineQueue]);

  // Execute action when online
  const executeOnlineAction = useCallback(async (type: string, payload: any) => {
    try {
      // This would normally make an API call
      const result = await simulateApiCall(type, payload);
      return result;
    } catch (error) {
      // If API call fails, queue the action
      if (enableQueue) {
        return offlineQueue.addAction(type, payload);
      }
      throw error;
    }
  }, [enableQueue, offlineQueue]);

  // Get offline statistics
  const getOfflineStats = useCallback(() => {
    const queueStats = offlineQueue.getQueueStats();
    
    return {
      isOnline,
      wasOffline,
      lastOnlineTime,
      lastOfflineTime,
      offlineDuration: lastOfflineTime ? Date.now() - lastOfflineTime : 0,
      onlineDuration: lastOnlineTime ? Date.now() - lastOnlineTime : 0,
      queueStats,
    };
  }, [isOnline, wasOffline, lastOnlineTime, lastOfflineTime, offlineQueue]);

  // Check if a feature is available offline
  const isFeatureAvailableOffline = useCallback((feature: string) => {
    const offlineFeatures = [
      'view_images',
      'view_albums',
      'view_playlists',
      'view_settings',
      'browse_cached_content',
    ];

    return offlineFeatures.includes(feature);
  }, []);

  // Get cached data
  const getCachedData = useCallback((key: string) => {
    try {
      const cached = localStorage.getItem(`glowworm-cache-${key}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('Failed to get cached data:', error);
      return null;
    }
  }, []);

  // Set cached data
  const setCachedData = useCallback((key: string, data: any) => {
    try {
      localStorage.setItem(`glowworm-cache-${key}`, JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('Failed to set cached data:', error);
    }
  }, []);

  // Clear cached data
  const clearCachedData = useCallback((key?: string) => {
    if (key) {
      localStorage.removeItem(`glowworm-cache-${key}`);
    } else {
      // Clear all cached data
      const keys = Object.keys(localStorage);
      keys.forEach(k => {
        if (k.startsWith('glowworm-cache-')) {
          localStorage.removeItem(k);
        }
      });
    }
  }, []);

  // Check if data is stale
  const isDataStale = useCallback((key: string, maxAge: number = 5 * 60 * 1000) => {
    try {
      const cached = localStorage.getItem(`glowworm-cache-${key}`);
      if (!cached) return true;

      const { timestamp } = JSON.parse(cached);
      return Date.now() - timestamp > maxAge;
    } catch (error) {
      return true;
    }
  }, []);

  return {
    isOnline,
    wasOffline,
    lastOnlineTime,
    lastOfflineTime,
    queueAction,
    getOfflineStats,
    isFeatureAvailableOffline,
    getCachedData,
    setCachedData,
    clearCachedData,
    isDataStale,
    offlineQueue: enableQueue ? offlineQueue : null,
  };
};

// Simulate API call
const simulateApiCall = async (type: string, payload: any): Promise<any> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

  // Simulate different action types
  switch (type) {
    case 'upload_image':
      return { success: true, imageId: Math.random().toString(36).substr(2, 9) };
    
    case 'create_album':
      return { success: true, albumId: Math.random().toString(36).substr(2, 9) };
    
    case 'delete_image':
      return { success: true };
    
    case 'update_image_metadata':
      return { success: true };
    
    case 'create_playlist':
      return { success: true, playlistId: Math.random().toString(36).substr(2, 9) };
    
    default:
      return { success: true };
  }
};

export default useOfflineMode;





