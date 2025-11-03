import React from 'react';
import { Skeleton } from '../ui/Skeleton';
import { cn } from '../../lib/utils';

interface DashboardSkeletonProps {
  className?: string;
  showCharts?: boolean;
  showRecentActivity?: boolean;
}

export const DashboardSkeleton: React.FC<DashboardSkeletonProps> = ({
  className,
  showCharts = true,
  showRecentActivity = true,
}) => {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton variant="text" className="w-48 h-8 mb-2" />
          <Skeleton variant="text" className="w-64 h-4" />
        </div>
        <Skeleton variant="button" className="w-32 h-10" />
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-card">
            <div className="flex items-center justify-between mb-4">
              <Skeleton variant="text" className="w-20 h-5" />
              <Skeleton variant="button" className="w-8 h-8 rounded-full" />
            </div>
            <Skeleton variant="text" className="w-16 h-8 mb-2" />
            <Skeleton variant="text" className="w-24 h-4" />
          </div>
        ))}
      </div>

      {/* Charts section skeleton */}
      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="skeleton-card">
            <Skeleton variant="text" className="w-32 h-6 mb-4" />
            <Skeleton variant="image" className="h-64" />
          </div>
          <div className="skeleton-card">
            <Skeleton variant="text" className="w-32 h-6 mb-4" />
            <Skeleton variant="image" className="h-64" />
          </div>
        </div>
      )}

      {/* Recent activity skeleton */}
      {showRecentActivity && (
        <div className="skeleton-card">
          <div className="flex items-center justify-between mb-4">
            <Skeleton variant="text" className="w-32 h-6" />
            <Skeleton variant="button" className="w-20 h-8" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="skeleton-list-item">
                <Skeleton variant="avatar" />
                <div className="flex-1">
                  <Skeleton variant="text" className="w-3/4 mb-1" />
                  <Skeleton variant="text" className="w-1/2 h-3" />
                </div>
                <Skeleton variant="text" className="w-16 h-4" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardSkeleton;