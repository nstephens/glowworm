import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { urlResolver } from '../services/urlResolver';
import { FullscreenSlideshowOptimized } from '../components/FullscreenSlideshowOptimized';
import { DeviceWebSocketClient } from '../services/websocket';
import { apiService } from '../services/api';
import { applyDeviceOptimizations } from '../utils/deviceDetection';
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

const DisplayView: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
  const [playlistImages, setPlaylistImages] = useState<Image[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [showSlideshow, setShowSlideshow] = useState(false);
  
  // Debug showSlideshow state changes
  useEffect(() => {
    console.log('🎬 SLIDESHOW STATE: showSlideshow changed to:', showSlideshow);
  }, [showSlideshow]);
  const [websocketClient, setWebsocketClient] = useState<DeviceWebSocketClient | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const websocketInitialized = useRef(false);

  // Load settings to update urlResolver with correct server URL
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // Use current urlResolver to get settings, then update it
        const response = await fetch(urlResolver.getApiUrl('/settings'), {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          if (data.settings && data.settings.server_base_url) {
            console.log('Updating urlResolver with server URL:', data.settings.server_base_url);
            urlResolver.updateServerUrl(data.settings.server_base_url);
          }
        } else if (response.status === 401) {
          // Settings endpoint requires authentication, but display should still work
          console.log('Settings endpoint requires authentication, using default server URL');
          // Ensure urlResolver has the correct default URL for this environment
          const currentUrl = urlResolver.getServerBaseUrl();
          console.log('Current urlResolver server URL:', currentUrl);
        }
      } catch (error) {
        console.warn('Failed to load settings for urlResolver:', error);
        // Ensure urlResolver has the correct default URL for this environment
        const currentUrl = urlResolver.getServerBaseUrl();
        console.log('Current urlResolver server URL (fallback):', currentUrl);
      }
    };
    
    loadSettings();
  }, []);

  // Add display-mode class to body for frameless display and apply device optimizations
  useEffect(() => {
    document.body.classList.add('display-mode');
    const deviceInfo = applyDeviceOptimizations();
    console.log('Applied device optimizations:', deviceInfo);
    
    return () => {
      document.body.classList.remove('display-mode', 'pi-mode', 'low-power-mode');
    };
  }, []);

  // Check existing device status or register new device on first load
  useEffect(() => {
    const initializeDevice = async () => {
      try {
        // First, validate any existing cookies to handle old/invalid cookies gracefully
        const validateResponse = await fetch(urlResolver.getApiUrl('/display-devices/validate-cookie'), {
          credentials: 'include',
        });

        if (validateResponse.ok) {
          const validateData = await validateResponse.json();
          console.log('Cookie validation result:', validateData);
          
          if (validateData.valid) {
            // Cookie is valid, get device status
            const statusResponse = await fetch(urlResolver.getApiUrl('/display-devices/status'), {
              credentials: 'include',
            });

            if (statusResponse.ok) {
              const data = await statusResponse.json();
              setDeviceStatus(data);
              setIsRegistered(true);
              console.log('Device status retrieved:', data);
              
              // If we're accessing via a slug, verify it matches this device
              if (slug) {
                const expectedSlug = data.device_name?.toLowerCase().replace(/\s+/g, '-') || `device-${data.id}`;
                if (slug !== expectedSlug) {
                  // Wrong device, redirect to the correct URL
                  window.location.href = `/display/${expectedSlug}`;
                  return;
                }
              }
              
              setIsLoading(false);
              return;
            }
          } else if (validateData.needs_reregistration) {
            // Cookie is invalid or device needs re-registration
            console.log('Device cookie invalid or needs re-registration:', validateData.message);
          }
        } else {
          console.log('Cookie validation failed, proceeding with registration...');
        }

        // Device not registered or cookie invalid, proceed to register
        console.log('Registering new device...');

        // Register new device
        const registerResponse = await fetch(urlResolver.getApiUrl('/display-devices/register'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_agent: navigator.userAgent,
          }),
          credentials: 'include',
        });

        if (registerResponse.ok) {
          const registrationData = await registerResponse.json();
          console.log('Device registered:', registrationData);
          
          // Create a temporary device status object from registration response
          const tempDeviceStatus: DeviceStatus = {
            id: registrationData.device_id,
            device_token: registrationData.device_token,
            status: registrationData.status,
            last_seen: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          
          setDeviceStatus(tempDeviceStatus);
          setIsRegistered(true);
          setIsLoading(false);
          
          // Try to get full device info, but don't fail if it doesn't work immediately
          try {
            const statusResponse = await fetch(urlResolver.getApiUrl('/display-devices/status'), {
              credentials: 'include',
            });
            
            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              setDeviceStatus(statusData);
              console.log('Full device status retrieved:', statusData);
            } else {
              console.log('Could not get full device status immediately, using registration data');
            }
          } catch (statusErr) {
            console.log('Status check failed, using registration data:', statusErr);
            // Continue with registration data - the periodic check will update it
          }
        } else {
          throw new Error('Failed to register device');
        }
      } catch (err) {
        console.error('Device initialization failed:', err);
        setError('Failed to initialize device');
        setIsLoading(false);
      }
    };

    initializeDevice();
  }, []);

  // Initialize WebSocket connection (only once per device token)
  useEffect(() => {
    if (!isRegistered || !deviceStatus?.device_token) {
      return;
    }
    
    // Prevent multiple connections for the same device token
    if (websocketInitialized.current) {
      return;
    }

    const initializeWebSocket = async () => {
      // WebSocket re-enabled after fixing backend endpoint signature
      console.log('WebSocket connection re-enabled - attempting to connect...');
      
      try {
        // Get device token from device status
        const deviceToken = deviceStatus.device_token;
        if (!deviceToken) {
          throw new Error('Device token not found');
        }

        const client = new DeviceWebSocketClient(deviceToken);
        console.log('Attempting to connect to WebSocket with device token:', deviceToken.substring(0, 8) + '...');
        
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

        client.on('playlist_update', (message) => {
          console.log('Playlist update received:', message);
          handlePlaylistUpdate(message);
        });

        client.on('command', (message) => {
          console.log('Command received:', message);
          const { command, data } = message;
          
          switch (command) {
            case 'refresh_browser':
              console.log('🔄 REFRESH: Received refresh command from admin');
              window.location.reload();
              break;
            default:
              console.log('Unknown command:', command);
          }
        });

        client.on('error', (error) => {
          console.warn('WebSocket error (non-critical):', error);
        });

        setWebsocketClient(client);
        
        // Connect to WebSocket (optional - slideshow works without it)
        try {
          await client.connect();
          websocketInitialized.current = true; // Mark as initialized
        } catch (connectErr) {
          console.warn('WebSocket connection failed (non-critical):', connectErr);
          // Continue without WebSocket - slideshow will still work
        }
        
      } catch (err) {
        console.warn('WebSocket initialization failed (non-critical):', err);
        // Don't set error - WebSocket is optional
      }
    };

    initializeWebSocket();

    // Cleanup on unmount
    return () => {
      if (websocketClient) {
        websocketClient.disconnect();
      }
      websocketInitialized.current = false; // Reset initialization flag
    };
  }, [isRegistered, deviceStatus?.device_token]); // Only re-run if device token changes

  // Check device status periodically
  useEffect(() => {
    if (!isRegistered) return;

    const checkStatus = async () => {
      try {
        // For pending devices, just try to get status updates without aggressive validation
        const response = await fetch(urlResolver.getApiUrl('/display-devices/status'), {
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setDeviceStatus(data);
          setError(null);
          console.log('Status updated:', data.status);
        } else if (response.status === 401) {
          // Only reset if we get a 401 (device not found/invalid)
          console.log('Device authentication lost, will re-register');
          setIsRegistered(false);
          setDeviceStatus(null);
        } else {
          // For other errors, just log but don't reset state
          console.log('Status check failed, but keeping current state');
        }
      } catch (err) {
        console.error('Status check failed:', err);
        // Don't reset state on network errors, just log
      }
    };

    // Start checking after a delay to allow device to be fully registered
    let intervalId: NodeJS.Timeout;
    const timeout = setTimeout(() => {
      intervalId = setInterval(checkStatus, 10000);
    }, 5000); // Wait 5 seconds before starting status checks

    return () => {
      clearTimeout(timeout);
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isRegistered]);

  const loadPlaylistImagesForSequence = async (sequence: number[]) => {
    try {
      console.log('Loading images for sequence:', sequence);
      
      // Fetch all images to get the image objects for the sequence IDs
      const imagesResponse = await fetch(urlResolver.getApiUrl('/images'), {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!imagesResponse.ok) {
        throw new Error(`Failed to fetch images: ${imagesResponse.status}`);
      }
      
      const imagesData = await imagesResponse.json();
      const allImages = imagesData.data || imagesData.images || [];
      
      // Create a map of image ID to image object for quick lookup
      const imageMap = new Map(allImages.map((img: Image) => [img.id, img]));
      
      // Build the playlist images array in the correct sequence order
      const orderedImages: Image[] = [];
      sequence.forEach(imageId => {
        const image = imageMap.get(imageId);
        if (image) {
          orderedImages.push(image);
        } else {
          console.warn(`Image with ID ${imageId} not found in all images`);
        }
      });
      
      console.log('Set sorted playlist images:', orderedImages.length);
      setPlaylistImages(orderedImages);
      
    } catch (err: any) {
      console.error('Failed to load playlist images for sequence:', err);
      setError(err.message || 'Failed to load playlist images');
    }
  };

  const loadPlaylistAndImages = async (playlistId: number) => {
    try {
      console.log('Loading playlist and images for playlist ID:', playlistId);
      
      // Load playlist details using public endpoint for display devices
      const playlistResponse = await fetch(urlResolver.getApiUrl('/playlists/public'), {
        credentials: 'include',
      });
      
      if (!playlistResponse.ok) {
        throw new Error(`Failed to fetch playlists: ${playlistResponse.status}`);
      }
      
      const playlistData = await playlistResponse.json();
      const playlists = playlistData.data || [];
      console.log('Available playlists:', playlists.map(p => ({ id: p.id, name: p.name })));
      
      const playlist = playlists.find(p => p.id === playlistId);
      console.log('Found playlist:', playlist);
      console.log('🎯 Playlist sequence from backend:', playlist?.sequence);
      
      if (playlist) {
        setCurrentPlaylist(playlist);
        console.log('Set current playlist:', playlist.name);
        console.log('Current playlist state should now be:', playlist);
        
        // Load images for the playlist using public endpoint for display devices
        const imagesResponse = await fetch(urlResolver.getApiUrl(`/images/public?playlist_id=${playlistId}`), {
          credentials: 'include',
        });
        
        if (!imagesResponse.ok) {
          throw new Error(`Failed to fetch images: ${imagesResponse.status}`);
        }
        
        const imagesData = await imagesResponse.json();
        const images = imagesData.data || [];
        console.log('Loaded images for playlist:', images.length, 'images');
        
        // Sort images by playlist sequence if available
        if (playlist.sequence && Array.isArray(playlist.sequence)) {
          console.log('🎯 DisplayView: Loading playlist with sequence:', playlist.sequence);
          const sortedImages = images.sort((a, b) => {
            const aIndex = playlist.sequence!.indexOf(a.id);
            const bIndex = playlist.sequence!.indexOf(b.id);
            if (aIndex === -1 && bIndex === -1) return 0;
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
          });
          console.log('📊 DisplayView: Sorted images for display:');
          sortedImages.forEach((img, index) => {
            const orientation = img.width && img.height ? (img.width > img.height ? 'landscape' : 'portrait') : 'unknown';
            console.log(`  ${index + 1}. ${img.original_filename} (${orientation})`);
          });
          
          // Check for consecutive landscape images in the first 20 images
          console.log('🔍 DisplayView: Checking for consecutive landscape images in first 20:');
          for (let i = 0; i < Math.min(20, sortedImages.length - 1); i++) {
            const current = sortedImages[i];
            const next = sortedImages[i + 1];
            const currentLandscape = current.width && current.height && current.width > current.height;
            const nextLandscape = next.width && next.height && next.width > next.height;
            if (currentLandscape && nextLandscape) {
              console.log(`  ✅ Found consecutive landscape pair at positions ${i + 1}-${i + 2}: ${current.original_filename} + ${next.original_filename}`);
            }
          }
          setPlaylistImages(sortedImages);
          console.log('Set sorted playlist images:', sortedImages.length);
        } else {
          console.log('⚠️ DisplayView: No sequence found, using original order');
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

  const startSlideshow = useCallback(() => {
    console.log('🎬 SLIDESHOW: startSlideshow called with', playlistImages.length, 'images');
    if (playlistImages.length > 0) {
      console.log('🎬 SLIDESHOW: Setting showSlideshow to true');
      setShowSlideshow(true);
    } else {
      console.log('🎬 SLIDESHOW: Not starting - no images');
    }
  }, [playlistImages.length]);

  const stopSlideshow = useCallback(() => {
    setShowSlideshow(false);
  }, []);

  const handlePlaylistUpdate = useCallback((message: any) => {
    console.log('=== PLAYLIST UPDATE HANDLER START ===');
    console.log('Handling playlist update:', message);
    console.log('Message has playlist property:', !!message.playlist);
    console.log('Current playlist ID:', currentPlaylist?.id);
    console.log('Current playlist display_time_seconds:', currentPlaylist?.display_time_seconds);
    console.log('Full currentPlaylist object:', currentPlaylist);
    console.log('Device status playlist_id:', deviceStatus?.playlist_id);
    
    // Handle playlist update format - check message.playlist, message.data, and message.playlist_data
    const playlist = message.playlist || message.data || message.playlist_data;
    if (playlist) {
      console.log('Playlist ID from message:', playlist.id);
      console.log('Playlist display_time_seconds:', playlist.display_time_seconds);
      console.log('Playlist auto_sort:', playlist.auto_sort);
      
      // Update current playlist if it's the same one we're displaying
      // Check if this is the playlist we're currently showing (either in currentPlaylist or deviceStatus)
      const isCurrentPlaylist = currentPlaylist?.id === playlist.id || 
                               deviceStatus?.playlist_id === playlist.id;
      
      if (isCurrentPlaylist) {
        console.log('✅ Updating current playlist with new data:', playlist);
        setCurrentPlaylist(playlist);
        
        // The FullscreenSlideshow component will automatically receive the updated interval
        // through the initialSettings prop when currentPlaylist changes
        console.log('🔄 Playlist updated - FullscreenSlideshow will receive new interval:', playlist.display_time_seconds);
        
        // If the message includes the images directly, use them
        if (playlist.images && Array.isArray(playlist.images) && playlist.images.length > 0) {
          console.log('🎯 Using images directly from WebSocket message:', playlist.images.length, 'images');
          setPlaylistImages(playlist.images);
        } else if (playlist.sequence && Array.isArray(playlist.sequence)) {
          // Fallback: use the sequence from the WebSocket message
          console.log('🎯 No images in WebSocket message, using sequence:', playlist.sequence.length, 'images');
          loadPlaylistImagesForSequence(playlist.sequence);
        } else {
          // Final fallback: reload from API
          console.log('🔄 No images or sequence in message, reloading from API');
          loadPlaylistAndImages(playlist.id);
        }
      } else {
        console.log('❌ Not updating - different playlist');
        console.log('Current playlist ID:', currentPlaylist?.id, 'Device playlist ID:', deviceStatus?.playlist_id, 'Message playlist ID:', playlist.id);
      }
    } else {
      console.log('❌ No playlist or data property in message');
      console.log('Message structure:', Object.keys(message));
    }
    // Handle legacy format for backward compatibility
    if (message.data && message.data.playlist_id) {
      loadPlaylistAndImages(message.data.playlist_id);
    }
    console.log('=== PLAYLIST UPDATE HANDLER END ===');
  }, [currentPlaylist]);

  // Auto-start slideshow when playlist images are loaded and device is authorized
  useEffect(() => {
    console.log('Auto-start useEffect triggered:', {
      deviceStatus: deviceStatus?.status,
      playlistImagesLength: playlistImages.length,
      showSlideshow
    });
    
    console.log('🎬 SLIDESHOW CHECK: Device status:', deviceStatus?.status);
    console.log('🎬 SLIDESHOW CHECK: Playlist images length:', playlistImages.length);
    console.log('🎬 SLIDESHOW CHECK: Show slideshow:', showSlideshow);
    
    if (deviceStatus?.status === 'authorized' && 
        playlistImages.length > 0 && 
        !showSlideshow) {
      console.log('🎬 SLIDESHOW: Auto-starting slideshow with', playlistImages.length, 'images');
      startSlideshow();
    } else {
      console.log('🎬 SLIDESHOW: Not starting slideshow - conditions not met');
    }
  }, [deviceStatus?.status, playlistImages.length, showSlideshow, startSlideshow]);
  
  // Debug useEffect dependencies
  useEffect(() => {
    console.log('🎬 SLIDESHOW DEPS: useEffect dependencies changed:', {
      deviceStatus: deviceStatus?.status,
      playlistImagesLength: playlistImages.length,
      showSlideshow,
      startSlideshowFunction: typeof startSlideshow
    });
  }, [deviceStatus?.status, playlistImages.length, showSlideshow, startSlideshow]);

  // Load playlist when device status changes
  useEffect(() => {
    if (deviceStatus?.status === 'authorized' && deviceStatus.playlist_id) {
      console.log('Device is authorized with playlist_id:', deviceStatus.playlist_id, 'loading playlist...');
      loadPlaylistAndImages(deviceStatus.playlist_id);
    } else {
      console.log('Device not authorized or no playlist:', {
        status: deviceStatus?.status,
        playlist_id: deviceStatus?.playlist_id
      });
    }
  }, [deviceStatus?.status, deviceStatus?.playlist_id]);

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="text-center text-white">
          <div className="flex items-center justify-center space-x-4 mb-8">
            <img 
              src="/glowworm_icon.png" 
              alt="Glowworm Logo" 
              className="w-16 h-16 object-contain"
            />
            <h1 className="text-4xl font-bold">Glowworm Display</h1>
          </div>
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
          <div className="flex items-center justify-center space-x-4 mb-8">
            <img 
              src="/glowworm_icon.png" 
              alt="Glowworm Logo" 
              className="w-16 h-16 object-contain"
            />
            <h1 className="text-4xl font-bold">Glowworm Display</h1>
          </div>
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
          <div className="flex items-center justify-center space-x-4 mb-8">
            <img 
              src="/glowworm_icon.png" 
              alt="Glowworm Logo" 
              className="w-16 h-16 object-contain"
            />
            <h1 className="text-4xl font-bold">Glowworm Display</h1>
          </div>
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
            <div className="flex items-center justify-center space-x-4 mb-8">
              <img 
                src="/glowworm_icon.png" 
                alt="Glowworm Logo" 
                className="w-16 h-16 object-contain"
              />
              <h1 className="text-4xl font-bold">Glowworm Display</h1>
            </div>
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
          </div>
        );

      case 'authorized':
        return (
          <div className="text-center text-white">
            <div className="flex items-center justify-center space-x-4 mb-8">
              <img 
                src="/glowworm_icon.png" 
                alt="Glowworm Logo" 
                className="w-16 h-16 object-contain"
              />
              <h1 className="text-4xl font-bold">Glowworm Display</h1>
            </div>
            <p className="text-xl mb-8 text-green-400">✓ Device Authorized</p>
            {deviceStatus.device_name && (
              <p className="text-lg mb-4">Name: {deviceStatus.device_name}</p>
            )}
            {deviceStatus.device_identifier && (
              <p className="text-lg mb-4">ID: {deviceStatus.device_identifier}</p>
            )}
            <p className="text-sm opacity-75">
              Ready to display content
            </p>
            <div className="mt-8 text-xs opacity-50">
              <p>Authorized: {new Date(deviceStatus.authorized_at!).toLocaleString()}</p>
              <p>Last seen: {new Date(deviceStatus.last_seen).toLocaleString()}</p>
            </div>
          </div>
        );

      case 'rejected':
        return (
          <div className="text-center text-white">
            <div className="flex items-center justify-center space-x-4 mb-8">
              <img 
                src="/glowworm_icon.png" 
                alt="Glowworm Logo" 
                className="w-16 h-16 object-contain"
              />
              <h1 className="text-4xl font-bold">Glowworm Display</h1>
            </div>
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
            <div className="flex items-center justify-center space-x-4 mb-8">
              <img 
                src="/glowworm_icon.png" 
                alt="Glowworm Logo" 
                className="w-16 h-16 object-contain"
              />
              <h1 className="text-4xl font-bold">Glowworm Display</h1>
            </div>
            <p className="text-xl mb-8 text-yellow-400">Device Offline</p>
            <p className="text-sm opacity-75">
              Connection lost. Attempting to reconnect...
            </p>
          </div>
        );

      default:
        return (
          <div className="text-center text-white">
            <div className="flex items-center justify-center space-x-4 mb-8">
              <img 
                src="/glowworm_icon.png" 
                alt="Glowworm Logo" 
                className="w-16 h-16 object-contain"
              />
              <h1 className="text-4xl font-bold">Glowworm Display</h1>
            </div>
            <p className="text-xl mb-8">Unknown status</p>
          </div>
        );
    }
  };

  return (
    <div className="frameless-display bg-black flex items-center justify-center">
      {renderContent()}
      
      {/* Fullscreen Slideshow */}
      {showSlideshow && (
        <>
          {console.log('🎬 SLIDESHOW: Rendering FullscreenSlideshowOptimized component')}
          <FullscreenSlideshowOptimized
            images={playlistImages}
            playlist={currentPlaylist || undefined}
            initialSettings={{ 
              showInfo: false,
              interval: currentPlaylist?.display_time_seconds || 30
            }}
            onClose={stopSlideshow}
          />
        </>
      )}
      {!showSlideshow && console.log('🎬 SLIDESHOW: Not rendering slideshow - showSlideshow is false')}
    </div>
  );
};

export default DisplayView;
