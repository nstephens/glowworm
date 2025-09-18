import axios, { type AxiosInstance } from 'axios';
import type { ApiResponse, User, Image, Album, Playlist } from '../types';
import { urlResolver } from './urlResolver';
import { apiLogger } from '../utils/logger';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: urlResolver.getApiUrl(),
      withCredentials: true,
      timeout: 10000, // 10 second timeout for all requests
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for CSRF token
    this.api.interceptors.request.use((config) => {
      const csrfToken = this.getCsrfToken();
      if (csrfToken && ['post', 'put', 'patch', 'delete'].includes(config.method || '')) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
      return config;
    });

    // Add response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // window.location.href = "/login"; // Commented out - App component handles auth state
        }
        return Promise.reject(error);
      }
    );
  }

  private getCsrfToken(): string | null {
    const nameEQ = "glowworm_csrf=";
    const ca = document.cookie.split(';');
    apiLogger.debug('All cookies:', document.cookie);
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        const token = c.substring(nameEQ.length, c.length);
        apiLogger.debug('Found CSRF token:', token);
        return token;
      }
    }
    apiLogger.debug('No CSRF token found');
    return null;
  }

  // Auth endpoints
  async login(username: string, password: string, deviceName?: string): Promise<{ success: boolean; message: string; user?: User }> {
    const response = await this.api.post('/auth/login', { username, password, device_name: deviceName });
    return response.data;
  }

  async logout(): Promise<ApiResponse<any>> {
    const response = await this.api.post('/auth/logout');
    return response.data;
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    const response = await this.api.get('/auth/me');
    // The /auth/me endpoint returns the user object directly, not wrapped in ApiResponse
    return {
      success: true,
      message: "Current user retrieved successfully",
      data: response.data,
      status_code: response.status
    };
  }

  async getUserProfile(): Promise<ApiResponse<User>> {
    const response = await this.api.get('/auth/me');
    // The /auth/me endpoint returns the user object directly, not wrapped in ApiResponse
    return {
      success: true,
      message: "User profile retrieved successfully",
      data: response.data,
      status_code: response.status
    };
  }

  async register(username: string, password: string, email?: string): Promise<ApiResponse<{ user: User; message: string }>> {
    const response = await this.api.post('/auth/register', { username, password, email });
    return response.data;
  }

  // Image endpoints
  async uploadImage(formData: FormData): Promise<ApiResponse<Image>> {
    const response = await this.api.post('/images/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async getImages(albumId?: number, playlistId?: number): Promise<ApiResponse<Image[]>> {
    const params = new URLSearchParams();
    if (albumId) params.append('album_id', albumId.toString());
    if (playlistId) params.append('playlist_id', playlistId.toString());

    const response = await this.api.get(`/images/?${params.toString()}`);
    return response.data;
  }

  async getImage(id: number): Promise<ApiResponse<Image>> {
    const response = await this.api.get(`/images/${id}`);
    return response.data;
  }

  async getImageScaledVersions(id: number): Promise<ApiResponse<{scaled_versions: Array<{dimensions: string, width: number, height: number, filename: string}>}>> {
    const response = await this.api.get(`/images/${id}/scaled-versions`);
    return response.data;
  }

  async updateImage(id: number, data: Partial<Image>): Promise<ApiResponse<Image>> {
    // Convert to form data for backend compatibility
    const formData = new FormData();
    if (data.album_id !== undefined) {
      formData.append('album_id', data.album_id.toString());
    }
    if (data.playlist_id !== undefined) {
      formData.append('playlist_id', data.playlist_id.toString());
    }
    
    const response = await this.api.put(`/images/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async deleteImage(id: number): Promise<ApiResponse<any>> {
    const response = await this.api.delete(`/images/${id}`);
    return response.data;
  }

  async checkDuplicateImage(fileHash: string): Promise<{ is_duplicate: boolean; existing_image?: Image; message: string }> {
    const response = await this.api.post('/images/check-duplicate', { file_hash: fileHash });
    return response.data;
  }

  // Album endpoints
  async getAlbums(): Promise<ApiResponse<Album[]>> {
    const response = await this.api.get('/albums/');
    return response.data;
  }

  async getAlbum(id: number): Promise<ApiResponse<Album>> {
    const response = await this.api.get(`/albums/${id}`);
    return response.data;
  }

  async createAlbum(name: string): Promise<ApiResponse<Album>> {
    const response = await this.api.post('/albums/', { name });
    return response.data;
  }

  async updateAlbum(id: number, name: string): Promise<ApiResponse<Album>> {
    const response = await this.api.put(`/albums/${id}`, { name });
    return response.data;
  }

  async deleteAlbum(id: number): Promise<ApiResponse<any>> {
    const response = await this.api.delete(`/albums/${id}`);
    return response.data;
  }

  async addImageToAlbum(albumId: number, imageId: number): Promise<ApiResponse<any>> {
    const response = await this.api.post(`/albums/${albumId}/images/${imageId}`);
    return response.data;
  }

  async removeImageFromAlbum(albumId: number, imageId: number): Promise<ApiResponse<any>> {
    const response = await this.api.delete(`/albums/${albumId}/images/${imageId}`);
    return response.data;
  }

  async reorderAlbums(albumIds: number[]): Promise<ApiResponse<any>> {
    const response = await this.api.put('/albums/reorder', { album_ids: albumIds });
    return response.data;
  }

  async bulkDeleteAlbums(albumIds: number[]): Promise<ApiResponse<any>> {
    const response = await this.api.delete('/albums/bulk', { data: { album_ids: albumIds } });
    return response.data;
  }

  // Playlist endpoints
  async getPlaylists(): Promise<ApiResponse<Playlist[]>> {
    const response = await this.api.get('/playlists/');
    return response.data;
  }

  async getPlaylist(id: number): Promise<ApiResponse<Playlist>> {
    const response = await this.api.get(`/playlists/${id}`);
    return response.data;
  }

  async getPlaylistImages(id: number): Promise<ApiResponse<Image[]>> {
    const response = await this.api.get(`/playlists/${id}/images`);
    return response.data;
  }

  async getDefaultPlaylist(): Promise<ApiResponse<Playlist>> {
    const response = await this.api.get('/playlists/default');
    return response.data;
  }

  async createPlaylist(name: string, isDefault = false): Promise<ApiResponse<Playlist>> {
    const response = await this.api.post('/playlists/', { name, is_default: isDefault });
    return response.data;
  }

  async updatePlaylist(id: number, name?: string, isDefault?: boolean, displayTimeSeconds?: number, displayMode?: string): Promise<ApiResponse<Playlist>> {
    const response = await this.api.put(`/playlists/${id}`, { name, is_default: isDefault, display_time_seconds: displayTimeSeconds, display_mode: displayMode });
    return response.data;
  }

  async deletePlaylist(id: number): Promise<ApiResponse<any>> {
    const response = await this.api.delete(`/playlists/${id}`);
    return response.data;
  }

  async addImageToPlaylist(playlistId: number, imageId: number, position?: number): Promise<ApiResponse<any>> {
    const response = await this.api.post(`/playlists/${playlistId}/images/${imageId}`, { position });
    return response.data;
  }

  async removeImageFromPlaylist(playlistId: number, imageId: number): Promise<ApiResponse<any>> {
    const response = await this.api.delete(`/playlists/${playlistId}/images/${imageId}`);
    return response.data;
  }

  async reorderPlaylist(playlistId: number, imageIds: number[]): Promise<ApiResponse<any>> {
    const response = await this.api.put(`/playlists/${playlistId}/reorder`, { image_ids: imageIds });
    return response.data;
  }

  async randomizePlaylist(playlistId: number): Promise<ApiResponse<any>> {
    const response = await this.api.post(`/playlists/${playlistId}/randomize`);
    return response.data;
  }

  async reorderPlaylists(playlistIds: number[]): Promise<ApiResponse<any>> {
    const response = await this.api.put('/playlists/reorder', { playlist_ids: playlistIds });
    return response.data;
  }

  async bulkDeletePlaylists(playlistIds: number[]): Promise<ApiResponse<any>> {
    const response = await this.api.delete('/playlists/bulk', { data: { playlist_ids: playlistIds } });
    return response.data;
  }

  // Storage endpoints
  async getStorageStatistics(): Promise<ApiResponse<any>> {
    const response = await this.api.get('/storage/statistics');
    return response.data;
  }

  async getEfficiencyReport(): Promise<ApiResponse<any>> {
    const response = await this.api.get('/storage/efficiency-report');
    return response.data;
  }

  // Setup endpoints
  async getStatus(): Promise<ApiResponse<{ is_configured: boolean }>> {
    const response = await this.api.get('/setup/status');
    return response.data;
  }

  async completeSetup(setupData: any): Promise<ApiResponse<any>> {
    const response = await this.api.post('/setup/complete', setupData);
    return response.data;
  }

  async getNetworkInterfaces(): Promise<ApiResponse<any>> {
    const response = await this.api.get('/setup/network-interfaces');
    return response.data;
  }

  async testDatabaseConnection(connectionData: any): Promise<ApiResponse<any>> {
    const response = await this.api.post('/setup/test-database-connection', connectionData);
    return response.data;
  }

  async checkUser(userData: any): Promise<ApiResponse<any>> {
    const response = await this.api.post('/setup/check-user', userData);
    return response.data;
  }

  async recreateUser(userData: any): Promise<ApiResponse<any>> {
    const response = await this.api.post('/setup/recreate-user', userData);
    return response.data;
  }

  async resetSetup(): Promise<ApiResponse<any>> {
    const response = await this.api.post('/setup/reset');
    return response.data;
  }

  // Settings API methods
  async getSettings(): Promise<ApiResponse<any>> {
    const response = await this.api.get('/settings');
    return response.data;
  }

  async updateSettings(settings: any): Promise<ApiResponse<any>> {
    const response = await this.api.put('/settings', settings);
    return response.data;
  }

  async getDisplaySizes(): Promise<ApiResponse<any>> {
    const response = await this.api.get('/settings/display-sizes');
    return response.data;
  }

  async updateDisplaySizes(displaySizes: string[]): Promise<ApiResponse<any>> {
    const response = await this.api.put('/settings/display-sizes', displaySizes);
    return response.data;
  }

  // User management endpoints
  async getUsers(): Promise<ApiResponse<User[]>> {
    const response = await this.api.get('/users/');
    // The /users/ endpoint returns the users array directly, not wrapped in ApiResponse
    return {
      success: true,
      message: "Users retrieved successfully",
      data: response.data,
      status_code: response.status
    };
  }

  async createUser(userData: any): Promise<ApiResponse<User>> {
    const response = await this.api.post('/users/', userData);
    return response.data;
  }

  async updateUser(userId: number, userData: any): Promise<ApiResponse<User>> {
    const response = await this.api.put(`/users/${userId}`, userData);
    return response.data;
  }

  async deleteUser(userId: number): Promise<ApiResponse<any>> {
    const response = await this.api.delete(`/users/${userId}`);
    return response.data;
  }

  async toggleUserActive(userId: number): Promise<ApiResponse<any>> {
    const response = await this.api.post(`/users/${userId}/toggle-active`);
    // The /users/{id}/toggle-active endpoint returns the user object directly, not wrapped in ApiResponse
    return {
      success: true,
      message: "User status toggled successfully",
      data: response.data,
      status_code: response.status
    };
  }

  async updateUserPassword(userId: number, passwordData: any): Promise<ApiResponse<any>> {
    const response = await this.api.put(`/users/${userId}/password`, passwordData);
    return response.data;
  }

  async resetUserPassword(userId: number, newPassword: string): Promise<ApiResponse<any>> {
    const response = await this.api.put(`/users/${userId}/reset-password`, { new_password: newPassword });
    return response.data;
  }

  // Display device endpoints
  async validateDeviceCookie(): Promise<ApiResponse<any>> {
    const response = await this.api.get('/display-devices/validate-cookie');
    return response.data;
  }

  async resetDisplayDevice(deviceId: number): Promise<ApiResponse<any>> {
    const response = await this.api.post(`/display-devices/admin/devices/${deviceId}/reset`);
    return response.data;
  }

  // Device endpoints
  async getDevices(): Promise<any[]> {
    const response = await this.api.get('/display-devices/admin/devices');
    return response.data;
  }
}

export const apiService = new ApiService();
export const setupApi = apiService; // Alias for setup-related API calls
export default apiService;
