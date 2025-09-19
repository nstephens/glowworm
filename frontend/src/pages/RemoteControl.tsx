import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  ArrowLeft, 
  Monitor, 
  Settings, 
  Code, 
  Grid, 
  List,
  Wifi,
  WifiOff
} from 'lucide-react';
import { RemoteControlPanel } from '../components/RemoteControlPanel';
import { CommandBuilder } from '../components/CommandBuilder';
import { RemoteControlDashboard } from './RemoteControlDashboard';
import type { DisplayDevice, Playlist } from '../types';

interface RemoteControlProps {
  className?: string;
}

export const RemoteControl: React.FC<RemoteControlProps> = ({
  className = ''
}) => {
  const navigate = useNavigate();
  const { deviceId } = useParams<{ deviceId: string }>();
  const [devices, setDevices] = useState<DisplayDevice[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DisplayDevice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'control' | 'builder' | 'dashboard'>('control');
  const [isWebSocketConnected, setIsWebSocketConnected] = useState(false);

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
          
          // If deviceId is provided, find and select that device
          if (deviceId) {
            const device = devicesData.find((d: DisplayDevice) => d.id === parseInt(deviceId));
            if (device) {
              setSelectedDevice(device);
            }
          }
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
  }, [deviceId]);

  const handleDeviceSelect = (device: DisplayDevice) => {
    setSelectedDevice(device);
    setActiveTab('control');
  };

  const handleCommandGenerated = (command: string, data: any) => {
    console.log('Command generated:', command, data);
    // This will be handled by the RemoteControlPanel component
  };

  const handleBackToDashboard = () => {
    navigate('/admin');
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
              onClick={handleBackToDashboard}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </button>
          </div>
          
          {/* WebSocket Status */}
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
            isWebSocketConnected 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              isWebSocketConnected ? 'bg-green-500' : 'bg-red-500'
            }`}></div>
            {isWebSocketConnected ? (
              <>
                <Wifi className="w-4 h-4 mr-1" />
                Connected
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 mr-1" />
                Disconnected
              </>
            )}
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Remote Control</h1>
        <p className="text-gray-600">Control and manage display devices remotely</p>
      </div>

      {/* Device Selection */}
      {!selectedDevice && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Select a Device</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices.map((device) => (
              <div
                key={device.id}
                onClick={() => handleDeviceSelect(device)}
                className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-lg transition-shadow border-2 border-transparent hover:border-blue-500"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <Monitor className="w-6 h-6 text-blue-600" />
                    <div>
                      <h3 className="font-semibold text-gray-900">
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
                
                <div className="text-xs text-gray-500">
                  <p>Created: {new Date(device.created_at).toLocaleDateString()}</p>
                  <p>Last seen: {new Date(device.last_seen).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      {selectedDevice && (
        <div>
          {/* Device Header */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Monitor className="w-6 h-6 text-blue-600" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {selectedDevice.device_name || `Device ${selectedDevice.id}`}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selectedDevice.device_identifier || selectedDevice.device_token.substring(0, 12)}...
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <span className={getStatusBadge(selectedDevice.status)}>
                  {selectedDevice.status}
                </span>
                <button
                  onClick={() => setSelectedDevice(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setActiveTab('control')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === 'control'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                  <span>Control Panel</span>
                </button>
                <button
                  onClick={() => setActiveTab('builder')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === 'builder'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Code className="w-4 h-4" />
                  <span>Command Builder</span>
                </button>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === 'dashboard'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Grid className="w-4 h-4" />
                  <span>Multi-Device Dashboard</span>
                </button>
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          <div className="min-h-96">
            {activeTab === 'control' && (
              <RemoteControlPanel
                device={selectedDevice}
                playlists={playlists}
                onCommandSent={(command, data) => {
                  console.log('Command sent:', command, data);
                }}
                onCommandResponse={(response) => {
                  console.log('Command response:', response);
                }}
              />
            )}

            {activeTab === 'builder' && (
              <CommandBuilder
                onCommandGenerated={handleCommandGenerated}
                onSaveTemplate={(template) => {
                  console.log('Template saved:', template);
                }}
              />
            )}

            {activeTab === 'dashboard' && (
              <RemoteControlDashboard />
            )}
          </div>
        </div>
      )}

      {/* No Devices Message */}
      {devices.length === 0 && (
        <div className="text-center py-12">
          <Monitor className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Devices Found</h3>
          <p className="text-gray-500 mb-6">
            No display devices are currently registered. Devices will appear here once they register.
          </p>
          <button
            onClick={() => navigate('/admin/displays')}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Manage Devices
          </button>
        </div>
      )}
    </div>
  );
};

export default RemoteControl;





