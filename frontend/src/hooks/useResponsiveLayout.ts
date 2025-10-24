import { useState, useEffect, useCallback } from 'react';

interface BreakpointConfig {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  '2xl': number;
}

const defaultBreakpoints: BreakpointConfig = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

type Breakpoint = keyof BreakpointConfig;

interface ResponsiveLayoutOptions {
  breakpoints?: BreakpointConfig;
  debounceMs?: number;
}

export function useResponsiveLayout(options: ResponsiveLayoutOptions = {}) {
  const { breakpoints = defaultBreakpoints, debounceMs = 100 } = options;
  
  const [windowSize, setWindowSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  });
  
  const [currentBreakpoint, setCurrentBreakpoint] = useState<Breakpoint>('sm');
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  // Debounced resize handler
  const handleResize = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    setWindowSize({ width, height });
    
    // Determine current breakpoint
    let breakpoint: Breakpoint = 'sm';
    if (width >= breakpoints['2xl']) breakpoint = '2xl';
    else if (width >= breakpoints.xl) breakpoint = 'xl';
    else if (width >= breakpoints.lg) breakpoint = 'lg';
    else if (width >= breakpoints.md) breakpoint = 'md';
    else if (width >= breakpoints.sm) breakpoint = 'sm';
    
    setCurrentBreakpoint(breakpoint);
    
    // Set device type flags
    setIsMobile(width < breakpoints.md);
    setIsTablet(width >= breakpoints.md && width < breakpoints.lg);
    setIsDesktop(width >= breakpoints.lg);
  }, [breakpoints]);

  useEffect(() => {
    // Initial setup
    handleResize();
    
    // Debounced resize listener
    let timeoutId: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, debounceMs);
    };
    
    window.addEventListener('resize', debouncedResize);
    
    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(timeoutId);
    };
  }, [handleResize, debounceMs]);

  // Check if current breakpoint matches or is above a given breakpoint
  const isBreakpoint = useCallback((breakpoint: Breakpoint): boolean => {
    return windowSize.width >= breakpoints[breakpoint];
  }, [windowSize.width, breakpoints]);

  // Check if current breakpoint is below a given breakpoint
  const isBelowBreakpoint = useCallback((breakpoint: Breakpoint): boolean => {
    return windowSize.width < breakpoints[breakpoint];
  }, [windowSize.width, breakpoints]);

  // Get responsive value based on breakpoint
  const getResponsiveValue = useCallback(<T>(values: Partial<Record<Breakpoint, T>>, defaultValue: T): T => {
    // Check from largest to smallest breakpoint
    const orderedBreakpoints: Breakpoint[] = ['2xl', 'xl', 'lg', 'md', 'sm'];
    
    for (const bp of orderedBreakpoints) {
      if (isBreakpoint(bp) && values[bp] !== undefined) {
        return values[bp]!;
      }
    }
    
    return defaultValue;
  }, [isBreakpoint]);

  // Get responsive class names
  const getResponsiveClasses = useCallback((classMap: Partial<Record<Breakpoint, string>>): string => {
    const classes: string[] = [];
    
    // Add classes for each breakpoint that matches
    Object.entries(classMap).forEach(([breakpoint, className]) => {
      if (isBreakpoint(breakpoint as Breakpoint)) {
        classes.push(className);
      }
    });
    
    return classes.join(' ');
  }, [isBreakpoint]);

  // Get responsive grid columns
  const getGridColumns = useCallback((columns: Partial<Record<Breakpoint, number>>): number => {
    return getResponsiveValue(columns, 1);
  }, [getResponsiveValue]);

  // Get responsive spacing
  const getSpacing = useCallback((spacing: Partial<Record<Breakpoint, number>>): number => {
    return getResponsiveValue(spacing, 4);
  }, [getResponsiveValue]);

  // Check if device supports touch
  const isTouchDevice = useCallback((): boolean => {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }, []);

  // Check if device is in landscape orientation
  const isLandscape = useCallback((): boolean => {
    return windowSize.width > windowSize.height;
  }, [windowSize.width, windowSize.height]);

  // Get safe area insets for devices with notches
  const getSafeAreaInsets = useCallback(() => {
    const computedStyle = getComputedStyle(document.documentElement);
    
    return {
      top: parseInt(computedStyle.getPropertyValue('--safe-area-inset-top') || '0'),
      right: parseInt(computedStyle.getPropertyValue('--safe-area-inset-right') || '0'),
      bottom: parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom') || '0'),
      left: parseInt(computedStyle.getPropertyValue('--safe-area-inset-left') || '0'),
    };
  }, []);

  return {
    windowSize,
    currentBreakpoint,
    isMobile,
    isTablet,
    isDesktop,
    isBreakpoint,
    isBelowBreakpoint,
    getResponsiveValue,
    getResponsiveClasses,
    getGridColumns,
    getSpacing,
    isTouchDevice,
    isLandscape,
    getSafeAreaInsets,
  };
}
