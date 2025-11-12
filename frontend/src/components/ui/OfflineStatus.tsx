import React, { useState } from 'react';
import { 
  WifiOff, 
  Clock, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  AlertCircle,
  Trash2,
  Play
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useOfflineQueue } from '../../hooks/useOfflineQueue';
import { Button } from './button';
import { Badge } from './badge';

interface OfflineStatusProps {
  className?: string;
  showDetails?: boolean;
  onActionClick?: (actionId: string) => void;
}

export const OfflineStatus: React.FC<OfflineStatusProps> = ({
  className,
  showDetails = false,
  onActionClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    actions,
    isOnline,
    isProcessing,
    processQueue,
    retryFailedActions,
    clearAllActions,
    clearCompletedActions,
    getQueueStats,
  } = useOfflineQueue();

  const stats = getQueueStats();

  if (isOnline && stats.total === 0) {
    return null;
  }

  const getStatusIcon = () => {
    if (isProcessing) {
      return <RefreshCw className="w-4 h-4 animate-spin" />;
    }
    if (stats.failed > 0) {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    if (stats.pending > 0) {
      return <Clock className="w-4 h-4 text-yellow-500" />;
    }
    if (stats.completed > 0) {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    return <WifiOff className="w-4 h-4 text-gray-500" />;
  };

  const getStatusText = () => {
    if (isProcessing) {
      return 'Processing...';
    }
    if (stats.failed > 0) {
      return `${stats.failed} failed`;
    }
    if (stats.pending > 0) {
      return `${stats.pending} pending`;
    }
    if (stats.completed > 0) {
      return `${stats.completed} completed`;
    }
    return 'Offline';
  };

  const getStatusColor = () => {
    if (isProcessing) {
      return 'bg-blue-100 text-blue-800 border-blue-200';
    }
    if (stats.failed > 0) {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    if (stats.pending > 0) {
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
    if (stats.completed > 0) {
      return 'bg-green-100 text-green-800 border-green-200';
    }
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* Status Bar */}
      <div
        className={cn(
          'flex items-center justify-between p-3 rounded-lg border',
          'cursor-pointer transition-all duration-200',
          'hover:shadow-md',
          getStatusColor()
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3">
          {getStatusIcon()}
          <div>
            <p className="text-sm font-medium">
              {isOnline ? 'Queue Status' : 'Offline Mode'}
            </p>
            <p className="text-xs opacity-75">
              {getStatusText()}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {stats.total > 0 && (
            <Badge variant="secondary" className="text-xs">
              {stats.total}
            </Badge>
          )}
          
          {isOnline && stats.pending > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                processQueue();
              }}
              disabled={isProcessing}
              className="h-6 px-2 text-xs"
            >
              <Play className="w-3 h-3 mr-1" />
              Process
            </Button>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && showDetails && (
        <div className="space-y-3">
          {/* Queue Statistics */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">Pending:</span>
              <span className="font-medium">{stats.pending}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Completed:</span>
              <span className="font-medium text-green-600">{stats.completed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Failed:</span>
              <span className="font-medium text-red-600">{stats.failed}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total:</span>
              <span className="font-medium">{stats.total}</span>
            </div>
          </div>

          {/* Action List */}
          {actions.length > 0 && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {actions.map((action) => (
                <div
                  key={action.id}
                  className={cn(
                    'flex items-center justify-between p-2 rounded border text-xs',
                    'hover:bg-gray-50 cursor-pointer',
                    action.status === 'completed' && 'bg-green-50 border-green-200',
                    action.status === 'failed' && 'bg-red-50 border-red-200',
                    action.status === 'processing' && 'bg-blue-50 border-blue-200'
                  )}
                  onClick={() => onActionClick?.(action.id)}
                >
                  <div className="flex items-center space-x-2">
                    <div className={cn(
                      'w-2 h-2 rounded-full',
                      action.status === 'completed' && 'bg-green-500',
                      action.status === 'failed' && 'bg-red-500',
                      action.status === 'processing' && 'bg-blue-500',
                      action.status === 'pending' && 'bg-yellow-500'
                    )} />
                    <span className="font-medium capitalize">
                      {action.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    {action.retries > 0 && (
                      <span className="text-gray-400">
                        ({action.retries}/{action.maxRetries})
                      </span>
                    )}
                    <span className="text-gray-400">
                      {new Date(action.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-2">
            {stats.failed > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={retryFailedActions}
                className="text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Retry Failed
              </Button>
            )}
            
            {stats.completed > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={clearCompletedActions}
                className="text-xs"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear Completed
              </Button>
            )}
            
            {stats.total > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={clearAllActions}
                className="text-xs text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear All
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OfflineStatus;








