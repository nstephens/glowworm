import React from 'react';
import { cn } from '@/lib/utils';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

interface ResponsiveGridProps {
  children: React.ReactNode;
  className?: string;
  columns?: Partial<Record<'sm' | 'md' | 'lg' | 'xl' | '2xl', number>>;
  gap?: Partial<Record<'sm' | 'md' | 'lg' | 'xl' | '2xl', number>>;
  autoFit?: boolean;
  minItemWidth?: number;
  equalHeight?: boolean;
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  className,
  columns,
  gap,
  autoFit = false,
  minItemWidth = 200,
  equalHeight = false,
}) => {
  const { getGridColumns, getSpacing, getResponsiveClasses } = useResponsiveLayout();

  const gridColumns = getGridColumns(columns || {
    sm: 1,
    md: 2,
    lg: 3,
    xl: 4,
    '2xl': 5,
  });

  const gridGap = getSpacing(gap || {
    sm: 4,
    md: 6,
    lg: 8,
    xl: 8,
    '2xl': 10,
  });

  const gridClasses = getResponsiveClasses({
    sm: 'grid-cols-1',
    md: 'grid-cols-2',
    lg: 'grid-cols-3',
    xl: 'grid-cols-4',
    '2xl': 'grid-cols-5',
  });

  const gapClasses = getResponsiveClasses({
    sm: 'gap-4',
    md: 'gap-6',
    lg: 'gap-8',
    xl: 'gap-8',
    '2xl': 'gap-10',
  });

  const gridStyle = autoFit ? {
    gridTemplateColumns: `repeat(auto-fit, minmax(${minItemWidth}px, 1fr))`,
    gap: `${gridGap * 0.25}rem`,
  } : undefined;

  return (
    <div
      className={cn(
        'grid',
        !autoFit && gridClasses,
        !autoFit && gapClasses,
        equalHeight && 'items-stretch',
        className
      )}
      style={gridStyle}
    >
      {React.Children.map(children, (child, index) => (
        <div
          key={index}
          className={cn(
            equalHeight && 'flex flex-col',
            'w-full'
          )}
        >
          {child}
        </div>
      ))}
    </div>
  );
};

interface ResponsiveFlexProps {
  children: React.ReactNode;
  className?: string;
  direction?: Partial<Record<'sm' | 'md' | 'lg' | 'xl' | '2xl', 'row' | 'column'>>;
  wrap?: Partial<Record<'sm' | 'md' | 'lg' | 'xl' | '2xl', boolean>>;
  justify?: Partial<Record<'sm' | 'md' | 'lg' | 'xl' | '2xl', 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'>>;
  align?: Partial<Record<'sm' | 'md' | 'lg' | 'xl' | '2xl', 'start' | 'center' | 'end' | 'stretch' | 'baseline'>>;
  gap?: Partial<Record<'sm' | 'md' | 'lg' | 'xl' | '2xl', number>>;
}

export const ResponsiveFlex: React.FC<ResponsiveFlexProps> = ({
  children,
  className,
  direction,
  wrap,
  justify,
  align,
  gap,
}) => {
  const { getResponsiveClasses, getSpacing } = useResponsiveLayout();

  const directionClasses = getResponsiveClasses({
    sm: direction?.sm === 'column' ? 'flex-col' : 'flex-row',
    md: direction?.md === 'column' ? 'flex-col' : 'flex-row',
    lg: direction?.lg === 'column' ? 'flex-col' : 'flex-row',
    xl: direction?.xl === 'column' ? 'flex-col' : 'flex-row',
    '2xl': direction?.['2xl'] === 'column' ? 'flex-col' : 'flex-row',
  });

  const wrapClasses = getResponsiveClasses({
    sm: wrap?.sm ? 'flex-wrap' : 'flex-nowrap',
    md: wrap?.md ? 'flex-wrap' : 'flex-nowrap',
    lg: wrap?.lg ? 'flex-wrap' : 'flex-nowrap',
    xl: wrap?.xl ? 'flex-wrap' : 'flex-nowrap',
    '2xl': wrap?.['2xl'] ? 'flex-wrap' : 'flex-nowrap',
  });

  const justifyClasses = getResponsiveClasses({
    sm: justify?.sm ? `justify-${justify.sm}` : 'justify-start',
    md: justify?.md ? `justify-${justify.md}` : 'justify-start',
    lg: justify?.lg ? `justify-${justify.lg}` : 'justify-start',
    xl: justify?.xl ? `justify-${justify.xl}` : 'justify-start',
    '2xl': justify?.['2xl'] ? `justify-${justify['2xl']}` : 'justify-start',
  });

  const alignClasses = getResponsiveClasses({
    sm: align?.sm ? `items-${align.sm}` : 'items-start',
    md: align?.md ? `items-${align.md}` : 'items-start',
    lg: align?.lg ? `items-${align.lg}` : 'items-start',
    xl: align?.xl ? `items-${align.xl}` : 'items-start',
    '2xl': align?.['2xl'] ? `items-${align['2xl']}` : 'items-start',
  });

  const gapClasses = getResponsiveClasses({
    sm: gap?.sm ? `gap-${gap.sm}` : 'gap-4',
    md: gap?.md ? `gap-${gap.md}` : 'gap-4',
    lg: gap?.lg ? `gap-${gap.lg}` : 'gap-4',
    xl: gap?.xl ? `gap-${gap.xl}` : 'gap-4',
    '2xl': gap?.['2xl'] ? `gap-${gap['2xl']}` : 'gap-4',
  });

  return (
    <div
      className={cn(
        'flex',
        directionClasses,
        wrapClasses,
        justifyClasses,
        alignClasses,
        gapClasses,
        className
      )}
    >
      {children}
    </div>
  );
};
