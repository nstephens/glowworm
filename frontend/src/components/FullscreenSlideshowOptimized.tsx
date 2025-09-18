import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Image, Playlist } from '../types';
import { displayLogger } from '../utils/logger';

interface SlideshowSettings {
  interval: number;
  showInfo: boolean;
  loop: boolean;
  volume: number;
}

interface FullscreenSlideshowProps {
  images: Image[];
  playlist?: Playlist;
  initialSettings?: Partial<SlideshowSettings>;
  onClose?: () => void;
  onImageChange?: (image: Image, index: number) => void;
}

const defaultSettings: SlideshowSettings = {
  interval: 30,
  showInfo: false,
  loop: true,
  volume: 0.5,
};

export const FullscreenSlideshowOptimized: React.FC<FullscreenSlideshowProps> = ({
  images,
  playlist,
  initialSettings = {},
  onClose,
  onImageChange
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [settings, setSettings] = useState<SlideshowSettings>({ ...defaultSettings, ...initialSettings });
  
  // Debug settings
  displayLogger.debug('🎬 OPTIMIZED: Initial settings:', initialSettings);
  displayLogger.debug('🎬 OPTIMIZED: Current settings:', settings);
  
  // Update settings when initialSettings change
  useEffect(() => {
    displayLogger.debug('🎬 OPTIMIZED: Updating settings from initialSettings:', initialSettings);
    setSettings(prevSettings => ({ ...prevSettings, ...initialSettings }));
  }, [initialSettings]);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showControls, setShowControls] = useState(false);
  const [imageOpacity, setImageOpacity] = useState(1);
  const [nextImageOpacity, setNextImageOpacity] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Landscape stacking state
  const [topImageOpacity, setTopImageOpacity] = useState(0);
  const [bottomImageOpacity, setBottomImageOpacity] = useState(0);
  const [topImageTransform, setTopImageTransform] = useState('translateX(5%)');
  const [bottomImageTransform, setBottomImageTransform] = useState('translateX(-5%)');
  
  // Movement animation state
  const [movementTransform, setMovementTransform] = useState('translateX(0%)');
  const [movementObjectPosition, setMovementObjectPosition] = useState('center');
  const [movementDirection, setMovementDirection] = useState<'left' | 'right'>('right');

  // Calculate display mode logic early to avoid hoisting issues
  const currentImage = images[currentIndex];
  const isCurrentImageLandscape = currentImage && currentImage.width && currentImage.height && currentImage.width > currentImage.height;
  const nextImageData = images[currentIndex + 1];
  const isNextImageLandscape = nextImageData && nextImageData.width && nextImageData.height && nextImageData.width > nextImageData.height;
  const shouldShowSplitScreen = (playlist?.display_mode === 'auto_sort' || playlist?.display_mode === 'default') && isCurrentImageLandscape && isNextImageLandscape;
  const shouldShowMovement = playlist?.display_mode === 'movement' && isCurrentImageLandscape;
  const imageAspectRatio = currentImage && currentImage.width && currentImage.height ? currentImage.width / currentImage.height : 1;
  const displayAspectRatio = window.innerWidth / window.innerHeight;
  const isImageSignificantlyWider = imageAspectRatio > displayAspectRatio * 1.2; // 20% wider than display (less restrictive)

  // Handle split-screen fade-in when images change
  useEffect(() => {
    if (images.length > 0) {
      displayLogger.debug('🎬 OPTIMIZED: Setting up fade-in for split-screen:', shouldShowSplitScreen);
      
      // Always ensure movement starts centered when images change
      setMovementObjectPosition('center');
      
      if (shouldShowSplitScreen) {
        // Reset and fade in split-screen images
        setTopImageOpacity(0);
        setBottomImageOpacity(0);
        setTopImageTransform('translateX(5%)');
        setBottomImageTransform('translateX(-5%)');
        
        // Fade in top image first
        setTimeout(() => {
          setTopImageOpacity(1);
          setTopImageTransform('translateX(0)');
          displayLogger.debug('🎬 OPTIMIZED: Top image faded in');
        }, 100);
        
        // Fade in bottom image after delay
        setTimeout(() => {
          setBottomImageOpacity(1);
          setBottomImageTransform('translateX(0)');
          displayLogger.debug('🎬 OPTIMIZED: Bottom image faded in');
        }, 1000);
      } else {
        // Single image mode
        setImageOpacity(1);
        displayLogger.debug('🎬 OPTIMIZED: Single image mode');
      }
    }
  }, [currentIndex, images, shouldShowSplitScreen]);

  // Handle movement animation for landscape images
  useEffect(() => {
    displayLogger.debug(`🎬 MOVEMENT DEBUG: shouldShowMovement=${shouldShowMovement}, isCurrentImageLandscape=${isCurrentImageLandscape}`);
    displayLogger.debug(`🎬 MOVEMENT DEBUG: imageAspectRatio=${imageAspectRatio}, displayAspectRatio=${displayAspectRatio}`);
    
    if (shouldShowMovement && isCurrentImageLandscape) {
      // Calculate safe pan distance to avoid showing borders
      // Only pan if image is wider than display
      const imageIsWiderThanDisplay = imageAspectRatio > displayAspectRatio;
      
      if (imageIsWiderThanDisplay) {
        // Calculate how much extra width the image has beyond the display
        const extraWidthRatio = imageAspectRatio / displayAspectRatio - 1;
        // Pan by a percentage of the extra width (not the display width) - slowed down by 2% total
        const panDistance = Math.min(49.5, Math.max(9.9, extraWidthRatio * 29.4)); // 9.9-49.5% of extra width (2% slower)
        
        const newDirection = Math.random() > 0.5 ? 'left' : 'right';
        setMovementDirection(newDirection);
        
        // Reset position immediately when image changes
        setMovementObjectPosition('center');
        
        // Start slow pan after 1 second
        const movementTimer = setTimeout(() => {
          const endPosition = newDirection === 'left' ? `${50 - panDistance}% center` : `${50 + panDistance}% center`;
          setMovementObjectPosition(endPosition);
          displayLogger.debug(`🎬 MOVEMENT: object-position to: ${endPosition}`);
        }, 1000);
        
        return () => clearTimeout(movementTimer);
      } else {
        setMovementObjectPosition('center');
      }
    } else {
      // Reset movement state
      setMovementObjectPosition('center');
    }
  }, [currentIndex, shouldShowMovement, isCurrentImageLandscape, settings.interval, imageAspectRatio, displayAspectRatio]);

  
  const slideshowRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mouseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set());

  // Optimized image preloading for Pi
  const preloadImage = useCallback((imageUrl: string) => {
    if (preloadedImages.has(imageUrl)) return;
    
    const img = new Image();
    img.onload = () => {
      setPreloadedImages(prev => new Set([...prev, imageUrl]));
    };
    img.src = imageUrl;
  }, [preloadedImages]);

  // Preload next few images (accounting for potential split-screen advancement)
  useEffect(() => {
    // Preload more images since we might advance by 2 for split-screen
    const nextImages = images.slice(currentIndex + 1, currentIndex + 6);
    nextImages.forEach(img => preloadImage(img.url));
  }, [currentIndex, images, preloadImage]);

  const nextImage = images[(currentIndex + 1) % images.length];

  // Optimized transition function for Pi
  const performTransition = useCallback(() => {
    if (isTransitioning || images.length <= 1) return;
    
    setIsTransitioning(true);
    
    // Check if we're currently showing split-screen
    const currentImg = images[currentIndex];
    const nextImg = images[currentIndex + 1];
    const isCurrentLandscape = currentImg && currentImg.width && currentImg.height && currentImg.width > currentImg.height;
    const isNextLandscape = nextImg && nextImg.width && nextImg.height && nextImg.width > nextImg.height;
    const isShowingSplitScreen = isCurrentLandscape && isNextLandscape;
    
    displayLogger.debug('🎬 OPTIMIZED: Transitioning from split-screen:', isShowingSplitScreen);
    
    // Use requestAnimationFrame for smoother transitions on Pi
    const startTransition = () => {
      // Reset movement position to center during transition
      setMovementObjectPosition('center');
      
      if (isShowingSplitScreen) {
        // Fade out both split-screen images
        setTopImageOpacity(0);
        setBottomImageOpacity(0);
        setTopImageTransform('translateX(5%)');
        setBottomImageTransform('translateX(-5%)');
        displayLogger.debug('🎬 OPTIMIZED: Fading out split-screen images');
      } else {
        // Fade out single image
        setImageOpacity(0);
        displayLogger.debug('🎬 OPTIMIZED: Fading out single image');
      }
      
      // After fade out completes, change image and fade in
      setTimeout(() => {
        // Advance by 2 if we were showing split-screen, otherwise advance by 1
        const advanceBy = isShowingSplitScreen ? 2 : 1;
        const nextIndex = (currentIndex + advanceBy) % images.length;
        setCurrentIndex(nextIndex);
        
        // Ensure new image starts centered for movement
        setMovementObjectPosition('center');
        
        displayLogger.debug(`🎬 OPTIMIZED: Advanced by ${advanceBy}, now at index ${nextIndex}`);
        
        // Notify parent of image change
        if (onImageChange) {
          onImageChange(images[nextIndex], nextIndex);
        }
        
        // End transition
        setTimeout(() => {
          setIsTransitioning(false);
        }, 50);
      }, 300); // Shorter transition for better Pi performance
    };
    
    requestAnimationFrame(startTransition);
  }, [currentIndex, images, isTransitioning, onImageChange]);

  // Auto-advance slideshow
  useEffect(() => {
    if (!isPlaying || images.length <= 1) return;

    displayLogger.debug('🎬 OPTIMIZED: Setting up auto-advance with interval:', settings.interval, 'seconds');

    intervalRef.current = setInterval(() => {
      performTransition();
    }, settings.interval * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, settings.interval, images.length, performTransition]);

  // Mouse movement handlers
  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    
    if (mouseTimeoutRef.current) {
      clearTimeout(mouseTimeoutRef.current);
    }
    
    mouseTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setShowControls(false);
  }, []);

  // Keyboard handlers
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose?.();
          break;
        case ' ':
          e.preventDefault();
          setIsPlaying(!isPlaying);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (!isTransitioning) {
            const prevIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
            setCurrentIndex(prevIndex);
            if (onImageChange) {
              onImageChange(images[prevIndex], prevIndex);
            }
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (!isTransitioning) {
            performTransition();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onClose, isPlaying, currentIndex, images, isTransitioning, performTransition, onImageChange]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
      if (mouseTimeoutRef.current) clearTimeout(mouseTimeoutRef.current);
    };
  }, []);

  if (!currentImage) {
    return (
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        <div className="text-white text-xl">No images to display</div>
      </div>
    );
  }
  
  displayLogger.debug(`🎬 OPTIMIZED: Playlist display_mode: ${playlist?.display_mode}`);
  displayLogger.debug(`🎬 OPTIMIZED: Should show split-screen: ${shouldShowSplitScreen}`);
  displayLogger.debug(`🎬 OPTIMIZED: Should show movement: ${shouldShowMovement}`);
  displayLogger.debug(`🎬 OPTIMIZED: Is current image landscape: ${isCurrentImageLandscape}`);
  displayLogger.debug(`🎬 OPTIMIZED: Movement transform: ${movementTransform}`);
  
  displayLogger.debug(`🎬 OPTIMIZED: Image ${currentIndex + 1}: ${currentImage?.original_filename} (${currentImage?.width}x${currentImage?.height}) - ${isCurrentImageLandscape ? 'landscape' : 'portrait'}`);
  if (nextImageData) {
    displayLogger.debug(`🎬 OPTIMIZED: Next image ${currentIndex + 2}: ${nextImageData.original_filename} (${nextImageData.width}x${nextImageData.height}) - ${isNextImageLandscape ? 'landscape' : 'portrait'}`);
  }
  displayLogger.debug(`🎬 OPTIMIZED: Should show split-screen: ${shouldShowSplitScreen}`);

  return (
    <div
      ref={slideshowRef}
      className="fixed inset-0 bg-black z-50 cursor-none fullscreen-slideshow"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ 
        cursor: showControls ? 'default' : 'none',
        // Hardware acceleration for Pi
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
        perspective: '1000px'
      }}
    >
      {/* Main Image Container with GPU acceleration */}
      <div 
        className="relative w-full h-full flex items-center justify-center"
        style={{
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden'
        }}
      >
        {shouldShowSplitScreen ? (
          // Split-screen display for landscape images
          <div className="w-full h-full flex flex-col">
            {/* Top half - current landscape image */}
            <div className="relative w-full h-1/2">
              <img
                src={currentImage.url}
                alt={currentImage.original_filename}
                className="w-full h-full object-cover"
                style={{ 
                  opacity: topImageOpacity,
                  transform: topImageTransform,
                  // Hardware acceleration
                  backfaceVisibility: 'hidden',
                  willChange: 'opacity, transform',
                  // Optimized transition for Pi
                  transition: 'opacity 300ms ease-out, transform 300ms ease-out'
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
                className="w-full h-full object-cover"
                style={{ 
                  opacity: bottomImageOpacity,
                  transform: bottomImageTransform,
                  // Hardware acceleration
                  backfaceVisibility: 'hidden',
                  willChange: 'opacity, transform',
                  // Optimized transition for Pi
                  transition: 'opacity 300ms ease-out, transform 300ms ease-out'
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
            className="w-full h-full object-cover"
            style={{ 
              opacity: imageOpacity,
              // Hardware acceleration
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
              willChange: 'opacity',
              // Use object-position for movement instead of transform
              objectPosition: shouldShowMovement && isCurrentImageLandscape ? movementObjectPosition : 'center',
              // Smooth transition for opacity and object-position
              transition: shouldShowMovement && isCurrentImageLandscape ? 
                'opacity 300ms ease-out, object-position 30s ease-in-out' : 'opacity 300ms ease-out'
            }}
            onLoad={() => {}}
            onError={() => {}}
          />
        )}
      </div>

      {/* Image Info Overlay */}
      {settings.showInfo && (
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white p-4 rounded-lg max-w-md">
          <div>
            <h3 className="font-semibold text-lg mb-2">{currentImage.original_filename}</h3>
            {currentImage.width && currentImage.height && (
              <p className="text-xs text-gray-400 mb-2">
                {currentImage.width} × {currentImage.height}
              </p>
            )}
            {playlist && (
              <p className="text-sm text-gray-300 mb-2">Playlist: {playlist.name}</p>
            )}
            <p className="text-sm text-gray-300">
              {currentIndex + 1} of {images.length}
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      {showControls && (
        <>
          {/* Play/Pause Button */}
          <div className="absolute top-4 left-4 pointer-events-auto">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="bg-black bg-opacity-75 text-white p-3 rounded-full hover:bg-opacity-90 transition-colors"
            >
              {isPlaying ? '⏸️' : '▶️'}
            </button>
          </div>

          {/* Close Button */}
          <div className="absolute top-4 right-4 pointer-events-auto">
            <button
              onClick={onClose}
              className="bg-black bg-opacity-75 text-white p-3 rounded-full hover:bg-opacity-90 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Navigation */}
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 pointer-events-auto">
            <button
              onClick={() => {
                if (!isTransitioning) {
                  const prevIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
                  setCurrentIndex(prevIndex);
                  if (onImageChange) {
                    onImageChange(images[prevIndex], prevIndex);
                  }
                }
              }}
              className="bg-black bg-opacity-75 text-white p-3 rounded-full hover:bg-opacity-90 transition-colors"
            >
              ←
            </button>
          </div>

          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 pointer-events-auto">
            <button
              onClick={() => {
                if (!isTransitioning) {
                  performTransition();
                }
              }}
              className="bg-black bg-opacity-75 text-white p-3 rounded-full hover:bg-opacity-90 transition-colors"
            >
              →
            </button>
          </div>

          {/* Progress Indicator */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 pointer-events-auto">
            <div className="flex items-center space-x-2 bg-black bg-opacity-75 text-white p-2 rounded-lg">
              <span className="text-sm">
                {currentIndex + 1} / {images.length}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
