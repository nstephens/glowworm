import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { urlResolver } from '../services/urlResolver';
import { FullscreenSlideshowOptimized } from '../components/FullscreenSlideshowOptimized';
import { DeviceWebSocketClient } from '../services/websocket';
import { apiService } from '../services/api';
import { applyDeviceOptimizations } from '../utils/deviceDetection';
import { displayDeviceLogger } from '../services/displayDeviceLogger';
import { imageCacheService, ImageCacheService } from '../services/ImageCacheService';
import { preloadManager } from '../services/PreloadManager';
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
  const [displayResolution, setDisplayResolution] = useState<{width: number, height: number} | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [showSlideshow, setShowSlideshow] = useState(false);
  
  // Cache-first loading state
  const [cachePreloadProgress, setCachePreloadProgress] = useState(0);
  const [cachePreloadComplete, setCachePreloadComplete] = useState(false);
  const [cachedImageUrls, setCachedImageUrls] = useState<Map<string, string>>(new Map());
  
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
    
    // Log device startup
    displayDeviceLogger.logStartup({
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      screen: `${window.screen.width}x${window.screen.height}`,
      devicePixelRatio: window.devicePixelRatio,
      deviceInfo
    });
    
    return () => {
      document.body.classList.remove('display-mode', 'pi-mode', 'low-power-mode');
    };
  }, []);

  // Detect and report screen resolution on every connection and window resize
  useEffect(() => {
    const reportResolution = async () => {
      try {
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const devicePixelRatio = window.devicePixelRatio || 1;
        
        console.log(`📱 Browser window size detected: ${screenWidth}x${screenHeight} (DPR: ${devicePixelRatio})`);
        console.log(`🖥️ System screen size: ${window.screen.width}x${window.screen.height} (DPR: ${window.devicePixelRatio})`);
        
        // Send resolution info to backend
        const response = await fetch(urlResolver.getApiUrl('/display-devices/update-resolution'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            screen_width: screenWidth,
            screen_height: screenHeight,
            device_pixel_ratio: devicePixelRatio.toString()
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('✅ Resolution updated successfully:', data);
          console.log(`📊 Device resolution stored: ${data.device?.screen_width || 'unknown'}x${data.device?.screen_height || 'unknown'}`);
          
          // Log resolution to remote logger
          displayDeviceLogger.logResolution(screenWidth, screenHeight, devicePixelRatio);
        } else {
          console.warn('⚠️ Failed to update resolution:', response.status);
          displayDeviceLogger.error('Failed to update resolution', { status: response.status });
        }
      } catch (error) {
        console.warn('⚠️ Failed to report resolution:', error);
        displayDeviceLogger.error('Failed to report resolution', { error: String(error) });
      }
    };
    
    // Report resolution immediately on every connection
    reportResolution();
    
    // Add window resize listener to update resolution when browser window is resized
    // Debounce to avoid too many API calls during active resizing
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      console.log('🔄 Browser window resized, updating resolution...');
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        reportResolution();
      }, 500); // Wait 500ms after resize stops
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimeout);
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
          
          // Log device registration
          displayDeviceLogger.info('Device registered successfully', {
            device_id: registrationData.device_id,
            device_token: registrationData.device_token.substring(0, 8) + '...',
            status: registrationData.status
          });
          
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
          displayDeviceLogger.logWebSocketStatus('connected', {
            device_token: deviceToken.substring(0, 8) + '...'
          });
        });

        client.on('disconnected', () => {
          console.log('WebSocket disconnected');
          setConnectionStatus('disconnected');
          displayDeviceLogger.logWebSocketStatus('disconnected');
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

        client.on('clear_cache', async (message) => {
          console.log('🗑️ CACHE: Clear cache command received from admin');
          try {
            await imageCacheService.clearCache();
            console.log('✅ CACHE: Cache cleared successfully');
            // Optionally trigger a re-download
            if (currentPlaylist) {
              console.log('🔄 CACHE: Triggering cache re-download for playlist', currentPlaylist.id);
              // This will re-download all images since cache is now empty
            }
          } catch (error) {
            console.error('❌ CACHE: Failed to clear cache:', error);
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
      displayDeviceLogger.logPlaylist('loading', { playlist_id: playlistId });
      
      // Load playlist details using smart endpoint for resolution-optimized playlists
      const playlistResponse = await fetch(urlResolver.getApiUrl(`/playlists/${playlistId}/smart`), {
        credentials: 'include',
      });
      
      if (!playlistResponse.ok) {
        throw new Error(`Failed to fetch smart playlist: ${playlistResponse.status}`);
      }
      
      const playlistData = await playlistResponse.json();
      console.log('🎯 Smart playlist response:', playlistData);
      console.log(`📱 Device resolution: ${playlistData.device_resolution}`);
      console.log(`📊 Effective resolution: ${playlistData.effective_resolution}`);
      console.log(`🎬 Variant type: ${playlistData.variant?.variant_type || 'original'}`);
      console.log(`🖼️ Optimized image count: ${playlistData.variant?.image_count || playlistData.playlist?.image_count || 'unknown'}`);
      
      // Log variant selection details
      const availableVariants = playlistData.available_variants || [];
      const hasNoVariants = !availableVariants || availableVariants.length === 0;
      
      displayDeviceLogger.logVariantSelection({
        device_resolution: playlistData.device_resolution,
        effective_resolution: playlistData.effective_resolution,
        variant_type: playlistData.variant?.variant_type || 'original',
        variant_id: playlistData.variant?.id || null,
        variant_target: playlistData.variant ? `${playlistData.variant.target_width}x${playlistData.variant.target_height}` : null,
        available_variants: availableVariants,
        playlist_id: playlistId,
        needs_generation: hasNoVariants
      });
      
      // Log warning if no variants exist
      if (hasNoVariants) {
        displayDeviceLogger.warning('No variants exist for this playlist - serving original high-res images', {
          playlist_id: playlistId,
          playlist_name: playlistData.playlist?.name,
          action_required: 'Generate variants from admin panel: POST /api/playlists/' + playlistId + '/generate-variants'
        });
      }
      
      const playlist = playlistData.playlist;
      console.log('Found smart playlist:', playlist);
      console.log('🎯 Optimized sequence from backend:', playlist?.sequence);
      
      // Store the display resolution from variant if available
      if (playlistData.variant?.target_width && playlistData.variant?.target_height) {
        setDisplayResolution({
          width: playlistData.variant.target_width,
          height: playlistData.variant.target_height
        });
        console.log(`📏 Display resolution: ${playlistData.variant.target_width}x${playlistData.variant.target_height}`);
      } else {
        setDisplayResolution(null);
        console.log('📏 No variant resolution, using original dimensions');
      }
      
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
          
          // Log successful playlist load
          displayDeviceLogger.logPlaylist('loaded', {
            playlist_id: playlistId,
            playlist_name: playlist.name,
            image_count: sortedImages.length,
            has_sequence: true,
            variant_type: playlistData.variant?.variant_type || 'original'
          });
        } else {
          console.log('⚠️ DisplayView: No sequence found, using original order');
          setPlaylistImages(images);
          console.log('Set playlist images:', images.length);
          
          // Log successful playlist load
          displayDeviceLogger.logPlaylist('loaded', {
            playlist_id: playlistId,
            playlist_name: playlist.name,
            image_count: images.length,
            has_sequence: false
          });
        }
      } else {
        console.error('Playlist not found for ID:', playlistId);
        displayDeviceLogger.error('Playlist not found', { playlist_id: playlistId });
      }
    } catch (err) {
      console.error('Failed to load playlist:', err);
      displayDeviceLogger.error('Failed to load playlist', {
        playlist_id: playlistId,
        error: String(err)
      });
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
  
  // Start IndexedDB cache preload when playlist is loaded
  useEffect(() => {
    if (!currentPlaylist || playlistImages.length === 0) return;
    if (!ImageCacheService.isSupported()) {
      console.log('[DisplayView] IndexedDB not supported, skipping cache preload');
      return;
    }

    console.log(`[DisplayView] 🚀 Starting IndexedDB cache preload for playlist ${currentPlaylist.id} (${currentPlaylist.name})`);
    
    // Start preload in background with progress tracking
    preloadManager.prefetchPlaylist(currentPlaylist.id, (progress) => {
      setCachePreloadProgress(progress.percentComplete);
      
      if (progress.percentComplete % 10 === 0 || progress.percentComplete === 100) {
        console.log(
          `[DisplayView] 📦 Cache preload: ${progress.percentComplete.toFixed(0)}% ` +
          `(${progress.successCount}/${progress.total} images, ${(progress.bytesDownloaded / (1024*1024)).toFixed(1)}MB)`
        );
      }
    }).then((result) => {
      console.log(
        `[DisplayView] ✅ Cache preload complete: ${result.successCount}/${result.totalImages} images cached ` +
        `(${(result.bytesDownloaded / (1024*1024)).toFixed(1)}MB in ${(result.durationMs / 1000).toFixed(1)}s)`
      );
      
      // Send cache preload status to backend for admin visibility
      displayDeviceLogger.info('IndexedDB cache preload complete', {
        playlist_id: currentPlaylist.id,
        playlist_name: currentPlaylist.name,
        cached_images: result.successCount,
        total_images: result.totalImages,
        failed_images: result.failedCount,
        cache_size_mb: (result.bytesDownloaded / (1024*1024)).toFixed(1),
        duration_seconds: (result.durationMs / 1000).toFixed(1),
        cache_enabled: true
      });
      
      if (result.failedCount > 0) {
        console.warn(`[DisplayView] ⚠️ ${result.failedCount} images failed to cache:`, result.failedImageIds);
        displayDeviceLogger.warning('Some images failed to cache', {
          failed_count: result.failedCount,
          failed_ids: result.failedImageIds.slice(0, 10)  // First 10 only
        });
      }
      setCachePreloadComplete(true);
    }).catch((error) => {
      console.error('[DisplayView] ❌ Cache preload failed:', error);
      displayDeviceLogger.error('Cache preload failed', {
        error: error.message,
        playlist_id: currentPlaylist.id
      });
      // Continue anyway - will fall back to network
      setCachePreloadComplete(true);
    });
  }, [currentPlaylist?.id, playlistImages.length]);
  
  // Load cached images as blob URLs
  useEffect(() => {
    if (!currentPlaylist || playlistImages.length === 0) return;
    if (!ImageCacheService.isSupported()) return;

    const loadCachedImages = async () => {
      const newCachedUrls = new Map(cachedImageUrls);
      let updated = false;

      for (const image of playlistImages) {
        const imageId = image.id.toString();
        
        // Skip if already have blob URL
        if (newCachedUrls.has(imageId)) continue;

        try {
          // Try to get from cache
          const blob = await imageCacheService.getImage(imageId);
          
          if (blob) {
            // Create blob URL
            const blobUrl = URL.createObjectURL(blob);
            newCachedUrls.set(imageId, blobUrl);
            updated = true;
            console.log(`[DisplayView] 💾 Loaded image ${imageId} from cache`);
          }
        } catch (error) {
          // Cache miss - will use network URL
          console.debug(`[DisplayView] Cache miss for image ${imageId}`);
        }
      }

      if (updated) {
        setCachedImageUrls(newCachedUrls);
        console.log(`[DisplayView] 🎯 Updated cached URLs: ${newCachedUrls.size} images`);
      }
    };

    loadCachedImages();
  }, [playlistImages, currentPlaylist, cachedImageUrls]);
  
  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      cachedImageUrls.forEach((blobUrl) => {
        if (blobUrl.startsWith('blob:')) {
          URL.revokeObjectURL(blobUrl);
        }
      });
    };
  }, [cachedImageUrls]);
  
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
              src="/glowworm-logo.svg" 
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
              src="/glowworm-logo.svg" 
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
              src="/glowworm-logo.svg" 
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
          <div className="text-center text-white max-w-6xl mx-auto px-4">
            <div className="flex items-center justify-center space-x-4 mb-8">
              <img 
                src="/glowworm-logo.svg" 
                alt="Glowworm Logo" 
                className="w-16 h-16 object-contain"
              />
              <h1 className="text-4xl font-bold">Glowworm Display</h1>
            </div>
            <p className="text-xl mb-8">Waiting for authorization...</p>
            
            {/* Device ID Display */}
            <div className="bg-white bg-opacity-10 border-2 border-white border-opacity-30 rounded-lg p-4 sm:p-6 mb-8">
              <p className="text-xl sm:text-2xl font-semibold text-white mb-2">Device ID:</p>
              <div className="text-4xl sm:text-5xl lg:text-6xl font-mono font-bold text-white">
                {deviceStatus.id}
              </div>
            </div>
            
            {/* Authorization Token Display */}
            <div className="bg-card/90 border border-border rounded-xl p-6 sm:p-8 shadow-lg backdrop-blur-sm mb-8">
              <p className="text-xl sm:text-2xl font-medium text-card-foreground mb-4 text-center">
                Authorization Code
              </p>
              <div className="text-7xl sm:text-8xl lg:text-9xl font-mono font-bold text-card-foreground text-center tracking-wider leading-none">
                {deviceStatus.device_token}
              </div>
              <p className="text-base sm:text-lg text-muted-foreground mt-4 text-center">
                Provide this code to an administrator for approval
              </p>
            </div>
            
            <div className="animate-pulse mb-4">
              <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full mx-auto"></div>
            </div>
            
            <div className="bg-primary/20 border border-primary/30 rounded-lg p-4 backdrop-blur-sm">
              <p className="text-sm text-primary-foreground text-center">
                This page will automatically update when the device is approved
              </p>
            </div>
          </div>
        );

      case 'authorized':
        return (
          <div className="text-center text-white">
            <div className="flex items-center justify-center space-x-4 mb-8">
              <img 
                src="/glowworm-logo.svg" 
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
                src="/glowworm-logo.svg" 
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
                src="/glowworm-logo.svg" 
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
                src="/glowworm-logo.svg" 
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

  // Transform images to use cached blob URLs where available
  const enhancedImages = React.useMemo(() => {
    return playlistImages.map((image) => {
      const cachedUrl = cachedImageUrls.get(image.id.toString());
      if (cachedUrl) {
        // Use cached blob URL
        return { ...image, url: cachedUrl, _fromCache: true };
      }
      // Fall back to network URL
      return image;
    });
  }, [playlistImages, cachedImageUrls]);

  return (
    <div className="frameless-display bg-black flex items-center justify-center">
      {renderContent()}
      
      {/* Fullscreen Slideshow */}
      {showSlideshow && (
        <>
          {console.log('🎬 SLIDESHOW: Rendering FullscreenSlideshowOptimized component')}
          <FullscreenSlideshowOptimized
            images={enhancedImages}
            playlist={currentPlaylist || undefined}
            initialSettings={{ 
              showInfo: currentPlaylist?.show_image_info || false,
              interval: currentPlaylist?.display_time_seconds || 30,
              loop: true  // Explicitly ensure looping for display devices
            }}
            onClose={stopSlideshow}
            deviceToken={deviceStatus?.device_token}
            displayResolution={displayResolution}
          />
        </>
      )}
      {!showSlideshow && console.log('🎬 SLIDESHOW: Not rendering slideshow - showSlideshow is false')}
    </div>
  );
};

export default DisplayView;
