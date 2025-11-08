import React, { useState, useEffect } from 'react';
import { Play, Settings, Shuffle, Repeat, Clock, Image as ImageIcon } from 'lucide-react';
import { FullscreenSlideshow } from './FullscreenSlideshow';
import { SlideshowSettings } from './SlideshowSettings';
import { apiService } from '../services/api';
import type { Image, Playlist } from '../types';

interface SlideshowLauncherProps {
  playlistId?: number;
  onClose?: () => void;
}

export const SlideshowLauncher: React.FC<SlideshowLauncherProps> = ({
  playlistId,
  onClose
}) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [images, setImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSlideshow, setShowSlideshow] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [slideshowSettings, setSlideshowSettings] = useState({
    autoPlay: true,
    interval: 5,
    transition: 'fade' as const,
    showControls: true,
    showInfo: true,
    shuffle: false,
    loop: true,
    volume: 0.5,
  });

  // Load playlists on mount
  useEffect(() => {
    loadPlaylists();
  }, []);

  // Load specific playlist if provided
  useEffect(() => {
    if (playlistId) {
      loadPlaylist(playlistId);
    }
  }, [playlistId]);

  const loadPlaylists = async () => {
    try {
      const response = await apiService.getPlaylists();
      setPlaylists(response.data || []);
    } catch (error) {
      console.error('Failed to load playlists:', error);
    }
  };

  const loadPlaylist = async (id: number) => {
    try {
      setLoading(true);
      
      // Find the playlist
      const playlist = playlists.find(p => p.id === id);
      if (playlist) {
        setSelectedPlaylist(playlist);
        
        // Load images for the playlist
        const imagesResponse = await apiService.getImages(undefined, id);
        const playlistImages = imagesResponse.data || [];
        
        // Sort images by playlist sequence if available
        if (playlist.sequence && Array.isArray(playlist.sequence)) {
          const sortedImages = playlistImages.sort((a, b) => {
            const aIndex = playlist.sequence!.indexOf(a.id);
            const bIndex = playlist.sequence!.indexOf(b.id);
            if (aIndex === -1 && bIndex === -1) return 0;
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
          });
          setImages(sortedImages);
        } else {
          setImages(playlistImages);
        }
      }
    } catch (error) {
      console.error('Failed to load playlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaylistSelect = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    loadPlaylist(playlist.id);
  };

  const startSlideshow = () => {
    if (images.length > 0) {
      setShowSlideshow(true);
    }
  };

  const stopSlideshow = () => {
    setShowSlideshow(false);
  };

  const handleSettingsChange = (newSettings: any) => {
    setSlideshowSettings(newSettings);
  };

  const handleResetSettings = () => {
    const defaultSettings = {
      autoPlay: true,
      interval: 5,
      transition: 'fade' as const,
      showControls: true,
      showInfo: true,
      shuffle: false,
      loop: true,
      volume: 0.5,
    };
    setSlideshowSettings(defaultSettings);
  };

  if (showSlideshow) {
    return (
      <FullscreenSlideshow
        images={images}
        playlist={selectedPlaylist || undefined}
        initialSettings={slideshowSettings}
        onClose={stopSlideshow}
      />
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Launch Slideshow</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Playlist Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Playlist
          </label>
          <select
            value={selectedPlaylist?.id || ''}
            onChange={(e) => {
              const playlist = playlists.find(p => p.id === parseInt(e.target.value));
              if (playlist) {
                handlePlaylistSelect(playlist);
              }
            }}
            className="w-full bg-gray-50 border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">Choose a playlist...</option>
            {playlists.map(playlist => (
              <option key={playlist.id} value={playlist.id}>
                {playlist.name} ({playlist.image_count} images)
              </option>
            ))}
          </select>
        </div>

        {/* Playlist Info */}
        {selectedPlaylist && (
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-medium text-gray-900">{selectedPlaylist.name}</h3>
              {selectedPlaylist.is_default && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Default
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
              <div className="flex items-center">
                <ImageIcon className="w-4 h-4 mr-2" />
                <span>{images.length} images</span>
              </div>
              <div className="flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                <span>~{Math.round((images.length * slideshowSettings.interval) / 60)} min</span>
              </div>
            </div>
          </div>
        )}

        {/* Quick Settings Preview */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-medium text-gray-900 mb-3">Current Settings</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Auto Play</span>
              <span className={slideshowSettings.autoPlay ? 'text-green-600' : 'text-gray-400'}>
                {slideshowSettings.autoPlay ? 'On' : 'Off'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Interval</span>
              <span className="text-gray-900">{slideshowSettings.interval}s</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Transition</span>
              <span className="text-gray-900 capitalize">{slideshowSettings.transition}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Loop</span>
              <span className={slideshowSettings.loop ? 'text-green-600' : 'text-gray-400'}>
                {slideshowSettings.loop ? 'On' : 'Off'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Shuffle</span>
              <span className={slideshowSettings.shuffle ? 'text-green-600' : 'text-gray-400'}>
                {slideshowSettings.shuffle ? 'On' : 'Off'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Controls</span>
              <span className={slideshowSettings.showControls ? 'text-green-600' : 'text-gray-400'}>
                {slideshowSettings.showControls ? 'On' : 'Off'}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowSettings(true)}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>Advanced Settings</span>
          </button>

          <div className="flex items-center space-x-3">
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={startSlideshow}
              disabled={!selectedPlaylist || images.length === 0 || loading}
              className="flex items-center space-x-2 bg-primary-600 text-white px-6 py-2 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Play className="w-4 h-4" />
              <span>Start Slideshow</span>
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
            <p className="text-sm text-gray-500 mt-2">Loading playlist...</p>
          </div>
        )}

        {/* No Images Warning */}
        {selectedPlaylist && !loading && images.length === 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center">
              <ImageIcon className="w-5 h-5 text-yellow-600 mr-2" />
              <div>
                <h4 className="text-sm font-medium text-yellow-800">No Images Found</h4>
                <p className="text-sm text-yellow-700">
                  This playlist doesn't contain any images. Add images to the playlist to start a slideshow.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Settings Modal */}
      <SlideshowSettings
        settings={slideshowSettings}
        onSettingsChange={handleSettingsChange}
        onReset={handleResetSettings}
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
};

export default SlideshowLauncher;

















