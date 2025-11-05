import { useEffect, useRef, useCallback } from 'react';
import Hammer from 'hammerjs';

export interface TouchGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onTap?: () => void;
  onDoubleTap?: () => void;
  onLongPress?: () => void;
  onPinch?: (scale: number) => void;
  onPan?: (deltaX: number, deltaY: number) => void;
  threshold?: number;
  velocity?: number;
  enableSwipe?: boolean;
  enableTap?: boolean;
  enablePinch?: boolean;
  enablePan?: boolean;
}

export const useTouchGestures = (
  elementRef: React.RefObject<HTMLElement>,
  options: TouchGestureOptions = {}
) => {
  const hammerRef = useRef<HammerManager | null>(null);
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onTap,
    onDoubleTap,
    onLongPress,
    onPinch,
    onPan,
    threshold = 10,
    velocity = 0.3,
    enableSwipe = true,
    enableTap = true,
    enablePinch = false,
    enablePan = false,
  } = options;

  const handleSwipe = useCallback((event: HammerInput) => {
    const direction = event.direction;
    const velocity = event.velocity;
    
    // Only trigger if velocity is above threshold
    if (Math.abs(velocity) < 0.3) return;

    switch (direction) {
      case Hammer.DIRECTION_LEFT:
        onSwipeLeft?.();
        break;
      case Hammer.DIRECTION_RIGHT:
        onSwipeRight?.();
        break;
      case Hammer.DIRECTION_UP:
        onSwipeUp?.();
        break;
      case Hammer.DIRECTION_DOWN:
        onSwipeDown?.();
        break;
    }
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

  const handleTap = useCallback((event: HammerInput) => {
    onTap?.();
  }, [onTap]);

  const handleDoubleTap = useCallback((event: HammerInput) => {
    onDoubleTap?.();
  }, [onDoubleTap]);

  const handleLongPress = useCallback((event: HammerInput) => {
    onLongPress?.();
  }, [onLongPress]);

  const handlePinch = useCallback((event: HammerInput) => {
    onPinch?.(event.scale);
  }, [onPinch]);

  const handlePan = useCallback((event: HammerInput) => {
    onPan?.(event.deltaX, event.deltaY);
  }, [onPan]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // Initialize Hammer.js
    const hammer = new Hammer(element);
    hammerRef.current = hammer;

    // Configure recognizers
    if (enableSwipe) {
      hammer.get('swipe').set({
        direction: Hammer.DIRECTION_ALL,
        threshold,
        velocity,
      });
      hammer.on('swipe', handleSwipe);
    }

    if (enableTap) {
      hammer.get('tap').set({
        time: 250,
        threshold: 9,
      });
      hammer.on('tap', handleTap);
      hammer.on('doubletap', handleDoubleTap);
    }

    if (enableTap) {
      hammer.get('press').set({
        time: 500,
        threshold: 9,
      });
      hammer.on('press', handleLongPress);
    }

    if (enablePinch) {
      hammer.get('pinch').set({
        enable: true,
      });
      hammer.on('pinch', handlePinch);
    }

    if (enablePan) {
      hammer.get('pan').set({
        direction: Hammer.DIRECTION_ALL,
        threshold: 10,
      });
      hammer.on('pan', handlePan);
    }

    // Cleanup
    return () => {
      if (hammerRef.current) {
        hammerRef.current.destroy();
        hammerRef.current = null;
      }
    };
  }, [
    elementRef,
    enableSwipe,
    enableTap,
    enablePinch,
    enablePan,
    threshold,
    velocity,
    handleSwipe,
    handleTap,
    handleDoubleTap,
    handleLongPress,
    handlePinch,
    handlePan,
  ]);

  return {
    hammer: hammerRef.current,
  };
};

export default useTouchGestures;





