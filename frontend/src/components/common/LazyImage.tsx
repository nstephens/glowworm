import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  placeholderSrc?: string;
  alt: string;
  blurDataURL?: string;
  onLoad?: () => void;
  onError?: () => void;
  threshold?: number;
  rootMargin?: string;
  className?: string;
  containerClassName?: string;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  placeholderSrc,
  alt,
  blurDataURL,
  onLoad,
  onError,
  threshold = 0.1,
  rootMargin = '50px',
  className,
  containerClassName,
  ...props
}) => {
  const [imageSrc, setImageSrc] = useState<string>(placeholderSrc || blurDataURL || '');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // Intersection Observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        threshold,
        rootMargin,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  // Load image when in view
  useEffect(() => {
    if (isInView && src && !imageLoaded && !imageError) {
      setIsLoading(true);
      
      const img = new Image();
      img.src = src;
      
      img.onload = () => {
        setImageSrc(src);
        setImageLoaded(true);
        setIsLoading(false);
        onLoad?.();
      };
      
      img.onerror = () => {
        setImageError(true);
        setIsLoading(false);
        onError?.();
      };
    }
  }, [isInView, src, imageLoaded, imageError, onLoad, onError]);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setIsLoading(false);
    onLoad?.();
  }, [onLoad]);

  const handleImageError = useCallback(() => {
    setImageError(true);
    setIsLoading(false);
    onError?.();
  }, [onError]);

  if (imageError) {
    return (
      <div
        ref={imgRef}
        className={cn(
          'flex items-center justify-center bg-muted text-muted-foreground',
          className
        )}
        {...props}
      >
        <div className="text-center p-4">
          <div className="text-2xl mb-2">📷</div>
          <div className="text-sm">Failed to load image</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={imgRef} className={cn('relative overflow-hidden', containerClassName)}>
      <AnimatePresence mode="wait">
        {/* Placeholder/Blur image */}
        {!imageLoaded && (
          <motion.div
            key="placeholder"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={cn('absolute inset-0', className)}
          >
            {blurDataURL ? (
              <img
                src={blurDataURL}
                alt=""
                className="w-full h-full object-cover filter blur-sm"
                aria-hidden="true"
              />
            ) : (
              <div className="w-full h-full bg-muted animate-pulse" />
            )}
          </motion.div>
        )}

        {/* Main image */}
        {imageLoaded && (
          <motion.img
            key="main"
            src={imageSrc}
            alt={alt}
            className={cn('w-full h-full object-cover', className)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ 
              duration: prefersReducedMotion ? 0 : 0.3,
              ease: 'easeOut' 
            }}
            onLoad={handleImageLoad}
            onError={handleImageError}
            {...props}
          />
        )}
      </AnimatePresence>

      {/* Loading indicator */}
      {isLoading && (
        <motion.div
          className="absolute inset-0 flex items-center justify-center bg-background/80"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </motion.div>
      )}
    </div>
  );
};

interface LazyImageWithFallbackProps extends LazyImageProps {
  fallbackComponent?: React.ReactNode;
  retryCount?: number;
  onRetry?: () => void;
}

export const LazyImageWithFallback: React.FC<LazyImageWithFallbackProps> = ({
  fallbackComponent,
  retryCount = 0,
  onRetry,
  ...props
}) => {
  const [retryAttempts, setRetryAttempts] = useState(0);

  const handleRetry = useCallback(() => {
    setRetryAttempts(prev => prev + 1);
    onRetry?.();
  }, [onRetry]);

  if (retryAttempts > retryCount) {
    return (
      <div className="flex items-center justify-center bg-muted text-muted-foreground p-4">
        {fallbackComponent || (
          <div className="text-center">
            <div className="text-2xl mb-2">📷</div>
            <div className="text-sm mb-2">Failed to load image</div>
            {retryCount > 0 && (
              <button
                onClick={handleRetry}
                className="text-xs underline hover:no-underline"
              >
                Try again
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <LazyImage
      {...props}
      onError={handleRetry}
    />
  );
};

interface ProgressiveImageProps extends LazyImageProps {
  lowQualitySrc: string;
  highQualitySrc: string;
  transitionDuration?: number;
}

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  lowQualitySrc,
  highQualitySrc,
  transitionDuration = 0.5,
  className,
  ...props
}) => {
  const [currentSrc, setCurrentSrc] = useState(lowQualitySrc);
  const [isHighQualityLoaded, setIsHighQualityLoaded] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const img = new Image();
    img.src = highQualitySrc;
    img.onload = () => {
      setCurrentSrc(highQualitySrc);
      setIsHighQualityLoaded(true);
    };
  }, [highQualitySrc]);

  return (
    <motion.img
      src={currentSrc}
      alt={props.alt}
      className={cn('w-full h-full object-cover', className)}
      animate={{
        filter: isHighQualityLoaded ? 'blur(0px)' : 'blur(2px)',
      }}
      transition={{
        duration: prefersReducedMotion ? 0 : transitionDuration,
        ease: 'easeOut',
      }}
      {...props}
    />
  );
};
