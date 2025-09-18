import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PlaylistManagerEnhanced } from '../components/PlaylistManagerEnhanced';
import { apiService } from '../services/api';
import type { Playlist } from '../types';

export const PlaylistsEnhanced: React.FC = () => {
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load playlists on component mount
  useEffect(() => {
    loadPlaylists();
  }, []);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getPlaylists();
      setPlaylists(response.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load playlists');
      console.error('Failed to load playlists:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaylist = async (name: string) => {
    try {
      const response = await apiService.createPlaylist(name);
      setPlaylists(prev => [...prev, response.data]);
    } catch (err: any) {
      throw new Error(err.message || 'Failed to create playlist');
    }
  };

  const handleUpdatePlaylist = async (id: number, data: Partial<Playlist>) => {
    try {
      const response = await apiService.updatePlaylist(id, data.name, data.is_default);
      setPlaylists(prev => prev.map(playlist => 
        playlist.id === id ? response.data : playlist
      ));
    } catch (err: any) {
      throw new Error(err.message || 'Failed to update playlist');
    }
  };

  const handleDeletePlaylist = async (id: number) => {
    try {
      await apiService.deletePlaylist(id);
      setPlaylists(prev => prev.filter(p => p.id !== id));
    } catch (err: any) {
      throw new Error(err.message || 'Failed to delete playlist');
    }
  };

  const handleReorderPlaylists = async (reorderedPlaylists: Playlist[]) => {
    try {
      const playlistIds = reorderedPlaylists.map(playlist => playlist.id);
      await apiService.reorderPlaylists(playlistIds);
      setPlaylists(reorderedPlaylists);
    } catch (err: any) {
      console.error('Failed to reorder playlists:', err);
      // Revert the order on error
      loadPlaylists();
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      await apiService.updatePlaylist(id, undefined, true);
      // Reload playlists to update default status
      loadPlaylists();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to set default playlist');
    }
  };

  const handleBackToDashboard = () => {
    navigate('/admin');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-500 mb-4">
          <ArrowLeft className="w-16 h-16 mx-auto" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Playlists</h3>
        <p className="text-gray-500 mb-4">{error}</p>
        <button onClick={loadPlaylists} className="btn-primary">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={handleBackToDashboard}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Dashboard</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Enhanced Playlist Management</h1>
            <p className="text-gray-600">
              Create and manage display playlists with drag-and-drop reordering and bulk operations
            </p>
          </div>
        </div>
      </div>

      {/* Enhanced Playlist Manager */}
      <PlaylistManagerEnhanced
        playlists={playlists}
        onCreatePlaylist={handleCreatePlaylist}
        onUpdatePlaylist={handleUpdatePlaylist}
        onDeletePlaylist={handleDeletePlaylist}
        onReorderPlaylists={handleReorderPlaylists}
        onSetDefault={handleSetDefault}
        loading={loading}
      />
    </div>
  );
};

export default PlaylistsEnhanced;




