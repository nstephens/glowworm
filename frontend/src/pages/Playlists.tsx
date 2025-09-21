import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ArrowLeft, Plus, Edit, Trash2, Play, Settings, Clock, Star, Zap } from 'lucide-react';
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
    <div className="space-y-8">
      {/* Action Bar */}
      <div className="animate-fade-in-up">
        <div className="flex items-center justify-end gap-3 mb-6">
          <Badge variant="secondary" className="px-3 py-1">
            <Play className="w-4 h-4 mr-2" />
            {playlists.length} playlists
          </Badge>
          <Button 
            className="shadow-lg"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Playlist
          </Button>
        </div>
      </div>

      {/* Playlists Grid */}
      {playlists.length === 0 ? (
        <Card className="animate-fade-in-up border-0 shadow-lg bg-card/50 backdrop-blur-sm">
          <CardContent className="text-center py-12">
            <div className="w-16 h-16 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Play className="w-8 h-8 text-muted-foreground" />
            </div>
            <CardTitle className="mb-2">No Playlists Yet</CardTitle>
            <CardDescription className="mb-6">Create your first playlist to get started</CardDescription>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="shadow-lg"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Playlist
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in-up">
          {playlists.map((playlist) => (
            <Card
              key={playlist.id}
              className="gallery-item border-0 shadow-lg bg-card/50 backdrop-blur-sm cursor-pointer group hover:shadow-xl transition-all duration-200"
              onClick={() => navigate(`/admin/playlists/${playlist.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <CardTitle className="text-lg">{playlist.name}</CardTitle>
                      {playlist.is_default && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="w-3 h-3 mr-1" />
                          Default
                        </Badge>
                      )}
                    </div>
                    <CardDescription>
                      {playlist.image_count} images • {playlist.slug}
                    </CardDescription>
                  </div>
                  <div className="p-2 bg-chart-3/10 rounded-lg">
                    <Play className="w-5 h-5 text-chart-3" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {playlist.display_mode && playlist.display_mode !== 'default' && (
                      <Badge variant="outline" className="text-xs">
                        {playlist.display_mode === 'auto_sort' ? 'Auto Sort' :
                         playlist.display_mode === 'movement' ? 'Movement' :
                         playlist.display_mode}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {playlist.display_time_seconds || 30}s
                    </span>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetDefault(playlist);
                      }}
                      disabled={playlist.is_default}
                    >
                      <Star className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlaylistToDelete(playlist);
                        setShowDeleteModal(true);
                      }}
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Playlist Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Create New Playlist</CardTitle>
              <CardDescription>Enter a name for your new playlist</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="playlist-name">Playlist Name</Label>
                <Input
                  id="playlist-name"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="Enter playlist name"
                  className="w-full"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewPlaylistName('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreatePlaylist}
                  disabled={!newPlaylistName.trim() || isCreating}
                >
                  {isCreating ? 'Creating...' : 'Create Playlist'}
                </Button>
              </div>
            </CardContent>
          </Card>
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
