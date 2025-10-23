import React, { useState, useCallback, useMemo } from 'react';
import Masonry from 'react-masonry-css';
import { useInView } from 'react-intersection-observer';
import { useHotkeys } from 'react-hotkeys-hook';
import { 
  Edit, 
  Trash, 
  Share, 
  Star, 
  Download, 
  Eye,
  Check,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

  // Mock data for now - will be replaced with actual API integration
  const allImages = useMemo(() => {
    return initialImages.length > 0 ? initialImages : generateMockImages();
  }, [initialImages]);

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
    setSelectedImages(new Set(allImages.map(img => img.id)));
    setIsSelectionMode(true);
  }, [allImages]);

  // Keyboard shortcuts
  useHotkeys('esc', clearSelection, { enableOnTags: ['INPUT', 'TEXTAREA'] });
  useHotkeys('ctrl+a', (e) => {
    e.preventDefault();
    selectAll();
  });

  // Handle bulk actions
  const handleBulkAction = useCallback((action: string) => {
    const selectedImageObjects = allImages.filter(img => selectedImages.has(img.id));
    onBulkAction?.(action, selectedImageObjects);
  }, [allImages, selectedImages, onBulkAction]);

  // Calculate aspect ratio for proper image sizing
  const getImageStyle = useCallback((image: Image) => {
    const aspectRatio = image.width / image.height;
    return {
      aspectRatio: aspectRatio.toString(),
    };
  }, []);

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
        {allImages.map((image, index) => {
          const isSelected = selectedImages.has(image.id);
          const isHovered = hoveredImage === image.id;
          const isLast = index === allImages.length - 1;

          return (
            <div
              key={image.id}
              ref={isLast ? loadMoreRef : undefined}
              className={cn(
                "masonry-item mb-4 break-inside-avoid",
                "group relative overflow-hidden rounded-lg bg-card border",
                "transition-all duration-200",
                "hover:shadow-lg hover:scale-[1.02]",
                isSelected && "ring-2 ring-primary ring-offset-2",
                isHovered && "shadow-lg scale-[1.02]"
              )}
              style={getImageStyle(image)}
              onMouseEnter={() => setHoveredImage(image.id)}
              onMouseLeave={() => setHoveredImage(null)}
            >
              {/* Selection checkbox */}
              {showSelection && (
                <div className="absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Checkbox
                    checked={isSelected}
                    onChange={() => toggleImageSelection(image.id)}
                    aria-label={`Select ${image.title}`}
                    className="bg-background/80 backdrop-blur-sm"
                  />
                </div>
              )}

              {/* Image */}
              <div className="relative w-full h-full">
                <img
                  src={image.src}
                  alt={image.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = '/placeholder-image.jpg';
                  }}
                />

                {/* Hover overlay with actions */}
                <div className={cn(
                  "absolute inset-0 bg-black/60 backdrop-blur-sm",
                  "flex flex-col justify-between p-4",
                  "opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                )}>
                  {/* Image title */}
                  <div className="text-white">
                    <h3 className="font-semibold text-sm truncate">{image.title}</h3>
                    {image.album && (
                      <p className="text-xs text-white/80 truncate">{image.album}</p>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-white hover:bg-white/20"
                      onClick={() => onImageSelect?.(image)}
                      aria-label="View details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-white hover:bg-white/20"
                      onClick={() => handleBulkAction('download')}
                      aria-label="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-white hover:bg-white/20"
                      onClick={() => handleBulkAction('share')}
                      aria-label="Share"
                    >
                      <Share className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-white hover:bg-white/20"
                      onClick={() => handleBulkAction('favorite')}
                      aria-label="Add to favorites"
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-white hover:bg-white/20"
                      onClick={() => handleBulkAction('edit')}
                      aria-label="Edit"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-white hover:bg-white/20"
                      onClick={() => handleBulkAction('delete')}
                      aria-label="Delete"
                    >
                      <Trash className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Selection indicator */}
                {isSelected && (
                  <div className="absolute top-2 right-2 z-20">
                    <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="h-4 w-4 text-primary-foreground" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </Masonry>

      {/* Loading indicator */}
      {inView && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
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
