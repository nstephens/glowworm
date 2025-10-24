// Image Optimization Utilities
// Provides utilities for optimizing images, generating responsive srcsets, and managing image formats

interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  gravity?: 'auto' | 'center' | 'top' | 'bottom' | 'left' | 'right';
  blur?: number;
  sharpen?: number;
}

interface ResponsiveImageOptions {
  src: string;
  alt: string;
  sizes?: string;
  loading?: 'lazy' | 'eager';
  className?: string;
  quality?: number;
  formats?: string[];
  widths?: number[];
}

class ImageOptimizer {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string = '/api/image', apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  // Generate optimized image URL
  generateUrl(src: string, options: ImageOptimizationOptions = {}): string {
    const params = new URLSearchParams();
    
    params.set('src', src);
    
    if (options.width) params.set('w', options.width.toString());
    if (options.height) params.set('h', options.height.toString());
    if (options.quality) params.set('q', options.quality.toString());
    if (options.format) params.set('fmt', options.format);
    if (options.fit) params.set('fit', options.fit);
    if (options.gravity) params.set('gravity', options.gravity);
    if (options.blur) params.set('blur', options.blur.toString());
    if (options.sharpen) params.set('sharpen', options.sharpen.toString());
    
    if (this.apiKey) {
      params.set('key', this.apiKey);
    }

    return `${this.baseUrl}?${params.toString()}`;
  }

  // Generate responsive srcset
  generateSrcSet(src: string, widths: number[], options: ImageOptimizationOptions = {}): string {
    return widths
      .map(width => {
        const url = this.generateUrl(src, { ...options, width });
        return `${url} ${width}w`;
      })
      .join(', ');
  }

  // Generate responsive image with multiple formats
  generateResponsiveImage(options: ResponsiveImageOptions): {
    src: string;
    srcSet: string;
    sizes: string;
    alt: string;
    loading: string;
    className?: string;
  } {
    const {
      src,
      alt,
      sizes = '100vw',
      loading = 'lazy',
      quality = 80,
      formats = ['avif', 'webp', 'jpeg'],
      widths = [320, 640, 768, 1024, 1280, 1920],
      className,
    } = options;

    const srcSet = formats
      .map(format => {
        const formatSrcSet = this.generateSrcSet(src, widths, { 
          ...options, 
          format: format as any,
          quality 
        });
        return formatSrcSet;
      })
      .join(', ');

    const fallbackSrc = this.generateUrl(src, { 
      ...options, 
      format: 'jpeg',
      quality 
    });

    return {
      src: fallbackSrc,
      srcSet,
      sizes,
      alt,
      loading,
      className,
    };
  }

  // Generate blur placeholder
  generateBlurPlaceholder(src: string, options: ImageOptimizationOptions = {}): string {
    return this.generateUrl(src, {
      ...options,
      width: 20,
      height: 20,
      quality: 20,
      blur: 10,
    });
  }

  // Generate low-quality image placeholder (LQIP)
  generateLQIP(src: string, options: ImageOptimizationOptions = {}): string {
    return this.generateUrl(src, {
      ...options,
      width: 40,
      height: 40,
      quality: 20,
    });
  }

  // Check if browser supports modern image formats
  static async checkFormatSupport(): Promise<{
    webp: boolean;
    avif: boolean;
    jpeg: boolean;
    png: boolean;
  }> {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { webp: false, avif: false, jpeg: true, png: true };
    }

    const results = {
      webp: false,
      avif: false,
      jpeg: true,
      png: true,
    };

    // Test WebP support
    try {
      const webpDataURL = canvas.toDataURL('image/webp');
      results.webp = webpDataURL.startsWith('data:image/webp');
    } catch (e) {
      results.webp = false;
    }

    // Test AVIF support
    try {
      const avifDataURL = canvas.toDataURL('image/avif');
      results.avif = avifDataURL.startsWith('data:image/avif');
    } catch (e) {
      results.avif = false;
    }

    return results;
  }

  // Get optimal format based on browser support
  static getOptimalFormat(supportedFormats: {
    webp: boolean;
    avif: boolean;
    jpeg: boolean;
    png: boolean;
  }): string {
    if (supportedFormats.avif) return 'avif';
    if (supportedFormats.webp) return 'webp';
    return 'jpeg';
  }

  // Calculate optimal quality based on image size and content
  static calculateOptimalQuality(
    imageSize: number,
    contentType: 'photo' | 'graphic' | 'screenshot' = 'photo'
  ): number {
    const baseQuality = {
      photo: 85,
      graphic: 95,
      screenshot: 90,
    }[contentType];

    // Adjust quality based on image size
    if (imageSize < 50000) return Math.min(baseQuality + 10, 100); // Small images
    if (imageSize < 200000) return baseQuality; // Medium images
    return Math.max(baseQuality - 10, 60); // Large images
  }

  // Generate responsive breakpoints
  static generateBreakpoints(containerWidth: number): number[] {
    const breakpoints = [320, 640, 768, 1024, 1280, 1920];
    return breakpoints.filter(width => width <= containerWidth * 2);
  }

  // Generate sizes attribute for responsive images
  static generateSizes(breakpoints: number[]): string {
    if (breakpoints.length === 0) return '100vw';
    
    const sizes = breakpoints
      .slice(0, -1)
      .map((width, index) => {
        const nextWidth = breakpoints[index + 1];
        return `(max-width: ${width}px) ${width}px`;
      });
    
    const lastSize = `${breakpoints[breakpoints.length - 1]}px`;
    sizes.push(lastSize);
    
    return sizes.join(', ');
  }
}

// Create global instance
const imageOptimizer = new ImageOptimizer();

// Export utilities
export { ImageOptimizer, imageOptimizer };
export type { ImageOptimizationOptions, ResponsiveImageOptions };

// Hook for image optimization
export function useImageOptimization(src: string, options: ImageOptimizationOptions = {}) {
  const [optimizedSrc, setOptimizedSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!src) return;

    setIsLoading(true);
    setError(null);

    const generateOptimizedSrc = async () => {
      try {
        // Check format support
        const formatSupport = await ImageOptimizer.checkFormatSupport();
        const optimalFormat = ImageOptimizer.getOptimalFormat(formatSupport);
        
        // Generate optimized URL
        const optimizedUrl = imageOptimizer.generateUrl(src, {
          ...options,
          format: optimalFormat as any,
        });

        setOptimizedSrc(optimizedUrl);
      } catch (err) {
        setError(err as Error);
        setOptimizedSrc(src); // Fallback to original
      } finally {
        setIsLoading(false);
      }
    };

    generateOptimizedSrc();
  }, [src, JSON.stringify(options)]);

  return { optimizedSrc, isLoading, error };
}

// Hook for responsive images
export function useResponsiveImage(options: ResponsiveImageOptions) {
  const [imageProps, setImageProps] = useState<{
    src: string;
    srcSet: string;
    sizes: string;
    alt: string;
    loading: string;
    className?: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!options.src) return;

    setIsLoading(true);
    setError(null);

    const generateResponsiveImage = async () => {
      try {
        // Check format support
        const formatSupport = await ImageOptimizer.checkFormatSupport();
        const optimalFormat = ImageOptimizer.getOptimalFormat(formatSupport);
        
        // Generate responsive image
        const responsiveImage = imageOptimizer.generateResponsiveImage({
          ...options,
          formats: [optimalFormat, 'webp', 'jpeg'],
        });

        setImageProps(responsiveImage);
      } catch (err) {
        setError(err as Error);
        setImageProps({
          src: options.src,
          srcSet: '',
          sizes: options.sizes || '100vw',
          alt: options.alt,
          loading: options.loading || 'lazy',
          className: options.className,
        });
      } finally {
        setIsLoading(false);
      }
    };

    generateResponsiveImage();
  }, [JSON.stringify(options)]);

  return { imageProps, isLoading, error };
}
