import React from 'react';
import { Skeleton, SkeletonCard, SkeletonText } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface DashboardSkeletonProps {
  className?: string;
}

export const DashboardSkeleton: React.FC<DashboardSkeletonProps> = ({
  className,
}) => {
  return (
    <div className={cn('p-6 space-y-6', className)}>
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton height="2.5rem" width="12rem" />
          <Skeleton height="1.25rem" width="20rem" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton height="2.5rem" width="16rem" />
          <Skeleton height="2.5rem" width="6rem" />
          <Skeleton height="2.5rem" width="4rem" />
        </div>
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="p-6 border rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton height="1rem" width="8rem" />
              <Skeleton height="2rem" width="2rem" className="rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton height="2rem" width="6rem" />
              <Skeleton height="1rem" width="4rem" />
            </div>
          </div>
        ))}
      </div>

      {/* Main content grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Upload trends chart */}
          <div className="p-6 border rounded-lg space-y-4">
            <div className="space-y-2">
              <Skeleton height="1.5rem" width="10rem" />
              <Skeleton height="1rem" width="16rem" />
            </div>
            <Skeleton height="20rem" width="100%" className="rounded" />
          </div>

          {/* Storage chart */}
          <div className="p-6 border rounded-lg space-y-4">
            <div className="space-y-2">
              <Skeleton height="1.5rem" width="8rem" />
              <Skeleton height="1rem" width="12rem" />
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Skeleton height="1rem" width="6rem" />
                <Skeleton height="1rem" width="4rem" />
              </div>
              <Skeleton height="0.5rem" width="100%" className="rounded-full" />
              <Skeleton height="12rem" width="100%" className="rounded" />
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Activity timeline */}
          <div className="p-6 border rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton height="1.5rem" width="8rem" />
              <Skeleton height="1rem" width="1rem" />
            </div>
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <Skeleton height="2rem" width="2rem" className="rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton height="1rem" width="80%" />
                    <Skeleton height="0.75rem" width="60%" />
                    <div className="flex items-center space-x-2">
                      <Skeleton height="0.75rem" width="4rem" />
                      <Skeleton height="0.75rem" width="3rem" />
                    </div>
                  </div>
                  <Skeleton height="0.75rem" width="4rem" />
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div className="p-6 border rounded-lg space-y-4">
            <div className="flex items-center gap-2">
              <Skeleton height="1.25rem" width="1.25rem" />
              <Skeleton height="1.5rem" width="10rem" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-3">
                  <div className="flex items-start space-x-3">
                    <Skeleton height="2.5rem" width="2.5rem" className="rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Skeleton height="1rem" width="8rem" />
                        <Skeleton height="1rem" width="3rem" className="rounded-full" />
                      </div>
                      <Skeleton height="0.75rem" width="100%" />
                      <div className="flex items-center space-x-2">
                        <Skeleton height="0.75rem" width="4rem" />
                        <Skeleton height="0.75rem" width="3rem" />
                      </div>
                    </div>
                  </div>
                  <Skeleton height="2rem" width="100%" className="rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="p-6 border rounded-lg space-y-4">
        <div className="space-y-2">
          <Skeleton height="1.5rem" width="8rem" />
          <Skeleton height="1rem" width="12rem" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-20 border rounded-lg flex flex-col items-center justify-center space-y-2">
              <Skeleton height="1.5rem" width="1.5rem" />
              <Skeleton height="1rem" width="4rem" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface StatsCardSkeletonProps {
  className?: string;
}

export const StatsCardSkeleton: React.FC<StatsCardSkeletonProps> = ({
  className,
}) => {
  return (
    <div className={cn('p-6 border rounded-lg space-y-4', className)}>
      <div className="flex items-center justify-between">
        <Skeleton height="1rem" width="8rem" />
        <Skeleton height="2rem" width="2rem" className="rounded-full" />
      </div>
      <div className="space-y-2">
        <Skeleton height="2rem" width="6rem" />
        <Skeleton height="1rem" width="4rem" />
      </div>
    </div>
  );
};

interface ChartSkeletonProps {
  className?: string;
  height?: number;
}

export const ChartSkeleton: React.FC<ChartSkeletonProps> = ({
  className,
  height = 300,
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="space-y-2">
        <Skeleton height="1.5rem" width="10rem" />
        <Skeleton height="1rem" width="16rem" />
      </div>
      <Skeleton height={`${height}px`} width="100%" className="rounded" />
    </div>
  );
};

interface ActivityTimelineSkeletonProps {
  className?: string;
  itemCount?: number;
}

export const ActivityTimelineSkeleton: React.FC<ActivityTimelineSkeletonProps> = ({
  className,
  itemCount = 5,
}) => {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <Skeleton height="1.5rem" width="8rem" />
        <Skeleton height="1rem" width="1rem" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: itemCount }).map((_, index) => (
          <div key={index} className="flex items-start space-x-3">
            <Skeleton height="2rem" width="2rem" className="rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton height="1rem" width="80%" />
              <Skeleton height="0.75rem" width="60%" />
              <div className="flex items-center space-x-2">
                <Skeleton height="0.75rem" width="4rem" />
                <Skeleton height="0.75rem" width="3rem" />
              </div>
            </div>
            <Skeleton height="0.75rem" width="4rem" />
          </div>
        ))}
      </div>
    </div>
  );
};
