import React, { useEffect, useState } from 'react';

/**
 * State for Cinematic Bars visibility
 */
export interface CinematicBarsState {
  /** Whether the bars are visible */
  isVisible: boolean;
  /** Delay before fading in (milliseconds) */
  fadeInDelay: number;
  /** Delay before fading out (milliseconds) */
  fadeOutDelay: number;
}

export interface CinematicBarsProps {
  /** Display interval in seconds */
  displayInterval: number;
  /** Whether bars are active */
  isActive?: boolean;
  /** Bar height as percentage of screen (default: 8) */
  barHeight?: number;
  /** Maximum opacity of bars (default: 0.4) */
  maxOpacity?: number;
  /** Delay before bars fade in (seconds, default: 3) */
  fadeInDelay?: number;
  /** Time before next transition to fade out (seconds, default: 2) */
  fadeOutBefore?: number;
  /** Children to render (typically the image) */
  children: React.ReactNode;
  /** Class name for the wrapper */
  className?: string;
}

/**
 * Cinematic Bars Effect Component
 * 
 * Adds subtle letterbox bars that fade in and out, creating a focused,
 * cinematic viewing experience. Emphasizes the importance of each photo moment.
 * 
 * Timeline (for 30s display interval):
 * - 0-3s: Bars invisible
 * - 3-5s: Bars fade in to 40% opacity
 * - 5-28s: Bars remain visible
 * - 28-29s: Bars fade out
 * - 29-30s: Next transition begins
 * 
 * Performance: Tier 2 - CSS gradients with opacity transitions
 */
export const CinematicBars: React.FC<CinematicBarsProps> = ({
  displayInterval,
  isActive = true,
  barHeight = 8,
  maxOpacity = 0.4,
  fadeInDelay = 3,
  fadeOutBefore = 2,
  children,
  className = ''
}) => {
  const [barsVisible, setBarsVisible] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setBarsVisible(false);
      return;
    }

    // Reset bars on new image
    setBarsVisible(false);

    // Fade in after delay
    const fadeInTimer = setTimeout(() => {
      setBarsVisible(true);
    }, fadeInDelay * 1000);

    // Fade out before next transition
    const fadeOutTimer = setTimeout(() => {
      setBarsVisible(false);
    }, (displayInterval - fadeOutBefore) * 1000);

    return () => {
      clearTimeout(fadeInTimer);
      clearTimeout(fadeOutTimer);
    };
  }, [isActive, displayInterval, fadeInDelay, fadeOutBefore]);

  return (
    <div 
      className={`cinematic-bars-wrapper ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden'
      }}
    >
      {children}
      
      {/* Top letterbox bar */}
      <div
        className="cinematic-bar top"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: `${barHeight}vh`,
          background: `linear-gradient(to bottom, rgba(0, 0, 0, ${maxOpacity}), rgba(0, 0, 0, 0))`,
          opacity: barsVisible ? 1 : 0,
          transition: 'opacity 2s ease-in-out',
          pointerEvents: 'none',
          zIndex: 2
        }}
        aria-hidden="true"
      />
      
      {/* Bottom letterbox bar */}
      <div
        className="cinematic-bar bottom"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: `${barHeight}vh`,
          background: `linear-gradient(to top, rgba(0, 0, 0, ${maxOpacity}), rgba(0, 0, 0, 0))`,
          opacity: barsVisible ? 1 : 0,
          transition: 'opacity 2s ease-in-out',
          pointerEvents: 'none',
          zIndex: 2
        }}
        aria-hidden="true"
      />
    </div>
  );
};

/**
 * Hook for managing Cinematic Bars state
 */
export const useCinematicBars = (displayInterval: number) => {
  const [isActive, setIsActive] = useState(true);
  const [customDelay, setCustomDelay] = useState<number | null>(null);

  const toggleBars = () => setIsActive(prev => !prev);
  const enableBars = () => setIsActive(true);
  const disableBars = () => setIsActive(false);

  return {
    isActive,
    customDelay,
    toggleBars,
    enableBars,
    disableBars,
    setCustomDelay
  };
};

export default CinematicBars;

