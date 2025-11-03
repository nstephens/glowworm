import { useState, useRef, useCallback } from 'react';

interface UsePinchZoomOptions {
  minZoom?: number;
  maxZoom?: number;
  doubleTapZoom?: number;
  hapticFeedback?: boolean;
}

interface PinchZoomState {
  scale: number;
  offset: { x: number; y: number };
  isZooming: boolean;
  isPanning: boolean;
}

export const usePinchZoom = (options: UsePinchZoomOptions = {}) => {
  const {
    minZoom = 1,
    maxZoom = 3,
    doubleTapZoom = 2,
    hapticFeedback = true,
  } = options;

  const [state, setState] = useState<PinchZoomState>({
    scale: 1,
    offset: { x: 0, y: 0 },
    isZooming: false,
    isPanning: false,
  });

  const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
  const lastDistanceRef = useRef<number | null>(null);
  const lastCenterRef = useRef<{ x: number; y: number } | null>(null);
  const doubleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTapRef = useRef<number>(0);

  const triggerHapticFeedback = useCallback(() => {
    if (hapticFeedback && 'vibrate' in navigator) {
      navigator.vibrate(50);
    }
  }, [hapticFeedback]);

  const getDistance = useCallback((touch1: Touch, touch2: Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const getCenter = useCallback((touch1: Touch, touch2: Touch) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  }, []);

  const constrainOffset = useCallback((scale: number, offset: { x: number; y: number }) => {
    const maxOffsetX = Math.max(0, (scale - 1) * 100);
    const maxOffsetY = Math.max(0, (scale - 1) * 100);
    
    return {
      x: Math.max(-maxOffsetX, Math.min(maxOffsetX, offset.x)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, offset.y)),
    };
  }, []);

  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    const touches = event.touches;
    
    if (touches.length === 1) {
      // Single touch - start panning
      const touch = touches[0];
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      setState(prev => ({ ...prev, isPanning: true }));
    } else if (touches.length === 2) {
      // Two touches - start pinch zoom
      const distance = getDistance(touches[0], touches[1]);
      const center = getCenter(touches[0], touches[1]);
      
      lastDistanceRef.current = distance;
      lastCenterRef.current = center;
      setState(prev => ({ ...prev, isZooming: true, isPanning: false }));
    }
  }, [getDistance, getCenter]);

  const handleTouchMove = useCallback((event: React.TouchEvent) => {
    const touches = event.touches;
    
    if (touches.length === 1 && lastTouchRef.current && state.isPanning) {
      // Single touch - panning
      const touch = touches[0];
      const deltaX = touch.clientX - lastTouchRef.current.x;
      const deltaY = touch.clientY - lastTouchRef.current.y;
      
      setState(prev => ({
        ...prev,
        offset: constrainOffset(prev.scale, {
          x: prev.offset.x + deltaX,
          y: prev.offset.y + deltaY,
        }),
      }));
      
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
    } else if (touches.length === 2 && lastDistanceRef.current && lastCenterRef.current && state.isZooming) {
      // Two touches - pinch zoom
      const distance = getDistance(touches[0], touches[1]);
      const center = getCenter(touches[0], touches[1]);
      
      const scaleChange = distance / lastDistanceRef.current;
      const newScale = Math.max(minZoom, Math.min(maxZoom, state.scale * scaleChange));
      
      // Calculate offset adjustment for zoom center
      const centerDeltaX = center.x - lastCenterRef.current.x;
      const centerDeltaY = center.y - lastCenterRef.current.y;
      
      setState(prev => ({
        ...prev,
        scale: newScale,
        offset: constrainOffset(newScale, {
          x: prev.offset.x + centerDeltaX,
          y: prev.offset.y + centerDeltaY,
        }),
      }));
      
      lastDistanceRef.current = distance;
      lastCenterRef.current = center;
    }
  }, [state.isPanning, state.isZooming, state.scale, state.offset, getDistance, getCenter, constrainOffset, minZoom, maxZoom]);

  const handleTouchEnd = useCallback((event: React.TouchEvent) => {
    const touches = event.touches;
    
    if (touches.length === 0) {
      // All touches ended
      setState(prev => ({ ...prev, isZooming: false, isPanning: false }));
      lastTouchRef.current = null;
      lastDistanceRef.current = null;
      lastCenterRef.current = null;
    } else if (touches.length === 1) {
      // One touch remaining - switch to panning
      const touch = touches[0];
      lastTouchRef.current = { x: touch.clientX, y: touch.clientY };
      setState(prev => ({ ...prev, isZooming: false, isPanning: true }));
    }
  }, []);

  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    
    const delta = event.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(minZoom, Math.min(maxZoom, state.scale * delta));
    
    if (newScale !== state.scale) {
      triggerHapticFeedback();
      setState(prev => ({
        ...prev,
        scale: newScale,
        offset: constrainOffset(newScale, prev.offset),
      }));
    }
  }, [state.scale, minZoom, maxZoom, constrainOffset, triggerHapticFeedback]);

  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    
    const now = Date.now();
    const timeSinceLastTap = now - lastTapRef.current;
    
    if (timeSinceLastTap < 300) {
      // Double tap detected
      const targetScale = state.scale === 1 ? doubleTapZoom : 1;
      const newScale = Math.max(minZoom, Math.min(maxZoom, targetScale));
      
      triggerHapticFeedback();
      setState(prev => ({
        ...prev,
        scale: newScale,
        offset: newScale === 1 ? { x: 0, y: 0 } : constrainOffset(newScale, prev.offset),
      }));
    }
    
    lastTapRef.current = now;
  }, [state.scale, doubleTapZoom, minZoom, maxZoom, constrainOffset, triggerHapticFeedback]);

  const resetZoom = useCallback(() => {
    triggerHapticFeedback();
    setState({
      scale: 1,
      offset: { x: 0, y: 0 },
      isZooming: false,
      isPanning: false,
    });
  }, [triggerHapticFeedback]);

  return {
    ...state,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleWheel,
    handleDoubleClick,
    resetZoom,
  };
};

export default usePinchZoom;