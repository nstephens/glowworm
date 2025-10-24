import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X, 
  Image as ImageIcon,
  GripVertical,
  Search,
  Filter,
  Shuffle
} from 'lucide-react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { apiService } from '../services/api';
import { AdminWebSocketClient } from '../services/websocket';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { getThumbnailUrl } from '../utils/imageUrls';
import { playlistLogger } from '../utils/logger';
import type { Playlist, Image, Album, DisplayDevice, DisplayMode } from '../types';

// Draggable Image Item Component
const DraggableImageItem: React.FC<{
  image: Image;
  index: number;
  moveImage: (draggedId: number, targetId: number) => void;
  onDelete: (image: Image) => void;
  isEditing: boolean;
  displayMode: DisplayMode;
}> = ({ image, index, moveImage, onDelete, isEditing, displayMode }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'IMAGE',
    item: { id: image.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: isEditing && displayMode !== 'auto_sort', // Only allow dragging when in edit mode and auto sort is disabled
  });

  const [, drop] = useDrop({
    accept: 'IMAGE',
    hover: (item: { id: number }) => {
      if (item.id !== image.id && isEditing && displayMode !== 'auto_sort') {
        moveImage(item.id, image.id);
      }
    },
    canDrop: () => isEditing && displayMode !== 'auto_sort', // Only allow dropping when in edit mode and auto sort is disabled
  });

  return (
    <div
      ref={(node) => drag(drop(node))}
      className={`relative group rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${
        isDragging ? 'opacity-50 scale-95' : 'hover:scale-105'
      } ${isEditing && displayMode !== 'auto_sort' ? 'cursor-move' : 'cursor-default'}`}
    >
      <img
        src={getThumbnailUrl(image.id)}
        alt={image.filename}
        className="w-full h-full object-cover aspect-square"
      />
      
      {/* Overlay with actions */}
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-2">
          {isEditing && displayMode !== 'auto_sort' && (
            <div className="flex items-center space-x-1 text-white text-xs bg-black bg-opacity-50 px-2 py-1 rounded">
              <GripVertical className="w-3 h-3" />
              <span>Drag to reorder</span>
            </div>
          )}
          {isEditing && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(image);
              }}
              className="bg-red-600 text-white p-1 rounded hover:bg-red-700 transition-colors"
              title="Remove from playlist"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Image info */}
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <div className="truncate">{image.filename}</div>
        <div className="text-gray-300 text-xs">#{index + 1}</div>
      </div>
    </div>
  );
};

const PlaylistDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [playlistImages, setPlaylistImages] = useState<Image[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [allImages, setAllImages] = useState<Image[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddImages, setShowAddImages] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<Image | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAlbum, setSelectedAlbum] = useState<number | null>(null);
  const [albumImages, setAlbumImages] = useState<Image[]>([]);
  const [loadingAlbums, setLoadingAlbums] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDisplayMode, setEditDisplayMode] = useState<DisplayMode>('default');
  const [editDisplayTime, setEditDisplayTime] = useState(30);
  const [editIsDefault, setEditIsDefault] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const wsRef = useRef<AdminWebSocketClient | null>(null);

  // Display mode options
  const displayModeOptions = [
    { value: 'default', label: 'Default', description: 'Standard playlist behavior' },
    { value: 'auto_sort', label: 'Auto Sort', description: 'Automatically sort by date, rating, or other criteria' },
    { value: 'movement', label: 'Movement', description: 'Focus on images with movement or action' },
    { value: 'random', label: 'Random', description: 'Randomize the order each time' }
  ];

  // Load playlist data
  useEffect(() => {
    if (id) {
      loadPlaylist();
    }
  }, [id]);

  // WebSocket connection
  useEffect(() => {
    wsRef.current = new AdminWebSocketClient();
    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
      }
    };
  }, []);

  // Check for changes
  useEffect(() => {
    if (playlist) {
      const nameChanged = editName !== playlist.name;
      const displayModeChanged = editDisplayMode !== (playlist.display_mode || 'default');
      const displayTimeChanged = editDisplayTime !== (playlist.display_time_seconds || 30);
      const isDefaultChanged = editIsDefault !== playlist.is_default;
      
      setHasChanges(nameChanged || displayModeChanged || displayTimeChanged || isDefaultChanged);
    }
  }, [editName, editDisplayMode, editDisplayTime, editIsDefault, playlist]);

  const loadPlaylist = async () => {
    try {
      const response = await apiService.get(`/playlists/${id}`);
      const playlistData = response.data;
      setPlaylist(playlistData);
      setEditName(playlistData.name);
      setEditDisplayMode(playlistData.display_mode || 'default');
      setEditDisplayTime(playlistData.display_time_seconds || 30);
      setEditIsDefault(playlistData.is_default || false);
      
      // Load playlist images
      const imagesResponse = await apiService.get(`/playlists/${id}/images`);
      setPlaylistImages(imagesResponse.data);
    } catch (error) {
      console.error('Error loading playlist:', error);
      playlistLogger.error('Failed to load playlist', { error, playlistId: id });
    }
  };

  const loadAlbums = async () => {
    setLoadingAlbums(true);
    try {
      const response = await apiService.get('/albums');
      setAlbums(response.data);
    } catch (error) {
      console.error('Error loading albums:', error);
    } finally {
      setLoadingAlbums(false);
    }
  };

  const loadAllImages = async () => {
    try {
      const response = await apiService.get('/images');
      setAllImages(response.data);
    } catch (error) {
      console.error('Error loading images:', error);
    }
  };

  const handleDisplayModeChange = (mode: DisplayMode) => {
    setEditDisplayMode(mode);
    if (mode === 'auto_sort') {
      // Auto sort doesn't need manual ordering
      setEditDisplayTime(30); // Reset to default
    }
  };

  const handleSave = async () => {
    if (!playlist || !editName.trim()) return;
    
    setIsSaving(true);
    try {
      const updateData = {
        name: editName.trim(),
        display_mode: editDisplayMode,
        display_time_seconds: editDisplayTime,
        is_default: editIsDefault
      };
      
      await apiService.put(`/playlists/${playlist.id}`, updateData);
      
      // Update local state
      setPlaylist(prev => prev ? { ...prev, ...updateData } : null);
      setIsEditing(false);
      setHasChanges(false);
      
      playlistLogger.info('Playlist updated successfully', { playlistId: playlist.id, updateData });
    } catch (error) {
      console.error('Error saving playlist:', error);
      playlistLogger.error('Failed to save playlist', { error, playlistId: playlist.id });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (playlist) {
      setEditName(playlist.name);
      setEditDisplayMode(playlist.display_mode || 'default');
      setEditDisplayTime(playlist.display_time_seconds || 30);
      setEditIsDefault(playlist.is_default || false);
    }
    setIsEditing(false);
    setHasChanges(false);
  };

  const handleRandomizePlaylist = async () => {
    if (!playlist) return;
    
    try {
      await apiService.post(`/playlists/${playlist.id}/randomize`);
      await loadPlaylist(); // Reload to get new order
      playlistLogger.info('Playlist randomized', { playlistId: playlist.id });
    } catch (error) {
      console.error('Error randomizing playlist:', error);
      playlistLogger.error('Failed to randomize playlist', { error, playlistId: playlist.id });
    }
  };

  const moveImage = async (draggedId: number, targetId: number) => {
    if (!playlist) return;
    
    try {
      await apiService.post(`/playlists/${playlist.id}/images/reorder`, {
        dragged_id: draggedId,
        target_id: targetId
      });
      
      // Update local state
      const draggedIndex = playlistImages.findIndex(img => img.id === draggedId);
      const targetIndex = playlistImages.findIndex(img => img.id === targetId);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const newImages = [...playlistImages];
        const [draggedImage] = newImages.splice(draggedIndex, 1);
        newImages.splice(targetIndex, 0, draggedImage);
        setPlaylistImages(newImages);
      }
      
      playlistLogger.info('Image reordered', { playlistId: playlist.id, draggedId, targetId });
    } catch (error) {
      console.error('Error reordering image:', error);
      playlistLogger.error('Failed to reorder image', { error, playlistId: playlist.id });
    }
  };

  const handleAddSelectedImages = async () => {
    if (!playlist || selectedImages.size === 0) return;
    
    try {
      const imageIds = Array.from(selectedImages);
      await apiService.post(`/playlists/${playlist.id}/images`, { image_ids: imageIds });
      
      // Reload playlist images
      await loadPlaylist();
      
      // Reset selection
      setSelectedImages(new Set());
      setShowAddImages(false);
      setSearchTerm('');
      setSelectedAlbum(null);
      setAlbumImages([]);
      
      playlistLogger.info('Images added to playlist', { playlistId: playlist.id, imageIds });
    } catch (error) {
      console.error('Error adding images to playlist:', error);
      playlistLogger.error('Failed to add images to playlist', { error, playlistId: playlist.id });
    }
  };

  const handleConfirmDeleteImage = async () => {
    if (!playlist || !imageToDelete) return;
    
    try {
      await apiService.delete(`/playlists/${playlist.id}/images/${imageToDelete.id}`);
      
      // Update local state
      setPlaylistImages(prev => prev.filter(img => img.id !== imageToDelete.id));
      
      setShowDeleteModal(false);
      setImageToDelete(null);
      
      playlistLogger.info('Image removed from playlist', { playlistId: playlist.id, imageId: imageToDelete.id });
    } catch (error) {
      console.error('Error removing image from playlist:', error);
      playlistLogger.error('Failed to remove image from playlist', { error, playlistId: playlist.id });
    }
  };

  const handleToggleImageSelection = (imageId: number) => {
    setSelectedImages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(imageId)) {
        newSet.delete(imageId);
      } else {
        newSet.add(imageId);
      }
      return newSet;
    });
  };

  const handleAlbumSelect = async (albumId: number | null) => {
    setSelectedAlbum(albumId);
    if (albumId) {
      try {
        const response = await apiService.get(`/albums/${albumId}/images`);
        setAlbumImages(response.data);
      } catch (error) {
        console.error('Error loading album images:', error);
      }
    } else {
      setAlbumImages([]);
    }
  };

  // Filter images based on search term and album selection
  const filteredImages = React.useMemo(() => {
    let images = selectedAlbum ? albumImages : allImages;
    
    if (searchTerm) {
      images = images.filter(img => 
        img.filename.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return images;
  }, [allImages, albumImages, selectedAlbum, searchTerm]);

  if (!playlist) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading playlist...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Playlist Info */}
      <div className="bg-card/50 backdrop-blur-sm rounded-xl border-0 shadow-lg p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {isEditing ? (
              <div className="space-y-4">
                {/* Playlist Name */}
                <div>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="text-2xl font-bold text-gray-900 bg-transparent border-b-2 border-blue-500 focus:outline-none"
                  />
                </div>
                
                {/* Settings Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {/* Display Mode */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700">Display Mode</label>
                    <select
                      value={editDisplayMode}
                      onChange={(e) => handleDisplayModeChange(e.target.value as DisplayMode)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      {displayModeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500">
                      {displayModeOptions.find(opt => opt.value === editDisplayMode)?.description}
                    </p>
                  </div>

                  {/* Display Time */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700">Display Time</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="number"
                        min="1"
                        max="300"
                        value={editDisplayTime}
                        onChange={(e) => setEditDisplayTime(parseInt(e.target.value) || 30)}
                        className="w-20 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-600">seconds</span>
                    </div>
                  </div>

                  {/* Default Playlist */}
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-gray-700">Settings</label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={editIsDefault}
                        onChange={(e) => setEditIsDefault(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-600">Default Playlist</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center space-x-2 mb-2">
                  <span>{playlist.name}</span>
                  {playlist.is_default && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Default
                    </span>
                  )}
                  {playlist.display_mode && playlist.display_mode !== 'default' && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {displayModeOptions.find(opt => opt.value === playlist.display_mode)?.label}
                    </span>
                  )}
                </h1>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-3">
                  <span>{playlistImages.length} images</span>
                  <span>•</span>
                  <span>Slug: {playlist.slug}</span>
                  {playlist.display_time_seconds && (
                    <>
                      <span>•</span>
                      <span>{playlist.display_time_seconds}s display time</span>
                    </>
                  )}
                </div>
                {/* Display Mode Info */}
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <span className="font-medium">Display Mode:</span>
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                    {displayModeOptions.find(opt => opt.value === (playlist.display_mode || 'default'))?.label || 'Default'}
                  </span>
                  <span className="text-gray-500">
                    - {displayModeOptions.find(opt => opt.value === (playlist.display_mode || 'default'))?.description}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 ml-6">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !editName.trim() || !hasChanges}
                  className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'Saving...' : 'Save'}</span>
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
                {/* Randomize Button - only show when not auto_sort and playlist has multiple images */}
                {editDisplayMode !== 'auto_sort' && playlistImages.length > 1 && (
                  <button
                    onClick={handleRandomizePlaylist}
                    className="flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 transition-colors"
                    title="Randomize the order of images in this playlist"
                  >
                    <Shuffle className="w-4 h-4" />
                    <span>Randomize Order</span>
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    setShowAddImages(true);
                    loadAlbums();
                    loadAllImages();
                  }}
                  className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Images</span>
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center space-x-2 bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Playlist Images */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Playlist Images</h2>
            {editDisplayMode === 'auto_sort' && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                <Filter className="w-4 h-4" />
                <span>Auto Sort</span>
              </div>
            )}
            {editDisplayMode === 'movement' && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
                <Filter className="w-4 h-4" />
                <span>Movement</span>
              </div>
            )}
          </div>
          
          {playlistImages.length === 0 ? (
            <div className="text-center py-12">
              <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Images in Playlist</h3>
              <p className="text-gray-500 mb-4">Add images to this playlist to get started</p>
              <button
                onClick={() => {
                  setShowAddImages(true);
                  loadAlbums();
                  loadAllImages();
                }}
                className="btn-primary"
              >
                Add Images
              </button>
            </div>
          ) : (
            <DndProvider backend={HTML5Backend}>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {playlistImages.map((image, index) => (
                  <DraggableImageItem
                    key={image.id}
                    image={image}
                    index={index}
                    moveImage={moveImage}
                    onDelete={(img) => {
                      setImageToDelete(img);
                      setShowDeleteModal(true);
                    }}
                    isEditing={isEditing}
                    displayMode={editDisplayMode}
                  />
                ))}
              </div>
            </DndProvider>
          )}
        </div>
      </div>

      {/* Add Images Modal */}
      {showAddImages && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add Images to Playlist</h3>
              <button
                onClick={() => {
                  setShowAddImages(false);
                  setSelectedImages(new Set());
                  setSearchTerm('');
                  setSelectedAlbum(null);
                  setAlbumImages([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Album Selection */}
            <div className="mb-4">
              <div className="flex items-center space-x-3 mb-3">
                <Filter className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Add from Album:</span>
                <select
                  value={selectedAlbum || ''}
                  onChange={(e) => handleAlbumSelect(e.target.value ? parseInt(e.target.value) : null)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  disabled={loadingAlbums}
                >
                  <option value="">All Images</option>
                  {albums.map((album) => (
                    <option key={album.id} value={album.id}>
                      {album.name} ({album.image_count})
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search images..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>

            {/* Image Gallery for adding images */}
            <div className="h-[calc(90vh-200px)] overflow-y-auto pr-2">
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {filteredImages.map((image) => (
                  <div
                    key={image.id}
                    className={`relative group rounded-lg overflow-hidden cursor-pointer ${
                      selectedImages.has(image.id) ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => handleToggleImageSelection(image.id)}
                  >
                    <img
                      src={getThumbnailUrl(image.id)}
                      alt={image.filename}
                      className="w-full h-full object-cover aspect-square"
                    />
                    {selectedImages.has(image.id) && (
                      <div className="absolute inset-0 bg-blue-500 bg-opacity-50 flex items-center justify-center">
                        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                          <span className="text-blue-600 font-bold">✓</span>
                        </div>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-1 text-xs truncate opacity-0 group-hover:opacity-100 transition-opacity">
                      {image.filename}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAddImages(false);
                  setSelectedImages(new Set());
                  setSearchTerm('');
                  setSelectedAlbum(null);
                  setAlbumImages([]);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSelectedImages}
                disabled={selectedImages.size === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add {selectedImages.size} Image{selectedImages.size === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Image Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleConfirmDeleteImage}
        title="Remove Image from Playlist"
        message={imageToDelete ? `Are you sure you want to remove "${imageToDelete.filename}" from this playlist?` : ''}
        confirmText="Remove"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};

export default PlaylistDetail;