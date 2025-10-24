import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

interface ResponsiveImageProps {
  src: string;
  alt: string;
  className?: string;
  sizes?: string;
  quality?: number;
  priority?: boolean;
  placeholder?: 'blur' | 'empty';
  blurDataURL?: string;
  onLoad?: () => void;
  onError?: () => void;
  fallbackSrc?: string;
  aspectRatio?: number;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  loading?: 'lazy' | 'eager';
}

export const ResponsiveImage: React.FC<ResponsiveImageProps> = ({
  src,
  alt,
  className,
  sizes,
  quality = 75,
  priority = false,
  placeholder = 'empty',
  blurDataURL,
  onLoad,
  onError,
  fallbackSrc,
  aspectRatio,
  objectFit = 'cover',
  loading = 'lazy',
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const imgRef = useRef<HTMLImageElement>(null);
  const { isMobile, isTablet, isDesktop, getResponsiveValue } = useResponsiveLayout();

  // Generate responsive srcset
  const generateSrcSet = (baseSrc: string): string => {
    const baseUrl = baseSrc.split('?')[0];
    const params = baseSrc.split('?')[1] || '';
    
    const widths = getResponsiveValue({
      sm: [320, 640],
      md: [320, 640, 768],
      lg: [320, 640, 768, 1024],
      xl: [320, 640, 768, 1024, 1280],
      '2xl': [320, 640, 768, 1024, 1280, 1536],
    }, [320, 640]);
    
    return widths
      .map(width => `${baseUrl}?w=${width}&q=${quality}${params ? `&${params}` : ''} ${width}w`)
      .join(', ');
  };

  // Generate responsive sizes attribute
  const generateSizes = (): string => {
    if (sizes) return sizes;
    
    return getResponsiveValue({
      sm: '(max-width: 640px) 100vw, 640px',
      md: '(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 768px',
      lg: '(max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 1024px',
      xl: '(max-width: 1280px) 33vw, (max-width: 1536px) 25vw, 1280px',
      '2xl': '(max-width: 1536px) 25vw, 1536px',
    }, '(max-width: 640px) 100vw, 640px');
  };

  // Handle image load
  const handleLoad = () => {
    setImageLoaded(true);
    setImageError(false);
    onLoad?.();
  };

  // Handle image error
  const handleError = () => {
    setImageError(true);
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
    } else {
      onError?.();
    }
  };

  // Update src when it changes
  useEffect(() => {
    setCurrentSrc(src);
    setImageError(false);
    setImageLoaded(false);
  }, [src]);

  // Intersection observer for lazy loading
  useEffect(() => {
    if (loading === 'lazy' && imgRef.current) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const img = entry.target as HTMLImageElement;
              if (img.dataset.src) {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
              }
              observer.unobserve(img);
            }
          });
        },
        { rootMargin: '50px' }
      );

      observer.observe(imgRef.current);

      return () => {
        observer.disconnect();
      };
    }
  }, [loading]);

  const imageStyle = {
    aspectRatio: aspectRatio ? `${aspectRatio}` : undefined,
    objectFit,
  };

  const containerStyle = {
    aspectRatio: aspectRatio ? `${aspectRatio}` : undefined,
  };

  return (
    <div 
      className={cn("relative overflow-hidden", className)}
      style={containerStyle}
    >
      {/* Blur placeholder */}
      {placeholder === 'blur' && blurDataURL && !imageLoaded && (
        <div
          className="absolute inset-0 bg-cover bg-center filter blur-sm scale-110"
          style={{
            backgroundImage: `url(${blurDataURL})`,
          }}
        />
      )}

      {/* Loading skeleton */}
      {!imageLoaded && !imageError && (
        <div className="absolute inset-0 bg-muted animate-pulse flex items-center justify-center">
          <div className="w-8 h-8 text-muted-foreground">
            {/* Placeholder icon */}
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
            </svg>
          </div>
        </div>
      )}

      {/* Main image */}
      <img
        ref={imgRef}
        src={loading === 'lazy' ? undefined : currentSrc}
        data-src={loading === 'lazy' ? currentSrc : undefined}
        alt={alt}
        className={cn(
          "w-full h-full transition-opacity duration-300",
          imageLoaded ? "opacity-100" : "opacity-0"
        )}
        style={imageStyle}
        srcSet={generateSrcSet(currentSrc)}
        sizes={generateSizes()}
        loading={loading}
        onLoad={handleLoad}
        onError={handleError}
        decoding="async"
      />

      {/* Error state */}
      {imageError && (
        <div className="absolute inset-0 bg-muted flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <div className="w-8 h-8 mx-auto mb-2">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            </div>
            <p className="text-sm">Failed to load image</p>
          </div>
        </div>
      )}
    </div>
  );
};
