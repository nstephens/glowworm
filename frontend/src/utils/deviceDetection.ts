/**
 * Device detection utilities for performance optimization
 */

export interface DeviceInfo {
  isRaspberryPi: boolean;
  isLowPower: boolean;
  hasHardwareAcceleration: boolean;
  recommendedOptimizations: string[];
}

/**
 * Detect if running on Raspberry Pi or similar low-power device
 */
export function detectDevice(): DeviceInfo {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();
  
  // Check for Raspberry Pi indicators
  const isRaspberryPi = 
    userAgent.includes('raspberry') ||
    userAgent.includes('armv7l') ||
    userAgent.includes('armv8l') ||
    userAgent.includes('aarch64') ||
    platform.includes('arm') ||
    // Check for common Pi hostnames
    window.location.hostname.includes('raspberry') ||
    window.location.hostname.includes('pi-') ||
    window.location.hostname.includes('rpi-');
  
  // Check for low-power device indicators
  const isLowPower = 
    isRaspberryPi ||
    userAgent.includes('mobile') ||
    userAgent.includes('android') ||
    navigator.hardwareConcurrency <= 4;
  
  // Check for hardware acceleration support
  const hasHardwareAcceleration = 
    'WebGLRenderingContext' in window ||
    'WebGL2RenderingContext' in window;
  
  const recommendedOptimizations: string[] = [];
  
  if (isRaspberryPi) {
    recommendedOptimizations.push(
      'pi-mode',
      'pi-optimized',
      'pi-image-transition'
    );
  }
  
  if (isLowPower) {
    recommendedOptimizations.push('low-power-mode');
  }
  
  return {
    isRaspberryPi,
    isLowPower,
    hasHardwareAcceleration,
    recommendedOptimizations
  };
}

/**
 * Apply device-specific optimizations to the document
 */
export function applyDeviceOptimizations(): DeviceInfo {
  const deviceInfo = detectDevice();
  
  // Add device-specific classes to body
  if (deviceInfo.isRaspberryPi) {
    document.body.classList.add('pi-mode');
  }
  
  if (deviceInfo.isLowPower) {
    document.body.classList.add('low-power-mode');
  }
  
  // Log device info for debugging
  console.log('Device Detection:', deviceInfo);
  
  return deviceInfo;
}

/**
 * Get optimized image dimensions for the current device
 */
export function getOptimizedImageDimensions(originalWidth: number, originalHeight: number): { width: number; height: number } {
  const deviceInfo = detectDevice();
  
  if (deviceInfo.isRaspberryPi) {
    // For Pi, limit to 1080p max resolution
    const maxDimension = 1920;
    const aspectRatio = originalWidth / originalHeight;
    
    if (originalWidth > maxDimension || originalHeight > maxDimension) {
      if (originalWidth > originalHeight) {
        return {
          width: maxDimension,
          height: Math.round(maxDimension / aspectRatio)
        };
      } else {
        return {
          width: Math.round(maxDimension * aspectRatio),
          height: maxDimension
        };
      }
    }
  }
  
  return { width: originalWidth, height: originalHeight };
}

/**
 * Get optimized transition duration for the current device
 */
export function getOptimizedTransitionDuration(): number {
  const deviceInfo = detectDevice();
  
  if (deviceInfo.isRaspberryPi) {
    return 300; // Shorter transitions for Pi
  }
  
  return 500; // Default duration
}
