import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wifi, WifiOff, Play, Pause, Settings, RefreshCw, SkipForward, SkipBack, Monitor, Server, Image, Database, Clock, Activity, AlertCircle, Trash2, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { AdminWebSocketClient } from '../services/websocket';
import type { DisplayDevice, DeviceType } from '../types';

interface DeviceStatus {
  id: number;
  device_token: string;
  device_name?: string;
  device_identifier?: string;
  status: 'pending' | 'authorized' | 'rejected' | 'offline';
  authorized_at?: string;
  last_seen: string;
  created_at: string;
  updated_at: string;
  playlist_id?: number;
  playlist_name?: string;
  // Pi3D daemon fields
  device_type?: DeviceType;
  last_state?: string;
  last_image_id?: number;
  last_cache_size_mb?: number;
  last_cache_hit_rate?: number;
  last_cache_entry_count?: number;
  last_uptime_seconds?: number;
}

interface RealtimeDeviceStatus {
  state?: string;
  is_online?: boolean;
  current_image_id?: number;
  current_image_path?: string;
  slideshow?: {
    images_displayed?: number;
    images_skipped?: number;
    transitions_completed?: number;
    errors?: number;
    runtime_seconds?: number;
  };
  playlist?: {
    id?: number;
    name?: string;
    position?: number;
    entry_count?: number;
  };
  cache?: {
    entry_count?: number;
    size_mb?: number;
    max_size_mb?: number;
    hit_rate?: number;
  };
  display?: {
    running?: boolean;
    state?: string;
  };
  uptime_seconds?: number;
  timestamp?: number;
}

const DisplaysWebSocket: React.FC = () => {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<DeviceStatus[]>([]);
  const [pendingDevices, setPendingDevices] = useState<DeviceStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending'>('pending');
  const [websocketClient, setWebsocketClient] = useState<AdminWebSocketClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [connectedDevices, setConnectedDevices] = useState<Set<string>>(new Set());
  const [realtimeStatuses, setRealtimeStatuses] = useState<Map<string, RealtimeDeviceStatus>>(new Map());
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());
  // Command feedback state
  const [pendingCommands, setPendingCommands] = useState<Map<string, string>>(new Map()); // deviceToken -> command
  const [commandFeedback, setCommandFeedback] = useState<{ deviceToken: string; command: string; success: boolean; message?: string } | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const initializeWebSocket = async () => {
      try {
        const client = new AdminWebSocketClient();
        
        // Set up event listeners
        client.on('connected', () => {
          console.log('Admin WebSocket connected');
          setConnectionStatus('connected');
          // Fetch initial device connection status
          fetchDeviceConnectionStatuses();
        });

        client.on('disconnected', () => {
          console.log('Admin WebSocket disconnected');
          setConnectionStatus('disconnected');
        });

        client.on('connecting', () => {
          setConnectionStatus('connecting');
        });

        client.on('device_registered', (message) => {
          console.log('Device registered:', message);
          handleDeviceRegistered(message);
        });

        client.on('device_authorized', (message) => {
          console.log('Device authorized:', message);
          handleDeviceAuthorized(message);
        });

        client.on('device_rejected', (message) => {
          console.log('Device rejected:', message);
          handleDeviceRejected(message);
        });

        client.on('device_updated', (message) => {
          console.log('Device updated:', message);
          handleDeviceUpdated(message);
        });

        client.on('device_deleted', (message) => {
          console.log('Device deleted:', message);
          handleDeviceDeleted(message);
        });

        client.on('device_activity', (message) => {
          console.log('Device activity:', message);
          handleDeviceActivity(message);
        });

        client.on('device_error', (message) => {
          console.log('Device error:', message);
          handleDeviceError(message);
        });

        // Handle real-time device status updates from Pi3D daemons
        client.on('message', (message) => {
          if (message.type === 'device_status_update') {
            handleRealtimeStatusUpdate(message);
          }
        });

        client.on('error', (error) => {
          console.error('WebSocket error:', error);
        });

        setWebsocketClient(client);
        
        // Connect to WebSocket
        await client.connect();
        
      } catch (err) {
        console.error('WebSocket initialization failed:', err);
        setError('Failed to initialize WebSocket connection');
      }
    };

    initializeWebSocket();

    // Cleanup on unmount
    return () => {
      if (websocketClient) {
        websocketClient.disconnect();
      }
    };
  }, []);

  // Fetch all devices
  const fetchDevices = async () => {
    try {
      const response = await fetch('/api/display-devices/admin/devices', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setDevices(data);
        setPendingDevices(data.filter((device: DeviceStatus) => device.status === 'pending'));
        setError(null);
      } else {
        throw new Error('Failed to fetch devices');
      }
    } catch (err) {
      console.error('Failed to fetch devices:', err);
      setError('Failed to load devices');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch real-time device connection status from backend
  const fetchDeviceConnectionStatuses = async () => {
    try {
      const response = await fetch('/api/ws/devices/status', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        // Update connected devices set
        const connected = new Set<string>();
        const statuses = new Map<string, RealtimeDeviceStatus>();

        for (const device of data.devices || []) {
          if (device.is_connected) {
            connected.add(device.device_token);
          }
          if (device.status) {
            statuses.set(device.device_token, device.status);
          }
        }

        setConnectedDevices(connected);
        setRealtimeStatuses(statuses);
      }
    } catch (err) {
      console.error('Failed to fetch device connection statuses:', err);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  const handleDeviceRegistered = useCallback((message: any) => {
    const device = message.data;
    setDevices(prev => {
      const existing = prev.find(d => d.id === device.id);
      if (existing) {
        return prev.map(d => d.id === device.id ? device : d);
      } else {
        return [device, ...prev];
      }
    });
    
    if (device.status === 'pending') {
      setPendingDevices(prev => {
        const existing = prev.find(d => d.id === device.id);
        if (existing) {
          return prev.map(d => d.id === device.id ? device : d);
        } else {
          return [device, ...prev];
        }
      });
    }
  }, []);

  const handleDeviceAuthorized = useCallback((message: any) => {
    const device = message.data.device;
    setDevices(prev => prev.map(d => d.id === device.id ? device : d));
    setPendingDevices(prev => prev.filter(d => d.id !== device.id));
  }, []);

  const handleDeviceRejected = useCallback((message: any) => {
    const device = message.data.device;
    setDevices(prev => prev.map(d => d.id === device.id ? device : d));
    setPendingDevices(prev => prev.filter(d => d.id !== device.id));
  }, []);

  const handleDeviceUpdated = useCallback((message: any) => {
    const device = message.data;
    setDevices(prev => prev.map(d => d.id === device.id ? device : d));
    setPendingDevices(prev => prev.map(d => d.id === device.id ? device : d));
  }, []);

  const handleDeviceDeleted = useCallback((message: any) => {
    const { device_id } = message.data;
    setDevices(prev => prev.filter(d => d.id !== device_id));
    setPendingDevices(prev => prev.filter(d => d.id !== device_id));
  }, []);

  const handleDeviceActivity = useCallback((message: any) => {
    const { device_token, last_seen, status } = message.data;
    setDevices(prev => prev.map(d => 
      d.device_token === device_token 
        ? { ...d, last_seen, status }
        : d
    ));
  }, []);

  const handleDeviceError = useCallback((message: any) => {
    console.error('Device error reported:', message);
    // Could show a notification or update UI to indicate device error
  }, []);

  const handleRealtimeStatusUpdate = useCallback((message: any) => {
    const { device_token, status } = message;
    if (device_token && status) {
      setRealtimeStatuses(prev => {
        const updated = new Map(prev);
        updated.set(device_token, status);
        return updated;
      });
      // Mark device as connected when we receive status updates
      setConnectedDevices(prev => {
        const updated = new Set(prev);
        updated.add(device_token);
        return updated;
      });
    }
  }, []);

  const handleAuthorizeDevice = async (deviceId: number, deviceName?: string, deviceIdentifier?: string) => {
    try {
      const response = await fetch(`/api/display-devices/admin/devices/${deviceId}/authorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          device_name: deviceName,
          device_identifier: deviceIdentifier,
        }),
      });

      if (response.ok) {
        await fetchDevices(); // Refresh the list
        
        // Send WebSocket command if connected
        if (websocketClient && websocketClient.connected) {
          const device = devices.find(d => d.id === deviceId);
          if (device) {
            websocketClient.authorizeDevice(device.device_token, deviceName, deviceIdentifier);
          }
        }
      } else {
        throw new Error('Failed to authorize device');
      }
    } catch (err) {
      console.error('Failed to authorize device:', err);
      setError('Failed to authorize device');
    }
  };

  const handleRejectDevice = async (deviceId: number) => {
    try {
      const response = await fetch(`/api/display-devices/admin/devices/${deviceId}/reject`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        await fetchDevices(); // Refresh the list
        
        // Send WebSocket command if connected
        if (websocketClient && websocketClient.connected) {
          const device = devices.find(d => d.id === deviceId);
          if (device) {
            websocketClient.rejectDevice(device.device_token);
          }
        }
      } else {
        throw new Error('Failed to reject device');
      }
    } catch (err) {
      console.error('Failed to reject device:', err);
      setError('Failed to reject device');
    }
  };

  const handleUpdateDevice = async (deviceId: number, deviceName?: string, deviceIdentifier?: string) => {
    try {
      const response = await fetch(`/api/display-devices/admin/devices/${deviceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          device_name: deviceName,
          device_identifier: deviceIdentifier,
        }),
      });

      if (response.ok) {
        await fetchDevices(); // Refresh the list
      } else {
        throw new Error('Failed to update device');
      }
    } catch (err) {
      console.error('Failed to update device:', err);
      setError('Failed to update device');
    }
  };

  const handleSendCommand = async (deviceId: number, command: string, data?: any) => {
    if (!websocketClient || !websocketClient.connected) {
      setCommandFeedback({ deviceToken: '', command, success: false, message: 'WebSocket not connected' });
      setTimeout(() => setCommandFeedback(null), 3000);
      return;
    }

    const device = devices.find(d => d.id === deviceId);
    if (!device) {
      setCommandFeedback({ deviceToken: '', command, success: false, message: 'Device not found' });
      setTimeout(() => setCommandFeedback(null), 3000);
      return;
    }

    // Set pending state for visual feedback
    setPendingCommands(prev => {
      const updated = new Map(prev);
      updated.set(device.device_token, command);
      return updated;
    });

    // Optimistic UI update for state-changing commands
    if (command === 'pause' && isPi3dDevice(device)) {
      setRealtimeStatuses(prev => {
        const updated = new Map(prev);
        const current = prev.get(device.device_token) || {};
        updated.set(device.device_token, { ...current, state: 'paused' });
        return updated;
      });
    } else if ((command === 'resume' || command === 'play') && isPi3dDevice(device)) {
      setRealtimeStatuses(prev => {
        const updated = new Map(prev);
        const current = prev.get(device.device_token) || {};
        updated.set(device.device_token, { ...current, state: 'playing' });
        return updated;
      });
    }

    const success = websocketClient.sendCommand(device.device_token, command, data);

    // Clear pending state after a delay
    setTimeout(() => {
      setPendingCommands(prev => {
        const updated = new Map(prev);
        updated.delete(device.device_token);
        return updated;
      });
    }, 2000);

    if (!success) {
      setCommandFeedback({ deviceToken: device.device_token, command, success: false, message: 'Failed to send command' });
      setTimeout(() => setCommandFeedback(null), 3000);
    } else {
      // Show brief success feedback
      setCommandFeedback({ deviceToken: device.device_token, command, success: true, message: `${command} sent` });
      setTimeout(() => setCommandFeedback(null), 2000);
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    switch (status) {
      case 'pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'authorized':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'rejected':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'offline':
        return `${baseClasses} bg-gray-100 text-gray-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const getDeviceTypeBadge = (deviceType?: DeviceType) => {
    const type = deviceType || 'browser';
    if (type === 'pi3d') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
          <Server className="w-3 h-3 mr-1" />
          Pi3D
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
        <Monitor className="w-3 h-3 mr-1" />
        Browser
      </span>
    );
  };

  const isPi3dDevice = (device: DeviceStatus) => device.device_type === 'pi3d';

  const getConnectionStatus = (deviceToken: string) => {
    return connectedDevices.has(deviceToken);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Format uptime duration
  const formatUptime = (seconds?: number) => {
    if (!seconds) return null;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Format relative time for last seen
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return formatDate(dateString);
  };

  // Get slideshow state indicator
  const getSlideshowStateIndicator = (state?: string) => {
    if (!state) return null;

    const normalizedState = state.toLowerCase();
    switch (normalizedState) {
      case 'playing':
      case 'transitioning':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
            <Play className="w-3 h-3 mr-1 fill-current" />
            Playing
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
            <Pause className="w-3 h-3 mr-1" />
            Paused
          </span>
        );
      case 'stopped':
      case 'idle':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            Stopped
          </span>
        );
      case 'error':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
            <AlertCircle className="w-3 h-3 mr-1" />
            Error
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
            {state}
          </span>
        );
    }
  };

  // Get connection status indicator with color
  const getConnectionIndicator = (deviceToken: string) => {
    const isConnected = connectedDevices.has(deviceToken);
    if (isConnected) {
      return (
        <span className="inline-flex items-center" title="Online">
          <span className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></span>
          <Wifi className="w-4 h-4 text-green-500" />
        </span>
      );
    }
    return (
      <span className="inline-flex items-center" title="Offline">
        <span className="w-2 h-2 bg-gray-400 rounded-full mr-1"></span>
        <WifiOff className="w-4 h-4 text-gray-400" />
      </span>
    );
  };

  // Get realtime status for a device
  const getRealtimeStatus = (deviceToken: string): RealtimeDeviceStatus | undefined => {
    return realtimeStatuses.get(deviceToken);
  };

  // Get current image ID - prefer realtime status over database record
  const getCurrentImageId = (device: DeviceStatus): number | undefined => {
    const realtimeStatus = getRealtimeStatus(device.device_token);
    return realtimeStatus?.current_image_id || device.last_image_id;
  };

  // Handle image load error
  const handleImageError = (imageId: number) => {
    setImageErrors(prev => {
      const updated = new Set(prev);
      updated.add(imageId);
      return updated;
    });
  };

  // Check if a command is pending for a device
  const isCommandPending = (deviceToken: string, command?: string): boolean => {
    const pending = pendingCommands.get(deviceToken);
    if (!pending) return false;
    if (command) return pending === command;
    return true;
  };

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button 
            onClick={fetchDevices}
            className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const currentDevices = activeTab === 'pending' ? pendingDevices : devices;

  const handleBackToDashboard = () => {
    navigate('/admin');
  };

  return (
    <div className="p-8">
      {/* Command Feedback Toast */}
      {commandFeedback && (
        <div className={`fixed top-4 right-4 z-50 flex items-center px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${
          commandFeedback.success
            ? 'bg-green-100 text-green-800 border border-green-200'
            : 'bg-red-100 text-red-800 border border-red-200'
        }`}>
          {commandFeedback.success ? (
            <CheckCircle className="w-5 h-5 mr-2" />
          ) : (
            <XCircle className="w-5 h-5 mr-2" />
          )}
          <span className="text-sm font-medium">
            {commandFeedback.message || (commandFeedback.success ? 'Command sent' : 'Command failed')}
          </span>
        </div>
      )}

      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
          </div>

          {/* WebSocket Status */}
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
            connectionStatus === 'connected' 
              ? 'bg-green-100 text-green-800' 
              : connectionStatus === 'connecting'
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-red-100 text-red-800'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              connectionStatus === 'connected' 
                ? 'bg-green-500' 
                : connectionStatus === 'connecting'
                ? 'bg-yellow-500 animate-pulse'
                : 'bg-red-500'
            }`}></div>
            WebSocket: {connectionStatus}
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Display Devices</h1>
        <p className="text-gray-600">Manage and authorize display devices with real-time control</p>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'pending'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pending ({pendingDevices.length})
            </button>
            <button
              onClick={() => setActiveTab('all')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'all'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              All Devices ({devices.length})
            </button>
          </nav>
        </div>
      </div>

      {/* Devices List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {currentDevices.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {activeTab === 'pending' ? 'No pending devices' : 'No devices found'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {currentDevices.map((device) => {
              const realtimeStatus = getRealtimeStatus(device.device_token);
              const currentImageId = getCurrentImageId(device);
              const isOnline = connectedDevices.has(device.device_token);
              const effectiveState = realtimeStatus?.state || device.last_state;
              const cacheStats = realtimeStatus?.cache || {
                entry_count: device.last_cache_entry_count,
                size_mb: device.last_cache_size_mb,
                hit_rate: device.last_cache_hit_rate,
              };
              const uptime = realtimeStatus?.uptime_seconds || device.last_uptime_seconds;

              return (
              <li key={device.id} className="px-6 py-4">
                <div className="flex items-start justify-between">
                  {/* Left side: Thumbnail + Info */}
                  <div className="flex items-start space-x-4 flex-1">
                    {/* Current Image Thumbnail (Pi3D devices only) */}
                    {isPi3dDevice(device) && currentImageId && !imageErrors.has(currentImageId) ? (
                      <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                        <img
                          src={`/api/images/${currentImageId}/file?size=small`}
                          alt="Current display"
                          className="w-full h-full object-cover"
                          onError={() => handleImageError(currentImageId)}
                        />
                      </div>
                    ) : isPi3dDevice(device) ? (
                      <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                        <Image className="w-8 h-8 text-gray-400" />
                      </div>
                    ) : null}

                    {/* Device Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">
                          {device.device_name || `Device ${device.id}`}
                        </p>
                        {/* Connection Status Indicator */}
                        {getConnectionIndicator(device.device_token)}
                        {/* Device Type Badge */}
                        {getDeviceTypeBadge(device.device_type)}
                        {/* Slideshow State Indicator (Pi3D only) */}
                        {isPi3dDevice(device) && isOnline && getSlideshowStateIndicator(effectiveState)}
                        {/* Authorization Status Badge */}
                        <span className={getStatusBadge(device.status)}>
                          {device.status}
                        </span>
                      </div>

                      <p className="text-sm text-gray-500 mt-1">
                        Token: {device.device_token.substring(0, 12)}...
                        {device.device_identifier && <> | ID: {device.device_identifier}</>}
                      </p>

                      {/* Pi3D Extended Status */}
                      {isPi3dDevice(device) && (
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          {/* Cache Stats */}
                          {(cacheStats.size_mb !== undefined || cacheStats.entry_count !== undefined) && (
                            <span className="inline-flex items-center" title="Cache statistics">
                              <Database className="w-3 h-3 mr-1" />
                              {cacheStats.entry_count !== undefined && <>{cacheStats.entry_count} images</>}
                              {cacheStats.size_mb !== undefined && <> ({cacheStats.size_mb.toFixed(1)} MB)</>}
                              {cacheStats.hit_rate !== undefined && <> | {(cacheStats.hit_rate * 100).toFixed(0)}% hit</>}
                            </span>
                          )}
                          {/* Uptime */}
                          {uptime !== undefined && (
                            <span className="inline-flex items-center" title="Daemon uptime">
                              <Clock className="w-3 h-3 mr-1" />
                              Uptime: {formatUptime(uptime)}
                            </span>
                          )}
                          {/* Slideshow stats */}
                          {realtimeStatus?.slideshow?.images_displayed !== undefined && (
                            <span className="inline-flex items-center" title="Images displayed this session">
                              <Activity className="w-3 h-3 mr-1" />
                              {realtimeStatus.slideshow.images_displayed} displayed
                              {(realtimeStatus.slideshow.errors || 0) > 0 && (
                                <span className="text-red-500 ml-1">
                                  ({realtimeStatus.slideshow.errors} errors)
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Last seen / timestamps */}
                      <div className="mt-2 text-xs text-gray-400">
                        {!isOnline && (
                          <p className="text-orange-500">
                            Last seen: {formatRelativeTime(device.last_seen)}
                          </p>
                        )}
                        {isOnline && (
                          <p className="text-green-600">Online now</p>
                        )}
                        {device.playlist_name && (
                          <p>Playlist: {device.playlist_name}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {device.status === 'pending' && (
                      <>
                        <button
                          onClick={() => {
                            const deviceTypeLabel = isPi3dDevice(device) ? 'Pi3D daemon' : 'browser';
                            const confirmMsg = `Authorize this ${deviceTypeLabel} device?`;
                            if (window.confirm(confirmMsg)) {
                              const name = prompt('Enter device name (optional):');
                              const identifier = prompt('Enter device identifier (optional):');
                              handleAuthorizeDevice(device.id, name || undefined, identifier || undefined);
                            }
                          }}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                        >
                          Authorize
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to reject this device?')) {
                              handleRejectDevice(device.id);
                            }
                          }}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    
                    {device.status === 'authorized' && (
                      <>
                        <button
                          onClick={() => {
                            const name = prompt('Enter device name:', device.device_name || '');
                            const identifier = prompt('Enter device identifier:', device.device_identifier || '');
                            if (name !== null || identifier !== null) {
                              handleUpdateDevice(device.id, name || undefined, identifier || undefined);
                            }
                          }}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                        >
                          Edit
                        </button>

                        {/* Real-time Commands */}
                        {isOnline && (
                          <div className="flex items-center space-x-1">
                            {/* Pi3D specific controls: next/previous */}
                            {isPi3dDevice(device) && (
                              <>
                                <button
                                  onClick={() => handleSendCommand(device.id, 'previous')}
                                  disabled={isCommandPending(device.device_token)}
                                  className="bg-gray-600 text-white p-1 rounded text-sm hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Previous Image"
                                >
                                  {isCommandPending(device.device_token, 'previous') ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <SkipBack className="w-4 h-4" />
                                  )}
                                </button>
                                <button
                                  onClick={() => handleSendCommand(device.id, 'next')}
                                  disabled={isCommandPending(device.device_token)}
                                  className="bg-gray-600 text-white p-1 rounded text-sm hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Next Image"
                                >
                                  {isCommandPending(device.device_token, 'next') ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <SkipForward className="w-4 h-4" />
                                  )}
                                </button>
                              </>
                            )}
                            {/* Common controls: play/pause */}
                            <button
                              onClick={() => handleSendCommand(device.id, isPi3dDevice(device) ? 'resume' : 'start_slideshow')}
                              disabled={isCommandPending(device.device_token)}
                              className="bg-green-600 text-white p-1 rounded text-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={isPi3dDevice(device) ? "Resume Slideshow" : "Start Slideshow"}
                            >
                              {isCommandPending(device.device_token, 'resume') || isCommandPending(device.device_token, 'start_slideshow') ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleSendCommand(device.id, isPi3dDevice(device) ? 'pause' : 'stop_slideshow')}
                              disabled={isCommandPending(device.device_token)}
                              className="bg-red-600 text-white p-1 rounded text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={isPi3dDevice(device) ? "Pause Slideshow" : "Stop Slideshow"}
                            >
                              {isCommandPending(device.device_token, 'pause') || isCommandPending(device.device_token, 'stop_slideshow') ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Pause className="w-4 h-4" />
                              )}
                            </button>
                            <button
                              onClick={() => handleSendCommand(device.id, 'reload_playlist')}
                              disabled={isCommandPending(device.device_token)}
                              className="bg-blue-600 text-white p-1 rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Reload Playlist"
                            >
                              {isCommandPending(device.device_token, 'reload_playlist') ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RefreshCw className="w-4 h-4" />
                              )}
                            </button>
                            {/* Pi3D-only: Clear Cache */}
                            {isPi3dDevice(device) && (
                              <button
                                onClick={() => {
                                  if (window.confirm('Clear the device image cache? Images will need to be re-downloaded.')) {
                                    handleSendCommand(device.id, 'clear_cache');
                                  }
                                }}
                                disabled={isCommandPending(device.device_token)}
                                className="bg-orange-600 text-white p-1 rounded text-sm hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Clear Cache"
                              >
                                {isCommandPending(device.device_token, 'clear_cache') ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            )}
                            {/* Browser-only: Refresh Browser */}
                            {!isPi3dDevice(device) && (
                              <button
                                onClick={() => handleSendCommand(device.id, 'refresh_browser')}
                                disabled={isCommandPending(device.device_token)}
                                className="bg-orange-600 text-white p-1 rounded text-sm hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Refresh Browser"
                              >
                                {isCommandPending(device.device_token, 'refresh_browser') ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-4 h-4" />
                                )}
                              </button>
                            )}
                          </div>
                        )}
                        {/* Offline indicator with disabled buttons */}
                        {!isOnline && device.status === 'authorized' && (
                          <span className="text-xs text-gray-500 italic">Device offline</span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Refresh Button */}
      <div className="mt-6">
        <button
          onClick={fetchDevices}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>
    </div>
  );
};

export default DisplaysWebSocket;
