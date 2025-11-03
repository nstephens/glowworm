import React from 'react';

/**
 * Configuration for Ambient Pulse animation
 */
export interface AmbientPulseConfig {
  /** Duration of one complete breathing cycle in milliseconds */
  duration: number;
  /** Whether the animation is active */
  isActive: boolean;
}

export interface AmbientPulseProps {
  /** Display interval in seconds (used to calculate breathing duration) */
  displayInterval: number;
  /** Whether the pulse animation is active */
  isActive?: boolean;
  /** Children to render (typically the image) */
  children: React.ReactNode;
  /** Class name for the wrapper */
  className?: string;
}

/**
 * Ambient Pulse Effect Component
 * 
 * Creates a subtle breathing vignette that pulses in rhythm with the display timing.
 * The dark edges gently expand (exhale) and contract (inhale) once per image cycle,
 * creating a living, organic feeling.
 * 
 * Performance: Pure CSS animation with box-shadow - extremely lightweight for Raspberry Pi.
 * 
 * Animation Cycle:
 * - 0%/100%: Large shadow (exhale) - 120px blur, 60px spread, 30% opacity
 * - 50%: Small shadow (inhale) - 50px blur, 30px spread, 15% opacity
 */
export const AmbientPulse: React.FC<AmbientPulseProps> = ({
  displayInterval,
  isActive = true,
  children,
  className = ''
}) => {
  const duration = displayInterval * 1000; // Convert seconds to milliseconds

  return (
    <div 
      className={`ambient-pulse-wrapper ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%'
      }}
    >
      {children}
      
      {/* Breathing vignette overlay */}
      {isActive && (
        <>
          <style>
            {`
              @keyframes vignette-breathing {
                0%, 100% {
                  box-shadow: inset 0 0 150px 80px rgba(0, 0, 0, 0.5);
                }
                50% {
                  box-shadow: inset 0 0 80px 40px rgba(0, 0, 0, 0.25);
                }
              }
            `}
          </style>
          <div
            className="ambient-pulse-vignette"
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              animation: `vignette-breathing ${duration}ms ease-in-out infinite`,
              willChange: 'box-shadow',
              // Ensure vignette is above image but below any UI
              zIndex: 1
            }}
            aria-hidden="true"
          />
        </>
      )}
    </div>
  );
};

/**
 * Hook for managing Ambient Pulse state
 * 
 * Provides simple on/off control for the pulse effect
 */
export const useAmbientPulse = (initialActive = true) => {
  const [isActive, setIsActive] = React.useState(initialActive);

  const togglePulse = () => setIsActive(prev => !prev);
  const enablePulse = () => setIsActive(true);
  const disablePulse = () => setIsActive(false);

  return {
    isActive,
    togglePulse,
    enablePulse,
    disablePulse
  };
};

export default AmbientPulse;

