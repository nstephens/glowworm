/**
 * Frontend Logger Service
 * Sends client-side logs to backend for file storage
 * Use sparingly to avoid filling up disk space
 */

import { urlResolver } from './urlResolver';

export type FrontendLogLevel = 'debug' | 'info' | 'warning' | 'error';

interface LogContext {
  [key: string]: any;
}

interface FrontendLogEntry {
  log_level: FrontendLogLevel;
  message: string;
  context?: LogContext;
  url?: string;
}

class FrontendLogger {
  private static instance: FrontendLogger;
  private enabled: boolean = true;
  private logQueue: FrontendLogEntry[] = [];
  private flushInterval: number = 5000; // Flush every 5 seconds
  private maxQueueSize: number = 10;
  private flushTimer: NodeJS.Timeout | null = null;

  private constructor() {
    // Start periodic flush
    this.startPeriodicFlush();
    
    // Flush on page unload
    window.addEventListener('beforeunload', () => {
      this.flush();
    });
  }

  public static getInstance(): FrontendLogger {
    if (!FrontendLogger.instance) {
      FrontendLogger.instance = new FrontendLogger();
    }
    return FrontendLogger.instance;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      if (this.logQueue.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }

  private async flush(): Promise<void> {
    if (this.logQueue.length === 0) {
      return;
    }

    const logsToSend = [...this.logQueue];
    this.logQueue = [];

    // Send all logs in batch
    for (const entry of logsToSend) {
      try {
        await fetch(urlResolver.getApiUrl('/logs/frontend'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(entry),
        });
      } catch (error) {
        // Silently fail for frontend logs to avoid infinite loops
        console.error('[FrontendLogger] Failed to send log:', error);
      }
    }
  }

  private addToQueue(entry: FrontendLogEntry): void {
    if (!this.enabled) {
      return;
    }

    this.logQueue.push(entry);

    // Flush immediately if queue is full or if it's an error
    if (this.logQueue.length >= this.maxQueueSize || entry.log_level === 'error') {
      this.flush();
    }
  }

  // Logging methods (use sparingly!)
  public info(message: string, context?: LogContext): void {
    const url = window.location.pathname;
    this.addToQueue({ log_level: 'info', message, context, url });
  }

  public warning(message: string, context?: LogContext): void {
    const url = window.location.pathname;
    this.addToQueue({ log_level: 'warning', message, context, url });
  }

  public error(message: string, context?: LogContext): void {
    const url = window.location.pathname;
    this.addToQueue({ log_level: 'error', message, context, url });
  }

  // Capture unhandled errors
  public captureError(error: Error, context?: LogContext): void {
    this.error(`Unhandled error: ${error.message}`, {
      ...context,
      stack: error.stack,
      name: error.name
    });
  }
}

// Export singleton instance
export const frontendLogger = FrontendLogger.getInstance();

// Setup global error handler (optional - can be enabled selectively)
export function setupGlobalErrorHandler() {
  window.addEventListener('error', (event) => {
    frontendLogger.captureError(event.error, {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    frontendLogger.error(`Unhandled promise rejection: ${event.reason}`, {
      reason: String(event.reason)
    });
  });
}

export default frontendLogger;

