import React from 'react';
import { Skeleton } from '../ui/Skeleton';
import { cn } from '../../lib/utils';

interface ImageGallerySkeletonProps {
  className?: string;
  columns?: number;
  items?: number;
  showAlbumBadges?: boolean;
  showActionButtons?: boolean;
}

export const ImageGallerySkeleton: React.FC<ImageGallerySkeletonProps> = ({
  className,
  columns = 3,
  items = 12,
  showAlbumBadges = true,
  showActionButtons = true,
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Skeleton variant="text" className="w-32 h-6" />
          <Skeleton variant="button" className="w-20 h-8" />
        </div>
        <div className="flex items-center space-x-2">
          <Skeleton variant="button" className="w-8 h-8 rounded-full" />
          <Skeleton variant="button" className="w-8 h-8 rounded-full" />
        </div>
      </div>

      {/* Image grid skeleton */}
      <div 
        className={cn(
          'grid gap-2',
          `grid-cols-${columns}`,
          'sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
        )}
      >
        {Array.from({ length: items }).map((_, i) => (
          <div key={i} className="relative group">
            {/* Image skeleton */}
            <Skeleton variant="image" className="aspect-square" />
            
            {/* Album badge skeleton */}
            {showAlbumBadges && (
              <div className="absolute top-2 left-2">
                <Skeleton variant="text" className="w-16 h-5 rounded-full" />
              </div>
            )}
            
            {/* Action buttons skeleton */}
            {showActionButtons && (
              <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex space-x-1">
                  <Skeleton variant="button" className="w-8 h-8 rounded-full" />
                  <Skeleton variant="button" className="w-8 h-8 rounded-full" />
                </div>
              </div>
            )}
            
            {/* Selection indicator skeleton */}
            <div className="absolute top-2 left-2">
              <Skeleton variant="button" className="w-5 h-5 rounded-full" />
            </div>
          </div>
        ))}
      </div>

      {/* Load more button skeleton */}
      <div className="flex justify-center pt-4">
        <Skeleton variant="button" className="w-32 h-10" />
      </div>
    </div>
  );
};

export default ImageGallerySkeleton;







