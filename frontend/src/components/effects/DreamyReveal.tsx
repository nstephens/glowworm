import React, { useEffect, useState, useRef } from 'react';

/**
 * State for Dreamy Reveal effect
 */
export interface DreamyRevealState {
  /** Blur amount in pixels (30 → 0) */
  blur: number;
  /** Opacity (0.5 → 1.0) */
  opacity: number;
  /** Scale (1.05 → 1.0) - optional zoom effect */
  scale: number;
  /** Whether the reveal animation is active */
  isRevealing: boolean;
}

export interface DreamyRevealProps {
  /** Whether this image is currently being revealed */
  isRevealing: boolean;
  /** Duration of reveal animation in milliseconds */
  duration?: number;
  /** Whether to include the optional scale effect */
  includeScale?: boolean;
  /** Callback when reveal completes */
  onRevealComplete?: () => void;
  /** Children to render (typically the img element) */
  children: React.ReactNode;
  /** Class name for the wrapper */
  className?: string;
  /** If true, don't control opacity (for use with external opacity management) */
  externalOpacityControl?: boolean;
}

/**
 * Dreamy Reveal Effect Component
 * 
 * Images emerge from a soft blur, mimicking the way human eyes naturally focus.
 * Creates a dreamlike, ethereal entrance that feels magical and gentle.
 * 
 * Simple CSS Version (Tier 1):
 * - Initial: 30px blur, 50% opacity, 105% scale (optional)
 * - Final: 0px blur, 100% opacity, 100% scale
 * - Duration: 1.5-2 seconds
 * - Uses CSS filter for blur (hardware accelerated)
 * 
 * Performance: Tier 1 on RPi4 when using CSS filter blur
 */
export const DreamyReveal: React.FC<DreamyRevealProps> = ({
  isRevealing,
  duration = 1500,
  includeScale = true,
  onRevealComplete,
  children,
  className = '',
  externalOpacityControl = false
}) => {
  const [state, setState] = useState<DreamyRevealState>({
    blur: 30,
    opacity: 0.0,  // Start from 0 for fade-in effect
    scale: includeScale ? 1.05 : 1.0,
    isRevealing: false
  });

  const revealStartedRef = useRef(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isRevealing) {
      if (externalOpacityControl) {
        // For external opacity control, just reset blur/scale without touching opacity
        setState(prev => ({
          ...prev,
          blur: 30,
          scale: includeScale ? 1.05 : 1.0,
          isRevealing: false
        }));
        // Small delay to ensure blurred state is rendered before next reveal
        const resetTimer = setTimeout(() => {
          revealStartedRef.current = false;
        }, 100);
        return () => clearTimeout(resetTimer);
      } else {
        // For internal opacity control, fade out then reset
        setState(prev => ({
          ...prev,
          opacity: 0.0,  // Fade out smoothly
          isRevealing: false
        }));
        
        // After fade-out completes, reset to initial blurred state for next reveal
        const resetTimer = setTimeout(() => {
          setState({
            blur: 30,
            opacity: 0.0,
            scale: includeScale ? 1.05 : 1.0,
            isRevealing: false
          });
          revealStartedRef.current = false;
        }, 800);  // Match fade-out duration
        
        return () => clearTimeout(resetTimer);
      }
      return;
    }

    if (revealStartedRef.current) {
      return; // Already started this reveal
    }

    revealStartedRef.current = true;

    if (externalOpacityControl) {
      // Ensure initial blurred state is set
      setState({
        blur: 30,
        opacity: 1.0,
        scale: includeScale ? 1.05 : 1.0,
        isRevealing: false
      });
      
      // Force reflow to ensure blurred state is rendered
      if (wrapperRef.current) {
        void wrapperRef.current.offsetHeight;
      }
      
      // Then trigger reveal in next frame (transition is always enabled)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setState({
            blur: 0,
            opacity: 1.0,
            scale: 1.0,
            isRevealing: true
          });
        });
      });

      // Notify when reveal completes
      if (onRevealComplete) {
        const completeTimer = setTimeout(() => {
          onRevealComplete();
        }, duration);

        return () => clearTimeout(completeTimer);
      }
    } else {
      // Small delay to ensure initial blurred state is rendered
      const startDelay = setTimeout(() => {
        setState({
          blur: 0,
          opacity: 1.0,
          scale: 1.0,
          isRevealing: true
        });

        // Notify when reveal completes
        if (onRevealComplete) {
          const completeTimer = setTimeout(() => {
            onRevealComplete();
          }, duration);

          return () => clearTimeout(completeTimer);
        }
      }, 50);

      return () => clearTimeout(startDelay);
    }
  }, [isRevealing, duration, includeScale, onRevealComplete, externalOpacityControl]);

  const transitionStyle: any = {
    filter: `blur(${state.blur}px)`,
    transform: `scale(${state.scale}) translateZ(0)`,  // Combine scale with hardware acceleration
    // Always enable transitions for external opacity control, conditionally for internal
    transition: externalOpacityControl 
      ? `filter ${duration}ms ease-out, transform ${duration}ms cubic-bezier(0.4, 0.0, 0.2, 1)`
      : (state.isRevealing
          ? `filter ${duration}ms ease-out, opacity ${duration}ms ease-out, transform ${duration}ms cubic-bezier(0.4, 0.0, 0.2, 1)`
          : 'none'),
    willChange: externalOpacityControl ? 'filter, transform' : 'filter, opacity, transform',
    backfaceVisibility: 'hidden' as const,
    transformOrigin: 'center center'
  };
  
  // Only control opacity if not externally controlled
  if (!externalOpacityControl) {
    transitionStyle.opacity = state.opacity;
  }

  return (
    <div 
      ref={wrapperRef}
      className={`dreamy-reveal-wrapper ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        backgroundColor: '#000'  // Black background for fade effect
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
 * Hook for managing Dreamy Reveal state
 */
export const useDreamyReveal = (duration = 1500) => {
  const [isRevealing, setIsRevealing] = useState(false);

  const startReveal = () => {
    setIsRevealing(true);
  };

  const resetReveal = () => {
    setIsRevealing(false);
  };

  return {
    isRevealing,
    startReveal,
    resetReveal,
    duration
  };
};

export default DreamyReveal;

