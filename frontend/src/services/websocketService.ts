/**
 * WebSocket service for real-time updates
 */
import { urlResolver } from './urlResolver';

export interface RegenerationProgress {
  task_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  total_images: number;
  processed_images: number;
  error_count: number;
  current_image?: string;
  display_sizes: string[];
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  progress_percentage: number;
}

export interface WebSocketMessage {
  type: 'regeneration_progress';
  data: RegenerationProgress;
}

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // 1 second
  private isConnecting = false;

  connect(taskId: string, onMessage: (message: WebSocketMessage) => void, onError?: (error: Event) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      // If already connected to the same task, just resolve
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        console.log('🔌 WebSocket already connected');
        resolve();
        return;
      }

      // If connecting, wait a bit and try again
      if (this.isConnecting) {
        console.log('🔌 WebSocket connection in progress, waiting...');
        setTimeout(() => {
          this.connect(taskId, onMessage, onError).then(resolve).catch(reject);
        }, 100);
        return;
      }

      this.isConnecting = true;

      try {
        // Always use urlResolver.getWebSocketUrl to get the correct protocol (ws/wss)
        const fullWsUrl = urlResolver.getWebSocketUrl(`/api/ws/regeneration-progress/${taskId}`);
        console.log(`🔌 Connecting to WebSocket: ${fullWsUrl}`);

        this.ws = new WebSocket(fullWsUrl);

        this.ws.onopen = () => {
          console.log('✅ WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            console.log('📨 WebSocket message received:', message);
            onMessage(message);
          } catch (error) {
            console.error('❌ Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('🔌 WebSocket closed:', event.code, event.reason);
          this.isConnecting = false;
          
          // Attempt to reconnect if not a normal closure
          if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect(taskId, onMessage, onError);
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.isConnecting = false;
          onError?.(error);
        };

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private attemptReconnect(taskId: string, onMessage: (message: WebSocketMessage) => void, onError?: (error: Event) => void) {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // Exponential backoff
    
    console.log(`🔄 Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect(taskId, onMessage, onError).catch((error) => {
        console.error('❌ Reconnection failed:', error);
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          onError?.(new Error('Max reconnection attempts reached'));
        }
      });
    }, delay);
  }

  disconnect(): void {
    if (this.ws) {
      console.log('🔌 Disconnecting WebSocket');
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.ws.close(1000, 'User disconnected');
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const websocketService = new WebSocketService();
