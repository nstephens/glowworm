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
  className = ''
}) => {
  const [state, setState] = useState<DreamyRevealState>({
    blur: 30,
    opacity: 0.0,  // Start from 0 for fade-in effect
    scale: includeScale ? 1.05 : 1.0,
    isRevealing: false
  });

  const revealStartedRef = useRef(false);

  useEffect(() => {
    if (!isRevealing) {
      // Reset to blurred initial state with fade from black
      setState({
        blur: 30,
        opacity: 0.0,  // Fade in from black
        scale: includeScale ? 1.05 : 1.0,
        isRevealing: false
      });
      revealStartedRef.current = false;
      return;
    }

    if (revealStartedRef.current) {
      return; // Already started this reveal
    }

    revealStartedRef.current = true;

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
  }, [isRevealing, duration, includeScale, onRevealComplete]);

  const transitionStyle = {
    filter: `blur(${state.blur}px)`,
    opacity: state.opacity,
    transform: `scale(${state.scale})`,
    transition: state.isRevealing
      ? `filter ${duration}ms ease-out, opacity ${duration}ms ease-out, transform ${duration}ms cubic-bezier(0.4, 0.0, 0.2, 1)`
      : 'none',
    willChange: 'filter, opacity, transform',
    backfaceVisibility: 'hidden' as const,
    transformOrigin: 'center center'
  };

  return (
    <div 
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

