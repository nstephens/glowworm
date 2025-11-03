import React, { useEffect, useState, useMemo } from 'react';
import type { Image } from '../../types';

/**
 * State for tracking Parallax Depth animation
 */
export interface ParallaxDepthState {
  /** Offset for top layer (percentage) */
  topLayerOffset: number;
  /** Offset for bottom layer (percentage) */
  bottomLayerOffset: number;
  /** Parallax factor (0-1, default 0.6) */
  parallaxFactor: number;
  /** Pan direction */
  direction: 'left' | 'right' | 'up' | 'down';
}

export interface ParallaxDepthProps {
  /** Which layer this is (for split-screen) */
  layer?: 'top' | 'bottom' | 'single';
  /** Image for this layer */
  image: Image;
  /** Whether the animation is active */
  isActive: boolean;
  /** Duration of pan animation in seconds */
  duration?: number;
  /** Parallax factor (0-1, bottom layer moves this % of top layer) */
  parallaxFactor?: number;
  /** Children to render (typically the img element) */
  children: React.ReactNode;
  /** Class name for the wrapper */
  className?: string;
}

/**
 * Parallax Depth Effect Component
 * 
 * Creates sense of 3D depth by moving foreground and background at different speeds.
 * For stacked landscapes, each layer pans independently creating parallax effect.
 * For portraits, adds subtle vertical drift.
 * 
 * Stacked Landscape:
 * - Top Layer: Pans 100% of target distance
 * - Bottom Layer: Pans 60% of target distance (parallax factor)
 * - Edge Treatment: Subtle blur gradient at screen edges
 * 
 * Portrait:
 * - Vertical Drift: Slow upward pan (2-3% over 30s)
 * - Blur Gradient: Subtle vignette blur at top/bottom edges
 * 
 * Performance: Tier 2 - Uses transform3d with GPU acceleration
 */
export const ParallaxDepth: React.FC<ParallaxDepthProps> = ({
  layer = 'single',
  image,
  isActive,
  duration = 30,
  parallaxFactor = 0.6,
  children,
  className = ''
}) => {
  const isPortrait = image.height > image.width;
  
  // Generate random pan direction and distance
  const panConfig = useMemo(() => {
    if (isPortrait) {
      // Portrait: vertical drift only
      return {
        direction: 'up' as const,
        distance: 2 + Math.random() * 1 // 2-3%
      };
    } else {
      // Landscape: horizontal pan
      return {
        direction: Math.random() > 0.5 ? ('left' as const) : ('right' as const),
        distance: 8 + Math.random() * 4 // 8-12%
      };
    }
  }, [image.id, isPortrait]);

  // Calculate actual offset based on layer
  const layerMultiplier = layer === 'bottom' ? parallaxFactor : 1.0;
  const targetDistance = panConfig.distance * layerMultiplier;

  const [offset, setOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setOffset(0);
      setIsAnimating(false);
      return;
    }

    // Small delay before starting animation
    const startDelay = setTimeout(() => {
      setIsAnimating(true);
      setOffset(targetDistance);
    }, 100);

    return () => clearTimeout(startDelay);
  }, [isActive, targetDistance]);

  // Build transform based on direction
  const getTransform = () => {
    if (!isAnimating) return 'translate3d(0, 0, 0)';
    
    if (isPortrait) {
      // Vertical drift for portrait
      return `translate3d(0, -${offset}%, 0)`;
    } else {
      // Horizontal pan for landscape
      const direction = panConfig.direction === 'left' ? '-' : '';
      return `translate3d(${direction}${offset}%, 0, 0)`;
    }
  };

  const transformStyle = {
    transform: getTransform(),
    transition: isAnimating ? `transform ${duration}s linear` : 'none',
    willChange: 'transform',
    backfaceVisibility: 'hidden' as const,
    transformStyle: 'preserve-3d' as const
  };

  return (
    <div 
      className={`parallax-depth-wrapper ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      {/* Edge blur gradient */}
      <div
        className="parallax-edge-blur"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          backdropFilter: 'blur(2px)',
          WebkitMaskImage: isPortrait
            ? 'linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)'
            : 'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)',
          maskImage: isPortrait
            ? 'linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%)'
            : 'linear-gradient(to right, transparent 0%, black 5%, black 95%, transparent 100%)',
          zIndex: 2
        }}
        aria-hidden="true"
      />
      
      {/* Image with parallax transform */}
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            style: {
              ...((child as any).props.style || {}),
              ...transformStyle
            }
          });
        }
        return child;
      })}
    </div>
  );
};

/**
 * Hook for managing Parallax Depth state
 */
export const useParallaxDepth = (duration = 30) => {
  const [isActive, setIsActive] = useState(false);
  const [customFactor, setCustomFactor] = useState<number | null>(null);

  const startParallax = () => setIsActive(true);
  const stopParallax = () => setIsActive(false);
  const toggleParallax = () => setIsActive(prev => !prev);

  return {
    isActive,
    customFactor,
    duration,
    startParallax,
    stopParallax,
    toggleParallax,
    setCustomFactor
  };
};

export default ParallaxDepth;

