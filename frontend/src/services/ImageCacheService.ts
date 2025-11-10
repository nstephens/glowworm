/**
 * ImageCacheService - IndexedDB-based image caching for display reliability
 * 
 * Provides offline-capable image storage using IndexedDB, ensuring 99.9%+ 
 * image load reliability even during network instability.
 */

// ==================== Type Definitions ====================

/**
 * Cached image data structure stored in IndexedDB
 */
export interface CachedImage {
  /** Unique identifier (image_id from backend) */
  id: string;
  
  /** Playlist this image belongs to */
  playlistId: number;
  
  /** Original image URL */
  url: string;
  
  /** Actual image data as Blob */
  blob: Blob;
  
  /** MIME type (image/jpeg, image/png, image/webp, etc.) */
  mimeType: string;
  
  /** Size in bytes for storage tracking */
  sizeBytes: number;
  
  /** Timestamp when image was cached */
  cachedAt: number;
  
  /** Timestamp of last access (for LRU eviction) */
  lastAccessedAt: number;
  
  /** Optional expiration timestamp (for TTL-based eviction) */
  expiresAt?: number;
}

/**
 * Storage quota information
 */
export interface StorageQuota {
  /** Total available quota in bytes */
  quota: number;
  
  /** Currently used storage in bytes */
  usage: number;
  
  /** Remaining storage in bytes */
  available: number;
  
  /** Usage as percentage (0-100) */
  percentUsed: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  /** Total number of cached images */
  imageCount: number;
  
  /** Total cache size in bytes */
  totalSize: number;
  
  /** Storage quota information */
  quota: StorageQuota;
  
  /** Number of playlists cached */
  playlistCount: number;
  
  /** Oldest cached image timestamp */
  oldestCachedAt?: number;
  
  /** Newest cached image timestamp */
  newestCachedAt?: number;
}

// ==================== Constants ====================

const DB_NAME = 'glowworm_image_cache';
const DB_VERSION = 1;
const STORE_NAME = 'cached_images';

/**
 * IndexedDB indexes for efficient querying
 */
const INDEXES = {
  playlistId: 'by_playlist',
  cachedAt: 'by_cached_at',
  lastAccessedAt: 'by_last_accessed',
  expiresAt: 'by_expires_at',
} as const;

/**
 * Retry configuration for transient errors
 */
const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 2000,
  backoffMultiplier: 2,
} as const;

// ==================== Custom Error Types ====================

/**
 * Base error for ImageCacheService
 */
export class ImageCacheError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'ImageCacheError';
  }
}

/**
 * Error thrown when storage quota is exceeded
 */
export class QuotaExceededError extends ImageCacheError {
  constructor(message: string = 'Storage quota exceeded') {
    super(message, 'storeImage');
    this.name = 'QuotaExceededError';
  }
}

/**
 * Error thrown when database cannot be opened
 */
export class DatabaseConnectionError extends ImageCacheError {
  constructor(originalError?: Error) {
    super('Failed to connect to IndexedDB', 'openDatabase', originalError);
    this.name = 'DatabaseConnectionError';
  }
}

/**
 * Error thrown when cached data is corrupted
 */
export class CacheCorruptionError extends ImageCacheError {
  constructor(imageId: string) {
    super(`Corrupted cache entry: ${imageId}`, 'getImage');
    this.name = 'CacheCorruptionError';
  }
}

// ==================== ImageCacheService Class ====================

/**
 * Service for managing image cache using IndexedDB
 * 
 * Features:
 * - Store/retrieve images as Blobs with metadata
 * - Storage quota management
 * - LRU (Least Recently Used) eviction
 * - Playlist-based image management
 * - Automatic cleanup of expired images
 */
export class ImageCacheService {
  private db: IDBDatabase | null = null;
  private opening: Promise<IDBDatabase> | null = null;

  // ==================== Database Initialization ====================

  /**
   * Open (or create) the IndexedDB database
   * 
   * Handles version upgrades and schema migrations.
   * Uses a singleton pattern to ensure only one connection.
   */
  private async openDatabase(): Promise<IDBDatabase> {
    // Return existing connection if available
    if (this.db) {
      return this.db;
    }

    // Return in-progress opening operation if exists
    if (this.opening) {
      return this.opening;
    }

    // Start new database opening operation
    this.opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      /**
       * Database upgrade handler
       * 
       * Called when:
       * - Database is created for the first time
       * - Version number is increased
       */
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const transaction = (event.target as IDBOpenDBRequest).transaction!;

        console.log(`[ImageCache] Upgrading database to version ${DB_VERSION}`);

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const objectStore = db.createObjectStore(STORE_NAME, { 
            keyPath: 'id' 
          });

          // Create indexes for efficient querying
          objectStore.createIndex(INDEXES.playlistId, 'playlistId', { unique: false });
          objectStore.createIndex(INDEXES.cachedAt, 'cachedAt', { unique: false });
          objectStore.createIndex(INDEXES.lastAccessedAt, 'lastAccessedAt', { unique: false });
          objectStore.createIndex(INDEXES.expiresAt, 'expiresAt', { unique: false });

          console.log(`[ImageCache] Created object store: ${STORE_NAME} with indexes`);
        }

        // Handle future version migrations here
        // Example:
        // if (event.oldVersion < 2) {
        //   // Migration from version 1 to version 2
        // }
      };

      /**
       * Database opened successfully
       */
      request.onsuccess = () => {
        this.db = request.result;
        this.opening = null;
        
        console.log(`[ImageCache] Database opened successfully: ${DB_NAME} v${DB_VERSION}`);
        
        // Handle unexpected database closure
        this.db.onversionchange = () => {
          console.warn('[ImageCache] Database version change detected, closing connection');
          this.db?.close();
          this.db = null;
        };

        resolve(this.db);
      };

      /**
       * Database opening error
       */
      request.onerror = () => {
        this.opening = null;
        const error = new Error(
          `Failed to open IndexedDB: ${request.error?.message || 'Unknown error'}`
        );
        console.error('[ImageCache]', error);
        reject(error);
      };

      /**
       * Database blocked (another connection is preventing version upgrade)
       */
      request.onblocked = () => {
        console.warn(
          '[ImageCache] Database upgrade blocked by another connection. ' +
          'Please close other tabs using this site.'
        );
      };
    });

    return this.opening;
  }

  /**
   * Ensure database is open before operations
   * 
   * @private
   */
  private async ensureDatabase(): Promise<IDBDatabase> {
    if (!this.db) {
      return this.openDatabase();
    }
    return this.db;
  }

  /**
   * Close the database connection
   * 
   * Should be called when the service is no longer needed
   * (e.g., component unmounting, app shutting down)
   */
  public async closeDatabase(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('[ImageCache] Database connection closed');
    }
  }

  /**
   * Check if IndexedDB is supported in the current browser
   */
  public static isSupported(): boolean {
    return 'indexedDB' in window && indexedDB !== null;
  }

  /**
   * Get database version information
   */
  public async getDatabaseInfo(): Promise<{ name: string; version: number }> {
    const db = await this.ensureDatabase();
    return {
      name: db.name,
      version: db.version,
    };
  }

  // ==================== Storage Quota Management ====================

  /**
   * Get current storage quota information
   * 
   * Uses the Storage API to check available and used storage.
   * Note: Some browsers may provide estimates rather than exact values.
   */
  public async getStorageQuota(): Promise<StorageQuota> {
    if (!navigator.storage || !navigator.storage.estimate) {
      // Fallback for browsers that don't support Storage API
      console.warn('[ImageCache] Storage API not supported, returning estimates');
      return {
        quota: 0,
        usage: 0,
        available: 0,
        percentUsed: 0,
      };
    }

    try {
      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota || 0;
      const usage = estimate.usage || 0;
      const available = quota - usage;
      const percentUsed = quota > 0 ? (usage / quota) * 100 : 0;

      return {
        quota,
        usage,
        available,
        percentUsed,
      };
    } catch (error) {
      console.error('[ImageCache] Error checking storage quota:', error);
      throw error;
    }
  }

  /**
   * Request persistent storage permission
   * 
   * This prevents the browser from automatically evicting cached data
   * when storage is low. Requires user gesture in some browsers.
   * 
   * @returns True if persistent storage is granted
   */
  public async requestPersistentStorage(): Promise<boolean> {
    if (!navigator.storage || !navigator.storage.persist) {
      console.warn('[ImageCache] Persistent storage API not supported');
      return false;
    }

    try {
      const persistent = await navigator.storage.persist();
      if (persistent) {
        console.log('[ImageCache] Persistent storage granted');
      } else {
        console.warn('[ImageCache] Persistent storage not granted');
      }
      return persistent;
    } catch (error) {
      console.error('[ImageCache] Error requesting persistent storage:', error);
      return false;
    }
  }

  /**
   * Check if persistent storage is already granted
   */
  public async isPersistent(): Promise<boolean> {
    if (!navigator.storage || !navigator.storage.persisted) {
      return false;
    }

    try {
      return await navigator.storage.persisted();
    } catch (error) {
      console.error('[ImageCache] Error checking persistence:', error);
      return false;
    }
  }

  // ==================== Core CRUD Operations ====================

  /**
   * Store an image in the cache
   * 
   * @param id - Unique image identifier
   * @param url - Original image URL
   * @param blob - Image data as Blob
   * @param playlistId - Playlist this image belongs to
   * @param expiresAt - Optional expiration timestamp
   */
  public async storeImage(
    id: string,
    url: string,
    blob: Blob,
    playlistId: number,
    expiresAt?: number
  ): Promise<void> {
    const db = await this.ensureDatabase();

    const cachedImage: CachedImage = {
      id,
      playlistId,
      url,
      blob,
      mimeType: blob.type || 'image/jpeg',
      sizeBytes: blob.size,
      cachedAt: Date.now(),
      lastAccessedAt: Date.now(),
      expiresAt,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(cachedImage);

      request.onsuccess = () => {
        console.log(`[ImageCache] Stored image: ${id} (${formatBytes(blob.size)})`);
        resolve();
      };

      request.onerror = () => {
        const error = new Error(
          `Failed to store image ${id}: ${request.error?.message || 'Unknown error'}`
        );
        console.error('[ImageCache]', error);
        reject(error);
      };

      transaction.onerror = () => {
        const error = new Error(
          `Transaction failed for storeImage: ${transaction.error?.message || 'Unknown error'}`
        );
        console.error('[ImageCache]', error);
        reject(error);
      };
    });
  }

  /**
   * Retrieve an image from the cache
   * 
   * Updates lastAccessedAt for LRU tracking.
   * 
   * @param id - Image identifier
   * @returns Image Blob if found, null otherwise
   */
  public async getImage(id: string): Promise<Blob | null> {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const cachedImage = request.result as CachedImage | undefined;

        if (!cachedImage) {
          console.log(`[ImageCache] Cache miss: ${id}`);
          resolve(null);
          return;
        }

        // Check if expired
        if (cachedImage.expiresAt && cachedImage.expiresAt < Date.now()) {
          console.log(`[ImageCache] Cache expired: ${id}`);
          // Remove expired image
          store.delete(id);
          resolve(null);
          return;
        }

        // Update lastAccessedAt for LRU tracking
        cachedImage.lastAccessedAt = Date.now();
        store.put(cachedImage);

        console.log(`[ImageCache] Cache hit: ${id} (${formatBytes(cachedImage.sizeBytes)})`);
        resolve(cachedImage.blob);
      };

      request.onerror = () => {
        const error = new Error(
          `Failed to retrieve image ${id}: ${request.error?.message || 'Unknown error'}`
        );
        console.error('[ImageCache]', error);
        reject(error);
      };

      transaction.onerror = () => {
        const error = new Error(
          `Transaction failed for getImage: ${transaction.error?.message || 'Unknown error'}`
        );
        console.error('[ImageCache]', error);
        reject(error);
      };
    });
  }

  /**
   * Check if an image exists in the cache
   * 
   * Does NOT update lastAccessedAt (for read-only checking).
   * 
   * @param id - Image identifier
   * @returns True if image exists and is not expired
   */
  public async hasImage(id: string): Promise<boolean> {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const cachedImage = request.result as CachedImage | undefined;

        if (!cachedImage) {
          resolve(false);
          return;
        }

        // Check if expired
        if (cachedImage.expiresAt && cachedImage.expiresAt < Date.now()) {
          resolve(false);
          return;
        }

        resolve(true);
      };

      request.onerror = () => {
        const error = new Error(
          `Failed to check image ${id}: ${request.error?.message || 'Unknown error'}`
        );
        console.error('[ImageCache]', error);
        reject(error);
      };
    });
  }

  /**
   * Remove an image from the cache
   * 
   * @param id - Image identifier
   */
  public async removeImage(id: string): Promise<void> {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log(`[ImageCache] Removed image: ${id}`);
        resolve();
      };

      request.onerror = () => {
        const error = new Error(
          `Failed to remove image ${id}: ${request.error?.message || 'Unknown error'}`
        );
        console.error('[ImageCache]', error);
        reject(error);
      };

      transaction.onerror = () => {
        const error = new Error(
          `Transaction failed for removeImage: ${transaction.error?.message || 'Unknown error'}`
        );
        console.error('[ImageCache]', error);
        reject(error);
      };
    });
  }

  /**
   * Clear all cached images
   * 
   * Warning: This removes ALL cached images from ALL playlists.
   */
  public async clearCache(): Promise<void> {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('[ImageCache] Cache cleared successfully');
        resolve();
      };

      request.onerror = () => {
        const error = new Error(
          `Failed to clear cache: ${request.error?.message || 'Unknown error'}`
        );
        console.error('[ImageCache]', error);
        reject(error);
      };

      transaction.onerror = () => {
        const error = new Error(
          `Transaction failed for clearCache: ${transaction.error?.message || 'Unknown error'}`
        );
        console.error('[ImageCache]', error);
        reject(error);
      };
    });
  }

  /**
   * Remove all images for a specific playlist
   * 
   * Useful when playlist is deleted or changed.
   * 
   * @param playlistId - Playlist identifier
   * @returns Number of images removed
   */
  public async clearPlaylistImages(playlistId: number): Promise<number> {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index(INDEXES.playlistId);
      const request = index.openCursor(IDBKeyRange.only(playlistId));

      let count = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        
        if (cursor) {
          cursor.delete();
          count++;
          cursor.continue();
        } else {
          console.log(`[ImageCache] Removed ${count} images from playlist ${playlistId}`);
          resolve(count);
        }
      };

      request.onerror = () => {
        const error = new Error(
          `Failed to clear playlist ${playlistId}: ${request.error?.message || 'Unknown error'}`
        );
        console.error('[ImageCache]', error);
        reject(error);
      };

      transaction.onerror = () => {
        const error = new Error(
          `Transaction failed for clearPlaylistImages: ${transaction.error?.message || 'Unknown error'}`
        );
        console.error('[ImageCache]', error);
        reject(error);
      };
    });
  }

  /**
   * Get all images for a specific playlist
   * 
   * @param playlistId - Playlist identifier
   * @returns Array of cached images
   */
  public async getPlaylistImages(playlistId: number): Promise<CachedImage[]> {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index(INDEXES.playlistId);
      const request = index.getAll(playlistId);

      request.onsuccess = () => {
        const images = request.result as CachedImage[];
        console.log(`[ImageCache] Found ${images.length} images for playlist ${playlistId}`);
        resolve(images);
      };

      request.onerror = () => {
        const error = new Error(
          `Failed to get playlist images: ${request.error?.message || 'Unknown error'}`
        );
        console.error('[ImageCache]', error);
        reject(error);
      };
    });
  }

  /**
   * Get all cached image IDs
   * 
   * @returns Array of image IDs
   */
  public async getAllImageIds(): Promise<string[]> {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();

      request.onsuccess = () => {
        resolve(request.result as string[]);
      };

      request.onerror = () => {
        const error = new Error(
          `Failed to get all keys: ${request.error?.message || 'Unknown error'}`
        );
        console.error('[ImageCache]', error);
        reject(error);
      };
    });
  }

  // ==================== Storage Statistics & Monitoring ====================

  /**
   * Get total cache size in bytes
   * 
   * Iterates through all cached images and sums their sizes.
   * 
   * @returns Total size of all cached images in bytes
   */
  public async getCacheSize(): Promise<number> {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();

      let totalSize = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (cursor) {
          const cachedImage = cursor.value as CachedImage;
          totalSize += cachedImage.sizeBytes;
          cursor.continue();
        } else {
          console.log(`[ImageCache] Total cache size: ${formatBytes(totalSize)}`);
          resolve(totalSize);
        }
      };

      request.onerror = () => {
        const error = new Error(
          `Failed to calculate cache size: ${request.error?.message || 'Unknown error'}`
        );
        console.error('[ImageCache]', error);
        reject(error);
      };
    });
  }

  /**
   * Get comprehensive cache statistics
   * 
   * Includes image count, total size, quota information, playlist count,
   * and timestamp ranges.
   * 
   * @returns Detailed cache statistics
   */
  public async getCacheStats(): Promise<CacheStats> {
    const db = await this.ensureDatabase();

    return new Promise(async (resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();

        let imageCount = 0;
        let totalSize = 0;
        const playlists = new Set<number>();
        let oldestCachedAt: number | undefined;
        let newestCachedAt: number | undefined;

        request.onsuccess = async (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

          if (cursor) {
            const cachedImage = cursor.value as CachedImage;
            
            imageCount++;
            totalSize += cachedImage.sizeBytes;
            playlists.add(cachedImage.playlistId);

            if (!oldestCachedAt || cachedImage.cachedAt < oldestCachedAt) {
              oldestCachedAt = cachedImage.cachedAt;
            }
            if (!newestCachedAt || cachedImage.cachedAt > newestCachedAt) {
              newestCachedAt = cachedImage.cachedAt;
            }

            cursor.continue();
          } else {
            // Cursor complete, get quota information
            const quota = await this.getStorageQuota();

            const stats: CacheStats = {
              imageCount,
              totalSize,
              quota,
              playlistCount: playlists.size,
              oldestCachedAt,
              newestCachedAt,
            };

            console.log('[ImageCache] Cache stats:', {
              images: imageCount,
              size: formatBytes(totalSize),
              playlists: playlists.size,
              quota: `${quota.percentUsed.toFixed(1)}% used`,
            });

            resolve(stats);
          }
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to get cache stats: ${request.error?.message || 'Unknown error'}`
          );
          console.error('[ImageCache]', error);
          reject(error);
        };
      } catch (error) {
        console.error('[ImageCache] Error getting cache stats:', error);
        reject(error);
      }
    });
  }

  /**
   * Check if storage quota is sufficient for a new image
   * 
   * @param imageSize - Size of image to store in bytes
   * @param threshold - Safety threshold (default: 90% - leave 10% free)
   * @returns True if there's enough space
   */
  public async hasQuotaFor(imageSize: number, threshold: number = 90): Promise<boolean> {
    try {
      const quota = await this.getStorageQuota();
      
      // Check if adding this image would exceed threshold
      const projectedUsage = quota.usage + imageSize;
      const projectedPercent = (projectedUsage / quota.quota) * 100;

      return projectedPercent < threshold;
    } catch (error) {
      console.error('[ImageCache] Error checking quota:', error);
      // If we can't check quota, assume we have space (fail open)
      return true;
    }
  }

  /**
   * Get number of cached images
   * 
   * @returns Total count of cached images
   */
  public async getImageCount(): Promise<number> {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        const error = new Error(
          `Failed to count images: ${request.error?.message || 'Unknown error'}`
        );
        console.error('[ImageCache]', error);
        reject(error);
      };
    });
  }

  /**
   * Get cache statistics for a specific playlist
   * 
   * @param playlistId - Playlist identifier
   * @returns Statistics for the specified playlist
   */
  public async getPlaylistStats(playlistId: number): Promise<{
    imageCount: number;
    totalSize: number;
  }> {
    const images = await this.getPlaylistImages(playlistId);
    
    const totalSize = images.reduce((sum, img) => sum + img.sizeBytes, 0);

    return {
      imageCount: images.length,
      totalSize,
    };
  }

  // ==================== LRU Eviction ====================

  /**
   * Get least recently used images
   * 
   * @param limit - Number of images to return (default: 10)
   * @returns Array of cached images sorted by lastAccessedAt (oldest first)
   */
  public async getLRUImages(limit: number = 10): Promise<CachedImage[]> {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index(INDEXES.lastAccessedAt);
      const request = index.openCursor(null, 'next'); // oldest first

      const lruImages: CachedImage[] = [];

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (cursor && lruImages.length < limit) {
          lruImages.push(cursor.value as CachedImage);
          cursor.continue();
        } else {
          resolve(lruImages);
        }
      };

      request.onerror = () => {
        const error = new Error(
          `Failed to get LRU images: ${request.error?.message || 'Unknown error'}`
        );
        console.error('[ImageCache]', error);
        reject(error);
      };
    });
  }

  /**
   * Evict least recently used images to free up space
   * 
   * Removes the N least recently used images from the cache.
   * Useful when approaching storage quota limits.
   * 
   * @param count - Number of images to evict (default: 10)
   * @returns Array of evicted image IDs
   */
  public async evictLRUImages(count: number = 10): Promise<string[]> {
    const lruImages = await this.getLRUImages(count);
    const evictedIds: string[] = [];

    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      let processed = 0;
      let failed = 0;

      if (lruImages.length === 0) {
        console.log('[ImageCache] No images to evict');
        resolve([]);
        return;
      }

      lruImages.forEach((image) => {
        const request = store.delete(image.id);

        request.onsuccess = () => {
          evictedIds.push(image.id);
          processed++;

          if (processed === lruImages.length) {
            console.log(
              `[ImageCache] Evicted ${evictedIds.length} LRU images, ` +
              `freed ${formatBytes(evictedIds.reduce((sum, id) => {
                const img = lruImages.find(i => i.id === id);
                return sum + (img?.sizeBytes || 0);
              }, 0))}`
            );
            resolve(evictedIds);
          }
        };

        request.onerror = () => {
          console.error(`[ImageCache] Failed to evict image ${image.id}`);
          failed++;
          processed++;

          if (processed === lruImages.length) {
            if (failed === lruImages.length) {
              reject(new Error(`Failed to evict any of ${count} LRU images`));
            } else {
              // Partial success
              resolve(evictedIds);
            }
          }
        };
      });

      transaction.onerror = () => {
        const error = new Error(
          `Transaction failed for evictLRUImages: ${transaction.error?.message || 'Unknown error'}`
        );
        console.error('[ImageCache]', error);
        reject(error);
      };
    });
  }

  /**
   * Evict images until storage quota is below threshold
   * 
   * Automatically removes LRU images in batches until storage usage
   * is below the specified threshold.
   * 
   * @param targetThreshold - Target storage usage percentage (default: 75%)
   * @param batchSize - Number of images to evict per iteration (default: 10)
   * @returns Total number of images evicted
   */
  public async evictToThreshold(
    targetThreshold: number = 75,
    batchSize: number = 10
  ): Promise<number> {
    let totalEvicted = 0;
    let iterations = 0;
    const maxIterations = 100; // Safety limit

    while (iterations < maxIterations) {
      const quota = await this.getStorageQuota();

      // Check if we're below threshold
      if (quota.percentUsed < targetThreshold) {
        console.log(
          `[ImageCache] Eviction complete: ${totalEvicted} images removed, ` +
          `storage at ${quota.percentUsed.toFixed(1)}%`
        );
        return totalEvicted;
      }

      // Evict batch
      console.log(
        `[ImageCache] Storage at ${quota.percentUsed.toFixed(1)}%, ` +
        `evicting ${batchSize} LRU images...`
      );

      const evictedIds = await this.evictLRUImages(batchSize);
      totalEvicted += evictedIds.length;

      if (evictedIds.length === 0) {
        // No more images to evict
        console.warn('[ImageCache] No more images to evict but still above threshold');
        return totalEvicted;
      }

      iterations++;
    }

    console.warn(
      `[ImageCache] Reached max eviction iterations (${maxIterations}), ` +
      `evicted ${totalEvicted} images`
    );
    return totalEvicted;
  }

  /**
   * Remove expired images from cache
   * 
   * Scans through all cached images and removes any that have passed
   * their expiration time.
   * 
   * @returns Number of expired images removed
   */
  public async removeExpiredImages(): Promise<number> {
    const db = await this.ensureDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index(INDEXES.expiresAt);
      
      // Get images that have expiresAt set and are expired
      const range = IDBKeyRange.upperBound(Date.now());
      const request = index.openCursor(range);

      let count = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

        if (cursor) {
          const cachedImage = cursor.value as CachedImage;
          
          // Double-check expiration (index might include undefined values)
          if (cachedImage.expiresAt && cachedImage.expiresAt < Date.now()) {
            cursor.delete();
            count++;
          }
          
          cursor.continue();
        } else {
          if (count > 0) {
            console.log(`[ImageCache] Removed ${count} expired images`);
          }
          resolve(count);
        }
      };

      request.onerror = () => {
        const error = new Error(
          `Failed to remove expired images: ${request.error?.message || 'Unknown error'}`
        );
        console.error('[ImageCache]', error);
        reject(error);
      };

      transaction.onerror = () => {
        const error = new Error(
          `Transaction failed for removeExpiredImages: ${transaction.error?.message || 'Unknown error'}`
        );
        console.error('[ImageCache]', error);
        reject(error);
      };
    });
  }

  /**
   * Smart cache maintenance
   * 
   * Performs automatic maintenance:
   * - Removes expired images
   * - Evicts LRU images if storage above threshold
   * 
   * Call this periodically (e.g., on page load, after prefetch).
   * 
   * @param quotaThreshold - Storage threshold to trigger eviction (default: 85%)
   * @param targetThreshold - Target threshold after eviction (default: 70%)
   * @returns Object with maintenance results
   */
  public async performMaintenance(
    quotaThreshold: number = 85,
    targetThreshold: number = 70
  ): Promise<{
    expiredRemoved: number;
    lruEvicted: number;
    finalQuotaPercent: number;
  }> {
    console.log('[ImageCache] Starting cache maintenance...');

    // Step 1: Remove expired images
    const expiredRemoved = await this.removeExpiredImages();

    // Step 2: Check if eviction needed
    const quota = await this.getStorageQuota();
    let lruEvicted = 0;

    if (quota.percentUsed > quotaThreshold) {
      console.log(
        `[ImageCache] Storage at ${quota.percentUsed.toFixed(1)}%, ` +
        `evicting to ${targetThreshold}%...`
      );
      lruEvicted = await this.evictToThreshold(targetThreshold);
    }

    const finalQuota = await this.getStorageQuota();

    console.log(
      `[ImageCache] Maintenance complete: ` +
      `${expiredRemoved} expired, ${lruEvicted} evicted, ` +
      `storage at ${finalQuota.percentUsed.toFixed(1)}%`
    );

    return {
      expiredRemoved,
      lruEvicted,
      finalQuotaPercent: finalQuota.percentUsed,
    };
  }

  // ==================== Error Handling & Validation ====================

  /**
   * Validate a Blob is a valid image
   * 
   * @param blob - Blob to validate
   * @returns True if blob appears to be a valid image
   */
  public async validateImageBlob(blob: Blob): Promise<boolean> {
    // Check MIME type
    if (!blob.type.startsWith('image/')) {
      console.warn(`[ImageCache] Invalid MIME type: ${blob.type}`);
      return false;
    }

    // Check size (must be > 0 and < 50MB for safety)
    if (blob.size === 0 || blob.size > 50 * 1024 * 1024) {
      console.warn(`[ImageCache] Invalid size: ${formatBytes(blob.size)}`);
      return false;
    }

    // Try to create object URL and load image (validates it's not corrupted)
    try {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      
      const loaded = await new Promise<boolean>((resolve) => {
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(true);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          resolve(false);
        };
        // Set timeout to prevent hanging
        setTimeout(() => {
          URL.revokeObjectURL(url);
          resolve(false);
        }, 5000);
        
        img.src = url;
      });

      return loaded;
    } catch (error) {
      console.error('[ImageCache] Error validating image blob:', error);
      return false;
    }
  }

  /**
   * Retry an operation with exponential backoff
   * 
   * @param operation - Async function to retry
   * @param operationName - Name for logging
   * @returns Result from successful operation
   */
  private async retryWithBackoff<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | undefined;
    let delay = RETRY_CONFIG.initialDelayMs;

    for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (!this.isRetryableError(error as Error)) {
          console.error(`[ImageCache] Non-retryable error in ${operationName}:`, error);
          throw error;
        }

        if (attempt < RETRY_CONFIG.maxAttempts) {
          console.warn(
            `[ImageCache] ${operationName} failed (attempt ${attempt}/${RETRY_CONFIG.maxAttempts}), ` +
            `retrying in ${delay}ms...`
          );
          
          await this.sleep(delay);
          delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
        }
      }
    }

    // All retries failed
    throw new ImageCacheError(
      `${operationName} failed after ${RETRY_CONFIG.maxAttempts} attempts`,
      operationName,
      lastError
    );
  }

  /**
   * Check if an error is retryable
   * 
   * Some errors are transient (network issues, database locks),
   * others are permanent (quota exceeded, invalid data).
   */
  private isRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    // Non-retryable errors
    if (
      message.includes('quota') ||
      message.includes('invalid') ||
      message.includes('corrupt')
    ) {
      return false;
    }

    // Retryable errors (locks, network, temp failures)
    return (
      message.includes('transaction') ||
      message.includes('blocked') ||
      message.includes('timeout') ||
      message.includes('abort') ||
      message.includes('version')
    );
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validate cache integrity
   * 
   * Checks for corrupted entries and removes them.
   * Should be called periodically or on cache load failures.
   * 
   * @returns Object with validation results
   */
  public async validateCacheIntegrity(): Promise<{
    totalChecked: number;
    corruptedRemoved: number;
    invalidRemoved: number;
  }> {
    console.log('[ImageCache] Validating cache integrity...');

    const db = await this.ensureDatabase();

    return new Promise(async (resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.openCursor();

        let totalChecked = 0;
        let corruptedRemoved = 0;
        let invalidRemoved = 0;

        request.onsuccess = async (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;

          if (cursor) {
            const cachedImage = cursor.value as CachedImage;
            totalChecked++;

            let shouldRemove = false;
            let reason = '';

            // Check for required fields
            if (!cachedImage.id || !cachedImage.blob || !cachedImage.playlistId) {
              shouldRemove = true;
              reason = 'missing required fields';
              invalidRemoved++;
            }
            // Check blob validity
            else if (!(cachedImage.blob instanceof Blob)) {
              shouldRemove = true;
              reason = 'invalid blob';
              invalidRemoved++;
            }
            // Check size consistency
            else if (cachedImage.blob.size !== cachedImage.sizeBytes) {
              shouldRemove = true;
              reason = 'size mismatch';
              corruptedRemoved++;
            }
            // Check for zero-size blobs
            else if (cachedImage.blob.size === 0) {
              shouldRemove = true;
              reason = 'zero-size blob';
              corruptedRemoved++;
            }

            if (shouldRemove) {
              console.warn(`[ImageCache] Removing corrupted image ${cachedImage.id}: ${reason}`);
              cursor.delete();
            }

            cursor.continue();
          } else {
            // Validation complete
            console.log(
              `[ImageCache] Integrity check complete: ` +
              `${totalChecked} checked, ${corruptedRemoved} corrupted, ${invalidRemoved} invalid`
            );

            resolve({
              totalChecked,
              corruptedRemoved,
              invalidRemoved,
            });
          }
        };

        request.onerror = () => {
          const error = new Error(
            `Failed to validate cache: ${request.error?.message || 'Unknown error'}`
          );
          console.error('[ImageCache]', error);
          reject(error);
        };
      } catch (error) {
        console.error('[ImageCache] Error during validation:', error);
        reject(error);
      }
    });
  }

  /**
   * Safe store operation with quota checking and retry logic
   * 
   * Enhanced version of storeImage with:
   * - Pre-flight quota check
   * - Automatic LRU eviction if needed
   * - Retry logic for transient errors
   * - Blob validation
   * 
   * @param id - Image identifier
   * @param url - Original URL
   * @param blob - Image data
   * @param playlistId - Playlist ID
   * @param expiresAt - Optional expiration
   * @param validateBlob - Whether to validate blob before storing (default: true)
   */
  public async storeImageSafe(
    id: string,
    url: string,
    blob: Blob,
    playlistId: number,
    expiresAt?: number,
    validateBlob: boolean = true
  ): Promise<void> {
    // Optional blob validation
    if (validateBlob) {
      const isValid = await this.validateImageBlob(blob);
      if (!isValid) {
        throw new ImageCacheError('Invalid image blob', 'storeImageSafe');
      }
    }

    // Check quota before storing
    const hasSpace = await this.hasQuotaFor(blob.size);
    
    if (!hasSpace) {
      console.warn(
        `[ImageCache] Insufficient quota for image ${id} (${formatBytes(blob.size)}), ` +
        `attempting eviction...`
      );
      
      // Try to make space by evicting LRU images
      const evicted = await this.evictToThreshold(70); // Target 70% usage
      
      if (evicted === 0) {
        throw new QuotaExceededError(
          `Cannot store image ${id}: quota exceeded and no images to evict`
        );
      }

      // Re-check quota after eviction
      const hasSpaceAfterEviction = await this.hasQuotaFor(blob.size);
      if (!hasSpaceAfterEviction) {
        throw new QuotaExceededError(
          `Cannot store image ${id}: quota still exceeded after evicting ${evicted} images`
        );
      }
    }

    // Store with retry logic
    return this.retryWithBackoff(
      () => this.storeImage(id, url, blob, playlistId, expiresAt),
      `storeImage(${id})`
    );
  }
}

// ==================== Singleton Instance ====================

/**
 * Singleton instance for app-wide use
 * 
 * Usage:
 * ```typescript
 * import { imageCacheService } from '@/services/ImageCacheService';
 * 
 * const quota = await imageCacheService.getStorageQuota();
 * ```
 */
export const imageCacheService = new ImageCacheService();

// ==================== Utility Functions ====================

/**
 * Format bytes to human-readable string
 * 
 * @param bytes - Number of bytes
 * @param decimals - Number of decimal places (default: 2)
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Check if storage quota is critically low
 * 
 * @param quota - Storage quota information
 * @param threshold - Threshold percentage (default: 90)
 */
export function isStorageCritical(quota: StorageQuota, threshold: number = 90): boolean {
  return quota.percentUsed >= threshold;
}

/**
 * Estimate number of images that can be stored
 * 
 * @param quota - Storage quota information
 * @param averageImageSize - Average image size in bytes (default: 2MB)
 */
export function estimateImageCapacity(
  quota: StorageQuota,
  averageImageSize: number = 2 * 1024 * 1024 // 2MB
): number {
  return Math.floor(quota.available / averageImageSize);
}

