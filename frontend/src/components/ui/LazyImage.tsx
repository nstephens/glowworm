import React, { useState } from 'react';
import { useLazyLoading } from '../../hooks/useLazyLoading';
import { Skeleton } from './Skeleton';
import { cn } from '../../lib/utils';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackSrc?: string;
  placeholder?: React.ReactNode;
  showSkeleton?: boolean;
  skeletonClassName?: string;
  onLoad?: () => void;
  onError?: (error: Event) => void;
  rootMargin?: string;
  threshold?: number;
  triggerOnce?: boolean;
  /** When true, fetches the image with Accept: image/jpeg and uses an object URL */
  forceAcceptJPEG?: boolean;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  fallbackSrc,
  placeholder,
  showSkeleton = true,
  skeletonClassName,
  onLoad,
  onError,
  rootMargin = '50px 0px',
  threshold = 0.1,
  triggerOnce = true,
  className,
  forceAcceptJPEG = false,
  ...props
}) => {
  const [imgRef, state] = useLazyLoading(src, {
    rootMargin,
    threshold,
    triggerOnce,
    fallbackSrc,
    onLoad,
    onError,
  });

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
    onLoad?.();
  };

  const handleImageError = (error: Event) => {
    setImageError(true);
    setImageLoaded(false);
    onError?.(error);
  };

  // When forcing JPEG, fetch the image as a blob with Accept: image/jpeg and create an object URL
  React.useEffect(() => {
    let revoked = false;
    let currentUrl: string | null = null;

    const run = async () => {
      if (!forceAcceptJPEG) return;
      if (!state.isInView || !(state.src || src)) return;
      try {
        const res = await fetch(state.src || src, {
          headers: { Accept: 'image/jpeg' },
          credentials: 'include'
        });
        const blob = await res.blob();
        currentUrl = URL.createObjectURL(blob);
        if (!revoked) setObjectUrl(currentUrl);
      } catch (e) {
        // Fall back to direct URL on fetch failure
        if (!revoked) setObjectUrl(null);
      }
    };

    run();

    return () => {
      revoked = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [forceAcceptJPEG, state.isInView, state.src, src]);

  // Always render image; overlay skeleton until loaded
  return (
    <div className={cn('relative', className)}>
      {(!imageLoaded && !imageError) && (
        placeholder || (showSkeleton && (
          <Skeleton 
            variant="image" 
            className={cn('absolute inset-0 w-full h-full', skeletonClassName)} 
          />
        ))
      )}
      {imageError ? (
        <div className={cn(
          'flex items-center justify-center bg-gray-100 text-gray-500',
          'w-full h-full min-h-[200px]'
        )}>
          <div className="text-center">
            <div className="text-4xl mb-2">📷</div>
            <div className="text-sm">Failed to load image</div>
          </div>
        </div>
      ) : (
        <img
          ref={imgRef}
          src={forceAcceptJPEG && objectUrl ? objectUrl : (state.src || src)}
          alt={alt}
          className={cn(
            'w-full h-full object-cover transition-opacity duration-300',
            imageLoaded ? 'opacity-100' : 'opacity-0'
          )}
          loading="eager"
          onLoad={handleImageLoad}
          onError={handleImageError}
          {...props}
        />
      )}
    </div>
  );
};

// Lazy image with progressive loading
export const ProgressiveLazyImage: React.FC<LazyImageProps & {
  lowQualitySrc?: string;
  highQualitySrc: string;
}> = ({
  lowQualitySrc,
  highQualitySrc,
  src,
  alt,
  className,
  ...props
}) => {
  const [showHighQuality, setShowHighQuality] = useState(false);
  const [highQualityLoaded, setHighQualityLoaded] = useState(false);

  const handleLowQualityLoad = () => {
    setShowHighQuality(true);
  };

  const handleHighQualityLoad = () => {
    setHighQualityLoaded(true);
  };

  return (
    <div className={cn('relative', className)}>
      {/* Low quality image */}
      {lowQualitySrc && (
        <LazyImage
          src={lowQualitySrc}
          alt={alt}
          className={cn(
            'absolute inset-0 w-full h-full object-cover',
            'blur-sm scale-110',
            highQualityLoaded && 'opacity-0'
          )}
          onLoad={handleLowQualityLoad}
          {...props}
        />
      )}
      
      {/* High quality image */}
      <LazyImage
        src={highQualitySrc || src}
        alt={alt}
        className={cn(
          'relative w-full h-full object-cover',
          'transition-opacity duration-500',
          highQualityLoaded ? 'opacity-100' : 'opacity-0'
        )}
        onLoad={handleHighQualityLoad}
        {...props}
      />
    </div>
  );
};

export default LazyImage;
