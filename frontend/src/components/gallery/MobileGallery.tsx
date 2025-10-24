import React, { useState, useRef, useEffect } from 'react';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { useTouchTargets } from '@/hooks/useTouchTargets';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { ResponsiveImage } from '@/components/ui/ResponsiveImage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, 
  ChevronRight, 
  X, 
  Download, 
  Share, 
  Heart,
  MoreHorizontal,
  ZoomIn,
  RotateCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Image {
  id: string;
  src: string;
  alt: string;
  title: string;
  width: number;
  height: number;
  tags?: string[];
  album?: string;
  createdAt?: string;
}

interface MobileGalleryProps {
  images: Image[];
  onClose?: () => void;
  initialIndex?: number;
  className?: string;
}

export const MobileGallery: React.FC<MobileGalleryProps> = ({
  images,
  onClose,
  initialIndex = 0,
  className,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);
  const { isMobile, isTouchDevice } = useResponsiveLayout();
  const { attachToContainer, triggerHapticFeedback } = useTouchTargets();

  const currentImage = images[currentIndex];

  // Swipe gesture handlers
  const handleSwipeLeft = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
      triggerHapticFeedback('light');
    }
  };

  const handleSwipeRight = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      triggerHapticFeedback('light');
    }
  };

  const handleSwipeUp = () => {
    // Close gallery on swipe up
    onClose?.();
    triggerHapticFeedback('medium');
  };

  const handleSwipeDown = () => {
    // Toggle fullscreen on swipe down
    setIsFullscreen(!isFullscreen);
    triggerHapticFeedback('light');
  };

  // Attach swipe gestures
  const { attachSwipeListeners } = useSwipeGesture({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    onSwipeUp: handleSwipeUp,
    onSwipeDown: handleSwipeDown,
    threshold: 50,
    velocityThreshold: 0.3,
  });

  // Attach touch target enhancements
  useEffect(() => {
    if (galleryRef.current) {
      attachSwipeListeners(galleryRef.current);
      attachToContainer(galleryRef.current);
    }
  }, [attachSwipeListeners, attachToContainer]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
          handleSwipeRight();
          break;
        case 'ArrowRight':
          handleSwipeLeft();
          break;
        case 'Escape':
          onClose?.();
          break;
        case 'f':
        case 'F':
          setIsFullscreen(!isFullscreen);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isFullscreen, onClose]);

  // Prevent body scroll when gallery is open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      triggerHapticFeedback('light');
    }
  };

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
      triggerHapticFeedback('light');
    }
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    triggerHapticFeedback('light');
  };

  const handleDownload = () => {
    // Implement download functionality
    triggerHapticFeedback('medium');
  };

  const handleShare = () => {
    // Implement share functionality
    triggerHapticFeedback('medium');
  };

  if (!currentImage) return null;

  return (
    <div
      ref={galleryRef}
      className={cn(
        "fixed inset-0 z-50 bg-black",
        isFullscreen ? "bg-black" : "bg-black/95",
        className
      )}
      role="dialog"
      aria-modal="true"
      aria-label="Image gallery"
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:bg-white/20"
            aria-label="Close gallery"
          >
            <X className="h-6 w-6" />
          </Button>
          <div className="text-white">
            <h2 className="text-lg font-semibold truncate">{currentImage.title}</h2>
            <p className="text-sm text-white/70">
              {currentIndex + 1} of {images.length}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="text-white hover:bg-white/20"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            <ZoomIn className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Main image */}
      <div className="flex items-center justify-center h-full p-4 pt-20 pb-20">
        <ResponsiveImage
          src={currentImage.src}
          alt={currentImage.alt}
          className="max-w-full max-h-full object-contain"
          aspectRatio={currentImage.width / currentImage.height}
          objectFit="contain"
          loading="eager"
        />
      </div>

      {/* Navigation arrows */}
      {images.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevious}
            disabled={currentIndex === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 disabled:opacity-50"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNext}
            disabled={currentIndex === images.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 disabled:opacity-50"
            aria-label="Next image"
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        </>
      )}

      {/* Bottom actions */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLike}
              className={cn(
                "text-white hover:bg-white/20",
                isLiked && "text-red-500"
              )}
              aria-label={isLiked ? "Unlike" : "Like"}
            >
              <Heart className={cn("h-6 w-6", isLiked && "fill-current")} />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDownload}
              className="text-white hover:bg-white/20"
              aria-label="Download"
            >
              <Download className="h-6 w-6" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={handleShare}
              className="text-white hover:bg-white/20"
              aria-label="Share"
            >
              <Share className="h-6 w-6" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {currentImage.tags && currentImage.tags.length > 0 && (
              <div className="flex gap-1">
                {currentImage.tags.slice(0, 2).map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {currentImage.tags.length > 2 && (
                  <Badge variant="secondary" className="text-xs">
                    +{currentImage.tags.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="absolute bottom-20 left-0 right-0 p-4">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {images.map((image, index) => (
              <button
                key={image.id}
                onClick={() => setCurrentIndex(index)}
                className={cn(
                  "flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-200",
                  index === currentIndex
                    ? "border-white scale-110"
                    : "border-white/30 hover:border-white/60"
                )}
                aria-label={`Go to image ${index + 1}`}
              >
                <ResponsiveImage
                  src={image.src}
                  alt={image.alt}
                  className="w-full h-full object-cover"
                  aspectRatio={1}
                  objectFit="cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Touch instructions */}
      {isTouchDevice && (
        <div className="absolute top-20 left-4 right-4 text-center text-white/70 text-sm">
          <p>Swipe left/right to navigate • Swipe up to close • Swipe down for fullscreen</p>
        </div>
      )}
    </div>
  );
};
