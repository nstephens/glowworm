import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Wifi, WifiOff, Play, Pause, Settings, RefreshCw } from 'lucide-react';
import { AdminWebSocketClient } from '../services/websocket';
import type { DisplayDevice } from '../types';

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

  // Initialize WebSocket connection
  useEffect(() => {
    const initializeWebSocket = async () => {
      try {
        const client = new AdminWebSocketClient();
        
        // Set up event listeners
        client.on('connected', () => {
          console.log('Admin WebSocket connected');
          setConnectionStatus('connected');
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
      setError('WebSocket not connected');
      return;
    }

    const device = devices.find(d => d.id === deviceId);
    if (!device) {
      setError('Device not found');
      return;
    }

    const success = websocketClient.sendCommand(device.device_token, command, data);
    if (!success) {
      setError('Failed to send command');
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

  const getConnectionStatus = (deviceToken: string) => {
    return connectedDevices.has(deviceToken);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
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
            {currentDevices.map((device) => (
              <li key={device.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <p className="text-sm font-medium text-gray-900">
                            {device.device_name || `Device ${device.id}`}
                          </p>
                          {/* Connection Status */}
                          <div className="flex items-center">
                            {getConnectionStatus(device.device_token) ? (
                              <Wifi className="w-4 h-4 text-green-500" title="Connected" />
                            ) : (
                              <WifiOff className="w-4 h-4 text-gray-400" title="Offline" />
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-gray-500">
                          Token: {device.device_token.substring(0, 12)}...
                        </p>
                        {device.device_identifier && (
                          <p className="text-sm text-gray-500">
                            ID: {device.device_identifier}
                          </p>
                        )}
                      </div>
                      <span className={getStatusBadge(device.status)}>
                        {device.status}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      <p>Created: {formatDate(device.created_at)}</p>
                      <p>Last seen: {formatDate(device.last_seen)}</p>
                      {device.authorized_at && (
                        <p>Authorized: {formatDate(device.authorized_at)}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {device.status === 'pending' && (
                      <>
                        <button
                          onClick={() => {
                            const name = prompt('Enter device name (optional):');
                            const identifier = prompt('Enter device identifier (optional):');
                            if (name !== null || identifier !== null) {
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
                        {getConnectionStatus(device.device_token) && (
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleSendCommand(device.id, 'start_slideshow')}
                              className="bg-green-600 text-white p-1 rounded text-sm hover:bg-green-700"
                              title="Start Slideshow"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleSendCommand(device.id, 'stop_slideshow')}
                              className="bg-red-600 text-white p-1 rounded text-sm hover:bg-red-700"
                              title="Stop Slideshow"
                            >
                              <Pause className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleSendCommand(device.id, 'reload_playlist')}
                              className="bg-blue-600 text-white p-1 rounded text-sm hover:bg-blue-700"
                              title="Reload Playlist"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleSendCommand(device.id, 'refresh_browser')}
                              className="bg-orange-600 text-white p-1 rounded text-sm hover:bg-orange-700"
                              title="Refresh Browser"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
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
