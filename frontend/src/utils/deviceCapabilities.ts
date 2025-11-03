/**
 * Device Capability Detection Utility
 * 
 * Detects device capabilities to recommend appropriate display modes
 * and warn users about performance-intensive effects.
 */

import { PerformanceTier } from '../types/displayModes';

export interface DeviceCapabilities {
  /** Recommended performance tier for this device */
  tier: PerformanceTier;
  /** Whether WebGL is supported */
  supportsWebGL: boolean;
  /** Whether Canvas is supported */
  supportsCanvas: boolean;
  /** Estimated FPS capability */
  estimatedFPS: number;
  /** Number of CPU cores (if available) */
  cpuCores: number;
  /** Estimated memory in GB */
  memory: number;
  /** Device type */
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'raspberry-pi' | 'unknown';
}

/**
 * Detect if WebGL is supported
 */
export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch (e) {
    return false;
  }
}

/**
 * Detect if Canvas is supported
 */
export function supportsCanvas(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext && canvas.getContext('2d'));
  } catch (e) {
    return false;
  }
}

/**
 * Detect approximate device type
 */
function detectDeviceType(): DeviceCapabilities['deviceType'] {
  const userAgent = navigator.userAgent.toLowerCase();
  
  // Check for Raspberry Pi
  if (userAgent.includes('raspberry') || userAgent.includes('armv')) {
    return 'raspberry-pi';
  }
  
  // Check for mobile
  if (/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)) {
    if (/ipad|android.*tablet/i.test(userAgent)) {
      return 'tablet';
    }
    return 'mobile';
  }
  
  // Desktop
  if (!/mobile/i.test(userAgent)) {
    return 'desktop';
  }
  
  return 'unknown';
}

/**
 * Estimate device memory
 */
function estimateMemory(): number {
  // Try to use Performance Memory API (Chrome only)
  const performance = (window as any).performance;
  if (performance && performance.memory) {
    // Convert bytes to GB
    return performance.memory.jsHeapSizeLimit / (1024 * 1024 * 1024);
  }
  
  // Fallback estimates based on device type
  const deviceType = detectDeviceType();
  switch (deviceType) {
    case 'raspberry-pi':
      return 4; // Assume RPi4 4GB
    case 'mobile':
      return 4;
    case 'tablet':
      return 6;
    case 'desktop':
      return 8;
    default:
      return 4;
  }
}

/**
 * Estimate FPS capability
 */
function estimateFPS(deviceType: DeviceCapabilities['deviceType']): number {
  switch (deviceType) {
    case 'raspberry-pi':
      return 30;
    case 'mobile':
      return 60;
    case 'tablet':
      return 60;
    case 'desktop':
      return 60;
    default:
      return 30;
  }
}

/**
 * Determine recommended performance tier based on capabilities
 */
function determinePerformanceTier(
  deviceType: DeviceCapabilities['deviceType'],
  cpuCores: number,
  memory: number,
  supportsWebGL: boolean
): PerformanceTier {
  // Raspberry Pi and low-end devices: Tier 1 only
  if (deviceType === 'raspberry-pi' || memory < 4) {
    return PerformanceTier.TIER_1;
  }
  
  // Desktop or high-end tablet with WebGL: Can handle Tier 3
  if (deviceType === 'desktop' && supportsWebGL && cpuCores >= 4 && memory >= 8) {
    return PerformanceTier.TIER_3;
  }
  
  // Tablets and modern mobiles: Tier 2
  if ((deviceType === 'tablet' || deviceType === 'mobile') && cpuCores >= 4) {
    return PerformanceTier.TIER_2;
  }
  
  // Desktop without high specs: Tier 2
  if (deviceType === 'desktop') {
    return PerformanceTier.TIER_2;
  }
  
  // Default to Tier 1 for safety
  return PerformanceTier.TIER_1;
}

/**
 * Detect full device capabilities
 */
export function detectDeviceCapabilities(): DeviceCapabilities {
  const deviceType = detectDeviceType();
  const cpuCores = navigator.hardwareConcurrency || 4;
  const memory = estimateMemory();
  const hasWebGL = supportsWebGL();
  const hasCanvas = supportsCanvas();
  const estimatedFPS = estimateFPS(deviceType);
  const tier = determinePerformanceTier(deviceType, cpuCores, memory, hasWebGL);

  return {
    tier,
    supportsWebGL: hasWebGL,
    supportsCanvas: hasCanvas,
    estimatedFPS,
    cpuCores,
    memory,
    deviceType
  };
}

/**
 * Global device capabilities (cached)
 */
let cachedCapabilities: DeviceCapabilities | null = null;

/**
 * Get device capabilities (uses cache after first call)
 */
export function getDeviceCapabilities(): DeviceCapabilities {
  if (!cachedCapabilities) {
    cachedCapabilities = detectDeviceCapabilities();
  }
  return cachedCapabilities;
}

/**
 * Check if a specific tier is safe for this device
 */
export function isTierSafeForDevice(tier: PerformanceTier): boolean {
  const capabilities = getDeviceCapabilities();
  return tier <= capabilities.tier;
}
