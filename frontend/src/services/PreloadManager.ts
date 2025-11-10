/**
 * PreloadManager - Intelligent image prefetching for display reliability
 * 
 * Orchestrates background downloading of all playlist images into IndexedDB
 * to ensure 99.9%+ image load reliability and offline capability.
 */

import { imageCacheService, type CachedImage } from './ImageCacheService';
import { apiService } from './api';
import type { ImageManifest, ImageManifestItem } from '../types';

// ==================== Type Definitions ====================

/**
 * Preload progress callback
 */
export type PreloadProgressCallback = (progress: PreloadProgress) => void;

/**
 * Download progress information
 */
export interface PreloadProgress {
  /** Current image being downloaded (1-based) */
  current: number;
  
  /** Total images to download */
  total: number;
  
  /** Bytes downloaded so far */
  bytesDownloaded: number;
  
  /** Total bytes to download */
  totalBytes: number;
  
  /** Progress percentage (0-100) */
  percentComplete: number;
  
  /** Images successfully cached */
  successCount: number;
  
  /** Images that failed to download */
  failedCount: number;
  
  /** Currently downloading image ID (for UI display) */
  currentImageId?: string;
  
  /** Estimated time remaining in seconds */
  estimatedSecondsRemaining?: number;
}

/**
 * Preload result summary
 */
export interface PreloadResult {
  /** Whether preload completed successfully */
  success: boolean;
  
  /** Total images processed */
  totalImages: number;
  
  /** Images successfully cached */
  successCount: number;
  
  /** Images that failed */
  failedCount: number;
  
  /** IDs of failed images (for retry) */
  failedImageIds: string[];
  
  /** Total bytes downloaded */
  bytesDownloaded: number;
  
  /** Duration in milliseconds */
  durationMs: number;
  
  /** Error message if failed */
  error?: string;
}

/**
 * Preload configuration
 */
export interface PreloadConfig {
  /** Maximum concurrent downloads (default: 3) */
  concurrency?: number;
  
  /** Rate limit: max downloads per second (default: 5) */
  maxDownloadsPerSecond?: number;
  
  /** Timeout for individual image download in ms (default: 30000) */
  downloadTimeoutMs?: number;
  
  /** Whether to validate blobs before caching (default: false for speed) */
  validateBlobs?: boolean;
  
  /** Progress update interval in ms (default: 500) */
  progressUpdateIntervalMs?: number;
  
  /** Whether to skip images already in cache (default: true) */
  skipCached?: number;
}

// ==================== Constants ====================

const DEFAULT_CONFIG: Required<PreloadConfig> = {
  concurrency: 3,
  maxDownloadsPerSecond: 5,
  downloadTimeoutMs: 30000,
  validateBlobs: false,
  progressUpdateIntervalMs: 500,
  skipCached: true,
};

/**
 * Retry configuration for failed downloads
 */
const RETRY_CONFIG = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
} as const;

// ==================== PreloadManager Class ====================

/**
 * Service for managing intelligent image prefetching
 * 
 * Features:
 * - Parallel downloads with configurable concurrency
 * - Rate limiting to prevent network congestion
 * - Progress tracking with callbacks
 * - Automatic retry with exponential backoff
 * - Delta updates (only download new/changed images)
 * - Bandwidth throttling
 * - IndexedDB storage integration
 */
export class PreloadManager {
  private config: Required<PreloadConfig>;
  private activeDownloads: Set<string> = new Set();
  private downloadQueue: ImageManifestItem[] = [];
  private isPreloading: boolean = false;
  private abortController: AbortController | null = null;

  constructor(config: PreloadConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ==================== Public API ====================

  /**
   * Prefetch all images for a playlist
   * 
   * Downloads all images from the playlist manifest and stores them in IndexedDB.
   * Supports progress tracking, rate limiting, and automatic retry.
   * 
   * @param playlistId - Playlist identifier
   * @param onProgress - Optional progress callback
   * @returns Preload result summary
   */
  public async prefetchPlaylist(
    playlistId: number,
    onProgress?: PreloadProgressCallback
  ): Promise<PreloadResult> {
    console.log(`[PreloadManager] Starting prefetch for playlist ${playlistId}`);
    
    const startTime = Date.now();
    
    // Prevent concurrent preload operations
    if (this.isPreloading) {
      console.warn('[PreloadManager] Preload already in progress, aborting current operation');
      this.abort();
    }
    
    this.isPreloading = true;
    this.abortController = new AbortController();
    
    try {
      // Step 1: Fetch playlist manifest
      const manifest = await this.getManifest(playlistId);
      console.log(
        `[PreloadManager] Manifest loaded: ${manifest.count} images, ` +
        `${(manifest.total_size / (1024 * 1024)).toFixed(1)}MB total`
      );
      
      // Step 2: Filter out already cached images (if configured)
      const imagesToDownload = this.config.skipCached
        ? await this.filterUncachedImages(manifest.manifest)
        : manifest.manifest;
      
      if (imagesToDownload.length === 0) {
        console.log('[PreloadManager] All images already cached, nothing to download');
        return {
          success: true,
          totalImages: manifest.count,
          successCount: manifest.count,
          failedCount: 0,
          failedImageIds: [],
          bytesDownloaded: 0,
          durationMs: Date.now() - startTime,
        };
      }
      
      console.log(
        `[PreloadManager] ${imagesToDownload.length} images need downloading ` +
        `(${manifest.count - imagesToDownload.length} already cached)`
      );
      
      // Step 3: Download images
      const result = await this.downloadImages(
        imagesToDownload,
        playlistId,
        manifest.total_size,
        onProgress
      );
      
      result.durationMs = Date.now() - startTime;
      
      console.log(
        `[PreloadManager] Prefetch complete: ${result.successCount}/${result.totalImages} succeeded ` +
        `in ${(result.durationMs / 1000).toFixed(1)}s`
      );
      
      return result;
      
    } catch (error) {
      console.error('[PreloadManager] Prefetch failed:', error);
      
      return {
        success: false,
        totalImages: 0,
        successCount: 0,
        failedCount: 0,
        failedImageIds: [],
        bytesDownloaded: 0,
        durationMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
    } finally {
      this.isPreloading = false;
      this.abortController = null;
      this.activeDownloads.clear();
      this.downloadQueue = [];
    }
  }

  // ==================== Manifest Management ====================

  /**
   * Get playlist manifest from backend
   * 
   * Fetches the lightweight image manifest containing only essential metadata
   * for cache prefetching.
   * 
   * @param playlistId - Playlist identifier
   * @returns Image manifest with all playlist images
   */
  public async getManifest(playlistId: number): Promise<ImageManifest> {
    try {
      console.log(`[PreloadManager] Fetching manifest for playlist ${playlistId}...`);
      
      const manifest = await apiService.getPlaylistImagesManifest(playlistId);
      
      console.log(
        `[PreloadManager] Manifest received: ${manifest.count} images, ` +
        `${(manifest.total_size / (1024 * 1024)).toFixed(1)}MB`
      );
      
      return manifest;
      
    } catch (error) {
      console.error(`[PreloadManager] Failed to fetch manifest for playlist ${playlistId}:`, error);
      throw new Error(`Failed to fetch playlist manifest: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Filter out images that are already cached
   * 
   * Checks IndexedDB for each image and returns only those that need downloading.
   * This enables efficient delta updates when playlists change.
   * 
   * @param manifest - Array of image manifest items
   * @returns Filtered array containing only uncached images
   */
  private async filterUncachedImages(
    manifest: ImageManifestItem[]
  ): Promise<ImageManifestItem[]> {
    console.log(`[PreloadManager] Checking cache status for ${manifest.length} images...`);
    
    const uncachedImages: ImageManifestItem[] = [];
    
    // Check cache status for each image
    for (const item of manifest) {
      try {
        const isCached = await imageCacheService.hasImage(item.id);
        
        if (!isCached) {
          uncachedImages.push(item);
        }
      } catch (error) {
        // If cache check fails, assume not cached (fail safe)
        console.warn(`[PreloadManager] Cache check failed for ${item.id}, assuming not cached`);
        uncachedImages.push(item);
      }
    }
    
    console.log(
      `[PreloadManager] Cache filter complete: ${uncachedImages.length} need downloading, ` +
      `${manifest.length - uncachedImages.length} already cached`
    );
    
    return uncachedImages;
  }

  /**
   * Validate cached images against manifest
   * 
   * Checks which images from the manifest are actually in the cache
   * and returns the IDs of missing images.
   * 
   * @param manifest - Image manifest to validate against
   * @returns Array of missing image IDs
   */
  public async validateCache(manifest: ImageManifest): Promise<string[]> {
    console.log(`[PreloadManager] Validating cache against manifest...`);
    
    const missingIds: string[]  = [];
    
    for (const item of manifest.manifest) {
      const isCached = await imageCacheService.hasImage(item.id);
      if (!isCached) {
        missingIds.push(item.id);
      }
    }
    
    console.log(
      `[PreloadManager] Validation complete: ${missingIds.length} missing, ` +
      `${manifest.count - missingIds.length} cached`
    );
    
    return missingIds;
  }

  /**
   * Clear cached images for old playlists
   * 
   * Removes images that don't belong to the current playlist to free up space.
   * Useful when playlist assignment changes.
   * 
   * @param currentPlaylistId - The playlist to keep
   * @returns Number of images removed
   */
  public async clearOldImages(currentPlaylistId: number): Promise<number> {
    console.log(`[PreloadManager] Clearing images not in playlist ${currentPlaylistId}...`);
    
    try {
      // Get all cached images
      const allImages = await imageCacheService.getAllImageIds();
      const playlistImages = await imageCacheService.getPlaylistImages(currentPlaylistId);
      const playlistImageIds = new Set(playlistImages.map(img => img.id));
      
      let removedCount = 0;
      
      // Remove images not in current playlist
      for (const imageId of allImages) {
        if (!playlistImageIds.has(imageId)) {
          await imageCacheService.removeImage(imageId);
          removedCount++;
        }
      }
      
      console.log(`[PreloadManager] Removed ${removedCount} old images`);
      return removedCount;
      
    } catch (error) {
      console.error('[PreloadManager] Error clearing old images:', error);
      throw error;
    }
  }

  // ==================== Parallel Download Queue ====================

  /**
   * Download images with parallel processing and rate limiting
   * 
   * Downloads images in parallel while respecting:
   * - Concurrency limit (default: 3 simultaneous downloads)
   * - Rate limit (default: 5 downloads/second start rate)
   * - Timeout per image (default: 30 seconds)
   * 
   * @param images - Array of images to download
   * @param playlistId - Playlist ID for storage
   * @param totalBytes - Total size for progress calculation
   * @param onProgress - Optional progress callback
   * @returns Download result summary
   */
  private async downloadImages(
    images: ImageManifestItem[],
    playlistId: number,
    totalBytes: number,
    onProgress?: PreloadProgressCallback
  ): Promise<PreloadResult> {
    const startTime = Date.now();
    const result: PreloadResult = {
      success: false,
      totalImages: images.length,
      successCount: 0,
      failedCount: 0,
      failedImageIds: [],
      bytesDownloaded: 0,
      durationMs: 0,
    };

    // Initialize download queue
    this.downloadQueue = [...images];
    let currentIndex = 0;
    let lastProgressUpdate = 0;

    // Rate limiting state
    let downloadsThisSecond = 0;
    let secondStartTime = Date.now();

    // Helper to report progress
    const reportProgress = () => {
      if (!onProgress) return;
      
      const now = Date.now();
      if (now - lastProgressUpdate < this.config.progressUpdateIntervalMs) {
        return; // Throttle progress updates
      }
      
      lastProgressUpdate = now;
      
      const elapsed = (now - startTime) / 1000;
      const downloadSpeed = elapsed > 0 ? result.bytesDownloaded / elapsed : 0;
      const remainingBytes = totalBytes - result.bytesDownloaded;
      const estimatedSecondsRemaining = downloadSpeed > 0 
        ? remainingBytes / downloadSpeed 
        : undefined;

      const progress: PreloadProgress = {
        current: currentIndex,
        total: images.length,
        bytesDownloaded: result.bytesDownloaded,
        totalBytes,
        percentComplete: (currentIndex / images.length) * 100,
        successCount: result.successCount,
        failedCount: result.failedCount,
        currentImageId: this.downloadQueue[0]?.id,
        estimatedSecondsRemaining,
      };

      onProgress(progress);
    };

    // Download worker function
    const downloadWorker = async (): Promise<void> => {
      while (this.downloadQueue.length > 0) {
        // Check if aborted
        if (this.abortController?.signal.aborted) {
          console.log('[PreloadManager] Download aborted by user');
          break;
        }

        // Rate limiting check
        const now = Date.now();
        if (now - secondStartTime >= 1000) {
          // Reset counter every second
          downloadsThisSecond = 0;
          secondStartTime = now;
        }

        if (downloadsThisSecond >= this.config.maxDownloadsPerSecond) {
          // Wait until next second
          const waitTime = 1000 - (now - secondStartTime);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        // Get next image from queue
        const imageItem = this.downloadQueue.shift();
        if (!imageItem) break;

        currentIndex++;
        downloadsThisSecond++;
        this.activeDownloads.add(imageItem.id);

        try {
          // Download with timeout and retry
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Download timeout')), this.config.downloadTimeoutMs);
          });

          const downloadPromise = this.downloadSingleImageWithRetry(imageItem, playlistId);
          
          const blob = await Promise.race([downloadPromise, timeoutPromise]);

          // Successfully downloaded and cached
          result.successCount++;
          result.bytesDownloaded += imageItem.file_size;

          console.log(
            `[PreloadManager] ✓ Downloaded ${currentIndex}/${images.length}: ` +
            `${imageItem.filename} (${(imageItem.file_size / 1024).toFixed(0)}KB)`
          );

        } catch (error) {
          // Download failed (after all retries)
          result.failedCount++;
          result.failedImageIds.push(imageItem.id);

          console.error(
            `[PreloadManager] ✗ Failed to download ${imageItem.id} (${imageItem.filename}):`,
            error instanceof Error ? error.message : error
          );

        } finally {
          this.activeDownloads.delete(imageItem.id);
          reportProgress();
        }
      }
    };

    // Start concurrent workers
    const workers: Promise<void>[] = [];
    for (let i = 0; i < this.config.concurrency; i++) {
      workers.push(downloadWorker());
    }

    // Wait for all workers to complete
    await Promise.all(workers);

    // Final progress update
    result.durationMs = Date.now() - startTime;
    result.success = result.failedCount === 0;

    // Report 100% progress
    if (onProgress) {
      onProgress({
        current: images.length,
        total: images.length,
        bytesDownloaded: result.bytesDownloaded,
        totalBytes,
        percentComplete: 100,
        successCount: result.successCount,
        failedCount: result.failedCount,
      });
    }

    return result;
  }

  /**
   * Download a single image with retry logic
   * 
   * Wraps downloadSingleImage with exponential backoff retry.
   * 
   * @param item - Image manifest item to download
   * @param playlistId - Playlist ID for storage
   * @returns Downloaded blob
   */
  private async downloadSingleImageWithRetry(
    item: ImageManifestItem,
    playlistId: number
  ): Promise<Blob> {
    let lastError: Error | undefined;
    let delay = RETRY_CONFIG.initialDelayMs;

    for (let attempt = 1; attempt <= RETRY_CONFIG.maxAttempts; attempt++) {
      try {
        return await this.downloadSingleImage(item, playlistId);
      } catch (error) {
        lastError = error as Error;

        // Don't retry on abort
        if (this.abortController?.signal.aborted) {
          throw new Error('Download aborted');
        }

        // Don't retry on 404 (image doesn't exist)
        if (lastError.message.includes('404')) {
          throw lastError;
        }

        if (attempt < RETRY_CONFIG.maxAttempts) {
          console.warn(
            `[PreloadManager] Download failed for ${item.id} ` +
            `(attempt ${attempt}/${RETRY_CONFIG.maxAttempts}), ` +
            `retrying in ${delay}ms...`
          );

          await this.sleep(delay);
          delay = Math.min(delay * RETRY_CONFIG.backoffMultiplier, RETRY_CONFIG.maxDelayMs);
        }
      }
    }

    // All retries exhausted
    throw new Error(
      `Failed to download ${item.id} after ${RETRY_CONFIG.maxAttempts} attempts: ` +
      (lastError?.message || 'Unknown error')
    );
  }

  /**
   * Download a single image and store in cache
   * 
   * @param item - Image manifest item to download
   * @param playlistId - Playlist ID for storage
   * @returns Downloaded blob
   */
  private async downloadSingleImage(
    item: ImageManifestItem,
    playlistId: number
  ): Promise<Blob> {
    // Fetch image from URL
    const response = await fetch(item.url, {
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const blob = await response.blob();

    // Validate MIME type matches expected
    if (blob.type && blob.type !== item.mime_type) {
      console.warn(
        `[PreloadManager] MIME type mismatch for ${item.id}: ` +
        `expected ${item.mime_type}, got ${blob.type}`
      );
    }

    // Store in cache
    await imageCacheService.storeImage(
      item.id,
      item.url,
      blob,
      playlistId
    );

    return blob;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ==================== Bandwidth Management ====================

  /**
   * Detect network connection type and estimate bandwidth
   * 
   * Uses Network Information API when available, falls back to conservative estimate.
   * 
   * @returns Estimated bandwidth in Mbps
   */
  private getEstimatedBandwidth(): number {
    // Check for Network Information API support
    const connection = (navigator as any).connection || 
                      (navigator as any).mozConnection || 
                      (navigator as any).webkitConnection;

    if (connection) {
      // Use downlink if available (Mbps)
      if (connection.downlink) {
        console.log(`[PreloadManager] Detected bandwidth: ${connection.downlink} Mbps`);
        return connection.downlink;
      }

      // Fall back to effective type estimation
      if (connection.effectiveType) {
        const bandwidthEstimates: Record<string, number> = {
          'slow-2g': 0.05,  // 50 Kbps
          '2g': 0.25,       // 250 Kbps
          '3g': 1.5,        // 1.5 Mbps
          '4g': 10,         // 10 Mbps
        };
        const estimated = bandwidthEstimates[connection.effectiveType] || 5;
        console.log(`[PreloadManager] Estimated bandwidth from ${connection.effectiveType}: ${estimated} Mbps`);
        return estimated;
      }
    }

    // Default conservative estimate for unknown connections
    const defaultBandwidth = 5; // 5 Mbps
    console.log(`[PreloadManager] Using default bandwidth estimate: ${defaultBandwidth} Mbps`);
    return defaultBandwidth;
  }

  /**
   * Calculate optimal concurrency based on bandwidth
   * 
   * Adjusts download concurrency to match network capacity:
   * - <1 Mbps: 1 concurrent download
   * - 1-5 Mbps: 2 concurrent downloads
   * - 5-10 Mbps: 3 concurrent downloads (default)
   * - >10 Mbps: 4-5 concurrent downloads
   * 
   * @returns Optimal concurrency level
   */
  private getOptimalConcurrency(): number {
    const bandwidthMbps = this.getEstimatedBandwidth();

    if (bandwidthMbps < 1) return 1;
    if (bandwidthMbps < 5) return 2;
    if (bandwidthMbps < 10) return 3;
    if (bandwidthMbps < 20) return 4;
    return 5;
  }

  /**
   * Adapt configuration based on network conditions
   * 
   * Automatically adjusts concurrency and rate limiting based on
   * detected bandwidth to optimize download performance.
   */
  public adaptToNetworkConditions(): void {
    const optimalConcurrency = this.getOptimalConcurrency();
    
    if (optimalConcurrency !== this.config.concurrency) {
      console.log(
        `[PreloadManager] Adapting concurrency: ${this.config.concurrency} → ${optimalConcurrency} ` +
        `based on network conditions`
      );
      this.config.concurrency = optimalConcurrency;
    }
  }

  /**
   * Perform full playlist refresh
   * 
   * Complete workflow for updating cache when playlist changes:
   * 1. Fetch new manifest
   * 2. Remove old images not in new manifest
   * 3. Download only new/missing images
   * 
   * @param playlistId - Playlist ID to refresh
   * @param onProgress - Optional progress callback
   * @returns Refresh result
   */
  public async refreshPlaylist(
    playlistId: number,
    onProgress?: PreloadProgressCallback
  ): Promise<PreloadResult & { removedCount: number }> {
    console.log(`[PreloadManager] Refreshing playlist ${playlistId}...`);

    try {
      // Fetch new manifest
      const manifest = await this.getManifest(playlistId);

      // Get currently cached images for this playlist
      const cachedImages = await imageCacheService.getPlaylistImages(playlistId);
      const cachedIds = new Set(cachedImages.map(img => img.id));
      const manifestIds = new Set(manifest.manifest.map(img => img.id));

      // Remove images no longer in playlist
      let removedCount = 0;
      for (const cachedId of cachedIds) {
        if (!manifestIds.has(cachedId)) {
          await imageCacheService.removeImage(cachedId);
          removedCount++;
        }
      }

      if (removedCount > 0) {
        console.log(`[PreloadManager] Removed ${removedCount} old images from playlist ${playlistId}`);
      }

      // Download new/missing images
      const result = await this.prefetchPlaylist(playlistId, onProgress);

      return {
        ...result,
        removedCount,
      };

    } catch (error) {
      console.error(`[PreloadManager] Failed to refresh playlist ${playlistId}:`, error);
      throw error;
    }
  }

  /**
   * Abort ongoing preload operation
   */
  public abort(): void {
    if (this.abortController) {
      console.log('[PreloadManager] Aborting preload operation');
      this.abortController.abort();
    }
  }

  /**
   * Check if preload is currently in progress
   */
  public isActive(): boolean {
    return this.isPreloading;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<PreloadConfig>): void {
    this.config = { ...this.config, ...config };
    console.log('[PreloadManager] Configuration updated:', config);
  }

  /**
   * Get current configuration
   */
  public getConfig(): Required<PreloadConfig> {
    return { ...this.config };
  }
}

// ==================== Singleton Instance ====================

/**
 * Singleton instance for app-wide use
 * 
 * Usage:
 * ```typescript
 * import { preloadManager } from '@/services/PreloadManager';
 * 
 * const result = await preloadManager.prefetchPlaylist(5, (progress) => {
 *   console.log(`${progress.percentComplete}% complete`);
 * });
 * ```
 */
export const preloadManager = new PreloadManager();

// ==================== Utility Functions ====================

/**
 * Calculate download speed in bytes per second
 */
export function calculateDownloadSpeed(
  bytesDownloaded: number,
  elapsedMs: number
): number {
  if (elapsedMs === 0) return 0;
  return (bytesDownloaded / elapsedMs) * 1000;
}

/**
 * Estimate time remaining based on current download speed
 */
export function estimateTimeRemaining(
  bytesRemaining: number,
  bytesPerSecond: number
): number {
  if (bytesPerSecond === 0) return 0;
  return bytesRemaining / bytesPerSecond;
}

/**
 * Format download speed to human-readable string
 */
export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond < 1024) {
    return `${bytesPerSecond.toFixed(0)} B/s`;
  } else if (bytesPerSecond < 1024 * 1024) {
    return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  } else {
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
  }
}

