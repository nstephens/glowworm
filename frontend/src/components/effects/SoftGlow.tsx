import React, { useEffect, useState, useRef } from 'react';

/**
 * State for Soft Glow brightness transitions
 */
export interface SoftGlowState {
  /** Brightness of outgoing image (1.0 → 0.7) */
  outgoingBrightness: number;
  /** Brightness of incoming image (1.3 → 1.0) */
  incomingBrightness: number;
  /** Opacity of outgoing image (1.0 → 0.0) */
  outgoingOpacity: number;
  /** Opacity of incoming image (0.0 → 1.0) */
  incomingOpacity: number;
}

export interface SoftGlowProps {
  /** Whether this is the outgoing (fading out) or incoming (fading in) image */
  direction: 'outgoing' | 'incoming';
  /** Whether the transition is active */
  isTransitioning: boolean;
  /** Callback when transition completes */
  onTransitionComplete?: () => void;
  /** Children to render (typically the img element) */
  children: React.ReactNode;
  /** Class name for the wrapper */
  className?: string;
}

/**
 * Soft Glow Effect Component
 * 
 * Creates warm, glowing cross-fade transitions by manipulating brightness.
 * Outgoing images dim while fading out, incoming images bloom before settling.
 * 
 * Timeline:
 * - Outgoing: 0ms-800ms (dims to 70% brightness, fades out)
 * - Incoming: 300ms-1500ms (starts at 130% brightness, settles to 100%)
 * - Overlap: 300ms-800ms (creates warm glow effect)
 */
export const SoftGlow: React.FC<SoftGlowProps> = ({
  direction,
  isTransitioning,
  onTransitionComplete,
  children,
  className = ''
}) => {
  const [brightness, setBrightness] = useState(
    direction === 'outgoing' ? 1.0 : 1.3
  );
  const [opacity, setOpacity] = useState(
    direction === 'outgoing' ? 1.0 : 0.0
  );
  
  const transitionStartedRef = useRef(false);

  useEffect(() => {
    if (!isTransitioning) {
      // Reset to initial state
      if (direction === 'outgoing') {
        setBrightness(1.0);
        setOpacity(1.0);
      } else {
        setBrightness(1.3);
        setOpacity(0.0);
      }
      transitionStartedRef.current = false;
      return;
    }

    if (transitionStartedRef.current) {
      return; // Already started this transition
    }

    transitionStartedRef.current = true;

    if (direction === 'outgoing') {
      // Outgoing image: Start dimming and fading immediately
      setBrightness(0.7);
      setOpacity(0.0);
      
      // Complete after 800ms
      const timer = setTimeout(() => {
        if (onTransitionComplete) {
          onTransitionComplete();
        }
      }, 800);
      
      return () => clearTimeout(timer);
    } else {
      // Incoming image: Start with 300ms delay
      const startTimer = setTimeout(() => {
        setOpacity(1.0);
        setBrightness(1.0);
        
        // Complete after 1500ms total (1200ms after start)
        const completeTimer = setTimeout(() => {
          if (onTransitionComplete) {
            onTransitionComplete();
          }
        }, 1200);
        
        return () => clearTimeout(completeTimer);
      }, 300);
      
      return () => clearTimeout(startTimer);
    }
  }, [isTransitioning, direction, onTransitionComplete]);

  const transitionStyle = {
    filter: `brightness(${brightness})`,
    opacity,
    transition: direction === 'outgoing'
      ? 'filter 800ms ease-in-out, opacity 800ms ease-in-out'
      : 'filter 1200ms ease-in-out, opacity 1200ms ease-in-out',
    willChange: 'filter, opacity',
    backfaceVisibility: 'hidden' as const
  };

  return (
    <div 
      className={`soft-glow-wrapper ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%'
      }}
    >
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            style: {
              ...((child as any).props.style || {}),
              ...transitionStyle
            }
          });
        }
        return child;
      })}
    </div>
  );
};

/**
 * Hook for managing Soft Glow transitions between images
 * 
 * Use this in components that need to coordinate dual-image transitions
 */
export const useSoftGlowTransition = () => {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showOutgoing, setShowOutgoing] = useState(true);
  const [showIncoming, setShowIncoming] = useState(false);

  const startTransition = () => {
    setIsTransitioning(true);
    setShowOutgoing(true);
    setShowIncoming(true);
  };

  const handleOutgoingComplete = () => {
    setShowOutgoing(false);
  };

  const handleIncomingComplete = () => {
    setIsTransitioning(false);
  };

  return {
    isTransitioning,
    showOutgoing,
    showIncoming,
    startTransition,
    handleOutgoingComplete,
    handleIncomingComplete
  };
};

export default SoftGlow;

