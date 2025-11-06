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
import { DISPLAY_MODE_CONFIGS, getDisplayModeConfig, getDisplayModesByTier, PERFORMANCE_TIER_LABELS, PerformanceTier } from '../types/displayModes';
import { getDeviceCapabilities } from '../utils/deviceCapabilities';
import { PlaylistPairingView } from '../components/PlaylistPairingView';
import { validateDragMove } from '../utils/dragValidation';

// Draggable Image Item Component
const DraggableImageItem: React.FC<{
  image: Image;
  index: number;
  moveImage: (draggedId: number, targetId: number) => void;
  onDragEnd: () => void;
  onDelete: (image: Image) => void;
  isEditing: boolean;
  displayMode: DisplayMode;
  pairInfo?: { isPaired: boolean; pairNumber?: number; positionInPair?: number; pairColor?: string };
  totalImages: number;
}> = ({ image, index, moveImage, onDragEnd, onDelete, isEditing, displayMode, pairInfo, totalImages }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'IMAGE',
    item: { id: image.id },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: isEditing,
    end: () => {
      // Call onDragEnd when drag completes
      onDragEnd();
    },
  });

  const [{ isOver }, drop] = useDrop({
    accept: 'IMAGE',
    hover: (item: { id: number }) => {
      if (item.id !== image.id && isEditing) {
        moveImage(item.id, image.id);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
    canDrop: () => isEditing, // Allow dropping when in edit mode
  });

  // Keyboard navigation handlers
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isEditing) return;
    
    // Arrow keys for reordering
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (index > 0) {
        // Get previous image's ID from the grid
        const prevImage = (e.currentTarget.previousElementSibling as HTMLElement);
        const prevImageId = prevImage?.getAttribute('data-image-id');
        if (prevImageId) {
          moveImage(image.id, parseInt(prevImageId));
        }
      }
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (index < totalImages - 1) {
        // Get next image's ID from the grid
        const nextImage = (e.currentTarget.nextElementSibling as HTMLElement);
        const nextImageId = nextImage?.getAttribute('data-image-id');
        if (nextImageId) {
          moveImage(image.id, parseInt(nextImageId));
        }
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      onDelete(image);
    }
  };

  const borderColor = pairInfo?.isPaired && pairInfo?.pairColor ? pairInfo.pairColor : '';
  
  return (
    <div
      ref={(node) => drag(drop(node))}
      className={`relative group rounded-lg overflow-hidden cursor-pointer transition-all duration-200 ${
        isDragging ? 'opacity-50 scale-95 ring-2 ring-blue-500' : 'hover:scale-105'
      } ${isOver && isEditing ? 'ring-2 ring-green-500' : ''} ${
        isEditing ? 'cursor-move' : 'cursor-default'
      } ${pairInfo?.isPaired ? `ring-8 ${borderColor} shadow-lg` : 'ring-1 ring-gray-200'} focus:outline-none focus:ring-2 focus:ring-blue-400`}
      tabIndex={isEditing ? 0 : -1}
      onKeyDown={handleKeyDown}
      data-image-id={image.id}
      role="button"
      aria-label={`${image.filename}, position ${index + 1} of ${totalImages}${pairInfo?.isPaired ? ', paired image' : ''}`}
      aria-grabbed={isDragging}
    >
      <img
        src={getThumbnailUrl(image.id)}
        alt={image.filename}
        className="w-full h-full object-cover aspect-square"
      />
      
      {/* Overlay with actions */}
      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center">
        <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex space-x-2">
          {isEditing && (
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
  const [editShowExifDate, setEditShowExifDate] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showDragWarning, setShowDragWarning] = useState(false);
  const [dragValidationResult, setDragValidationResult] = useState<{warning?: string; pairLoss?: number} | null>(null);
  const [pendingDragMove, setPendingDragMove] = useState<{draggedId: number; targetId: number} | null>(null);
  const wsRef = useRef<AdminWebSocketClient | null>(null);

  // Get device capabilities for recommendations
  const deviceCapabilities = getDeviceCapabilities();
  
  // Display mode options grouped by performance tier
  const tier1Modes = getDisplayModesByTier(PerformanceTier.TIER_1);
  const tier2Modes = getDisplayModesByTier(PerformanceTier.TIER_2);
  const tier3Modes = getDisplayModesByTier(PerformanceTier.TIER_3);
  
  // Get current mode config
  const currentModeConfig = getDisplayModeConfig(editDisplayMode);

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
      const showExifDateChanged = editShowExifDate !== (playlist.show_exif_date || false);
      
      setHasChanges(nameChanged || displayModeChanged || displayTimeChanged || isDefaultChanged || showExifDateChanged);
    }
  }, [editName, editDisplayMode, editDisplayTime, editIsDefault, editShowExifDate, playlist]);

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
      setEditShowExifDate(playlistData.show_exif_date || false);
      
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
        show_exif_date: editShowExifDate
      };
      
      await apiService.updatePlaylist(
        playlist.id,
        updateData.name,
        updateData.is_default,
        updateData.display_time_seconds,
        updateData.display_mode,
        undefined, // show_image_info (kept for API compatibility)
        updateData.show_exif_date
      );
      
      // If image order changed, save it too
      if (hasChanges) {
        const newImageIds = playlistImages.map(img => img.id);
        await apiService.reorderPlaylist(playlist.id, newImageIds);
        playlistLogger.info('Playlist order saved', { playlistId: playlist.id, imageCount: newImageIds.length });
      }
      
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

  const handleCancelEdit = async () => {
    if (playlist) {
      setEditName(playlist.name);
      setEditDisplayMode(playlist.display_mode || 'default');
      setEditDisplayTime(playlist.display_time_seconds || 30);
      setEditIsDefault(playlist.is_default || false);
      setEditShowExifDate(playlist.show_exif_date || false);
      
      // Reload playlist to revert any unsaved image order changes
      if (hasChanges) {
        await loadPlaylist();
      }
    }
    setIsEditing(false);
    setHasChanges(false);
  };

  const handleRandomizePlaylist = () => {
    if (!playlist) return;
    
    try {
      // Perform local shuffle (Fisher-Yates algorithm)
      const shuffled = [...playlistImages];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      
      setPlaylistImages(shuffled);
      setHasChanges(true);
      
      playlistLogger.info('Playlist randomized locally', { playlistId: playlist.id });
    } catch (error) {
      console.error('Error randomizing playlist:', error);
      playlistLogger.error('Failed to randomize playlist', { error, playlistId: playlist.id });
    }
  };

  // Store original order for reverting
  const [originalOrder, setOriginalOrder] = useState<Image[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const moveImage = (draggedId: number, targetId: number) => {
    if (!playlist) return;
    
    const draggedIndex = playlistImages.findIndex(img => img.id === draggedId);
    const targetIndex = playlistImages.findIndex(img => img.id === targetId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;
    
    // Store original order on first drag
    if (!isDragging) {
      setOriginalOrder([...playlistImages]);
      setIsDragging(true);
    }
    
    // Update local state only (no API call, no validation yet)
    const newImages = [...playlistImages];
    const [draggedImage] = newImages.splice(draggedIndex, 1);
    newImages.splice(targetIndex, 0, draggedImage);
    setPlaylistImages(newImages);
    
    playlistLogger.info('Image moved (hover)', { playlistId: playlist.id, draggedId, targetId });
  };
  
  const handleDragEnd = () => {
    if (!playlist || !isDragging) return;
    
    // Get display orientation (default to portrait if not set)
    const displayOrientation = 'portrait'; // TODO: Get from assigned display device
    
    // Validate the final order
    const currentSequence = playlistImages.map(img => img.id);
    const originalSequence = originalOrder.map(img => img.id);
    
    // Find what changed
    const draggedIndex = originalSequence.findIndex((id, idx) => currentSequence[idx] !== id);
    const targetIndex = currentSequence.indexOf(originalSequence[draggedIndex]);
    
    if (draggedIndex !== -1 && targetIndex !== -1 && draggedIndex !== targetIndex) {
      const validation = validateDragMove(
        draggedIndex,
        targetIndex,
        originalSequence,
        originalOrder,
        displayOrientation
      );
      
      // If move breaks pairing, show warning
      if (validation.breaksPairing && validation.pairLoss && validation.pairLoss > 0) {
        setPendingDragMove({ 
          draggedId: originalSequence[draggedIndex], 
          targetId: originalSequence[targetIndex] 
        });
        setDragValidationResult(validation);
        setShowDragWarning(true);
        setIsDragging(false);
        return;
      }
    }
    
    // Valid move - mark as changed but don't save yet
    setHasChanges(true);
    setIsDragging(false);
    setOriginalOrder([]);
    
    playlistLogger.info('Drag completed', { playlistId: playlist.id });
  };
  
  const confirmDragMove = () => {
    // Keep the current order
    setShowDragWarning(false);
    setPendingDragMove(null);
    setDragValidationResult(null);
    setHasChanges(true);
    
    playlistLogger.info('Suboptimal reorder confirmed', { playlistId: playlist.id });
  };
  
  const cancelDragMove = () => {
    // Revert to original order
    if (originalOrder.length > 0) {
      setPlaylistImages(originalOrder);
    }
    setShowDragWarning(false);
    setPendingDragMove(null);
    setDragValidationResult(null);
    setOriginalOrder([]);
    
    playlistLogger.info('Suboptimal reorder cancelled', { playlistId: playlist.id });
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
        <div className="w-full">
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
                      {tier1Modes.map((config) => (
                        <option key={config.mode} value={config.mode}>
                          {config.displayName}
                        </option>
                      ))}
                      {tier2Modes.map((config) => (
                        <option key={config.mode} value={config.mode}>
                          {config.displayName}
                        </option>
                      ))}
                      {tier3Modes.map((config) => (
                        <option key={config.mode} value={config.mode}>
                          {config.displayName}
                        </option>
                      ))}
                    </select>
                    
                    {/* Mode description */}
                    <p className={cn("text-gray-500", isMobile ? "text-sm" : "text-xs")}>
                      {currentModeConfig.description}
                    </p>
                    
                    {/* Performance warning for Tier 3 modes */}
                    {currentModeConfig.tier >= PerformanceTier.TIER_3 && (
                      <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                        <p className="text-sm text-yellow-800">
                          ⚡ {currentModeConfig.warningMessage || 'This mode requires high-performance hardware.'}
                        </p>
                      </div>
                    )}
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
                    <div className="space-y-2">
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
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={editShowExifDate}
                          onChange={(e) => setEditShowExifDate(e.target.checked)}
                          className={cn("text-blue-600 rounded focus:ring-blue-500", isMobile ? "w-5 h-5" : "w-4 h-4")}
                        />
                        <span className={cn("text-gray-600", isMobile ? "text-base" : "text-sm")}>
                          Show EXIF Date
                        </span>
                      </div>
                    </div>
                    <p className={cn("text-gray-500", isMobile ? "text-sm" : "text-xs")}>
                      Display photo capture date in lower right corner (e.g., "August 3, 2021")
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full">
                {/* Title - Full Width, First Row */}
                <h1 className={cn(
                  "font-bold text-gray-900 mb-4",
                  isMobile ? "text-xl" : "text-3xl"
                )}>
                  {playlist.name}
                </h1>
                
                {/* Badges + Metadata - Second Row */}
                <div className={cn(
                  "flex items-center flex-wrap gap-2 mb-4",
                  isMobile ? "text-sm" : "text-sm"
                )}>
                  {/* Status Badges */}
                  {playlist.is_default && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Default
                    </span>
                  )}
                  
                  {playlist.display_mode && playlist.display_mode !== 'default' && (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {getDisplayModeConfig(playlist.display_mode).displayName}
                    </span>
                  )}
                  
                  {/* Metadata */}
                  <span className="text-gray-600">{playlistImages.length} images</span>
                  {!isMobile && playlist.display_time_seconds && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-600">{playlist.display_time_seconds}s per image</span>
                    </>
                  )}
                  {!isMobile && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-500 text-xs">{playlist.slug}</span>
                    </>
                  )}
                  
                  {/* Action Buttons - Same Row as Badges */}
                  {!isMobile && (
                    <>
                      <span className="text-gray-400">•</span>
                      <button
                        onClick={() => {
                          setShowAddImages(true);
                          loadAlbums();
                          loadAllImages();
                        }}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Images</span>
                      </button>
                      <button
                        onClick={() => setIsEditing(true)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    </>
                  )}
                </div>
                
                {/* Pairing Structure Visualization */}
                {!isMobile && playlist.computed_sequence && playlistImages.length > 0 && (() => {
                  // Check if pairing is suboptimal (only if images are loaded)
                  const currentSequence = playlistImages.map(img => img.id);
                  const computedSequence = playlist.computed_sequence.flatMap((entry: any) => entry.images);
                  const isOptimal = currentSequence.length === computedSequence.length && 
                                     currentSequence.every((id, idx) => id === computedSequence[idx]);
                  
                  if (!isOptimal && playlist.computed_sequence.length > 0) {
                    const optimalPairs = playlist.computed_sequence.filter((e: any) => e.type === 'pair').length;
                    return (
                      <div className="mt-4 p-4 bg-yellow-50 rounded-lg border border-yellow-300">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0 text-yellow-600 text-xl">⚠️</div>
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-yellow-800 mb-1">Pairing Not Optimized</h3>
                            <p className="text-sm text-yellow-700 mb-2">
                              The current image order doesn't use optimal pairing ({optimalPairs} possible pairs available).
                            </p>
                            <p className="text-xs text-yellow-600">
                              <strong>To fix:</strong> Click Edit, then Save to automatically recompute optimal pairing, or use the Randomize button to shuffle while maintaining pairs.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            )}
            
            {/* Action Buttons for Editing Mode */}
            {isEditing && (
              <div className={cn(
                "flex items-center flex-wrap gap-2 mt-4",
                isMobile && "flex-col w-full"
              )}>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !editName.trim() || !hasChanges}
                  className={cn(
                    "inline-flex items-center space-x-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
                    isMobile ? "w-full px-4 py-3 text-base" : "px-3 py-1.5 text-xs"
                  )}
                >
                  <Save className={cn(isMobile ? "w-5 h-5" : "w-3.5 h-3.5")} />
                  <span>{isSaving ? 'Saving...' : 'Save'}</span>
                </button>
                <button
                  onClick={handleCancelEdit}
                  className={cn(
                    "inline-flex items-center space-x-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors",
                    isMobile ? "w-full px-4 py-3 text-base" : "px-3 py-1.5 text-xs"
                  )}
                >
                  <X className={cn(isMobile ? "w-5 h-5" : "w-3.5 h-3.5")} />
                  <span>Cancel</span>
                </button>
                {/* Randomize Button - only show when not auto_sort and playlist has multiple images */}
                {editDisplayMode !== 'auto_sort' && playlistImages.length > 1 && (
                  <button
                    onClick={handleRandomizePlaylist}
                    className={cn(
                      "inline-flex items-center space-x-1.5 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors",
                      isMobile ? "w-full px-4 py-3 text-base" : "px-3 py-1.5 text-xs"
                    )}
                    title="Randomize the order of images in this playlist"
                  >
                    <Shuffle className={cn(isMobile ? "w-5 h-5" : "w-3.5 h-3.5")} />
                    <span>Randomize</span>
                  </button>
                )}
              </div>
            )}
            
            {/* Mobile Action Buttons - Below badges */}
            {!isEditing && isMobile && (
              <div className="flex flex-col w-full space-y-2 mt-4">
                <button
                  onClick={() => {
                    setShowAddImages(true);
                    loadAlbums();
                    loadAllImages();
                  }}
                  className="flex items-center justify-center space-x-2 w-full px-4 py-3 text-base bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  <span>Add Images</span>
                </button>
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center justify-center space-x-2 w-full px-4 py-3 text-base bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  <Edit className="w-5 h-5" />
                  <span>Edit</span>
                </button>
              </div>
            )}
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
                {(() => {
                  // Debug: Check computed_sequence
                  console.log('Playlist computed_sequence:', playlist?.computed_sequence);
                  if (playlist?.computed_sequence) {
                    const pairEntries = playlist.computed_sequence.filter((e: any) => e.type === 'pair');
                    console.log(`Found ${pairEntries.length} pair entries out of ${playlist.computed_sequence.length} total`);
                    if (pairEntries.length > 0) {
                      console.log('First 3 pairs:', pairEntries.slice(0, 3));
                    }
                  }
                  return null;
                })()}
                {playlistImages.map((image, index) => {
                  // Compute pairing info with colors and positions
                  let pairInfo: { isPaired: boolean; pairNumber?: number; positionInPair?: number; pairColor?: string } = { isPaired: false };
                  
                  if (playlist?.computed_sequence) {
                    // Color palette for pairs (cycling through distinct colors)
                    const pairColors = [
                      'ring-blue-500',
                      'ring-purple-500',
                      'ring-pink-500',
                      'ring-green-500',
                      'ring-yellow-500',
                      'ring-red-500',
                      'ring-indigo-500',
                      'ring-cyan-500',
                    ];
                    
                    let pairNumber = 0;
                    for (const entry of playlist.computed_sequence) {
                      if (entry.type === 'pair') {
                        pairNumber++;
                        const imagePosition = entry.images.indexOf(image.id);
                        if (imagePosition !== -1) {
                          pairInfo = {
                            isPaired: true,
                            pairNumber,
                            positionInPair: imagePosition + 1,
                            pairColor: pairColors[(pairNumber - 1) % pairColors.length]
                          };
                          break;
                        }
                      }
                    }
                  }
                  
                  // Debug logging for first few images
                  if (index < 3) {
                    console.log(`Image ${index}: ${image.id}, isPaired: ${pairInfo.isPaired}, color: ${pairInfo.pairColor || 'none'}`);
                  }
                  
                  return (
                    <DraggableImageItem
                      key={image.id}
                      image={image}
                      index={index}
                      moveImage={moveImage}
                      onDragEnd={handleDragEnd}
                      onDelete={(img) => {
                        setImageToDelete(img);
                        setShowDeleteModal(true);
                      }}
                      isEditing={isEditing}
                      displayMode={editDisplayMode}
                      pairInfo={pairInfo}
                      totalImages={playlistImages.length}
                    />
                  );
                })}
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
      
      {/* Drag Validation Warning Modal */}
      <ConfirmationModal
        isOpen={showDragWarning}
        onClose={cancelDragMove}
        onConfirm={confirmDragMove}
        title="⚠️ Pairing Consistency Warning"
        message={dragValidationResult?.warning || 'This move may affect image pairing. Continue anyway?'}
        confirmText="Keep This Order"
        cancelText="Undo Move"
        variant="warning"
      />
    </div>
  );
};

export default PlaylistDetail;