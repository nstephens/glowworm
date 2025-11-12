import React from 'react';
import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
  children?: React.ReactNode;
  variant?: 'text' | 'image' | 'card' | 'button' | 'input' | 'avatar' | 'list-item';
  width?: string | number;
  height?: string | number;
  rounded?: boolean;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  children,
  variant = 'text',
  width,
  height,
  rounded = false,
}) => {
  const baseClasses = 'skeleton';
  
  const variantClasses = {
    text: 'skeleton-text',
    image: 'skeleton-image',
    card: 'skeleton-card',
    button: 'skeleton-button',
    input: 'skeleton-input',
    avatar: 'skeleton-avatar',
    'list-item': 'skeleton-list-item',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={cn(
        baseClasses,
        variantClasses[variant],
        rounded && 'rounded-full',
        className
      )}
      style={style}
    >
      {children}
    </div>
  );
};

// Pre-built skeleton components for common use cases
export const SkeletonCard: React.FC<{ className?: string; lines?: number }> = ({
  className,
  lines = 3,
}) => (
  <div className={cn('skeleton-card', className)}>
    <Skeleton variant="image" className="mb-4" />
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        variant="text"
        className={i === lines - 1 ? 'w-4/5' : ''}
      />
    ))}
  </div>
);

export const SkeletonList: React.FC<{ 
  className?: string; 
  items?: number;
  showAvatar?: boolean;
}> = ({ 
  className, 
  items = 5,
  showAvatar = false 
}) => (
  <div className={cn('space-y-2', className)}>
    {Array.from({ length: items }).map((_, i) => (
      <div key={i} className="skeleton-list-item">
        {showAvatar && <Skeleton variant="avatar" />}
        <div className="flex-1">
          <Skeleton variant="text" className="mb-2" />
          <Skeleton variant="text" className="w-3/4" />
        </div>
      </div>
    ))}
  </div>
);

export const SkeletonImageGrid: React.FC<{ 
  className?: string; 
  columns?: number;
  items?: number;
}> = ({ 
  className, 
  columns = 3,
  items = 6 
}) => (
  <div 
    className={cn(
      'grid gap-4',
      `grid-cols-${columns}`,
      className
    )}
  >
    {Array.from({ length: items }).map((_, i) => (
      <Skeleton key={i} variant="image" />
    ))}
  </div>
);

export const SkeletonForm: React.FC<{ 
  className?: string; 
  fields?: number;
}> = ({ 
  className, 
  fields = 4 
}) => (
  <div className={cn('space-y-4', className)}>
    {Array.from({ length: fields }).map((_, i) => (
      <div key={i}>
        <Skeleton variant="text" className="w-1/4 mb-2" />
        <Skeleton variant="input" />
      </div>
    ))}
    <div className="flex gap-2 pt-4">
      <Skeleton variant="button" className="w-20" />
      <Skeleton variant="button" className="w-16" />
    </div>
  </div>
);

export default Skeleton;








