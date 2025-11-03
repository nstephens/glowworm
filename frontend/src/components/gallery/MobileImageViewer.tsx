import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Download, 
  Share, 
  Trash2, 
  Heart, 
  Star, 
  ChevronLeft, 
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Info,
  MoreHorizontal
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { usePinchZoom } from '../../hooks/usePinchZoom';
import { useSwipeNavigation } from '../../hooks/useSwipeNavigation';

interface MobileImageViewerProps {
  images: Array<{
    id: string;
    url: string;
    thumbnail_url?: string;
    original_filename?: string;
    filename?: string;
    width?: number;
    height?: number;
    size?: number;
    created_at?: string;
    album?: {
      id: string;
      name: string;
    };
  }>;
  currentIndex: number;
  visible: boolean;
  onVisibilityChange: (visible: boolean) => void;
  onImageChange?: (index: number) => void;
  onImageAction?: (action: string, imageId: string) => void;
  showControls?: boolean;
  enableSwipe?: boolean;
  enableZoom?: boolean;
  hapticFeedback?: boolean;
  className?: string;
}

const MobileImageViewer: React.FC<MobileImageViewerProps> = ({
  images,
  currentIndex,
  visible,
  onVisibilityChange,
  onImageChange,
  onImageAction,
  showControls = true,
  enableSwipe = true,
  enableZoom = true,
  hapticFeedback = true,
  className,
}) => {
  const [showInfo, setShowInfo] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const currentImage = images[currentIndex];

  const triggerHapticFeedback = () => {
    if (hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }
  };

  // Pinch zoom functionality
  const {
    scale,
    offset,
    isZooming,
    isPanning,
    resetZoom,
    handleTouchStart: handleZoomTouchStart,
    handleTouchMove: handleZoomTouchMove,
    handleTouchEnd: handleZoomTouchEnd,
    handleWheel: handleZoomWheel,
    handleDoubleClick: handleZoomDoubleClick,
  } = usePinchZoom({
    minZoom: 1,
    maxZoom: 3,
    doubleTapZoom: 2,
    hapticFeedback,
  });

  // Swipe navigation
  const {
    goToNext,
    goToPrevious,
    handleTouchStart: handleSwipeTouchStart,
    handleTouchMove: handleSwipeTouchMove,
    handleTouchEnd: handleSwipeTouchEnd,
  } = useSwipeNavigation({
    imageCount: images.length,
    currentIndex,
    onChange: (index) => {
      triggerHapticFeedback();
      onImageChange?.(index);
    },
    enableSwipe,
    hapticFeedback,
  });

  // Auto-hide controls
  useEffect(() => {
    if (!visible) return;

    const timer = setTimeout(() => {
      setControlsVisible(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, [visible, currentIndex]);

  // Reset zoom when image changes
  useEffect(() => {
    resetZoom();
  }, [currentIndex, resetZoom]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!visible) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          onVisibilityChange(false);
          break;
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case 'i':
        case 'I':
          setShowInfo(!showInfo);
          break;
        case 'r':
        case 'R':
          resetZoom();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [visible, goToPrevious, goToNext, showInfo, resetZoom, onVisibilityChange]);

  const handleTouchStart = (event: React.TouchEvent) => {
    if (enableZoom) {
      handleZoomTouchStart(event);
    }
    if (enableSwipe) {
      handleSwipeTouchStart(event);
    }
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    if (enableZoom && isZooming) {
      handleZoomTouchMove(event);
    }
    if (enableSwipe && !isZooming) {
      handleSwipeTouchMove(event);
    }
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (enableZoom) {
      handleZoomTouchEnd(event);
    }
    if (enableSwipe) {
      handleSwipeTouchEnd(event);
    }
  };

  const handleImageAction = (action: string) => {
    triggerHapticFeedback();
    onImageAction?.(action, currentImage.id);
    setShowActionMenu(false);
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date';
    return new Date(dateString).toLocaleDateString();
  };

  if (!visible || !currentImage) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className={cn(
          "fixed inset-0 z-50 bg-black",
          className
        )}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={enableZoom ? handleZoomWheel : undefined}
        onDoubleClick={enableZoom ? handleZoomDoubleClick : undefined}
        onClick={() => setControlsVisible(!controlsVisible)}
      >
        {/* Image Container */}
        <div 
          ref={containerRef}
          className="relative w-full h-full flex items-center justify-center"
        >
          <motion.img
            ref={imageRef}
            src={currentImage.url}
            alt={currentImage.original_filename || currentImage.filename || 'Image'}
            className="max-w-full max-h-full object-contain select-none"
            style={{
              transform: `scale(${scale}) translate(${offset.x}px, ${offset.y}px)`,
              transformOrigin: 'center center',
            }}
            draggable={false}
          />
        </div>

        {/* Controls Overlay */}
        <AnimatePresence>
          {showControls && controlsVisible && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 pointer-events-none"
            >
              {/* Top Controls */}
              <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/50 to-transparent pointer-events-auto">
                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onVisibilityChange(false)}
                    className="text-white hover:bg-white/20"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowInfo(!showInfo)}
                      className="text-white hover:bg-white/20"
                    >
                      <Info className="w-5 h-5" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowActionMenu(!showActionMenu)}
                      className="text-white hover:bg-white/20"
                    >
                      <MoreHorizontal className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Bottom Controls */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent pointer-events-auto">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-white text-sm">
                    {currentIndex + 1} of {images.length}
                  </div>
                  
                  {enableZoom && (
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={resetZoom}
                        className="text-white hover:bg-white/20"
                      >
                        <RotateCw className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Navigation Arrows */}
                {images.length > 1 && (
                  <div className="flex items-center justify-between">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={goToPrevious}
                      disabled={currentIndex === 0}
                      className="text-white hover:bg-white/20 disabled:opacity-50"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={goToNext}
                      disabled={currentIndex === images.length - 1}
                      className="text-white hover:bg-white/20 disabled:opacity-50"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image Info Panel */}
        <AnimatePresence>
          {showInfo && (
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              transition={{ duration: 0.3 }}
              className="absolute bottom-20 left-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-4 pointer-events-auto"
            >
              <div className="space-y-2 text-sm">
                <div className="font-medium text-gray-900">
                  {currentImage.original_filename || currentImage.filename || 'Unknown'}
                </div>
                {currentImage.width && currentImage.height && (
                  <div className="text-gray-600">
                    {currentImage.width} × {currentImage.height}
                  </div>
                )}
                <div className="text-gray-600">
                  {formatFileSize(currentImage.size)}
                </div>
                <div className="text-gray-600">
                  {formatDate(currentImage.created_at)}
                </div>
                {currentImage.album && (
                  <div className="text-gray-600">
                    Album: {currentImage.album.name}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action Menu */}
        <AnimatePresence>
          {showActionMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              className="absolute top-16 right-4 bg-white rounded-lg shadow-xl border border-gray-200 p-2 pointer-events-auto"
            >
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleImageAction('download')}
                  className="w-full justify-start"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleImageAction('share')}
                  className="w-full justify-start"
                >
                  <Share className="w-4 h-4 mr-2" />
                  Share
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleImageAction('favorite')}
                  className="w-full justify-start"
                >
                  <Heart className="w-4 h-4 mr-2" />
                  Favorite
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleImageAction('delete')}
                  className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};

export { MobileImageViewer };