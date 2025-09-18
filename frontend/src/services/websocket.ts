import { urlResolver } from './urlResolver';
import { websocketLogger } from '../utils/logger';

// Browser-compatible EventEmitter implementation
class EventEmitter {
  private events: { [key: string]: Function[] } = {};

  on(event: string, listener: Function): this {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  off(event: string, listener: Function): this {
    if (!this.events[event]) return this;
    this.events[event] = this.events[event].filter(l => l !== listener);
    return this;
  }

  emit(event: string, ...args: any[]): boolean {
    if (!this.events[event]) return false;
    this.events[event].forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        websocketLogger.error(`Error in event listener for ${event}:`, error);
      }
    });
    return true;
  }

  removeAllListeners(event?: string): this {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
    return this;
  }
}

export interface WebSocketMessage {
  type: string;
  data?: any;
  timestamp?: string;
  [key: string]: any;
}

export interface WebSocketConnectionOptions {
  url: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectInterval: number;
  private maxReconnectAttempts: number;
  private heartbeatInterval: number;
  private reconnectAttempts: number = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private isConnecting: boolean = false;
  private isConnected: boolean = false;

  constructor(options: WebSocketConnectionOptions) {
    super();
    this.url = options.url;
    this.reconnectInterval = options.reconnectInterval || 5000;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.heartbeatInterval = options.heartbeatInterval || 30000;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting || this.isConnected) {
        resolve();
        return;
      }

      this.isConnecting = true;

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          websocketLogger.info('WebSocket connected successfully to:', this.url);
          this.isConnecting = false;
          this.isConnected = true;
          this.reconnectAttempts = 0;
          this.emit('connected');
          this.startHeartbeat();
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            websocketLogger.error('Failed to parse WebSocket message:', error);
            this.emit('error', { type: 'parse_error', error });
          }
        };

        this.ws.onclose = (event) => {
          this.isConnecting = false;
          this.isConnected = false;
          this.stopHeartbeat();
          this.emit('disconnected', event);
          
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        };

        this.ws.onerror = (error) => {
          websocketLogger.error('WebSocket error connecting to:', this.url, error);
          this.isConnecting = false;
          this.emit('error', error);
          reject(error);
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.stopReconnect();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.isConnected = false;
    this.emit('disconnected');
  }

  send(message: WebSocketMessage): boolean {
    if (!this.isConnected || !this.ws) {
      websocketLogger.warning('WebSocket not connected, cannot send message');
      return false;
    }

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      websocketLogger.error('Failed to send WebSocket message:', error);
      this.emit('error', { type: 'send_error', error });
      return false;
    }
  }

  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case 'connection_established':
        this.emit('connection_established', message);
        break;
        
      case 'heartbeat_response':
        this.emit('heartbeat_response', message);
        break;
        
      case 'authorization_update':
        this.emit('authorization_update', message);
        break;
        
      case 'command':
        this.emit('command', message);
        break;
        
      case 'playlist_update':
        this.emit('playlist_update', message);
        break;
        
      case 'device_registered':
        this.emit('device_registered', message);
        break;
        
      case 'device_authorized':
        this.emit('device_authorized', message);
        break;
        
      case 'device_rejected':
        this.emit('device_rejected', message);
        break;
        
      case 'device_updated':
        this.emit('device_updated', message);
        break;
        
      case 'device_deleted':
        this.emit('device_deleted', message);
        break;
        
      case 'device_activity':
        this.emit('device_activity', message);
        break;
        
      case 'device_error':
        this.emit('device_error', message);
        break;
        
      case 'error':
        this.emit('websocket_error', message);
        break;
        
      default:
        this.emit('message', message);
        break;
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: 'heartbeat' });
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    this.stopReconnect();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      websocketLogger.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      this.connect().catch(error => {
        websocketLogger.error('Reconnection failed:', error);
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.emit('max_reconnect_attempts_reached');
        }
      });
    }, this.reconnectInterval);
  }

  private stopReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  get connected(): boolean {
    return this.isConnected;
  }

  get connecting(): boolean {
    return this.isConnecting;
  }
}

// Device WebSocket client
export class DeviceWebSocketClient extends WebSocketClient {
  private deviceToken: string;

  constructor(deviceToken: string, baseUrl?: string) {
    // Use dynamic URL from urlResolver - fix malformed URL construction
    let wsBaseUrl;
    if (baseUrl) {
      wsBaseUrl = baseUrl;
    } else {
      // Get the server base URL and construct WebSocket URL manually
      const serverUrl = urlResolver.getServerBaseUrl();
      const wsProtocol = serverUrl.startsWith('https') ? 'wss' : 'ws';
      // Fix: Ensure proper protocol replacement with colon
      wsBaseUrl = serverUrl.replace(/^https?:/, wsProtocol + ':') + '/ws/device';
    }
    
    super({
      url: wsBaseUrl,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000
    });
    this.deviceToken = deviceToken;
  }

  sendStatusUpdate(status: any): boolean {
    return this.send({
      type: 'status_update',
      data: status,
      timestamp: new Date().toISOString()
    });
  }

  sendErrorReport(error: any): boolean {
    return this.send({
      type: 'error_report',
      data: error,
      timestamp: new Date().toISOString()
    });
  }
}

// Admin WebSocket client
export class AdminWebSocketClient extends WebSocketClient {
  constructor(baseUrl?: string) {
    // Use dynamic URL from urlResolver
    const wsBaseUrl = baseUrl || urlResolver.getWebSocketUrl('/admin');

    super({
      url: wsBaseUrl,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000
    });
  }

  authorizeDevice(deviceToken: string, deviceName?: string, deviceIdentifier?: string): boolean {
    return this.send({
      type: 'authorize_device',
      device_token: deviceToken,
      device_name: deviceName,
      device_identifier: deviceIdentifier
    });
  }

  rejectDevice(deviceToken: string): boolean {
    return this.send({
      type: 'reject_device',
      device_token: deviceToken
    });
  }

  sendCommand(deviceToken: string, command: string, data?: any): boolean {
    return this.send({
      type: 'send_command',
      device_token: deviceToken,
      command,
      data
    });
  }

  updatePlaylist(deviceToken: string, playlistData: any): boolean {
    return this.send({
      type: 'update_playlist',
      device_token: deviceToken,
      playlist_data: playlistData
    });
  }
}

// Singleton instances
let deviceWebSocket: DeviceWebSocketClient | null = null;
let adminWebSocket: AdminWebSocketClient | null = null;

export const getDeviceWebSocket = (deviceToken: string): DeviceWebSocketClient => {
  if (!deviceWebSocket || deviceWebSocket['deviceToken'] !== deviceToken) {
    deviceWebSocket = new DeviceWebSocketClient(deviceToken);
  }
  return deviceWebSocket;
};

export const getAdminWebSocket = (): AdminWebSocketClient => {
  if (!adminWebSocket) {
    adminWebSocket = new AdminWebSocketClient();
  }
  return adminWebSocket;
};

export const disconnectAll = (): void => {
  if (deviceWebSocket) {
    deviceWebSocket.disconnect();
    deviceWebSocket = null;
  }
  if (adminWebSocket) {
    adminWebSocket.disconnect();
    adminWebSocket = null;
  }
};
