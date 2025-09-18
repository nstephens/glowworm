import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Edit, Trash2, Play, Settings } from 'lucide-react';
import { apiService } from '../services/api';
import { ConfirmationModal } from '../components/ConfirmationModal';
import type { Playlist } from '../types';

export const Playlists: React.FC = () => {
  const navigate = useNavigate();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Load playlists on component mount
  useEffect(() => {
    loadPlaylists();
  }, []);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getPlaylists();
      console.log('📋 Loaded playlists:', response.playlists);
      response.playlists?.forEach(playlist => {
        console.log(`📋 Playlist "${playlist.name}": display_mode = ${playlist.display_mode}`);
      });
      setPlaylists(response.playlists || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load playlists');
      console.error('Failed to load playlists:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    
    try {
      setIsCreating(true);
      const response = await apiService.createPlaylist(newPlaylistName.trim());
      setPlaylists(prev => [...prev, response.playlist]);
      setNewPlaylistName('');
      setShowCreateModal(false);
    } catch (err: any) {
      alert('Failed to create playlist: ' + (err.message || 'Unknown error'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeletePlaylist = async () => {
    if (!playlistToDelete) return;
    
    try {
      await apiService.deletePlaylist(playlistToDelete.id);
      setPlaylists(prev => prev.filter(p => p.id !== playlistToDelete.id));
    } catch (err: any) {
      alert('Failed to delete playlist: ' + (err.message || 'Unknown error'));
    } finally {
      setShowDeleteModal(false);
      setPlaylistToDelete(null);
    }
  };

  const handleSetDefault = async (playlist: Playlist) => {
    try {
      await apiService.updatePlaylist(playlist.id, { is_default: true });
      // Reload playlists to update default status
      loadPlaylists();
    } catch (err: any) {
      alert('Failed to set default playlist: ' + (err.message || 'Unknown error'));
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
          <Settings className="w-16 h-16 mx-auto" />
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
            <h1 className="text-2xl font-bold text-gray-900">Playlist Management</h1>
            <p className="text-gray-600">
              Create and manage display playlists
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-md hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Create Playlist</span>
        </button>
      </div>

      {/* Playlists Grid */}
      {playlists.length === 0 ? (
        <div className="text-center py-12">
          <Settings className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Playlists Yet</h3>
          <p className="text-gray-500 mb-4">Create your first playlist to get started</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary"
          >
            Create Playlist
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {playlists.map((playlist) => (
            <div
              key={playlist.id}
              className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate(`/admin/playlists/${playlist.id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">
                    {playlist.name}
                    {playlist.is_default && (
                      <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Default
                      </span>
                    )}
                    {playlist.display_mode && playlist.display_mode !== 'default' && (
                      <span className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        playlist.display_mode === 'auto_sort' ? 'bg-blue-100 text-blue-800' :
                        playlist.display_mode === 'movement' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {playlist.display_mode === 'auto_sort' ? 'Auto Sort' :
                         playlist.display_mode === 'movement' ? 'Movement' :
                         playlist.display_mode}
                      </span>
                    )}
                    {console.log(`🎯 Rendering playlist "${playlist.name}": display_mode = ${playlist.display_mode}`)}
                  </h3>
                  <p className="text-sm text-gray-500">
                    {playlist.image_count} images
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Slug: {playlist.slug}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSetDefault(playlist);
                    }}
                    disabled={playlist.is_default}
                    className={`flex items-center space-x-1 px-3 py-1 rounded text-sm transition-colors ${
                      playlist.is_default
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                  >
                    <Play className="w-3 h-3" />
                    <span>Set Default</span>
                  </button>
                </div>
                
                <div className="flex space-x-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/admin/playlists/${playlist.id}`);
                    }}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                    title="Edit playlist"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPlaylistToDelete(playlist);
                      setShowDeleteModal(true);
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete playlist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Playlist</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Playlist Name
                </label>
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="Enter playlist name..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  onKeyPress={(e) => e.key === 'Enter' && handleCreatePlaylist()}
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewPlaylistName('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePlaylist}
                  disabled={!newPlaylistName.trim() || isCreating}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCreating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setPlaylistToDelete(null);
        }}
        onConfirm={handleDeletePlaylist}
        title="Delete Playlist"
        message={playlistToDelete ? `Are you sure you want to delete "${playlistToDelete.name}"? This action cannot be undone.` : ''}
        confirmText="Delete Playlist"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};

export default Playlists;
