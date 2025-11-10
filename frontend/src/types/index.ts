export interface ApiResponse<T> {
  message: string;
  data: T;
  status_code: number;
}

export interface User {
  id: number;
  username: string;
  email: string | null;
  role: 'super_admin' | 'admin' | 'user';
  is_active: boolean;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  last_login: string | null;
}

export interface Image {
  id: number;
  filename: string;
  original_filename: string;
  album_id: number | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  mime_type: string | null;
  exif: Record<string, any> | null;
  uploaded_at: string;
  playlist_id: number | null;
  url: string;
  thumbnail_url: string;
  scaledVersions?: Array<{
    dimensions: string;
    width: number;
    height: number;
    filename: string;
  }>;
  processing_status?: 'pending' | 'processing' | 'complete' | 'failed';
  thumbnail_status?: 'pending' | 'processing' | 'complete' | 'failed';
  variant_status?: 'pending' | 'processing' | 'complete' | 'failed';
  processing_error?: string | null;
  processing_attempts?: number;
  last_processing_attempt?: string | null;
  processing_completed_at?: string | null;
}

/**
 * Lightweight image manifest for cache prefetching
 * Contains only essential metadata for IndexedDB storage
 */
export interface ImageManifestItem {
  id: string;
  url: string;
  filename: string;
  mime_type: string;
  file_size: number;
  checksum: string | null;  // MD5 hash for cache invalidation
  updated_at: string | null;  // ISO timestamp for change detection
}

export interface ImageManifest {
  success: boolean;
  playlist_id: number;
  playlist_name: string;
  manifest: ImageManifestItem[];
  count: number;
  total_size: number;
}

export interface Album {
  id: number;
  name: string;
  created_at: string;
  updated_at: string;
  image_count: number;
}

export type DisplayMode = 'default' | 'auto_sort' | 'ken_burns_plus' | 'soft_glow' | 'ambient_pulse' | 'dreamy_reveal' | 'stacked_reveal';

export interface Playlist {
  id: number;
  name: string;
  slug: string;
  is_default: boolean;
  sequence: number[] | null;
  display_time_seconds: number;
  display_mode: DisplayMode;
  show_image_info?: boolean;
  show_exif_date?: boolean;
  created_at: string;
  updated_at: string;
  image_count: number;
}

export interface Device {
  id: string;
  name: string;
  is_authorized: boolean;
  last_seen?: string;
  current_playlist_id?: number;
}

export interface LoginCredentials {
  username: string;
  password: string;
  device_name?: string;
}

export type ScheduleType = 'recurring' | 'specific_date';

export interface ScheduledPlaylist {
  id: number;
  device_id: number;
  playlist_id: number;
  schedule_type: ScheduleType;
  // Recurring fields
  days_of_week?: string[]; // ['monday', 'tuesday', ...]
  start_time?: string; // 'HH:MM:SS'
  end_time?: string; // 'HH:MM:SS'
  // Specific date fields
  specific_date?: string; // 'YYYY-MM-DD'
  specific_start_time?: string; // 'HH:MM:SS'
  specific_end_time?: string; // 'HH:MM:SS'
  annual_recurrence?: boolean;
  // Common fields
  name: string;
  description?: string | null;
  priority: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  created_by_user_id?: number | null;
  // Relationships
  device_name?: string | null;
  playlist_name?: string | null;
  is_active?: boolean;
  next_activation?: string | null;
}

export interface ScheduleFormData {
  device_id: number;
  playlist_id: number;
  schedule_type: ScheduleType;
  name: string;
  description?: string;
  priority: number;
  enabled: boolean;
  days_of_week?: string[];
  start_time?: string;
  end_time?: string;
  specific_date?: string;
  specific_start_time?: string;
  specific_end_time?: string;
  annual_recurrence?: boolean;
}

export type ActionType = 'power_on' | 'power_off' | 'set_input';

export interface ScheduledAction {
  id: number;
  device_id: number;
  action_type: ActionType;
  action_data?: Record<string, any> | null;
  schedule_type: ScheduleType;
  // Recurring fields
  days_of_week?: string[];
  start_time?: string;
  end_time?: string;
  // Specific date fields
  specific_date?: string;
  specific_start_time?: string;
  specific_end_time?: string;
  annual_recurrence?: boolean;
  // Common fields
  name: string;
  description?: string | null;
  priority: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  created_by_user_id?: number | null;
  // Relationships
  device_name?: string | null;
  is_active?: boolean;
}

export interface ActionFormData {
  device_id: number;
  action_type: ActionType;
  action_data?: Record<string, any>;
  schedule_type: ScheduleType;
  name: string;
  description?: string;
  priority: number;
  enabled: boolean;
  days_of_week?: string[];
  start_time?: string;
  end_time?: string;
  specific_date?: string;
  specific_start_time?: string;
  specific_end_time?: string;
  annual_recurrence?: boolean;
}

export interface ActiveScheduleResponse {
  schedule_id: number | null;
  schedule_name: string | null;
  playlist_id: number | null;
  playlist_name: string | null;
  active_since: string | null;
  active_until: string | null;
  is_default: boolean;
}
