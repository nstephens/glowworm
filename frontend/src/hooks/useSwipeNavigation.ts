import { useState, useRef, useCallback } from 'react';

interface UseSwipeNavigationOptions {
  imageCount: number;
  currentIndex: number;
  onChange: (index: number) => void;
  enableSwipe?: boolean;
  hapticFeedback?: boolean;
  threshold?: number;
  velocity?: number;
}

interface SwipeState {
  isSwiping: boolean;
  swipeOffset: number;
}

export const useSwipeNavigation = (options: UseSwipeNavigationOptions) => {
  const {
    imageCount,
    currentIndex,
    onChange,
    enableSwipe = true,
    hapticFeedback = true,
    threshold = 50,
    velocity = 0.3,
  } = options;

  const [state, setState] = useState<SwipeState>({
    isSwiping: false,
    swipeOffset: 0,
  });

  const startXRef = useRef<number | null>(null);
  const startYRef = useRef<number | null>(null);
  const lastXRef = useRef<number | null>(null);
  const lastYRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const triggerHapticFeedback = useCallback(() => {
    if (hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }
  }, [hapticFeedback]);

  const goToNext = useCallback(() => {
    if (currentIndex < imageCount - 1) {
      triggerHapticFeedback();
      onChange(currentIndex + 1);
    }
  }, [currentIndex, imageCount, onChange, triggerHapticFeedback]);

  const goToPrevious = useCallback(() => {
    if (currentIndex > 0) {
      triggerHapticFeedback();
      onChange(currentIndex - 1);
    }
  }, [currentIndex, onChange, triggerHapticFeedback]);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (!enableSwipe || event.touches.length !== 1) return;

    const touch = event.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    lastXRef.current = touch.clientX;
    lastYRef.current = touch.clientY;
    startTimeRef.current = Date.now();

    setState(prev => ({ ...prev, isSwiping: true, swipeOffset: 0 }));
  }, [enableSwipe]);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (!enableSwipe || !state.isSwiping || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - (startXRef.current || 0);
    const deltaY = touch.clientY - (startYRef.current || 0);

    // Determine if this is a horizontal or vertical swipe
    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
    
    if (isHorizontalSwipe) {
      // Prevent vertical scrolling during horizontal swipe
      event.preventDefault();
      
      setState(prev => ({
        ...prev,
        swipeOffset: deltaX,
      }));
    }

    lastXRef.current = touch.clientX;
    lastYRef.current = touch.clientY;
  }, [enableSwipe, state.isSwiping]);

  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    if (!enableSwipe || !state.isSwiping) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - (startXRef.current || 0);
    const deltaY = touch.clientY - (startYRef.current || 0);
    const deltaTime = Date.now() - (startTimeRef.current || 0);
    
    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
    const swipeVelocity = Math.abs(deltaX) / deltaTime;
    
    if (isHorizontalSwipe) {
      // Check if swipe meets threshold or velocity requirements
      const shouldSwipe = Math.abs(deltaX) > threshold || swipeVelocity > velocity;
      
      if (shouldSwipe) {
        if (deltaX > 0) {
          // Swipe right - go to previous image
          goToPrevious();
        } else {
          // Swipe left - go to next image
          goToNext();
        }
      }
    }

    // Reset state
    setState({
      isSwiping: false,
      swipeOffset: 0,
    });
    
    startXRef.current = null;
    startYRef.current = null;
    lastXRef.current = null;
    lastYRef.current = null;
    startTimeRef.current = null;
  }, [enableSwipe, state.isSwiping, threshold, velocity, goToNext, goToPrevious]);

  return {
    ...state,
    goToNext,
    goToPrevious,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
};

export default useSwipeNavigation;