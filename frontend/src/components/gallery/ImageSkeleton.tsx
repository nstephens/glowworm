import React from 'react';
import { cn } from '@/lib/utils';

interface ImageSkeletonProps {
  className?: string;
  aspectRatio?: string;
}

/**
 * ImageSkeleton - Loading skeleton for gallery images
 * 
 * Features:
 * - Animated shimmer effect
 * - Configurable aspect ratio
 * - Responsive design
 * - Accessibility support
 */
export const ImageSkeleton: React.FC<ImageSkeletonProps> = ({
  className,
  aspectRatio = '4/3',
}) => {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-muted",
        "animate-pulse",
        className
      )}
      style={{ aspectRatio }}
    >
      {/* Shimmer effect */}
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      
      {/* Content placeholder */}
      <div className="flex flex-col justify-between h-full p-4">
        {/* Top section */}
        <div className="space-y-2">
          <div className="h-4 bg-muted-foreground/20 rounded w-3/4" />
          <div className="h-3 bg-muted-foreground/10 rounded w-1/2" />
          <div className="h-3 bg-muted-foreground/10 rounded w-1/3" />
        </div>
        
        {/* Bottom section */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <div className="h-6 w-6 bg-muted-foreground/20 rounded" />
            <div className="h-6 w-6 bg-muted-foreground/20 rounded" />
            <div className="h-6 w-6 bg-muted-foreground/20 rounded" />
          </div>
          <div className="h-6 w-6 bg-muted-foreground/20 rounded" />
        </div>
      </div>
    </div>
  );
};

// CSS for shimmer animation (add to global CSS)
export const shimmerCSS = `
@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
`;
