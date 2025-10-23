import React from 'react';
import { cn } from '@/lib/utils';

export type StackSpacing = '0' | '1' | '2' | '3' | '4' | '6' | '8' | '12' | '16' | '24' | '32';
export type StackAlign = 'start' | 'center' | 'end' | 'stretch';

interface StackProps {
  /** Spacing between items (8px grid units) */
  spacing?: StackSpacing;
  /** Horizontal alignment of items */
  align?: StackAlign;
  /** Whether to make items full width */
  fullWidth?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Child content */
  children: React.ReactNode;
}

const spacingClasses: Record<StackSpacing, string> = {
  '0': 'space-y-0',
  '1': 'space-y-1',
  '2': 'space-y-2',
  '3': 'space-y-3',
  '4': 'space-y-4',
  '6': 'space-y-6',
  '8': 'space-y-8',
  '12': 'space-y-12',
  '16': 'space-y-16',
  '24': 'space-y-24',
  '32': 'space-y-32',
};

const alignClasses: Record<StackAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
};

/**
 * Stack component for vertical spacing using the 8px grid system
 * 
 * @example
 * ```tsx
 * <Stack spacing="4">
 *   <div>Item 1</div>
 *   <div>Item 2</div>
 *   <div>Item 3</div>
 * </Stack>
 * 
 * <Stack spacing="8" align="center">
 *   <Button>Centered Button 1</Button>
 *   <Button>Centered Button 2</Button>
 * </Stack>
 * ```
 */
export const Stack: React.FC<StackProps> = ({
  spacing = '4',
  align = 'stretch',
  fullWidth = false,
  className,
  children,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col',
        spacingClasses[spacing],
        alignClasses[align],
        fullWidth && 'w-full',
        className
      )}
    >
      {children}
    </div>
  );
};

