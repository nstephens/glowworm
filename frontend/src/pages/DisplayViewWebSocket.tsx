import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { urlResolver } from '../services/urlResolver';
import { FullscreenSlideshow } from '../components/FullscreenSlideshow';
import { DeviceWebSocketClient } from '../services/websocket';
import { apiService } from '../services/api';
import type { Image, Playlist } from '../types';

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

const DisplayViewWebSocket: React.FC = () => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
  const [playlistImages, setPlaylistImages] = useState<Image[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [showSlideshow, setShowSlideshow] = useState(false);
  const [websocketClient, setWebsocketClient] = useState<DeviceWebSocketClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [slideshowSettings, setSlideshowSettings] = useState({
    autoPlay: true,
    interval: 5,
    transition: 'fade' as const,
    showControls: true,
    showInfo: true,
    shuffle: false,
    loop: true,
  });

  // Check existing device status or register new device on first load
  useEffect(() => {
    const initializeDevice = async () => {
      try {
        // First, try to check if device is already registered
        const statusResponse = await fetch(urlResolver.getApiUrl('/display-devices/status'), {
          credentials: 'include',
        });

        if (statusResponse.ok) {
          // Device is already registered, get its status
          const data = await statusResponse.json();
          setDeviceStatus(data);
          setIsRegistered(true);
          console.log('Device status retrieved:', data);
          console.log('Setting isRegistered to true, periodic check should start...');
          setIsLoading(false);
          return;
        } else if (statusResponse.status === 401) {
          // Device not registered, proceed to register
          console.log('No existing device found, registering new device...');
        } else {
          throw new Error('Failed to check device status');
        }

        // Register new device
        const registerResponse = await fetch(urlResolver.getApiUrl('/display-devices/register'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_agent: navigator.userAgent,
            device_identifier: deviceId,
          }),
          credentials: 'include',
        });

        if (registerResponse.ok) {
          const data = await registerResponse.json();
          setDeviceStatus(data);
          setIsRegistered(true);
          console.log('Device registered:', data);
        } else {
          throw new Error('Failed to register device');
        }
      } catch (err) {
        console.error('Device initialization failed:', err);
        setError('Failed to initialize device');
      } finally {
        setIsLoading(false);
      }
    };

    initializeDevice();
  }, [deviceId]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!isRegistered) return;

    const initializeWebSocket = async () => {
      try {
        // Get device token from cookie (this would need to be implemented)
        const deviceToken = getDeviceTokenFromCookie();
        if (!deviceToken) {
          throw new Error('Device token not found');
        }

        const client = new DeviceWebSocketClient(deviceToken);
        
        // Set up event listeners
        client.on('connected', () => {
          console.log('WebSocket connected');
          setConnectionStatus('connected');
        });

        client.on('disconnected', () => {
          console.log('WebSocket disconnected');
          setConnectionStatus('disconnected');
        });

        client.on('connecting', () => {
          setConnectionStatus('connecting');
        });

        client.on('authorization_update', (message: any) => {
          console.log('Authorization update received:', message);
          handleAuthorizationUpdate(message);
        });

        client.on('command', (message: any) => {
          console.log('Command received:', message);
          handleCommand(message);
        });

        client.on('playlist_update', (message: any) => {
          console.log('Playlist update received:', message);
          handlePlaylistUpdate(message);
        });

        client.on('error', (error: any) => {
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
  }, [isRegistered]);

  // Check device status and load playlist
  useEffect(() => {
    if (!isRegistered) {
      console.log('Periodic status check: device not registered, skipping');
      return;
    }

    console.log('Periodic status check: device is registered, starting check...');

    const checkStatusAndLoadPlaylist = async () => {
      try {
        // Check device status
        const statusResponse = await fetch(urlResolver.getApiUrl('/display-devices/status'), {
          credentials: 'include',
        });

        if (statusResponse.ok) {
          const deviceData = await statusResponse.json();
          setDeviceStatus(deviceData);
          setError(null);

          // If device is authorized, load the current playlist
          if (deviceData.status === 'authorized' && deviceData.playlist_id) {
            console.log('Device is authorized with playlist_id:', deviceData.playlist_id, 'loading playlist...');
            await loadPlaylistAndImages(deviceData.playlist_id);
          } else {
            console.log('Device not authorized or no playlist:', {
              status: deviceData.status,
              playlist_id: deviceData.playlist_id
            });
          }
        } else if (statusResponse.status === 401) {
          setIsRegistered(false);
        } else {
          throw new Error('Failed to get device status');
        }
      } catch (err) {
        console.error('Status check failed:', err);
        setError('Failed to check device status');
      } finally {
        setIsLoading(false);
      }
    };

    // Check immediately
    checkStatusAndLoadPlaylist();

    // Check every 30 seconds
    const interval = setInterval(checkStatusAndLoadPlaylist, 30000);

    return () => clearInterval(interval);
  }, [isRegistered]);

  const getDeviceTokenFromCookie = (): string | null => {
    // This would need to be implemented to read the device token from cookies
    // For now, we'll return null and handle the error
    return null;
  };

  const loadPlaylistAndImages = async (playlistId: number) => {
    try {
      console.log('Loading playlist and images for playlist ID:', playlistId);
      
      // Load playlist details
      const playlistResponse = await apiService.getPlaylists();
      const playlists = playlistResponse.data || [];
      console.log('Available playlists:', playlists.map(p => ({ id: p.id, name: p.name })));
      
      const playlist = playlists.find(p => p.id === playlistId);
      console.log('Found playlist:', playlist);
      
      if (playlist) {
        setCurrentPlaylist(playlist);
        console.log('Set current playlist:', playlist.name);
        
        // Load images for the playlist
        const imagesResponse = await apiService.getImages(undefined, playlistId);
        const images = imagesResponse.data || [];
        console.log('Loaded images for playlist:', images.length, 'images');
        
        // Sort images by playlist sequence if available
        if (playlist.sequence && Array.isArray(playlist.sequence)) {
          const sortedImages = images.sort((a, b) => {
            const aIndex = playlist.sequence!.indexOf(a.id);
            const bIndex = playlist.sequence!.indexOf(b.id);
            if (aIndex === -1 && bIndex === -1) return 0;
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
          });
          setPlaylistImages(sortedImages);
          console.log('Set sorted playlist images:', sortedImages.length);
        } else {
          setPlaylistImages(images);
          console.log('Set playlist images:', images.length);
        }
      } else {
        console.error('Playlist not found for ID:', playlistId);
      }
    } catch (err) {
      console.error('Failed to load playlist:', err);
    }
  };

  const handleAuthorizationUpdate = useCallback((message: any) => {
    const { status, data } = message;
    
    if (status === 'authorized') {
      setDeviceStatus(prev => prev ? { ...prev, status: 'authorized' } : null);
      // Load playlist if provided
      if (data.playlist_id) {
        loadPlaylistAndImages(data.playlist_id);
      }
    } else if (status === 'rejected') {
      setDeviceStatus(prev => prev ? { ...prev, status: 'rejected' } : null);
    }
  }, []);

  const handleCommand = useCallback((message: any) => {
    const { command, data } = message;
    
    switch (command) {
      case 'start_slideshow':
        if (playlistImages.length > 0) {
          setShowSlideshow(true);
        }
        break;
        
      case 'stop_slideshow':
        setShowSlideshow(false);
        break;
        
      case 'update_settings':
        setSlideshowSettings(prev => ({ ...prev, ...data }));
        break;
        
      case 'reload_playlist':
        if (currentPlaylist) {
          loadPlaylistAndImages(currentPlaylist.id);
        }
        break;
        
      case 'refresh_browser':
        console.log('🔄 REFRESH: Received refresh command from admin');
        window.location.reload();
        break;
        
      default:
        console.log('Unknown command:', command);
    }
  }, [playlistImages.length, currentPlaylist]);

  const handlePlaylistUpdate = useCallback((message: any) => {
    console.log('=== PLAYLIST UPDATE HANDLER START ===');
    console.log('Handling playlist update:', message);
    console.log('Message has playlist property:', !!message.playlist);
    console.log('Current playlist ID:', currentPlaylist?.id);
    console.log('Current slideshow interval:', slideshowSettings.interval);
    
    // Handle new playlist update format
    if (message.playlist) {
      const playlist = message.playlist;
      console.log('Playlist ID from message:', playlist.id);
      console.log('Playlist display_time_seconds:', playlist.display_time_seconds);
      
      // Update current playlist if it's the same one we're displaying
      if (currentPlaylist && currentPlaylist.id === playlist.id) {
        console.log('✅ Updating current playlist with new data:', playlist);
        setCurrentPlaylist(playlist);
        
        // Update slideshow settings if display time changed
        if (playlist.display_time_seconds && playlist.display_time_seconds !== slideshowSettings.interval) {
          console.log('🔄 Updating slideshow interval from', slideshowSettings.interval, 'to', playlist.display_time_seconds);
          setSlideshowSettings(prev => ({
            ...prev,
            interval: playlist.display_time_seconds
          }));
        } else {
          console.log('❌ No interval update needed - same interval or no display_time_seconds');
        }
        
        // Reload playlist images to get updated sequence
        loadPlaylistAndImages(playlist.id);
      } else {
        console.log('❌ Not updating - different playlist or no current playlist');
        console.log('Current playlist ID:', currentPlaylist?.id, 'Message playlist ID:', playlist.id);
      }
    } else {
      console.log('❌ No playlist property in message');
    }
    // Handle legacy format for backward compatibility
    if (message.data && message.data.playlist_id) {
      loadPlaylistAndImages(message.data.playlist_id);
    }
    console.log('=== PLAYLIST UPDATE HANDLER END ===');
  }, [currentPlaylist, slideshowSettings.interval]);

  const startSlideshow = useCallback(() => {
    if (playlistImages.length > 0) {
      setShowSlideshow(true);
      
      // Send status update to server
      if (websocketClient) {
        websocketClient.sendStatusUpdate({
          slideshow_active: true,
          current_playlist: currentPlaylist?.id,
          image_count: playlistImages.length
        });
      }
    }
  }, [playlistImages.length, currentPlaylist, websocketClient]);

  // Auto-start slideshow when playlist images are loaded and device is authorized
  useEffect(() => {
    console.log('Auto-start useEffect triggered:', {
      deviceStatus: deviceStatus?.status,
      playlistImagesLength: playlistImages.length,
      showSlideshow,
      autoPlay: slideshowSettings.autoPlay
    });
    
    if (deviceStatus?.status === 'authorized' && 
        playlistImages.length > 0 && 
        !showSlideshow && 
        slideshowSettings.autoPlay) {
      console.log('Auto-starting slideshow with', playlistImages.length, 'images');
      startSlideshow();
    }
  }, [deviceStatus?.status, playlistImages.length, showSlideshow, slideshowSettings.autoPlay, startSlideshow]);

  const stopSlideshow = useCallback(() => {
    setShowSlideshow(false);
    
    // Send status update to server
    if (websocketClient) {
      websocketClient.sendStatusUpdate({
        slideshow_active: false,
        current_playlist: currentPlaylist?.id
      });
    }
  }, [currentPlaylist, websocketClient]);

  const handleImageChange = useCallback((image: Image, index: number) => {
    console.log('Slideshow showing image:', image.original_filename, 'at index:', index);
    
    // Send status update to server
    if (websocketClient) {
      websocketClient.sendStatusUpdate({
        slideshow_active: true,
        current_image: image.id,
        current_image_index: index,
        current_playlist: currentPlaylist?.id
      });
    }
  }, [currentPlaylist, websocketClient]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold mb-4">GlowWorm Display</h1>
          <p className="text-xl mb-8">Initializing...</p>
          <div className="animate-pulse">
            <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full mx-auto"></div>
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold mb-4">GlowWorm Display</h1>
          <p className="text-xl mb-8 text-red-400">Error: {error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-white text-black px-6 py-2 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Retry
          </button>
        </div>
      );
    }

    if (!deviceStatus) {
      return (
        <div className="text-center text-white">
          <h1 className="text-4xl font-bold mb-4">GlowWorm Display</h1>
          <p className="text-xl mb-8">Loading device status...</p>
          <div className="animate-pulse">
            <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full mx-auto"></div>
          </div>
        </div>
      );
    }

    switch (deviceStatus.status) {
      case 'pending':
        return (
          <div className="text-center text-white">
            <h1 className="text-4xl font-bold mb-4">GlowWorm Display</h1>
            <p className="text-xl mb-8">Waiting for authorization...</p>
            <div className="animate-pulse">
              <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full mx-auto"></div>
            </div>
            <p className="text-sm mt-4 opacity-75">
              Please authorize this device from the admin panel
            </p>
            <div className="mt-8 text-xs opacity-50">
              <p>Device ID: {deviceStatus.id}</p>
              <p>Token: {deviceStatus.device_token.substring(0, 8)}...</p>
            </div>
            <div className="mt-4">
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
          </div>
        );

      case 'authorized':
        return (
          <div className="text-center text-white">
            <h1 className="text-4xl font-bold mb-4">GlowWorm Display</h1>
            <p className="text-xl mb-8 text-green-400">✓ Device Authorized</p>
            
            {deviceStatus.device_name && (
              <p className="text-lg mb-4">Name: {deviceStatus.device_name}</p>
            )}
            {deviceStatus.device_identifier && (
              <p className="text-lg mb-4">ID: {deviceStatus.device_identifier}</p>
            )}
            
            {currentPlaylist && (
              <div className="mb-6">
                <p className="text-lg mb-2">Current Playlist: {currentPlaylist.name}</p>
                <p className="text-sm text-gray-300">
                  {playlistImages.length} images ready
                </p>
              </div>
            )}
            
            <div className="mb-4">
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
            
            {playlistImages.length > 0 ? (
              <div className="space-y-4">
                <p className="text-sm opacity-75">
                  Ready to display slideshow
                </p>
                <button
                  onClick={startSlideshow}
                  className="bg-green-600 text-white px-8 py-3 rounded-lg hover:bg-green-700 transition-colors text-lg font-semibold"
                >
                  Start Slideshow
                </button>
                <p className="text-xs opacity-50">
                  Press any key or click to start
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm opacity-75">
                  No images available in current playlist
                </p>
                <p className="text-xs opacity-50">
                  Please add images to the playlist from the admin panel
                </p>
              </div>
            )}
            
            <div className="mt-8 text-xs opacity-50">
              <p>Authorized: {new Date(deviceStatus.authorized_at!).toLocaleString()}</p>
              <p>Last seen: {new Date(deviceStatus.last_seen).toLocaleString()}</p>
            </div>
          </div>
        );

      case 'rejected':
        return (
          <div className="text-center text-white">
            <h1 className="text-4xl font-bold mb-4">GlowWorm Display</h1>
            <p className="text-xl mb-8 text-red-400">✗ Device Rejected</p>
            <p className="text-sm opacity-75">
              This device has been rejected by an administrator
            </p>
            <div className="mt-8 text-xs opacity-50">
              <p>Device ID: {deviceStatus.id}</p>
              <p>Rejected: {new Date(deviceStatus.authorized_at!).toLocaleString()}</p>
            </div>
          </div>
        );

      case 'offline':
        return (
          <div className="text-center text-white">
            <h1 className="text-4xl font-bold mb-4">GlowWorm Display</h1>
            <p className="text-xl mb-8 text-yellow-400">Device Offline</p>
            <p className="text-sm opacity-75">
              Connection lost. Attempting to reconnect...
            </p>
          </div>
        );

      default:
        return (
          <div className="text-center text-white">
            <h1 className="text-4xl font-bold mb-4">GlowWorm Display</h1>
            <p className="text-xl mb-8">Unknown status</p>
          </div>
        );
    }
  };

  return (
    <>
      <div className="min-h-screen bg-black flex items-center justify-center">
        {renderContent()}
      </div>

      {/* Fullscreen Slideshow */}
      {showSlideshow && (
        <FullscreenSlideshow
          images={playlistImages}
          playlist={currentPlaylist || undefined}
          initialSettings={{ 
            ...slideshowSettings, 
            showInfo: true, // Force show info for debugging
            interval: currentPlaylist?.display_time_seconds || slideshowSettings.interval
          }}
          onClose={stopSlideshow}
          onImageChange={handleImageChange}
        />
      )}
      
      {/* Debug info for slideshow state */}
      <div className="fixed top-4 right-4 bg-yellow-500 text-black p-2 rounded z-[100] text-sm">
        <p>showSlideshow: {showSlideshow ? 'true' : 'false'}</p>
        <p>playlistImages: {playlistImages.length}</p>
        <p>currentPlaylist: {currentPlaylist?.name || 'none'}</p>
      </div>
    </>
  );
};

export default DisplayViewWebSocket;
