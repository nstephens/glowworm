/**
 * Display Device Logger Service
 * Sends logs from display devices to the backend for remote troubleshooting
 */

import { urlResolver } from './urlResolver';

export type LogLevel = 'debug' | 'info' | 'warning' | 'error' | 'critical';

interface LogContext {
  [key: string]: any;
}

interface LogEntry {
  log_level: LogLevel;
  message: string;
  context?: LogContext;
}

class DisplayDeviceLogger {
  private static instance: DisplayDeviceLogger;
  private enabled: boolean = true;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second

  private constructor() {}

  public static getInstance(): DisplayDeviceLogger {
    if (!DisplayDeviceLogger.instance) {
      DisplayDeviceLogger.instance = new DisplayDeviceLogger();
    }
    return DisplayDeviceLogger.instance;
  }

  /**
   * Enable or disable remote logging
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Send a log entry to the backend
   */
  private async sendLog(entry: LogEntry, retryCount: number = 0): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const response = await fetch(urlResolver.getApiUrl('/display-devices/logs'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for device authentication
        body: JSON.stringify(entry),
      });

      if (!response.ok) {
        throw new Error(`Failed to send log: ${response.status} ${response.statusText}`);
      }

      // Log locally on success
      const localLogMethod = console[entry.log_level] || console.log;
      localLogMethod(`[RemoteLog:${entry.log_level.toUpperCase()}]`, entry.message, entry.context || '');

      return true;
    } catch (error) {
      // Log error locally
      console.error('[DisplayDeviceLogger] Failed to send log:', error);

      // Retry if we haven't exceeded max retries
      if (retryCount < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (retryCount + 1)));
        return this.sendLog(entry, retryCount + 1);
      }

      return false;
    }
  }

  /**
   * Log a debug message
   */
  public debug(message: string, context?: LogContext): void {
    this.sendLog({ log_level: 'debug', message, context });
  }

  /**
   * Log an info message
   */
  public info(message: string, context?: LogContext): void {
    this.sendLog({ log_level: 'info', message, context });
  }

  /**
   * Log a warning message
   */
  public warning(message: string, context?: LogContext): void {
    this.sendLog({ log_level: 'warning', message, context });
  }

  /**
   * Log an error message
   */
  public error(message: string, context?: LogContext): void {
    this.sendLog({ log_level: 'error', message, context });
  }

  /**
   * Log a critical message
   */
  public critical(message: string, context?: LogContext): void {
    this.sendLog({ log_level: 'critical', message, context });
  }

  /**
   * Log device startup information
   */
  public logStartup(context: LogContext): void {
    this.info('Display device started', context);
  }

  /**
   * Log playlist information
   */
  public logPlaylist(action: string, playlistInfo: any): void {
    this.info(`Playlist ${action}`, {
      action,
      playlist: playlistInfo
    });
  }

  /**
   * Log display resolution information
   */
  public logResolution(width: number, height: number, dpr: number): void {
    this.info('Display resolution detected', {
      width,
      height,
      device_pixel_ratio: dpr,
      resolution: `${width}x${height}`
    });
  }

  /**
   * Log WebSocket connection status
   */
  public logWebSocketStatus(status: string, details?: any): void {
    const logLevel: LogLevel = status === 'error' ? 'error' : status === 'disconnected' ? 'warning' : 'info';
    this.sendLog({
      log_level: logLevel,
      message: `WebSocket ${status}`,
      context: details
    });
  }

  /**
   * Log image loading events
   */
  public logImageEvent(event: string, imageInfo: any): void {
    const logLevel: LogLevel = event === 'error' ? 'error' : 'info';
    this.sendLog({
      log_level: logLevel,
      message: `Image ${event}`,
      context: imageInfo
    });
  }

  /**
   * Log variant selection details
   */
  public logVariantSelection(variantInfo: any): void {
    this.info('Playlist variant selection', variantInfo);
  }

  /**
   * Log actual image dimensions being displayed
   */
  public logImageDimensions(imageId: number, imageUrl: string, naturalWidth: number, naturalHeight: number, displayWidth: number, displayHeight: number): void {
    this.info('Image dimensions', {
      image_id: imageId,
      image_url: imageUrl,
      natural_dimensions: `${naturalWidth}x${naturalHeight}`,
      display_dimensions: `${displayWidth}x${displayHeight}`,
      is_optimized: naturalWidth <= displayWidth * 1.5 && naturalHeight <= displayHeight * 1.5
    });
  }
}

// Export singleton instance
export const displayDeviceLogger = DisplayDeviceLogger.getInstance();
export default displayDeviceLogger;

