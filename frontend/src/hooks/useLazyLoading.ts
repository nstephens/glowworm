import { useEffect, useRef, useState, useCallback } from 'react';

interface UseLazyLoadingOptions {
  rootMargin?: string;
  threshold?: number;
  triggerOnce?: boolean;
  fallbackSrc?: string;
  onLoad?: () => void;
  onError?: (error: Event) => void;
}

interface LazyLoadingState {
  isLoaded: boolean;
  isInView: boolean;
  hasError: boolean;
  src: string | null;
}

export const useLazyLoading = (
  src: string,
  options: UseLazyLoadingOptions = {}
): [React.RefObject<HTMLImageElement>, LazyLoadingState] => {
  const {
    rootMargin = '50px 0px',
    threshold = 0.1,
    triggerOnce = true,
    fallbackSrc,
    onLoad,
    onError,
  } = options;

  const imgRef = useRef<HTMLImageElement>(null);
  const [state, setState] = useState<LazyLoadingState>({
    isLoaded: false,
    isInView: false,
    hasError: false,
    src: null,
  });

  const handleLoad = useCallback(() => {
    setState(prev => ({ ...prev, isLoaded: true, hasError: false }));
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback((error: Event) => {
    setState(prev => ({ 
      ...prev, 
      hasError: true, 
      isLoaded: false,
      src: fallbackSrc || null 
    }));
    onError?.(error);
  }, [fallbackSrc, onError]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    // Check if Intersection Observer is supported
    if (!('IntersectionObserver' in window)) {
      // Fallback: load immediately
      setState(prev => ({ ...prev, src, isInView: true }));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setState(prev => ({ ...prev, isInView: true, src }));
            
            if (triggerOnce) {
              observer.unobserve(img);
            }
          }
        });
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(img);

    return () => {
      observer.unobserve(img);
    };
  }, [src, rootMargin, threshold, triggerOnce]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img || !state.src) return;

    // Set up load and error handlers
    img.addEventListener('load', handleLoad);
    img.addEventListener('error', handleError);

    return () => {
      img.removeEventListener('load', handleLoad);
      img.removeEventListener('error', handleError);
    };
  }, [state.src, handleLoad, handleError]);

  return [imgRef, state];
};

// Hook for lazy loading multiple images
export const useLazyLoadingList = (
  srcs: string[],
  options: UseLazyLoadingOptions = {}
): [React.RefObject<HTMLDivElement>, LazyLoadingState[]] => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [states, setStates] = useState<LazyLoadingState[]>(
    srcs.map(() => ({
      isLoaded: false,
      isInView: false,
      hasError: false,
      src: null,
    }))
  );

  const {
    rootMargin = '50px 0px',
    threshold = 0.1,
    triggerOnce = true,
    fallbackSrc,
    onLoad,
    onError,
  } = options;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check if Intersection Observer is supported
    if (!('IntersectionObserver' in window)) {
      // Fallback: load all images immediately
      setStates(srcs.map((src, index) => ({
        isLoaded: false,
        isInView: true,
        hasError: false,
        src,
      })));
      return;
    }

    const images = container.querySelectorAll('img[data-src]');
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            const src = img.dataset.src;
            const index = Array.from(images).indexOf(img);
            
            if (src && index !== -1) {
              setStates(prev => {
                const newStates = [...prev];
                newStates[index] = {
                  ...newStates[index],
                  isInView: true,
                  src,
                };
                return newStates;
              });

              if (triggerOnce) {
                observer.unobserve(img);
              }
            }
          }
        });
      },
      {
        rootMargin,
        threshold,
      }
    );

    images.forEach(img => observer.observe(img));

    return () => {
      images.forEach(img => observer.unobserve(img));
    };
  }, [srcs, rootMargin, threshold, triggerOnce]);

  return [containerRef, states];
};

export default useLazyLoading;






