import { useEffect, useRef, useCallback } from 'react';

interface TouchTargetOptions {
  minSize?: number; // Minimum touch target size in pixels (default: 44px)
  spacing?: number; // Minimum spacing between targets in pixels (default: 8px)
  enableHapticFeedback?: boolean; // Enable haptic feedback on supported devices
}

export function useTouchTargets(options: TouchTargetOptions = {}) {
  const {
    minSize = 44,
    spacing = 8,
    enableHapticFeedback = true,
  } = options;

  const elementRef = useRef<HTMLElement | null>(null);

  // Haptic feedback function
  const triggerHapticFeedback = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!enableHapticFeedback || !navigator.vibrate) return;
    
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30],
    };
    
    navigator.vibrate(patterns[type]);
  }, [enableHapticFeedback]);

  // Check if element meets minimum touch target requirements
  const validateTouchTarget = useCallback((element: HTMLElement): boolean => {
    const rect = element.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    return width >= minSize && height >= minSize;
  }, [minSize]);

  // Ensure proper spacing between touch targets
  const validateSpacing = useCallback((elements: HTMLElement[]): boolean => {
    for (let i = 0; i < elements.length; i++) {
      for (let j = i + 1; j < elements.length; j++) {
        const rect1 = elements[i].getBoundingClientRect();
        const rect2 = elements[j].getBoundingClientRect();
        
        const distance = Math.sqrt(
          Math.pow(rect1.left - rect2.left, 2) + Math.pow(rect1.top - rect2.top, 2)
        );
        
        if (distance < spacing) {
          return false;
        }
      }
    }
    return true;
  }, [spacing]);

  // Add touch feedback styles
  const addTouchFeedback = useCallback((element: HTMLElement) => {
    element.style.transition = 'transform 0.1s ease, opacity 0.1s ease';
    
    const handleTouchStart = () => {
      element.style.transform = 'scale(0.95)';
      element.style.opacity = '0.8';
      triggerHapticFeedback('light');
    };
    
    const handleTouchEnd = () => {
      element.style.transform = 'scale(1)';
      element.style.opacity = '1';
    };
    
    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    element.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    
    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
      element.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [triggerHapticFeedback]);

  // Validate all interactive elements in a container
  const validateContainer = useCallback((container: HTMLElement) => {
    const interactiveElements = container.querySelectorAll(
      'button, [role="button"], a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;
    
    const issues: string[] = [];
    
    // Check individual touch targets
    interactiveElements.forEach((element, index) => {
      if (!validateTouchTarget(element)) {
        issues.push(`Element ${index} does not meet minimum touch target size of ${minSize}px`);
      }
    });
    
    // Check spacing between elements
    if (!validateSpacing(Array.from(interactiveElements))) {
      issues.push(`Elements do not have sufficient spacing (minimum ${spacing}px)`);
    }
    
    return {
      isValid: issues.length === 0,
      issues,
    };
  }, [validateTouchTarget, validateSpacing, minSize, spacing]);

  // Auto-enhance touch targets
  const enhanceTouchTargets = useCallback((container: HTMLElement) => {
    const interactiveElements = container.querySelectorAll(
      'button, [role="button"], a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as NodeListOf<HTMLElement>;
    
    interactiveElements.forEach((element) => {
      const rect = element.getBoundingClientRect();
      const currentWidth = rect.width;
      const currentHeight = rect.height;
      
      // Add padding if element is too small
      if (currentWidth < minSize || currentHeight < minSize) {
        const paddingX = Math.max(0, (minSize - currentWidth) / 2);
        const paddingY = Math.max(0, (minSize - currentHeight) / 2);
        
        element.style.padding = `${paddingY}px ${paddingX}px`;
      }
      
      // Add touch feedback
      addTouchFeedback(element);
    });
  }, [minSize, addTouchFeedback]);

  // Hook to attach to a container element
  const attachToContainer = useCallback((container: HTMLElement) => {
    elementRef.current = container;
    enhanceTouchTargets(container);
    
    // Re-validate on resize
    const handleResize = () => {
      enhanceTouchTargets(container);
    };
    
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [enhanceTouchTargets]);

  return {
    validateTouchTarget,
    validateSpacing,
    validateContainer,
    enhanceTouchTargets,
    attachToContainer,
    triggerHapticFeedback,
  };
}
