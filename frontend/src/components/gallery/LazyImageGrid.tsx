import React, { useState, useCallback } from 'react';
import { useLazyLoadingList } from '../../hooks/useLazyLoading';
import { LazyImage } from '../ui/LazyImage';
import { Skeleton } from '../ui/Skeleton';
import { cn } from '../../lib/utils';
import type { Image } from '../../types';

interface LazyImageGridProps {
  images: Image[];
  columns?: number;
  gap?: string;
  className?: string;
  onImageClick?: (image: Image, index: number) => void;
  onImageLoad?: (image: Image, index: number) => void;
  onImageError?: (image: Image, index: number, error: Event) => void;
  showSkeleton?: boolean;
  skeletonItems?: number;
  rootMargin?: string;
  threshold?: number;
  triggerOnce?: boolean;
}

export const LazyImageGrid: React.FC<LazyImageGridProps> = ({
  images,
  columns = 3,
  gap = '1rem',
  className,
  onImageClick,
  onImageLoad,
  onImageError,
  showSkeleton = true,
  skeletonItems = 12,
  rootMargin = '50px 0px',
  threshold = 0.1,
  triggerOnce = true,
}) => {
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [errorImages, setErrorImages] = useState<Set<number>>(new Set());

  const handleImageLoad = useCallback((image: Image, index: number) => {
    setLoadedImages(prev => new Set([...prev, index]));
    onImageLoad?.(image, index);
  }, [onImageLoad]);

  const handleImageError = useCallback((image: Image, index: number, error: Event) => {
    setErrorImages(prev => new Set([...prev, index]));
    onImageError?.(image, index, error);
  }, [onImageError]);

  const handleImageClick = useCallback((image: Image, index: number) => {
    onImageClick?.(image, index);
  }, [onImageClick]);

  // Generate image sources for lazy loading
  const imageSources = images.map(img => img.url || img.thumbnail_url || '');

  return (
    <div 
      className={cn('grid', className)}
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap,
      }}
    >
      {images.map((image, index) => (
        <div
          key={image.id}
          className="relative group cursor-pointer"
          onClick={() => handleImageClick(image, index)}
        >
          {/* Skeleton placeholder */}
          {!loadedImages.has(index) && !errorImages.has(index) && showSkeleton && (
            <Skeleton 
              variant="image" 
              className="w-full aspect-square rounded-lg" 
            />
          )}
          
          {/* Error state */}
          {errorImages.has(index) && (
            <div className="flex items-center justify-center bg-gray-100 text-gray-500 w-full aspect-square rounded-lg">
              <div className="text-center">
                <div className="text-2xl mb-1">📷</div>
                <div className="text-xs">Failed to load</div>
              </div>
            </div>
          )}
          
          {/* Lazy loaded image */}
          <LazyImage
            src={image.url || image.thumbnail_url || ''}
            alt={image.filename || `Image ${index + 1}`}
            fallbackSrc={image.thumbnail_url}
            className={cn(
              'w-full aspect-square object-cover rounded-lg',
              'transition-all duration-300',
              'group-hover:scale-105 group-hover:shadow-lg',
              loadedImages.has(index) ? 'opacity-100' : 'opacity-0'
            )}
            onLoad={() => handleImageLoad(image, index)}
            onError={(error) => handleImageError(image, index, error)}
            rootMargin={rootMargin}
            threshold={threshold}
            triggerOnce={triggerOnce}
            loading="lazy"
          />
          
          {/* Image overlay with metadata */}
          {loadedImages.has(index) && (
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300 rounded-lg">
              <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="text-white text-sm font-medium truncate">
                  {image.filename}
                </div>
                <div className="text-white text-xs opacity-75">
                  {image.width} × {image.height}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
      
      {/* Show skeleton items for loading state */}
      {images.length === 0 && showSkeleton && (
        <>
          {Array.from({ length: skeletonItems }).map((_, index) => (
            <Skeleton 
              key={`skeleton-${index}`}
              variant="image" 
              className="w-full aspect-square rounded-lg" 
            />
          ))}
        </>
      )}
    </div>
  );
};

export default LazyImageGrid;







