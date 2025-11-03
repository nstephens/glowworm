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
  Shuffle,
  Sparkles
} from 'lucide-react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { apiService } from '../services/api';
import { AdminWebSocketClient } from '../services/websocket';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { VariantGenerationModal } from '../components/VariantGenerationModal';
import { getThumbnailUrl } from '../utils/imageUrls';
import { playlistLogger } from '../utils/logger';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { cn } from '../lib/utils';
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
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isMobile } = useResponsiveLayout();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [playlistImages, setPlaylistImages] = useState<Image[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [allImages, setAllImages] = useState<Image[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showAddImages, setShowAddImages] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isGeneratingVariants, setIsGeneratingVariants] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [variantGenerationError, setVariantGenerationError] = useState<string | null>(null);
  const [variantCount, setVariantCount] = useState<number | undefined>(undefined);
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
  const [editShowImageInfo, setEditShowImageInfo] = useState(false);
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
    if (slug) {
      loadPlaylist();
    }
  }, [slug]);

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
      const showImageInfoChanged = editShowImageInfo !== (playlist.show_image_info || false);
      
      setHasChanges(nameChanged || displayModeChanged || displayTimeChanged || isDefaultChanged || showImageInfoChanged);
    }
  }, [editName, editDisplayMode, editDisplayTime, editIsDefault, editShowImageInfo, playlist]);

  const loadPlaylist = async () => {
    if (!slug) return;
    
    try {
      console.log('🔍 Loading playlist with slug:', slug);
      const response = await apiService.getPlaylistBySlug(slug);
      console.log('📡 API Response:', response);
      
      if (!response || !response.data) {
        console.error('❌ No response or data');
        return;
      }
      
      const playlistData = response.data;
      console.log('✅ Playlist data:', playlistData);
      
      setPlaylist(playlistData);
      setEditName(playlistData.name);
      setEditDisplayMode(playlistData.display_mode || 'default');
      setEditDisplayTime(playlistData.display_time_seconds || 30);
      setEditIsDefault(playlistData.is_default || false);
      setEditShowImageInfo(playlistData.show_image_info || false);
      
      // Load playlist images
      const imagesResponse = await apiService.getPlaylistImages(playlistData.id);
      console.log('📡 Images Response:', imagesResponse);
      setPlaylistImages(imagesResponse.data || []);
    } catch (error) {
      console.error('Error loading playlist:', error);
      playlistLogger.error('Failed to load playlist', { error, playlistSlug: slug });
    }
  };

  const loadAlbums = async () => {
    setLoadingAlbums(true);
    try {
      const response = await apiService.getAlbums();
      console.log('📡 Albums Response:', response);
      setAlbums(response.data || []);
    } catch (error) {
      console.error('Error loading albums:', error);
    } finally {
      setLoadingAlbums(false);
    }
  };

  const loadAllImages = async () => {
    try {
      const response = await apiService.getImages();
      console.log('📡 All Images Response:', response);
      setAllImages(response.data || []);
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
        is_default: editIsDefault,
        show_image_info: editShowImageInfo
      };
      
      await apiService.updatePlaylist(
        playlist.id,
        updateData.name,
        updateData.is_default,
        updateData.display_time_seconds,
        updateData.display_mode,
        updateData.show_image_info
      );
      
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
      setEditShowImageInfo(playlist.show_image_info || false);
    }
    setIsEditing(false);
    setHasChanges(false);
  };

  const handleRandomizePlaylist = async () => {
    if (!playlist) return;
    
    try {
      await apiService.randomizePlaylist(playlist.id);
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
      // Update local state first
      const draggedIndex = playlistImages.findIndex(img => img.id === draggedId);
      const targetIndex = playlistImages.findIndex(img => img.id === targetId);
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        const newImages = [...playlistImages];
        const [draggedImage] = newImages.splice(draggedIndex, 1);
        newImages.splice(targetIndex, 0, draggedImage);
        setPlaylistImages(newImages);
        
        // Send the new order to the API
        const newImageIds = newImages.map(img => img.id);
        await apiService.reorderPlaylist(playlist.id, newImageIds);
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
      
      // Add each image individually
      for (const imageId of imageIds) {
        await apiService.addImageToPlaylist(playlist.id, imageId);
      }
      
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
      await apiService.removeImageFromPlaylist(playlist.id, imageToDelete.id);
      
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
        const response = await apiService.getImages(albumId);
        console.log('📡 Album Images Response:', response);
        setAlbumImages(response.data || []);
      } catch (error) {
        console.error('Error loading album images:', error);
      }
    } else {
      setAlbumImages([]);
    }
  };

  const handleGenerateVariants = async () => {
    if (!playlist) return;
    
    try {
      setIsGeneratingVariants(true);
      setShowVariantModal(true);
      setVariantGenerationError(null);
      setVariantCount(undefined);
      
      playlistLogger.info('Generating variants for playlist:', playlist.name);
      
      const response = await apiService.generatePlaylistVariants(playlist.id);
      
      playlistLogger.info('Variant generation response:', response);
      
      // Check diagnostic info
      if ((response as any).diagnostic) {
        const diag = (response as any).diagnostic;
        playlistLogger.info('Diagnostic info:', diag);
        
        if (diag.configured_count === 0) {
          throw new Error('No display sizes configured in settings. Please add display sizes in Settings → Display Sizes first.');
        }
        
        if (diag.variants_generated === 0 && diag.configured_count > 0) {
          let errorMsg = `No variants generated despite having ${diag.configured_count} display size(s) configured: ${diag.configured_display_sizes.join(', ')}.`;
          
          if (diag.errors && diag.errors.length > 0) {
            errorMsg += '\n\nErrors:\n' + diag.errors.join('\n');
          } else {
            errorMsg += '\n\nNo specific errors reported. This may indicate a database or image scaling issue.';
          }
          
          throw new Error(errorMsg);
        }
      }
      
      if ((response as any).success) {
        playlistLogger.info('Variants generated successfully:', response);
        setVariantCount((response as any).count || 0);
      } else {
        throw new Error((response as any).message || 'Failed to generate variants');
      }
    } catch (error: any) {
      playlistLogger.error('Failed to generate variants:', error);
      setVariantGenerationError(error.message || 'Failed to generate variants. Please try again.');
    } finally {
      setIsGeneratingVariants(false);
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
      <div className={cn(
        "bg-card/50 backdrop-blur-sm rounded-xl border-0 shadow-lg",
        isMobile ? "p-4" : "p-6"
      )}>
        <div className={cn(
          "flex items-start justify-between",
          isMobile ? "flex-col space-y-4" : ""
        )}>
          <div className="flex-1">
            {isEditing ? (
              <div className={cn("space-y-4", isMobile && "space-y-3")}>
                {/* Playlist Name */}
                <div>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className={cn(
                      "font-bold text-gray-900 bg-transparent border-b-2 border-blue-500 focus:outline-none",
                      isMobile ? "text-xl w-full" : "text-2xl"
                    )}
                  />
                </div>
                
                {/* Settings Grid */}
                <div className={cn(
                  "grid gap-4",
                  isMobile ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                )}>
                  {/* Display Mode */}
                  <div className="space-y-3">
                    <label className={cn("font-medium text-gray-700", isMobile ? "text-base" : "text-sm")}>
                      Display Mode
                    </label>
                    <select
                      value={editDisplayMode}
                      onChange={(e) => handleDisplayModeChange(e.target.value as DisplayMode)}
                      className={cn(
                        "w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
                        isMobile ? "px-4 py-3 text-base" : "px-3 py-2 text-sm"
                      )}
                    >
                      {displayModeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className={cn("text-gray-500", isMobile ? "text-sm" : "text-xs")}>
                      {displayModeOptions.find(opt => opt.value === editDisplayMode)?.description}
                    </p>
                  </div>

                  {/* Display Time */}
                  <div className="space-y-3">
                    <label className={cn("font-medium text-gray-700", isMobile ? "text-base" : "text-sm")}>
                      Display Time
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="300"
                      value={editDisplayTime}
                      onChange={(e) => setEditDisplayTime(parseInt(e.target.value) || 30)}
                      className={cn(
                        "border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                        isMobile ? "w-32 px-4 py-3 text-base" : "w-20 px-3 py-2 text-sm"
                      )}
                    />
                    <p className={cn("text-gray-500", isMobile ? "text-sm" : "text-xs")}>
                      How long each image is displayed (1-300 seconds)
                    </p>
                  </div>

                  {/* Default Playlist */}
                  <div className="space-y-3">
                    <label className={cn("font-medium text-gray-700", isMobile ? "text-base" : "text-sm")}>
                      Settings
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={editIsDefault}
                        onChange={(e) => setEditIsDefault(e.target.checked)}
                        className={cn("text-blue-600 rounded focus:ring-blue-500", isMobile ? "w-5 h-5" : "w-4 h-4")}
                      />
                      <span className={cn("text-gray-600", isMobile ? "text-base" : "text-sm")}>
                        Default Playlist
                      </span>
                    </div>
                  </div>

                  {/* Show Image Info */}
                  <div className="space-y-3">
                    <label className={cn("font-medium text-gray-700", isMobile ? "text-base" : "text-sm")}>
                      Display Options
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={editShowImageInfo}
                        onChange={(e) => setEditShowImageInfo(e.target.checked)}
                        className={cn("text-blue-600 rounded focus:ring-blue-500", isMobile ? "w-5 h-5" : "w-4 h-4")}
                      />
                      <span className={cn("text-gray-600", isMobile ? "text-base" : "text-sm")}>
                        Show Image Info
                      </span>
                    </div>
                    <p className={cn("text-gray-500", isMobile ? "text-sm" : "text-xs")}>
                      Display image name, resolution, and date on screen
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h1 className={cn(
                  "font-bold text-gray-900 mb-2",
                  isMobile ? "text-xl flex-wrap" : "text-2xl"
                )}>
                  <div className={cn("flex items-center", isMobile ? "flex-wrap gap-2" : "space-x-2")}>
                    <span>{playlist.name}</span>
                    {playlist.is_default && (
                      <span className={cn(
                        "inline-flex items-center rounded-full font-medium bg-green-100 text-green-800",
                        isMobile ? "px-2 py-1 text-xs" : "px-2 py-1 text-xs"
                      )}>
                        Default
                      </span>
                    )}
                    {playlist.display_mode && playlist.display_mode !== 'default' && (
                      <span className={cn(
                        "inline-flex items-center rounded-full font-medium bg-blue-100 text-blue-800",
                        isMobile ? "px-2 py-1 text-xs" : "px-2 py-1 text-xs"
                      )}>
                        {displayModeOptions.find(opt => opt.value === playlist.display_mode)?.label}
                      </span>
                    )}
                  </div>
                </h1>
                <div className={cn(
                  "flex items-center text-gray-600 mb-3",
                  isMobile ? "flex-wrap gap-x-2 gap-y-1 text-sm" : "space-x-4 text-sm"
                )}>
                  <span>{playlistImages.length} images</span>
                  {!isMobile && <span>•</span>}
                  {!isMobile && <span>Slug: {playlist.slug}</span>}
                  {!isMobile && playlist.display_time_seconds && (
                    <>
                      <span>•</span>
                      <span>{playlist.display_time_seconds}s display time</span>
                    </>
                  )}
                </div>
                {/* Display Mode Info */}
                {!isMobile && (
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <span className="font-medium">Display Mode:</span>
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800">
                      {displayModeOptions.find(opt => opt.value === (playlist.display_mode || 'default'))?.label || 'Default'}
                    </span>
                    <span className="text-gray-500">
                      - {displayModeOptions.find(opt => opt.value === (playlist.display_mode || 'default'))?.description}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className={cn(
            "flex items-center",
            isMobile ? "w-full flex-col space-y-2" : "space-x-2 ml-6"
          )}>
            {isEditing ? (
              <div className={cn("flex items-center", isMobile ? "w-full flex-col space-y-2" : "space-x-2")}>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !editName.trim() || !hasChanges}
                  className={cn(
                    "flex items-center justify-center space-x-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
                    isMobile ? "w-full px-4 py-3 text-base" : "px-4 py-2"
                  )}
                >
                  <Save className={cn(isMobile ? "w-5 h-5" : "w-4 h-4")} />
                  <span>{isSaving ? 'Saving...' : 'Save'}</span>
                </button>
                <button
                  onClick={handleCancelEdit}
                  className={cn(
                    "flex items-center justify-center space-x-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors",
                    isMobile ? "w-full px-4 py-3 text-base" : "px-4 py-2"
                  )}
                >
                  <X className={cn(isMobile ? "w-5 h-5" : "w-4 h-4")} />
                  <span>Cancel</span>
                </button>
                {/* Randomize Button - only show when not auto_sort and playlist has multiple images */}
                {editDisplayMode !== 'auto_sort' && playlistImages.length > 1 && (
                  <button
                    onClick={handleRandomizePlaylist}
                    className={cn(
                      "flex items-center justify-center space-x-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors",
                      isMobile ? "w-full px-4 py-3 text-base" : "px-3 py-2 text-sm"
                    )}
                    title="Randomize the order of images in this playlist"
                  >
                    <Shuffle className={cn(isMobile ? "w-5 h-5" : "w-4 h-4")} />
                    <span>Randomize</span>
                  </button>
                )}
              </div>
            ) : (
              <div className={cn("flex items-center", isMobile ? "w-full flex-col space-y-2" : "space-x-2")}>
                <button
                  onClick={() => {
                    setShowAddImages(true);
                    loadAlbums();
                    loadAllImages();
                  }}
                  className={cn(
                    "flex items-center justify-center space-x-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors",
                    isMobile ? "w-full px-4 py-3 text-base" : "px-4 py-2"
                  )}
                >
                  <Plus className={cn(isMobile ? "w-5 h-5" : "w-4 h-4")} />
                  <span>Add Images</span>
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className={cn(
                    "flex items-center justify-center space-x-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors",
                    isMobile ? "w-full px-4 py-3 text-base" : "px-4 py-2"
                  )}
                >
                  <Edit className={cn(isMobile ? "w-5 h-5" : "w-4 h-4")} />
                  <span>Edit</span>
                </button>
                <button
                  onClick={handleGenerateVariants}
                  disabled={isGeneratingVariants}
                  className={cn(
                    "flex items-center justify-center space-x-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
                    isMobile ? "w-full px-4 py-3 text-base" : "px-4 py-2"
                  )}
                  title="Generate resolution-optimized variants for display devices"
                >
                  <Sparkles className={cn(isMobile ? "w-5 h-5" : "w-4 h-4")} />
                  <span>{isGeneratingVariants ? 'Generating...' : 'Generate Variants'}</span>
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
          <div className={cn(
            "bg-white w-full max-h-[90vh] overflow-hidden flex flex-col",
            isMobile ? "h-full rounded-none" : "rounded-lg p-6 max-w-4xl"
          )}>
            <div className={cn(
              "flex items-center justify-between mb-4",
              isMobile ? "p-4 border-b" : ""
            )}>
              <h3 className={cn(
                "font-semibold text-gray-900",
                isMobile ? "text-lg" : "text-lg"
              )}>Add Images to Playlist</h3>
              <button
                onClick={() => {
                  setShowAddImages(false);
                  setSelectedImages(new Set());
                  setSearchTerm('');
                  setSelectedAlbum(null);
                  setAlbumImages([]);
                }}
                className={cn(
                  "text-gray-400 hover:text-gray-600",
                  isMobile && "w-10 h-10 flex items-center justify-center"
                )}
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Album Selection */}
            <div className={cn("mb-4", isMobile ? "px-4" : "")}>
              <div className={cn(
                "flex items-center mb-3",
                isMobile ? "flex-col space-y-2" : "space-x-3"
              )}>
                <div className={cn("flex items-center", isMobile ? "w-full space-x-2" : "space-x-3")}>
                  <Filter className={cn("text-gray-500", isMobile ? "w-5 h-5" : "w-4 h-4")} />
                  <span className={cn("font-medium text-gray-700", isMobile ? "text-base" : "text-sm")}>
                    {isMobile ? "Album:" : "Add from Album:"}
                  </span>
                </div>
                <select
                  value={selectedAlbum || ''}
                  onChange={(e) => handleAlbumSelect(e.target.value ? parseInt(e.target.value) : null)}
                  className={cn(
                    "border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                    isMobile ? "w-full px-4 py-3 text-base" : "flex-1 px-3 py-2 text-sm"
                  )}
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
                <Search className={cn(
                  "absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400",
                  isMobile ? "w-5 h-5" : "w-4 h-4"
                )} />
                <input
                  type="text"
                  placeholder="Search images..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(
                    "w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500",
                    isMobile ? "pl-12 pr-4 py-3 text-base" : "pl-10 pr-4 py-2 text-sm"
                  )}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className={cn(
              "mb-4 bg-gray-50 rounded-lg",
              isMobile ? "mx-4 p-3" : "p-4"
            )}>
              <div className={cn(
                "flex items-center",
                isMobile ? "flex-col space-y-2" : "flex-wrap gap-3 justify-between"
              )}>
                <div className={cn("flex items-center", isMobile ? "w-full flex-col space-y-2" : "flex-wrap gap-3")}>
                  {selectedAlbum && albumImages.length > 0 && (
                    <button
                      onClick={() => {
                        const allAlbumImageIds = new Set(albumImages.map(img => img.id));
                        setSelectedImages(allAlbumImageIds);
                      }}
                      className={cn(
                        "bg-green-600 text-white rounded-md hover:bg-green-700 font-medium",
                        isMobile ? "w-full px-4 py-3 text-base" : "px-4 py-2"
                      )}
                    >
                      Select All from Album ({albumImages.length})
                    </button>
                  )}
                  {selectedImages.size > 0 && (
                    <button
                      onClick={() => setSelectedImages(new Set())}
                      className={cn(
                        "bg-gray-500 text-white rounded-md hover:bg-gray-600",
                        isMobile ? "w-full px-4 py-3 text-base" : "px-4 py-2"
                      )}
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
                <div className={cn("flex items-center", isMobile ? "w-full space-y-2" : "flex-wrap gap-3")}>
                  <button
                    onClick={() => {
                      setShowAddImages(false);
                      setSelectedImages(new Set());
                      setSearchTerm('');
                      setSelectedAlbum(null);
                      setAlbumImages([]);
                    }}
                    className={cn(
                      "bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300",
                      isMobile ? "w-full px-4 py-3 text-base" : "px-4 py-2"
                    )}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddSelectedImages}
                    disabled={selectedImages.size === 0}
                    className={cn(
                      "bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium",
                      isMobile ? "w-full px-4 py-3 text-base" : "px-4 py-2"
                    )}
                  >
                    Add {selectedImages.size} Image{selectedImages.size === 1 ? '' : 's'}
                  </button>
                </div>
              </div>
            </div>

            {/* Image Gallery */}
            <div className={cn(
              "overflow-y-auto pr-2",
              isMobile ? "flex-1 px-4" : "h-[calc(90vh-300px)]"
            )}>
              <div className={cn(
                "grid gap-4",
                isMobile ? "grid-cols-2" : "grid-cols-3 md:grid-cols-4 lg:grid-cols-5"
              )}>
                {filteredImages.map((image) => (
                  <div
                    key={image.id}
                    className={cn(
                      "relative group rounded-lg overflow-hidden cursor-pointer",
                      selectedImages.has(image.id) ? 'ring-2 ring-blue-500' : ''
                    )}
                    onClick={() => handleToggleImageSelection(image.id)}
                  >
                    <img
                      src={getThumbnailUrl(image.id)}
                      alt={image.filename}
                      className="w-full h-full object-cover aspect-square"
                    />
                    {selectedImages.has(image.id) && (
                      <div className="absolute inset-0 bg-blue-500 bg-opacity-50 flex items-center justify-center">
                        <div className={cn(
                          "bg-white rounded-full flex items-center justify-center",
                          isMobile ? "w-10 h-10" : "w-8 h-8"
                        )}>
                          <span className={cn("text-blue-600 font-bold", isMobile ? "text-lg" : "")}>✓</span>
                        </div>
                      </div>
                    )}
                    <div className={cn(
                      "absolute bottom-0 left-0 right-0 bg-black bg-opacity-75 text-white truncate",
                      "opacity-0 group-hover:opacity-100 transition-opacity",
                      isMobile ? "p-2 text-xs" : "p-1 text-xs"
                    )}>
                      {image.filename}
                    </div>
                  </div>
                ))}
              </div>
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

      {/* Variant Generation Modal */}
      <VariantGenerationModal
        isOpen={showVariantModal}
        isGenerating={isGeneratingVariants}
        playlistName={playlist?.name}
        variantCount={variantCount}
        error={variantGenerationError}
        onClose={() => {
          setShowVariantModal(false);
          setVariantGenerationError(null);
          setVariantCount(undefined);
        }}
      />
    </div>
  );
};

export default PlaylistDetail;