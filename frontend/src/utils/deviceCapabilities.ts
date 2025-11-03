/**
 * Device Capability Detection Utility
 * 
 * Detects hardware capabilities and classifies devices into performance tiers
 * to help users select appropriate display modes for their hardware.
 */

import { PerformanceTier } from '../types/displayModes';

/**
 * Comprehensive device capabilities
 */
export interface DeviceCapabilities {
  /** Performance tier classification */
  tier: PerformanceTier;
  
  /** Whether WebGL is supported */
  supportsWebGL: boolean;
  
  /** WebGL version if available */
  webGLVersion?: '1' | '2';
  
  /** Whether Canvas API is supported */
  supportsCanvas: boolean;
  
  /** Estimated frames per second capability */
  estimatedFPS: number;
  
  /** Number of logical CPU cores */
  cpuCores: number;
  
  /** Device memory in GB (if available) */
  memory?: number;
  
  /** Device type detection */
  deviceType: 'desktop' | 'tablet' | 'mobile' | 'raspberry-pi' | 'unknown';
  
  /** GPU vendor if detectable */
  gpuVendor?: string;
  
  /** GPU renderer if detectable */
  gpuRenderer?: string;
  
  /** Whether hardware acceleration is available */
  hardwareAcceleration: boolean;
  
  /** Browser name */
  browser: string;
  
  /** Whether device has touch support */
  hasTouch: boolean;
  
  /** Screen width in pixels */
  screenWidth: number;
  
  /** Screen height in pixels */
  screenHeight: number;
  
  /** Device pixel ratio */
  pixelRatio: number;
}

/**
 * Detect if WebGL is supported
 */
function detectWebGL(): { supported: boolean; version?: '1' | '2'; vendor?: string; renderer?: string } {
  try {
    const canvas = document.createElement('canvas');
    
    // Try WebGL 2 first
    let gl = canvas.getContext('webgl2');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        supported: true,
        version: '2',
        vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : undefined,
        renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : undefined,
      };
    }
    
    // Fall back to WebGL 1
    gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (gl) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      return {
        supported: true,
        version: '1',
        vendor: debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : undefined,
        renderer: debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : undefined,
      };
    }
    
    return { supported: false };
  } catch (e) {
    console.warn('WebGL detection failed:', e);
    return { supported: false };
  }
}

/**
 * Detect if Canvas API is supported
 */
function detectCanvas(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext && canvas.getContext('2d'));
  } catch (e) {
    return false;
  }
}

/**
 * Detect browser name
 */
function detectBrowser(): string {
  const userAgent = navigator.userAgent;
  
  if (userAgent.includes('Firefox')) return 'Firefox';
  if (userAgent.includes('Edg')) return 'Edge';
  if (userAgent.includes('Chrome')) return 'Chrome';
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari';
  if (userAgent.includes('Opera') || userAgent.includes('OPR')) return 'Opera';
  
  return 'Unknown';
}

/**
 * Detect if running on Raspberry Pi
 */
function isRaspberryPi(): boolean {
  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform?.toLowerCase() || '';
  
  // Check for common Raspberry Pi indicators
  return (
    platform.includes('arm') ||
    userAgent.includes('raspbian') ||
    userAgent.includes('raspberry') ||
    // Raspberry Pi often reports as Linux armv7l
    (platform.includes('linux') && userAgent.includes('arm'))
  );
}

/**
 * Detect device type
 */
function detectDeviceType(): 'desktop' | 'tablet' | 'mobile' | 'raspberry-pi' | 'unknown' {
  // Check for Raspberry Pi first
  if (isRaspberryPi()) {
    return 'raspberry-pi';
  }
  
  const userAgent = navigator.userAgent.toLowerCase();
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Mobile detection
  if (userAgent.includes('mobile') || userAgent.includes('android')) {
    return 'mobile';
  }
  
  // Tablet detection
  if (
    userAgent.includes('tablet') ||
    userAgent.includes('ipad') ||
    (hasTouch && window.innerWidth >= 768)
  ) {
    return 'tablet';
  }
  
  // Desktop detection
  if (
    userAgent.includes('windows') ||
    userAgent.includes('macintosh') ||
    userAgent.includes('linux')
  ) {
    return 'desktop';
  }
  
  return 'unknown';
}

/**
 * Estimate FPS capability based on device characteristics
 */
function estimateFPS(
  deviceType: string,
  cpuCores: number,
  memory: number | undefined,
  gpuRenderer: string | undefined
): number {
  // Raspberry Pi detection
  if (deviceType === 'raspberry-pi') {
    // Raspberry Pi 4 has 4 cores, Pi 3 has 4 cores, Pi Zero has 1 core
    if (cpuCores >= 4) {
      return 30; // RPi 4
    } else if (cpuCores >= 2) {
      return 24; // RPi 3
    } else {
      return 15; // RPi Zero
    }
  }
  
  // Desktop/Laptop with dedicated GPU
  if (deviceType === 'desktop') {
    const hasNvidiaGPU = gpuRenderer?.toLowerCase().includes('nvidia') || false;
    const hasAMDGPU = gpuRenderer?.toLowerCase().includes('amd') || gpuRenderer?.toLowerCase().includes('radeon') || false;
    const hasIntelGPU = gpuRenderer?.toLowerCase().includes('intel') || false;
    
    if (hasNvidiaGPU || hasAMDGPU) {
      return 60; // Dedicated GPU
    } else if (hasIntelGPU) {
      return 45; // Integrated GPU
    } else if (cpuCores >= 4) {
      return 30; // Multi-core CPU
    }
  }
  
  // Tablets (typically good performance)
  if (deviceType === 'tablet') {
    return 45;
  }
  
  // Mobile devices
  if (deviceType === 'mobile') {
    return 30;
  }
  
  // Default conservative estimate
  return 24;
}

/**
 * Classify device into performance tier
 */
function classifyPerformanceTier(
  deviceType: string,
  cpuCores: number,
  memory: number | undefined,
  estimatedFPS: number,
  supportsWebGL: boolean
): PerformanceTier {
  // Raspberry Pi devices
  if (deviceType === 'raspberry-pi') {
    if (cpuCores >= 4 && estimatedFPS >= 30) {
      return PerformanceTier.TIER_2; // RPi 4 can handle Tier 2
    }
    return PerformanceTier.TIER_1; // RPi 3 and below stay at Tier 1
  }
  
  // Desktop with WebGL and good specs
  if (deviceType === 'desktop') {
    if (supportsWebGL && estimatedFPS >= 60 && cpuCores >= 4) {
      return PerformanceTier.TIER_3; // High-end desktop
    } else if (estimatedFPS >= 45 && cpuCores >= 4) {
      return PerformanceTier.TIER_2; // Mid-range desktop
    } else {
      return PerformanceTier.TIER_1; // Low-end desktop
    }
  }
  
  // Tablets (typically Tier 2)
  if (deviceType === 'tablet') {
    if (supportsWebGL && estimatedFPS >= 45) {
      return PerformanceTier.TIER_2;
    }
    return PerformanceTier.TIER_1;
  }
  
  // Mobile devices (typically Tier 1)
  if (deviceType === 'mobile') {
    return PerformanceTier.TIER_1;
  }
  
  // Conservative default for unknown devices
  return PerformanceTier.TIER_1;
}

/**
 * Detect if hardware acceleration is available
 */
function detectHardwareAcceleration(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: false });
    
    if (!ctx) return false;
    
    // Check if ImageBitmapRenderingContext is available (indicator of hardware acceleration)
    const bitmapSupported = typeof createImageBitmap === 'function';
    const offscreenSupported = typeof OffscreenCanvas !== 'undefined';
    
    return bitmapSupported || offscreenSupported;
  } catch (e) {
    return false;
  }
}

/**
 * Main function to detect comprehensive device capabilities
 */
export function detectDeviceCapabilities(): DeviceCapabilities {
  // Detect WebGL
  const webgl = detectWebGL();
  
  // Detect Canvas
  const canvas = detectCanvas();
  
  // Detect device type
  const deviceType = detectDeviceType();
  
  // Detect browser
  const browser = detectBrowser();
  
  // Get CPU cores (with fallback)
  const cpuCores = navigator.hardwareConcurrency || 2;
  
  // Get device memory if available (Chrome only)
  const memory = (navigator as any).deviceMemory;
  
  // Detect touch support
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  
  // Get screen dimensions
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;
  const pixelRatio = window.devicePixelRatio || 1;
  
  // Detect hardware acceleration
  const hardwareAcceleration = detectHardwareAcceleration();
  
  // Estimate FPS capability
  const estimatedFPS = estimateFPS(deviceType, cpuCores, memory, webgl.renderer);
  
  // Classify into performance tier
  const tier = classifyPerformanceTier(
    deviceType,
    cpuCores,
    memory,
    estimatedFPS,
    webgl.supported
  );
  
  return {
    tier,
    supportsWebGL: webgl.supported,
    webGLVersion: webgl.version,
    supportsCanvas: canvas,
    estimatedFPS,
    cpuCores,
    memory,
    deviceType,
    gpuVendor: webgl.vendor,
    gpuRenderer: webgl.renderer,
    hardwareAcceleration,
    browser,
    hasTouch,
    screenWidth,
    screenHeight,
    pixelRatio,
  };
}

/**
 * Get a singleton instance of device capabilities
 * (cached after first detection)
 */
let cachedCapabilities: DeviceCapabilities | null = null;

export function getDeviceCapabilities(): DeviceCapabilities {
  if (!cachedCapabilities) {
    cachedCapabilities = detectDeviceCapabilities();
    console.log('Device capabilities detected:', cachedCapabilities);
  }
  return cachedCapabilities;
}

/**
 * Check if device can handle a specific performance tier
 */
export function canHandleTier(requiredTier: PerformanceTier): boolean {
  const capabilities = getDeviceCapabilities();
  return capabilities.tier >= requiredTier;
}

/**
 * Get recommended display modes for current device
 */
export function getRecommendedTier(): PerformanceTier {
  return getDeviceCapabilities().tier;
}

/**
 * Get user-friendly device description
 */
export function getDeviceDescription(): string {
  const caps = getDeviceCapabilities();
  
  const parts: string[] = [];
  
  // Device type
  if (caps.deviceType === 'raspberry-pi') {
    parts.push('Raspberry Pi');
  } else {
    parts.push(caps.deviceType.charAt(0).toUpperCase() + caps.deviceType.slice(1));
  }
  
  // Browser
  parts.push(`(${caps.browser})`);
  
  // Cores
  parts.push(`${caps.cpuCores} cores`);
  
  // Memory if available
  if (caps.memory) {
    parts.push(`${caps.memory}GB RAM`);
  }
  
  // GPU info if available
  if (caps.gpuRenderer) {
    const renderer = caps.gpuRenderer.split(' ').slice(0, 3).join(' '); // Truncate long names
    parts.push(`GPU: ${renderer}`);
  }
  
  return parts.join(', ');
}

/**
 * Get performance tier icon
 */
export function getTierIcon(tier: PerformanceTier): string {
  switch (tier) {
    case PerformanceTier.TIER_1:
      return '✓';
    case PerformanceTier.TIER_2:
      return '⚠';
    case PerformanceTier.TIER_3:
      return '⚡';
  }
}

/**
 * Get performance tier color class
 */
export function getTierColorClass(tier: PerformanceTier): string {
  switch (tier) {
    case PerformanceTier.TIER_1:
      return 'text-green-600';
    case PerformanceTier.TIER_2:
      return 'text-yellow-600';
    case PerformanceTier.TIER_3:
      return 'text-red-600';
  }
}

/**
 * Log detailed capabilities for debugging
 */
export function logDeviceCapabilities(): void {
  const caps = getDeviceCapabilities();
  
  console.group('📊 Device Capabilities');
  console.log('Performance Tier:', caps.tier);
  console.log('Device Type:', caps.deviceType);
  console.log('Browser:', caps.browser);
  console.log('CPU Cores:', caps.cpuCores);
  console.log('Memory:', caps.memory ? `${caps.memory}GB` : 'Unknown');
  console.log('Estimated FPS:', caps.estimatedFPS);
  console.log('WebGL Support:', caps.supportsWebGL ? `Yes (v${caps.webGLVersion})` : 'No');
  console.log('Canvas Support:', caps.supportsCanvas ? 'Yes' : 'No');
  console.log('Hardware Acceleration:', caps.hardwareAcceleration ? 'Yes' : 'No');
  
  if (caps.gpuVendor || caps.gpuRenderer) {
    console.group('GPU Info');
    console.log('Vendor:', caps.gpuVendor || 'Unknown');
    console.log('Renderer:', caps.gpuRenderer || 'Unknown');
    console.groupEnd();
  }
  
  console.group('Display Info');
  console.log('Screen:', `${caps.screenWidth}x${caps.screenHeight}`);
  console.log('Pixel Ratio:', caps.pixelRatio);
  console.log('Touch Support:', caps.hasTouch ? 'Yes' : 'No');
  console.groupEnd();
  
  console.groupEnd();
}

