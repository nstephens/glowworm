import React from 'react';
import { Skeleton } from '../ui/Skeleton';
import { cn } from '../../lib/utils';

interface MobileBottomNavSkeletonProps {
  className?: string;
}

export const MobileBottomNavSkeleton: React.FC<MobileBottomNavSkeletonProps> = ({
  className,
}) => {
  return (
    <div className={cn(
      'fixed bottom-0 left-0 right-0 z-50',
      'bg-white border-t border-gray-200',
      'px-4 py-2',
      'safe-area-pb',
      className
    )}>
      <div className="flex items-center justify-around">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center space-y-1">
            <Skeleton variant="button" className="w-6 h-6 rounded-full" />
            <Skeleton variant="text" className="w-8 h-3" />
          </div>
        ))}
      </div>
    </div>
  );
};

export default MobileBottomNavSkeleton;




