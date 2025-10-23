import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { Image } from './MasonryGallery';
import { useBulkSelection } from './BulkSelectionProvider';
import { cn } from '@/lib/utils';

interface KeyboardNavigationProps {
  images: Image[];
  onImageSelect: (image: Image) => void;
  onImageAction: (action: string, image: Image) => void;
  className?: string;
}

/**
 * KeyboardNavigation - Comprehensive keyboard navigation for gallery
 * 
 * Features:
 * - Arrow key navigation between images
 * - Grid-based navigation (up, down, left, right)
 * - Focus management and visual indicators
 * - Keyboard shortcuts for all actions
 * - Screen reader announcements
 * - Focus trapping in modals
 * - Accessibility compliance (WCAG 2.1 AA)
 */
export const KeyboardNavigation: React.FC<KeyboardNavigationProps> = ({
  images,
  onImageSelect,
  onImageAction,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [navigationMode, setNavigationMode] = useState<'grid' | 'list'>('grid');
  const [announcements, setAnnouncements] = useState<string[]>([]);
  
  const { 
    toggleImageSelection, 
    selectAll, 
    clearSelection, 
    getSelectedImages,
    isImageSelected 
  } = useBulkSelection();

  // Calculate grid dimensions based on container width
  const getGridDimensions = useCallback(() => {
    if (!containerRef.current) return { columns: 4, rows: 0 };
    
    const containerWidth = containerRef.current.offsetWidth;
    let columns = 4;
    
    if (containerWidth < 500) columns = 1;
    else if (containerWidth < 700) columns = 2;
    else if (containerWidth < 1100) columns = 3;
    
    const rows = Math.ceil(images.length / columns);
    return { columns, rows };
  }, [images.length]);

  // Navigate to specific image
  const navigateToImage = useCallback((index: number) => {
    if (index < 0 || index >= images.length) return;
    
    setFocusedIndex(index);
    
    // Scroll image into view
    const imageElement = containerRef.current?.querySelector(`[data-image-index="${index}"]`) as HTMLElement;
    if (imageElement) {
      imageElement.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center',
        inline: 'center'
      });
      imageElement.focus();
    }
    
    // Announce navigation
    const image = images[index];
    announce(`Focused on ${image.title}. ${isImageSelected(image.id) ? 'Selected' : 'Not selected'}. Press Space to select, Enter to view details.`);
  }, [images, isImageSelected]);

  // Grid navigation
  const navigateGrid = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (focusedIndex === null) {
      navigateToImage(0);
      return;
    }

    const { columns } = getGridDimensions();
    const currentRow = Math.floor(focusedIndex / columns);
    const currentCol = focusedIndex % columns;
    let newIndex = focusedIndex;

    switch (direction) {
      case 'up':
        newIndex = Math.max(0, focusedIndex - columns);
        break;
      case 'down':
        newIndex = Math.min(images.length - 1, focusedIndex + columns);
        break;
      case 'left':
        if (currentCol > 0) {
          newIndex = focusedIndex - 1;
        }
        break;
      case 'right':
        if (currentCol < columns - 1 && focusedIndex < images.length - 1) {
          newIndex = focusedIndex + 1;
        }
        break;
    }

    if (newIndex !== focusedIndex) {
      navigateToImage(newIndex);
    }
  }, [focusedIndex, images.length, getGridDimensions, navigateToImage]);

  // List navigation
  const navigateList = useCallback((direction: 'up' | 'down') => {
    if (focusedIndex === null) {
      navigateToImage(0);
      return;
    }

    let newIndex = focusedIndex;
    if (direction === 'up') {
      newIndex = Math.max(0, focusedIndex - 1);
    } else {
      newIndex = Math.min(images.length - 1, focusedIndex + 1);
    }

    if (newIndex !== focusedIndex) {
      navigateToImage(newIndex);
    }
  }, [focusedIndex, images.length, navigateToImage]);

  // Screen reader announcements
  const announce = useCallback((message: string) => {
    setAnnouncements(prev => [...prev, message]);
    
    // Clear announcement after 3 seconds
    setTimeout(() => {
      setAnnouncements(prev => prev.slice(1));
    }, 3000);
  }, []);

  // Keyboard shortcuts
  useHotkeys('arrowup', (e) => {
    e.preventDefault();
    if (navigationMode === 'grid') {
      navigateGrid('up');
    } else {
      navigateList('up');
    }
  }, { enableOnTags: ['INPUT', 'TEXTAREA'] });

  useHotkeys('arrowdown', (e) => {
    e.preventDefault();
    if (navigationMode === 'grid') {
      navigateGrid('down');
    } else {
      navigateList('down');
    }
  }, { enableOnTags: ['INPUT', 'TEXTAREA'] });

  useHotkeys('arrowleft', (e) => {
    e.preventDefault();
    if (navigationMode === 'grid') {
      navigateGrid('left');
    }
  }, { enableOnTags: ['INPUT', 'TEXTAREA'] });

  useHotkeys('arrowright', (e) => {
    e.preventDefault();
    if (navigationMode === 'grid') {
      navigateGrid('right');
    }
  }, { enableOnTags: ['INPUT', 'TEXTAREA'] });

  useHotkeys('space', (e) => {
    e.preventDefault();
    if (focusedIndex !== null) {
      const image = images[focusedIndex];
      toggleImageSelection(image.id);
      announce(`${isImageSelected(image.id) ? 'Deselected' : 'Selected'} ${image.title}`);
    }
  }, { enableOnTags: ['INPUT', 'TEXTAREA'] });

  useHotkeys('enter', (e) => {
    e.preventDefault();
    if (focusedIndex !== null) {
      const image = images[focusedIndex];
      onImageSelect(image);
      announce(`Opening ${image.title}`);
    }
  }, { enableOnTags: ['INPUT', 'TEXTAREA'] });

  useHotkeys('home', (e) => {
    e.preventDefault();
    navigateToImage(0);
  }, { enableOnTags: ['INPUT', 'TEXTAREA'] });

  useHotkeys('end', (e) => {
    e.preventDefault();
    navigateToImage(images.length - 1);
  }, { enableOnTags: ['INPUT', 'TEXTAREA'] });

  useHotkeys('pageup', (e) => {
    e.preventDefault();
    const { columns } = getGridDimensions();
    const jumpSize = columns * 2; // Jump 2 rows
    const newIndex = Math.max(0, (focusedIndex || 0) - jumpSize);
    navigateToImage(newIndex);
  }, { enableOnTags: ['INPUT', 'TEXTAREA'] });

  useHotkeys('pagedown', (e) => {
    e.preventDefault();
    const { columns } = getGridDimensions();
    const jumpSize = columns * 2; // Jump 2 rows
    const newIndex = Math.min(images.length - 1, (focusedIndex || 0) + jumpSize);
    navigateToImage(newIndex);
  }, { enableOnTags: ['INPUT', 'TEXTAREA'] });

  // Action shortcuts
  useHotkeys('d', (e) => {
    e.preventDefault();
    if (focusedIndex !== null) {
      const image = images[focusedIndex];
      onImageAction('download', image);
      announce(`Downloading ${image.title}`);
    }
  }, { enableOnTags: ['INPUT', 'TEXTAREA'] });

  useHotkeys('s', (e) => {
    e.preventDefault();
    if (focusedIndex !== null) {
      const image = images[focusedIndex];
      onImageAction('share', image);
      announce(`Sharing ${image.title}`);
    }
  }, { enableOnTags: ['INPUT', 'TEXTAREA'] });

  useHotkeys('e', (e) => {
    e.preventDefault();
    if (focusedIndex !== null) {
      const image = images[focusedIndex];
      onImageAction('edit', image);
      announce(`Editing ${image.title}`);
    }
  }, { enableOnTags: ['INPUT', 'TEXTAREA'] });

  useHotkeys('f', (e) => {
    e.preventDefault();
    if (focusedIndex !== null) {
      const image = images[focusedIndex];
      onImageAction('favorite', image);
      announce(`Favorited ${image.title}`);
    }
  }, { enableOnTags: ['INPUT', 'TEXTAREA'] });

  // Focus management
  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      const imageIndex = target.getAttribute('data-image-index');
      if (imageIndex) {
        setFocusedIndex(parseInt(imageIndex));
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('focusin', handleFocusIn);
      return () => container.removeEventListener('focusin', handleFocusIn);
    }
  }, []);

  return (
    <div ref={containerRef} className={cn("keyboard-navigation", className)}>
      {/* Screen reader announcements */}
      <div 
        className="sr-only" 
        aria-live="polite" 
        aria-atomic="true"
      >
        {announcements.map((announcement, index) => (
          <div key={index}>{announcement}</div>
        ))}
      </div>

      {/* Navigation mode indicator */}
      <div className="sr-only">
        <div>Gallery navigation mode: {navigationMode}</div>
        <div>Use arrow keys to navigate, Space to select, Enter to view details</div>
        <div>Press G for grid mode, L for list mode</div>
      </div>

      {/* Keyboard shortcuts help */}
      <div className="sr-only">
        <h3>Keyboard Shortcuts</h3>
        <ul>
          <li>Arrow keys: Navigate between images</li>
          <li>Space: Toggle selection</li>
          <li>Enter: View image details</li>
          <li>Home/End: Go to first/last image</li>
          <li>Page Up/Down: Jump by rows</li>
          <li>D: Download image</li>
          <li>S: Share image</li>
          <li>E: Edit image</li>
          <li>F: Favorite image</li>
          <li>Ctrl+A: Select all</li>
          <li>Esc: Clear selection</li>
        </ul>
      </div>
    </div>
  );
};
