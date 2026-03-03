import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ExternalLink,
  Target,
  Calendar,
  HardDrive,
  Maximize2,
  FolderOpen,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Image, DisplayDevice } from '@/types';
import { FocusPointEditor } from './FocusPointEditor';
import { apiService } from '@/services/api';

interface ImageDetailModalProps {
  image: Image | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImageUpdate?: (image: Image) => void;
  albums?: Array<{ id: number; name: string }>;
  /** List of all images for navigation */
  images?: Image[];
  /** Callback when navigating to a different image */
  onNavigate?: (image: Image) => void;
}

/**
 * ImageDetailModal - Shows image details with focus point preview and editing
 */
export const ImageDetailModal: React.FC<ImageDetailModalProps> = ({
  image,
  open,
  onOpenChange,
  onImageUpdate,
  albums = [],
  images = [],
  onNavigate,
}) => {
  const [isEditingFocus, setIsEditingFocus] = useState(false);
  const [pi3dDevice, setPi3dDevice] = useState<DisplayDevice | null>(null);
  const [isLoadingDevice, setIsLoadingDevice] = useState(false);

  // Calculate current index and navigation state
  const currentIndex = useMemo(() => {
    if (!image || images.length === 0) return -1;
    return images.findIndex((img) => img.id === image.id);
  }, [image, images]);

  const canNavigatePrevious = currentIndex > 0;
  const canNavigateNext = currentIndex >= 0 && currentIndex < images.length - 1;

  const handlePrevious = useCallback(() => {
    if (canNavigatePrevious && onNavigate) {
      onNavigate(images[currentIndex - 1]);
    }
  }, [canNavigatePrevious, currentIndex, images, onNavigate]);

  const handleNext = useCallback(() => {
    if (canNavigateNext && onNavigate) {
      onNavigate(images[currentIndex + 1]);
    }
  }, [canNavigateNext, currentIndex, images, onNavigate]);

  // Keyboard navigation
  useEffect(() => {
    if (!open || isEditingFocus) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, isEditingFocus, handlePrevious, handleNext]);

  // Fetch first Pi3D device for crop preview calculation
  useEffect(() => {
    const fetchPi3dDevice = async () => {
      if (!open) return;
      setIsLoadingDevice(true);
      try {
        const response = await apiService.getDevices();
        const devices = response.data || [];
        const pi3d = devices.find((d: DisplayDevice) => d.device_type === 'pi3d');
        setPi3dDevice(pi3d || null);
      } catch (error) {
        console.error('Failed to fetch devices:', error);
      } finally {
        setIsLoadingDevice(false);
      }
    };
    fetchPi3dDevice();
  }, [open]);

  // Reset editing state when modal closes
  useEffect(() => {
    if (!open) {
      setIsEditingFocus(false);
    }
  }, [open]);

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const albumName = useMemo(() => {
    if (!image?.album_id) return null;
    const album = albums.find((a) => a.id === image.album_id);
    return album?.name || `Album ${image.album_id}`;
  }, [image?.album_id, albums]);

  const focusX = image?.focus_x ?? 0.5;
  const focusY = image?.focus_y ?? 0.5;

  const handleViewFullSize = () => {
    if (image?.url) {
      window.open(image.url, '_blank');
    }
  };

  const handleFocusSave = async (newFocusX: number, newFocusY: number) => {
    if (!image) return;

    try {
      const response = await apiService.updateImage(image.id, {
        focus_x: newFocusX,
        focus_y: newFocusY,
      });

      if (response.data && onImageUpdate) {
        onImageUpdate(response.data);
      }
      setIsEditingFocus(false);
    } catch (error) {
      console.error('Failed to update focus point:', error);
      throw error;
    }
  };

  if (!image) return null;

  // Determine if image is landscape (will be stacked on portrait display)
  const isLandscape = (image.width || 0) > (image.height || 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="truncate flex-1">
              {image.original_filename || image.filename}
            </DialogTitle>
            {/* Navigation controls */}
            {images.length > 1 && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePrevious}
                  disabled={!canNavigatePrevious}
                  className="h-8 w-8"
                  title="Previous image (←)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground min-w-[60px] text-center">
                  {currentIndex + 1} / {images.length}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNext}
                  disabled={!canNavigateNext}
                  className="h-8 w-8"
                  title="Next image (→)"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isEditingFocus ? (
            <FocusPointEditor
              image={image}
              initialFocusX={focusX}
              initialFocusY={focusY}
              deviceWidth={pi3dDevice?.screen_width || 2160}
              deviceHeight={pi3dDevice?.screen_height || 3840}
              isStacked={isLandscape}
              onSave={handleFocusSave}
              onCancel={() => setIsEditingFocus(false)}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4">
              {/* Image Preview */}
              <div className="relative bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                <div className="aspect-[4/3] relative">
                  <img
                    src={image.url}
                    alt={image.original_filename || image.filename}
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                  {/* Focus point indicator */}
                  <div
                    className="absolute w-6 h-6 -ml-3 -mt-3 pointer-events-none z-10"
                    style={{
                      left: `${focusX * 100}%`,
                      top: `${focusY * 100}%`,
                    }}
                  >
                    <div className="w-full h-full rounded-full border-2 border-white shadow-lg bg-blue-500/50 flex items-center justify-center">
                      <Target className="w-3 h-3 text-white" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Image Details */}
              <div className="space-y-4">
                <div className="space-y-3">
                  {/* Dimensions */}
                  <div className="flex items-center gap-3 text-sm">
                    <Maximize2 className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-600 dark:text-gray-400">Dimensions:</span>
                    <span className="font-medium">
                      {image.width && image.height
                        ? `${image.width} x ${image.height}`
                        : 'Unknown'}
                    </span>
                    {isLandscape && (
                      <Badge variant="secondary" className="ml-2">
                        Landscape
                      </Badge>
                    )}
                    {!isLandscape && image.width && image.height && (
                      <Badge variant="secondary" className="ml-2">
                        Portrait
                      </Badge>
                    )}
                  </div>

                  {/* File Size */}
                  <div className="flex items-center gap-3 text-sm">
                    <HardDrive className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-600 dark:text-gray-400">File Size:</span>
                    <span className="font-medium">{formatFileSize(image.file_size)}</span>
                  </div>

                  {/* Upload Date */}
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-600 dark:text-gray-400">Uploaded:</span>
                    <span className="font-medium">{formatDate(image.uploaded_at)}</span>
                  </div>

                  {/* Album */}
                  {albumName && (
                    <div className="flex items-center gap-3 text-sm">
                      <FolderOpen className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-600 dark:text-gray-400">Album:</span>
                      <span className="font-medium">{albumName}</span>
                    </div>
                  )}

                  {/* Focus Point */}
                  <div className="flex items-center gap-3 text-sm">
                    <Target className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-600 dark:text-gray-400">Focus Point:</span>
                    <span className="font-medium font-mono">
                      ({focusX.toFixed(2)}, {focusY.toFixed(2)})
                    </span>
                  </div>

                  {/* MIME Type */}
                  <div className="flex items-center gap-3 text-sm">
                    <ImageIcon className="w-4 h-4 text-gray-500" />
                    <span className="text-gray-600 dark:text-gray-400">Type:</span>
                    <span className="font-medium">{image.mime_type || 'Unknown'}</span>
                  </div>
                </div>

                {/* Display Info */}
                {pi3dDevice && (
                  <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Display Preview
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">{pi3dDevice.device_name || 'Pi3D Display'}</span>
                      <span className="text-gray-500 ml-2">
                        ({pi3dDevice.screen_width} x {pi3dDevice.screen_height})
                      </span>
                    </div>
                    {isLandscape && (
                      <div className="text-xs text-gray-500 mt-1">
                        Will be stacked (half height: {Math.floor((pi3dDevice.screen_height || 3840) / 2)}px)
                      </div>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={handleViewFullSize}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View Full Size
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => setIsEditingFocus(true)}
                    className="flex items-center gap-2"
                    disabled={!image.width || !image.height}
                  >
                    <Target className="w-4 h-4" />
                    Edit Focus
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ImageDetailModal;
