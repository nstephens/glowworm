import React, { useEffect, useState, useMemo } from 'react';
import type { Image } from '../../types';

/**
 * Configuration for Ken Burns Plus animation
 */
export interface KenBurnsPlusConfig {
  /** Direction of zoom: 'in' for zoom in, 'out' for zoom out */
  zoomDirection: 'in' | 'out';
  /** Target position for panning (percentage of image dimensions) */
  panTarget: { x: number; y: number };
  /** Rotation angle in degrees (-2 to +2) */
  rotation: number;
  /** Animation duration in milliseconds */
  duration: number;
}

/**
 * State for tracking Ken Burns Plus animation
 */
export interface KenBurnsPlusState {
  /** Current zoom scale (1.0 to 1.15) */
  scale: number;
  /** Current object position for panning */
  objectPosition: string;
  /** Current rotation in degrees */
  rotation: number;
  /** Whether animation is active */
  isAnimating: boolean;
}

export interface KenBurnsPlusProps {
  /** Image to apply Ken Burns effect to */
  image: Image;
  /** Whether the image is currently visible */
  isActive: boolean;
  /** Base display interval in seconds */
  displayInterval: number;
  /** Optional override configuration */
  config?: Partial<KenBurnsPlusConfig>;
  /** Children to render (typically the img element) */
  children: React.ReactNode;
  /** Class name for the wrapper */
  className?: string;
}

/**
 * Generate random Ken Burns configuration for an image
 */
const generateKenBurnsConfig = (
  image: Image,
  displayInterval: number
): KenBurnsPlusConfig => {
  const isPortrait = image.height > image.width;
  const aspectRatio = image.width / image.height;

  // Random zoom direction
  const zoomDirection: 'in' | 'out' = Math.random() > 0.5 ? 'in' : 'out';

  // Subtle rotation (-1 to +1 degrees) - reduced for less distraction
  const rotation = (Math.random() * 2) - 1;

  // Calculate safe pan boundaries
  // For zoom in: start at center, pan to a corner
  // For zoom out: start at a corner, pan to center
  const maxPanX = isPortrait ? 5 : 15; // Smaller pan for portrait
  const maxPanY = isPortrait ? 15 : 5;  // Larger vertical pan for portrait

  let panTarget = { x: 50, y: 50 }; // Default center

  if (zoomDirection === 'in') {
    // Zoom in: pan away from center
    panTarget = {
      x: 50 + (Math.random() * maxPanX * 2 - maxPanX),
      y: isPortrait ? 50 + (Math.random() * maxPanY * 2 - maxPanY) : 50
    };
  } else {
    // Zoom out: start offset, pan to center
    panTarget = {
      x: 50,
      y: isPortrait ? 50 : 50
    };
  }

  // Vary duration slightly (25-35 seconds)
  const duration = (displayInterval * 0.83 + Math.random() * displayInterval * 0.33) * 1000;

  return {
    zoomDirection,
    panTarget,
    rotation,
    duration
  };
};

/**
 * Ken Burns Plus Effect Component
 * 
 * Implements enhanced Ken Burns effect with zoom, pan, and rotation.
 * Optimized for Raspberry Pi performance using CSS transforms and GPU acceleration.
 */
export const KenBurnsPlus: React.FC<KenBurnsPlusProps> = ({
  image,
  isActive,
  displayInterval,
  config: configOverride,
  children,
  className = ''
}) => {
  // Generate configuration once per image
  const config = useMemo(
    () => ({
      ...generateKenBurnsConfig(image, displayInterval),
      ...configOverride
    }),
    [image.id, displayInterval] // Only regenerate if image changes
  );

  const [state, setState] = useState<KenBurnsPlusState>({
    scale: config.zoomDirection === 'in' ? 1.15 : 1.3,  // Start more zoomed in to hide borders
    objectPosition: config.zoomDirection === 'in' ? 'center' : `${config.panTarget.x}% ${config.panTarget.y}%`,
    rotation: config.zoomDirection === 'in' ? -config.rotation : config.rotation,
    isAnimating: false
  });

  // Start animation when image becomes active
  useEffect(() => {
    if (!isActive) {
      // Reset to initial state when not active
      setState({
        scale: config.zoomDirection === 'in' ? 1.15 : 1.3,  // Start more zoomed in
        objectPosition: config.zoomDirection === 'in' ? 'center' : `${config.panTarget.x}% ${config.panTarget.y}%`,
        rotation: config.zoomDirection === 'in' ? -config.rotation : config.rotation,
        isAnimating: false
      });
      return;
    }

    // Small delay to ensure initial state is rendered before animation starts
    const startDelay = setTimeout(() => {
      setState({
        scale: config.zoomDirection === 'in' ? 1.3 : 1.15,  // End more zoomed in
        objectPosition: config.zoomDirection === 'in' ? `${config.panTarget.x}% ${config.panTarget.y}%` : 'center',
        rotation: config.zoomDirection === 'in' ? config.rotation : -config.rotation,
        isAnimating: true
      });
    }, 50);

    return () => clearTimeout(startDelay);
  }, [isActive, config, image.id]);

  const transformStyle = state.isAnimating ? {
    transform: `scale(${state.scale}) rotate(${state.rotation}deg)`,
    objectPosition: state.objectPosition,
    transition: `transform ${config.duration}ms cubic-bezier(0.25, 0.1, 0.25, 1.0), object-position ${config.duration}ms cubic-bezier(0.25, 0.1, 0.25, 1.0)`,
    willChange: 'transform, object-position',
    backfaceVisibility: 'hidden' as const,
    transformStyle: 'preserve-3d' as const
  } : {
    transform: `scale(${state.scale}) rotate(${state.rotation}deg)`,
    objectPosition: state.objectPosition,
    willChange: 'transform, object-position',
    backfaceVisibility: 'hidden' as const,
    transformStyle: 'preserve-3d' as const
  };

  return (
    <div 
      className={`ken-burns-plus-wrapper ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden'
      }}
    >
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

export default KenBurnsPlus;

