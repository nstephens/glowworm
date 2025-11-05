/**
 * Haptic feedback utilities for mobile touch interactions
 * Provides consistent haptic feedback across the application
 */

export type HapticFeedbackType = 
  | 'light'      // Light tap (10ms)
  | 'medium'     // Medium tap (20ms)
  | 'heavy'      // Heavy tap (50ms)
  | 'success'    // Success pattern (light + medium)
  | 'warning'    // Warning pattern (medium + heavy)
  | 'error'      // Error pattern (heavy + heavy + heavy)
  | 'selection'  // Selection feedback (light)
  | 'impact'     // Impact feedback (medium)
  | 'notification'; // Notification feedback (light + medium + light)

interface HapticFeedbackOptions {
  enabled?: boolean;
  fallback?: boolean; // Use visual feedback as fallback
}

class HapticFeedbackManager {
  private isSupported: boolean;
  private isEnabled: boolean;

  constructor() {
    this.isSupported = 'vibrate' in navigator;
    this.isEnabled = this.isSupported;
  }

  /**
   * Enable or disable haptic feedback
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled && this.isSupported;
  }

  /**
   * Check if haptic feedback is available and enabled
   */
  isAvailable(): boolean {
    return this.isSupported && this.isEnabled;
  }

  /**
   * Trigger haptic feedback based on type
   */
  trigger(type: HapticFeedbackType, options: HapticFeedbackOptions = {}): void {
    const { enabled = true, fallback = true } = options;

    if (!enabled || !this.isEnabled) {
      if (fallback) {
        this.triggerVisualFallback(type);
      }
      return;
    }

    const pattern = this.getVibrationPattern(type);
    if (pattern && this.isSupported) {
      navigator.vibrate(pattern);
    } else if (fallback) {
      this.triggerVisualFallback(type);
    }
  }

  /**
   * Get vibration pattern for haptic feedback type
   */
  private getVibrationPattern(type: HapticFeedbackType): number[] | number | null {
    switch (type) {
      case 'light':
        return 10;
      case 'medium':
        return 20;
      case 'heavy':
        return 50;
      case 'success':
        return [10, 50, 20];
      case 'warning':
        return [20, 100, 50];
      case 'error':
        return [50, 100, 50, 100, 50];
      case 'selection':
        return 10;
      case 'impact':
        return 20;
      case 'notification':
        return [10, 50, 20, 50, 10];
      default:
        return null;
    }
  }

  /**
   * Trigger visual feedback as fallback when haptic is not available
   */
  private triggerVisualFallback(type: HapticFeedbackType): void {
    // Create a temporary visual indicator
    const indicator = document.createElement('div');
    indicator.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 4px;
      height: 4px;
      background: var(--primary-color, #4f46e5);
      border-radius: 50%;
      pointer-events: none;
      z-index: 9999;
      opacity: 0.8;
    `;

    document.body.appendChild(indicator);

    // Animate the indicator
    const duration = this.getVisualDuration(type);
    indicator.animate([
      { transform: 'translate(-50%, -50%) scale(0)', opacity: 0.8 },
      { transform: 'translate(-50%, -50%) scale(2)', opacity: 0 },
    ], {
      duration,
      easing: 'ease-out'
    }).onfinish = () => {
      document.body.removeChild(indicator);
    };
  }

  /**
   * Get visual feedback duration based on haptic type
   */
  private getVisualDuration(type: HapticFeedbackType): number {
    switch (type) {
      case 'light':
      case 'selection':
        return 100;
      case 'medium':
      case 'impact':
        return 150;
      case 'heavy':
        return 200;
      case 'success':
        return 300;
      case 'warning':
        return 400;
      case 'error':
        return 500;
      case 'notification':
        return 600;
      default:
        return 150;
    }
  }
}

// Create singleton instance
export const hapticFeedback = new HapticFeedbackManager();

/**
 * React hook for haptic feedback
 */
export function useHapticFeedback() {
  const trigger = (type: HapticFeedbackType, options?: HapticFeedbackOptions) => {
    hapticFeedback.trigger(type, options);
  };

  const setEnabled = (enabled: boolean) => {
    hapticFeedback.setEnabled(enabled);
  };

  const isAvailable = () => {
    return hapticFeedback.isAvailable();
  };

  return {
    trigger,
    setEnabled,
    isAvailable
  };
}

/**
 * Utility function for common haptic feedback patterns
 */
export const hapticPatterns = {
  buttonPress: () => hapticFeedback.trigger('light'),
  buttonLongPress: () => hapticFeedback.trigger('medium'),
  selection: () => hapticFeedback.trigger('selection'),
  success: () => hapticFeedback.trigger('success'),
  warning: () => hapticFeedback.trigger('warning'),
  error: () => hapticFeedback.trigger('error'),
  navigation: () => hapticFeedback.trigger('light'),
  swipe: () => hapticFeedback.trigger('light'),
  toggle: () => hapticFeedback.trigger('selection'),
  impact: () => hapticFeedback.trigger('impact'),
  notification: () => hapticFeedback.trigger('notification')
};

export default hapticFeedback;





