import * as React from 'react';
import { useState, useEffect } from 'react';

/**
 * Hook to detect and respond to high contrast mode preferences
 * @returns Object with high contrast state and utilities
 */
export const useHighContrast = () => {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    // Check if the browser supports prefers-contrast
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-contrast: high)');
      
      // Check for forced high contrast mode
      const checkHighContrast = () => {
        const isForced = document.documentElement.classList.contains('force-high-contrast');
        const isSystem = mediaQuery.matches;
        setIsHighContrast(isForced || isSystem);
      };
      
      // Set initial value
      checkHighContrast();

      // Listen for changes
      const handleChange = (e: MediaQueryListEvent) => {
        checkHighContrast();
      };

      // Add listener
      mediaQuery.addEventListener('change', handleChange);

      // Also listen for class changes on the document element
      const observer = new MutationObserver(checkHighContrast);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class']
      });

      // Cleanup
      return () => {
        mediaQuery.removeEventListener('change', handleChange);
        observer.disconnect();
      };
    }
  }, []);

  return {
    isHighContrast,
    /**
     * Get high contrast specific classes
     */
    getHighContrastClasses: (baseClasses: string, highContrastClasses?: string) => {
      return isHighContrast && highContrastClasses 
        ? `${baseClasses} ${highContrastClasses}`
        : baseClasses;
    },
    /**
     * Get high contrast specific styles
     */
    getHighContrastStyles: (baseStyles: React.CSSProperties, highContrastStyles?: React.CSSProperties) => {
      return isHighContrast && highContrastStyles 
        ? { ...baseStyles, ...highContrastStyles }
        : baseStyles;
    },
    /**
     * Check if high contrast mode is active
     */
    isActive: isHighContrast,
  };
};

/**
 * Hook for components that need to adapt their appearance in high contrast mode
 * @param highContrastConfig Configuration for high contrast adaptations
 * @returns Adapted props and utilities
 */
export const useHighContrastAdaptation = (highContrastConfig?: {
  className?: string;
  style?: React.CSSProperties;
  borderWidth?: number;
  fontWeight?: number | string;
  textDecoration?: string;
}) => {
  const { isHighContrast } = useHighContrast();

  const getAdaptedProps = () => {
    if (!isHighContrast || !highContrastConfig) {
      return {};
    }

    const adaptedProps: {
      className?: string;
      style?: React.CSSProperties;
    } = {};

    if (highContrastConfig.className) {
      adaptedProps.className = highContrastConfig.className;
    }

    if (highContrastConfig.style) {
      adaptedProps.style = {
        ...highContrastConfig.style,
        ...(highContrastConfig.borderWidth && {
          borderWidth: highContrastConfig.borderWidth,
        }),
        ...(highContrastConfig.fontWeight && {
          fontWeight: highContrastConfig.fontWeight,
        }),
        ...(highContrastConfig.textDecoration && {
          textDecoration: highContrastConfig.textDecoration,
        }),
      };
    }

    return adaptedProps;
  };

  return {
    isHighContrast,
    adaptedProps: getAdaptedProps(),
  };
};

/**
 * Utility function to check if high contrast mode is preferred
 * Can be used outside of React components
 */
export const isHighContrastPreferred = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  
  return window.matchMedia('(prefers-contrast: high)').matches;
};

/**
 * Utility function to get high contrast color values
 */
export const getHighContrastColors = () => ({
  text: '#000000',
  background: '#ffffff',
  primary: '#0000cc',
  primaryForeground: '#ffffff',
  secondary: '#666666',
  secondaryForeground: '#ffffff',
  border: '#000000',
  destructive: '#cc0000',
  destructiveForeground: '#ffffff',
  success: '#006600',
  successForeground: '#ffffff',
  warning: '#cc6600',
  warningForeground: '#000000',
  muted: '#666666',
  mutedForeground: '#000000',
});

/**
 * Component wrapper for high contrast adaptations
 */
export interface HighContrastWrapperProps {
  children: React.ReactNode;
  highContrastClassName?: string;
  highContrastStyle?: React.CSSProperties;
  fallbackClassName?: string;
  fallbackStyle?: React.CSSProperties;
}

export const HighContrastWrapper: React.FC<HighContrastWrapperProps> = ({
  children,
  highContrastClassName,
  highContrastStyle,
  fallbackClassName,
  fallbackStyle,
}) => {
  const { isHighContrast } = useHighContrast();

  const className = isHighContrast ? highContrastClassName : fallbackClassName;
  const style = isHighContrast ? highContrastStyle : fallbackStyle;

  return React.createElement('div', { className, style }, children);
};