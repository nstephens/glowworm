import { useCallback, useRef, useState } from 'react';
import { hapticPatterns } from '../utils/hapticFeedback';

export interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
  threshold?: number;
  velocity?: number;
  enableHaptic?: boolean;
  hapticType?: 'light' | 'medium' | 'heavy' | 'swipe';
  preventDefault?: boolean;
  stopPropagation?: boolean;
}

export interface SwipeState {
  isSwiping: boolean;
  direction: 'left' | 'right' | 'up' | 'down' | null;
  distance: number;
  velocity: number;
}

export function useSwipeGestures(options: SwipeGestureOptions = {}) {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onSwipeStart,
    onSwipeEnd,
    threshold = 50,
    velocity = 0.3,
    enableHaptic = true,
    hapticType = 'swipe',
    preventDefault = true,
    stopPropagation = false
  } = options;

  const [swipeState, setSwipeState] = useState<SwipeState>({
    isSwiping: false,
    direction: null,
    distance: 0,
    velocity: 0
  });

  const startPos = useRef<{ x: number; y: number; time: number } | null>(null);
  const currentPos = useRef<{ x: number; y: number; time: number } | null>(null);
  const elementRef = useRef<HTMLElement | null>(null);

  const getHapticPattern = () => {
    switch (hapticType) {
      case 'light': return () => hapticPatterns.light();
      case 'medium': return () => hapticPatterns.medium();
      case 'heavy': return () => hapticPatterns.heavy();
      case 'swipe': return () => hapticPatterns.swipe();
      default: return () => hapticPatterns.swipe();
    }
  };

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (stopPropagation) {
      event.stopPropagation();
    }
    // Do not call preventDefault on React synthetic events to avoid Chrome passive listener warnings.

    const touch = event.touches[0];
    const now = Date.now();
    
    startPos.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: now
    };

    currentPos.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: now
    };

    setSwipeState(prev => ({
      ...prev,
      isSwiping: true,
      direction: null,
      distance: 0,
      velocity: 0
    }));

    onSwipeStart?.();
  }, [onSwipeStart, preventDefault, stopPropagation]);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    if (!startPos.current || !currentPos.current) return;

    if (stopPropagation) {
      event.stopPropagation();
    }
    // Avoid preventDefault here; rely on native non-passive listeners or CSS touch-action

    const touch = event.touches[0];
    const now = Date.now();
    
    currentPos.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: now
    };

    const deltaX = currentPos.current.x - startPos.current.x;
    const deltaY = currentPos.current.y - startPos.current.y;
    const deltaTime = now - startPos.current.time;
    
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const currentVelocity = deltaTime > 0 ? distance / deltaTime : 0;

    // Determine direction based on the larger delta
    let direction: 'left' | 'right' | 'up' | 'down' | null = null;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      direction = deltaX > 0 ? 'right' : 'left';
    } else {
      direction = deltaY > 0 ? 'down' : 'up';
    }

    setSwipeState(prev => ({
      ...prev,
      direction,
      distance,
      velocity: currentVelocity
    }));
  }, [preventDefault, stopPropagation]);

  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    if (!startPos.current || !currentPos.current) return;

    if (stopPropagation) {
      event.stopPropagation();
    }
    // Avoid preventDefault here as well

    const deltaX = currentPos.current.x - startPos.current.x;
    const deltaY = currentPos.current.y - startPos.current.y;
    const deltaTime = currentPos.current.time - startPos.current.time;
    
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const currentVelocity = deltaTime > 0 ? distance / deltaTime : 0;

    // Check if swipe meets threshold and velocity requirements
    const meetsThreshold = distance >= threshold;
    const meetsVelocity = currentVelocity >= velocity;

    if (meetsThreshold && meetsVelocity) {
      // Determine swipe direction
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0) {
          // Swipe right
          if (enableHaptic) {
            getHapticPattern()();
          }
          onSwipeRight?.();
        } else {
          // Swipe left
          if (enableHaptic) {
            getHapticPattern()();
          }
          onSwipeLeft?.();
        }
      } else {
        if (deltaY > 0) {
          // Swipe down
          if (enableHaptic) {
            getHapticPattern()();
          }
          onSwipeDown?.();
        } else {
          // Swipe up
          if (enableHaptic) {
            getHapticPattern()();
          }
          onSwipeUp?.();
        }
      }
    }

    // Reset state
    startPos.current = null;
    currentPos.current = null;
    
    setSwipeState({
      isSwiping: false,
      direction: null,
      distance: 0,
      velocity: 0
    });

    onSwipeEnd?.();
  }, [
    threshold,
    velocity,
    enableHaptic,
    getHapticPattern,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onSwipeEnd,
    preventDefault,
    stopPropagation
  ]);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (stopPropagation) {
      event.stopPropagation();
    }
    if (preventDefault) {
      event.preventDefault();
    }

    const now = Date.now();
    
    startPos.current = {
      x: event.clientX,
      y: event.clientY,
      time: now
    };

    currentPos.current = {
      x: event.clientX,
      y: event.clientY,
      time: now
    };

    setSwipeState(prev => ({
      ...prev,
      isSwiping: true,
      direction: null,
      distance: 0,
      velocity: 0
    }));

    onSwipeStart?.();
  }, [onSwipeStart, preventDefault, stopPropagation]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!startPos.current || !currentPos.current) return;

    if (stopPropagation) {
      event.stopPropagation();
    }
    if (preventDefault) {
      event.preventDefault();
    }

    const now = Date.now();
    
    currentPos.current = {
      x: event.clientX,
      y: event.clientY,
      time: now
    };

    const deltaX = currentPos.current.x - startPos.current.x;
    const deltaY = currentPos.current.y - startPos.current.y;
    const deltaTime = now - startPos.current.time;
    
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const currentVelocity = deltaTime > 0 ? distance / deltaTime : 0;

    // Determine direction based on the larger delta
    let direction: 'left' | 'right' | 'up' | 'down' | null = null;
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      direction = deltaX > 0 ? 'right' : 'left';
    } else {
      direction = deltaY > 0 ? 'down' : 'up';
    }

    setSwipeState(prev => ({
      ...prev,
      direction,
      distance,
      velocity: currentVelocity
    }));
  }, [preventDefault, stopPropagation]);

  const handleMouseUp = useCallback((event: React.MouseEvent) => {
    if (!startPos.current || !currentPos.current) return;

    if (stopPropagation) {
      event.stopPropagation();
    }
    if (preventDefault) {
      event.preventDefault();
    }

    const deltaX = currentPos.current.x - startPos.current.x;
    const deltaY = currentPos.current.y - startPos.current.y;
    const deltaTime = currentPos.current.time - startPos.current.time;
    
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const currentVelocity = deltaTime > 0 ? distance / deltaTime : 0;

    // Check if swipe meets threshold and velocity requirements
    const meetsThreshold = distance >= threshold;
    const meetsVelocity = currentVelocity >= velocity;

    if (meetsThreshold && meetsVelocity) {
      // Determine swipe direction
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > 0) {
          // Swipe right
          if (enableHaptic) {
            getHapticPattern()();
          }
          onSwipeRight?.();
        } else {
          // Swipe left
          if (enableHaptic) {
            getHapticPattern()();
          }
          onSwipeLeft?.();
        }
      } else {
        if (deltaY > 0) {
          // Swipe down
          if (enableHaptic) {
            getHapticPattern()();
          }
          onSwipeDown?.();
        } else {
          // Swipe up
          if (enableHaptic) {
            getHapticPattern()();
          }
          onSwipeUp?.();
        }
      }
    }

    // Reset state
    startPos.current = null;
    currentPos.current = null;
    
    setSwipeState({
      isSwiping: false,
      direction: null,
      distance: 0,
      velocity: 0
    });

    onSwipeEnd?.();
  }, [
    threshold,
    velocity,
    enableHaptic,
    getHapticPattern,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onSwipeEnd,
    preventDefault,
    stopPropagation
  ]);

  const gestureProps = {
    ref: elementRef,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    // When caller requests preventDefault behavior, hint the browser via touch-action
    style: preventDefault ? ({ touchAction: 'none' } as React.CSSProperties) : undefined
  };

  return {
    gestureProps,
    swipeState,
    elementRef
  };
}

export default useSwipeGestures;
