import { useState, useCallback, useRef, useEffect } from 'react';

interface UseTouchSelectionOptions {
  /** Whether multi-select is enabled */
  multiSelect?: boolean;
  /** Whether long-press selection is enabled */
  longPressSelection?: boolean;
  /** Duration for long-press in milliseconds */
  longPressDelay?: number;
  /** Whether to enable haptic feedback */
  hapticFeedback?: boolean;
  /** Callback when selection changes */
  onSelectionChange?: (selectedIds: Set<number>) => void;
  /** Callback when an item is selected */
  onItemSelect?: (id: number, selected: boolean) => void;
}

interface UseTouchSelectionReturn {
  /** Currently selected item IDs */
  selectedIds: Set<number>;
  /** Whether an item is selected */
  isSelected: (id: number) => boolean;
  /** Toggle selection of an item */
  toggleSelection: (id: number, event?: React.MouseEvent | React.TouchEvent) => void;
  /** Select a single item (clears others) */
  selectItem: (id: number, event?: React.MouseEvent | React.TouchEvent) => void;
  /** Select multiple items */
  selectItems: (ids: number[]) => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Select all items */
  selectAll: (allIds: number[]) => void;
  /** Get selected count */
  selectedCount: number;
  /** Whether any items are selected */
  hasSelection: boolean;
  /** Touch event handlers */
  touchHandlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
  };
  /** Mouse event handlers */
  mouseHandlers: {
    onClick: (e: React.MouseEvent) => void;
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseUp: (e: React.MouseEvent) => void;
  };
}

/**
 * Custom hook for touch-optimized image selection
 * 
 * Features:
 * - Multi-select with Ctrl/Cmd key
 * - Long-press selection
 * - Haptic feedback
 * - Touch and mouse support
 * - Visual feedback
 */
export const useTouchSelection = ({
  multiSelect = true,
  longPressSelection = true,
  longPressDelay = 500,
  hapticFeedback = true,
  onSelectionChange,
  onItemSelect
}: UseTouchSelectionOptions = {}): UseTouchSelectionReturn => {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [touchStartTime, setTouchStartTime] = useState<number>(0);
  const [touchStartPosition, setTouchStartPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartRef = useRef<{ time: number; position: { x: number; y: number } } | null>(null);

  // Haptic feedback function
  const triggerHapticFeedback = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!hapticFeedback || !navigator.vibrate) return;
    
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30, 10, 30]
    };
    
    navigator.vibrate(patterns[type]);
  }, [hapticFeedback]);

  // Update selection and notify callbacks
  const updateSelection = useCallback((newSelection: Set<number>) => {
    setSelectedIds(newSelection);
    onSelectionChange?.(newSelection);
  }, [onSelectionChange]);

  // Toggle selection of an item
  const toggleSelection = useCallback((id: number, event?: React.MouseEvent | React.TouchEvent) => {
    const isMultiSelect = multiSelect && (
      event?.type === 'click' ? 
        (event as React.MouseEvent).ctrlKey || (event as React.MouseEvent).metaKey :
        false
    );

    setSelectedIds(prev => {
      const newSelection = new Set(prev);
      
      if (newSelection.has(id)) {
        newSelection.delete(id);
        onItemSelect?.(id, false);
      } else {
        if (!isMultiSelect) {
          newSelection.clear();
        }
        newSelection.add(id);
        onItemSelect?.(id, true);
      }
      
      updateSelection(newSelection);
      return newSelection;
    });

    triggerHapticFeedback('light');
  }, [multiSelect, onItemSelect, updateSelection, triggerHapticFeedback]);

  // Select a single item (clears others)
  const selectItem = useCallback((id: number, event?: React.MouseEvent | React.TouchEvent) => {
    const newSelection = new Set([id]);
    setSelectedIds(newSelection);
    onItemSelect?.(id, true);
    updateSelection(newSelection);
    triggerHapticFeedback('medium');
  }, [onItemSelect, updateSelection, triggerHapticFeedback]);

  // Select multiple items
  const selectItems = useCallback((ids: number[]) => {
    const newSelection = new Set(ids);
    setSelectedIds(newSelection);
    updateSelection(newSelection);
    triggerHapticFeedback('medium');
  }, [updateSelection, triggerHapticFeedback]);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    updateSelection(new Set());
    triggerHapticFeedback('light');
  }, [updateSelection, triggerHapticFeedback]);

  // Select all items
  const selectAll = useCallback((allIds: number[]) => {
    const newSelection = new Set(allIds);
    setSelectedIds(newSelection);
    updateSelection(newSelection);
    triggerHapticFeedback('heavy');
  }, [updateSelection, triggerHapticFeedback]);

  // Check if an item is selected
  const isSelected = useCallback((id: number) => {
    return selectedIds.has(id);
  }, [selectedIds]);

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const now = Date.now();
    
    touchStartRef.current = {
      time: now,
      position: { x: touch.clientX, y: touch.clientY }
    };
    
    setTouchStartTime(now);
    setTouchStartPosition({ x: touch.clientX, y: touch.clientY });
    setIsDragging(false);

    // Start long-press timer
    if (longPressSelection) {
      longPressTimerRef.current = setTimeout(() => {
        setIsLongPressing(true);
        triggerHapticFeedback('medium');
      }, longPressDelay);
    }
  }, [longPressSelection, longPressDelay, triggerHapticFeedback]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.touches[0];
    const deltaX = Math.abs(touch.clientX - touchStartRef.current.position.x);
    const deltaY = Math.abs(touch.clientY - touchStartRef.current.position.y);
    
    // If moved more than 10px, consider it dragging
    if (deltaX > 10 || deltaY > 10) {
      setIsDragging(true);
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    const touchDuration = now - touchStartTime;
    
    // Clear long-press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    // Only trigger selection if it wasn't a drag and long-press completed
    if (!isDragging && isLongPressing) {
      const target = e.currentTarget as HTMLElement;
      const imageId = target.dataset.imageId;
      if (imageId) {
        toggleSelection(parseInt(imageId), e);
      }
    }

    // Reset states
    setIsLongPressing(false);
    setIsDragging(false);
    setTouchStartTime(0);
    setTouchStartPosition(null);
    touchStartRef.current = null;
  }, [touchStartTime, isDragging, isLongPressing, toggleSelection]);

  // Mouse event handlers
  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    const imageId = target.dataset.imageId;
    if (imageId) {
      toggleSelection(parseInt(imageId), e);
    }
  }, [toggleSelection]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Prevent text selection during mouse interactions
    e.preventDefault();
  }, []);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    // Handle mouse up if needed
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  return {
    selectedIds,
    isSelected,
    toggleSelection,
    selectItem,
    selectItems,
    clearSelection,
    selectAll,
    selectedCount: selectedIds.size,
    hasSelection: selectedIds.size > 0,
    touchHandlers: {
      onTouchStart: handleTouchStart,
      onTouchEnd: handleTouchEnd,
      onTouchMove: handleTouchMove,
    },
    mouseHandlers: {
      onClick: handleClick,
      onMouseDown: handleMouseDown,
      onMouseUp: handleMouseUp,
    }
  };
};

export default useTouchSelection;





