/**
 * Centralized URL resolution service
 * Handles dynamic server URL configuration
 */

class UrlResolver {
  private static instance: UrlResolver;
  private serverBaseUrl: string = 'http://localhost:8001';

  private constructor() {
    // Initialize with default value
    this.loadServerUrl();
  }

  public static getInstance(): UrlResolver {
    if (!UrlResolver.instance) {
      UrlResolver.instance = new UrlResolver();
    }
    return UrlResolver.instance;
  }

  /**
   * Load server URL from settings or use default
   */
  private loadServerUrl(): void {
    // Try to get from localStorage (cached from settings)
    const cachedUrl = localStorage.getItem('server_base_url');
    if (cachedUrl) {
      this.serverBaseUrl = cachedUrl;
      return;
    }

    // Try to get from environment variables
    const envUrl = import.meta.env.VITE_SERVER_BASE_URL;
    if (envUrl) {
      this.serverBaseUrl = envUrl;
      return;
    }

    // Use default based on current location
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol;
      const hostname = window.location.hostname;
      
      // If running on localhost, use localhost:8001
      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        this.serverBaseUrl = 'http://localhost:8001';
      } 
      // If accessing via IP address, add port 8001
      else if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
        this.serverBaseUrl = `${protocol}//${hostname}:8001`;
      }
      // For domain names (reverse proxy), use same protocol and hostname without port
      // The reverse proxy should handle routing /api/* to the backend
      else {
        this.serverBaseUrl = `${protocol}//${hostname}`;
      }
    }
  }

  /**
   * Update server URL (called when settings are updated)
   */
  public updateServerUrl(newUrl: string): void {
    this.serverBaseUrl = newUrl;
    localStorage.setItem('server_base_url', newUrl);
  }

  /**
   * Get the base server URL
   */
  public   getServerBaseUrl(): string {
    return this.serverBaseUrl;
  }

  /**
   * Get API endpoint URL
   */
  public getApiUrl(endpoint: string = ''): string {
    // In development, use relative URLs so Vite proxy handles the routing
    // This avoids CORS issues and matches the architecture where frontend is the single entry point
    const isDevelopment = import.meta.env.DEV;
    
    if (isDevelopment) {
      // Use relative URL - Vite proxy will forward to backend
      const apiPath = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
      return apiPath;
    }
    
    // In production, use absolute URLs
    const baseUrl = this.serverBaseUrl.endsWith('/') 
      ? this.serverBaseUrl.slice(0, -1) 
      : this.serverBaseUrl;
    
    const apiPath = endpoint.startsWith('/api') ? endpoint : `/api${endpoint}`;
    return `${baseUrl}${apiPath}`;
  }

  /**
   * Get WebSocket URL
   */
  public getWebSocketUrl(endpoint: string = ''): string {
    const baseUrl = this.serverBaseUrl;
    const wsProtocol = baseUrl.startsWith('https') ? 'wss' : 'ws';
    const wsBaseUrl = baseUrl.replace(/^https?:/, wsProtocol);
    
    const wsPath = endpoint.startsWith('/ws') ? endpoint : `/ws${endpoint}`;
    return `${wsBaseUrl}${wsPath}`;
  }

  /**
   * Get image URL
   */
  public getImageUrl(imageId: number, size?: 'small' | 'medium' | 'large'): string {
    const baseUrl = this.getApiUrl(`/images/${imageId}/file`);
    return size ? `${baseUrl}?size=${size}` : baseUrl;
  }

  /**
   * Get thumbnail URL
   */
  public getThumbnailUrl(imageId: number, size: 'small' | 'medium' | 'large' = 'medium'): string {
    return this.getImageUrl(imageId, size);
  }

  /**
   * Get OAuth redirect URL
   */
  public getOAuthRedirectUrl(provider: string): string {
    return this.getApiUrl(`/auth/${provider}/login`);
  }
}

// Export singleton instance
export const urlResolver = UrlResolver.getInstance();
export default urlResolver;
