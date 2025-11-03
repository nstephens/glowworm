/**
 * Service Worker registration and management utilities
 */

interface ServiceWorkerConfig {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onOffline?: () => void;
  onOnline?: () => void;
}

class ServiceWorkerManager {
  private registration: ServiceWorkerRegistration | null = null;
  private config: ServiceWorkerConfig = {};

  constructor(config: ServiceWorkerConfig = {}) {
    this.config = config;
  }

  /**
   * Register the service worker
   */
  async register(): Promise<ServiceWorkerRegistration | null> {
    // Only register in supported browsers and in production
    const isSupported = 'serviceWorker' in navigator;
    const isProd = typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.PROD;
    if (!isSupported || !isProd) {
      // Quietly no-op in unsupported environments or during development
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      });

      this.registration = registration;

      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available
              this.config.onUpdate?.(registration);
            }
          });
        }
      });

      // Handle successful registration
      if (registration.active) {
        this.config.onSuccess?.(registration);
      }

      // Set up network status listeners
      this.setupNetworkListeners();

      console.log('Service Worker registered successfully');
      return registration;

    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return null;
    }
  }

  /**
   * Unregister the service worker
   */
  async unregister(): Promise<boolean> {
    if (!this.registration) {
      return false;
    }

    try {
      const result = await this.registration.unregister();
      this.registration = null;
      console.log('Service Worker unregistered');
      return result;
    } catch (error) {
      console.error('Service Worker unregistration failed:', error);
      return false;
    }
  }

  /**
   * Check for updates
   */
  async checkForUpdates(): Promise<void> {
    if (!this.registration) {
      return;
    }

    try {
      await this.registration.update();
    } catch (error) {
      console.error('Failed to check for updates:', error);
    }
  }

  /**
   * Skip waiting and reload
   */
  async skipWaitingAndReload(): Promise<void> {
    if (!this.registration || !this.registration.waiting) {
      return;
    }

    // Tell the waiting service worker to skip waiting
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // Reload the page
    window.location.reload();
  }

  /**
   * Get cache information
   */
  async getCacheInfo(): Promise<{ name: string; size: number }[]> {
    if (!('caches' in window)) {
      return [];
    }

    const cacheNames = await caches.keys();
    const cacheInfo = await Promise.all(
      cacheNames.map(async (name) => {
        const cache = await caches.open(name);
        const keys = await cache.keys();
        return {
          name,
          size: keys.length,
        };
      })
    );

    return cacheInfo;
  }

  /**
   * Clear all caches
   */
  async clearAllCaches(): Promise<void> {
    if (!('caches' in window)) {
      return;
    }

    const cacheNames = await caches.keys();
    await Promise.all(
      cacheNames.map(name => caches.delete(name))
    );

    console.log('All caches cleared');
  }

  /**
   * Clear specific cache
   */
  async clearCache(cacheName: string): Promise<boolean> {
    if (!('caches' in window)) {
      return false;
    }

    try {
      const result = await caches.delete(cacheName);
      console.log(`Cache ${cacheName} cleared:`, result);
      return result;
    } catch (error) {
      console.error(`Failed to clear cache ${cacheName}:`, error);
      return false;
    }
  }

  /**
   * Precache specific URLs
   */
  async precache(urls: string[]): Promise<void> {
    if (!this.registration || !this.registration.active) {
      return;
    }

    try {
      // Send message to service worker to precache URLs
      this.registration.active.postMessage({
        type: 'PRECACHE',
        urls,
      });
    } catch (error) {
      console.error('Failed to precache URLs:', error);
    }
  }

  /**
   * Set up network status listeners
   */
  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      console.log('Network: Online');
      this.config.onOnline?.();
    });

    window.addEventListener('offline', () => {
      console.log('Network: Offline');
      this.config.onOffline?.();
    });
  }

  /**
   * Get registration status
   */
  getRegistration(): ServiceWorkerRegistration | null {
    return this.registration;
  }

  /**
   * Check if service worker is supported
   */
  static isSupported(): boolean {
    return 'serviceWorker' in navigator;
  }

  /**
   * Check if the app is running in a service worker context
   */
  static isServiceWorkerContext(): boolean {
    return typeof self !== 'undefined' && 'ServiceWorkerGlobalScope' in self;
  }
}

// Create default instance
const serviceWorkerManager = new ServiceWorkerManager();

// Default configuration
const defaultConfig: ServiceWorkerConfig = {
  onUpdate: (registration) => {
    console.log('New content available, please refresh');
    // You could show a notification to the user here
  },
  onSuccess: (registration) => {
    console.log('Service Worker is ready');
  },
  onOffline: () => {
    console.log('App is offline');
    // You could show an offline indicator here
  },
  onOnline: () => {
    console.log('App is online');
    // You could hide the offline indicator here
  },
};

// Register service worker with default config
export const registerServiceWorker = async (config: ServiceWorkerConfig = {}): Promise<ServiceWorkerRegistration | null> => {
  const mergedConfig = { ...defaultConfig, ...config };
  serviceWorkerManager['config'] = mergedConfig;
  return await serviceWorkerManager.register();
};

// Export the manager instance and utilities
export {
  ServiceWorkerManager,
  serviceWorkerManager,
  defaultConfig,
};

// Export individual functions for convenience
export const unregisterServiceWorker = () => serviceWorkerManager.unregister();
export const checkForUpdates = () => serviceWorkerManager.checkForUpdates();
export const skipWaitingAndReload = () => serviceWorkerManager.skipWaitingAndReload();
export const getCacheInfo = () => serviceWorkerManager.getCacheInfo();
export const clearAllCaches = () => serviceWorkerManager.clearAllCaches();
export const clearCache = (cacheName: string) => serviceWorkerManager.clearCache(cacheName);
export const precache = (urls: string[]) => serviceWorkerManager.precache(urls);

export default serviceWorkerManager;