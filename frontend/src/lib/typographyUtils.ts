import { cn } from '@/lib/utils';

/**
 * Mobile-first typography utilities
 */

export type TypographyVariant = 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'body-sm' | 'caption';
export type TypographySize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';
export type TypographyWeight = 'regular' | 'medium' | 'semibold' | 'bold';

/**
 * Mobile-optimized typography classes
 */
export const mobileTypography = {
  // Headings
  h1: 'heading-mobile-h1',
  h2: 'heading-mobile-h2', 
  h3: 'heading-mobile-h3',
  h4: 'heading-mobile-h4',
  
  // Body text
  body: 'body-mobile',
  'body-sm': 'body-mobile-sm',
  
  // Caption
  caption: 'caption-mobile',
} as const;

/**
 * Mobile-optimized text sizes
 */
export const mobileTextSizes = {
  xs: 'text-mobile-xs',
  sm: 'text-mobile-sm',
  base: 'text-mobile-base',
  lg: 'text-mobile-lg',
  xl: 'text-mobile-xl',
  '2xl': 'text-mobile-2xl',
  '3xl': 'text-mobile-3xl',
} as const;

/**
 * Text truncation utilities
 */
export const textTruncation = {
  truncate: 'text-truncate',
  clamp1: 'text-clamp-1',
  clamp2: 'text-clamp-2',
  clamp3: 'text-clamp-3',
  clamp4: 'text-clamp-4',
  clamp5: 'text-clamp-5',
} as const;

/**
 * Text overflow utilities
 */
export const textOverflow = {
  ellipsis: 'text-ellipsis',
  clip: 'text-clip',
} as const;

/**
 * Text wrapping utilities
 */
export const textWrapping = {
  wrap: 'text-wrap',
  nowrap: 'text-nowrap',
  pre: 'text-pre',
  preLine: 'text-pre-line',
  preWrap: 'text-pre-wrap',
} as const;

/**
 * Text break utilities
 */
export const textBreak = {
  normal: 'text-break-normal',
  words: 'text-break-words',
  all: 'text-break-all',
} as const;

/**
 * Text selection utilities
 */
export const textSelection = {
  none: 'text-select-none',
  text: 'text-select-text',
  all: 'text-select-all',
  auto: 'text-select-auto',
} as const;

/**
 * Text alignment utilities
 */
export const textAlignment = {
  left: 'text-align-left',
  center: 'text-align-center',
  right: 'text-align-right',
  justify: 'text-align-justify',
  responsive: 'text-align-responsive',
} as const;

/**
 * Text color utilities
 */
export const textColors = {
  primary: 'text-color-primary',
  secondary: 'text-color-secondary',
  accent: 'text-color-accent',
  success: 'text-color-success',
  warning: 'text-color-warning',
  destructive: 'text-color-destructive',
} as const;

/**
 * Text weight utilities
 */
export const textWeights = {
  light: 'text-weight-light',
  normal: 'text-weight-normal',
  medium: 'text-weight-medium',
  semibold: 'text-weight-semibold',
  bold: 'text-weight-bold',
} as const;

/**
 * Text transform utilities
 */
export const textTransform = {
  none: 'text-transform-none',
  uppercase: 'text-transform-uppercase',
  lowercase: 'text-transform-lowercase',
  capitalize: 'text-transform-capitalize',
} as const;

/**
 * Text decoration utilities
 */
export const textDecoration = {
  none: 'text-decoration-none',
  underline: 'text-decoration-underline',
  lineThrough: 'text-decoration-line-through',
  overline: 'text-decoration-overline',
} as const;

/**
 * Get mobile-optimized typography classes
 */
export function getMobileTypography(
  variant: TypographyVariant,
  options: {
    size?: TypographySize;
    weight?: TypographyWeight;
    truncate?: boolean | 'clamp2' | 'clamp3';
    className?: string;
  } = {}
) {
  const { size, weight, truncate, className } = options;
  
  const classes = [
    mobileTypography[variant],
    size && mobileTextSizes[size],
    weight && `font-${weight}`,
    truncate && (truncate === true ? textTruncation.truncate : textTruncation[truncate]),
    className,
  ].filter(Boolean);
  
  return cn(...classes);
}

/**
 * Mobile-first responsive typography system
 */
export const responsiveTypography = {
  // Page titles - largest on mobile, scales up
  pageTitle: 'text-3xl md:text-4xl lg:text-5xl font-bold leading-tight',
  
  // Section headings - medium on mobile, scales up
  sectionHeading: 'text-xl md:text-2xl lg:text-3xl font-semibold leading-tight',
  
  // Card titles - small on mobile, scales up
  cardTitle: 'text-lg md:text-xl lg:text-2xl font-semibold leading-tight',
  
  // Body text - base on mobile, scales up slightly
  body: 'text-base md:text-lg leading-relaxed',
  
  // Small text - consistent across devices
  small: 'text-sm leading-normal',
  
  // Caption text - consistent across devices
  caption: 'text-xs leading-normal text-muted-foreground',
} as const;

/**
 * Get responsive typography classes
 */
export function getResponsiveTypography(
  type: keyof typeof responsiveTypography,
  className?: string
) {
  return cn(responsiveTypography[type], className);
}

/**
 * Mobile-optimized spacing for typography
 */
export const typographySpacing = {
  // Basic spacing
  xs: 'spacing-xs',
  sm: 'spacing-sm',
  md: 'spacing-md',
  lg: 'spacing-lg',
  xl: 'spacing-xl',
  
  // Responsive spacing
  responsiveXs: 'spacing-responsive-xs',
  responsiveSm: 'spacing-responsive-sm',
  responsiveMd: 'spacing-responsive-md',
  responsiveLg: 'spacing-responsive-lg',
  responsiveXl: 'spacing-responsive-xl',
  
  // Typography patterns
  tight: 'typography-spacing-tight',
  normal: 'typography-spacing-normal',
  relaxed: 'typography-spacing-relaxed',
  loose: 'typography-spacing-loose',
  
  // Section patterns
  sectionTight: 'section-spacing-tight',
  sectionNormal: 'section-spacing-normal',
  sectionRelaxed: 'section-spacing-relaxed',
  sectionLoose: 'section-spacing-loose',
  sectionResponsive: 'section-spacing-responsive',
  
  // Legacy patterns (for backward compatibility)
  heading: 'mb-4 md:mb-6',
  'heading-sm': 'mb-2 md:mb-3',
  'heading-lg': 'mb-6 md:mb-8',
  paragraph: 'mb-3 md:mb-4',
  'paragraph-sm': 'mb-2 md:mb-3',
  'paragraph-lg': 'mb-4 md:mb-6',
  list: 'mb-2 md:mb-3',
  'list-item': 'mb-1 md:mb-2',
} as const;

/**
 * Get typography spacing classes
 */
export function getTypographySpacing(
  type: keyof typeof typographySpacing,
  className?: string
) {
  return cn(typographySpacing[type], className);
}


/**
 * Responsive typography classes
 */
export const responsiveTypographyClasses = {
  // Text sizes
  'text-xs': 'text-responsive-xs',
  'text-sm': 'text-responsive-sm',
  'text-base': 'text-responsive-base',
  'text-lg': 'text-responsive-lg',
  'text-xl': 'text-responsive-xl',
  'text-2xl': 'text-responsive-2xl',
  'text-3xl': 'text-responsive-3xl',
  
  // Headings
  'h1': 'heading-responsive-h1',
  'h2': 'heading-responsive-h2',
  'h3': 'heading-responsive-h3',
  'h4': 'heading-responsive-h4',
  
  // Body text
  'body': 'body-responsive',
  'body-sm': 'body-responsive-sm',
  
  // Caption
  'caption': 'caption-responsive',
} as const;

/**
 * Get responsive typography classes
 */
export function getResponsiveTypographyClasses(
  variant: keyof typeof responsiveTypographyClasses,
  className?: string
) {
  return cn(responsiveTypographyClasses[variant], className);
}

/**
 * Complete mobile typography utility
 */
export function createMobileTypography(
  variant: TypographyVariant,
  options: {
    size?: TypographySize;
    weight?: TypographyWeight;
    color?: keyof typeof textColors;
    align?: keyof typeof textAlignment;
    truncate?: boolean | 'clamp2' | 'clamp3';
    spacing?: keyof typeof typographySpacing;
    responsive?: boolean;
    className?: string;
  } = {}
) {
  const { size, weight, color, align, truncate, spacing, responsive = false, className } = options;
  
  const baseClasses = responsive ? responsiveTypographyClasses : mobileTypography;
  
  const classes = [
    baseClasses[variant],
    size && (responsive ? responsiveTypographyClasses[`text-${size}`] : mobileTextSizes[size]),
    weight && `font-${weight}`,
    color && textColors[color],
    align && textAlignment[align],
    truncate && (truncate === true ? textTruncation.truncate : textTruncation[truncate]),
    spacing && typographySpacing[spacing],
    className,
  ].filter(Boolean);
  
  return cn(...classes);
}

/**
 * Responsive typography breakpoint utilities
 */
export const breakpointTypography = {
  // Mobile-first responsive text sizes
  'text-mobile': 'text-base md:text-lg lg:text-xl',
  'text-mobile-sm': 'text-sm md:text-base lg:text-lg',
  'text-mobile-lg': 'text-lg md:text-xl lg:text-2xl',
  'text-mobile-xl': 'text-xl md:text-2xl lg:text-3xl',
  
  // Mobile-first responsive headings
  'heading-mobile': 'text-2xl md:text-3xl lg:text-4xl',
  'heading-mobile-sm': 'text-xl md:text-2xl lg:text-3xl',
  'heading-mobile-lg': 'text-3xl md:text-4xl lg:text-5xl',
  
  // Mobile-first responsive spacing
  'spacing-mobile': 'mb-3 md:mb-4 lg:mb-6',
  'spacing-mobile-sm': 'mb-2 md:mb-3 lg:mb-4',
  'spacing-mobile-lg': 'mb-4 md:mb-6 lg:mb-8',
} as const;

/**
 * Get breakpoint-based typography classes
 */
export function getBreakpointTypography(
  type: keyof typeof breakpointTypography,
  className?: string
) {
  return cn(breakpointTypography[type], className);
}

/**
 * Comprehensive text utility function
 */
export function createTextUtility(options: {
  // Basic styling
  size?: TypographySize;
  weight?: TypographyWeight;
  color?: keyof typeof textColors;
  align?: keyof typeof textAlignment;
  
  // Text behavior
  truncate?: boolean | 'clamp1' | 'clamp2' | 'clamp3' | 'clamp4' | 'clamp5';
  wrap?: keyof typeof textWrapping;
  break?: keyof typeof textBreak;
  select?: keyof typeof textSelection;
  
  // Text styling
  transform?: keyof typeof textTransform;
  decoration?: keyof typeof textDecoration;
  
  // Spacing
  spacing?: keyof typeof typographySpacing;
  
  // Responsive behavior
  responsive?: boolean;
  
  // Additional classes
  className?: string;
} = {}) {
  const {
    size,
    weight,
    color,
    align,
    truncate,
    wrap,
    break: textBreak,
    select,
    transform,
    decoration,
    spacing,
    responsive = false,
    className,
  } = options;
  
  const classes = [
    // Size and weight
    size && (responsive ? responsiveTypographyClasses[`text-${size}`] : mobileTextSizes[size]),
    weight && (responsive ? `font-${weight}` : `font-${weight}`),
    
    // Colors and alignment
    color && textColors[color],
    align && textAlignment[align],
    
    // Text behavior
    truncate && (truncate === true ? textTruncation.truncate : textTruncation[truncate]),
    wrap && textWrapping[wrap],
    textBreak && textBreak[textBreak],
    select && textSelection[select],
    
    // Text styling
    transform && textTransform[transform],
    decoration && textDecoration[decoration],
    
    // Spacing
    spacing && typographySpacing[spacing],
    
    // Additional classes
    className,
  ].filter(Boolean);
  
  return cn(...classes);
}

/**
 * Quick text utility presets
 */
export const textPresets = {
  // Headings
  pageTitle: () => createTextUtility({
    size: '3xl',
    weight: 'bold',
    spacing: 'sectionResponsive',
    responsive: true,
  }),
  
  sectionHeading: () => createTextUtility({
    size: '2xl',
    weight: 'semibold',
    spacing: 'sectionNormal',
    responsive: true,
  }),
  
  cardTitle: () => createTextUtility({
    size: 'xl',
    weight: 'semibold',
    spacing: 'normal',
    responsive: true,
  }),
  
  // Body text
  body: () => createTextUtility({
    size: 'base',
    weight: 'normal',
    spacing: 'paragraph',
    responsive: true,
  }),
  
  bodySmall: () => createTextUtility({
    size: 'sm',
    weight: 'normal',
    spacing: 'paragraph-sm',
    responsive: true,
  }),
  
  // Captions and labels
  caption: () => createTextUtility({
    size: 'xs',
    weight: 'normal',
    color: 'secondary',
    spacing: 'tight',
  }),
  
  label: () => createTextUtility({
    size: 'sm',
    weight: 'medium',
    color: 'primary',
    spacing: 'xs',
  }),
  
  // Interactive text
  link: () => createTextUtility({
    size: 'base',
    weight: 'normal',
    color: 'accent',
    decoration: 'underline',
    select: 'text',
  }),
  
  button: () => createTextUtility({
    size: 'sm',
    weight: 'medium',
    color: 'primary',
    select: 'none',
  }),
  
  // Truncated text
  title: () => createTextUtility({
    size: 'lg',
    weight: 'semibold',
    truncate: 'clamp2',
    spacing: 'sm',
    responsive: true,
  }),
  
  description: () => createTextUtility({
    size: 'sm',
    weight: 'normal',
    color: 'secondary',
    truncate: 'clamp3',
    spacing: 'sm',
  }),
} as const;
