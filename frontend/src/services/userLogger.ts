/**
 * User Logger Service
 * Tracks authenticated user actions in the webapp
 */

import { urlResolver } from './urlResolver';

export type UserLogLevel = 'debug' | 'info' | 'warning' | 'error';
export type UserAction = 'login' | 'logout' | 'create' | 'update' | 'delete' | 'view' | 'upload' | 'download' | 'error' | 'other';

interface LogContext {
  [key: string]: any;
}

interface UserLogEntry {
  log_level: UserLogLevel;
  action: UserAction;
  message: string;
  context?: LogContext;
  url?: string;
}

class UserLogger {
  private static instance: UserLogger;
  private enabled: boolean = true;
  private maxRetries: number = 2;
  private retryDelay: number = 1000;

  private constructor() {}

  public static getInstance(): UserLogger {
    if (!UserLogger.instance) {
      UserLogger.instance = new UserLogger();
    }
    return UserLogger.instance;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private async sendLog(entry: UserLogEntry, retryCount: number = 0): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const response = await fetch(urlResolver.getApiUrl('/logs/user'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(entry),
      });

      if (!response.ok) {
        throw new Error(`Failed to send log: ${response.status}`);
      }

      return true;
    } catch (error) {
      console.error('[UserLogger] Failed to send log:', error);

      // Retry if we haven't exceeded max retries
      if (retryCount < this.maxRetries) {
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * (retryCount + 1)));
        return this.sendLog(entry, retryCount + 1);
      }

      return false;
    }
  }

  // Core logging methods
  public log(level: UserLogLevel, action: UserAction, message: string, context?: LogContext): void {
    const url = window.location.pathname;
    this.sendLog({ log_level: level, action, message, context, url });
  }

  public info(action: UserAction, message: string, context?: LogContext): void {
    this.log('info', action, message, context);
  }

  public warning(action: UserAction, message: string, context?: LogContext): void {
    this.log('warning', action, message, context);
  }

  public error(action: UserAction, message: string, context?: LogContext): void {
    this.log('error', action, message, context);
  }

  // Convenience methods for common actions
  public logLogin(username: string): void {
    this.info('login', `User logged in: ${username}`);
  }

  public logLogout(username: string): void {
    this.info('logout', `User logged out: ${username}`);
  }

  public logCreate(resourceType: string, resourceName: string, context?: LogContext): void {
    this.info('create', `Created ${resourceType}: ${resourceName}`, context);
  }

  public logUpdate(resourceType: string, resourceName: string, context?: LogContext): void {
    this.info('update', `Updated ${resourceType}: ${resourceName}`, context);
  }

  public logDelete(resourceType: string, resourceName: string, context?: LogContext): void {
    this.info('delete', `Deleted ${resourceType}: ${resourceName}`, context);
  }

  public logView(resourceType: string, resourceName: string, context?: LogContext): void {
    this.info('view', `Viewed ${resourceType}: ${resourceName}`, context);
  }

  public logUpload(filename: string, fileSize: number, context?: LogContext): void {
    this.info('upload', `Uploaded file: ${filename}`, {
      ...context,
      file_size: fileSize
    });
  }

  public logError(errorMessage: string, context?: LogContext): void {
    this.error('error', errorMessage, context);
  }
}

// Export singleton instance
export const userLogger = UserLogger.getInstance();
export default userLogger;

