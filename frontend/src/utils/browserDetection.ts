// Browser Detection and Compatibility Utilities
// Provides utilities for detecting browser capabilities and ensuring cross-browser compatibility

interface BrowserInfo {
  name: string;
  version: number;
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isSupported: boolean;
  capabilities: BrowserCapabilities;
}

interface BrowserCapabilities {
  webp: boolean;
  avif: boolean;
  webgl: boolean;
  webWorkers: boolean;
  serviceWorker: boolean;
  intersectionObserver: boolean;
  resizeObserver: boolean;
  customElements: boolean;
  shadowDOM: boolean;
  cssGrid: boolean;
  flexbox: boolean;
  cssVariables: boolean;
  es6Modules: boolean;
  asyncAwait: boolean;
  fetch: boolean;
  localStorage: boolean;
  sessionStorage: boolean;
  indexedDB: boolean;
  webRTC: boolean;
  webAudio: boolean;
  webSpeech: boolean;
  geolocation: boolean;
  notifications: boolean;
  pushNotifications: boolean;
  backgroundSync: boolean;
  cacheAPI: boolean;
  requestIdleCallback: boolean;
  requestAnimationFrame: boolean;
  performanceObserver: boolean;
  intersectionObserverV2: boolean;
  passiveEventListeners: boolean;
  touchEvents: boolean;
  pointerEvents: boolean;
  mediaQueries: boolean;
  prefersReducedMotion: boolean;
  prefersColorScheme: boolean;
  prefersContrast: boolean;
  forcedColors: boolean;
}

class BrowserDetector {
  private static instance: BrowserDetector;
  private browserInfo: BrowserInfo | null = null;
  private capabilities: BrowserCapabilities | null = null;

  static getInstance(): BrowserDetector {
    if (!BrowserDetector.instance) {
      BrowserDetector.instance = new BrowserDetector();
    }
    return BrowserDetector.instance;
  }

  async detectBrowser(): Promise<BrowserInfo> {
    if (this.browserInfo) {
      return this.browserInfo;
    }

    const userAgent = navigator.userAgent;
    let browserName: string;
    let browserVersion: number;
    let isMobile: boolean;
    let isIOS: boolean;
    let isAndroid: boolean;

    // Detect browser name and version
    if (userAgent.match(/chrome|chromium|crios/i)) {
      browserName = 'chrome';
      const match = userAgent.match(/(?:chrome|chromium|crios)\/([\d.]+)/);
      browserVersion = match ? parseFloat(match[1]) : 0;
    } else if (userAgent.match(/firefox|fxios/i)) {
      browserName = 'firefox';
      const match = userAgent.match(/(?:firefox|fxios)\/([\d.]+)/);
      browserVersion = match ? parseFloat(match[1]) : 0;
    } else if (userAgent.match(/safari/i) && !userAgent.match(/chrome|chromium|crios/i)) {
      browserName = 'safari';
      const match = userAgent.match(/version\/([\d.]+)/);
      browserVersion = match ? parseFloat(match[1]) : 0;
    } else if (userAgent.match(/edg/i)) {
      browserName = 'edge';
      const match = userAgent.match(/edg\/([\d.]+)/);
      browserVersion = match ? parseFloat(match[1]) : 0;
    } else {
      browserName = 'unknown';
      browserVersion = 0;
    }

    // Detect mobile and platform
    isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    isIOS = /iPhone|iPad|iPod/i.test(userAgent);
    isAndroid = /Android/i.test(userAgent);

    // Check if browser is supported
    const isSupported = this.checkBrowserSupport(browserName, browserVersion);

    // Detect capabilities
    const capabilities = await this.detectCapabilities();

    this.browserInfo = {
      name: browserName,
      version: browserVersion,
      isMobile,
      isIOS,
      isAndroid,
      isSupported,
      capabilities,
    };

    return this.browserInfo;
  }

  private checkBrowserSupport(name: string, version: number): boolean {
    const supportedBrowsers = {
      chrome: 90,
      firefox: 88,
      safari: 14,
      edge: 90,
    };

    const minVersion = supportedBrowsers[name as keyof typeof supportedBrowsers];
    return minVersion ? version >= minVersion : false;
  }

  private async detectCapabilities(): Promise<BrowserCapabilities> {
    if (this.capabilities) {
      return this.capabilities;
    }

    const capabilities: BrowserCapabilities = {
      webp: await this.checkWebpSupport(),
      avif: await this.checkAvifSupport(),
      webgl: this.checkWebGLSupport(),
      webWorkers: typeof Worker !== 'undefined',
      serviceWorker: 'serviceWorker' in navigator,
      intersectionObserver: 'IntersectionObserver' in window,
      resizeObserver: 'ResizeObserver' in window,
      customElements: 'customElements' in window,
      shadowDOM: 'attachShadow' in Element.prototype,
      cssGrid: this.checkCSSGridSupport(),
      flexbox: this.checkFlexboxSupport(),
      cssVariables: this.checkCSSVariablesSupport(),
      es6Modules: 'noModule' in HTMLScriptElement.prototype,
      asyncAwait: this.checkAsyncAwaitSupport(),
      fetch: 'fetch' in window,
      localStorage: this.checkLocalStorageSupport(),
      sessionStorage: this.checkSessionStorageSupport(),
      indexedDB: 'indexedDB' in window,
      webRTC: 'RTCPeerConnection' in window,
      webAudio: 'AudioContext' in window || 'webkitAudioContext' in window,
      webSpeech: 'speechSynthesis' in window,
      geolocation: 'geolocation' in navigator,
      notifications: 'Notification' in window,
      pushNotifications: 'PushManager' in window,
      backgroundSync: 'serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype,
      cacheAPI: 'caches' in window,
      requestIdleCallback: 'requestIdleCallback' in window,
      requestAnimationFrame: 'requestAnimationFrame' in window,
      performanceObserver: 'PerformanceObserver' in window,
      intersectionObserverV2: 'IntersectionObserver' in window && 'isIntersecting' in IntersectionObserverEntry.prototype,
      passiveEventListeners: this.checkPassiveEventListenersSupport(),
      touchEvents: 'ontouchstart' in window,
      pointerEvents: 'onpointerdown' in window,
      mediaQueries: 'matchMedia' in window,
      prefersReducedMotion: this.checkPrefersReducedMotionSupport(),
      prefersColorScheme: this.checkPrefersColorSchemeSupport(),
      prefersContrast: this.checkPrefersContrastSupport(),
      forcedColors: this.checkForcedColorsSupport(),
    };

    this.capabilities = capabilities;
    return capabilities;
  }

  private async checkWebpSupport(): Promise<boolean> {
    return new Promise((resolve) => {
      const webp = new Image();
      webp.onload = () => resolve(true);
      webp.onerror = () => resolve(false);
      webp.src = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
    });
  }

  private async checkAvifSupport(): Promise<boolean> {
    return new Promise((resolve) => {
      const avif = new Image();
      avif.onload = () => resolve(true);
      avif.onerror = () => resolve(false);
      avif.src = 'data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=';
    });
  }

  private checkWebGLSupport(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
    } catch (e) {
      return false;
    }
  }

  private checkCSSGridSupport(): boolean {
    return CSS.supports('display', 'grid');
  }

  private checkFlexboxSupport(): boolean {
    return CSS.supports('display', 'flex');
  }

  private checkCSSVariablesSupport(): boolean {
    return CSS.supports('color', 'var(--test)');
  }

  private checkAsyncAwaitSupport(): boolean {
    try {
      new Function('async () => {}');
      return true;
    } catch (e) {
      return false;
    }
  }

  private checkLocalStorageSupport(): boolean {
    try {
      const test = 'test';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  private checkSessionStorageSupport(): boolean {
    try {
      const test = 'test';
      sessionStorage.setItem(test, test);
      sessionStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }

  private checkPassiveEventListenersSupport(): boolean {
    let supportsPassive = false;
    try {
      const opts = Object.defineProperty({}, 'passive', {
        get: () => {
          supportsPassive = true;
          return true;
        }
      });
      window.addEventListener('testPassive', null, opts);
      window.removeEventListener('testPassive', null, opts);
    } catch (e) {
      // Ignore
    }
    return supportsPassive;
  }

  private checkPrefersReducedMotionSupport(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private checkPrefersColorSchemeSupport(): boolean {
    return window.matchMedia('(prefers-color-scheme: dark)').matches !== undefined;
  }

  private checkPrefersContrastSupport(): boolean {
    return window.matchMedia('(prefers-contrast: high)').matches !== undefined;
  }

  private checkForcedColorsSupport(): boolean {
    return window.matchMedia('(forced-colors: active)').matches;
  }

  getBrowserInfo(): BrowserInfo | null {
    return this.browserInfo;
  }

  getCapabilities(): BrowserCapabilities | null {
    return this.capabilities;
  }

  isFeatureSupported(feature: keyof BrowserCapabilities): boolean {
    return this.capabilities?.[feature] || false;
  }

  getUnsupportedFeatures(): string[] {
    if (!this.capabilities) return [];
    
    const requiredFeatures: (keyof BrowserCapabilities)[] = [
      'webgl',
      'webWorkers',
      'serviceWorker',
      'intersectionObserver',
      'cssGrid',
      'flexbox',
      'cssVariables',
      'fetch',
      'localStorage',
      'requestAnimationFrame',
    ];

    return requiredFeatures.filter(feature => !this.capabilities![feature]);
  }

  getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    
    if (!this.capabilities?.webp) {
      recommendations.push('Consider using WebP images for better compression');
    }
    
    if (!this.capabilities?.avif) {
      recommendations.push('Consider using AVIF images for even better compression');
    }
    
    if (!this.capabilities?.intersectionObserver) {
      recommendations.push('Implement fallback for lazy loading without IntersectionObserver');
    }
    
    if (!this.capabilities?.serviceWorker) {
      recommendations.push('Implement fallback caching strategy without Service Worker');
    }
    
    return recommendations;
  }
}

// Export utilities
export { BrowserDetector };
export type { BrowserInfo, BrowserCapabilities };

// Create global instance
const browserDetector = BrowserDetector.getInstance();

// Export convenience functions
export async function detectBrowser(): Promise<BrowserInfo> {
  return await browserDetector.detectBrowser();
}

export function getBrowserInfo(): BrowserInfo | null {
  return browserDetector.getBrowserInfo();
}

export function getCapabilities(): BrowserCapabilities | null {
  return browserDetector.getCapabilities();
}

export function isFeatureSupported(feature: keyof BrowserCapabilities): boolean {
  return browserDetector.isFeatureSupported(feature);
}

export function getUnsupportedFeatures(): string[] {
  return browserDetector.getUnsupportedFeatures();
}

export function getPerformanceRecommendations(): string[] {
  return browserDetector.getPerformanceRecommendations();
}
