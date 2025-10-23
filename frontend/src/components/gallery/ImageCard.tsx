import React, { useState, useCallback } from 'react';
import { Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ImageOverlay } from './ImageOverlay';
import { ImageSkeleton } from './ImageSkeleton';
import { Image } from './MasonryGallery';
import { cn } from '@/lib/utils';

interface ImageCardProps {
  image: Image;
  isSelected: boolean;
  isLast?: boolean;
  onSelect: (image: Image) => void;
  onToggleSelection: (imageId: string) => void;
  onAction: (action: string, image: Image) => void;
  showSelection?: boolean;
  className?: string;
}

/**
 * ImageCard - Enhanced image card with improved hover interactions
 * 
 * Features:
 * - Smooth hover animations
 * - Enhanced overlay with metadata
 * - Loading states with skeleton
 * - Touch-friendly interactions
 * - Accessibility support
 * - Error handling for broken images
 */
export const ImageCard: React.FC<ImageCardProps> = ({
  image,
  isSelected,
  isLast = false,
  onSelect,
  onToggleSelection,
  onAction,
  showSelection = true,
  className,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const handleImageLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleImageError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);

  const handleClick = useCallback(() => {
    onSelect(image);
  }, [image, onSelect]);

  const handleAction = useCallback((action: string) => {
    onAction(action, image);
  }, [image, onAction]);

  const getImageStyle = useCallback(() => {
    const aspectRatio = image.width / image.height;
    return {
      aspectRatio: aspectRatio.toString(),
    };
  }, [image.width, image.height]);

  return (
    <div
      className={cn(
        "masonry-item mb-4 break-inside-avoid",
        "group relative overflow-hidden rounded-lg bg-card border",
        "transition-all duration-300 ease-in-out",
        "hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1",
        "focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2",
        isSelected && "ring-2 ring-primary ring-offset-2 scale-[1.02]",
        isHovered && "shadow-xl scale-[1.02] -translate-y-1",
        className
      )}
      style={getImageStyle()}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`View ${image.title}`}
      aria-describedby={`image-${image.id}-description`}
      aria-pressed={isSelected}
      data-image-card
    >
      {/* Selection checkbox */}
      {showSelection && (
        <div className="absolute top-2 left-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Checkbox
            checked={isSelected}
            onChange={() => onToggleSelection(image.id)}
            aria-label={`Select ${image.title}`}
            className="bg-background/90 backdrop-blur-sm border-2"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-2 right-2 z-30">
          <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center shadow-lg">
            <Check className="h-4 w-4 text-primary-foreground" />
          </div>
        </div>
      )}

      {/* Image container */}
      <div className="relative w-full h-full">
        {isLoading && (
          <ImageSkeleton 
            className="absolute inset-0 z-10"
            aspectRatio={`${image.width}/${image.height}`}
          />
        )}

        {hasError ? (
          <div className="w-full h-full bg-muted flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-muted-foreground/20 flex items-center justify-center mx-auto">
                <span className="text-2xl">📷</span>
              </div>
              <p className="text-sm text-muted-foreground">Failed to load</p>
            </div>
          </div>
        ) : (
          <img
            src={image.src}
            alt={image.title}
            className={cn(
              "w-full h-full object-cover transition-opacity duration-300",
              isLoading ? "opacity-0" : "opacity-100"
            )}
            loading="lazy"
            onLoad={handleImageLoad}
            onError={handleImageError}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleClick();
              }
            }}
          />
        )}

        {/* Enhanced overlay */}
        <ImageOverlay
          image={image}
          isHovered={isHovered}
          isSelected={isSelected}
          onAction={handleAction}
          onSelect={onSelect}
          showSelection={showSelection}
        />
      </div>

        {/* Focus ring for accessibility */}
        <div className="absolute inset-0 rounded-lg ring-0 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 pointer-events-none" />
        
        {/* Screen reader description */}
        <div 
          id={`image-${image.id}-description`}
          className="sr-only"
        >
          {image.title}. 
          {image.album && `Album: ${image.album}. `}
          {image.tags && image.tags.length > 0 && `Tags: ${image.tags.join(', ')}. `}
          {image.orientation} orientation. 
          {image.width} by {image.height} pixels.
          {isSelected ? ' Selected.' : ' Not selected.'}
          Press Space to toggle selection, Enter to view details.
        </div>
      </div>
    );
  };
