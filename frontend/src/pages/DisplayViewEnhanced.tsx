import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { FullscreenSlideshow } from '../components/FullscreenSlideshow';
import { apiService } from '../services/api';
import type { Image, Playlist, Device } from '../types';

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

const DisplayViewEnhanced: React.FC = () => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [currentPlaylist, setCurrentPlaylist] = useState<Playlist | null>(null);
  const [playlistImages, setPlaylistImages] = useState<Image[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);
  const [showSlideshow, setShowSlideshow] = useState(false);
  const [slideshowSettings, setSlideshowSettings] = useState({
    autoPlay: true,
    interval: 5,
    transition: 'fade' as const,
    showControls: true,
    showInfo: true,
    shuffle: false,
    loop: true,
  });

  // Register device on first load
  useEffect(() => {
    const registerDevice = async () => {
      try {
        const response = await fetch('/api/display-devices/register', {
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

        if (response.ok) {
          const data = await response.json();
          setIsRegistered(true);
          console.log('Device registered:', data);
        } else {
          throw new Error('Failed to register device');
        }
      } catch (err) {
        console.error('Device registration failed:', err);
        setError('Failed to register device');
      }
    };

    registerDevice();
  }, [deviceId]);

  // Check device status and load playlist
  useEffect(() => {
    if (!isRegistered) return;

    const checkStatusAndLoadPlaylist = async () => {
      try {
        // Check device status
        const statusResponse = await fetch('/api/display-devices/status', {
          credentials: 'include',
        });

        if (statusResponse.ok) {
          const deviceData = await statusResponse.json();
          setDeviceStatus(deviceData);
          setError(null);

          // If device is authorized, load the current playlist
          if (deviceData.status === 'authorized' && deviceData.playlist_id) {
            await loadPlaylistAndImages(deviceData.playlist_id);
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

    // Check every 10 seconds
    const interval = setInterval(checkStatusAndLoadPlaylist, 10000);

    return () => clearInterval(interval);
  }, [isRegistered]);

  const loadPlaylistAndImages = async (playlistId: number) => {
    try {
      // Load playlist details
      const playlistResponse = await apiService.getPlaylists();
      const playlists = playlistResponse.data || [];
      const playlist = playlists.find(p => p.id === playlistId);
      
      if (playlist) {
        setCurrentPlaylist(playlist);
        
        // Load images for the playlist
        const imagesResponse = await apiService.getImages(undefined, playlistId);
        const images = imagesResponse.data || [];
        
        // Sort images by playlist sequence if available
        if (playlist.sequence && Array.isArray(playlist.sequence)) {
          console.log('🎯 Loading playlist with sequence:', playlist.sequence);
          const sortedImages = images.sort((a, b) => {
            const aIndex = playlist.sequence!.indexOf(a.id);
            const bIndex = playlist.sequence!.indexOf(b.id);
            if (aIndex === -1 && bIndex === -1) return 0;
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
          });
          console.log('📊 Sorted images for display:');
          sortedImages.forEach((img, index) => {
            const orientation = img.width && img.height ? (img.width > img.height ? 'landscape' : 'portrait') : 'unknown';
            console.log(`  ${index + 1}. ${img.original_filename} (${orientation})`);
          });
          
          // Check for consecutive landscape images in the first 20 images
          console.log('🔍 Checking for consecutive landscape images in first 20:');
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
        } else {
          console.log('⚠️ No sequence found, using original order');
          setPlaylistImages(images);
        }
      }
    } catch (err) {
      console.error('Failed to load playlist:', err);
    }
  };

  const startSlideshow = useCallback(() => {
    if (playlistImages.length > 0) {
      setShowSlideshow(true);
    }
  }, [playlistImages.length]);

  // Auto-start slideshow when playlist images are loaded and device is authorized
  useEffect(() => {
    if (deviceStatus?.status === 'authorized' && 
        playlistImages.length > 0 && 
        !showSlideshow) {
      console.log('Auto-starting slideshow with', playlistImages.length, 'images');
      startSlideshow();
    }
  }, [deviceStatus?.status, playlistImages.length, showSlideshow, startSlideshow]);

  const stopSlideshow = useCallback(() => {
    setShowSlideshow(false);
  }, []);

  const handleImageChange = useCallback((image: Image, index: number) => {
    console.log('Slideshow showing image:', image.original_filename, 'at index:', index);
  }, []);

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
            showInfo: false,
            interval: currentPlaylist?.display_time_seconds || slideshowSettings.interval
          }}
          onClose={stopSlideshow}
          onImageChange={handleImageChange}
        />
      )}
    </>
  );
};

export default DisplayViewEnhanced;
