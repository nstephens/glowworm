import React, { useState, useCallback, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { useSwipeGestures } from '../../hooks/useSwipeGestures';
import { hapticPatterns } from '../../utils/hapticFeedback';
import { 
  ChevronLeft, 
  ChevronRight, 
  Play, 
  Pause,
  RotateCcw,
  Maximize2,
  X
} from 'lucide-react';
import { LazyImage } from './LazyImage';
import { createAriaAttributes, generateAriaId, getAriaAttributes, srOnly } from '../../utils/ariaUtils';

export interface SwipeableImageCarouselProps {
  images: Array<{
    id: string | number;
    src: string;
    alt: string;
    title?: string;
    description?: string;
  }>;
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
  onImageClick?: (image: any, index: number) => void;
  onImageAction?: (action: string, image: any, index: number) => void;
  className?: string;
  enableHaptic?: boolean;
  autoPlay?: boolean;
  autoPlayInterval?: number;
  showControls?: boolean;
  showThumbnails?: boolean;
  enableFullscreen?: boolean;
  enableSwipe?: boolean;
  threshold?: number;
  velocity?: number;
}

export const SwipeableImageCarousel: React.FC<SwipeableImageCarouselProps> = ({
  images,
  currentIndex = 0,
  onIndexChange,
  onImageClick,
  onImageAction,
  className,
  enableHaptic = true,
  autoPlay = false,
  autoPlayInterval = 3000,
  showControls = true,
  showThumbnails = false,
  enableFullscreen = true,
  enableSwipe = true,
  threshold = 50,
  velocity = 0.3
}) => {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  
  // Generate ARIA IDs
  const carouselId = generateAriaId('carousel');
  const imageId = `${carouselId}-image`;
  const previousButtonId = `${carouselId}-previous`;
  const nextButtonId = `${carouselId}-next`;
  const playButtonId = `${carouselId}-play`;
  const fullscreenButtonId = `${carouselId}-fullscreen`;

  const goToNext = useCallback(() => {
    if (images.length === 0) return;
    const nextIndex = (currentIndex + 1) % images.length;
    onIndexChange?.(nextIndex);
    if (enableHaptic) {
      hapticPatterns.swipe();
    }
  }, [currentIndex, images.length, onIndexChange, enableHaptic]);

  const goToPrevious = useCallback(() => {
    if (images.length === 0) return;
    const prevIndex = currentIndex === 0 ? images.length - 1 : currentIndex - 1;
    onIndexChange?.(prevIndex);
    if (enableHaptic) {
      hapticPatterns.swipe();
    }
  }, [currentIndex, images.length, onIndexChange, enableHaptic]);

  const goToImage = useCallback((index: number) => {
    if (index >= 0 && index < images.length) {
      onIndexChange?.(index);
      if (enableHaptic) {
        hapticPatterns.selection();
      }
    }
  }, [images.length, onIndexChange, enableHaptic]);

  const togglePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
    if (enableHaptic) {
      hapticPatterns.buttonPress();
    }
  }, [isPlaying, enableHaptic]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
    if (enableHaptic) {
      hapticPatterns.buttonPress();
    }
  }, [isFullscreen, enableHaptic]);

  const handleImageClick = useCallback((image: any, index: number) => {
    if (enableHaptic) {
      hapticPatterns.navigation();
    }
    onImageClick?.(image, index);
  }, [onImageClick, enableHaptic]);

  // Swipe gesture support
  const { gestureProps } = useSwipeGestures({
    onSwipeLeft: enableSwipe ? goToNext : undefined,
    onSwipeRight: enableSwipe ? goToPrevious : undefined,
    onSwipeUp: enableFullscreen ? toggleFullscreen : undefined,
    onSwipeDown: isFullscreen ? () => setIsFullscreen(false) : undefined,
    enableHaptic,
    threshold,
    velocity,
    preventDefault: true,
    stopPropagation: true
  });

  // Auto-play functionality
  useEffect(() => {
    if (isPlaying && images.length > 1) {
      autoPlayRef.current = setInterval(goToNext, autoPlayInterval);
    } else {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
        autoPlayRef.current = null;
      }
    }

    return () => {
      if (autoPlayRef.current) {
        clearInterval(autoPlayRef.current);
      }
    };
  }, [isPlaying, images.length, goToNext, autoPlayInterval]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isFullscreen) return;

      switch (event.key) {
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case 'Escape':
          setIsFullscreen(false);
          break;
        case ' ':
          event.preventDefault();
          togglePlayPause();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, goToPrevious, goToNext, togglePlayPause]);

  const currentImage = images[currentIndex];

  if (!currentImage) {
    return (
      <div className={cn('flex items-center justify-center h-64 bg-gray-100 rounded-lg', className)}>
        <p className="text-gray-500">No images available</p>
      </div>
    );
  }

  // Create ARIA attributes for the carousel
  const carouselAriaAttributes = getAriaAttributes.imageCarousel(
    currentIndex,
    images.length
  );

  return (
    <div
      ref={carouselRef}
      className={cn(
        'relative overflow-hidden bg-black rounded-lg',
        isFullscreen && 'fixed inset-0 z-50 rounded-none',
        className
      )}
      {...carouselAriaAttributes}
    >
      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {currentImage.title && `Image: ${currentImage.title}`}
        {currentImage.description && `Description: ${currentImage.description}`}
        {`Image ${currentIndex + 1} of ${images.length}`}
      </div>

      {/* Main Image */}
      <div
        {...gestureProps}
        className="relative w-full h-full cursor-pointer"
        onClick={() => handleImageClick(currentImage, currentIndex)}
        role="img"
        aria-label={currentImage.alt}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleImageClick(currentImage, currentIndex);
          }
        }}
      >
        <LazyImage
          src={currentImage.src}
          alt={currentImage.alt}
          className="w-full h-full object-contain"
          onLoad={() => setImageLoaded(true)}
          showSkeleton={true}
        />

        {/* Image Info Overlay */}
        {(currentImage.title || currentImage.description) && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
            {currentImage.title && (
              <h3 className="text-white font-semibold text-lg mb-1">
                {currentImage.title}
              </h3>
            )}
            {currentImage.description && (
              <p className="text-white/80 text-sm">
                {currentImage.description}
              </p>
            )}
          </div>
        )}

        {/* Loading Indicator */}
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900" aria-hidden="true">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      {showControls && images.length > 1 && (
        <>
          {/* Previous Button */}
          <button
            id={previousButtonId}
            onClick={goToPrevious}
            className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all duration-200 touch-target"
            aria-label="Previous image"
            disabled={images.length <= 1}
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
            {srOnly('Previous image')}
          </button>

          {/* Next Button */}
          <button
            id={nextButtonId}
            onClick={goToNext}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all duration-200 touch-target"
            aria-label="Next image"
            disabled={images.length <= 1}
          >
            <ChevronRight className="w-5 h-5" aria-hidden="true" />
            {srOnly('Next image')}
          </button>
        </>
      )}

      {/* Play/Pause Button */}
      {autoPlay && (
        <button
          id={playButtonId}
          onClick={togglePlayPause}
          className="absolute top-2 left-2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all duration-200 touch-target"
          aria-label={isPlaying ? 'Pause slideshow' : 'Play slideshow'}
          aria-pressed={isPlaying}
        >
          {isPlaying ? (
            <>
              <Pause className="w-4 h-4" aria-hidden="true" />
              {srOnly('Pause slideshow')}
            </>
          ) : (
            <>
              <Play className="w-4 h-4" aria-hidden="true" />
              {srOnly('Play slideshow')}
            </>
          )}
        </button>
      )}

      {/* Fullscreen Button */}
      {enableFullscreen && (
        <button
          id={fullscreenButtonId}
          onClick={toggleFullscreen}
          className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all duration-200 touch-target"
          aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          aria-pressed={isFullscreen}
        >
          {isFullscreen ? (
            <>
              <X className="w-4 h-4" aria-hidden="true" />
              {srOnly('Exit fullscreen')}
            </>
          ) : (
            <>
              <Maximize2 className="w-4 h-4" aria-hidden="true" />
              {srOnly('Enter fullscreen')}
            </>
          )}
        </button>
      )}

      {/* Image Counter */}
      {images.length > 1 && (
        <div 
          className="absolute top-2 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded-full text-sm"
          aria-live="polite"
          aria-label={`Image ${currentIndex + 1} of ${images.length}`}
        >
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* Thumbnails */}
      {showThumbnails && images.length > 1 && (
        <div 
          className="absolute bottom-2 left-0 right-0 flex justify-center gap-2 p-2"
          role="tablist"
          aria-label="Image thumbnails"
        >
          {images.map((image, index) => {
            const thumbnailAriaAttributes = getAriaAttributes.imageCarouselIndicator(
              index,
              currentIndex,
              images.length
            );
            
            return (
              <button
                key={image.id}
                onClick={() => goToImage(index)}
                className={cn(
                  'w-12 h-12 rounded overflow-hidden border-2 transition-all duration-200',
                  index === currentIndex 
                    ? 'border-white shadow-lg' 
                    : 'border-white/50 hover:border-white/80'
                )}
                {...thumbnailAriaAttributes}
                role="tab"
                tabIndex={index === currentIndex ? 0 : -1}
              >
                <LazyImage
                  src={image.src}
                  alt={image.alt}
                  className="w-full h-full object-cover"
                />
              </button>
            );
          })}
        </div>
      )}

      {/* Swipe Hint */}
      {enableSwipe && images.length > 1 && (
        <div 
          className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/60 text-xs"
          aria-hidden="true"
        >
          Swipe to navigate
        </div>
      )}
    </div>
  );
};

export default SwipeableImageCarousel;
