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
      className={`relative group bg-gray-100 rounded-lg overflow-hidden aspect-square transition-all ${
        isDragging ? 'opacity-50 scale-95' : ''
      } ${
        isEditing && displayMode !== 'auto_sort' ? 'cursor-move' : 'cursor-default'
      } ${
        displayMode === 'auto_sort' ? 'opacity-75' : ''
      }`}
    >
      <img
        src={getThumbnailUrl(image.id)}
        alt={image.filename}
        className="w-full h-full object-cover pointer-events-none"
        draggable={false}
      />
      
      {/* Drag Handle - only show in edit mode when auto sort is disabled */}
      {isEditing && displayMode !== 'auto_sort' && (
        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <GripVertical className="w-4 h-4 text-white bg-black bg-opacity-50 rounded p-1" />
        </div>
      )}
      
      {/* Remove Button - only show in edit mode */}
      {isEditing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(image);
          }}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
      
      {/* Image Info */}
      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        <p className="text-xs truncate">{image.filename}</p>
        <p className="text-xs text-gray-300">Position: {index + 1}</p>
      </div>
    </div>
  );
};

export const PlaylistDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [playlistImages, setPlaylistImages] = useState<Image[]>([]);
  const [allImages, setAllImages] = useState<Image[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editIsDefault, setEditIsDefault] = useState(false);
  const [editDisplayTime, setEditDisplayTime] = useState(30);
  const [editDisplayMode, setEditDisplayMode] = useState<DisplayMode>('default');
  const [showAddImages, setShowAddImages] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<Image | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<number | null>(null);
  const [albumImages, setAlbumImages] = useState<Image[]>([]);
  
  // WebSocket for notifying displays
  const [websocketClient, setWebsocketClient] = useState<AdminWebSocketClient | null>(null);
  const [devicesUsingPlaylist, setDevicesUsingPlaylist] = useState<DisplayDevice[]>([]);
  const [loadingAlbums, setLoadingAlbums] = useState(false);
  // Drag and drop will be handled by react-dnd

  useEffect(() => {
    if (id) {
      loadPlaylistData();
    }
  }, [id]);

  // Setup WebSocket connection for notifying displays
  useEffect(() => {
    const setupWebSocket = async () => {
      try {
        const client = new AdminWebSocketClient();
        
        client.on('connected', () => {
          playlistLogger.info('WebSocket connected for playlist notifications');
          setWebsocketClient(client);
        });
        
        client.on('disconnected', () => {
          playlistLogger.info('WebSocket disconnected');
          setWebsocketClient(null);
        });
        
        client.on('websocket_error', (error) => {
          console.error('🔌 WebSocket error:', error);
        });
        
        await client.connect();
      } catch (error) {
        console.error('Failed to setup WebSocket:', error);
      }
    };
    
    setupWebSocket();
    
    return () => {
      if (websocketClient) {
        websocketClient.disconnect();
      }
    };
  }, []);

  // Get devices using the current playlist
  const loadDevicesUsingPlaylist = async (playlistId: number) => {
    try {
      playlistLogger.debug('loadDevicesUsingPlaylist called with playlistId:', playlistId);
      const devices = await apiService.getDevices();
      playlistLogger.debug('Got devices from API, count:', devices.length);
      playlistLogger.debug('All devices loaded:', devices.map(d => ({ 
        id: d.id, 
        name: d.device_name, 
        playlist_id: d.playlist_id 
      })));
      playlistLogger.debug('Looking for devices with playlist_id:', playlistId);
      
      const devicesUsingThisPlaylist = devices.filter(device => device.playlist_id === playlistId);
      playlistLogger.debug('Devices using this playlist:', devicesUsingThisPlaylist.map(d => ({ 
        id: d.id, 
        name: d.device_name, 
        playlist_id: d.playlist_id 
      })));
      
      setDevicesUsingPlaylist(devicesUsingThisPlaylist);
    } catch (error) {
      console.error('Failed to load devices using playlist:', error);
    }
  };

  const loadPlaylistData = async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const [playlistResponse, imagesResponse, allImagesResponse] = await Promise.all([
        apiService.getPlaylist(parseInt(id)),
        apiService.getPlaylistImages(parseInt(id)),
        apiService.getImages()
      ]);
      
      setPlaylist(playlistResponse.playlist);
      setPlaylistImages(imagesResponse.images || []);
      // Handle different response structures between APIs
      const allImagesData = allImagesResponse.data || allImagesResponse.images || [];
      setAllImages(allImagesData);
      
      // Load devices using this playlist
      await loadDevicesUsingPlaylist(playlistResponse.playlist.id);
      
      // Initialize edit form
      setEditName(playlistResponse.playlist.name);
      setEditIsDefault(playlistResponse.playlist.is_default);
      setEditDisplayTime(playlistResponse.playlist.display_time_seconds || 30);
      setEditDisplayMode(playlistResponse.playlist.display_mode || 'default');
      playlistLogger.debug('Loaded playlist display_mode setting:', playlistResponse.playlist.display_mode);
      
    } catch (err: any) {
      setError(err.message || 'Failed to load playlist data');
      console.error('Failed to load playlist data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!playlist) return;
    
    try {
      setIsSaving(true);
      
      // Update playlist details
      playlistLogger.debug('Saving playlist with display_mode:', editDisplayMode);
      const response = await apiService.updatePlaylist(playlist.id, editName, editIsDefault, editDisplayTime, editDisplayMode);
      setPlaylist(response.playlist);
      playlistLogger.debug('Saved playlist display_mode setting:', response.playlist.display_mode);
      
      // Check if images have been reordered and save the new order
      const originalImageIds = playlist.images ? playlist.images.map(img => img.id) : [];
      const currentImageIds = playlistImages.map(img => img.id);
      const hasImageOrderChanges = JSON.stringify(originalImageIds) !== JSON.stringify(currentImageIds);
      
      if (hasImageOrderChanges) {
        playlistLogger.debug('Saving new image order to database');
        await apiService.reorderPlaylist(playlist.id, currentImageIds);
        playlistLogger.debug('Image order saved successfully');
      }
      
      // Send simple refresh notification to active displays
      if (websocketClient) {
        const devices = await apiService.getDevices();
        const currentDevicesUsingPlaylist = devices.filter(device => device.playlist_id === playlist.id);
        
        if (currentDevicesUsingPlaylist.length > 0) {
          playlistLogger.info('Notifying displays to refresh playlist...');
          
          for (const device of currentDevicesUsingPlaylist) {
            try {
              // Send simple refresh notification
                const success = websocketClient.updatePlaylist(device.device_token, {
                  playlist_id: playlist.id,
                  playlist_name: response.playlist.name,
                  display_mode: response.playlist.display_mode,
                  display_time_seconds: response.playlist.display_time_seconds,
                  refresh: true, // Simple flag to trigger refresh
                  updated_at: new Date().toISOString()
                });
              
              if (success) {
                playlistLogger.info(`Sent refresh notification to device: ${device.device_name}`);
              } else {
                playlistLogger.warning(`Failed to send refresh notification to device: ${device.device_name}`);
              }
            } catch (error) {
              playlistLogger.error(`Error sending refresh notification to device ${device.device_name}:`, error);
            }
          }
        } else {
          playlistLogger.debug('No devices using this playlist to notify');
        }
      }
      
      // Reload playlist data to get the updated state from the server
      await loadPlaylistData();
      setIsEditing(false);
    } catch (err: any) {
      alert('Failed to update playlist: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (playlist) {
      setEditName(playlist.name);
      setEditIsDefault(playlist.is_default);
      setEditDisplayTime(playlist.display_time_seconds || 30);
      setEditDisplayMode(playlist.display_mode || 'default');
      
      // Revert any reordering changes by reloading the playlist data
      loadPlaylistData();
    }
    setIsEditing(false);
  };

  const handleAddSelectedImages = async () => {
    if (!playlist || selectedImages.size === 0) return;
    
    try {
      const promises = Array.from(selectedImages).map(imageId =>
        apiService.addImageToPlaylist(playlist.id, imageId)
      );
      
      await Promise.all(promises);
      setSelectedImages(new Set());
      setShowAddImages(false);
      loadPlaylistData(); // Reload to get updated images
    } catch (err: any) {
      alert('Failed to add images: ' + (err.message || 'Unknown error'));
    }
  };

  const handleRemoveImage = async () => {
    if (!playlist || !imageToDelete) return;
    
    try {
      await apiService.removeImageFromPlaylist(playlist.id, imageToDelete.id);
      setPlaylistImages(prev => prev.filter(img => img.id !== imageToDelete.id));
    } catch (err: any) {
      alert('Failed to remove image: ' + (err.message || 'Unknown error'));
    } finally {
      setShowDeleteModal(false);
      setImageToDelete(null);
    }
  };


  const handleImageSelect = (imageId: number) => {
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

  // Get images that are available to add (not already in playlist)
  const getAvailableImages = () => {
    if (!playlist) return [];
    
    // Get images not already in the playlist
    const playlistImageIds = new Set(playlistImages.map(img => img.id));
    const availableImages = allImages.filter(img => !playlistImageIds.has(img.id));
    
    // Filter by search term if provided
    if (searchTerm.trim()) {
      return availableImages.filter(img => 
        img.filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (img.album_name && img.album_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    return availableImages;
  };

  const handleSelectAll = () => {
    const availableImages = getAvailableImages();
    setSelectedImages(new Set(availableImages.map(img => img.id)));
  };

  const handleDeselectAll = () => {
    setSelectedImages(new Set());
  };

  const loadAlbums = async () => {
    try {
      setLoadingAlbums(true);
      const response = await apiService.getAlbums();
      setAlbums(response.data || []);
    } catch (err: any) {
      console.error('Failed to load albums:', err);
    } finally {
      setLoadingAlbums(false);
    }
  };

  const handleAlbumSelect = async (albumId: number | null) => {
    setSelectedAlbum(albumId);
    if (albumId) {
      try {
        const response = await apiService.getImages(albumId);
        setAlbumImages(response.data || []);
      } catch (err: any) {
        console.error('Failed to load album images:', err);
        setAlbumImages([]);
      }
    } else {
      setAlbumImages([]);
    }
  };

  const handleAddFromAlbum = async () => {
    if (!playlist || selectedAlbum === null || albumImages.length === 0) return;
    
    try {
      const promises = albumImages.map(image =>
        apiService.addImageToPlaylist(playlist.id, image.id)
      );
      
      await Promise.all(promises);
      setSelectedAlbum(null);
      setAlbumImages([]);
      setShowAddImages(false);
      loadPlaylistData(); // Reload to get updated images
    } catch (err: any) {
      alert('Failed to add images from album: ' + (err.message || 'Unknown error'));
    }
  };

  // Display mode change handler
  const handleDisplayModeChange = (newMode: DisplayMode) => {
    playlistLogger.debug('Display mode changed to:', newMode);
    setEditDisplayMode(newMode);
  };

  // Randomize playlist order (frontend only - preview mode)
  const handleRandomizePlaylist = () => {
    if (!playlist || playlistImages.length <= 1) return;
    
    try {
      playlistLogger.debug('Randomizing playlist frontend preview with', playlistImages.length, 'images');
      
      // Create a shuffled copy of the current images
      const shuffledImages = [...playlistImages];
      
      // Fisher-Yates shuffle algorithm
      for (let i = shuffledImages.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledImages[i], shuffledImages[j]] = [shuffledImages[j], shuffledImages[i]];
      }
      
      // Update the frontend state with shuffled images
      setPlaylistImages(shuffledImages);
      setHasChanges(true); // Mark as having changes so save button becomes enabled
      
      playlistLogger.debug('Images shuffled in frontend preview');
    } catch (err: any) {
      playlistLogger.error('Randomize error:', err);
      alert('Failed to randomize playlist: ' + (err.message || 'Unknown error'));
    }
  };

  // Detect changes to enable/disable save button
  useEffect(() => {
    if (!playlist) {
      setHasChanges(false);
      return;
    }

    // Check if playlist properties have changed
    const hasPlaylistChanges = (
      editName !== playlist.name ||
      editIsDefault !== playlist.is_default ||
      editDisplayTime !== (playlist.display_time_seconds || 30) ||
      editDisplayMode !== (playlist.display_mode || 'default')
    );

    // Check if images have been reordered (compare current order with original order)
    const originalImageIds = playlist.images ? playlist.images.map(img => img.id) : [];
    const currentImageIds = playlistImages.map(img => img.id);
    const hasImageOrderChanges = JSON.stringify(originalImageIds) !== JSON.stringify(currentImageIds);

    setHasChanges(hasPlaylistChanges || hasImageOrderChanges);
  }, [playlist, editName, editIsDefault, editDisplayTime, editDisplayMode, playlistImages]);

  // Display mode options
  const displayModeOptions = [
    { value: 'default', label: 'Default', description: 'Stack consecutive landscape images' },
    { value: 'auto_sort', label: 'Auto Sort', description: 'Stack consecutive landscape images' },
    { value: 'movement', label: 'Movement', description: 'Pan landscape images for better viewing' }
  ];

  const handleBackToPlaylists = () => {
    navigate('/admin/playlists');
  };

  const moveImage = (dragIndex: number, hoverIndex: number) => {
    if (!playlist) return;
    
    const draggedImage = playlistImages[dragIndex];
    const newImages = [...playlistImages];
    newImages.splice(dragIndex, 1);
    newImages.splice(hoverIndex, 0, draggedImage);
    
    setPlaylistImages(newImages);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg text-gray-600">Loading playlist...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg text-red-600">Error: {error}</div>
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-lg text-gray-600">Playlist not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        {/* Navigation */}
        <div className="flex items-center">
          <button
            onClick={handleBackToPlaylists}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Playlists</span>
          </button>
        </div>

        {/* Title and Status */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Display Mode */}
                    <div className="space-y-2">
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
                    <div className="space-y-2">
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
                    <div className="space-y-2">
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
                  <option value="">Select an album...</option>
                  {albums.map((album) => (
                    <option key={album.id} value={album.id}>
                      {album.name} ({album.image_count} images)
                    </option>
                  ))}
                </select>
                {selectedAlbum && albumImages.length > 0 && (
                  <button
                    onClick={handleAddFromAlbum}
                    className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm"
                  >
                    Add All ({albumImages.length})
                  </button>
                )}
              </div>
              
              {selectedAlbum && albumImages.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-3">
                  <p className="text-sm text-green-800">
                    <strong>{albums.find(a => a.id === selectedAlbum)?.name}</strong> contains {albumImages.length} images.
                    Click "Add All" to add all images from this album to the playlist.
                  </p>
                </div>
              )}
            </div>
            
            {/* Search and Selection Controls */}
            <div className="mb-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search images..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleSelectAll}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Select All
                  </button>
                  <button
                    onClick={handleDeselectAll}
                    className="text-sm text-gray-600 hover:text-gray-800"
                  >
                    Deselect All
                  </button>
                </div>
                <span className="text-sm text-gray-600">
                  {selectedImages.size} selected
                </span>
              </div>
            </div>
            
            {/* Available Images */}
            <div className="max-h-96 overflow-y-auto">
              {getAvailableImages().length === 0 ? (
                <div className="text-center py-8">
                  <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">
                    {searchTerm ? 'No images match your search' : 'All images are already in this playlist'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {getAvailableImages().map((image) => (
                    <div
                      key={image.id}
                      className={`relative group bg-gray-100 rounded-lg overflow-hidden aspect-square cursor-pointer border-2 transition-colors ${
                        selectedImages.has(image.id) 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-transparent hover:border-gray-300'
                      }`}
                      onClick={() => handleImageSelect(image.id)}
                    >
                      <img
                        src={getThumbnailUrl(image.id)}
                        alt={image.filename}
                        className="w-full h-full object-cover"
                      />
                      
                      {/* Selection Indicator */}
                      {selectedImages.has(image.id) && (
                        <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                          <div className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center">
                            <span className="text-xs font-bold">✓</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Image Info */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-xs truncate">{image.filename}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowAddImages(false);
                  setSelectedImages(new Set());
                  setSearchTerm('');
                  setSelectedAlbum(null);
                  setAlbumImages([]);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddSelectedImages}
                disabled={selectedImages.size === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add {selectedImages.size} Image{selectedImages.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setImageToDelete(null);
        }}
        onConfirm={handleRemoveImage}
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
