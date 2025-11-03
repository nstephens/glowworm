import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { 
  Eye, 
  Trash2, 
  Download, 
  Share, 
  Star, 
  MoreHorizontal,
  Check,
  X,
  Loader2,
  RefreshCw,
  AlertCircle,
  Copy,
  Move,
  Upload
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInfiniteScroll } from '../../hooks/useInfiniteScroll';
import { useTouchSelection } from '../../hooks/useTouchSelection';
import { useSwipeGestures } from '../../hooks/useSwipeGestures';
import { TouchImageCard } from './TouchImageCard';
import { FloatingActionButton } from '../ui/FloatingActionButton';
import { MobileActionBar } from '../ui/MobileActionBar';
import { QuickActionMenu } from '../ui/QuickActionMenu';
import { MobileImageViewer } from './MobileImageViewer';
import { hapticPatterns } from '../../utils/hapticFeedback';
import type { Image, Album } from '../../types';

interface MobileMasonryGalleryProps {
  images: Image[];
  albums: Album[];
  selectedAlbum?: number | string | null;
  onImageSelect?: (image: Image) => void;
  onImageDelete?: (image: Image) => void;
  onBulkDelete?: (imageIds: number[]) => void;
  onImageMove?: (image: Image, albumId: number) => void;
  onUploadClick?: () => void;
  loading?: boolean;
  onLoadMore?: () => Promise<void>;
  hasMore?: boolean;
  isFetchingMore?: boolean;
  /** Error state for infinite scroll */
  infiniteScrollError?: Error | null;
  /** Retry function for infinite scroll */
  onRetryInfiniteScroll?: () => void;
}

interface ImageCardProps {
  image: Image;
  albums: Album[];
  isSelected: boolean;
  onSelect: (image: Image, event: React.MouseEvent) => void;
  onDelete: (image: Image) => void;
  onViewFullSize: (image: Image) => void;
  showSelection?: boolean;
}

const ImageCard: React.FC<ImageCardProps> = ({
  image,
  albums,
  isSelected,
  onSelect,
  onDelete,
  onViewFullSize,
  showSelection = true
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
    setImageLoaded(true);
  }, []);

  const formatFileSize = (bytes: number | null | undefined) => {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string | undefined) => {
    return dateString ? new Date(dateString).toLocaleDateString() : "Unknown";
  };

  return (
    <div
      className={cn(
        'relative group cursor-pointer rounded-xl overflow-hidden bg-white shadow-sm border transition-all duration-200',
        isSelected 
          ? 'border-primary-500 ring-2 ring-primary-200 shadow-lg scale-[1.02]' 
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md hover:scale-[1.01]'
      )}
      onClick={(e) => onSelect(image, e)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Container */}
      <div className="relative">
        {/* Loading placeholder */}
        {!imageLoaded && !imageError && (
          <div className="aspect-square bg-gray-200 animate-pulse flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        )}

        {/* Error placeholder */}
        {imageError && (
          <div className="aspect-square bg-gray-100 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <X className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">Failed to load</p>
            </div>
          </div>
        )}

        {/* Actual image */}
        {!imageError && (
          (() => {
            const base = (image.url || '').split('?')[0];
            const small = `${base}?size=small&format=jpeg`;
            const medium = `${base}?size=medium&format=jpeg`;
            const large = `${base}?size=large&format=jpeg`;
            const original = `${base}?format=jpeg`;
            const srcSet = `${small} 320w, ${medium} 640w, ${large} 960w, ${original} 1600w`;
            return (
              <img
                src={small}
                srcSet={srcSet}
                alt={image.original_filename}
                className={cn(
                  'w-full transition-all duration-300',
                  imageLoaded ? 'opacity-100' : 'opacity-0',
                  'aspect-square sm:aspect-[4/3] object-cover'
                )}
                loading="lazy"
                decoding="async"
                sizes="(max-width: 480px) 25vw, (max-width: 768px) 25vw, 20vw"
                onLoad={handleImageLoad}
                onError={(e) => {
                  const el = e.currentTarget as HTMLImageElement;
                  if (el.src !== medium) {
                    el.src = medium; // try medium
                  } else if (el.src !== large) {
                    el.src = large; // then large
                  } else if (original && el.src !== original) {
                    el.src = original; // finally original
                  } else {
                    handleImageError();
                  }
                }}
              />
            );
          })()
        )}
        
        {/* Gradient Overlay */}
        <div className={cn(
          'absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent transition-opacity duration-200',
          isHovered ? 'opacity-100' : 'opacity-0'
        )} />
        
        {/* Action Buttons Overlay */}
        <div className={cn(
          'absolute inset-0 flex items-center justify-center transition-all duration-200',
          isHovered ? 'opacity-100' : 'opacity-0'
        )}>
          <div className="flex space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewFullSize(image);
              }}
              className="p-2.5 bg-white/90 backdrop-blur-sm rounded-full text-gray-600 hover:text-blue-600 hover:bg-white shadow-lg transition-all duration-200 hover:scale-110"
              title="View full size"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(image);
              }}
              className="p-2.5 bg-white/90 backdrop-blur-sm rounded-full text-gray-600 hover:text-red-600 hover:bg-white shadow-lg transition-all duration-200 hover:scale-110"
              title="Delete image"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Selection Indicator */}
        {isSelected && showSelection && (
          <div className="absolute top-3 right-3 w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
            <Check className="w-4 h-4 text-white" />
          </div>
        )}

        {/* Album Badge */}
        {image.album_id && (
          <div className="absolute bottom-3 left-3">
            <span className="px-2 py-1 bg-primary-600/90 backdrop-blur-sm text-white text-xs font-medium rounded-full">
              {albums.find(a => a.id === image.album_id)?.name}
            </span>
          </div>
        )}
      </div>

      {/* Image Info */}
      <div className="p-3">
        <h4 className="font-semibold text-gray-900 truncate text-sm mb-1">
          {image.original_filename}
        </h4>
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-700">{image.width} × {image.height}</span>
            <span>{formatFileSize(image.file_size)}</span>
          </div>
          <p className="text-gray-400">{formatDate(image.uploaded_at)}</p>
        </div>
      </div>

      {/* Hover Border Effect */}
      <div className="absolute inset-0 rounded-xl border-2 border-transparent group-hover:border-primary-200 transition-colors duration-200 pointer-events-none" />
    </div>
  );
};

export const MobileMasonryGallery: React.FC<MobileMasonryGalleryProps> = ({
  images,
  albums,
  selectedAlbum: propSelectedAlbum,
  onImageSelect,
  onImageDelete,
  onBulkDelete,
  onImageMove,
  onUploadClick,
  loading = false,
  onLoadMore,
  hasMore = false,
  isFetchingMore = false,
  infiniteScrollError,
  onRetryInfiniteScroll
}) => {
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [viewerImageIndex, setViewerImageIndex] = useState(0);
  const [showQuickActions, setShowQuickActions] = useState(false);

  // Touch selection hook
  const {
    selectedIds,
    isSelected,
    toggleSelection,
    selectItem,
    selectItems,
    clearSelection,
    selectAll,
    selectedCount,
    hasSelection
  } = useTouchSelection({
    multiSelect: true,
    longPressSelection: true,
    hapticFeedback: true,
    onSelectionChange: (selectedIds) => {
      // Update bulk selection state if needed
    }
  });

  // Infinite scroll hook
  const {
    loadMoreRef,
    inView,
    isLoadingMore,
    error: scrollError,
    retry,
    reset
  } = useInfiniteScroll({
    fetchMore: onLoadMore || (() => Promise.resolve()),
    hasMore,
    isFetching: isFetchingMore,
    rootMargin: '200px',
    threshold: 0.1,
    delay: 100, // Small delay to prevent rapid firing
    maxRetries: 3
  });

  // Use external error if provided, otherwise use internal scroll error
  const currentError = infiniteScrollError || scrollError;
  const handleRetry = onRetryInfiniteScroll || retry;

  // Filter images based on selected album
  const filteredImages = images.filter(image => {
    if (propSelectedAlbum !== null && propSelectedAlbum !== undefined) {
      if (propSelectedAlbum === 'no-album') {
        return !image.album_id;
      } else {
        return image.album_id === propSelectedAlbum;
      }
    }
    return true;
  });

  const handleImageSelect = useCallback((image: Image, event: React.MouseEvent | React.TouchEvent) => {
    if (event.type === 'click' && (event as React.MouseEvent).ctrlKey || (event as React.MouseEvent).metaKey) {
      // Multi-select with Ctrl/Cmd key
      toggleSelection(image.id, event);
    } else {
      // Single select
      selectItem(image.id, event);
      onImageSelect?.(image);
    }
  }, [toggleSelection, selectItem, onImageSelect]);

  const handleViewFullSize = useCallback((image: Image) => {
    const imageIndex = filteredImages.findIndex(img => img.id === image.id);
    if (imageIndex !== -1) {
      setViewerImageIndex(imageIndex);
      setShowImageViewer(true);
    }
  }, [filteredImages]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0 || !onBulkDelete) return;
    onBulkDelete(Array.from(selectedIds));
    clearSelection();
  }, [selectedIds, onBulkDelete, clearSelection]);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredImages.length) {
      clearSelection();
    } else {
      selectAll(filteredImages.map(img => img.id));
    }
  }, [selectedIds.size, filteredImages.length, clearSelection, selectAll, filteredImages]);

  // Quick action handlers
  const handleQuickAction = useCallback((action: string) => {
    const selectedImages = filteredImages.filter(img => selectedIds.has(img.id));
    
    switch (action) {
      case 'download':
        console.log('Download selected images:', selectedImages);
        break;
      case 'share':
        console.log('Share selected images:', selectedImages);
        break;
      case 'favorite':
        console.log('Favorite selected images:', selectedImages);
        break;
      case 'copy':
        console.log('Copy selected images:', selectedImages);
        break;
      case 'move':
        console.log('Move selected images:', selectedImages);
        break;
      case 'delete':
        handleBulkDelete();
        break;
      default:
        console.log('Unknown action:', action);
    }
  }, [selectedIds, filteredImages, handleBulkDelete]);

  const handleUploadClick = useCallback(() => {
    onUploadClick?.();
  }, [onUploadClick]);

  // Stable key to avoid excessive re-mounts
  const masonryKey = `masonry-main-${filteredImages?.length || 0}`;

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Loading Skeleton using CSS columns-based masonry */}
        <div className="[column-fill:_balance] gap-2 columns-2 sm:columns-3 md:columns-4 lg:columns-5">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-2 break-inside-avoid" style={{ breakInside: 'avoid' }}>
              <div className="aspect-square bg-gray-200 animate-pulse" />
              <div className="p-3 space-y-2">
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                <div className="space-y-1">
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Image Count and Selection Info */}
      <div className="flex items-center justify-between text-sm text-gray-500 px-2">
        <div className="flex items-center space-x-4">
          <span>
            {filteredImages.length} image{filteredImages.length !== 1 ? 's' : ''}
          </span>
          {hasSelection && (
            <button
              onClick={handleSelectAll}
              className="text-primary-600 font-medium hover:text-primary-700 transition-colors"
            >
              {selectedCount === filteredImages.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
        </div>
        {hasSelection && (
          <span className="text-primary-600 font-medium bg-primary-50 px-2 py-1 rounded-full">
            {selectedCount} selected
          </span>
        )}
      </div>

      {/* Masonry Grid (CSS columns) */}
      {filteredImages.length === 0 ? (
        <div className="text-center py-16">
          <div className="relative">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-primary-100 to-primary-200 rounded-2xl flex items-center justify-center">
              <Eye className="w-12 h-12 text-primary-600" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">0</span>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {propSelectedAlbum ? 'No images in this album' : 'No images yet'}
          </h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            {propSelectedAlbum 
              ? 'This album doesn\'t contain any images yet.' 
              : 'Upload your first images to get started with your gallery.'
            }
          </p>
          {!propSelectedAlbum && onUploadClick && (
            <button 
              onClick={onUploadClick}
              className="inline-flex items-center space-x-2 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              <span>Upload Images</span>
            </button>
          )}
        </div>
      ) : (
        <div
          key={masonryKey}
          className="w-full max-w-full [column-fill:_balance] columns-3 sm:columns-4 md:columns-5 lg:columns-6"
          style={{ columnWidth: '120px', columnGap: '4px' }}
        >
          {filteredImages.map((image) => {
            const isImageSelected = isSelected(image.id);

            return (
              <div key={image.id} className="mb-1 break-inside-avoid inline-block w-full align-top" style={{ breakInside: 'avoid' }}>
                <TouchImageCard
                  image={image}
                  albums={albums}
                  isSelected={isImageSelected}
                  onSelect={handleImageSelect}
                  onDelete={onImageDelete || (() => {})}
                  onViewFullSize={handleViewFullSize}
                  onAction={(action, image) => {
                    console.log('Action:', action, 'Image:', image);
                  }}
                  showSelection={true}
                  enableMultiSelect={true}
                  enableLongPress={true}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Infinite scroll sentinel placed outside the masonry grid to avoid DOM removal conflicts */}
      {hasMore && !isFetchingMore && (
        <div ref={loadMoreRef} className="h-1" />
      )}

      {/* Loading More Indicator */}
      {(isFetchingMore || isLoadingMore) && (
        <div className="flex justify-center py-8">
          <div className="text-center space-y-2">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
            <p className="text-sm text-gray-500">Loading more images...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {currentError && (
        <div className="flex justify-center py-8">
          <div className="text-center space-y-4 max-w-md mx-auto px-4">
            <div className="flex items-center justify-center w-12 h-12 bg-red-100 rounded-full mx-auto">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Failed to load images
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                {currentError.message || 'Something went wrong while loading more images.'}
              </p>
              <button
                onClick={handleRetry}
                className="inline-flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Try Again</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End of Results Indicator */}
      {!hasMore && filteredImages.length > 0 && !currentError && (
        <div className="flex justify-center py-8">
          <div className="text-center space-y-2">
            <div className="h-1 w-16 bg-gray-300 mx-auto rounded"></div>
            <p className="text-sm text-gray-500">
              You've reached the end ({filteredImages.length} images)
            </p>
          </div>
        </div>
      )}

      {/* Mobile Action Bar */}
      <MobileActionBar
        selectedCount={selectedCount}
        totalCount={filteredImages.length}
        visible={hasSelection}
        primaryActions={[
          {
            id: 'download',
            icon: <Download className="h-4 w-4" />,
            label: 'Download',
            onClick: () => handleQuickAction('download')
          },
          {
            id: 'share',
            icon: <Share className="h-4 w-4" />,
            label: 'Share',
            onClick: () => handleQuickAction('share')
          },
          {
            id: 'delete',
            icon: <Trash2 className="h-4 w-4" />,
            label: 'Delete',
            onClick: () => handleQuickAction('delete'),
            variant: 'destructive'
          }
        ]}
        secondaryActions={[
          {
            id: 'favorite',
            icon: <Star className="h-4 w-4" />,
            label: 'Add to Favorites',
            onClick: () => handleQuickAction('favorite')
          },
          {
            id: 'copy',
            icon: <Copy className="h-4 w-4" />,
            label: 'Copy',
            onClick: () => handleQuickAction('copy')
          },
          {
            id: 'move',
            icon: <Move className="h-4 w-4" />,
            label: 'Move to Album',
            onClick: () => handleQuickAction('move')
          }
        ]}
        onClearSelection={clearSelection}
        onSelectAll={handleSelectAll}
        allSelected={selectedCount === filteredImages.length}
        hapticFeedback={true}
      />

      {/* Mobile Image Viewer */}
      <MobileImageViewer
        images={filteredImages}
        currentIndex={viewerImageIndex}
        visible={showImageViewer}
        onVisibilityChange={setShowImageViewer}
        onImageChange={setViewerImageIndex}
        onImageAction={(action, image) => {
          switch (action) {
            case 'download':
              console.log('Download image:', image);
              break;
            case 'share':
              console.log('Share image:', image);
              break;
            case 'delete':
              onImageDelete?.(image);
              setShowImageViewer(false);
              break;
            case 'more':
              console.log('More actions for image:', image);
              break;
            default:
              console.log('Unknown action:', action);
          }
        }}
        showControls={true}
        enableSwipe={true}
        enableZoom={true}
        hapticFeedback={true}
      />

      {/* Floating Action Button */}
      <FloatingActionButton
        mainIcon={<Upload className="h-5 w-5" />}
        onMainAction={handleUploadClick}
        actions={[
          {
            id: 'upload',
            icon: <Upload className="h-4 w-4" />,
            label: 'Upload Images',
            onClick: handleUploadClick
          },
          {
            id: 'camera',
            icon: <Eye className="h-4 w-4" />,
            label: 'Take Photo',
            onClick: () => console.log('Take photo')
          },
          {
            id: 'scan',
            icon: <MoreHorizontal className="h-4 w-4" />,
            label: 'Scan Document',
            onClick: () => console.log('Scan document')
          }
        ]}
        position="bottom-right"
        size="md"
        showLabels={true}
        hapticFeedback={true}
      />

      {/* Quick Action Menu */}
      <QuickActionMenu
        visible={showQuickActions}
        onVisibilityChange={setShowQuickActions}
        actionGroups={[
          {
            title: 'Selection Actions',
            actions: [
              {
                id: 'select-all',
                icon: <Check className="h-4 w-4" />,
                label: 'Select All',
                description: 'Select all visible images',
                onClick: handleSelectAll
              },
              {
                id: 'clear-selection',
                icon: <X className="h-4 w-4" />,
                label: 'Clear Selection',
                description: 'Deselect all images',
                onClick: clearSelection
              }
            ]
          },
          {
            title: 'Bulk Actions',
            actions: [
              {
                id: 'bulk-download',
                icon: <Download className="h-4 w-4" />,
                label: 'Download Selected',
                description: 'Download all selected images',
                onClick: () => handleQuickAction('download'),
                disabled: !hasSelection
              },
              {
                id: 'bulk-share',
                icon: <Share className="h-4 w-4" />,
                label: 'Share Selected',
                description: 'Share selected images',
                onClick: () => handleQuickAction('share'),
                disabled: !hasSelection
              },
              {
                id: 'bulk-delete',
                icon: <Trash2 className="h-4 w-4" />,
                label: 'Delete Selected',
                description: 'Permanently delete selected images',
                onClick: () => handleQuickAction('delete'),
                variant: 'destructive',
                disabled: !hasSelection
              }
            ]
          }
        ]}
        position="center"
        size="md"
        showDescriptions={true}
        showShortcuts={false}
        hapticFeedback={true}
        closeOnAction={true}
      />
    </div>
  );
};

export default MobileMasonryGallery;
