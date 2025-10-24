import React from 'react';
import { Skeleton, SkeletonText, SkeletonButton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface FormSkeletonProps {
  className?: string;
  fieldCount?: number;
  showSubmitButton?: boolean;
}

export const FormSkeleton: React.FC<FormSkeletonProps> = ({
  className,
  fieldCount = 4,
  showSubmitButton = true,
}) => {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Form title */}
      <div className="space-y-2">
        <Skeleton height="1.5rem" width="12rem" />
        <Skeleton height="1rem" width="20rem" />
      </div>

      {/* Form fields */}
      <div className="space-y-4">
        {Array.from({ length: fieldCount }).map((_, index) => (
          <div key={index} className="space-y-2">
            <Skeleton height="1rem" width="6rem" />
            <Skeleton height="2.5rem" width="100%" className="rounded-md" />
            {index % 3 === 0 && (
              <Skeleton height="0.75rem" width="8rem" />
            )}
          </div>
        ))}
      </div>

      {/* Submit button */}
      {showSubmitButton && (
        <div className="flex justify-end space-x-2">
          <SkeletonButton size="md" />
          <SkeletonButton size="md" />
        </div>
      )}
    </div>
  );
};

interface UploadSkeletonProps {
  className?: string;
  fileCount?: number;
}

export const UploadSkeleton: React.FC<UploadSkeletonProps> = ({
  className,
  fileCount = 3,
}) => {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Upload area */}
      <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center space-y-4">
        <Skeleton height="3rem" width="3rem" className="mx-auto rounded-full" />
        <div className="space-y-2">
          <Skeleton height="1.25rem" width="12rem" className="mx-auto" />
          <Skeleton height="1rem" width="16rem" className="mx-auto" />
        </div>
        <SkeletonButton size="lg" />
      </div>

      {/* File list */}
      <div className="space-y-3">
        <Skeleton height="1.25rem" width="8rem" />
        {Array.from({ length: fileCount }).map((_, index) => (
          <div key={index} className="flex items-center space-x-4 p-4 border rounded-lg">
            <Skeleton height="3rem" width="3rem" className="rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton height="1rem" width="60%" />
              <Skeleton height="0.75rem" width="40%" />
              <div className="flex items-center space-x-4">
                <Skeleton height="0.5rem" width="8rem" className="rounded-full" />
                <Skeleton height="0.75rem" width="3rem" />
              </div>
            </div>
            <div className="flex space-x-2">
              <Skeleton height="2rem" width="2rem" className="rounded" />
              <Skeleton height="2rem" width="2rem" className="rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

interface ProfileSkeletonProps {
  className?: string;
}

export const ProfileSkeleton: React.FC<ProfileSkeletonProps> = ({
  className,
}) => {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Profile header */}
      <div className="flex items-center space-x-4">
        <Skeleton height="4rem" width="4rem" className="rounded-full" />
        <div className="space-y-2">
          <Skeleton height="1.5rem" width="12rem" />
          <Skeleton height="1rem" width="8rem" />
          <Skeleton height="0.75rem" width="6rem" />
        </div>
      </div>

      {/* Profile form */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton height="1rem" width="4rem" />
            <Skeleton height="2.5rem" width="100%" className="rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton height="1rem" width="6rem" />
            <Skeleton height="2.5rem" width="100%" className="rounded-md" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton height="1rem" width="5rem" />
            <Skeleton height="2.5rem" width="100%" className="rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton height="1rem" width="7rem" />
            <Skeleton height="2.5rem" width="100%" className="rounded-md" />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex justify-end space-x-2">
        <SkeletonButton size="md" />
        <SkeletonButton size="md" />
      </div>
    </div>
  );
};

interface SettingsSkeletonProps {
  className?: string;
  sectionCount?: number;
}

export const SettingsSkeleton: React.FC<SettingsSkeletonProps> = ({
  className,
  sectionCount = 3,
}) => {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Settings header */}
      <div className="space-y-2">
        <Skeleton height="2rem" width="12rem" />
        <Skeleton height="1rem" width="20rem" />
      </div>

      {/* Settings sections */}
      {Array.from({ length: sectionCount }).map((_, sectionIndex) => (
        <div key={sectionIndex} className="p-6 border rounded-lg space-y-4">
          <div className="space-y-2">
            <Skeleton height="1.5rem" width="10rem" />
            <Skeleton height="1rem" width="16rem" />
          </div>
          
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, fieldIndex) => (
              <div key={fieldIndex} className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton height="1rem" width="8rem" />
                  <Skeleton height="0.75rem" width="12rem" />
                </div>
                <Skeleton height="2rem" width="3rem" className="rounded-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};
