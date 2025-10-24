import { useRef, useEffect, useCallback } from 'react';

interface SwipeOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  velocityThreshold?: number;
  preventDefaultTouchmoveEvent?: boolean;
  trackMouse?: boolean;
}

interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

export function useSwipeGesture(options: SwipeOptions) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    velocityThreshold = 0.3,
    preventDefaultTouchmoveEvent = false,
    trackMouse = false,
  } = options;

  const touchStart = useRef<TouchPoint | null>(null);
  const touchEnd = useRef<TouchPoint | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  const calculateVelocity = useCallback((start: TouchPoint, end: TouchPoint): number => {
    const distance = Math.sqrt(
      Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
    );
    const time = end.time - start.time;
    return time > 0 ? distance / time : 0;
  }, []);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length !== 1) return; // Only handle single touch
    
    const touch = e.touches[0];
    touchStart.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    touchEnd.current = null;
  }, []);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (preventDefaultTouchmoveEvent) {
      e.preventDefault();
    }
  }, [preventDefaultTouchmoveEvent]);

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (!touchStart.current || e.changedTouches.length !== 1) return;
    
    const touch = e.changedTouches[0];
    touchEnd.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };

    if (!touchEnd.current) return;

    const deltaX = touchStart.current.x - touchEnd.current.x;
    const deltaY = touchStart.current.y - touchEnd.current.y;
    const velocity = calculateVelocity(touchStart.current, touchEnd.current);

    // Check if velocity meets threshold
    if (velocity < velocityThreshold) return;

    // Determine swipe direction based on greater delta
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Horizontal swipe
      if (deltaX > threshold) {
        onSwipeLeft?.();
      } else if (deltaX < -threshold) {
        onSwipeRight?.();
      }
    } else {
      // Vertical swipe
      if (deltaY > threshold) {
        onSwipeUp?.();
      } else if (deltaY < -threshold) {
        onSwipeDown?.();
      }
    }

    // Reset touch points
    touchStart.current = null;
    touchEnd.current = null;
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold, calculateVelocity, velocityThreshold]);

  // Mouse events for desktop testing
  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (!trackMouse) return;
    
    touchStart.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
    };
    touchEnd.current = null;
  }, [trackMouse]);

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!trackMouse || !touchStart.current) return;
    
    touchEnd.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
    };

    if (!touchEnd.current) return;

    const deltaX = touchStart.current.x - touchEnd.current.x;
    const deltaY = touchStart.current.y - touchEnd.current.y;
    const velocity = calculateVelocity(touchStart.current, touchEnd.current);

    if (velocity < velocityThreshold) return;

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      if (deltaX > threshold) {
        onSwipeLeft?.();
      } else if (deltaX < -threshold) {
        onSwipeRight?.();
      }
    } else {
      if (deltaY > threshold) {
        onSwipeUp?.();
      } else if (deltaY < -threshold) {
        onSwipeDown?.();
      }
    }

    touchStart.current = null;
    touchEnd.current = null;
  }, [trackMouse, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold, calculateVelocity, velocityThreshold]);

  const attachSwipeListeners = useCallback((element: HTMLElement) => {
    elementRef.current = element;
    
    element.addEventListener('touchstart', handleTouchStart, { passive: !preventDefaultTouchmoveEvent });
    element.addEventListener('touchmove', handleTouchMove, { passive: !preventDefaultTouchmoveEvent });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });
    
    if (trackMouse) {
      element.addEventListener('mousedown', handleMouseDown, { passive: true });
      element.addEventListener('mouseup', handleMouseUp, { passive: true });
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleMouseDown, handleMouseUp, preventDefaultTouchmoveEvent, trackMouse]);

  const detachSwipeListeners = useCallback(() => {
    if (!elementRef.current) return;
    
    elementRef.current.removeEventListener('touchstart', handleTouchStart);
    elementRef.current.removeEventListener('touchmove', handleTouchMove);
    elementRef.current.removeEventListener('touchend', handleTouchEnd);
    
    if (trackMouse) {
      elementRef.current.removeEventListener('mousedown', handleMouseDown);
      elementRef.current.removeEventListener('mouseup', handleMouseUp);
    }
    
    elementRef.current = null;
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, handleMouseDown, handleMouseUp, trackMouse]);

  useEffect(() => {
    return () => {
      detachSwipeListeners();
    };
  }, [detachSwipeListeners]);

  return {
    attachSwipeListeners,
    detachSwipeListeners,
  };
}
