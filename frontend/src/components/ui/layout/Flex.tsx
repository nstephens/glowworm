import React from 'react';
import { cn } from '@/lib/utils';

export type FlexDirection = 'row' | 'row-reverse' | 'col' | 'col-reverse';
export type FlexAlign = 'start' | 'center' | 'end' | 'stretch' | 'baseline';
export type FlexJustify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
export type FlexWrap = 'wrap' | 'wrap-reverse' | 'nowrap';
export type FlexGap = '0' | '1' | '2' | '3' | '4' | '6' | '8' | '12' | '16' | '24' | '32';

interface FlexProps {
  /** Flex direction */
  direction?: FlexDirection;
  /** Align items (cross-axis) */
  align?: FlexAlign;
  /** Justify content (main-axis) */
  justify?: FlexJustify;
  /** Flex wrap behavior */
  wrap?: FlexWrap;
  /** Gap between flex items (8px grid units) */
  gap?: FlexGap;
  /** Whether to make container full width */
  fullWidth?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Child content */
  children: React.ReactNode;
}

const directionClasses: Record<FlexDirection, string> = {
  row: 'flex-row',
  'row-reverse': 'flex-row-reverse',
  col: 'flex-col',
  'col-reverse': 'flex-col-reverse',
};

const alignClasses: Record<FlexAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
};

const justifyClasses: Record<FlexJustify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
};

const wrapClasses: Record<FlexWrap, string> = {
  wrap: 'flex-wrap',
  'wrap-reverse': 'flex-wrap-reverse',
  nowrap: 'flex-nowrap',
};

const gapClasses: Record<FlexGap, string> = {
  '0': 'gap-0',
  '1': 'gap-1',
  '2': 'gap-2',
  '3': 'gap-3',
  '4': 'gap-4',
  '6': 'gap-6',
  '8': 'gap-8',
  '12': 'gap-12',
  '16': 'gap-16',
  '24': 'gap-24',
  '32': 'gap-32',
};

/**
 * Flex component for flexible layouts using the 8px grid system
 * 
 * @example
 * ```tsx
 * <Flex direction="row" justify="between" align="center" gap="4">
 *   <div>Left</div>
 *   <div>Right</div>
 * </Flex>
 * 
 * <Flex direction="col" gap="8">
 *   <Section />
 *   <Section />
 * </Flex>
 * 
 * <Flex wrap="wrap" gap="6" justify="center">
 *   <Card />
 *   <Card />
 *   <Card />
 * </Flex>
 * ```
 */
export const Flex: React.FC<FlexProps> = ({
  direction = 'row',
  align = 'stretch',
  justify = 'start',
  wrap = 'nowrap',
  gap,
  fullWidth = false,
  className,
  children,
}) => {
  return (
    <div
      className={cn(
        'flex',
        directionClasses[direction],
        alignClasses[align],
        justifyClasses[justify],
        wrapClasses[wrap],
        gap && gapClasses[gap],
        fullWidth && 'w-full',
        className
      )}
    >
      {children}
    </div>
  );
};

