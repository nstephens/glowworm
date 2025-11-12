import { useState, useEffect, useCallback } from 'react';

export interface OfflineAction {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  retries: number;
  maxRetries: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

interface UseOfflineQueueOptions {
  maxRetries?: number;
  retryDelay?: number;
  autoProcess?: boolean;
  onActionComplete?: (action: OfflineAction) => void;
  onActionFailed?: (action: OfflineAction, error: Error) => void;
}

const STORAGE_KEY = 'glowworm-offline-queue';

export const useOfflineQueue = (options: UseOfflineQueueOptions = {}) => {
  const {
    maxRetries = 3,
    retryDelay = 5000,
    autoProcess = true,
    onActionComplete,
    onActionFailed,
  } = options;

  const [actions, setActions] = useState<OfflineAction[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load actions from localStorage on mount
  useEffect(() => {
    const storedActions = localStorage.getItem(STORAGE_KEY);
    if (storedActions) {
      try {
        const parsedActions = JSON.parse(storedActions);
        setActions(parsedActions);
      } catch (error) {
        console.error('Failed to parse stored offline actions:', error);
      }
    }
  }, []);

  // Save actions to localStorage whenever actions change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  }, [actions]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (autoProcess) {
        processQueue();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [autoProcess]);

  // Add action to queue
  const addAction = useCallback((type: string, payload: any) => {
    const action: OfflineAction = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      timestamp: Date.now(),
      retries: 0,
      maxRetries,
      status: 'pending',
    };

    setActions(prev => [...prev, action]);
    return action.id;
  }, [maxRetries]);

  // Remove action from queue
  const removeAction = useCallback((actionId: string) => {
    setActions(prev => prev.filter(action => action.id !== actionId));
  }, []);

  // Update action status
  const updateActionStatus = useCallback((actionId: string, status: OfflineAction['status']) => {
    setActions(prev => prev.map(action => 
      action.id === actionId ? { ...action, status } : action
    ));
  }, []);

  // Process a single action
  const processAction = useCallback(async (action: OfflineAction) => {
    try {
      updateActionStatus(action.id, 'processing');
      
      // Simulate API call based on action type
      const result = await executeAction(action);
      
      updateActionStatus(action.id, 'completed');
      onActionComplete?.(action);
      
      // Remove completed action after a delay
      setTimeout(() => {
        removeAction(action.id);
      }, 1000);
      
      return result;
    } catch (error) {
      const newRetries = action.retries + 1;
      
      if (newRetries >= action.maxRetries) {
        updateActionStatus(action.id, 'failed');
        onActionFailed?.(action, error as Error);
      } else {
        // Retry after delay
        setTimeout(() => {
          setActions(prev => prev.map(a => 
            a.id === action.id 
              ? { ...a, retries: newRetries, status: 'pending' }
              : a
          ));
        }, retryDelay);
      }
      
      throw error;
    }
  }, [updateActionStatus, onActionComplete, onActionFailed, removeAction, retryDelay]);

  // Process all pending actions
  const processQueue = useCallback(async () => {
    if (isProcessing || !isOnline) {
      return;
    }

    setIsProcessing(true);
    
    try {
      const pendingActions = actions.filter(action => action.status === 'pending');
      
      for (const action of pendingActions) {
        try {
          await processAction(action);
        } catch (error) {
          console.error(`Failed to process action ${action.id}:`, error);
        }
      }
    } finally {
      setIsProcessing(false);
    }
  }, [actions, isOnline, isProcessing, processAction]);

  // Retry failed actions
  const retryFailedActions = useCallback(() => {
    setActions(prev => prev.map(action => 
      action.status === 'failed' 
        ? { ...action, status: 'pending', retries: 0 }
        : action
    ));
  }, []);

  // Clear all actions
  const clearAllActions = useCallback(() => {
    setActions([]);
  }, []);

  // Clear completed actions
  const clearCompletedActions = useCallback(() => {
    setActions(prev => prev.filter(action => action.status !== 'completed'));
  }, []);

  // Get action by ID
  const getAction = useCallback((actionId: string) => {
    return actions.find(action => action.id === actionId);
  }, [actions]);

  // Get actions by type
  const getActionsByType = useCallback((type: string) => {
    return actions.filter(action => action.type === type);
  }, [actions]);

  // Get queue statistics
  const getQueueStats = useCallback(() => {
    const stats = actions.reduce((acc, action) => {
      acc[action.status] = (acc[action.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: actions.length,
      pending: stats.pending || 0,
      processing: stats.processing || 0,
      completed: stats.completed || 0,
      failed: stats.failed || 0,
    };
  }, [actions]);

  return {
    actions,
    isOnline,
    isProcessing,
    addAction,
    removeAction,
    updateActionStatus,
    processAction,
    processQueue,
    retryFailedActions,
    clearAllActions,
    clearCompletedActions,
    getAction,
    getActionsByType,
    getQueueStats,
  };
};

// Simulate API calls based on action type
const executeAction = async (action: OfflineAction): Promise<any> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

  // Simulate different action types
  switch (action.type) {
    case 'upload_image':
      // Simulate image upload
      return { success: true, imageId: Math.random().toString(36).substr(2, 9) };
    
    case 'create_album':
      // Simulate album creation
      return { success: true, albumId: Math.random().toString(36).substr(2, 9) };
    
    case 'delete_image':
      // Simulate image deletion
      return { success: true };
    
    case 'update_image_metadata':
      // Simulate metadata update
      return { success: true };
    
    case 'create_playlist':
      // Simulate playlist creation
      return { success: true, playlistId: Math.random().toString(36).substr(2, 9) };
    
    default:
      // Generic success response
      return { success: true };
  }
};

export default useOfflineQueue;








