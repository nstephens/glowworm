/**
 * Utility functions for lazy loading setup and management
 */

// Check if Intersection Observer is supported
export const isIntersectionObserverSupported = (): boolean => {
  return typeof window !== 'undefined' && 'IntersectionObserver' in window;
};

// Default configuration for lazy loading
export const DEFAULT_LAZY_LOADING_CONFIG = {
  rootMargin: '50px 0px',
  threshold: 0.1,
  triggerOnce: true,
  fallbackDelay: 1000, // ms to wait before showing fallback
};

// Setup lazy loading for all images with data-src attribute
export const setupLazyLoading = (options = DEFAULT_LAZY_LOADING_CONFIG) => {
  if (!isIntersectionObserverSupported()) {
    console.warn('Intersection Observer not supported, loading all images immediately');
    loadAllImagesImmediately();
    return;
  }

  const images = document.querySelectorAll('img[data-src]');
  
  if (images.length === 0) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const img = entry.target as HTMLImageElement;
          const src = img.dataset.src;
          
          if (src) {
            // Load the image
            img.src = src;
            img.removeAttribute('data-src');
            
            // Add loaded class for styling
            img.onload = () => {
              img.classList.add('loaded');
            };
            
            // Handle errors
            img.onerror = () => {
              img.classList.add('error');
              // Try fallback if available
              const fallbackSrc = img.dataset.fallbackSrc;
              if (fallbackSrc) {
                img.src = fallbackSrc;
              }
            };
          }
          
          if (options.triggerOnce) {
            observer.unobserve(img);
          }
        }
      });
    },
    {
      rootMargin: options.rootMargin,
      threshold: options.threshold,
    }
  );

  images.forEach((img) => {
    observer.observe(img);
  });

  return observer;
};

// Fallback: load all images immediately
export const loadAllImagesImmediately = () => {
  const images = document.querySelectorAll('img[data-src]');
  
  images.forEach((img) => {
    const imgElement = img as HTMLImageElement;
    const src = imgElement.dataset.src;
    
    if (src) {
      imgElement.src = src;
      imgElement.removeAttribute('data-src');
      imgElement.classList.add('loaded');
    }
  });
};

// Preload images that are likely to be viewed soon
export const preloadImages = (urls: string[], priority = 'low'): Promise<void[]> => {
  const promises = urls.map((url) => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
      
      // Set priority if supported
      if ('fetchPriority' in img) {
        (img as any).fetchPriority = priority;
      }
    });
  });

  return Promise.all(promises);
};

// Get image dimensions without loading the full image
export const getImageDimensions = (url: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = () => {
      reject(new Error(`Failed to load image: ${url}`));
    };
    img.src = url;
  });
};

// Generate responsive image sources
export const generateResponsiveSources = (
  baseUrl: string,
  sizes: number[] = [320, 640, 1024, 1280, 1920]
): string[] => {
  return sizes.map((size) => {
    // This would need to be adapted based on your image service
    // For now, we'll just return the base URL
    return baseUrl;
  });
};

// Lazy load background images
export const setupLazyBackgroundImages = (options = DEFAULT_LAZY_LOADING_CONFIG) => {
  if (!isIntersectionObserverSupported()) {
    return;
  }

  const elements = document.querySelectorAll('[data-bg-src]');
  
  if (elements.length === 0) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const element = entry.target as HTMLElement;
          const bgSrc = element.dataset.bgSrc;
          
          if (bgSrc) {
            element.style.backgroundImage = `url(${bgSrc})`;
            element.removeAttribute('data-bg-src');
            element.classList.add('bg-loaded');
          }
          
          if (options.triggerOnce) {
            observer.unobserve(element);
          }
        }
      });
    },
    {
      rootMargin: options.rootMargin,
      threshold: options.threshold,
    }
  );

  elements.forEach((element) => {
    observer.observe(element);
  });

  return observer;
};

// Performance monitoring for lazy loading
export const monitorLazyLoadingPerformance = () => {
  if (!isIntersectionObserverSupported()) {
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const img = entry.target as HTMLImageElement;
        const loadStart = performance.now();
        
        img.onload = () => {
          const loadTime = performance.now() - loadStart;
          console.log(`Image loaded in ${loadTime.toFixed(2)}ms:`, img.src);
          
          // Send to analytics if needed
          if (typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', 'image_load', {
              load_time: loadTime,
              image_url: img.src,
            });
          }
        };
      });
    },
    { rootMargin: '50px 0px' }
  );

  // Observe all lazy images
  const lazyImages = document.querySelectorAll('img[data-src]');
  lazyImages.forEach((img) => observer.observe(img));

  return observer;
};

export default {
  isIntersectionObserverSupported,
  setupLazyLoading,
  loadAllImagesImmediately,
  preloadImages,
  getImageDimensions,
  generateResponsiveSources,
  setupLazyBackgroundImages,
  monitorLazyLoadingPerformance,
};





