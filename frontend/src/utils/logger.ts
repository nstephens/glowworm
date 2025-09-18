/**
 * Centralized logging utility for GlowWorm frontend.
 * Provides configurable logging levels based on system settings.
 */

interface LogSettings {
  logLevel: string;
  enableDebugLogging: boolean;
}

class GlowWormLogger {
  private name: string;
  private settings: LogSettings;

  constructor(name: string) {
    this.name = name;
    this.settings = this.loadLogSettings();
  }

  private loadLogSettings(): LogSettings {
    // Try to get settings from localStorage (set by settings page)
    const storedSettings = localStorage.getItem('logSettings');
    if (storedSettings) {
      try {
        return JSON.parse(storedSettings);
      } catch (e) {
        console.warn('Failed to parse stored log settings, using defaults');
      }
    }

    // Default settings
    return {
      logLevel: 'INFO',
      enableDebugLogging: false
    };
  }

  private shouldLog(level: string): boolean {
    const levels = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];
    const currentLevelIndex = levels.indexOf(this.settings.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatMessage(level: string, message: string, ...args: any[]): void {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${this.name}] [${level}]`;
    
    switch (level) {
      case 'DEBUG':
        console.debug(prefix, message, ...args);
        break;
      case 'INFO':
        console.info(prefix, message, ...args);
        break;
      case 'WARNING':
        console.warn(prefix, message, ...args);
        break;
      case 'ERROR':
        console.error(prefix, message, ...args);
        break;
      case 'CRITICAL':
        console.error(`🚨 ${prefix}`, message, ...args);
        break;
      default:
        console.log(prefix, message, ...args);
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.settings.enableDebugLogging && this.shouldLog('DEBUG')) {
      this.formatMessage('DEBUG', message, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('INFO')) {
      this.formatMessage('INFO', message, ...args);
    }
  }

  warning(message: string, ...args: any[]): void {
    if (this.shouldLog('WARNING')) {
      this.formatMessage('WARNING', message, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('ERROR')) {
      this.formatMessage('ERROR', message, ...args);
    }
  }

  critical(message: string, ...args: any[]): void {
    if (this.shouldLog('CRITICAL')) {
      this.formatMessage('CRITICAL', message, ...args);
    }
  }

  // Method to update settings (called when settings change)
  updateSettings(settings: LogSettings): void {
    this.settings = settings;
    localStorage.setItem('logSettings', JSON.stringify(settings));
  }
}

// Create logger instances for different modules
export const createLogger = (name: string): GlowWormLogger => {
  return new GlowWormLogger(name);
};

// Export commonly used loggers
export const logger = createLogger('GlowWorm');
export const apiLogger = createLogger('API');
export const websocketLogger = createLogger('WebSocket');
export const playlistLogger = createLogger('Playlist');
export const displayLogger = createLogger('Display');
export const imageLogger = createLogger('Image');

// Utility to update all loggers when settings change
export const updateLogSettings = (settings: LogSettings): void => {
  // This would need to be implemented to update all existing logger instances
  // For now, we'll store in localStorage and new loggers will pick it up
  localStorage.setItem('logSettings', JSON.stringify(settings));
};
