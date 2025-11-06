import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ArrowLeft, Plus, Edit, Trash2, Play, Settings, Clock, Star, Zap, RefreshCw, Loader2 } from 'lucide-react';
import { apiService } from '../services/api';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { VariantGenerationModal } from '../components/VariantGenerationModal';
import { MobilePlaylistGrid } from '../components/playlists/MobilePlaylistGrid';
import { MobilePlaylistCreateModal } from '../components/playlists/MobilePlaylistCreateModal';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { cn } from '../lib/utils';
import type { Playlist } from '../types';

interface PlaylistsProps {
  onPlaylistsLoad?: (count: number) => void;
  showCreateModal?: boolean;
  setShowCreateModal?: (show: boolean) => void;
}

export const Playlists: React.FC<PlaylistsProps> = ({ 
  onPlaylistsLoad,
  showCreateModal: propShowCreateModal,
  setShowCreateModal: propSetShowCreateModal 
}) => {
  const navigate = useNavigate();
  const { isMobile } = useResponsiveLayout();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [playlistToDelete, setPlaylistToDelete] = useState<Playlist | null>(null);
  const [localShowCreateModal, setLocalShowCreateModal] = useState(false);
  const showCreateModal = propShowCreateModal !== undefined ? propShowCreateModal : localShowCreateModal;
  const setShowCreateModal = propSetShowCreateModal || setLocalShowCreateModal;
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [playlistThumbnails, setPlaylistThumbnails] = useState<Record<number, string>>({});
  const [generatingVariants, setGeneratingVariants] = useState(false);
  const [generatingAllVariants, setGeneratingAllVariants] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [variantGenerationError, setVariantGenerationError] = useState<string | null>(null);
  const [variantPlaylistName, setVariantPlaylistName] = useState<string | undefined>(undefined);
  const [totalVariantsGenerated, setTotalVariantsGenerated] = useState<number | undefined>(undefined);

  // Load playlists on component mount
  useEffect(() => {
    loadPlaylists();
  }, []);

  // Notify parent when playlists change
  useEffect(() => {
    if (onPlaylistsLoad) {
      onPlaylistsLoad(playlists.length);
    }
  }, [playlists, onPlaylistsLoad]);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getPlaylists();
      console.log('📋 Loaded playlists:', response.data);
      response.data?.forEach(playlist => {
        console.log(`📋 Playlist "${playlist.name}": display_mode = ${playlist.display_mode}`);
      });
      setPlaylists(response.data || []);
      
      // Load thumbnails for playlists with images
      loadPlaylistThumbnails(response.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load playlists');
      console.error('Failed to load playlists:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadPlaylistThumbnails = async (playlists: Playlist[]) => {
    const thumbnails: Record<number, string> = {};
    
    for (const playlist of playlists) {
      if (playlist.image_count > 0) {
        try {
          const imagesResponse = await apiService.getPlaylistImages(playlist.id);
          if (imagesResponse.data && imagesResponse.data.length > 0) {
            const firstImage = imagesResponse.data[0];
            // Use the thumbnail URL from the image object
            thumbnails[playlist.id] = firstImage.thumbnail_url || `/api/images/${firstImage.id}/file?size=medium`;
          }
        } catch (error) {
          console.warn(`Failed to load thumbnail for playlist ${playlist.id}:`, error);
        }
      }
    }
    
    setPlaylistThumbnails(thumbnails);
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    
    try {
      setIsCreating(true);
      const response = await apiService.createPlaylist(newPlaylistName.trim());
      setPlaylists(prev => [...prev, response.data]);
      setNewPlaylistName('');
      setShowCreateModal(false);
      
      // Load thumbnail for the new playlist (will be empty initially)
      loadPlaylistThumbnails([response.data]);
      
      // Navigate to the new playlist's detail page for easy image addition
      navigate(`/admin/playlists/${response.data.slug}`);
    } catch (err: any) {
      alert('Failed to create playlist: ' + (err.message || 'Unknown error'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreatePlaylistMobile = async (data: any) => {
    try {
      setIsCreating(true);
      // Create playlist with just name and is_default
      const response = await apiService.createPlaylist(data.name, data.is_default || false);
      
      // If display settings were provided, update the playlist
      if (data.display_time_seconds || data.display_mode) {
        await apiService.updatePlaylist(
          response.data.id,
          undefined, // name - already set
          undefined, // isDefault - already set
          data.display_time_seconds,
          data.display_mode
        );
      }
      
      setPlaylists(prev => [...prev, response.data]);
      setShowCreateModal(false);
      
      // Load thumbnail for the new playlist (will be empty initially)
      loadPlaylistThumbnails([response.data]);
      
      // Navigate to the new playlist's detail page for easy image addition
      navigate(`/admin/playlists/${response.data.slug}`);
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
      await apiService.updatePlaylist(playlist.id, undefined, true);
      // Reload playlists to update default status
      loadPlaylists();
    } catch (err: any) {
      alert('Failed to set default playlist: ' + (err.message || 'Unknown error'));
    }
  };

  const handleBackToDashboard = () => {
    navigate('/admin');
  };

  const handleGenerateVariants = async (playlistId: number) => {
    const playlist = playlists.find(p => p.id === playlistId);
    
    try {
      setGeneratingVariants(true);
      setShowVariantModal(true);
      setVariantGenerationError(null);
      setVariantPlaylistName(playlist?.name);
      setTotalVariantsGenerated(undefined);
      setError(null);
      
      const response = await apiService.generatePlaylistVariants(playlistId);
      console.log('✅ Generated variants:', response);
      
      // Response is already the data (apiService returns response.data)
      setTotalVariantsGenerated((response as any).count || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to generate variants');
      setVariantGenerationError(err.message || 'Failed to generate variants. Please try again.');
      console.error('Failed to generate variants:', err);
    } finally {
      setGeneratingVariants(false);
    }
  };

  const handleGenerateAllVariants = async () => {
    try {
      setGeneratingAllVariants(true);
      setShowVariantModal(true);
      setVariantGenerationError(null);
      setVariantPlaylistName('all playlists');
      setTotalVariantsGenerated(undefined);
      setError(null);
      
      const response = await apiService.generateAllPlaylistVariants();
      console.log('✅ Generated all variants:', response);
      
      // Response is already the data (apiService returns response.data)
      // The results object contains total counts
      const results = (response as any).results || {};
      const totalVariants = results.variants_created || 0;
      setTotalVariantsGenerated(totalVariants);
    } catch (err: any) {
      setError(err.message || 'Failed to generate all variants');
      setVariantGenerationError(err.message || 'Failed to generate variants. Please try again.');
      console.error('Failed to generate all variants:', err);
    } finally {
      setGeneratingAllVariants(false);
    }
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
      {/* Playlists Grid */}
      {(() => {
        console.log('🔍 Playlists render check:', { isMobile, playlistCount: playlists.length });
        return isMobile ? (
          <MobilePlaylistGrid
            playlists={playlists}
            playlistThumbnails={playlistThumbnails}
            loading={loading}
            error={error}
            onPlaylistClick={(playlist) => navigate(`/admin/playlists/${playlist.slug}`)}
            onPlaylistPlay={(playlist) => navigate(`/admin/playlists/${playlist.slug}`)}
            onPlaylistEdit={(playlist) => navigate(`/admin/playlists/${playlist.slug}`)}
            onPlaylistDelete={(playlist) => {
              setPlaylistToDelete(playlist);
              setShowDeleteModal(true);
            }}
            onPlaylistSettings={(playlist) => navigate(`/admin/playlists/${playlist.slug}`)}
            onPlaylistPreview={(playlist) => navigate(`/admin/playlists/${playlist.slug}`)}
            onCreatePlaylist={() => setShowCreateModal(true)}
            hapticFeedback={true}
          />
        ) : (
          playlists.length === 0 ? (
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
          <div className="space-y-4 animate-fade-in-up">
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
                onClick={() => navigate(`/admin/playlists/${playlist.slug}`)}
              >
                <div className="flex items-center space-x-4">
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                    {playlistThumbnails[playlist.id] ? (
                      <img
                        src={playlistThumbnails[playlist.id]}
                        alt={`${playlist.name} thumbnail`}
                        className="w-full h-full object-cover rounded-lg"
                        onError={(e) => {
                          // Fallback to play icon if image fails to load
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`w-full h-full flex items-center justify-center ${playlistThumbnails[playlist.id] ? 'hidden' : ''}`}>
                      <Play className="w-8 h-8 text-gray-400" />
                    </div>
                  </div>
                  
                  {/* Playlist Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">{playlist.name}</h3>
                      {playlist.is_default && (
                        <Badge variant="secondary" className="text-xs">
                          <Star className="w-3 h-3 mr-1" />
                          Default
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mb-2">
                      {playlist.image_count} images • {playlist.slug}
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      {playlist.display_mode && playlist.display_mode !== 'default' && (
                        <Badge variant="outline" className="text-xs">
                          {playlist.display_mode === 'auto_sort' ? 'Auto Sort' : playlist.display_mode}
                        </Badge>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {playlist.display_time_seconds || 30}s
                      </span>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSetDefault(playlist);
                      }}
                      disabled={playlist.is_default}
                      title="Set as default"
                    >
                      <Star className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlaylistToDelete(playlist);
                        setShowDeleteModal(true);
                      }}
                      title="Delete playlist"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
        );
      })()}

      {/* Create Playlist Modal */}
      <MobilePlaylistCreateModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        onCreatePlaylist={handleCreatePlaylistMobile}
        loading={isCreating}
      />

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

      {/* Variant Generation Modal */}
      <VariantGenerationModal
        isOpen={showVariantModal}
        isGenerating={generatingVariants || generatingAllVariants}
        playlistName={variantPlaylistName}
        variantCount={totalVariantsGenerated}
        error={variantGenerationError}
        onClose={() => {
          setShowVariantModal(false);
          setVariantGenerationError(null);
          setVariantPlaylistName(undefined);
          setTotalVariantsGenerated(undefined);
        }}
      />
    </div>
  );
};

export default Playlists;
