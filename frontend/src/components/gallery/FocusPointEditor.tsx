import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Image } from '@/types';
import { Save, X, RotateCcw, Move } from 'lucide-react';

interface FocusPointEditorProps {
  image: Image;
  initialFocusX: number;
  initialFocusY: number;
  deviceWidth: number;
  deviceHeight: number;
  isStacked: boolean;
  onSave: (focusX: number, focusY: number) => Promise<void>;
  onCancel: () => void;
}

interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * FocusPointEditor - Draggable crop box for adjusting image focus point
 */
export const FocusPointEditor: React.FC<FocusPointEditorProps> = ({
  image,
  initialFocusX,
  initialFocusY,
  deviceWidth,
  deviceHeight,
  isStacked,
  onSave,
  onCancel,
}) => {
  const [focusX, setFocusX] = useState(initialFocusX);
  const [focusY, setFocusY] = useState(initialFocusY);
  const [isDragging, setIsDragging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const imageWidth = image.width || 1;
  const imageHeight = image.height || 1;

  // Calculate target display dimensions (what portion of screen the image fills)
  const targetHeight = isStacked ? deviceHeight / 2 : deviceHeight;
  const targetAspect = deviceWidth / targetHeight;

  // Calculate crop box dimensions in image space
  const calculateCropDimensions = useCallback(() => {
    const imageAspect = imageWidth / imageHeight;

    let cropWidth: number;
    let cropHeight: number;

    if (imageAspect > targetAspect) {
      // Image is wider than target - need to crop width
      cropHeight = imageHeight;
      cropWidth = cropHeight * targetAspect;
    } else {
      // Image is taller than target - need to crop height
      cropWidth = imageWidth;
      cropHeight = cropWidth / targetAspect;
    }

    return { cropWidth, cropHeight };
  }, [imageWidth, imageHeight, targetAspect]);

  // Calculate crop box position based on focus point
  const calculateCropBox = useCallback((): CropBox => {
    const { cropWidth, cropHeight } = calculateCropDimensions();

    // Maximum offset (how far the crop box can move)
    const maxX = imageWidth - cropWidth;
    const maxY = imageHeight - cropHeight;

    // Position based on focus point (0-1 maps to 0-maxOffset)
    const x = focusX * maxX;
    const y = focusY * maxY;

    return { x, y, width: cropWidth, height: cropHeight };
  }, [focusX, focusY, imageWidth, imageHeight, calculateCropDimensions]);

  // Convert crop box from image space to display space
  const getDisplayCropBox = useCallback(() => {
    if (!imageRef.current || !containerRef.current) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const imgRect = imageRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    // Image's display dimensions (may be letterboxed)
    const displayedWidth = imgRect.width;
    const displayedHeight = imgRect.height;

    // Scale factor from image space to display space
    const scaleX = displayedWidth / imageWidth;
    const scaleY = displayedHeight / imageHeight;

    // Image offset within container (for letterboxing)
    const offsetX = imgRect.left - containerRect.left;
    const offsetY = imgRect.top - containerRect.top;

    const cropBox = calculateCropBox();

    return {
      x: offsetX + cropBox.x * scaleX,
      y: offsetY + cropBox.y * scaleY,
      width: cropBox.width * scaleX,
      height: cropBox.height * scaleY,
    };
  }, [imageWidth, imageHeight, calculateCropBox]);

  // Handle mouse/touch drag
  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragMove = useCallback(
    (clientX: number, clientY: number) => {
      if (!isDragging || !imageRef.current || !containerRef.current) return;

      const imgRect = imageRef.current.getBoundingClientRect();
      const { cropWidth, cropHeight } = calculateCropDimensions();

      // Calculate position relative to image
      const relX = clientX - imgRect.left;
      const relY = clientY - imgRect.top;

      // Scale to image coordinates
      const scaleX = imageWidth / imgRect.width;
      const scaleY = imageHeight / imgRect.height;

      const imgX = relX * scaleX;
      const imgY = relY * scaleY;

      // Calculate new focus point (center of crop box at click position)
      const maxX = imageWidth - cropWidth;
      const maxY = imageHeight - cropHeight;

      // Adjust so the click is at center of crop box
      const cropCenterX = imgX;
      const cropCenterY = imgY;

      // Convert center position to top-left position
      const cropX = cropCenterX - cropWidth / 2;
      const cropY = cropCenterY - cropHeight / 2;

      // Clamp to valid range and convert to 0-1 focus point
      const clampedX = Math.max(0, Math.min(maxX, cropX));
      const clampedY = Math.max(0, Math.min(maxY, cropY));

      const newFocusX = maxX > 0 ? clampedX / maxX : 0.5;
      const newFocusY = maxY > 0 ? clampedY / maxY : 0.5;

      setFocusX(newFocusX);
      setFocusY(newFocusY);
    },
    [isDragging, imageWidth, imageHeight, calculateCropDimensions]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Mouse events
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      handleDragMove(e.clientX, e.clientY);
    },
    [handleDragMove]
  );

  // Touch events
  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (e.touches.length === 1) {
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    },
    [handleDragMove]
  );

  // Add/remove global event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleDragEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, handleMouseMove, handleTouchMove, handleDragEnd]);

  // Update container size on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerSize({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [imageLoaded]);

  const handleReset = () => {
    setFocusX(initialFocusX);
    setFocusY(initialFocusY);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(focusX, focusY);
    } catch (error) {
      console.error('Failed to save focus point:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const displayCropBox = getDisplayCropBox();
  const hasChanged = focusX !== initialFocusX || focusY !== initialFocusY;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-4">
        <div>
          <h3 className="text-lg font-semibold">Edit Focus Point</h3>
          <p className="text-sm text-gray-500">
            Drag the visible area to adjust where the image is cropped
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono">
            ({focusX.toFixed(2)}, {focusY.toFixed(2)})
          </Badge>
        </div>
      </div>

      {/* Image with crop overlay */}
      <div
        ref={containerRef}
        className="relative flex-1 bg-gray-900 rounded-lg overflow-hidden cursor-move mx-4"
        style={{ minHeight: '300px' }}
      >
        {/* Full image (dimmed) */}
        <img
          ref={imageRef}
          src={image.url}
          alt={image.original_filename || image.filename}
          className="w-full h-full object-contain select-none"
          draggable={false}
          onLoad={() => setImageLoaded(true)}
        />

        {/* Dark overlay for non-visible area */}
        {imageLoaded && (
          <>
            {/* Semi-transparent overlay covering the whole image */}
            <div
              className="absolute inset-0 bg-black/60 pointer-events-none"
              style={{
                clipPath: `polygon(
                  0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
                  ${displayCropBox.x}px ${displayCropBox.y}px,
                  ${displayCropBox.x}px ${displayCropBox.y + displayCropBox.height}px,
                  ${displayCropBox.x + displayCropBox.width}px ${displayCropBox.y + displayCropBox.height}px,
                  ${displayCropBox.x + displayCropBox.width}px ${displayCropBox.y}px,
                  ${displayCropBox.x}px ${displayCropBox.y}px
                )`,
              }}
            />

            {/* Visible area (crop box) */}
            <div
              className="absolute border-2 border-white shadow-lg cursor-move"
              style={{
                left: displayCropBox.x,
                top: displayCropBox.y,
                width: displayCropBox.width,
                height: displayCropBox.height,
              }}
              onMouseDown={handleDragStart}
              onTouchStart={handleDragStart}
            >
              {/* Drag handle indicator */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-white/90 rounded-full p-2 shadow-lg">
                  <Move className="w-5 h-5 text-gray-700" />
                </div>
              </div>

              {/* Corner indicators */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-white" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-white" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-white" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-white" />
            </div>
          </>
        )}
      </div>

      {/* Info and actions */}
      <div className="mt-4 px-4 pb-4">
        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
          <div>
            Display: {deviceWidth} x {Math.floor(targetHeight)}
            {isStacked && <span className="ml-2">(stacked mode)</span>}
          </div>
          <div>
            Image: {imageWidth} x {imageHeight}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={handleReset} disabled={!hasChanged || isSaving}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset
          </Button>
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Focus'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FocusPointEditor;
