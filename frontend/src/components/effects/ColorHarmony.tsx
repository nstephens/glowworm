import React, { useEffect, useState } from 'react';
import type { Image } from '../../types';

/**
 * State for Color Harmony effect
 */
export interface ColorHarmonyState {
  /** Array of dominant colors as hex strings */
  dominantColors: string[];
  /** Opacity of the background gradient */
  backgroundOpacity: number;
  /** Whether colors are transitioning */
  isTransitioning: boolean;
}

export interface ColorHarmonyProps {
  /** Image with dominant colors */
  image: Image;
  /** Whether the effect is active */
  isActive: boolean;
  /** Opacity of color background (0-1, default 0.2) */
  backgroundOpacity?: number;
  /** Transition duration in milliseconds */
  transitionDuration?: number;
  /** Children to render (typically the image) */
  children: React.ReactNode;
  /** Class name for the wrapper */
  className?: string;
}

/**
 * Default fallback colors (neutral warm tones)
 */
const DEFAULT_COLORS = ['#4a4a4a', '#6a6a6a', '#8a8a8a'];

/**
 * Color Harmony Effect Component
 * 
 * Creates an immersive color environment by extracting dominant colors from each image
 * and creating a blurred gradient background. The image feels embedded in its own color world.
 * 
 * Features:
 * - Uses 2-3 dominant colors from image metadata
 * - Heavy blur (100px) for abstract color wash
 * - 15-25% opacity behind image
 * - 2-second color transitions between images
 * - Graceful fallback to neutral colors if extraction unavailable
 * 
 * Performance: Tier 2 - CSS gradients with blur filter
 */
export const ColorHarmony: React.FC<ColorHarmonyProps> = ({
  image,
  isActive,
  backgroundOpacity = 0.2,
  transitionDuration = 2000,
  children,
  className = ''
}) => {
  // Extract dominant colors from image or use defaults
  const imageColors = (image as any).dominant_colors || DEFAULT_COLORS;
  
  const [colors, setColors] = useState<string[]>(imageColors);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (!isActive) {
      setOpacity(0);
      return;
    }

    // Fade in background
    setOpacity(backgroundOpacity);
    
    // Update colors when image changes
    const newColors = (image as any).dominant_colors || DEFAULT_COLORS;
    setColors(newColors);

  }, [isActive, image.id, backgroundOpacity]);

  // Create CSS gradient from colors
  const gradientStyle = colors.length >= 3
    ? `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 50%, ${colors[2]} 100%)`
    : colors.length === 2
    ? `linear-gradient(135deg, ${colors[0]} 0%, ${colors[1]} 100%)`
    : `linear-gradient(135deg, ${colors[0]} 0%, ${colors[0]} 100%)`;

  return (
    <div 
      className={`color-harmony-wrapper ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      {/* Color gradient background */}
      <div
        className="color-harmony-background"
        style={{
          position: 'absolute',
          inset: '-100px', // Extend beyond viewport for blur
          background: gradientStyle,
          filter: 'blur(100px)',
          opacity,
          transition: `background ${transitionDuration}ms ease-in-out, opacity ${transitionDuration}ms ease-in-out`,
          zIndex: -1,
          willChange: 'background, opacity'
        }}
        aria-hidden="true"
      />
      
      {/* Image content */}
      <div 
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          zIndex: 1
        }}
      >
        {children}
      </div>
    </div>
  );
};

/**
 * Hook for managing Color Harmony state
 */
export const useColorHarmony = () => {
  const [isActive, setIsActive] = useState(true);
  const [customOpacity, setCustomOpacity] = useState<number | null>(null);

  const toggleHarmony = () => setIsActive(prev => !prev);
  const enableHarmony = () => setIsActive(true);
  const disableHarmony = () => setIsActive(false);

  return {
    isActive,
    customOpacity,
    toggleHarmony,
    enableHarmony,
    disableHarmony,
    setCustomOpacity
  };
};

export default ColorHarmony;

