import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  variant?: 'default' | 'circular' | 'rectangular';
  animation?: 'pulse' | 'wave' | 'none';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  borderRadius = '0.25rem',
  className,
  variant = 'default',
  animation = 'pulse',
}) => {
  const prefersReducedMotion = useReducedMotion();

  const getVariantStyles = () => {
    switch (variant) {
      case 'circular':
        return {
          width: height,
          height: height,
          borderRadius: '50%',
        };
      case 'rectangular':
        return {
          width,
          height,
          borderRadius: 0,
        };
      default:
        return {
          width,
          height,
          borderRadius,
        };
    }
  };

  const getAnimationProps = () => {
    if (prefersReducedMotion || animation === 'none') {
      return {};
    }

    switch (animation) {
      case 'wave':
        return {
          animate: {
            backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
          },
          transition: {
            duration: 1.5,
            repeat: Infinity,
            ease: 'linear',
          },
        };
      case 'pulse':
      default:
        return {
          animate: {
            opacity: [0.5, 0.8, 0.5],
          },
          transition: {
            duration: 1.5,
            repeat: Infinity,
            ease: 'easeInOut',
          },
        };
    }
  };

  const baseStyles = getVariantStyles();
  const animationProps = getAnimationProps();

  return (
    <motion.div
      className={cn(
        'bg-muted',
        animation === 'wave' && 'bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%]',
        className
      )}
      style={baseStyles}
      {...animationProps}
      aria-hidden="true"
    />
  );
};

interface SkeletonTextProps {
  lines?: number;
  className?: string;
  lineHeight?: string | number;
  spacing?: string | number;
}

export const SkeletonText: React.FC<SkeletonTextProps> = ({
  lines = 1,
  className,
  lineHeight = '1.2rem',
  spacing = '0.5rem',
}) => {
  return (
    <div className={cn('space-y-2', className)} style={{ gap: spacing }}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          height={lineHeight}
          width={index === lines - 1 ? '75%' : '100%'}
        />
      ))}
    </div>
  );
};

interface SkeletonAvatarProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const SkeletonAvatar: React.FC<SkeletonAvatarProps> = ({
  size = 'md',
  className,
}) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-12 w-12',
    xl: 'h-16 w-16',
  };

  return (
    <Skeleton
      variant="circular"
      className={cn(sizeClasses[size], className)}
    />
  );
};

interface SkeletonButtonProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const SkeletonButton: React.FC<SkeletonButtonProps> = ({
  size = 'md',
  className,
}) => {
  const sizeClasses = {
    sm: 'h-8 w-16',
    md: 'h-10 w-20',
    lg: 'h-12 w-24',
  };

  return (
    <Skeleton
      className={cn(sizeClasses[size], 'rounded-md', className)}
    />
  );
};

interface SkeletonCardProps {
  className?: string;
  showAvatar?: boolean;
  showActions?: boolean;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  className,
  showAvatar = false,
  showActions = false,
}) => {
  return (
    <div className={cn('p-6 border rounded-lg space-y-4', className)}>
      {showAvatar && (
        <div className="flex items-center space-x-3">
          <SkeletonAvatar size="md" />
          <div className="space-y-2 flex-1">
            <Skeleton height="1rem" width="60%" />
            <Skeleton height="0.75rem" width="40%" />
          </div>
        </div>
      )}
      
      <div className="space-y-3">
        <Skeleton height="1.5rem" width="80%" />
        <SkeletonText lines={2} />
      </div>
      
      {showActions && (
        <div className="flex space-x-2">
          <SkeletonButton size="sm" />
          <SkeletonButton size="sm" />
        </div>
      )}
    </div>
  );
};
