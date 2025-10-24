// Service Worker Registration and Management
// Provides utilities for registering, updating, and managing the service worker

interface ServiceWorkerConfig {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onOfflineReady?: () => void;
  onError?: (error: Error) => void;
}

interface ServiceWorkerState {
  isSupported: boolean;
  isRegistered: boolean;
  isUpdated: boolean;
  isOfflineReady: boolean;
  registration: ServiceWorkerRegistration | null;
}

class ServiceWorkerManager {
  private config: ServiceWorkerConfig;
  private state: ServiceWorkerState = {
    isSupported: false,
    isRegistered: false,
    isUpdated: false,
    isOfflineReady: false,
    registration: null,
  };

  constructor(config: ServiceWorkerConfig = {}) {
    this.config = config;
    this.checkSupport();
  }

  private checkSupport(): void {
    this.state.isSupported = 'serviceWorker' in navigator;
  }

  async register(): Promise<ServiceWorkerRegistration | null> {
    if (!this.state.isSupported) {
      console.warn('Service Worker: Not supported in this browser');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      this.state.registration = registration;
      this.state.isRegistered = true;

      console.log('Service Worker: Registered successfully', registration);

      // Handle registration success
      this.config.onSuccess?.(registration);

      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // New content is available
                this.state.isUpdated = true;
                this.config.onUpdate?.(registration);
              } else {
                // Content is cached for offline use
                this.state.isOfflineReady = true;
                this.config.onOfflineReady?.();
              }
            }
          });
        }
      });

      // Handle controller change
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });

      return registration;
    } catch (error) {
      console.error('Service Worker: Registration failed', error);
      this.config.onError?.(error as Error);
      return null;
    }
  }

  async unregister(): Promise<boolean> {
    if (!this.state.registration) {
      return false;
    }

    try {
      const result = await this.state.registration.unregister();
      this.state.isRegistered = false;
      this.state.registration = null;
      console.log('Service Worker: Unregistered', result);
      return result;
    } catch (error) {
      console.error('Service Worker: Unregistration failed', error);
      return false;
    }
  }

  async update(): Promise<void> {
    if (!this.state.registration) {
      return;
    }

    try {
      await this.state.registration.update();
      console.log('Service Worker: Update requested');
    } catch (error) {
      console.error('Service Worker: Update failed', error);
    }
  }

  async skipWaiting(): Promise<void> {
    if (!this.state.registration || !this.state.registration.waiting) {
      return;
    }

    try {
      this.state.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      console.log('Service Worker: Skip waiting requested');
    } catch (error) {
      console.error('Service Worker: Skip waiting failed', error);
    }
  }

  async clearCache(): Promise<void> {
    if (!this.state.isSupported) {
      return;
    }

    try {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => name.startsWith('glowworm-'))
          .map(name => caches.delete(name))
      );
      console.log('Service Worker: Cache cleared');
    } catch (error) {
      console.error('Service Worker: Cache clear failed', error);
    }
  }

  async getCacheSize(): Promise<number> {
    if (!this.state.isSupported) {
      return 0;
    }

    try {
      const cacheNames = await caches.keys();
      let totalSize = 0;

      for (const cacheName of cacheNames) {
        if (cacheName.startsWith('glowworm-')) {
          const cache = await caches.open(cacheName);
          const keys = await cache.keys();
          
          for (const key of keys) {
            const response = await cache.match(key);
            if (response) {
              const blob = await response.blob();
              totalSize += blob.size;
            }
          }
        }
      }

      return totalSize;
    } catch (error) {
      console.error('Service Worker: Cache size calculation failed', error);
      return 0;
    }
  }

  getState(): ServiceWorkerState {
    return { ...this.state };
  }

  isOnline(): boolean {
    return navigator.onLine;
  }

  addOnlineListener(callback: () => void): void {
    window.addEventListener('online', callback);
  }

  addOfflineListener(callback: () => void): void {
    window.addEventListener('offline', callback);
  }

  removeOnlineListener(callback: () => void): void {
    window.removeEventListener('online', callback);
  }

  removeOfflineListener(callback: () => void): void {
    window.removeEventListener('offline', callback);
  }
}

// Create global instance
let swManager: ServiceWorkerManager | null = null;

export function initializeServiceWorker(config: ServiceWorkerConfig = {}): ServiceWorkerManager {
  if (!swManager) {
    swManager = new ServiceWorkerManager(config);
  }
  return swManager;
}

export function getServiceWorkerManager(): ServiceWorkerManager | null {
  return swManager;
}

// Utility functions
export async function registerServiceWorker(config: ServiceWorkerConfig = {}): Promise<ServiceWorkerRegistration | null> {
  const manager = initializeServiceWorker(config);
  return await manager.register();
}

export async function unregisterServiceWorker(): Promise<boolean> {
  const manager = getServiceWorkerManager();
  if (!manager) return false;
  return await manager.unregister();
}

export async function updateServiceWorker(): Promise<void> {
  const manager = getServiceWorkerManager();
  if (!manager) return;
  await manager.update();
}

export async function skipWaitingServiceWorker(): Promise<void> {
  const manager = getServiceWorkerManager();
  if (!manager) return;
  await manager.skipWaiting();
}

export async function clearServiceWorkerCache(): Promise<void> {
  const manager = getServiceWorkerManager();
  if (!manager) return;
  await manager.clearCache();
}

export async function getServiceWorkerCacheSize(): Promise<number> {
  const manager = getServiceWorkerManager();
  if (!manager) return 0;
  return await manager.getCacheSize();
}

export function isServiceWorkerSupported(): boolean {
  return 'serviceWorker' in navigator;
}

export function isOnline(): boolean {
  return navigator.onLine;
}

// React hook for service worker
export function useServiceWorker(config: ServiceWorkerConfig = {}) {
  const [state, setState] = React.useState<ServiceWorkerState>({
    isSupported: false,
    isRegistered: false,
    isUpdated: false,
    isOfflineReady: false,
    registration: null,
  });

  React.useEffect(() => {
    const manager = initializeServiceWorker({
      ...config,
      onUpdate: (registration) => {
        setState(prev => ({ ...prev, isUpdated: true, registration }));
        config.onUpdate?.(registration);
      },
      onSuccess: (registration) => {
        setState(prev => ({ ...prev, isRegistered: true, registration }));
        config.onSuccess?.(registration);
      },
      onOfflineReady: () => {
        setState(prev => ({ ...prev, isOfflineReady: true }));
        config.onOfflineReady?.();
      },
      onError: (error) => {
        console.error('Service Worker Error:', error);
        config.onError?.(error);
      },
    });

    manager.register().then(() => {
      setState(manager.getState());
    });

    return () => {
      // Cleanup if needed
    };
  }, []);

  return {
    ...state,
    update: () => getServiceWorkerManager()?.update(),
    skipWaiting: () => getServiceWorkerManager()?.skipWaiting(),
    clearCache: () => getServiceWorkerManager()?.clearCache(),
    getCacheSize: () => getServiceWorkerManager()?.getCacheSize() || Promise.resolve(0),
  };
}
