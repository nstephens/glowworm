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

// Helper function to format EXIF date to readable format
const formatExifDate = (exifData: any): string | null => {
  const dateStr = exifData?.DateTimeOriginal || exifData?.DateTime;
  if (!dateStr) return null;
  
  try {
    // EXIF DateTime uses "YYYY:MM:DD HH:MM:SS" format
    const parsed = dateStr.includes(':') && dateStr.match(/^\d{4}:\d{2}:\d{2}/)
      ? new Date(dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'))
      : new Date(dateStr);
    
    if (isNaN(parsed.getTime())) return null;
    
    // Format as "August 3, 2021"
    return parsed.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch (e) {
    return null;
  }
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
  const [previousIndex, setPreviousIndex] = useState<number | null>(null); // Holds old image during fade-out
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
  const [previousImageOpacity, setPreviousImageOpacity] = useState(0); // For fading out old image
  const [nextImageOpacity, setNextImageOpacity] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [opacityTransitionDuration, setOpacityTransitionDuration] = useState('600ms'); // Dynamic fade duration
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

  // Calculate display mode logic early to avoid hoisting issues
  const currentImage = images[currentIndex];
  const isCurrentImageLandscape = currentImage && currentImage.width && currentImage.height && currentImage.width > currentImage.height;
  const nextImageData = images[currentIndex + 1];
  const isNextImageLandscape = nextImageData && nextImageData.width && nextImageData.height && nextImageData.width > nextImageData.height;
  
  // Check if current index is part of a pair from computed_sequence
  const isPairedFromSequence = React.useMemo(() => {
    if (!playlist?.computed_sequence || !currentImage || !nextImageData) return false;
    
    // Find which entry contains the current image
    for (const entry of playlist.computed_sequence) {
      if (entry.type === 'pair' && entry.images.length === 2) {
        // Check if this pair includes current and next images
        if (entry.images[0] === currentImage.id && entry.images[1] === nextImageData.id) {
          return true;
        }
      }
    }
    return false;
  }, [playlist?.computed_sequence, currentImage?.id, nextImageData?.id]);
  
  // Use computed_sequence if available, otherwise fall back to orientation-based logic
  // Apply pairing for ALL modes (not just default) when consecutive landscape images are detected
  const shouldShowSplitScreen = isPairedFromSequence || 
    (isCurrentImageLandscape && isNextImageLandscape);
  const shouldShowStackedReveal = (isPairedFromSequence && playlist?.display_mode === 'stacked_reveal') ||
    (playlist?.display_mode === 'stacked_reveal' && isCurrentImageLandscape && isNextImageLandscape);
  const shouldShowKenBurns = playlist?.display_mode === 'ken_burns_plus';
  const shouldShowSoftGlow = playlist?.display_mode === 'soft_glow';
  const shouldShowAmbientPulse = playlist?.display_mode === 'ambient_pulse';
  const shouldShowDreamyReveal = playlist?.display_mode === 'dreamy_reveal';
  const imageAspectRatio = currentImage && currentImage.width && currentImage.height ? currentImage.width / currentImage.height : 1;
  const displayAspectRatio = window.innerWidth / window.innerHeight;
  const isImageSignificantlyWider = imageAspectRatio > displayAspectRatio * 1.2; // 20% wider than display (less restrictive)

  // Handle initial setup when images change (only when NOT transitioning)
  // NOTE: Removed waitingForLoad from dependencies to prevent re-running after fade-in completes
  useEffect(() => {
    if (images.length > 0 && !isTransitioning && !waitingForLoad && isInitialLoad) {
      displayLogger.debug('🎬 OPTIMIZED: Setting up initial state for split-screen:', shouldShowSplitScreen);
      
      if (shouldShowSplitScreen) {
        // Initialize split-screen images (already visible, no fade needed on initial load)
        console.log(`🎬 SPLIT [${currentImage?.id}/${nextImageData?.id}]: Initial setup - setting opacity to 1`);
        setTopImageOpacity(1);
        setBottomImageOpacity(1);
        setTopImageTransform('translateX(0%)');
        setBottomImageTransform('translateX(0%)');
      } else {
        // Single image mode
        setImageOpacity(1);
        displayLogger.debug('🎬 OPTIMIZED: Single image mode');
      }
      
      // Mark initial load as complete
      setIsInitialLoad(false);
    }
  }, [currentIndex, images, shouldShowSplitScreen, isTransitioning, waitingForLoad, isInitialLoad]);

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
      // Log fade out start
      transitionLogger.logEvent({
        timestamp: Date.now(),
        eventType: 'fade_out_start',
        currentIndex,
        currentImageId: currentImg?.id,
        additionalData: { isShowingSplitScreen }
      });
      
      // Calculate next index first
      const advanceBy = isShowingSplitScreen ? 2 : 1;
      const nextIndex = (currentIndex + advanceBy) % images.length;
      
      // KEN BURNS & STACKED: Fade to BLACK, then change image
      // OTHER MODES: Use crossfade for smoother transition
      
      if (shouldShowKenBurns || shouldShowStackedReveal) {
        // FADE TO BLACK APPROACH (Ken Burns & Stacked)
        // Step 1: Set fade-out duration to 800ms (breathing effect - slower exhale)
        setOpacityTransitionDuration('800ms');
        
        // Step 2: Fade current image(s) to black (opacity 0)
        requestAnimationFrame(() => {
          if (isShowingSplitScreen) {
            setTopImageOpacity(0);
            setBottomImageOpacity(0);
            setTopImageTransform('translateX(5%)');
            setBottomImageTransform('translateX(-5%)');
            displayLogger.debug('🎬 KEN BURNS/STACKED: Fading stacked images to black (800ms - breathing)');
          } else {
            setImageOpacity(0);
            displayLogger.debug('🎬 KEN BURNS: Fading single image to black (800ms - breathing)');
          }
        });
        
        // Step 3: WAIT for fade to black to complete, THEN change image
        // (Image source changes during black screen - invisible to user)
      } else {
        // CROSSFADE APPROACH (All other modes)
        if (isShowingSplitScreen) {
          // For split-screen, just fade out normally
          console.log(`🎬 SPLIT [${currentImage?.id}/${nextImageData?.id}]: FADE OUT - setting opacity to 0`);
          setTopImageOpacity(0);
          setBottomImageOpacity(0);
          setTopImageTransform('translateX(5%)');
          setBottomImageTransform('translateX(-5%)');
          displayLogger.debug('🎬 CROSSFADE: Fading out split-screen images');
          
          // Soft Glow: Dim outgoing paired images to 70% brightness
          if (shouldShowSoftGlow) {
            setImageBrightness(0.7);
          }
        } else {
          // For single images: Use crossfade overlay
          setPreviousIndex(currentIndex);
          setPreviousImageOpacity(1);
          
          // Change to next image immediately (at opacity 0, underneath)
          setCurrentIndex(nextIndex);
          setImageOpacity(0);
          setWaitingForLoad(true);
          setNextImageReady(false);
          
          // Notify parent of image change
          if (onImageChange) {
            onImageChange(images[nextIndex], nextIndex);
          }
          
          displayLogger.debug('🎬 CROSSFADE: Starting crossfade - previous visible, new at 0');
          
          // Start fading out the previous image overlay
          requestAnimationFrame(() => {
            setPreviousImageOpacity(0);
            displayLogger.debug('🎬 CROSSFADE: Fading out previous image overlay');
          });
        }
        
        // Soft Glow: Dim outgoing image to 70% brightness
        if (shouldShowSoftGlow) {
          setImageBrightness(0.7);
        }
        // Dreamy Reveal: Reset state for next reveal
        if (shouldShowDreamyReveal) {
          setIsDreamyRevealing(false);
        }
      }
      
      // Use requestAnimationFrame to ensure state changes are flushed to DOM
      // THEN start the timer for when to complete the transition
      requestAnimationFrame(() => {
        // Now the opacity change has been applied to the DOM, start the fade-out timer
        setTimeout(() => {
        transitionLogger.logEvent({
          timestamp: Date.now(),
          eventType: 'fade_out_complete',
          currentIndex: nextIndex
        });
        
        // Handle index change based on transition type
        if (shouldShowKenBurns || shouldShowStackedReveal) {
          // KEN BURNS/STACKED: Change image AFTER fade to black completes
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
          
          // Notify parent of image change
          if (onImageChange) {
            onImageChange(images[nextIndex], nextIndex);
          }
          
          displayLogger.debug('🎬 KEN BURNS/STACKED: Image changed during black screen');
        } else if (isShowingSplitScreen) {
          // CROSSFADE: Split-screen index change
          transitionLogger.logEvent({
            timestamp: Date.now(),
            eventType: 'index_change',
            currentIndex,
            nextIndex
          });
          
          setWaitingForLoad(true);
          setNextImageReady(false);
          setCurrentIndex(nextIndex);
          
          if (onImageChange) {
            onImageChange(images[nextIndex], nextIndex);
          }
        } else {
          // CROSSFADE: Single images - clear the previous image overlay
          setPreviousIndex(null);
          displayLogger.debug('🎬 CROSSFADE: Cleared previous image overlay');
        }
        
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
        }, shouldShowKenBurns || shouldShowStackedReveal ? 850 : 650); // 850ms for Ken Burns (800ms fade + buffer), 650ms for others
      }); // Close requestAnimationFrame - ensures opacity change is applied before timer starts
    };
    
    requestAnimationFrame(startTransition);
  }, [currentIndex, images, isTransitioning, onImageChange, deviceToken, imagesLoaded, waitingForLoad]);

  // Watch for image load and fade in when ready
  useEffect(() => {
    if (!waitingForLoad || !nextImageReady) return;
    
    const currentImg = images[currentIndex];
    const nextImg = images[(currentIndex + 1) % images.length];
    
    // Use computed_sequence to determine if we should show split-screen for the NEW images
    let shouldShowSplitForNew = false;
    if (playlist?.computed_sequence) {
      for (const entry of playlist.computed_sequence) {
        if (entry.type === 'pair' && entry.images.length === 2) {
          if (entry.images[0] === currentImg?.id && entry.images[1] === nextImg?.id) {
            shouldShowSplitForNew = true;
            break;
          }
        }
      }
    }
    // Fallback to orientation-based logic if not found in computed_sequence
    if (!shouldShowSplitForNew) {
      const isCurrentLandscape = currentImg && currentImg.width && currentImg.height && currentImg.width > currentImg.height;
      const isNextLandscape = nextImg && nextImg.width && nextImg.height && nextImg.width > nextImg.height;
      shouldShowSplitForNew = isCurrentLandscape && isNextLandscape;
      if (shouldShowSplitForNew) {
        console.log(`🎬 SPLIT [${currentImg?.id}/${nextImg?.id}]: Using orientation-based pairing`);
      }
    } else {
      console.log(`🎬 SPLIT [${currentImg?.id}/${nextImg?.id}]: Using computed_sequence pairing`);
    }
    
    displayLogger.debug('🎬 OPTIMIZED: Image loaded, starting fade in', {
      shouldShowSplit: shouldShowSplitForNew,
      currentIndex,
      currentImgId: currentImg?.id,
      nextImgId: nextImg?.id
    });
    
    transitionLogger.logEvent({
      timestamp: Date.now(),
      eventType: 'fade_in_start',
      currentIndex,
      currentImageId: currentImg?.id,
      shouldShowSplit: shouldShowSplitForNew
    });
    
    // Clear the timeout since image loaded successfully
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
      transitionTimeoutRef.current = null;
    }
    
    // Fade in the new image(s)
    // Set fade-in duration: 1200ms for Ken Burns/Stacked (breathing effect), 600ms for others
    const fadeInDurationStr = (shouldShowKenBurns || shouldShowStackedReveal) ? '1200ms' : '600ms';
    setOpacityTransitionDuration(fadeInDurationStr);
    
    if (shouldShowSplitForNew) {
      // Paired images fade in
      console.log(`🎬 SPLIT [${currentImg?.id}/${nextImg?.id}]: Fade in paired images (mode: ${playlist?.display_mode})`);
      
      // Set initial opacity to 0 for fade-in effect
      setTopImageOpacity(0);
      setBottomImageOpacity(0);
      setTopImageTransform('translateX(0%)');
      setBottomImageTransform('translateX(0%)');
      
      // Soft Glow: Start incoming paired images at 130% brightness
      if (shouldShowSoftGlow) {
        setImageBrightness(1.3);
      }
      
      // Fade in both images
      requestAnimationFrame(() => {
        console.log(`🎬 SPLIT [${currentImg?.id}/${nextImg?.id}]: Setting opacity to 1 for fade-in`);
        setTopImageOpacity(1);
        setBottomImageOpacity(1);
        
        // Soft Glow: Settle to 100% brightness after 900ms
        if (shouldShowSoftGlow) {
          setTimeout(() => {
            console.log(`🎬 SOFT GLOW: Settling brightness to 1.0`);
            setImageBrightness(1.0);
          }, 900);
        }
      });
    } else {
      // Single image - ensure it starts at 0, then fade in
      setImageOpacity(0);
      requestAnimationFrame(() => {
        setImageOpacity(1);
      });
      // Soft Glow: Start incoming image at 130% brightness
      if (shouldShowSoftGlow) {
        setImageBrightness(1.3);
        // Settle to 100% brightness after 900ms (1200ms transition - 300ms delay)
        setTimeout(() => {
          setImageBrightness(1.0);
        }, 900);
      }
    }
    
    // Dreamy Reveal: Trigger reveal animation immediately (works for both single and paired)
    if (shouldShowDreamyReveal) {
      // Trigger immediately to avoid visible blur
      setIsDreamyRevealing(true);
    }
    
    // Mark transition complete after fade in (1200ms for Ken Burns/Stacked, 600ms for others)
    const fadeInDurationMs = (shouldShowKenBurns || shouldShowStackedReveal) ? 1200 : 600;
    setTimeout(() => {
      setWaitingForLoad(false);
      setIsTransitioning(false);
      
      transitionLogger.logEvent({
        timestamp: Date.now(),
        eventType: 'fade_in_complete',
        currentIndex
      });
      
      transitionLogger.completeTransition(true);
    }, fadeInDurationMs);
    
  }, [waitingForLoad, nextImageReady, currentIndex, images, playlist]);

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
  displayLogger.debug(`🎬 OPTIMIZED: Is current image landscape: ${isCurrentImageLandscape}`);
  
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
        {shouldShowSplitScreen || shouldShowStackedReveal ? (
          // Split-screen display for landscape images
          <div className="w-full h-full flex flex-col">
            {/* Top half - current landscape image */}
            <div className="relative w-full h-1/2">
              {shouldShowStackedReveal ? (
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
                      transition: `opacity ${opacityTransitionDuration} ease-in-out`
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
              ) : shouldShowDreamyReveal ? (
                <DreamyReveal
                  key={`dreamy-top-${currentImage.id}`}
                  isRevealing={isDreamyRevealing}
                  duration={1500}
                  includeScale={true}
                  externalOpacityControl={true}
                  className="w-full h-full"
                >
                  <img
                    src={getSmartImageUrlFromImage(currentImage, deviceToken)}
                    alt={currentImage.original_filename}
                    className="w-full h-full object-cover"
                    style={{ 
                      opacity: topImageOpacity,
                      // Hardware acceleration and transform handled by DreamyReveal wrapper
                      willChange: 'opacity',
                      transition: `opacity ${opacityTransitionDuration} ease-in-out`
                    }}
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement;
                      displayLogger.debug('✅ Top image loaded (Dreamy Reveal paired)');
                      
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
                      displayLogger.error('❌ Top image failed to load (Dreamy Reveal paired)');
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
                      opacity: topImageOpacity,
                      // Hardware acceleration
                      transform: 'translateZ(0)',
                      backfaceVisibility: 'hidden',
                      willChange: 'opacity',
                      transition: `opacity ${opacityTransitionDuration} ease-in-out`
                    }}
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement;
                      displayLogger.debug('✅ Top image loaded (Ambient Pulse paired)');
                      
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
                      displayLogger.error('❌ Top image failed to load (Ambient Pulse paired)');
                    }}
                    loading="eager"
                  />
                </AmbientPulse>
              ) : shouldShowSoftGlow ? (
                <img
                  src={getSmartImageUrlFromImage(currentImage, deviceToken)}
                  alt={currentImage.original_filename}
                  className="w-full h-full object-cover"
                  style={{ 
                    opacity: topImageOpacity,
                    // Hardware acceleration
                    transform: 'translateZ(0)',
                    backfaceVisibility: 'hidden',
                    willChange: 'opacity, filter',
                    // Soft Glow: Apply brightness filter
                    filter: `brightness(${imageBrightness})`,
                    // Smooth transitions for both opacity and brightness
                    transition: `opacity ${opacityTransitionDuration} ease-in-out, filter 1200ms ease-in-out`
                  }}
                  onLoad={(e) => {
                    const img = e.target as HTMLImageElement;
                    displayLogger.debug('✅ Top image loaded (Soft Glow paired)');
                    
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
                    displayLogger.error('❌ Top image failed to load (Soft Glow paired)');
                  }}
                  loading="eager"
                />
              ) : shouldShowKenBurns ? (
                <KenBurnsPlus
                  key={`kenburns-top-${currentImage.id}`}
                  image={currentImage}
                  isActive={topImageOpacity > 0.5}
                  displayInterval={settings.interval}
                  externalOpacityControl={false}
                  className="w-full h-full"
                >
                  <img
                    src={getSmartImageUrlFromImage(currentImage, deviceToken)}
                    alt={currentImage.original_filename}
                    className="w-full h-full object-cover"
                    style={{ 
                      // Let Ken Burns handle all transforms AND opacity internally
                      // No external opacity control
                    }}
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement;
                      displayLogger.debug('✅ Top image loaded (Ken Burns paired)');
                      
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
                      displayLogger.error('❌ Top image failed to load (Ken Burns paired)');
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
                    opacity: topImageOpacity,
                    transform: topImageTransform,
                    // Hardware acceleration
                    backfaceVisibility: 'hidden',
                    willChange: shouldShowSoftGlow ? 'opacity, transform, filter' : 'opacity, transform',
                    // Soft Glow: Add brightness filter
                    filter: shouldShowSoftGlow ? `brightness(${imageBrightness})` : undefined,
                    // Optimized transition for Pi
                    transition: shouldShowSoftGlow ? 
                      `opacity ${opacityTransitionDuration} ease-in-out, transform 600ms ease-out, filter 1200ms ease-in-out` : 
                      `opacity ${opacityTransitionDuration} ease-in-out, transform 600ms ease-out`
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
              {shouldShowStackedReveal ? (
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
                      transition: `opacity ${opacityTransitionDuration} ease-in-out`
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
              ) : shouldShowDreamyReveal ? (
                <DreamyReveal
                  key={`dreamy-bottom-${nextImageData.id}`}
                  isRevealing={isDreamyRevealing}
                  duration={1500}
                  includeScale={true}
                  externalOpacityControl={true}
                  className="w-full h-full"
                >
                  <img
                    src={getSmartImageUrlFromImage(nextImageData, deviceToken)}
                    alt={nextImageData.original_filename}
                    className="w-full h-full object-cover"
                    style={{ 
                      opacity: bottomImageOpacity,
                      // Hardware acceleration and transform handled by DreamyReveal wrapper
                      willChange: 'opacity',
                      transition: `opacity ${opacityTransitionDuration} ease-in-out`
                    }}
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement;
                      displayLogger.debug('✅ Bottom image loaded (Dreamy Reveal paired)');
                      
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
                      displayLogger.error('❌ Bottom image failed to load (Dreamy Reveal paired)');
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
                    src={getSmartImageUrlFromImage(nextImageData, deviceToken)}
                    alt={nextImageData.original_filename}
                    className="w-full h-full object-cover"
                    style={{ 
                      opacity: bottomImageOpacity,
                      // Hardware acceleration
                      transform: 'translateZ(0)',
                      backfaceVisibility: 'hidden',
                      willChange: 'opacity',
                      transition: `opacity ${opacityTransitionDuration} ease-in-out`
                    }}
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement;
                      displayLogger.debug('✅ Bottom image loaded (Ambient Pulse paired)');
                      
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
                      displayLogger.error('❌ Bottom image failed to load (Ambient Pulse paired)');
                    }}
                    loading="eager"
                  />
                </AmbientPulse>
              ) : shouldShowSoftGlow ? (
                <img
                  src={getSmartImageUrlFromImage(nextImageData, deviceToken)}
                  alt={nextImageData.original_filename}
                  className="w-full h-full object-cover"
                  style={{ 
                    opacity: bottomImageOpacity,
                    // Hardware acceleration
                    transform: 'translateZ(0)',
                    backfaceVisibility: 'hidden',
                    willChange: 'opacity, filter',
                    // Soft Glow: Apply brightness filter
                    filter: `brightness(${imageBrightness})`,
                    // Smooth transitions for both opacity and brightness
                    transition: `opacity ${opacityTransitionDuration} ease-in-out, filter 1200ms ease-in-out`
                  }}
                  onLoad={(e) => {
                    const img = e.target as HTMLImageElement;
                    displayLogger.debug('✅ Bottom image loaded (Soft Glow paired)');
                    
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
                    displayLogger.error('❌ Bottom image failed to load (Soft Glow paired)');
                  }}
                  loading="eager"
                />
              ) : shouldShowKenBurns ? (
                <KenBurnsPlus
                  key={`kenburns-bottom-${nextImageData.id}`}
                  image={nextImageData}
                  isActive={bottomImageOpacity > 0.5}
                  displayInterval={settings.interval}
                  externalOpacityControl={false}
                  className="w-full h-full"
                >
                  <img
                    src={getSmartImageUrlFromImage(nextImageData, deviceToken)}
                    alt={nextImageData.original_filename}
                    className="w-full h-full object-cover"
                    style={{ 
                      // Let Ken Burns handle all transforms AND opacity internally
                      // No external opacity control
                    }}
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement;
                      displayLogger.debug('✅ Bottom image loaded (Ken Burns paired)');
                      
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
                      displayLogger.error('❌ Bottom image failed to load (Ken Burns paired)');
                    }}
                    loading="eager"
                  />
                </KenBurnsPlus>
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
                    willChange: shouldShowSoftGlow ? 'opacity, transform, filter' : 'opacity, transform',
                    // Soft Glow: Add brightness filter
                    filter: shouldShowSoftGlow ? `brightness(${imageBrightness})` : undefined,
                    // Optimized transition for Pi
                    transition: shouldShowSoftGlow ? 
                      `opacity ${opacityTransitionDuration} ease-in-out, transform 600ms ease-out, filter 1200ms ease-in-out` : 
                      `opacity ${opacityTransitionDuration} ease-in-out, transform 600ms ease-out`
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
            {shouldShowDreamyReveal ? (
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
                    transition: `opacity ${opacityTransitionDuration} ease-in-out`
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
                key={`kenburns-${currentImage.id}`}
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
                    transition: `opacity ${opacityTransitionDuration} ease-in-out`
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
                  objectPosition: 'center',
                  // Smooth transition for opacity and brightness
                  transition: shouldShowSoftGlow ? 
                    `opacity ${opacityTransitionDuration} ease-in-out, filter 1200ms ease-in-out` : 
                    `opacity ${opacityTransitionDuration} ease-in-out`
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
            
            {/* Previous image overlay for crossfade effect (NOT used for Ken Burns - it fades to black) */}
            {!shouldShowKenBurns && previousIndex !== null && images[previousIndex] && (
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  opacity: previousImageOpacity,
                  transition: `opacity ${opacityTransitionDuration} ease-in-out`,
                  zIndex: 10
                }}
              >
                <img
                  src={getSmartImageUrlFromImage(images[previousIndex], deviceToken)}
                  alt={images[previousIndex].original_filename}
                  className="w-full h-full object-cover"
                  style={{
                    transform: 'translateZ(0)',
                    backfaceVisibility: 'hidden'
                  }}
                />
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

      {/* EXIF Date Overlay - Lower Right Corner (Subtle) */}
      {playlist?.show_exif_date && !shouldShowSplitScreen && currentImage && (() => {
        const formattedDate = formatExifDate(currentImage.exif);
        if (!formattedDate) return null;
        
        return (
          <div className="absolute bottom-4 right-4 bg-black bg-opacity-40 text-white px-3 py-1.5 rounded-md text-sm">
            {formattedDate}
          </div>
        );
      })()}

      {/* EXIF Date Overlays - Split Screen Mode */}
      {playlist?.show_exif_date && shouldShowSplitScreen && nextImageData && (
        <>
          {/* Top Image EXIF Date */}
          {(() => {
            const formattedDate = formatExifDate(currentImage?.exif);
            if (!formattedDate) return null;
            
            return (
              <div className="absolute top-4 right-4 bg-black bg-opacity-40 text-white px-3 py-1.5 rounded-md text-sm" style={{ marginTop: '56px' }}>
                {formattedDate}
              </div>
            );
          })()}
          
          {/* Bottom Image EXIF Date */}
          {(() => {
            const formattedDate = formatExifDate(nextImageData.exif);
            if (!formattedDate) return null;
            
            return (
              <div className="absolute bottom-4 right-4 bg-black bg-opacity-40 text-white px-3 py-1.5 rounded-md text-sm">
                {formattedDate}
              </div>
            );
          })()}
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
