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
