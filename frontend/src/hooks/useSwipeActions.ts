import { useState, useRef, useCallback } from 'react';
import { useSwipeable } from 'react-swipeable';

interface UseSwipeActionsOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  preventScrollOnSwipe?: boolean;
  trackMouse?: boolean;
  enableHapticFeedback?: boolean;
}

interface SwipeState {
  isSwipeActive: boolean;
  swipeOffset: number;
  swipeDirection: 'left' | 'right' | 'up' | 'down' | null;
  swipeProgress: number;
}

export const useSwipeActions = (options: UseSwipeActionsOptions = {}) => {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    preventScrollOnSwipe = true,
    trackMouse = true,
    enableHapticFeedback = true,
  } = options;

  const [swipeState, setSwipeState] = useState<SwipeState>({
    isSwipeActive: false,
    swipeOffset: 0,
    swipeDirection: null,
    swipeProgress: 0,
  });

  const containerRef = useRef<HTMLDivElement>(null);

  const triggerHapticFeedback = useCallback(() => {
    if (enableHapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(50); // Short vibration
    }
  }, [enableHapticFeedback]);

  const handleSwipeStart = useCallback(() => {
    setSwipeState(prev => ({
      ...prev,
      isSwipeActive: true,
      swipeOffset: 0,
      swipeDirection: null,
      swipeProgress: 0,
    }));
  }, []);

  const handleSwipeMove = useCallback((deltaX: number, deltaY: number) => {
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    
    // Determine primary direction
    let direction: 'left' | 'right' | 'up' | 'down' | null = null;
    let progress = 0;
    
    if (absDeltaX > absDeltaY) {
      // Horizontal swipe
      if (absDeltaX > 20) {
        direction = deltaX > 0 ? 'right' : 'left';
        progress = Math.min(absDeltaX / threshold, 1);
      }
    } else {
      // Vertical swipe
      if (absDeltaY > 20) {
        direction = deltaY > 0 ? 'down' : 'up';
        progress = Math.min(absDeltaY / threshold, 1);
      }
    }

    setSwipeState(prev => ({
      ...prev,
      swipeOffset: absDeltaX > absDeltaY ? deltaX : deltaY,
      swipeDirection: direction,
      swipeProgress: progress,
    }));
  }, [threshold]);

  const handleSwipeEnd = useCallback(() => {
    setSwipeState(prev => ({
      ...prev,
      isSwipeActive: false,
      swipeOffset: 0,
      swipeDirection: null,
      swipeProgress: 0,
    }));
  }, []);

  const handleSwipeLeft = useCallback(() => {
    triggerHapticFeedback();
    onSwipeLeft?.();
  }, [onSwipeLeft, triggerHapticFeedback]);

  const handleSwipeRight = useCallback(() => {
    triggerHapticFeedback();
    onSwipeRight?.();
  }, [onSwipeRight, triggerHapticFeedback]);

  const handleSwipeUp = useCallback(() => {
    triggerHapticFeedback();
    onSwipeUp?.();
  }, [onSwipeUp, triggerHapticFeedback]);

  const handleSwipeDown = useCallback(() => {
    triggerHapticFeedback();
    onSwipeDown?.();
  }, [onSwipeDown, triggerHapticFeedback]);

  const swipeHandlers = useSwipeable({
    onSwipeStart: handleSwipeStart,
    onSwiping: (eventData) => handleSwipeMove(eventData.deltaX, eventData.deltaY),
    onSwipeEnd: handleSwipeEnd,
    onSwipedLeft: handleSwipeLeft,
    onSwipedRight: handleSwipeRight,
    onSwipedUp: handleSwipeUp,
    onSwipedDown: handleSwipeDown,
    trackMouse,
    preventScrollOnSwipe,
    delta: threshold,
  });

  const resetSwipe = useCallback(() => {
    setSwipeState({
      isSwipeActive: false,
      swipeOffset: 0,
      swipeDirection: null,
      swipeProgress: 0,
    });
  }, []);

  return {
    ...swipeState,
    containerRef,
    swipeHandlers,
    resetSwipe,
  };
};

export default useSwipeActions;








