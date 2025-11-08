import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause, 
  SkipForward, 
  SkipBack, 
  Volume2, 
  VolumeX,
  Settings,
  Maximize,
  Minimize,
  RotateCcw,
  Info
} from 'lucide-react';
import type { Image, Playlist } from '../types';

interface SlideshowSettings {
  autoPlay: boolean;
  interval: number; // in seconds
  transition: 'fade' | 'slide' | 'zoom' | 'none';
  showControls: boolean;
  showInfo: boolean;
  shuffle: boolean;
  loop: boolean;
  volume: number; // 0-1
}

interface FullscreenSlideshowProps {
  images: Image[];
  playlist?: Playlist;
  initialSettings?: Partial<SlideshowSettings>;
  onClose?: () => void;
  onImageChange?: (image: Image, index: number) => void;
}

const defaultSettings: SlideshowSettings = {
  autoPlay: true,
  interval: 5,
  transition: 'fade',
  showControls: true,
  showInfo: true,
  shuffle: false,
  loop: true,
  volume: 0.5,
};

export const FullscreenSlideshow: React.FC<FullscreenSlideshowProps> = ({
  images,
  playlist,
  initialSettings = {},
  onClose,
  onImageChange
}) => {
  console.log('🎬 FullscreenSlideshow component rendered with:', {
    imagesLength: images.length,
    playlist: playlist?.name,
    initialSettings
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(initialSettings.autoPlay ?? defaultSettings.autoPlay);
  const [settings, setSettings] = useState<SlideshowSettings>({ ...defaultSettings, ...initialSettings });
  const [showSettings, setShowSettings] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null);
  const [shuffledImages, setShuffledImages] = useState<Image[]>([]);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showBlackScreen, setShowBlackScreen] = useState(false);
  const [imageOpacity, setImageOpacity] = useState(0);
  const [topImageOpacity, setTopImageOpacity] = useState(0);
  const [bottomImageOpacity, setBottomImageOpacity] = useState(0);
  const [topImageTransform, setTopImageTransform] = useState('translateX(5%)');
  const [bottomImageTransform, setBottomImageTransform] = useState('translateX(-5%)');

  // Update settings when initialSettings change
  useEffect(() => {
    setSettings(prev => ({ ...prev, ...initialSettings }));
  }, [initialSettings]);

  // Fade in first image on component mount or when images change
  useEffect(() => {
    if (shuffledImages.length > 0) {
      console.log('🎬 SLIDESHOW: Starting fade-in process for', shuffledImages.length, 'images');
      // Reset all opacities and transforms to 0 first
      setImageOpacity(0);
      setTopImageOpacity(0);
      setBottomImageOpacity(0);
      setTopImageTransform('translateX(5%)');
      setBottomImageTransform('translateX(-5%)');
      
      // Small delay to ensure the image is rendered before fading in
      setTimeout(() => {
        console.log('🎬 SLIDESHOW: Calling handleStaggeredFadeIn...');
        handleStaggeredFadeIn();
      }, 100);
    }
  }, [shuffledImages, currentIndex, handleStaggeredFadeIn]);
  
  const slideshowRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Helper function to handle staggered fade-in and slide-in for split-screen images
  const handleStaggeredFadeIn = useCallback(() => {
    console.log('🎬 FADE-IN: handleStaggeredFadeIn called');
    // Use the current state of currentIndex after it's been updated
    const currentImg = shuffledImages[currentIndex];
    const nextImg = shuffledImages[currentIndex + 1];
    const isCurrentLandscape = currentImg && currentImg.width && currentImg.height && currentImg.width > currentImg.height;
    const isNextLandscape = nextImg && nextImg.width && nextImg.height && nextImg.width > nextImg.height;
    const shouldShowSplitScreen = isCurrentLandscape && isNextLandscape;
    
    console.log('🎬 FADE-IN: Current index:', currentIndex);
    console.log('🎬 FADE-IN: Current image:', currentImg?.original_filename);
    console.log('🎬 FADE-IN: Next image:', nextImg?.original_filename);
    
    console.log(`🖼️ Image ${currentIndex + 1}: ${currentImg?.original_filename} (${currentImg?.width}x${currentImg?.height}) - ${isCurrentLandscape ? 'landscape' : 'portrait'}`);
    if (nextImg) {
      console.log(`🖼️ Next image ${currentIndex + 2}: ${nextImg.original_filename} (${nextImg.width}x${nextImg.height}) - ${isNextLandscape ? 'landscape' : 'portrait'}`);
    } else {
      console.log(`🖼️ No next image available`);
    }
    console.log(`🎬 Should show split-screen: ${shouldShowSplitScreen}`);
    console.log(`🎬 Current landscape: ${isCurrentLandscape}, Next landscape: ${isNextLandscape}`);
    
    if (shouldShowSplitScreen) {
      console.log('🎬 FADE-IN: Setting up split-screen mode');
      // Staggered slide-in for split-screen: top from right, then bottom from left
      // Start with full opacity so they're visible while sliding in
      setTopImageOpacity(1);
      setTopImageTransform('translateX(0)');
      console.log('🎬 FADE-IN: Set top image opacity to 1, transform to translateX(0)');
      setTimeout(() => {
        setBottomImageOpacity(1);
        setBottomImageTransform('translateX(0)');
        console.log('🎬 FADE-IN: Set bottom image opacity to 1, transform to translateX(0)');
      }, 1000); // 1 second delay
    } else {
      console.log('🎬 FADE-IN: Setting up single image mode');
      // Single image fade-in (no movement)
      setImageOpacity(1);
      console.log('🎬 FADE-IN: Set single image opacity to 1');
    }
  }, [shuffledImages, currentIndex]);

  // Shuffle images if needed
  useEffect(() => {
    if (settings.shuffle && images.length > 0) {
      const shuffled = [...images].sort(() => Math.random() - 0.5);
      setShuffledImages(shuffled);
    } else {
      setShuffledImages(images);
    }
  }, [images, settings.shuffle]);

  // Auto-play functionality
  useEffect(() => {
    if (isPlaying && shuffledImages.length > 0) {
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
  }, [isPlaying, settings.interval, shuffledImages.length, nextImage]);

  // Fullscreen functionality
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Controls auto-hide
  useEffect(() => {
    if (showControls) {
      if (controlsTimeout) {
        clearTimeout(controlsTimeout);
      }
      
      const timeout = setTimeout(() => {
        setShowControls(false);
      }, 3000);
      
      setControlsTimeout(timeout);
    }

    return () => {
      if (controlsTimeout) {
        clearTimeout(controlsTimeout);
      }
    };
  }, [showControls]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          previousImage();
          break;
        case 'ArrowRight':
        case ' ':
          e.preventDefault();
          nextImage();
          break;
        case 'Escape':
          e.preventDefault();
          if (isFullscreen) {
            exitFullscreen();
          } else if (onClose) {
            onClose();
          }
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          togglePlayPause();
          break;
        case 's':
        case 'S':
          e.preventDefault();
          setShowSettings(!showSettings);
          break;
        case 'i':
        case 'I':
          e.preventDefault();
          setSettings(prev => ({ ...prev, showInfo: !prev.showInfo }));
          break;
        case 'c':
        case 'C':
          e.preventDefault();
          setShowControls(!showControls);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [currentIndex, isPlaying, isFullscreen, showSettings, showControls]);

  const nextImage = useCallback(() => {
    if (shuffledImages.length === 0) return;
    
    // Start transition sequence
    setIsTransitioning(true);
    
    // Phase 1: Fade out current image (800ms) - SLOW AND DRAMATIC
    setImageOpacity(0);
    setTopImageOpacity(0);
    setBottomImageOpacity(0);
    setTopImageTransform('translateX(100%)');
    setBottomImageTransform('translateX(-100%)');
    
    setTimeout(() => {
      
      // Phase 2: Brief dramatic pause (500ms) - LONGER PAUSE
      setTimeout(() => {
        // Phase 3: Change image and fade in (1000ms) - SLOW FADE IN
        setCurrentIndex(prev => {
          // Check if current image is landscape and next image is also landscape
          const currentImg = shuffledImages[prev];
          const nextImg = shuffledImages[prev + 1];
          const isCurrentLandscape = currentImg.width && currentImg.height && currentImg.width > currentImg.height;
          const isNextLandscape = nextImg && nextImg.width && nextImg.height && nextImg.width > nextImg.height;
          
          // If we're showing split-screen (two landscape images), advance by 2
          const advanceBy = (isCurrentLandscape && isNextLandscape) ? 2 : 1;
          const next = prev + advanceBy;
          
          if (next >= shuffledImages.length) {
            return settings.loop ? 0 : prev;
          }
          return next;
        });
        
        // Phase 4: Transition complete - fade in will be handled by useEffect
        setTimeout(() => {
          setIsTransitioning(false);
        }, 300); // Brief delay for transition completion
      }, 300); // Brief pause
    }, 800); // Fade out duration - slightly faster
  }, [shuffledImages, settings.loop]);

  const previousImage = useCallback(() => {
    if (shuffledImages.length === 0) return;
    
    // Start transition sequence
    setIsTransitioning(true);
    
    // Phase 1: Fade out current image (800ms) - SLOW AND DRAMATIC
    setImageOpacity(0);
    setTopImageOpacity(0);
    setBottomImageOpacity(0);
    setTopImageTransform('translateX(100%)');
    setBottomImageTransform('translateX(-100%)');
    
    setTimeout(() => {
      
      // Phase 2: Brief dramatic pause (500ms) - LONGER PAUSE
      setTimeout(() => {
        // Phase 3: Change image and fade in (1000ms) - SLOW FADE IN
        setCurrentIndex(prev => {
          // Check if previous images form a landscape pair
          const prevImg = shuffledImages[prev - 1];
          const prevPrevImg = shuffledImages[prev - 2];
          const isPrevLandscape = prevImg && prevImg.width && prevImg.height && prevImg.width > prevImg.height;
          const isPrevPrevLandscape = prevPrevImg && prevPrevImg.width && prevPrevImg.height && prevPrevImg.width > prevPrevImg.height;
          
          // If previous two images are landscape, go back by 2
          const goBackBy = (isPrevLandscape && isPrevPrevLandscape) ? 2 : 1;
          const next = prev - goBackBy;
          
          if (next < 0) {
            return settings.loop ? shuffledImages.length - 1 : prev;
          }
          return next;
        });
        
        // Phase 4: Transition complete - fade in will be handled by useEffect
        setTimeout(() => {
          setIsTransitioning(false);
        }, 300); // Brief delay for transition completion
      }, 300); // Brief pause
    }, 800); // Fade out duration - slightly faster
  }, [shuffledImages, settings.loop]);

  const togglePlayPause = useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!slideshowRef.current) return;

    try {
      if (!isFullscreen) {
        await slideshowRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  }, [isFullscreen]);

  const exitFullscreen = useCallback(async () => {
    try {
      await document.exitFullscreen();
    } catch (error) {
      console.error('Exit fullscreen error:', error);
    }
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    // Don't hide controls immediately on mouse leave
  }, []);

  const updateSettings = useCallback((newSettings: Partial<SlideshowSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const resetSlideshow = useCallback(() => {
    setCurrentIndex(0);
    setIsPlaying(settings.autoPlay);
  }, [settings.autoPlay]);

  // Notify parent of image change
  useEffect(() => {
    if (shuffledImages.length > 0 && onImageChange) {
      onImageChange(shuffledImages[currentIndex], currentIndex);
    }
  }, [currentIndex, shuffledImages, onImageChange]);

  if (shuffledImages.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
        <div className="text-center text-white">
          <h2 className="text-2xl font-bold mb-4">No Images Available</h2>
          <p className="text-gray-400 mb-6">No images found in the current playlist</p>
          {onClose && (
            <button
              onClick={onClose}
              className="bg-white text-black px-6 py-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  const currentImage = shuffledImages[currentIndex];
  const progress = ((currentIndex + 1) / shuffledImages.length) * 100;
  
  // Check if current image is landscape and if we should show split-screen
  const isCurrentImageLandscape = currentImage.width && currentImage.height && currentImage.width > currentImage.height;
  const nextImageData = shuffledImages[currentIndex + 1];
  const isNextImageLandscape = nextImageData && nextImageData.width && nextImageData.height && nextImageData.width > nextImageData.height;
  const shouldShowSplitScreen = isCurrentImageLandscape && isNextImageLandscape;
  
  console.log(`🎬 RENDER: Image ${currentIndex + 1}: ${currentImage?.original_filename} (${currentImage?.width}x${currentImage?.height}) - ${isCurrentImageLandscape ? 'landscape' : 'portrait'}`);
  if (nextImageData) {
    console.log(`🎬 RENDER: Next image ${currentIndex + 2}: ${nextImageData.original_filename} (${nextImageData.width}x${nextImageData.height}) - ${isNextImageLandscape ? 'landscape' : 'portrait'}`);
  }
  console.log(`🎬 RENDER: Should show split-screen: ${shouldShowSplitScreen}`);
  console.log(`🎬 RENDER: Top image opacity: ${topImageOpacity}, transform: ${topImageTransform}`);
  console.log(`🎬 RENDER: Bottom image opacity: ${bottomImageOpacity}, transform: ${bottomImageTransform}`);
  console.log(`🎬 RENDER: Single image opacity: ${imageOpacity}`);
  
  

  return (
    <div
      ref={slideshowRef}
      className="fixed inset-0 bg-black z-50 cursor-none fullscreen-slideshow"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: showControls ? 'default' : 'none' }}
    >
      {/* TEST ELEMENT - Should always be visible */}
      <div className="fixed top-4 left-4 bg-red-500 text-white p-2 rounded z-[100] text-sm">
        🚨 TEST: FullscreenSlideshow is rendering!
      </div>
      {/* Main Image */}
      <div className="relative w-full h-full flex items-center justify-center">
        {shouldShowSplitScreen ? (
          // Split-screen display for landscape images
          <div className="w-full h-full flex flex-col">
            {/* Top half - current landscape image */}
            <div className="relative w-full h-1/2">
              <img
                src={currentImage.url}
                alt={currentImage.original_filename}
                className="w-full h-full object-cover transition-all duration-1000 ease-in-out"
                style={{ 
                  opacity: topImageOpacity,
                  transform: topImageTransform
                }}
                onLoad={() => {}}
                onError={() => {}}
              />
            </div>
            
            {/* Horizontal divider */}
            <div className="w-full h-1 bg-black"></div>
            
            {/* Bottom half - next landscape image */}
            <div className="relative w-full h-1/2">
              <img
                src={nextImageData.url}
                alt={nextImageData.original_filename}
                className="w-full h-full object-cover transition-all duration-1000 ease-in-out"
                style={{ 
                  opacity: bottomImageOpacity,
                  transform: bottomImageTransform
                }}
                onLoad={() => {}}
                onError={() => {}}
              />
            </div>
          </div>
        ) : (
          // Single image display for portrait images or single landscape images
          <img
            src={currentImage.url}
            alt={currentImage.original_filename}
            className="w-full h-full object-cover transition-all duration-1000 ease-in-out"
            style={{ opacity: imageOpacity }}
            onLoad={() => {}}
            onError={() => {}}
          />
        )}

        {/* Image Info Overlay - ALWAYS VISIBLE FOR DEBUGGING */}
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white p-4 rounded-lg max-w-md z-50">
          {/* Always visible debug test */}
          <div className="mb-2 p-2 bg-blue-900 bg-opacity-50 rounded text-xs">
            <p>🔧 DEBUG: Info overlay is working!</p>
            <p>Images loaded: {shuffledImages.length}</p>
            <p>Current index: {currentIndex}</p>
            <p>Show info setting: {settings.showInfo ? 'true' : 'false'}</p>
          </div>
            {shouldShowSplitScreen ? (
              // Split-screen info
              <div>
                <h3 className="font-semibold text-lg mb-2">Split-Screen Display</h3>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-medium text-gray-200">Top: {currentImage.original_filename}</p>
                    {currentImage.width && currentImage.height && (
                      <p className="text-xs text-gray-400">{currentImage.width} × {currentImage.height}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-200">Bottom: {nextImageData.original_filename}</p>
                    {nextImageData.width && nextImageData.height && (
                      <p className="text-xs text-gray-400">{nextImageData.width} × {nextImageData.height}</p>
                    )}
                  </div>
                </div>
                {playlist && (
                  <p className="text-sm text-gray-300 mt-2">Playlist: {playlist.name}</p>
                )}
                <p className="text-sm text-gray-300">
                  {currentIndex + 1}-{currentIndex + 2} of {shuffledImages.length}
                </p>
              </div>
            ) : (
              // Single image info
              <div>
                <h3 className="font-semibold text-lg mb-2">{currentImage.original_filename}</h3>
                {playlist && (
                  <p className="text-sm text-gray-300 mb-1">Playlist: {playlist.name}</p>
                )}
                <p className="text-sm text-gray-300">
                  {currentIndex + 1} of {shuffledImages.length}
                </p>
                {currentImage.width && currentImage.height && (
                  <p className="text-sm text-gray-300">
                    {currentImage.width} × {currentImage.height}
                  </p>
                )}
                {currentImage.file_size && (
                  <p className="text-sm text-gray-300">
                    {(currentImage.file_size / 1024 / 1024).toFixed(1)} MB
                  </p>
                )}
                {/* Debug info */}
                <div className="mt-2 p-2 bg-red-900 bg-opacity-50 rounded text-xs">
                  <p>Debug: {isCurrentImageLandscape ? 'Landscape' : 'Portrait'}</p>
                  <p>Next: {nextImageData ? (isNextImageLandscape ? 'Landscape' : 'Portrait') : 'None'}</p>
                  <p>Split: {shouldShowSplitScreen ? 'Yes' : 'No'}</p>
                </div>
              </div>
            )}
          </div>

        {/* Progress Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-800">
          <div
            className="h-full bg-white transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Controls Overlay */}
      {showControls && (
        <div className="absolute inset-0 pointer-events-none">
          {/* Top Controls */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-auto">
            <div className="flex items-center space-x-2">
              {playlist && (
                <div className="bg-black bg-opacity-75 text-white px-3 py-1 rounded-lg">
                  <span className="text-sm font-medium">{playlist.name}</span>
                </div>
              )}
              <div className="bg-black bg-opacity-75 text-white px-3 py-1 rounded-lg">
                <span className="text-sm">{currentIndex + 1} / {shuffledImages.length}</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={toggleFullscreen}
                className="bg-black bg-opacity-75 text-white p-2 rounded-lg hover:bg-opacity-90 transition-colors"
                title={isFullscreen ? 'Exit Fullscreen (F)' : 'Enter Fullscreen (F)'}
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="bg-black bg-opacity-75 text-white p-2 rounded-lg hover:bg-opacity-90 transition-colors"
                title="Settings (S)"
              >
                <Settings className="w-5 h-5" />
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="bg-black bg-opacity-75 text-white p-2 rounded-lg hover:bg-opacity-90 transition-colors"
                  title="Close (Esc)"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Center Navigation */}
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 pointer-events-auto">
            <button
              onClick={previousImage}
              className="bg-black bg-opacity-75 text-white p-3 rounded-full hover:bg-opacity-90 transition-colors"
              title="Previous (←)"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          </div>

          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-auto">
            <button
              onClick={nextImage}
              className="bg-black bg-opacity-75 text-white p-3 rounded-full hover:bg-opacity-90 transition-colors"
              title="Next (→)"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Bottom Controls */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-auto">
            <div className="flex items-center space-x-2 bg-black bg-opacity-75 text-white p-2 rounded-lg">
              <button
                onClick={() => setCurrentIndex(0)}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                title="First Image"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              
              <button
                onClick={previousImage}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                title="Previous (←)"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              
              <button
                onClick={togglePlayPause}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                title={isPlaying ? 'Pause (P)' : 'Play (P)'}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              
              <button
                onClick={nextImage}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                title="Next (→)"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              
              <button
                onClick={() => setCurrentIndex(shuffledImages.length - 1)}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                title="Last Image"
              >
                <SkipForward className="w-5 h-5" />
              </button>
              
              <div className="w-px h-6 bg-gray-600 mx-2" />
              
              <button
                onClick={resetSlideshow}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                title="Reset"
              >
                <RotateCcw className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="absolute top-16 right-4 bg-black bg-opacity-90 text-white p-6 rounded-lg max-w-sm pointer-events-auto">
          <h3 className="text-lg font-semibold mb-4">Slideshow Settings</h3>
          
          <div className="space-y-4">
            {/* Auto Play */}
            <div className="flex items-center justify-between">
              <label className="text-sm">Auto Play</label>
              <input
                type="checkbox"
                checked={settings.autoPlay}
                onChange={(e) => updateSettings({ autoPlay: e.target.checked })}
                className="rounded"
              />
            </div>

            {/* Interval */}
            <div>
              <label className="text-sm block mb-2">
                Interval: {settings.interval}s
              </label>
              <input
                type="range"
                min="1"
                max="30"
                value={settings.interval}
                onChange={(e) => updateSettings({ interval: parseInt(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Transition */}
            <div>
              <label className="text-sm block mb-2">Transition</label>
              <select
                value={settings.transition}
                onChange={(e) => updateSettings({ transition: e.target.value as any })}
                className="w-full bg-gray-800 text-white rounded px-2 py-1"
              >
                <option value="fade">Fade</option>
                <option value="slide">Slide</option>
                <option value="zoom">Zoom</option>
                <option value="none">None</option>
              </select>
            </div>

            {/* Loop */}
            <div className="flex items-center justify-between">
              <label className="text-sm">Loop</label>
              <input
                type="checkbox"
                checked={settings.loop}
                onChange={(e) => updateSettings({ loop: e.target.checked })}
                className="rounded"
              />
            </div>

            {/* Shuffle */}
            <div className="flex items-center justify-between">
              <label className="text-sm">Shuffle</label>
              <input
                type="checkbox"
                checked={settings.shuffle}
                onChange={(e) => updateSettings({ shuffle: e.target.checked })}
                className="rounded"
              />
            </div>

            {/* Show Info */}
            <div className="flex items-center justify-between">
              <label className="text-sm">Show Info</label>
              <input
                type="checkbox"
                checked={settings.showInfo}
                onChange={(e) => updateSettings({ showInfo: e.target.checked })}
                className="rounded"
              />
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-600">
            <h4 className="text-sm font-medium mb-2">Keyboard Shortcuts</h4>
            <div className="text-xs space-y-1 text-gray-300">
              <div>← → : Navigate</div>
              <div>Space : Next</div>
              <div>P : Play/Pause</div>
              <div>F : Fullscreen</div>
              <div>S : Settings</div>
              <div>I : Toggle Info</div>
              <div>C : Toggle Controls</div>
              <div>Esc : Close</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FullscreenSlideshow;

