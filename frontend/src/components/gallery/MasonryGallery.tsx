import React, { useState, useCallback, useMemo } from 'react';
import Masonry from 'react-masonry-css';
import { useInView } from 'react-intersection-observer';
import { useHotkeys } from 'react-hotkeys-hook';
import { useInfiniteQuery } from '@tanstack/react-query';
import { 
  Edit, 
  Trash, 
  Share, 
  Star, 
  Download, 
  Eye,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ImageCard } from './ImageCard';
import { useFilters } from './FilterContext';
import { cn } from '@/lib/utils';

export interface Image {
  id: string;
  src: string;
  width: number;
  height: number;
  title: string;
  album?: string;
  tags?: string[];
  createdAt?: string;
  orientation?: 'landscape' | 'portrait' | 'square';
}

interface MasonryGalleryProps {
  /** Initial images to display */
  initialImages?: Image[];
  /** Function to fetch more images */
  fetchImages: (page: number) => Promise<{ images: Image[]; hasMore: boolean }>;
  /** Callback when an image is selected */
  onImageSelect?: (image: Image) => void;
  /** Callback for bulk actions */
  onBulkAction?: (action: string, images: Image[]) => void;
  /** Whether to show selection checkboxes */
  showSelection?: boolean;
  /** Custom CSS class name */
  className?: string;
}

/**
 * MasonryGallery - Pinterest-style image gallery with infinite scroll
 * 
 * Features:
 * - Responsive masonry layout
 * - Infinite scroll loading
 * - Bulk selection with keyboard shortcuts
 * - Hover actions overlay
 * - Keyboard navigation
 * - Performance optimized
 * 
 * @example
 * ```tsx
 * <MasonryGallery
 *   initialImages={images}
 *   fetchImages={fetchMoreImages}
 *   onImageSelect={handleImageSelect}
 *   onBulkAction={handleBulkAction}
 * />
 * ```
 */
export const MasonryGallery: React.FC<MasonryGalleryProps> = ({
  initialImages = [],
  fetchImages,
  onImageSelect,
  onBulkAction,
  showSelection = true,
  className,
}) => {
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [hoveredImage, setHoveredImage] = useState<string | null>(null);

  // Intersection observer for infinite scroll
  const { ref: loadMoreRef, inView } = useInView({
    threshold: 0.1,
    triggerOnce: false,
  });

  // React Query for infinite scroll with proper loading states and error handling
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useInfiniteQuery({
    queryKey: ['images'],
    queryFn: ({ pageParam = 1 }) => fetchImages(pageParam),
    getNextPageParam: (lastPage, pages) => {
      return lastPage.hasMore ? pages.length + 1 : undefined;
    },
    initialData: initialImages.length > 0 ? {
      pages: [{ images: initialImages, hasMore: true }],
      pageParams: [1]
    } : undefined,
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
  });

  // Get filtered images from context
  const { filteredImages: contextFilteredImages } = useFilters();
  
  // Flatten all images from all pages
  const allImages = useMemo(() => {
    if (data?.pages) {
      return data.pages.flatMap(page => page.images);
    }
    return initialImages.length > 0 ? initialImages : generateMockImages();
  }, [data?.pages, initialImages]);

  // Use filtered images if context is available, otherwise use all images
  const displayImages = contextFilteredImages.length > 0 ? contextFilteredImages : allImages;

  // Trigger infinite scroll when load more ref comes into view
  React.useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Masonry breakpoints for responsive layout
  const breakpointColumnsObj = {
    default: 4,
    1100: 3,
    700: 2,
    500: 1
  };

  // Toggle selection for an image
  const toggleImageSelection = useCallback((imageId: string) => {
    setSelectedImages(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(imageId)) {
        newSelection.delete(imageId);
      } else {
        newSelection.add(imageId);
      }
      return newSelection;
    });
  }, []);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedImages(new Set());
    setIsSelectionMode(false);
  }, []);

  // Select all images
  const selectAll = useCallback(() => {
    setSelectedImages(new Set(displayImages.map(img => img.id)));
    setIsSelectionMode(true);
  }, [displayImages]);

  // Keyboard shortcuts
  useHotkeys('esc', clearSelection, { enableOnTags: ['INPUT', 'TEXTAREA'] });
  useHotkeys('ctrl+a', (e) => {
    e.preventDefault();
    selectAll();
  });

  // Handle bulk actions
  const handleBulkAction = useCallback((action: string) => {
    const selectedImageObjects = displayImages.filter(img => selectedImages.has(img.id));
    onBulkAction?.(action, selectedImageObjects);
  }, [displayImages, selectedImages, onBulkAction]);

  // Calculate aspect ratio for proper image sizing
  const getImageStyle = useCallback((image: Image) => {
    const aspectRatio = image.width / image.height;
    return {
      aspectRatio: aspectRatio.toString(),
    };
  }, []);

  // Show loading state for initial load
  if (isLoading) {
    return (
      <div className={cn("gallery-container", className)}>
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Loading images...</p>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (isError) {
    return (
      <div className={cn("gallery-container", className)}>
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              Failed to load images: {error instanceof Error ? error.message : 'Unknown error'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              {isRefetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={cn("gallery-container", className)}>
      {/* Bulk action toolbar */}
      {selectedImages.size > 0 && (
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium">
                {selectedImages.size} image{selectedImages.size !== 1 ? 's' : ''} selected
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('download')}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('edit')}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction('share')}
              >
                <Share className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleBulkAction('delete')}
              >
                <Trash className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Masonry grid */}
      <Masonry
        breakpointCols={breakpointColumnsObj}
        className="flex -ml-4 w-auto"
        columnClassName="pl-4 bg-clip-padding"
      >
        {displayImages.map((image, index) => {
          const isSelected = selectedImages.has(image.id);
          const isLast = index === displayImages.length - 1;

          return (
            <ImageCard
              key={image.id}
              ref={isLast ? loadMoreRef : undefined}
              image={image}
              isSelected={isSelected}
              isLast={isLast}
              onSelect={onImageSelect || (() => {})}
              onToggleSelection={toggleImageSelection}
              onAction={handleBulkAction}
              showSelection={showSelection}
            />
          );
        })}
      </Masonry>

      {/* Loading indicators */}
      {isFetchingNextPage && (
        <div className="flex justify-center py-8">
          <div className="text-center space-y-2">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
            <p className="text-sm text-muted-foreground">Loading more images...</p>
          </div>
        </div>
      )}

      {/* End of results indicator */}
      {!hasNextPage && displayImages.length > 0 && (
        <div className="flex justify-center py-8">
          <div className="text-center space-y-2">
            <div className="h-1 w-16 bg-muted mx-auto rounded"></div>
            <p className="text-sm text-muted-foreground">
              You've reached the end ({displayImages.length} images)
            </p>
          </div>
        </div>
      )}

      {/* Empty state */}
      {displayImages.length === 0 && !isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
              <Eye className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">No images found</h3>
              <p className="text-muted-foreground">
                Try adjusting your filters or upload some images to get started.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Mock data generator for development
function generateMockImages(): Image[] {
  const orientations: Array<'landscape' | 'portrait' | 'square'> = ['landscape', 'portrait', 'square'];
  const albums = ['Vacation', 'Family', 'Nature', 'Events', 'Portraits'];
  const tags = ['sunset', 'beach', 'mountains', 'city', 'nature', 'people', 'animals'];

  return Array.from({ length: 20 }, (_, i) => {
    const orientation = orientations[Math.floor(Math.random() * orientations.length)];
    const width = orientation === 'landscape' ? 800 : orientation === 'portrait' ? 600 : 700;
    const height = orientation === 'landscape' ? 600 : orientation === 'portrait' ? 800 : 700;
    
    return {
      id: `image-${i + 1}`,
      src: `https://picsum.photos/${width}/${height}?random=${i + 1}`,
      width,
      height,
      title: `Image ${i + 1}`,
      album: albums[Math.floor(Math.random() * albums.length)],
      tags: tags.slice(0, Math.floor(Math.random() * 3) + 1),
      createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      orientation,
    };
  });
}
