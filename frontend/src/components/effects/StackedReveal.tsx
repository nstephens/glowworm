import React, { useEffect, useState } from 'react';
import type { Image } from '../../types';

/**
 * State for tracking Stacked Reveal animation
 */
export interface StackedRevealState {
  /** Transform for top image layer */
  topTransform: string;
  /** Transform for bottom image layer */
  bottomTransform: string;
  /** Opacity for top image */
  topOpacity: number;
  /** Opacity for bottom image */
  bottomOpacity: number;
  /** Whether stagger delay is active */
  isStaggered: boolean;
}

export interface StackedRevealProps {
  /** Which layer this is (top or bottom) */
  layer: 'top' | 'bottom';
  /** Image for this layer */
  image: Image;
  /** Whether the reveal is active */
  isRevealing: boolean;
  /** Duration for the slide-in animation */
  duration?: number;
  /** Stagger delay for bottom layer in milliseconds */
  staggerDelay?: number;
  /** Children to render (typically the img element) */
  children: React.ReactNode;
  /** Class name for the wrapper */
  className?: string;
}

/**
 * Stacked Reveal Effect Component
 * 
 * Enhances split-screen displays with dynamic motion. Each layer slides in from
 * opposite corners with different timing, creating visual interest and depth.
 * 
 * Animation:
 * - Top Layer: Slides from top-right (-10%, -10%) → (0, 0) in 1.2s
 * - Bottom Layer: Slides from bottom-left (10%, 10%) → (0, 0) in 1.5s with 300ms delay
 * - Easing: cubic-bezier(0.34, 1.56, 0.64, 1) for gentle bounce
 * 
 * Performance: Tier 2 - Uses transform and opacity for GPU acceleration
 */
export const StackedReveal: React.FC<StackedRevealProps> = ({
  layer,
  image,
  isRevealing,
  duration,
  staggerDelay = 300,
  children,
  className = ''
}) => {
  // Calculate layer-specific durations
  const layerDuration = duration || (layer === 'top' ? 1200 : 1500);
  const delay = layer === 'bottom' ? staggerDelay : 0;

  // Initial positions based on layer
  const initialTransform = layer === 'top' 
    ? 'translate(-10%, -10%)' 
    : 'translate(10%, 10%)';

  const [transform, setTransform] = useState(initialTransform);
  const [opacity, setOpacity] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!isRevealing) {
      // Reset to initial state
      setTransform(initialTransform);
      setOpacity(0);
      setIsAnimating(false);
      return;
    }

    // Start animation with appropriate delay
    const startTimer = setTimeout(() => {
      setIsAnimating(true);
      setTransform('translate(0, 0)');
      setOpacity(1);
    }, delay);

    return () => clearTimeout(startTimer);
  }, [isRevealing, layer, delay, initialTransform]);

  const animationStyle = {
    transform,
    opacity,
    transition: isAnimating
      ? `transform ${layerDuration}ms cubic-bezier(0.34, 1.56, 0.64, 1), opacity ${layerDuration}ms ease-out`
      : 'none',
    willChange: 'transform, opacity',
    backfaceVisibility: 'hidden' as const,
    transformStyle: 'preserve-3d' as const
  };

  return (
    <div 
      className={`stacked-reveal-layer ${className}`}
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
              ...animationStyle
            }
          });
        }
        return child;
      })}
    </div>
  );
};

/**
 * Hook for managing Stacked Reveal state
 */
export const useStackedReveal = () => {
  const [isRevealing, setIsRevealing] = useState(false);
  const [topComplete, setTopComplete] = useState(false);
  const [bottomComplete, setBottomComplete] = useState(false);

  const startReveal = () => {
    setIsRevealing(true);
    setTopComplete(false);
    setBottomComplete(false);
  };

  const resetReveal = () => {
    setIsRevealing(false);
    setTopComplete(false);
    setBottomComplete(false);
  };

  const isComplete = topComplete && bottomComplete;

  return {
    isRevealing,
    topComplete,
    bottomComplete,
    isComplete,
    startReveal,
    resetReveal,
    setTopComplete,
    setBottomComplete
  };
};

export default StackedReveal;

