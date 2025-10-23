import React from 'react';
import { cn } from '@/lib/utils';

export type InlineSpacing = '0' | '1' | '2' | '3' | '4' | '6' | '8' | '12' | '16' | '24' | '32';
export type InlineAlign = 'start' | 'center' | 'end' | 'baseline';
export type InlineJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';

interface InlineProps {
  /** Spacing between items (8px grid units) */
  spacing?: InlineSpacing;
  /** Vertical alignment of items */
  align?: InlineAlign;
  /** Horizontal distribution of items */
  justify?: InlineJustify;
  /** Whether items should wrap */
  wrap?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Child content */
  children: React.ReactNode;
}

const spacingClasses: Record<InlineSpacing, string> = {
  '0': 'space-x-0',
  '1': 'space-x-1',
  '2': 'space-x-2',
  '3': 'space-x-3',
  '4': 'space-x-4',
  '6': 'space-x-6',
  '8': 'space-x-8',
  '12': 'space-x-12',
  '16': 'space-x-16',
  '24': 'space-x-24',
  '32': 'space-x-32',
};

const alignClasses: Record<InlineAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  baseline: 'items-baseline',
};

const justifyClasses: Record<InlineJustify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
};

/**
 * Inline component for horizontal spacing using the 8px grid system
 * 
 * @example
 * ```tsx
 * <Inline spacing="4">
 *   <Button>Action 1</Button>
 *   <Button>Action 2</Button>
 *   <Button>Action 3</Button>
 * </Inline>
 * 
 * <Inline spacing="2" align="center" justify="between" wrap>
 *   <Chip>Tag 1</Chip>
 *   <Chip>Tag 2</Chip>
 *   <Chip>Tag 3</Chip>
 * </Inline>
 * ```
 */
export const Inline: React.FC<InlineProps> = ({
  spacing = '4',
  align = 'center',
  justify = 'start',
  wrap = false,
  className,
  children,
}) => {
  return (
    <div
      className={cn(
        'flex flex-row',
        spacingClasses[spacing],
        alignClasses[align],
        justifyClasses[justify],
        wrap && 'flex-wrap',
        className
      )}
    >
      {children}
    </div>
  );
};

