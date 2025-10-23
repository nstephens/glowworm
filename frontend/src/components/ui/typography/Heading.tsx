import React from 'react';
import { cn } from '@/lib/utils';

export type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
export type HeadingSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';
export type HeadingWeight = 'light' | 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold' | 'black';

interface HeadingProps {
  /** The semantic HTML heading level */
  as?: HeadingLevel;
  /** Visual size (can differ from semantic level) */
  size?: HeadingSize;
  /** Font weight */
  weight?: HeadingWeight;
  /** Text color (Tailwind color class) */
  color?: string;
  /** Additional CSS classes */
  className?: string;
  /** Child content */
  children: React.ReactNode;
}

// Default sizes for each heading level
const defaultSizes: Record<HeadingLevel, HeadingSize> = {
  h1: '4xl',
  h2: '3xl',
  h3: '2xl',
  h4: 'xl',
  h5: 'lg',
  h6: 'base',
};

// Default weights for each heading level
const defaultWeights: Record<HeadingLevel, HeadingWeight> = {
  h1: 'bold',
  h2: 'bold',
  h3: 'semibold',
  h4: 'semibold',
  h5: 'medium',
  h6: 'medium',
};

/**
 * Heading component for consistent typography
 * 
 * @example
 * ```tsx
 * <Heading as="h1">Page Title</Heading>
 * <Heading as="h2" size="4xl" weight="extrabold">Large Heading</Heading>
 * <Heading as="h3" color="text-primary">Colored Heading</Heading>
 * ```
 */
export const Heading: React.FC<HeadingProps> = ({
  as = 'h2',
  size,
  weight,
  color = 'text-foreground',
  className,
  children,
}) => {
  const Component = as;
  const finalSize = size || defaultSizes[as];
  const finalWeight = weight || defaultWeights[as];

  const sizeClasses: Record<HeadingSize, string> = {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
    '2xl': 'text-2xl',
    '3xl': 'text-3xl',
    '4xl': 'text-4xl',
    '5xl': 'text-5xl',
    '6xl': 'text-6xl',
  };

  const weightClasses: Record<HeadingWeight, string> = {
    light: 'font-light',
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
    extrabold: 'font-extrabold',
    black: 'font-black',
  };

  return (
    <Component
      className={cn(
        'font-sans tracking-tight',
        sizeClasses[finalSize],
        weightClasses[finalWeight],
        color,
        className
      )}
    >
      {children}
    </Component>
  );
};

