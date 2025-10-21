import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FullscreenSlideshow } from './FullscreenSlideshow';
import { SmartPreloadMonitor } from './SmartPreloadMonitor';
import { smartPreloadService } from '../services/smartPreload';
import type { Image, Playlist } from '../types';

interface SmartSlideshowProps {
  images: Image[];
  playlist?: Playlist;
  initialSettings?: any;
  onClose?: () => void;
  onImageChange?: (image: Image, index: number) => void;
  enableSmartPreload?: boolean;
  showPreloadMonitor?: boolean;
}

export const SmartSlideshow: React.FC<SmartSlideshowProps> = ({
  images,
  playlist,
  initialSettings = {},
  onClose,
  onImageChange,
  enableSmartPreload = true,
  showPreloadMonitor = false
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(initialSettings.autoPlay ?? true);
  const [settings, setSettings] = useState({
    autoPlay: true,
    interval: 5,
    transition: 'fade' as const,
    showControls: true,
    showInfo: true,
    shuffle: false,
    loop: true,
    ...initialSettings
  });
  const [preloadStarted, setPreloadStarted] = useState(false);
  const [preloadComplete, setPreloadComplete] = useState(false);
  const [showMonitor, setShowMonitor] = useState(showPreloadMonitor);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const preloadTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Start smart preload when component mounts
  useEffect(() => {
    if (enableSmartPreload && playlist && images.length > 0 && !preloadStarted) {
      startSmartPreload();
    }
  }, [enableSmartPreload, playlist, images.length, preloadStarted]);

  // Update slideshow timing for optimization
  useEffect(() => {
    if (playlist && enableSmartPreload) {
      updateSlideshowTiming();
    }
  }, [currentIndex, settings.interval, playlist, enableSmartPreload]);

  // Auto-play functionality
  useEffect(() => {
    if (isPlaying && images.length > 0) {
      intervalRef.current = setInterval(() => {
        nextImage();
      }, settings.interval * 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, settings.interval, images.length]);

  const startSmartPreload = async () => {
    if (!playlist || preloadStarted) return;

    try {
      setPreloadStarted(true);
      
      // Check if preload is recommended
      const isRecommended = await smartPreloadService.isPreloadRecommended(playlist.id);
      if (!isRecommended) {
        console.log('Smart preload not recommended for current conditions');
        setPreloadComplete(true);
        return;
      }

      // Start smart preload
      await smartPreloadService.smartPreloadForSlideshow(
        playlist.id,
        currentIndex,
        settings.interval,
        ['webp', 'avif']
      );

      console.log('Smart preload started for playlist:', playlist.name);
      
      // Set a timeout to consider preload "complete" for UI purposes
      preloadTimeoutRef.current = setTimeout(() => {
        setPreloadComplete(true);
      }, 10000); // 10 seconds

    } catch (error) {
      console.error('Failed to start smart preload:', error);
      setPreloadComplete(true);
    }
  };

  const updateSlideshowTiming = async () => {
    if (!playlist || !enableSmartPreload) return;

    try {
      await smartPreloadService.updateSlideshowTiming(
        playlist.id,
        currentIndex,
        settings.interval
      );
    } catch (error) {
      console.error('Failed to update slideshow timing:', error);
    }
  };

  const nextImage = useCallback(() => {
    if (images.length === 0) return;
    
    setCurrentIndex(prev => {
      const next = prev + 1;
      if (next >= images.length) {
        return settings.loop ? 0 : prev;
      }
      return next;
    });
  }, [images.length, settings.loop]);

  const previousImage = useCallback(() => {
    if (images.length === 0) return;
    
    setCurrentIndex(prev => {
      const next = prev - 1;
      if (next < 0) {
        return settings.loop ? images.length - 1 : prev;
      }
      return next;
    });
  }, [images.length, settings.loop]);

  const togglePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const handleImageChange = useCallback((image: Image, index: number) => {
    setCurrentIndex(index);
    onImageChange?.(image, index);
  }, [onImageChange]);

  const handleClose = useCallback(() => {
    // Clean up timeouts
    if (preloadTimeoutRef.current) {
      clearTimeout(preloadTimeoutRef.current);
    }
    
    onClose?.();
  }, [onClose]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (preloadTimeoutRef.current) {
        clearTimeout(preloadTimeoutRef.current);
      }
    };
  }, []);

  if (images.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">No Images Available</h2>
          <p className="text-gray-400 mb-6">No images found in the current playlist</p>
          {onClose && (
            <button
              onClick={handleClose}
              className="bg-white text-black px-6 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-50">
      {/* Preload Monitor Overlay */}
      {showMonitor && (
        <div className="absolute top-4 right-4 z-10 max-w-sm">
          <SmartPreloadMonitor
            playlistId={playlist?.id}
            showControls={false}
            autoStart={false}
          />
        </div>
      )}

      {/* Preload Status Indicator */}
      {enableSmartPreload && playlist && (
        <div className="absolute top-4 left-4 z-10">
          <div className="bg-black bg-opacity-75 text-white px-3 py-2 rounded-lg">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                preloadComplete ? 'bg-green-500' : 
                preloadStarted ? 'bg-yellow-500 animate-pulse' : 'bg-gray-500'
              }`}></div>
              <span className="text-sm">
                {preloadComplete ? 'Preload Ready' : 
                 preloadStarted ? 'Preloading...' : 'Preparing...'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Monitor Button */}
      {enableSmartPreload && playlist && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
          <button
            onClick={() => setShowMonitor(!showMonitor)}
            className="bg-black bg-opacity-75 text-white px-3 py-2 rounded-lg hover:bg-opacity-90 transition-colors text-sm"
          >
            {showMonitor ? 'Hide' : 'Show'} Preload Monitor
          </button>
        </div>
      )}

      {/* Main Slideshow */}
      <FullscreenSlideshow
        images={images}
        playlist={playlist}
        initialSettings={settings}
        onClose={handleClose}
        onImageChange={handleImageChange}
      />
    </div>
  );
};

export default SmartSlideshow;






