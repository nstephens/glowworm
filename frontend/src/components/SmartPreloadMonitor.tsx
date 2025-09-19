import React, { useState, useEffect, useCallback } from 'react';
import { 
  Activity, 
  Memory, 
  Cpu, 
  HardDrive, 
  Play, 
  Pause, 
  Settings, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  BarChart3
} from 'lucide-react';
import { smartPreloadService, type OverallStatus, type MemoryStats } from '../services/smartPreload';

interface SmartPreloadMonitorProps {
  playlistId?: number;
  onPreloadStart?: () => void;
  onPreloadComplete?: () => void;
  autoStart?: boolean;
  showControls?: boolean;
}

export const SmartPreloadMonitor: React.FC<SmartPreloadMonitorProps> = ({
  playlistId,
  onPreloadStart,
  onPreloadComplete,
  autoStart = false,
  showControls = true
}) => {
  const [status, setStatus] = useState<OverallStatus | null>(null);
  const [memory, setMemory] = useState<MemoryStats | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPreloading, setIsPreloading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Start monitoring when component mounts
  useEffect(() => {
    startMonitoring();
    return () => {
      stopMonitoring();
    };
  }, []);

  // Auto-start preload if enabled
  useEffect(() => {
    if (autoStart && playlistId && status?.worker_running) {
      startSmartPreload();
    }
  }, [autoStart, playlistId, status?.worker_running]);

  const startMonitoring = useCallback(() => {
    if (isMonitoring) return;

    setIsMonitoring(true);
    smartPreloadService.startStatusMonitoring(
      (newStatus) => {
        setStatus(newStatus);
        setError(null);
      },
      (newMemory) => {
        setMemory(newMemory);
      },
      2000 // Update every 2 seconds
    );
  }, [isMonitoring]);

  const stopMonitoring = useCallback(() => {
    if (!isMonitoring) return;

    setIsMonitoring(false);
    smartPreloadService.stopStatusMonitoring();
  }, [isMonitoring]);

  const startSmartPreload = async () => {
    if (!playlistId) return;

    try {
      setIsPreloading(true);
      setError(null);
      
      await smartPreloadService.smartPreloadForSlideshow(
        playlistId,
        0, // Start from beginning
        5, // 5 second slides
        ['webp', 'avif']
      );

      onPreloadStart?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start preload');
    } finally {
      setIsPreloading(false);
    }
  };

  const stopSmartPreload = async () => {
    try {
      await smartPreloadService.emergencyStop();
      onPreloadComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop preload');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600';
      case 'processing':
        return 'text-blue-600';
      case 'failed':
        return 'text-red-600';
      case 'queued':
        return 'text-yellow-600';
      default:
        return 'text-gray-600';
    }
  };

  const getMemoryColor = (percent: number) => {
    if (percent > 80) return 'text-red-600';
    if (percent > 60) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (!status || !memory) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600">Loading preload status...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Zap className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Smart Preload</h3>
          <div className={`w-2 h-2 rounded-full ${
            status.worker_running ? 'bg-green-500' : 'bg-red-500'
          }`}></div>
        </div>
        
        {showControls && (
          <div className="flex items-center space-x-2">
            <button
              onClick={startSmartPreload}
              disabled={isPreloading || !playlistId}
              className="flex items-center space-x-1 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-4 h-4" />
              <span>Start</span>
            </button>
            
            <button
              onClick={stopSmartPreload}
              disabled={!status.worker_running}
              className="flex items-center space-x-1 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Pause className="w-4 h-4" />
              <span>Stop</span>
            </button>
            
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center space-x-1 bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
            >
              <BarChart3 className="w-4 h-4" />
              <span>{showDetails ? 'Hide' : 'Show'} Details</span>
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-800">{error}</span>
          </div>
        </div>
      )}

      {/* Status Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Queue</p>
              <p className="text-lg font-semibold">{status.queue_size}</p>
            </div>
            <Clock className="w-5 h-5 text-gray-400" />
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active</p>
              <p className="text-lg font-semibold">{status.active_tasks}</p>
            </div>
            <Activity className="w-5 h-5 text-blue-400" />
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-lg font-semibold text-green-600">{status.completed_tasks}</p>
            </div>
            <CheckCircle className="w-5 h-5 text-green-400" />
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Failed</p>
              <p className="text-lg font-semibold text-red-600">{status.failed_tasks}</p>
            </div>
            <XCircle className="w-5 h-5 text-red-400" />
          </div>
        </div>
      </div>

      {/* Memory Usage */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <Memory className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Memory Usage</span>
          </div>
          <span className={`text-sm font-medium ${getMemoryColor(memory.used_memory_percent)}`}>
            {memory.used_memory_percent.toFixed(1)}%
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              memory.used_memory_percent > 80 
                ? 'bg-red-500' 
                : memory.used_memory_percent > 60 
                ? 'bg-yellow-500' 
                : 'bg-green-500'
            }`}
            style={{ width: `${memory.used_memory_percent}%` }}
          ></div>
        </div>
        
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{memory.available_memory_mb} MB available</span>
          <span>{memory.total_memory_mb} MB total</span>
        </div>
      </div>

      {/* Detailed Stats */}
      {showDetails && (
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">Detailed Statistics</h4>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Total Preloaded</p>
              <p className="font-semibold">{status.stats.total_preloaded}</p>
            </div>
            
            <div>
              <p className="text-gray-600">Cache Hits</p>
              <p className="font-semibold text-green-600">{status.stats.cache_hits}</p>
            </div>
            
            <div>
              <p className="text-gray-600">Cache Misses</p>
              <p className="font-semibold text-yellow-600">{status.stats.cache_misses}</p>
            </div>
            
            <div>
              <p className="text-gray-600">Total Retries</p>
              <p className="font-semibold text-orange-600">{status.stats.total_retries}</p>
            </div>
            
            <div>
              <p className="text-gray-600">Memory Pressure Events</p>
              <p className="font-semibold text-red-600">{status.stats.memory_pressure_events}</p>
            </div>
            
            <div>
              <p className="text-gray-600">Max Concurrent Tasks</p>
              <p className="font-semibold">{status.max_concurrent_tasks}</p>
            </div>
          </div>

          {/* Cache Size */}
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-4 h-4 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Cache Size</span>
              </div>
              <span className="text-sm font-medium text-gray-600">
                {memory.cache_memory_mb} MB
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Memory Pressure Warning */}
      {memory.memory_pressure && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
            <span className="text-yellow-800 text-sm">
              Memory pressure detected. Preloading may be limited.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartPreloadMonitor;





