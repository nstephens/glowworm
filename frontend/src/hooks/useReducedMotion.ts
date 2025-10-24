import { useState, useEffect } from 'react';

interface ReducedMotionOptions {
  respectSystemPreference?: boolean;
  forceReduced?: boolean;
}

export function useReducedMotion(options: ReducedMotionOptions = {}) {
  const { respectSystemPreference = true, forceReduced = false } = options;
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (forceReduced) {
      setPrefersReducedMotion(true);
      return;
    }

    if (!respectSystemPreference) {
      setPrefersReducedMotion(false);
      return;
    }

    // Check system preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    // Listen for changes to the preference
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [respectSystemPreference, forceReduced]);

  return prefersReducedMotion;
}

// Hook for managing animation classes based on reduced motion preference
export function useAnimationClasses() {
  const prefersReducedMotion = useReducedMotion();

  const getAnimationClasses = (baseClasses: string, reducedClasses?: string) => {
    if (prefersReducedMotion) {
      return reducedClasses || baseClasses.replace(/animate-\w+/g, '');
    }
    return baseClasses;
  };

  const getTransitionClasses = (baseClasses: string, reducedClasses?: string) => {
    if (prefersReducedMotion) {
      return reducedClasses || baseClasses.replace(/transition-\w+/g, '');
    }
    return baseClasses;
  };

  return {
    prefersReducedMotion,
    getAnimationClasses,
    getTransitionClasses,
  };
}
