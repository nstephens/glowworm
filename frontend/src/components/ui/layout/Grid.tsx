import React from 'react';
import { cn } from '@/lib/utils';

export type GridCols = '1' | '2' | '3' | '4' | '5' | '6' | '12';
export type GridGap = '0' | '1' | '2' | '3' | '4' | '6' | '8' | '12' | '16' | '24' | '32';

interface GridProps {
  /** Number of columns */
  cols?: GridCols;
  /** Responsive columns (e.g., { sm: '2', md: '3', lg: '4' }) */
  responsiveCols?: {
    sm?: GridCols;
    md?: GridCols;
    lg?: GridCols;
    xl?: GridCols;
  };
  /** Gap between grid items (8px grid units) */
  gap?: GridGap;
  /** Separate gap for rows */
  gapY?: GridGap;
  /** Separate gap for columns */
  gapX?: GridGap;
  /** Additional CSS classes */
  className?: string;
  /** Child content */
  children: React.ReactNode;
}

const colsClasses: Record<GridCols, string> = {
  '1': 'grid-cols-1',
  '2': 'grid-cols-2',
  '3': 'grid-cols-3',
  '4': 'grid-cols-4',
  '5': 'grid-cols-5',
  '6': 'grid-cols-6',
  '12': 'grid-cols-12',
};

const gapClasses: Record<GridGap, string> = {
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

const gapYClasses: Record<GridGap, string> = {
  '0': 'gap-y-0',
  '1': 'gap-y-1',
  '2': 'gap-y-2',
  '3': 'gap-y-3',
  '4': 'gap-y-4',
  '6': 'gap-y-6',
  '8': 'gap-y-8',
  '12': 'gap-y-12',
  '16': 'gap-y-16',
  '24': 'gap-y-24',
  '32': 'gap-y-32',
};

const gapXClasses: Record<GridGap, string> = {
  '0': 'gap-x-0',
  '1': 'gap-x-1',
  '2': 'gap-x-2',
  '3': 'gap-x-3',
  '4': 'gap-x-4',
  '6': 'gap-x-6',
  '8': 'gap-x-8',
  '12': 'gap-x-12',
  '16': 'gap-x-16',
  '24': 'gap-x-24',
  '32': 'gap-x-32',
};

/**
 * Grid component for CSS Grid layouts using the 8px grid system
 * 
 * @example
 * ```tsx
 * <Grid cols="3" gap="4">
 *   <Card>Item 1</Card>
 *   <Card>Item 2</Card>
 *   <Card>Item 3</Card>
 * </Grid>
 * 
 * <Grid 
 *   responsiveCols={{ sm: '1', md: '2', lg: '3', xl: '4' }} 
 *   gap="6"
 * >
 *   <ImageCard />
 *   <ImageCard />
 *   <ImageCard />
 * </Grid>
 * 
 * <Grid cols="4" gapX="8" gapY="4">
 *   <div>Asymmetric spacing</div>
 * </Grid>
 * ```
 */
export const Grid: React.FC<GridProps> = ({
  cols = '1',
  responsiveCols,
  gap,
  gapY,
  gapX,
  className,
  children,
}) => {
  const responsiveClasses = responsiveCols
    ? [
        responsiveCols.sm && `sm:grid-cols-${responsiveCols.sm}`,
        responsiveCols.md && `md:grid-cols-${responsiveCols.md}`,
        responsiveCols.lg && `lg:grid-cols-${responsiveCols.lg}`,
        responsiveCols.xl && `xl:grid-cols-${responsiveCols.xl}`,
      ].filter(Boolean)
    : [];

  return (
    <div
      className={cn(
        'grid',
        colsClasses[cols],
        ...responsiveClasses,
        gap && gapClasses[gap],
        gapY && gapYClasses[gapY],
        gapX && gapXClasses[gapX],
        className
      )}
    >
      {children}
    </div>
  );
};

