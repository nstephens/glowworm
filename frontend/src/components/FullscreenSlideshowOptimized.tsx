import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Image, Playlist } from '../types';
import { displayLogger } from '../utils/logger';
import { displayDeviceLogger } from '../services/displayDeviceLogger';
import { getSmartImageUrlFromImage } from '../utils/imageUrls';
import { transitionLogger } from '../services/transitionLogger';
import { KenBurnsPlus } from './effects/KenBurnsPlus';
import { SoftGlow } from './effects/SoftGlow';
import { AmbientPulse } from './effects/AmbientPulse';
import { DreamyReveal } from './effects/DreamyReveal';
import { StackedReveal } from './effects/StackedReveal';
import { CinematicBars } from './effects/CinematicBars';
import { ColorHarmony } from './effects/ColorHarmony';
import { ParallaxDepth } from './effects/ParallaxDepth';

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
  deviceToken?: string;
  displayResolution?: { width: number; height: number } | null;
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
  onImageChange,
  deviceToken,
  displayResolution
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
  const [imagesLoaded, setImagesLoaded] = useState<Set<number>>(new Set());
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [nextImageReady, setNextImageReady] = useState(false);
  const [waitingForLoad, setWaitingForLoad] = useState(false);
  
  // Soft Glow brightness state
  const [imageBrightness, setImageBrightness] = useState(1.0);
  const [nextImageBrightness, setNextImageBrightness] = useState(1.3);
  
  // Dreamy Reveal state - tracks when a new image should be revealed
  const [isDreamyRevealing, setIsDreamyRevealing] = useState(false);
  
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
  const shouldShowStackedReveal = playlist?.display_mode === 'stacked_reveal' && isCurrentImageLandscape && isNextImageLandscape;
  const shouldShowParallaxDepth = playlist?.display_mode === 'parallax_depth';
  const shouldShowMovement = playlist?.display_mode === 'movement' && isCurrentImageLandscape;
  const shouldShowKenBurns = playlist?.display_mode === 'ken_burns_plus';
  const shouldShowSoftGlow = playlist?.display_mode === 'soft_glow';
  const shouldShowAmbientPulse = playlist?.display_mode === 'ambient_pulse';
  const shouldShowDreamyReveal = playlist?.display_mode === 'dreamy_reveal';
  const shouldShowCinematicBars = playlist?.display_mode === 'cinematic_bars' && isCurrentImageLandscape;
  const shouldShowColorHarmony = playlist?.display_mode === 'color_harmony';
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

  // Trigger Dreamy Reveal on initial load and when first image appears
  useEffect(() => {
    if (shouldShowDreamyReveal && images.length > 0) {
      // Trigger reveal for the first image
      setTimeout(() => {
        setIsDreamyRevealing(true);
      }, 100);
    }
  }, [shouldShowDreamyReveal, images.length]);
  
  const slideshowRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mouseTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [preloadedImages, setPreloadedImages] = useState<Set<string>>(new Set());

  // Optimized image preloading for Pi
  const preloadImage = useCallback((image: Image, markAsLoaded = false) => {
    if (!image) return;
    
    // Generate the smart URL for this image
    const imageUrl = getSmartImageUrlFromImage(image, deviceToken);
    
    if (preloadedImages.has(imageUrl)) {
      if (markAsLoaded) setImagesLoaded(prev => new Set([...prev, image.id]));
      return;
    }
    
    displayLogger.debug(`🖼️ Preloading image: ${image.original_filename}`);
    const img = new Image();
    img.onload = () => {
      displayLogger.debug(`✅ Preloaded: ${image.original_filename}`);
      setPreloadedImages(prev => new Set([...prev, imageUrl]));
      if (markAsLoaded) setImagesLoaded(prev => new Set([...prev, image.id]));
    };
    img.onerror = () => {
      displayLogger.error(`❌ Failed to preload: ${image.original_filename}`);
    };
    img.src = imageUrl;
  }, [preloadedImages, deviceToken]);

  // Preload initial images when slideshow starts
  useEffect(() => {
    if (images.length === 0 || !isInitialLoad) return;
    
    displayLogger.debug('🎬 Initial load: Preloading first batch of images');
    
    // Preload first 20 images aggressively
    const initialImages = images.slice(0, Math.min(20, images.length));
    initialImages.forEach(img => preloadImage(img, true));
    
    // Mark initial load as complete once first image is loaded
    const checkInterval = setInterval(() => {
      if (imagesLoaded.size > 0) {
        setIsInitialLoad(false);
        displayLogger.debug('🎬 Initial preload phase complete');
        clearInterval(checkInterval);
      }
    }, 100);
    
    // Also set a max timeout to prevent indefinite loading
    const timeout = setTimeout(() => {
      setIsInitialLoad(false);
      displayLogger.debug('🎬 Initial preload timeout reached');
      clearInterval(checkInterval);
    }, 5000);
    
    return () => {
      clearTimeout(timeout);
      clearInterval(checkInterval);
    };
  }, [images, isInitialLoad, preloadImage, imagesLoaded.size]);

  // Aggressively preload upcoming images as slideshow progresses
  useEffect(() => {
    if (images.length === 0 || isInitialLoad) return;
    
    // Preload more images since we might advance by 2 for split-screen
    // Preload next 10 images for smooth transitions
    const nextImages = images.slice(currentIndex + 1, currentIndex + 11);
    nextImages.forEach(img => preloadImage(img));
    
    // Also preload images before current (for manual navigation)
    const prevImages = images.slice(Math.max(0, currentIndex - 3), currentIndex);
    prevImages.forEach(img => preloadImage(img));
  }, [currentIndex, images, isInitialLoad, preloadImage]);

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
    
    // Start transition logging
    transitionLogger.startTransition(currentIndex);
    
    // Use requestAnimationFrame for smoother transitions on Pi
    const startTransition = () => {
      // Reset movement position to center during transition
      setMovementObjectPosition('center');
      
      // Log fade out start
      transitionLogger.logEvent({
        timestamp: Date.now(),
        eventType: 'fade_out_start',
        currentIndex,
        currentImageId: currentImg?.id,
        additionalData: { isShowingSplitScreen }
      });
      
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
        // Soft Glow: Dim outgoing image to 70% brightness
        if (shouldShowSoftGlow) {
          setImageBrightness(0.7);
        }
        // Dreamy Reveal: Reset state for next reveal
        if (shouldShowDreamyReveal) {
          setIsDreamyRevealing(false);
        }
        displayLogger.debug('🎬 OPTIMIZED: Fading out single image');
      }
      
      // After fade out completes, change image and WAIT for load
      setTimeout(() => {
        transitionLogger.logEvent({
          timestamp: Date.now(),
          eventType: 'fade_out_complete',
          currentIndex
        });
        
        // Advance by 2 if we were showing split-screen, otherwise advance by 1
        const advanceBy = isShowingSplitScreen ? 2 : 1;
        const nextIndex = (currentIndex + advanceBy) % images.length;
        
        transitionLogger.logEvent({
          timestamp: Date.now(),
          eventType: 'index_change',
          currentIndex,
          nextIndex
        });
        
        // Mark that we're waiting for the new image to load
        setWaitingForLoad(true);
        setNextImageReady(false);
        setCurrentIndex(nextIndex);
        
        // Ensure new image starts centered for movement
        setMovementObjectPosition('center');
        
        displayLogger.debug(`🎬 OPTIMIZED: Advanced by ${advanceBy}, now at index ${nextIndex}, waiting for image load...`);
        
        transitionLogger.logEvent({
          timestamp: Date.now(),
          eventType: 'src_change',
          currentIndex: nextIndex,
          currentImageId: images[nextIndex]?.id,
          currentImageUrl: getSmartImageUrlFromImage(images[nextIndex], deviceToken),
          isPreloaded: imagesLoaded.has(images[nextIndex]?.id)
        });
        
        // Notify parent of image change
        if (onImageChange) {
          onImageChange(images[nextIndex], nextIndex);
        }
        
        // Set a timeout in case image never loads (fallback)
        const loadTimeout = setTimeout(() => {
          if (waitingForLoad) {
            displayLogger.warning('⚠️ Image load timeout - forcing fade in');
            transitionLogger.logEvent({
              timestamp: Date.now(),
              eventType: 'image_load_error',
              currentIndex: nextIndex,
              error: 'Load timeout after 2000ms'
            });
            setWaitingForLoad(false);
            setIsTransitioning(false);
            transitionLogger.completeTransition(false);
          }
        }, 2000);
        
        // Store timeout ref for cleanup
        transitionTimeoutRef.current = loadTimeout;
      }, 300); // Shorter transition for better Pi performance
    };
    
    requestAnimationFrame(startTransition);
  }, [currentIndex, images, isTransitioning, onImageChange, deviceToken, imagesLoaded, waitingForLoad]);

  // Watch for image load and fade in when ready
  useEffect(() => {
    if (!waitingForLoad || !nextImageReady) return;
    
    const currentImg = images[currentIndex];
    const nextImg = images[currentIndex + 1];
    const isCurrentLandscape = currentImg && currentImg.width && currentImg.height && currentImg.width > currentImg.height;
    const isNextLandscape = nextImg && nextImg.width && nextImg.height && nextImg.width > nextImg.height;
    const shouldShowSplit = isCurrentLandscape && isNextLandscape;
    
    displayLogger.debug('🎬 OPTIMIZED: Image loaded, starting fade in');
    
    transitionLogger.logEvent({
      timestamp: Date.now(),
      eventType: 'fade_in_start',
      currentIndex,
      currentImageId: currentImg?.id
    });
    
    // Clear the timeout since image loaded successfully
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    
    // Fade in the new image
    if (shouldShowSplit) {
      setTopImageOpacity(1);
      setBottomImageOpacity(1);
      setTopImageTransform('translateX(0%)');
      setBottomImageTransform('translateX(0%)');
    } else {
      setImageOpacity(1);
      // Soft Glow: Start incoming image at 130% brightness
      if (shouldShowSoftGlow) {
        setImageBrightness(1.3);
        // Settle to 100% brightness after 900ms (1200ms transition - 300ms delay)
        setTimeout(() => {
          setImageBrightness(1.0);
        }, 900);
      }
      // Dreamy Reveal: Trigger reveal animation
      if (shouldShowDreamyReveal) {
        // Small delay to ensure component is ready
        setTimeout(() => {
          setIsDreamyRevealing(true);
        }, 50);
      }
    }
    
    // Mark transition complete after fade in
    setTimeout(() => {
      setWaitingForLoad(false);
      setIsTransitioning(false);
      
      transitionLogger.logEvent({
        timestamp: Date.now(),
        eventType: 'fade_in_complete',
        currentIndex
      });
      
      transitionLogger.completeTransition(true);
    }, 300);
    
  }, [waitingForLoad, nextImageReady, currentIndex, images]);

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

  // Export logs handler
  const handleExportLogs = useCallback(() => {
    try {
      const logs = transitionLogger.exportTransitions();
      navigator.clipboard.writeText(logs).then(() => {
        displayLogger.info('✅ Transition logs copied to clipboard');
        displayDeviceLogger.info('Transition logs exported', { logCount: transitionLogger.getTransitionHistory().length });
      }).catch((err) => {
        displayLogger.error('❌ Failed to copy logs:', err);
        // Fallback: show logs in console
        console.log('Transition Logs:', logs);
        displayDeviceLogger.error('Failed to copy logs to clipboard', { error: err.message });
      });
    } catch (err) {
      displayLogger.error('❌ Failed to export logs:', err);
    }
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
        case 'e':
        case 'E':
          e.preventDefault();
          handleExportLogs();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onClose, isPlaying, currentIndex, images, isTransitioning, performTransition, onImageChange, handleExportLogs]);

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
      {/* Initial Loading Screen */}
      {isInitialLoad && images.length > 0 && (
        <div className="absolute inset-0 bg-black z-50 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-xl font-medium">Loading slideshow...</p>
            <p className="text-sm text-gray-400 mt-2">Preparing {images.length} images</p>
          </div>
        </div>
      )}
      
      {/* Main Image Container with GPU acceleration */}
      <div 
        className="relative w-full h-full flex items-center justify-center"
        style={{
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden'
        }}
      >
        {shouldShowSplitScreen || shouldShowStackedReveal || (shouldShowParallaxDepth && isCurrentImageLandscape && isNextImageLandscape) ? (
          // Split-screen display for landscape images
          <div className="w-full h-full flex flex-col">
            {/* Top half - current landscape image */}
            <div className="relative w-full h-1/2">
              {shouldShowParallaxDepth ? (
                <ParallaxDepth
                  layer="top"
                  image={currentImage}
                  isActive={topImageOpacity > 0.5}
                  duration={settings.interval}
                  className="w-full h-full"
                >
                  <img
                    src={getSmartImageUrlFromImage(currentImage, deviceToken)}
                    alt={currentImage.original_filename}
                    className="w-full h-full object-cover"
                    style={{ 
                      opacity: topImageOpacity,
                      // Hardware acceleration
                      backfaceVisibility: 'hidden',
                      willChange: 'opacity, transform',
                      // Base transition (ParallaxDepth handles transform)
                      transition: 'opacity 300ms ease-out'
                    }}
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement;
                      displayLogger.debug('✅ Top image loaded (Parallax Depth)');
                      
                      displayDeviceLogger.logImageDimensions(
                        currentImage.id,
                        getSmartImageUrlFromImage(currentImage, deviceToken),
                        img.naturalWidth,
                        img.naturalHeight,
                        img.clientWidth,
                        img.clientHeight
                      );
                      
                      transitionLogger.logEvent({
                        timestamp: Date.now(),
                        eventType: 'image_load_complete',
                        currentIndex,
                        currentImageId: currentImage.id,
                        loadTime: img.complete ? 0 : undefined
                      });
                      
                      setImagesLoaded(prev => new Set([...prev, currentImage.id]));
                      
                      if (waitingForLoad) {
                        setNextImageReady(true);
                      }
                    }}
                    onError={() => {
                      displayLogger.error('❌ Top image failed to load (Parallax Depth)');
                    }}
                    loading="eager"
                  />
                </ParallaxDepth>
              ) : shouldShowStackedReveal ? (
                <StackedReveal
                  layer="top"
                  image={currentImage}
                  isRevealing={topImageOpacity > 0.5}
                  className="w-full h-full"
                >
                  <img
                    src={getSmartImageUrlFromImage(currentImage, deviceToken)}
                    alt={currentImage.original_filename}
                    className="w-full h-full object-cover"
                    style={{ 
                      opacity: topImageOpacity,
                      // Hardware acceleration
                      backfaceVisibility: 'hidden',
                      willChange: 'opacity, transform',
                      // Base transition (StackedReveal handles transform)
                      transition: 'opacity 300ms ease-out'
                    }}
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement;
                      displayLogger.debug('✅ Top image loaded (Stacked Reveal)');
                      
                      displayDeviceLogger.logImageDimensions(
                        currentImage.id,
                        getSmartImageUrlFromImage(currentImage, deviceToken),
                        img.naturalWidth,
                        img.naturalHeight,
                        img.clientWidth,
                        img.clientHeight
                      );
                      
                      transitionLogger.logEvent({
                        timestamp: Date.now(),
                        eventType: 'image_load_complete',
                        currentIndex,
                        currentImageId: currentImage.id,
                        loadTime: img.complete ? 0 : undefined
                      });
                      
                      setImagesLoaded(prev => new Set([...prev, currentImage.id]));
                      
                      if (waitingForLoad) {
                        setNextImageReady(true);
                      }
                    }}
                    onError={() => {
                      displayLogger.error('❌ Top image failed to load (Stacked Reveal)');
                    }}
                    loading="eager"
                  />
                </StackedReveal>
              ) : (
                <img
                  src={getSmartImageUrlFromImage(currentImage, deviceToken)}
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
                onLoad={(e) => {
                  const img = e.target as HTMLImageElement;
                  displayLogger.debug('✅ Top image loaded');
                  
                  // Log actual image dimensions
                  displayDeviceLogger.logImageDimensions(
                    currentImage.id,
                    getSmartImageUrlFromImage(currentImage, deviceToken),
                    img.naturalWidth,
                    img.naturalHeight,
                    img.clientWidth,
                    img.clientHeight
                  );
                  
                  transitionLogger.logEvent({
                    timestamp: Date.now(),
                    eventType: 'image_load_complete',
                    currentIndex,
                    currentImageId: currentImage.id,
                    loadTime: img.complete ? 0 : undefined
                  });
                  
                  setImagesLoaded(prev => new Set([...prev, currentImage.id]));
                  
                  // If we're waiting for this image, mark it as ready
                  if (waitingForLoad) {
                    setNextImageReady(true);
                  }
                }}
                onError={() => {
                  displayLogger.error('❌ Top image failed to load');
                }}
                loading="eager"
              />
              )}
            </div>
            
            {/* Horizontal divider */}
            <div className="w-full h-1 bg-black"></div>
            
            {/* Bottom half - next landscape image */}
            <div className="relative w-full h-1/2">
              {shouldShowParallaxDepth ? (
                <ParallaxDepth
                  layer="bottom"
                  image={nextImageData}
                  isActive={bottomImageOpacity > 0.5}
                  duration={settings.interval}
                  parallaxFactor={0.6}
                  className="w-full h-full"
                >
                  <img
                    src={getSmartImageUrlFromImage(nextImageData, deviceToken)}
                    alt={nextImageData.original_filename}
                    className="w-full h-full object-cover"
                    style={{ 
                      opacity: bottomImageOpacity,
                      // Hardware acceleration
                      backfaceVisibility: 'hidden',
                      willChange: 'opacity, transform',
                      // Base transition (ParallaxDepth handles transform)
                      transition: 'opacity 300ms ease-out'
                    }}
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement;
                      displayLogger.debug('✅ Bottom image loaded (Parallax Depth)');
                      
                      displayDeviceLogger.logImageDimensions(
                        nextImageData.id,
                        getSmartImageUrlFromImage(nextImageData, deviceToken),
                        img.naturalWidth,
                        img.naturalHeight,
                        img.clientWidth,
                        img.clientHeight
                      );
                      
                      transitionLogger.logEvent({
                        timestamp: Date.now(),
                        eventType: 'image_load_complete',
                        currentIndex,
                        currentImageId: nextImageData.id,
                        loadTime: img.complete ? 0 : undefined
                      });
                      
                      setImagesLoaded(prev => new Set([...prev, nextImageData.id]));
                      
                      if (waitingForLoad) {
                        setNextImageReady(true);
                      }
                    }}
                    onError={() => {
                      displayLogger.error('❌ Bottom image failed to load (Parallax Depth)');
                    }}
                    loading="eager"
                  />
                </ParallaxDepth>
              ) : shouldShowStackedReveal ? (
                <StackedReveal
                  layer="bottom"
                  image={nextImageData}
                  isRevealing={bottomImageOpacity > 0.5}
                  staggerDelay={300}
                  className="w-full h-full"
                >
                  <img
                    src={getSmartImageUrlFromImage(nextImageData, deviceToken)}
                    alt={nextImageData.original_filename}
                    className="w-full h-full object-cover"
                    style={{ 
                      opacity: bottomImageOpacity,
                      // Hardware acceleration
                      backfaceVisibility: 'hidden',
                      willChange: 'opacity, transform',
                      // Base transition (StackedReveal handles transform)
                      transition: 'opacity 300ms ease-out'
                    }}
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement;
                      displayLogger.debug('✅ Bottom image loaded (Stacked Reveal)');
                      
                      displayDeviceLogger.logImageDimensions(
                        nextImageData.id,
                        getSmartImageUrlFromImage(nextImageData, deviceToken),
                        img.naturalWidth,
                        img.naturalHeight,
                        img.clientWidth,
                        img.clientHeight
                      );
                      
                      transitionLogger.logEvent({
                        timestamp: Date.now(),
                        eventType: 'image_load_complete',
                        currentIndex,
                        currentImageId: nextImageData.id,
                        loadTime: img.complete ? 0 : undefined
                      });
                      
                      setImagesLoaded(prev => new Set([...prev, nextImageData.id]));
                      
                      if (waitingForLoad) {
                        setNextImageReady(true);
                      }
                    }}
                    onError={() => {
                      displayLogger.error('❌ Bottom image failed to load (Stacked Reveal)');
                    }}
                    loading="eager"
                  />
                </StackedReveal>
              ) : (
                <img
                  src={getSmartImageUrlFromImage(nextImageData, deviceToken)}
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
                onLoad={(e) => {
                  const img = e.target as HTMLImageElement;
                  displayLogger.debug('✅ Bottom image loaded');
                  
                  // Log actual image dimensions
                  displayDeviceLogger.logImageDimensions(
                    nextImageData.id,
                    getSmartImageUrlFromImage(nextImageData, deviceToken),
                    img.naturalWidth,
                    img.naturalHeight,
                    img.clientWidth,
                    img.clientHeight
                  );
                  
                  transitionLogger.logEvent({
                    timestamp: Date.now(),
                    eventType: 'image_load_complete',
                    currentIndex,
                    currentImageId: nextImageData.id,
                    loadTime: img.complete ? 0 : undefined
                  });
                  
                  setImagesLoaded(prev => new Set([...prev, nextImageData.id]));
                  
                  // If we're waiting for this image, mark it as ready
                  if (waitingForLoad) {
                    setNextImageReady(true);
                  }
                }}
                onError={() => {
                  displayLogger.error('❌ Bottom image failed to load');
                }}
                loading="eager"
              />
              )}
            </div>
          </div>
        ) : (
          // Single image display for portrait images or single landscape images
          <>
            {shouldShowColorHarmony ? (
              <ColorHarmony
                image={currentImage}
                isActive={imageOpacity > 0.5}
                backgroundOpacity={0.2}
                className="w-full h-full"
              >
                <img
                  src={getSmartImageUrlFromImage(currentImage, deviceToken)}
                  alt={currentImage.original_filename}
                  className="w-full h-full object-cover"
                  style={{ 
                    opacity: imageOpacity,
                    // Hardware acceleration
                    transform: 'translateZ(0)',
                    backfaceVisibility: 'hidden',
                    willChange: 'opacity',
                    // Smooth transition for opacity
                    transition: 'opacity 300ms ease-out'
                  }}
                  onLoad={(e) => {
                    const img = e.target as HTMLImageElement;
                    displayLogger.debug('✅ Main image loaded (Color Harmony)');
                    
                    displayDeviceLogger.logImageDimensions(
                      currentImage.id,
                      getSmartImageUrlFromImage(currentImage, deviceToken),
                      img.naturalWidth,
                      img.naturalHeight,
                      img.clientWidth,
                      img.clientHeight
                    );
                    
                    transitionLogger.logEvent({
                      timestamp: Date.now(),
                      eventType: 'image_load_complete',
                      currentIndex,
                      currentImageId: currentImage.id,
                      loadTime: img.complete ? 0 : undefined
                    });
                    
                    setImagesLoaded(prev => new Set([...prev, currentImage.id]));
                    
                    if (waitingForLoad) {
                      setNextImageReady(true);
                    }
                  }}
                  onError={() => {
                    displayLogger.error('❌ Main image failed to load (Color Harmony)');
                  }}
                  loading="eager"
                />
              </ColorHarmony>
            ) : shouldShowParallaxDepth && !isCurrentImageLandscape ? (
              <ParallaxDepth
                layer="single"
                image={currentImage}
                isActive={imageOpacity > 0.5}
                duration={settings.interval}
                className="w-full h-full"
              >
                <img
                  src={getSmartImageUrlFromImage(currentImage, deviceToken)}
                  alt={currentImage.original_filename}
                  className="w-full h-full object-cover"
                  style={{ 
                    opacity: imageOpacity,
                    // Hardware acceleration
                    transform: 'translateZ(0)',
                    backfaceVisibility: 'hidden',
                    willChange: 'opacity, transform',
                    // Smooth transition for opacity
                    transition: 'opacity 300ms ease-out'
                  }}
                  onLoad={(e) => {
                    const img = e.target as HTMLImageElement;
                    displayLogger.debug('✅ Main image loaded (Parallax Depth Portrait)');
                    
                    displayDeviceLogger.logImageDimensions(
                      currentImage.id,
                      getSmartImageUrlFromImage(currentImage, deviceToken),
                      img.naturalWidth,
                      img.naturalHeight,
                      img.clientWidth,
                      img.clientHeight
                    );
                    
                    transitionLogger.logEvent({
                      timestamp: Date.now(),
                      eventType: 'image_load_complete',
                      currentIndex,
                      currentImageId: currentImage.id,
                      loadTime: img.complete ? 0 : undefined
                    });
                    
                    setImagesLoaded(prev => new Set([...prev, currentImage.id]));
                    
                    if (waitingForLoad) {
                      setNextImageReady(true);
                    }
                  }}
                  onError={() => {
                    displayLogger.error('❌ Main image failed to load (Parallax Depth Portrait)');
                  }}
                  loading="eager"
                />
              </ParallaxDepth>
            ) : shouldShowCinematicBars ? (
              <CinematicBars
                displayInterval={settings.interval}
                isActive={true}
                className="w-full h-full"
              >
                <img
                  src={getSmartImageUrlFromImage(currentImage, deviceToken)}
                  alt={currentImage.original_filename}
                  className="w-full h-full object-cover"
                  style={{ 
                    opacity: imageOpacity,
                    // Hardware acceleration
                    transform: 'translateZ(0)',
                    backfaceVisibility: 'hidden',
                    willChange: 'opacity',
                    // Smooth transition for opacity
                    transition: 'opacity 300ms ease-out'
                  }}
                  onLoad={(e) => {
                    const img = e.target as HTMLImageElement;
                    displayLogger.debug('✅ Main image loaded (Cinematic Bars)');
                    
                    displayDeviceLogger.logImageDimensions(
                      currentImage.id,
                      getSmartImageUrlFromImage(currentImage, deviceToken),
                      img.naturalWidth,
                      img.naturalHeight,
                      img.clientWidth,
                      img.clientHeight
                    );
                    
                    transitionLogger.logEvent({
                      timestamp: Date.now(),
                      eventType: 'image_load_complete',
                      currentIndex,
                      currentImageId: currentImage.id,
                      loadTime: img.complete ? 0 : undefined
                    });
                    
                    setImagesLoaded(prev => new Set([...prev, currentImage.id]));
                    
                    if (waitingForLoad) {
                      setNextImageReady(true);
                    }
                  }}
                  onError={() => {
                    displayLogger.error('❌ Main image failed to load (Cinematic Bars)');
                  }}
                  loading="eager"
                />
              </CinematicBars>
            ) : shouldShowDreamyReveal ? (
              <DreamyReveal
                key={`dreamy-${currentImage.id}`}
                isRevealing={isDreamyRevealing}
                duration={1500}
                includeScale={true}
                className="w-full h-full"
              >
                <img
                  src={getSmartImageUrlFromImage(currentImage, deviceToken)}
                  alt={currentImage.original_filename}
                  className="w-full h-full object-cover"
                  style={{ 
                    // Don't control opacity here - DreamyReveal handles it
                    // Hardware acceleration
                    transform: 'translateZ(0)',
                    backfaceVisibility: 'hidden'
                  }}
                  onLoad={(e) => {
                    const img = e.target as HTMLImageElement;
                    displayLogger.debug('✅ Main image loaded (Dreamy Reveal)');
                    
                    displayDeviceLogger.logImageDimensions(
                      currentImage.id,
                      getSmartImageUrlFromImage(currentImage, deviceToken),
                      img.naturalWidth,
                      img.naturalHeight,
                      img.clientWidth,
                      img.clientHeight
                    );
                    
                    transitionLogger.logEvent({
                      timestamp: Date.now(),
                      eventType: 'image_load_complete',
                      currentIndex,
                      currentImageId: currentImage.id,
                      loadTime: img.complete ? 0 : undefined
                    });
                    
                    setImagesLoaded(prev => new Set([...prev, currentImage.id]));
                    
                    if (waitingForLoad) {
                      setNextImageReady(true);
                    }
                  }}
                  onError={() => {
                    displayLogger.error('❌ Main image failed to load (Dreamy Reveal)');
                  }}
                  loading="eager"
                />
              </DreamyReveal>
            ) : shouldShowAmbientPulse ? (
              <AmbientPulse
                displayInterval={settings.interval}
                isActive={true}
                className="w-full h-full"
              >
                <img
                  src={getSmartImageUrlFromImage(currentImage, deviceToken)}
                  alt={currentImage.original_filename}
                  className="w-full h-full object-cover"
                  style={{ 
                    opacity: imageOpacity,
                    // Hardware acceleration
                    transform: 'translateZ(0)',
                    backfaceVisibility: 'hidden',
                    willChange: 'opacity',
                    // Smooth transition for opacity
                    transition: 'opacity 300ms ease-out'
                  }}
                  onLoad={(e) => {
                    const img = e.target as HTMLImageElement;
                    displayLogger.debug('✅ Main image loaded (Ambient Pulse)');
                    
                    displayDeviceLogger.logImageDimensions(
                      currentImage.id,
                      getSmartImageUrlFromImage(currentImage, deviceToken),
                      img.naturalWidth,
                      img.naturalHeight,
                      img.clientWidth,
                      img.clientHeight
                    );
                    
                    transitionLogger.logEvent({
                      timestamp: Date.now(),
                      eventType: 'image_load_complete',
                      currentIndex,
                      currentImageId: currentImage.id,
                      loadTime: img.complete ? 0 : undefined
                    });
                    
                    setImagesLoaded(prev => new Set([...prev, currentImage.id]));
                    
                    if (waitingForLoad) {
                      setNextImageReady(true);
                    }
                  }}
                  onError={() => {
                    displayLogger.error('❌ Main image failed to load (Ambient Pulse)');
                  }}
                  loading="eager"
                />
              </AmbientPulse>
            ) : shouldShowKenBurns ? (
              <KenBurnsPlus
                image={currentImage}
                isActive={imageOpacity > 0.5}
                displayInterval={settings.interval}
                className="w-full h-full"
              >
                <img
                  src={getSmartImageUrlFromImage(currentImage, deviceToken)}
                  alt={currentImage.original_filename}
                  className="w-full h-full object-cover"
                  style={{ 
                    opacity: imageOpacity,
                    // Hardware acceleration
                    transform: 'translateZ(0)',
                    backfaceVisibility: 'hidden',
                    willChange: 'opacity',
                    // Smooth transition for opacity
                    transition: 'opacity 300ms ease-out'
                  }}
                  onLoad={(e) => {
                    const img = e.target as HTMLImageElement;
                    displayLogger.debug('✅ Main image loaded (Ken Burns)');
                    
                    // Log actual image dimensions for troubleshooting
                    displayDeviceLogger.logImageDimensions(
                      currentImage.id,
                      getSmartImageUrlFromImage(currentImage, deviceToken),
                      img.naturalWidth,
                      img.naturalHeight,
                      img.clientWidth,
                      img.clientHeight
                    );
                    
                    transitionLogger.logEvent({
                      timestamp: Date.now(),
                      eventType: 'image_load_complete',
                      currentIndex,
                      currentImageId: currentImage.id,
                      loadTime: img.complete ? 0 : undefined
                    });
                    
                    setImagesLoaded(prev => new Set([...prev, currentImage.id]));
                    
                    // If we're waiting for this image, mark it as ready
                    if (waitingForLoad) {
                      setNextImageReady(true);
                    }
                  }}
                  onError={() => {
                    displayLogger.error('❌ Main image failed to load (Ken Burns)');
                  }}
                  loading="eager"
                />
              </KenBurnsPlus>
            ) : (
              <img
                src={getSmartImageUrlFromImage(currentImage, deviceToken)}
                alt={currentImage.original_filename}
                className="w-full h-full object-cover"
                style={{ 
                  opacity: imageOpacity,
                  // Hardware acceleration
                  transform: 'translateZ(0)',
                  backfaceVisibility: 'hidden',
                  willChange: shouldShowSoftGlow ? 'opacity, filter' : 'opacity',
                  // Soft Glow: Add brightness filter
                  filter: shouldShowSoftGlow ? `brightness(${imageBrightness})` : undefined,
                  // Use object-position for movement instead of transform
                  objectPosition: shouldShowMovement && isCurrentImageLandscape ? movementObjectPosition : 'center',
                  // Smooth transition for opacity, brightness, and object-position
                  transition: shouldShowSoftGlow ? 
                    'opacity 800ms ease-in-out, filter 1200ms ease-in-out' : 
                    (shouldShowMovement && isCurrentImageLandscape ? 
                      'opacity 300ms ease-out, object-position 30s ease-in-out' : 'opacity 300ms ease-out')
                }}
              onLoad={(e) => {
                const img = e.target as HTMLImageElement;
                displayLogger.debug('✅ Main image loaded');
                
                // Log actual image dimensions for troubleshooting
                displayDeviceLogger.logImageDimensions(
                  currentImage.id,
                  getSmartImageUrlFromImage(currentImage, deviceToken),
                  img.naturalWidth,
                  img.naturalHeight,
                  img.clientWidth,
                  img.clientHeight
                );
                
                transitionLogger.logEvent({
                  timestamp: Date.now(),
                  eventType: 'image_load_complete',
                  currentIndex,
                  currentImageId: currentImage.id,
                  loadTime: img.complete ? 0 : undefined
                });
                
                setImagesLoaded(prev => new Set([...prev, currentImage.id]));
                
                // If we're waiting for this image, mark it as ready
                if (waitingForLoad) {
                  setNextImageReady(true);
                }
              }}
              onError={() => {
                displayLogger.error('❌ Main image failed to load');
              }}
              loading="eager"
            />
            )}
            {/* Loading indicator for current image */}
            {!imagesLoaded.has(currentImage.id) && imageOpacity > 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Export Logs Button - Bottom Left */}
      {showControls && (
        <div className="absolute bottom-4 left-4">
          <button
            onClick={handleExportLogs}
            className="bg-blue-600 bg-opacity-90 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            title="Export transition logs to clipboard (or press E)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export Logs (E)
          </button>
        </div>
      )}

      {/* Image Info Overlay - Bottom Right */}
      {settings.showInfo && !shouldShowSplitScreen && (
        <div className="absolute bottom-4 right-4 bg-gray-800 bg-opacity-90 text-white px-3 py-2 rounded-lg">
          <div className="space-y-1">
            <p className="text-sm font-medium leading-tight">{currentImage.original_filename}</p>
            {displayResolution ? (
              <p className="text-xs text-gray-300">
                {displayResolution.width} × {displayResolution.height}
              </p>
            ) : currentImage.width && currentImage.height ? (
              <p className="text-xs text-gray-300">
                {currentImage.width} × {currentImage.height}
              </p>
            ) : null}
            {(() => {
              // EXIF DateTime format is "YYYY:MM:DD HH:MM:SS" - need to parse properly
              const dateStr = currentImage.exif?.DateTimeOriginal || currentImage.exif?.DateTime;
              if (!dateStr) {
                return <p className="text-xs text-gray-400">No date</p>;
              }
              try {
                // EXIF DateTime uses colons instead of hyphens
                const parsed = dateStr.includes(':') && dateStr.match(/^\d{4}:\d{2}:\d{2}/)
                  ? new Date(dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'))
                  : new Date(dateStr);
                if (isNaN(parsed.getTime())) {
                  return <p className="text-xs text-gray-400">No date</p>;
                }
                return <p className="text-xs text-gray-300">{parsed.toLocaleDateString()}</p>;
              } catch (e) {
                return <p className="text-xs text-gray-400">No date</p>;
              }
            })()}
          </div>
        </div>
      )}

      {/* Image Info Overlays - Split Screen (Top Left for top image, Bottom Right for bottom image) */}
      {settings.showInfo && shouldShowSplitScreen && nextImageData && (
        <>
          {/* Top Image Info */}
          <div className="absolute top-4 left-4 bg-gray-800 bg-opacity-90 text-white px-3 py-2 rounded-lg" style={{ marginTop: '56px' }}>
            <div className="space-y-1">
              <p className="text-sm font-medium leading-tight">{currentImage?.original_filename}</p>
              {displayResolution ? (
                <p className="text-xs text-gray-300">
                  {displayResolution.width} × {displayResolution.height}
                </p>
              ) : currentImage?.width && currentImage?.height ? (
                <p className="text-xs text-gray-300">
                  {currentImage.width} × {currentImage.height}
                </p>
              ) : null}
              {(() => {
                const dateStr = currentImage?.exif?.DateTimeOriginal || currentImage?.exif?.DateTime;
                if (!dateStr) {
                  return <p className="text-xs text-gray-400">No date</p>;
                }
                try {
                  const parsed = dateStr.includes(':') && dateStr.match(/^\d{4}:\d{2}:\d{2}/)
                    ? new Date(dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'))
                    : new Date(dateStr);
                  if (isNaN(parsed.getTime())) {
                    return <p className="text-xs text-gray-400">No date</p>;
                  }
                  return <p className="text-xs text-gray-300">{parsed.toLocaleDateString()}</p>;
                } catch (e) {
                  return <p className="text-xs text-gray-400">No date</p>;
                }
              })()}
            </div>
          </div>
          
          {/* Bottom Image Info */}
          <div className="absolute bottom-4 right-4 bg-gray-800 bg-opacity-90 text-white px-3 py-2 rounded-lg">
            <div className="space-y-1">
              <p className="text-sm font-medium leading-tight">{nextImageData.original_filename}</p>
              {displayResolution ? (
                <p className="text-xs text-gray-300">
                  {displayResolution.width} × {displayResolution.height}
                </p>
              ) : nextImageData.width && nextImageData.height ? (
                <p className="text-xs text-gray-300">
                  {nextImageData.width} × {nextImageData.height}
                </p>
              ) : null}
              {(() => {
                const dateStr = nextImageData.exif?.DateTimeOriginal || nextImageData.exif?.DateTime;
                if (!dateStr) {
                  return <p className="text-xs text-gray-400">No date</p>;
                }
                try {
                  const parsed = dateStr.includes(':') && dateStr.match(/^\d{4}:\d{2}:\d{2}/)
                    ? new Date(dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'))
                    : new Date(dateStr);
                  if (isNaN(parsed.getTime())) {
                    return <p className="text-xs text-gray-400">No date</p>;
                  }
                  return <p className="text-xs text-gray-300">{parsed.toLocaleDateString()}</p>;
                } catch (e) {
                  return <p className="text-xs text-gray-400">No date</p>;
                }
              })()}
            </div>
          </div>
        </>
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
