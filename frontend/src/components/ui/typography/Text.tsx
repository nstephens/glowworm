import React from 'react';
import { cn } from '@/lib/utils';

export type TextVariant = 'body' | 'lead' | 'large' | 'small' | 'muted' | 'caption';
export type TextSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl';
export type TextWeight = 'light' | 'normal' | 'medium' | 'semibold' | 'bold';

interface TextProps {
  /** Visual variant */
  variant?: TextVariant;
  /** Custom size (overrides variant size) */
  size?: TextSize;
  /** Font weight */
  weight?: TextWeight;
  /** Text color (Tailwind color class) */
  color?: string;
  /** HTML element to render */
  as?: 'p' | 'span' | 'div' | 'label';
  /** Additional CSS classes */
  className?: string;
  /** Child content */
  children: React.ReactNode;
}

// Variant styles
const variantStyles: Record<TextVariant, string> = {
  body: 'text-base text-foreground leading-normal',
  lead: 'text-xl text-foreground font-normal leading-relaxed',
  large: 'text-lg text-foreground font-medium',
  small: 'text-sm text-foreground leading-tight',
  muted: 'text-sm text-muted-foreground',
  caption: 'text-xs text-muted-foreground',
};

/**
 * Text component for consistent body text styling
 * 
 * @example
 * ```tsx
 * <Text>Default body text</Text>
 * <Text variant="lead">Lead paragraph text</Text>
 * <Text variant="muted">Muted secondary text</Text>
 * <Text as="span" size="sm" weight="semibold">Inline text</Text>
 * ```
 */
export const Text: React.FC<TextProps> = ({
  variant = 'body',
  size,
  weight,
  color,
  as = 'p',
  className,
  children,
}) => {
  const Component = as;

  const sizeClasses: Record<TextSize, string> = {
    xs: 'text-xs',
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl',
  };

  const weightClasses: Record<TextWeight, string> = {
    light: 'font-light',
    normal: 'font-normal',
    medium: 'font-medium',
    semibold: 'font-semibold',
    bold: 'font-bold',
  };

  // If custom size/weight/color provided, use those instead of variant styles
  const customStyles = size || weight || color;
  const baseStyles = customStyles ? 'font-sans' : variantStyles[variant];

  return (
    <Component
      className={cn(
        baseStyles,
        size && sizeClasses[size],
        weight && weightClasses[weight],
        color,
        className
      )}
    >
      {children}
    </Component>
  );
};

