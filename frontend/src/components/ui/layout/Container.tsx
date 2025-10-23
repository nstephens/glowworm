import React from 'react';
import { cn } from '@/lib/utils';

export type ContainerSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

interface ContainerProps {
  /** Maximum width of the container */
  size?: ContainerSize;
  /** Whether to center the container */
  centered?: boolean;
  /** Padding on x-axis */
  px?: string;
  /** Padding on y-axis */
  py?: string;
  /** Additional CSS classes */
  className?: string;
  /** Child content */
  children: React.ReactNode;
}

const sizeClasses: Record<ContainerSize, string> = {
  sm: 'max-w-screen-sm',   // 640px
  md: 'max-w-screen-md',   // 768px
  lg: 'max-w-screen-lg',   // 1024px
  xl: 'max-w-screen-xl',   // 1280px
  '2xl': 'max-w-screen-2xl', // 1536px
  full: 'max-w-full',
};

/**
 * Container component for page width constraints
 * 
 * @example
 * ```tsx
 * <Container size="lg">
 *   <h1>Page Content</h1>
 * </Container>
 * 
 * <Container size="xl" centered px="px-6">
 *   <p>Centered content with custom padding</p>
 * </Container>
 * ```
 */
export const Container: React.FC<ContainerProps> = ({
  size = 'xl',
  centered = true,
  px = 'px-4 sm:px-6',
  py,
  className,
  children,
}) => {
  return (
    <div
      className={cn(
        'w-full',
        sizeClasses[size],
        centered && 'mx-auto',
        px,
        py,
        className
      )}
    >
      {children}
    </div>
  );
};

