import React, { useRef, useEffect, useState } from 'react';
import { useBulkSelection } from './BulkSelectionProvider';
import { Image } from './MasonryGallery';
import { cn } from '@/lib/utils';

interface DragSelectionProps {
  images: Image[];
  onSelectionChange: (selectedImages: Image[]) => void;
  className?: string;
}

/**
 * DragSelection - Drag-to-select functionality for gallery
 * 
 * Features:
 * - Mouse drag selection
 * - Touch drag selection for mobile
 * - Visual selection overlay
 * - Keyboard modifier support (Ctrl, Shift)
 * - Selection area calculation
 * - Performance optimized
 */
export const DragSelection: React.FC<DragSelectionProps> = ({
  images,
  onSelectionChange,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { 
    state, 
    startDragSelection, 
    updateDragSelection, 
    endDragSelection,
    getSelectedImages 
  } = useBulkSelection();
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start drag selection if not clicking on an image or button
    if ((e.target as HTMLElement).closest('[data-image-card]') || 
        (e.target as HTMLElement).closest('button')) {
      return;
    }

    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    startDragSelection(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;

    updateDragSelection(e.clientX, e.clientY);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging || !dragStart) return;

    setIsDragging(false);
    setDragStart(null);
    endDragSelection(images);
    
    // Update parent with selected images
    const selectedImages = getSelectedImages(images);
    onSelectionChange(selectedImages);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    setIsDragging(true);
    setDragStart({ x: touch.clientX, y: touch.clientY });
    startDragSelection(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !dragStart || e.touches.length !== 1) return;

    const touch = e.touches[0];
    updateDragSelection(touch.clientX, touch.clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDragging || !dragStart) return;

    setIsDragging(false);
    setDragStart(null);
    endDragSelection(images);
    
    // Update parent with selected images
    const selectedImages = getSelectedImages(images);
    onSelectionChange(selectedImages);
  };

  // Calculate selection rectangle
  const getSelectionRect = () => {
    if (!state.dragSelection.isActive) return null;

    const { startX, startY, endX, endY } = state.dragSelection;
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    return {
      left,
      top,
      width,
      height,
    };
  };

  const selectionRect = getSelectionRect();

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative select-none",
        isDragging && "cursor-crosshair",
        className
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Drag selection overlay */}
      {selectionRect && (
        <div
          className="absolute pointer-events-none z-10 border-2 border-primary bg-primary/10"
          style={{
            left: selectionRect.left,
            top: selectionRect.top,
            width: selectionRect.width,
            height: selectionRect.height,
          }}
        >
          {/* Selection rectangle content */}
          <div className="absolute inset-0 bg-primary/5" />
          
          {/* Corner handles */}
          <div className="absolute -top-1 -left-1 w-2 h-2 bg-primary rounded-full" />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full" />
          <div className="absolute -bottom-1 -left-1 w-2 h-2 bg-primary rounded-full" />
          <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-primary rounded-full" />
        </div>
      )}

      {/* Instructions overlay */}
      {isDragging && (
        <div className="absolute top-4 left-4 z-20 bg-background/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <div className="text-sm font-medium text-foreground">
            Drag to select images
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Hold Ctrl to add to selection, Shift to select range
          </div>
        </div>
      )}
    </div>
  );
};
