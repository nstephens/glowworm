/**
 * Breakpoint constants for responsive design
 * Single source of truth for all layout breakpoints
 */

export const MOBILE_BREAKPOINT = 768;
export const TABLET_BREAKPOINT = 1024;
export const DESKTOP_BREAKPOINT = 1024;

/**
 * Breakpoint configuration matching Tailwind defaults
 */
export const BREAKPOINTS = {
  sm: 640,
  md: MOBILE_BREAKPOINT,
  lg: TABLET_BREAKPOINT,
  xl: 1280,
  '2xl': 1536,
} as const;

/**
 * Check if current width is mobile (< 768px)
 */
export const isMobileWidth = (width: number): boolean => {
  return width < MOBILE_BREAKPOINT;
};

/**
 * Check if current width is tablet (768px - 1023px)
 */
export const isTabletWidth = (width: number): boolean => {
  return width >= MOBILE_BREAKPOINT && width < TABLET_BREAKPOINT;
};

/**
 * Check if current width is desktop (>= 1024px)
 */
export const isDesktopWidth = (width: number): boolean => {
  return width >= DESKTOP_BREAKPOINT;
};





