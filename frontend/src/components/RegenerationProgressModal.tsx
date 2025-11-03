import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { CheckCircle, XCircle, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { websocketService, type RegenerationProgress } from '../services/websocketService';

interface RegenerationProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string;
  initialProgress?: RegenerationProgress;
}

export const RegenerationProgressModal: React.FC<RegenerationProgressModalProps> = ({
  isOpen,
  onClose,
  taskId,
  initialProgress
}) => {
  const [progress, setProgress] = useState<RegenerationProgress | null>(initialProgress || null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!isOpen || !taskId) return;

    mountedRef.current = true;

    const connectWebSocket = async () => {
      try {
        await websocketService.connect(
          taskId,
          (message) => {
            if (mountedRef.current) {
              console.log('📨 Received WebSocket message:', message);
              console.log('📊 Progress data:', message.data);
              setProgress(message.data);
              setError(null);
            }
          },
          (wsError) => {
            if (mountedRef.current) {
              console.error('WebSocket error:', wsError);
              setError('Connection lost. Progress updates may be delayed.');
            }
          }
        );
        
        if (mountedRef.current) {
          setIsConnected(true);
        }
      } catch (err) {
        if (mountedRef.current) {
          console.error('Failed to connect WebSocket:', err);
          setError('Failed to connect to progress updates.');
        }
      }
    };

    connectWebSocket();

    return () => {
      mountedRef.current = false;
      websocketService.disconnect();
      setIsConnected(false);
    };
  }, [isOpen, taskId]);

  if (!isOpen) return null;

  const getStatusIcon = () => {
    if (!progress) return <Loader2 className="w-5 h-5 animate-spin" />;
    
    switch (progress.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-600" />;
      case 'running':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-600" />;
      default:
        return <RefreshCw className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusText = () => {
    if (!progress) return 'Initializing...';
    
    switch (progress.status) {
      case 'pending':
        return 'Waiting to start...';
      case 'running':
        return 'Processing images...';
      case 'completed':
        return 'Regeneration completed!';
      case 'failed':
        return 'Regeneration failed';
      default:
        return 'Unknown status';
    }
  };

  const getStatusColor = () => {
    if (!progress) return 'bg-gray-100 text-gray-800';
    
    switch (progress.status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return 'N/A';
    return new Date(timeString).toLocaleTimeString();
  };

  const canClose = progress?.status === 'completed' || progress?.status === 'failed' || error;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getStatusIcon()}
              <div>
                <CardTitle className="text-xl">Resolution Regeneration</CardTitle>
                <CardDescription>Processing images for display size variants</CardDescription>
              </div>
            </div>
            {canClose && (
              <Button variant="ghost" size="sm" onClick={onClose}>
                <XCircle className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <Badge className={getStatusColor()}>
              {getStatusText()}
            </Badge>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-center space-x-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <span className="text-sm text-yellow-800">{error}</span>
            </div>
          )}

          {/* Progress Bar */}
          {progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{progress.progress_percentage?.toFixed(1) || '0.0'}%</span>
              </div>
              <Progress value={progress.progress_percentage || 0} className="h-2" />
            </div>
          )}

          {/* Statistics */}
          {progress && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{progress.processed_images || 0}</div>
                <div className="text-sm text-gray-600">Processed</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">{progress.total_images || 0}</div>
                <div className="text-sm text-gray-600">Total</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{progress.error_count || 0}</div>
                <div className="text-sm text-gray-600">Errors</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{progress.display_sizes?.length || 0}</div>
                <div className="text-sm text-gray-600">Resolutions</div>
              </div>
            </div>
          )}

          {/* Current Image */}
          {progress?.current_image && progress.status === 'running' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-800">
                <strong>Currently processing:</strong> {progress.current_image}
              </div>
            </div>
          )}

          {/* Display Sizes */}
          {progress?.display_sizes && progress.display_sizes.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Target Resolutions</h4>
              <div className="flex flex-wrap gap-2">
                {progress.display_sizes.map((size, index) => (
                  <Badge key={index} variant="outline">
                    {size}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Timing Information */}
          {progress && (progress.started_at || progress.completed_at) && (
            <div className="text-sm text-gray-600 space-y-1">
              {progress.started_at && (
                <div>Started: {formatTime(progress.started_at)}</div>
              )}
              {progress.completed_at && (
                <div>Completed: {formatTime(progress.completed_at)}</div>
              )}
            </div>
          )}

          {/* Error Details */}
          {progress?.error_message && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="text-sm text-red-800">
                <strong>Error:</strong> {progress.error_message}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            {canClose ? (
              <Button onClick={onClose} className="w-full">
                Close
              </Button>
            ) : (
              <div className="text-sm text-gray-600 text-center w-full">
                Regeneration is in progress. You can close this window and check back later.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
