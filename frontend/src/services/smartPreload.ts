import { apiService } from './api';

export interface PreloadRequest {
  playlist_id: number;
  current_image_index?: number;
  slide_duration?: number;
  formats?: string[];
}

export interface PreloadStatus {
  image_id?: number;
  status: string;
  priority?: string;
  retry_count?: number;
  error?: string;
  completed_at?: string;
  processing_time?: number;
}

export interface OverallStatus {
  worker_running: boolean;
  queue_size: number;
  active_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  memory_stats: {
    total_memory_mb: number;
    available_memory_mb: number;
    used_memory_percent: number;
    cache_size_mb: number;
  };
  stats: {
    total_preloaded: number;
    total_failed: number;
    total_retries: number;
    cache_hits: number;
    cache_misses: number;
    memory_pressure_events: number;
  };
  max_concurrent_tasks: number;
  memory_threshold_percent: number;
}

export interface MemoryStats {
  total_memory_mb: number;
  available_memory_mb: number;
  used_memory_mb: number;
  used_memory_percent: number;
  cache_memory_mb: number;
  memory_pressure: boolean;
}

export interface SlideshowTiming {
  playlist_id: number;
  current_index: number;
  slide_duration: number;
  last_updated: string;
}

export class SmartPreloadService {
  private statusUpdateInterval: NodeJS.Timeout | null = null;
  private onStatusUpdate: ((status: OverallStatus) => void) | null = null;
  private onMemoryUpdate: ((memory: MemoryStats) => void) | null = null;

  /**
   * Start the smart preload worker
   */
  async startWorker(): Promise<void> {
    try {
      const response = await apiService.api.post('/smart-preload/start');
      if (response.status !== 200) {
        throw new Error('Failed to start smart preload worker');
      }
    } catch (error) {
      console.error('Error starting smart preload worker:', error);
      throw error;
    }
  }

  /**
   * Stop the smart preload worker
   */
  async stopWorker(): Promise<void> {
    try {
      const response = await apiService.api.post('/smart-preload/stop');
      if (response.status !== 200) {
        throw new Error('Failed to stop smart preload worker');
      }
    } catch (error) {
      console.error('Error stopping smart preload worker:', error);
      throw error;
    }
  }

  /**
   * Start smart preloading for a playlist
   */
  async preloadPlaylist(request: PreloadRequest): Promise<any> {
    try {
      const response = await apiService.api.post('/smart-preload/preload-playlist', request);
      return response.data;
    } catch (error) {
      console.error('Error starting smart preload:', error);
      throw error;
    }
  }

  /**
   * Get overall preload status
   */
  async getOverallStatus(): Promise<OverallStatus> {
    try {
      const response = await apiService.api.get('/smart-preload/status');
      return response.data;
    } catch (error) {
      console.error('Error getting overall status:', error);
      throw error;
    }
  }

  /**
   * Get preload status for a specific image
   */
  async getImageStatus(imageId: number): Promise<PreloadStatus> {
    try {
      const response = await apiService.api.get(`/smart-preload/status/${imageId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting image status:', error);
      throw error;
    }
  }

  /**
   * Update slideshow timing for optimization
   */
  async updateSlideshowTiming(playlistId: number, currentIndex: number, slideDuration: number): Promise<void> {
    try {
      await apiService.api.post('/smart-preload/update-timing', {
        playlist_id: playlistId,
        current_index: currentIndex,
        slide_duration: slideDuration
      });
    } catch (error) {
      console.error('Error updating slideshow timing:', error);
      throw error;
    }
  }

  /**
   * Get slideshow timing for a playlist
   */
  async getSlideshowTiming(playlistId: number): Promise<SlideshowTiming | null> {
    try {
      const response = await apiService.api.get(`/smart-preload/timing/${playlistId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting slideshow timing:', error);
      return null;
    }
  }

  /**
   * Clear completed tasks older than specified hours
   */
  async clearCompletedTasks(olderThanHours: number = 1): Promise<{ cleared_count: number }> {
    try {
      const response = await apiService.api.post('/smart-preload/clear-completed', null, {
        params: { older_than_hours: olderThanHours }
      });
      return response.data;
    } catch (error) {
      console.error('Error clearing completed tasks:', error);
      throw error;
    }
  }

  /**
   * Get detailed memory statistics
   */
  async getMemoryStats(): Promise<MemoryStats> {
    try {
      const response = await apiService.api.get('/smart-preload/memory-stats');
      return response.data;
    } catch (error) {
      console.error('Error getting memory stats:', error);
      throw error;
    }
  }

  /**
   * Configure preload service settings (admin only)
   */
  async configureService(config: {
    max_concurrent_tasks?: number;
    memory_threshold_percent?: number;
    max_cache_size_mb?: number;
  }): Promise<void> {
    try {
      await apiService.api.post('/smart-preload/configure', config);
    } catch (error) {
      console.error('Error configuring preload service:', error);
      throw error;
    }
  }

  /**
   * Get preload statistics
   */
  async getStats(): Promise<any> {
    try {
      const response = await apiService.api.get('/smart-preload/stats');
      return response.data;
    } catch (error) {
      console.error('Error getting preload stats:', error);
      throw error;
    }
  }

  /**
   * Emergency stop all preload operations
   */
  async emergencyStop(): Promise<void> {
    try {
      await apiService.api.post('/smart-preload/emergency-stop');
    } catch (error) {
      console.error('Error emergency stopping preload:', error);
      throw error;
    }
  }

  /**
   * Start monitoring status updates
   */
  startStatusMonitoring(
    onStatusUpdate: (status: OverallStatus) => void,
    onMemoryUpdate: (memory: MemoryStats) => void,
    intervalMs: number = 2000
  ): void {
    this.onStatusUpdate = onStatusUpdate;
    this.onMemoryUpdate = onMemoryUpdate;

    this.statusUpdateInterval = setInterval(async () => {
      try {
        const [status, memory] = await Promise.all([
          this.getOverallStatus(),
          this.getMemoryStats()
        ]);

        if (this.onStatusUpdate) {
          this.onStatusUpdate(status);
        }

        if (this.onMemoryUpdate) {
          this.onMemoryUpdate(memory);
        }
      } catch (error) {
        console.error('Error in status monitoring:', error);
      }
    }, intervalMs);
  }

  /**
   * Stop monitoring status updates
   */
  stopStatusMonitoring(): void {
    if (this.statusUpdateInterval) {
      clearInterval(this.statusUpdateInterval);
      this.statusUpdateInterval = null;
    }
    this.onStatusUpdate = null;
    this.onMemoryUpdate = null;
  }

  /**
   * Smart preload for slideshow with automatic timing updates
   */
  async smartPreloadForSlideshow(
    playlistId: number,
    currentIndex: number,
    slideDuration: number,
    formats: string[] = ['webp', 'avif']
  ): Promise<void> {
    try {
      // Update timing first
      await this.updateSlideshowTiming(playlistId, currentIndex, slideDuration);

      // Start smart preload
      await this.preloadPlaylist({
        playlist_id: playlistId,
        current_image_index: currentIndex,
        slide_duration: slideDuration,
        formats
      });
    } catch (error) {
      console.error('Error in smart preload for slideshow:', error);
      throw error;
    }
  }

  /**
   * Get preload recommendations for a playlist
   */
  async getPreloadRecommendations(playlistId: number): Promise<{
    recommended: boolean;
    reason: string;
    image_count: number;
    total_size_mb: number;
    estimated_preload_time_seconds: number;
    formats_recommended: string[];
  }> {
    try {
      // This would call the existing preload recommendations endpoint
      const response = await apiService.api.get(`/slideshow-preload/recommendations/${playlistId}`);
      return response.data;
    } catch (error) {
      console.error('Error getting preload recommendations:', error);
      throw error;
    }
  }

  /**
   * Check if preload is recommended for current conditions
   */
  async isPreloadRecommended(playlistId: number): Promise<boolean> {
    try {
      const recommendations = await this.getPreloadRecommendations(playlistId);
      const memoryStats = await this.getMemoryStats();
      
      // Check if memory pressure is low enough
      const memoryOk = memoryStats.used_memory_percent < 70;
      
      return recommendations.recommended && memoryOk;
    } catch (error) {
      console.error('Error checking preload recommendation:', error);
      return false;
    }
  }
}

// Singleton instance
export const smartPreloadService = new SmartPreloadService();














