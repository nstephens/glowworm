import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Monitor, 
  Wifi, 
  WifiOff, 
  Settings, 
  Grid, 
  List, 
  Search,
  Filter,
  RefreshCw,
  Plus,
  Trash2,
  Edit,
  Play,
  Pause,
  Square
} from 'lucide-react';
import { RemoteControlPanel } from '../components/RemoteControlPanel';
import { AdminWebSocketClient } from '../services/websocket';
import type { DisplayDevice, Playlist } from '../types';

interface RemoteControlDashboardProps {
  className?: string;
}

interface DeviceGroup {
  id: string;
  name: string;
  deviceIds: number[];
  color: string;
}

export const RemoteControlDashboard: React.FC<RemoteControlDashboardProps> = ({
  className = ''
}) => {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<DisplayDevice[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [websocketClient, setWebsocketClient] = useState<AdminWebSocketClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'authorized' | 'pending' | 'offline'>('all');
  const [deviceGroups, setDeviceGroups] = useState<DeviceGroup[]>([]);
  const [showGroupManager, setShowGroupManager] = useState(false);
  const [bulkCommand, setBulkCommand] = useState('');
  const [showBulkControls, setShowBulkControls] = useState(false);

  // Initialize WebSocket connection
  useEffect(() => {
    const initializeWebSocket = async () => {
      try {
        const client = new AdminWebSocketClient();
        
        client.on('connected', () => {
          console.log('Remote control dashboard WebSocket connected');
          setIsConnected(true);
          setError(null);
        });

        client.on('disconnected', () => {
          console.log('Remote control dashboard WebSocket disconnected');
          setIsConnected(false);
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

        client.on('error', (error) => {
          console.error('WebSocket error:', error);
          setError('WebSocket connection error');
        });

        setWebsocketClient(client);
        await client.connect();
        
      } catch (err) {
        console.error('WebSocket initialization failed:', err);
        setError('Failed to initialize WebSocket connection');
      }
    };

    initializeWebSocket();

    return () => {
      if (websocketClient) {
        websocketClient.disconnect();
      }
    };
  }, []);

  // Fetch devices and playlists
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [devicesResponse, playlistsResponse] = await Promise.all([
          fetch('/api/display-devices/admin/devices', { credentials: 'include' }),
          fetch('/api/playlists', { credentials: 'include' })
        ]);

        if (devicesResponse.ok) {
          const devicesData = await devicesResponse.json();
          setDevices(devicesData);
        }

        if (playlistsResponse.ok) {
          const playlistsData = await playlistsResponse.json();
          setPlaylists(playlistsData);
        }

        setError(null);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError('Failed to load devices and playlists');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // WebSocket event handlers
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
  }, []);

  const handleDeviceAuthorized = useCallback((message: any) => {
    const device = message.data.device;
    setDevices(prev => prev.map(d => d.id === device.id ? device : d));
  }, []);

  const handleDeviceRejected = useCallback((message: any) => {
    const device = message.data.device;
    setDevices(prev => prev.map(d => d.id === device.id ? device : d));
  }, []);

  const handleDeviceUpdated = useCallback((message: any) => {
    const device = message.data;
    setDevices(prev => prev.map(d => d.id === device.id ? device : d));
  }, []);

  const handleDeviceDeleted = useCallback((message: any) => {
    const { device_id } = message.data;
    setDevices(prev => prev.filter(d => d.id !== device_id));
    setSelectedDevices(prev => {
      const newSet = new Set(prev);
      newSet.delete(device_id);
      return newSet;
    });
  }, []);

  const handleDeviceActivity = useCallback((message: any) => {
    const { device_token, last_seen, status } = message.data;
    setDevices(prev => prev.map(d => 
      d.device_token === device_token 
        ? { ...d, last_seen, status }
        : d
    ));
  }, []);

  // Device selection handlers
  const handleDeviceSelect = (deviceId: number) => {
    setSelectedDevices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(deviceId)) {
        newSet.delete(deviceId);
      } else {
        newSet.add(deviceId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const filteredDevices = getFilteredDevices();
    setSelectedDevices(new Set(filteredDevices.map(d => d.id)));
  };

  const handleDeselectAll = () => {
    setSelectedDevices(new Set());
  };

  // Bulk command handlers
  const handleBulkCommand = async (command: string, data?: any) => {
    if (!websocketClient || !isConnected) {
      setError('WebSocket not connected');
      return;
    }

    const promises = Array.from(selectedDevices).map(deviceId => {
      const device = devices.find(d => d.id === deviceId);
      if (device) {
        return websocketClient.sendCommand(device.device_token, command, data);
      }
      return false;
    });

    try {
      const results = await Promise.all(promises);
      const successCount = results.filter(r => r).length;
      console.log(`Bulk command sent to ${successCount}/${selectedDevices.size} devices`);
    } catch (err) {
      console.error('Bulk command failed:', err);
      setError('Failed to send bulk command');
    }
  };

  // Filter devices
  const getFilteredDevices = () => {
    return devices.filter(device => {
      const matchesSearch = !searchTerm || 
        device.device_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.device_identifier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.device_token.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || device.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  };

  const filteredDevices = getFilteredDevices();

  // Group management
  const createGroup = (name: string, deviceIds: number[]) => {
    const newGroup: DeviceGroup = {
      id: Date.now().toString(),
      name,
      deviceIds,
      color: `hsl(${Math.random() * 360}, 70%, 50%)`
    };
    setDeviceGroups(prev => [...prev, newGroup]);
  };

  const deleteGroup = (groupId: string) => {
    setDeviceGroups(prev => prev.filter(g => g.id !== groupId));
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
            onClick={() => window.location.reload()}
            className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-8 ${className}`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/admin')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </button>
          </div>
          
          {/* WebSocket Status */}
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
            isConnected 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            WebSocket: {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Remote Control Dashboard</h1>
        <p className="text-gray-600">Control and manage multiple display devices in real-time</p>
      </div>

      {/* Controls Bar */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Search and Filters */}
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search devices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="authorized">Authorized</option>
              <option value="pending">Pending</option>
              <option value="offline">Offline</option>
            </select>
          </div>

          {/* View Controls */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-400'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-400'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Bulk Controls */}
          {selectedDevices.size > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                {selectedDevices.size} selected
              </span>
              <button
                onClick={() => setShowBulkControls(!showBulkControls)}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              >
                Bulk Actions
              </button>
            </div>
          )}
        </div>

        {/* Bulk Controls Panel */}
        {showBulkControls && selectedDevices.size > 0 && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleBulkCommand('start_slideshow')}
                  className="flex items-center space-x-1 px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                >
                  <Play className="w-4 h-4" />
                  <span>Start All</span>
                </button>
                <button
                  onClick={() => handleBulkCommand('pause_slideshow')}
                  className="flex items-center space-x-1 px-3 py-1 bg-yellow-600 text-white rounded text-sm hover:bg-yellow-700"
                >
                  <Pause className="w-4 h-4" />
                  <span>Pause All</span>
                </button>
                <button
                  onClick={() => handleBulkCommand('stop_slideshow')}
                  className="flex items-center space-x-1 px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                >
                  <Square className="w-4 h-4" />
                  <span>Stop All</span>
                </button>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={bulkCommand}
                  onChange={(e) => setBulkCommand(e.target.value)}
                  placeholder="Custom command..."
                  className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={() => {
                    if (bulkCommand.trim()) {
                      handleBulkCommand(bulkCommand);
                      setBulkCommand('');
                    }
                  }}
                  className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Device Grid/List */}
      {filteredDevices.length === 0 ? (
        <div className="text-center py-12">
          <Monitor className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No devices found</p>
        </div>
      ) : (
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' 
          : 'space-y-4'
        }>
          {filteredDevices.map((device) => (
            <div
              key={device.id}
              className={`bg-white rounded-lg shadow ${
                selectedDevices.has(device.id) ? 'ring-2 ring-blue-500' : ''
              }`}
            >
              {viewMode === 'grid' ? (
                <RemoteControlPanel
                  device={device}
                  playlists={playlists}
                  className="h-full"
                />
              ) : (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedDevices.has(device.id)}
                        onChange={() => handleDeviceSelect(device.id)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {device.device_name || `Device ${device.id}`}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {device.device_identifier || device.device_token.substring(0, 12)}...
                        </p>
                      </div>
                    </div>
                    <span className={getStatusBadge(device.status)}>
                      {device.status}
                    </span>
                  </div>
                  
                  <RemoteControlPanel
                    device={device}
                    playlists={playlists}
                    className="border-t pt-4"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Device Groups */}
      {deviceGroups.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Device Groups</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {deviceGroups.map((group) => (
              <div key={group.id} className="bg-white rounded-lg shadow p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">{group.name}</h3>
                  <button
                    onClick={() => deleteGroup(group.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  {group.deviceIds.length} devices
                </p>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setSelectedDevices(new Set(group.deviceIds))}
                    className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                  >
                    Select Group
                  </button>
                  <button
                    onClick={() => {
                      setSelectedDevices(new Set(group.deviceIds));
                      handleBulkCommand('start_slideshow');
                    }}
                    className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
                  >
                    Start Group
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RemoteControlDashboard;




