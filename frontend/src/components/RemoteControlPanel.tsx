import React, { useState, useEffect, useCallback } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  VolumeX, 
  Settings, 
  Monitor, 
  Wifi, 
  WifiOff,
  RefreshCw,
  Power,
  Image as ImageIcon,
  Clock,
  Zap,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import { AdminWebSocketClient } from '../services/websocket';
import type { DisplayDevice, Playlist } from '../types';

interface RemoteControlPanelProps {
  device: DisplayDevice;
  playlists?: Playlist[];
  onCommandSent?: (command: string, data?: any) => void;
  onCommandResponse?: (response: any) => void;
  className?: string;
}

interface CommandResponse {
  command: string;
  success: boolean;
  message?: string;
  data?: any;
  timestamp: string;
}

interface DeviceStatus {
  isConnected: boolean;
  currentPlaylist?: Playlist;
  isPlaying: boolean;
  currentImageIndex: number;
  volume: number;
  lastSeen: string;
  error?: string;
}

export const RemoteControlPanel: React.FC<RemoteControlPanelProps> = ({
  device,
  playlists = [],
  onCommandSent,
  onCommandResponse,
  className = ''
}) => {
  const [websocketClient, setWebsocketClient] = useState<AdminWebSocketClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus>({
    isConnected: false,
    isPlaying: false,
    currentImageIndex: 0,
    volume: 50,
    lastSeen: device.last_seen
  });
  const [commandHistory, setCommandHistory] = useState<CommandResponse[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<number | null>(null);
  const [customCommand, setCustomCommand] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Initialize WebSocket connection
  useEffect(() => {
    const initializeWebSocket = async () => {
      try {
        const client = new AdminWebSocketClient();
        
        // Set up event listeners
        client.on('connected', () => {
          console.log('Remote control WebSocket connected');
          setIsConnected(true);
          setError(null);
        });

        client.on('disconnected', () => {
          console.log('Remote control WebSocket disconnected');
          setIsConnected(false);
        });

        client.on('command_response', (message) => {
          console.log('Command response received:', message);
          handleCommandResponse(message);
        });

        client.on('device_status_update', (message) => {
          console.log('Device status update:', message);
          handleDeviceStatusUpdate(message);
        });

        client.on('device_error', (message) => {
          console.log('Device error:', message);
          setError(message.data?.error || 'Device error occurred');
        });

        client.on('error', (error) => {
          console.error('WebSocket error:', error);
          setError('WebSocket connection error');
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

  const handleCommandResponse = useCallback((message: any) => {
    const response: CommandResponse = {
      command: message.data?.command || 'unknown',
      success: message.data?.success || false,
      message: message.data?.message,
      data: message.data?.data,
      timestamp: new Date().toISOString()
    };

    setCommandHistory(prev => [response, ...prev.slice(0, 9)]); // Keep last 10 commands
    onCommandResponse?.(response);

    // Update device status based on response
    if (response.success && response.data) {
      setDeviceStatus(prev => ({
        ...prev,
        ...response.data
      }));
    }
  }, [onCommandResponse]);

  const handleDeviceStatusUpdate = useCallback((message: any) => {
    const { device_id, status, payload } = message;
    
    if (device_id === device.id) {
      setDeviceStatus(prev => ({
        ...prev,
        isConnected: true,
        lastSeen: new Date().toISOString(),
        ...payload
      }));
    }
  }, [device.id]);

  const sendCommand = useCallback(async (command: string, data?: any) => {
    if (!websocketClient || !isConnected) {
      setError('WebSocket not connected');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const success = websocketClient.sendCommand(device.device_token, command, data);
      
      if (success) {
        onCommandSent?.(command, data);
        
        // Add to command history immediately
        const response: CommandResponse = {
          command,
          success: true,
          message: 'Command sent',
          timestamp: new Date().toISOString()
        };
        setCommandHistory(prev => [response, ...prev.slice(0, 9)]);
      } else {
        setError('Failed to send command');
      }

      return success;
    } catch (err) {
      console.error('Failed to send command:', err);
      setError('Failed to send command');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [websocketClient, isConnected, device.device_token, onCommandSent]);

  const handlePlayPause = () => {
    const command = deviceStatus.isPlaying ? 'pause_slideshow' : 'start_slideshow';
    sendCommand(command);
  };

  const handleStop = () => {
    sendCommand('stop_slideshow');
  };

  const handleNextImage = () => {
    sendCommand('next_image');
  };

  const handlePreviousImage = () => {
    sendCommand('previous_image');
  };

  const handleVolumeChange = (volume: number) => {
    sendCommand('set_volume', { volume });
  };

  const handlePlaylistChange = (playlistId: number) => {
    setSelectedPlaylist(playlistId);
    sendCommand('load_playlist', { playlist_id: playlistId });
  };

  const handleCustomCommand = () => {
    if (customCommand.trim()) {
      sendCommand(customCommand);
      setCustomCommand('');
    }
  };

  const handleRefresh = () => {
    sendCommand('refresh_status');
  };

  const handleRefreshBrowser = () => {
    sendCommand('refresh_browser');
  };

  const handleRestart = () => {
    if (window.confirm('Are you sure you want to restart the display?')) {
      sendCommand('restart_display');
    }
  };

  const getConnectionStatus = () => {
    if (isConnected && deviceStatus.isConnected) {
      return { status: 'connected', color: 'text-green-600', icon: Wifi };
    } else if (isConnected) {
      return { status: 'connecting', color: 'text-yellow-600', icon: Wifi };
    } else {
      return { status: 'disconnected', color: 'text-red-600', icon: WifiOff };
    }
  };

  const connectionStatus = getConnectionStatus();
  const StatusIcon = connectionStatus.icon;

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Monitor className="w-6 h-6 text-blue-600" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {device.device_name || `Device ${device.id}`}
            </h3>
            <p className="text-sm text-gray-500">
              {device.device_identifier || device.device_token.substring(0, 12)}...
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <StatusIcon className={`w-5 h-5 ${connectionStatus.color}`} />
          <span className={`text-sm font-medium ${connectionStatus.color}`}>
            {connectionStatus.status}
          </span>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-800 text-sm">{error}</span>
          </div>
        </div>
      )}

      {/* Main Controls */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Play/Pause */}
        <button
          onClick={handlePlayPause}
          disabled={!isConnected || isLoading}
          className="flex flex-col items-center justify-center p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {deviceStatus.isPlaying ? (
            <Pause className="w-6 h-6 mb-2" />
          ) : (
            <Play className="w-6 h-6 mb-2" />
          )}
          <span className="text-sm font-medium">
            {deviceStatus.isPlaying ? 'Pause' : 'Play'}
          </span>
        </button>

        {/* Stop */}
        <button
          onClick={handleStop}
          disabled={!isConnected || isLoading}
          className="flex flex-col items-center justify-center p-4 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Square className="w-6 h-6 mb-2" />
          <span className="text-sm font-medium">Stop</span>
        </button>

        {/* Previous */}
        <button
          onClick={handlePreviousImage}
          disabled={!isConnected || isLoading}
          className="flex flex-col items-center justify-center p-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <SkipBack className="w-6 h-6 mb-2" />
          <span className="text-sm font-medium">Previous</span>
        </button>

        {/* Next */}
        <button
          onClick={handleNextImage}
          disabled={!isConnected || isLoading}
          className="flex flex-col items-center justify-center p-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <SkipForward className="w-6 h-6 mb-2" />
          <span className="text-sm font-medium">Next</span>
        </button>
      </div>

      {/* Playlist Selection */}
      {playlists.length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Playlist
          </label>
          <select
            value={selectedPlaylist || ''}
            onChange={(e) => handlePlaylistChange(Number(e.target.value))}
            disabled={!isConnected || isLoading}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">Select a playlist...</option>
            {playlists.map((playlist) => (
              <option key={playlist.id} value={playlist.id}>
                {playlist.name} ({playlist.image_count} images)
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Volume Control */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Volume: {deviceStatus.volume}%
        </label>
        <div className="flex items-center space-x-3">
          <VolumeX className="w-4 h-4 text-gray-400" />
          <input
            type="range"
            min="0"
            max="100"
            value={deviceStatus.volume}
            onChange={(e) => handleVolumeChange(Number(e.target.value))}
            disabled={!isConnected || isLoading}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
          />
          <Volume2 className="w-4 h-4 text-gray-400" />
        </div>
      </div>

      {/* Advanced Controls */}
      <div className="mb-6">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center space-x-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          <Settings className="w-4 h-4" />
          <span>{showAdvanced ? 'Hide' : 'Show'} Advanced Controls</span>
        </button>

        {showAdvanced && (
          <div className="mt-4 space-y-3">
            {/* Custom Command */}
            <div className="flex space-x-2">
              <input
                type="text"
                value={customCommand}
                onChange={(e) => setCustomCommand(e.target.value)}
                placeholder="Enter custom command..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyPress={(e) => e.key === 'Enter' && handleCustomCommand()}
              />
              <button
                onClick={handleCustomCommand}
                disabled={!isConnected || isLoading || !customCommand.trim()}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>

            {/* Utility Buttons */}
            <div className="flex space-x-2">
              <button
                onClick={handleRefresh}
                disabled={!isConnected || isLoading}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
              
              <button
                onClick={handleRefreshBrowser}
                disabled={!isConnected || isLoading}
                className="flex items-center space-x-2 px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh Browser</span>
              </button>
              
              <button
                onClick={handleRestart}
                disabled={!isConnected || isLoading}
                className="flex items-center space-x-2 px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Power className="w-4 h-4" />
                <span>Restart</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Device Status */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Device Status</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <ImageIcon className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">Image:</span>
            <span className="font-medium">{deviceStatus.currentImageIndex + 1}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600">Last seen:</span>
            <span className="font-medium">
              {new Date(deviceStatus.lastSeen).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>

      {/* Command History */}
      {commandHistory.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Commands</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {commandHistory.map((response, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs"
              >
                <div className="flex items-center space-x-2">
                  {response.success ? (
                    <CheckCircle className="w-3 h-3 text-green-600" />
                  ) : (
                    <XCircle className="w-3 h-3 text-red-600" />
                  )}
                  <span className="font-medium">{response.command}</span>
                  {response.message && (
                    <span className="text-gray-500">- {response.message}</span>
                  )}
                </div>
                <span className="text-gray-400">
                  {new Date(response.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-600">Sending command...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RemoteControlPanel;



