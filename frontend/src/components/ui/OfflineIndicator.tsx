import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface OfflineIndicatorProps {
  className?: string;
  showWhenOnline?: boolean;
  autoHide?: boolean;
  hideDelay?: number;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  className,
  showWhenOnline = false,
  autoHide = true,
  hideDelay = 3000,
}) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showIndicator, setShowIndicator] = useState(!navigator.onLine);
  const [isReconnecting, setIsReconnecting] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setIsReconnecting(false);
      
      if (showWhenOnline) {
        setShowIndicator(true);
        if (autoHide) {
          setTimeout(() => setShowIndicator(false), hideDelay);
        }
      } else {
        setShowIndicator(false);
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsReconnecting(false);
      setShowIndicator(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [showWhenOnline, autoHide, hideDelay]);

  const handleRetry = () => {
    setIsReconnecting(true);
    
    // Simulate reconnection attempt
    setTimeout(() => {
      if (navigator.onLine) {
        setIsOnline(true);
        setIsReconnecting(false);
        if (autoHide) {
          setTimeout(() => setShowIndicator(false), hideDelay);
        }
      } else {
        setIsReconnecting(false);
      }
    }, 1000);
  };

  if (!showIndicator) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed top-4 right-4 z-50',
        'bg-white dark:bg-gray-800',
        'border border-gray-200 dark:border-gray-700',
        'rounded-lg shadow-lg',
        'px-4 py-3',
        'flex items-center space-x-3',
        'transition-all duration-300 ease-in-out',
        'transform',
        showIndicator ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0',
        className
      )}
    >
      {/* Icon */}
      <div className="flex-shrink-0">
        {isOnline ? (
          <CheckCircle className="w-5 h-5 text-green-500" />
        ) : (
          <WifiOff className="w-5 h-5 text-red-500" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {isOnline ? 'Back Online' : 'You\'re Offline'}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {isOnline 
            ? 'Connection restored successfully' 
            : 'Some features may be limited'
          }
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center space-x-2">
        {!isOnline && (
          <button
            onClick={handleRetry}
            disabled={isReconnecting}
            className={cn(
              'p-1.5 rounded-md',
              'text-gray-400 hover:text-gray-600',
              'hover:bg-gray-100 dark:hover:bg-gray-700',
              'transition-colors duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            title="Retry connection"
          >
            <RefreshCw 
              className={cn(
                'w-4 h-4',
                isReconnecting && 'animate-spin'
              )} 
            />
          </button>
        )}
        
        <button
          onClick={() => setShowIndicator(false)}
          className={cn(
            'p-1.5 rounded-md',
            'text-gray-400 hover:text-gray-600',
            'hover:bg-gray-100 dark:hover:bg-gray-700',
            'transition-colors duration-200'
          )}
          title="Dismiss"
        >
          <AlertCircle className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Hook for offline status
export const useOfflineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isOnline,
    wasOffline,
    isOffline: !isOnline,
  };
};

export default OfflineIndicator;




