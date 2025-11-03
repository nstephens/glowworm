import React, { useState, useCallback, useRef } from 'react';
import { 
  Eye, 
  Trash2, 
  Download, 
  Share, 
  Star, 
  MoreHorizontal,
  Check,
  X,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTouchSelection } from '../../hooks/useTouchSelection';
import { LazyImage } from '../ui/LazyImage';
import { hapticPatterns } from '../../utils/hapticFeedback';
import type { Image, Album } from '../../types';

interface TouchImageCardProps {
  image: Image;
  albums: Album[];
  isSelected: boolean;
  onSelect: (image: Image, event: React.MouseEvent | React.TouchEvent) => void;
  onDelete: (image: Image) => void;
  onViewFullSize: (image: Image) => void;
  onAction?: (action: string, image: Image) => void;
  showSelection?: boolean;
  enableMultiSelect?: boolean;
  enableLongPress?: boolean;
  className?: string;
}

export const TouchImageCard: React.FC<TouchImageCardProps> = ({
  image,
  albums,
  isSelected,
  onSelect,
  onDelete,
  onViewFullSize,
  onAction,
  showSelection = true,
  enableMultiSelect = true,
  enableLongPress = true,
  className
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Touch selection hook
  const {
    touchHandlers,
    mouseHandlers
  } = useTouchSelection({
    multiSelect: enableMultiSelect,
    longPressSelection: enableLongPress,
    hapticFeedback: true,
    onItemSelect: (id, selected) => {
      if (id === image.id) {
        // Trigger haptic feedback for selection
        hapticPatterns.selection();
      }
    }
  });

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  const handleImageError = useCallback(() => {
    setImageError(true);
    setImageLoaded(true);
  }, []);

  const handleCardClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // On mobile, toggle action bar on tap instead of hover
    const isMobile = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (isMobile) {
      setShowActions(prev => !prev);
      return;
    }
    onSelect(image, e);
  }, [image, onSelect]);

  const handleActionClick = useCallback((action: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    hapticPatterns.buttonPress();
    onAction?.(action, image);
  }, [image, onAction]);

  const handleViewClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    hapticPatterns.navigation();
    onViewFullSize(image);
  }, [image, onViewFullSize]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    hapticPatterns.error();
    onDelete(image);
  }, [image, onDelete]);

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
      ref={cardRef}
      data-image-id={image.id}
      className={cn(
        'relative group cursor-pointer rounded-xl overflow-hidden bg-white shadow-sm border transition-all duration-200 touch-manipulation',
        isSelected 
          ? 'border-primary-500 ring-2 ring-primary-200 shadow-lg scale-[1.02]' 
          : 'border-gray-200 hover:border-gray-300 hover:shadow-md hover:scale-[1.01]',
        className
      )}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...touchHandlers}
      {...mouseHandlers}
      style={{
        touchAction: 'manipulation',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none'
      }}
    >
      {/* Image Container */}
      <div className="relative">
        {/* Loading placeholder */}
        {!imageLoaded && !imageError && (
          <div className="aspect-[4/3] bg-gray-200 animate-pulse flex items-center justify-center">
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
          <LazyImage
            src={(image.url || '').split('?')[0] + '?size=small&format=jpeg'}
            alt={image.original_filename || image.filename || 'Image'}
            fallbackSrc={(image.url || '').split('?')[0] + '?format=jpeg'}
            className={cn(
              'block w-full transition-all duration-300',
              'aspect-square sm:aspect-[4/3] object-cover'
            )}
            srcSet={`${(image.url || '').split('?')[0]}?size=small&format=jpeg 320w, ${(image.url || '').split('?')[0]}?size=medium&format=jpeg 640w, ${(image.url || '').split('?')[0]}?size=large&format=jpeg 960w, ${(image.url || '').split('?')[0]}?format=jpeg 1600w`}
            sizes="(max-width: 480px) 25vw, (max-width: 768px) 25vw, 20vw"
            onLoad={handleImageLoad}
            onError={handleImageError}
            rootMargin="50px 0px"
            threshold={0.1}
            triggerOnce={true}
            showSkeleton={true}
            skeletonClassName="w-full aspect-square sm:aspect-[4/3]"
            forceAcceptJPEG={true}
          />
        )}
        
        {/* Gradient Overlay */}
        <div className={cn(
          'absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent transition-opacity duration-200',
          (isHovered || showActions) ? 'opacity-100' : 'opacity-0'
        )} />
        
        {/* Action Buttons Overlay */}
        <div className={cn(
          'absolute inset-0 flex items-center justify-center transition-all duration-200',
          (isHovered || showActions) ? 'opacity-100' : 'opacity-0'
        )}>
          <div className="flex space-x-2">
            <button
              onClick={handleViewClick}
              className="p-2.5 bg-white/90 backdrop-blur-sm rounded-full text-gray-600 hover:text-blue-600 hover:bg-white shadow-lg transition-all duration-200 hover:scale-110 touch-manipulation"
              title="View full size"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={handleDeleteClick}
              className="p-2.5 bg-white/90 backdrop-blur-sm rounded-full text-gray-600 hover:text-red-600 hover:bg-white shadow-lg transition-all duration-200 hover:scale-110 touch-manipulation"
              title="Delete image"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            {onAction && (
              <button
                onClick={(e) => handleActionClick('more', e)}
                className="p-2.5 bg-white/90 backdrop-blur-sm rounded-full text-gray-600 hover:text-gray-900 hover:bg-white shadow-lg transition-all duration-200 hover:scale-110 touch-manipulation"
                title="More actions"
              >
                <MoreHorizontal className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Selection Indicator */}
        {isSelected && showSelection && (
          <div className="absolute top-3 right-3 w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white z-10">
            <Check className="w-4 h-4 text-white" />
          </div>
        )}

        {/* Long-press indicator */}
        {enableLongPress && (
          <div className={cn(
            'absolute inset-0 bg-primary-500/20 rounded-xl transition-opacity duration-200 pointer-events-none',
            'opacity-0'
          )} />
        )}

        {/* Album Badge */}
        {image.album_id && (
          <div className="absolute bottom-3 left-3">
            <span className="px-2 py-1 bg-primary-600/90 backdrop-blur-sm text-white text-xs font-medium rounded-full">
              {albums.find(a => a.id === image.album_id)?.name}
            </span>
          </div>
        )}

        {/* Selection Counter */}
        {isSelected && showSelection && (
          <div className="absolute top-3 left-3 w-6 h-6 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg border border-gray-200 z-10">
            <span className="text-xs font-semibold text-gray-700">
              {image.id}
            </span>
          </div>
        )}
      </div>

      {/* Image Info */}
      <div className="p-2 md:p-3">
        <h4 className="font-semibold text-gray-900 truncate text-xs md:text-sm mb-1">
          {image.original_filename}
        </h4>
        <div className="text-[10px] md:text-xs text-gray-500 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-700">{image.width} × {image.height}</span>
            <span>{formatFileSize(image.file_size)}</span>
          </div>
          <p className="text-gray-400">{formatDate(image.uploaded_at)}</p>
        </div>
      </div>

      {/* Hover Border Effect */}
      <div className="absolute inset-0 rounded-xl border-2 border-transparent group-hover:border-primary-200 transition-colors duration-200 pointer-events-none" />
      
      {/* Selection Ring */}
      {isSelected && (
        <div className="absolute inset-0 rounded-xl ring-2 ring-primary-500 ring-offset-2 ring-offset-white pointer-events-none" />
      )}
    </div>
  );
};

export default TouchImageCard;
