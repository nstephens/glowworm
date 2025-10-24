import { useState, useEffect, useCallback } from 'react';

interface HighContrastOptions {
  respectSystemPreference?: boolean;
  forceHighContrast?: boolean;
  customContrastRatio?: number;
}

export function useHighContrast(options: HighContrastOptions = {}) {
  const { 
    respectSystemPreference = true, 
    forceHighContrast = false,
    customContrastRatio = 7 // WCAG AAA level
  } = options;
  
  const [isHighContrast, setIsHighContrast] = useState(false);
  const [isSystemPreference, setIsSystemPreference] = useState(false);

  useEffect(() => {
    if (forceHighContrast) {
      setIsHighContrast(true);
      setIsSystemPreference(false);
      return;
    }

    if (!respectSystemPreference) {
      setIsHighContrast(false);
      setIsSystemPreference(false);
      return;
    }

    // Check system preference
    const mediaQuery = window.matchMedia('(prefers-contrast: high)');
    setIsHighContrast(mediaQuery.matches);
    setIsSystemPreference(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsHighContrast(e.matches);
      setIsSystemPreference(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [respectSystemPreference, forceHighContrast]);

  const toggleHighContrast = useCallback(() => {
    setIsHighContrast(prev => !prev);
    setIsSystemPreference(false);
  }, []);

  const enableHighContrast = useCallback(() => {
    setIsHighContrast(true);
    setIsSystemPreference(false);
  }, []);

  const disableHighContrast = useCallback(() => {
    setIsHighContrast(false);
    setIsSystemPreference(false);
  }, []);

  return {
    isHighContrast,
    isSystemPreference,
    toggleHighContrast,
    enableHighContrast,
    disableHighContrast,
    customContrastRatio,
  };
}

// Hook for managing high contrast styles
export function useHighContrastStyles() {
  const { isHighContrast, isSystemPreference } = useHighContrast();

  const getHighContrastClasses = (baseClasses: string, highContrastClasses?: string) => {
    if (isHighContrast) {
      return highContrastClasses || baseClasses;
    }
    return baseClasses;
  };

  const getContrastColor = (baseColor: string, highContrastColor?: string) => {
    if (isHighContrast) {
      return highContrastColor || baseColor;
    }
    return baseColor;
  };

  return {
    isHighContrast,
    isSystemPreference,
    getHighContrastClasses,
    getContrastColor,
  };
}
