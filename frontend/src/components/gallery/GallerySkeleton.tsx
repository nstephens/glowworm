import React from 'react';
import { Skeleton, SkeletonCard } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ImageCardSkeletonProps {
  className?: string;
  aspectRatio?: 'square' | 'portrait' | 'landscape' | 'auto';
}

export const ImageCardSkeleton: React.FC<ImageCardSkeletonProps> = ({
  className,
  aspectRatio = 'auto',
}) => {
  const getAspectRatioClass = () => {
    switch (aspectRatio) {
      case 'square':
        return 'aspect-square';
      case 'portrait':
        return 'aspect-[3/4]';
      case 'landscape':
        return 'aspect-[4/3]';
      default:
        return 'aspect-auto';
    }
  };

  return (
    <div className={cn('group relative overflow-hidden rounded-lg', className)}>
      {/* Image skeleton */}
      <Skeleton
        className={cn(
          'w-full',
          getAspectRatioClass(),
          'bg-gradient-to-br from-muted to-muted/50'
        )}
        animation="wave"
      />
      
      {/* Overlay skeleton */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200" />
      
      {/* Content skeleton */}
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
        <div className="space-y-2">
          <Skeleton height="1rem" width="70%" className="bg-white/20" />
          <div className="flex items-center space-x-2">
            <Skeleton height="0.75rem" width="40%" className="bg-white/20" />
            <Skeleton height="0.75rem" width="30%" className="bg-white/20" />
          </div>
        </div>
      </div>
      
      {/* Action buttons skeleton */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="flex space-x-1">
          <Skeleton height="2rem" width="2rem" className="rounded-full bg-white/20" />
          <Skeleton height="2rem" width="2rem" className="rounded-full bg-white/20" />
        </div>
      </div>
    </div>
  );
};

interface MasonryGallerySkeletonProps {
  className?: string;
  itemCount?: number;
}

export const MasonryGallerySkeleton: React.FC<MasonryGallerySkeletonProps> = ({
  className,
  itemCount = 12,
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Filter panel skeleton */}
      <div className="p-4 border rounded-lg space-y-4">
        <div className="flex flex-wrap gap-4">
          <Skeleton height="2.5rem" width="12rem" />
          <Skeleton height="2.5rem" width="8rem" />
          <Skeleton height="2.5rem" width="10rem" />
        </div>
        <div className="flex items-center space-x-4">
          <Skeleton height="1.5rem" width="6rem" />
          <Skeleton height="1.5rem" width="4rem" />
        </div>
      </div>
      
      {/* Gallery grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: itemCount }).map((_, index) => (
          <ImageCardSkeleton
            key={index}
            aspectRatio={index % 3 === 0 ? 'portrait' : index % 3 === 1 ? 'landscape' : 'square'}
          />
        ))}
      </div>
    </div>
  );
};

interface GalleryListSkeletonProps {
  className?: string;
  itemCount?: number;
}

export const GalleryListSkeleton: React.FC<GalleryListSkeletonProps> = ({
  className,
  itemCount = 8,
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      {Array.from({ length: itemCount }).map((_, index) => (
        <div key={index} className="flex items-center space-x-4 p-4 border rounded-lg">
          <Skeleton
            className="w-16 h-16 rounded-lg"
            animation="wave"
          />
          <div className="flex-1 space-y-2">
            <Skeleton height="1.25rem" width="60%" />
            <Skeleton height="1rem" width="40%" />
            <div className="flex items-center space-x-4">
              <Skeleton height="0.75rem" width="20%" />
              <Skeleton height="0.75rem" width="15%" />
              <Skeleton height="0.75rem" width="25%" />
            </div>
          </div>
          <div className="flex space-x-2">
            <Skeleton height="2rem" width="2rem" className="rounded" />
            <Skeleton height="2rem" width="2rem" className="rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};

interface GalleryHeaderSkeletonProps {
  className?: string;
}

export const GalleryHeaderSkeleton: React.FC<GalleryHeaderSkeletonProps> = ({
  className,
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      {/* Title and actions */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton height="2rem" width="12rem" />
          <Skeleton height="1rem" width="8rem" />
        </div>
        <div className="flex space-x-2">
          <Skeleton height="2.5rem" width="6rem" />
          <Skeleton height="2.5rem" width="6rem" />
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="p-4 border rounded-lg space-y-2">
            <Skeleton height="1rem" width="60%" />
            <Skeleton height="1.5rem" width="80%" />
            <Skeleton height="0.75rem" width="40%" />
          </div>
        ))}
      </div>
    </div>
  );
};
