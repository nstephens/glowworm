import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Separator } from '../components/ui/separator';
import { Upload, Folder, Plus, Settings, ImageIcon, FolderOpen, MoreHorizontal, Calendar, HardDrive, Edit, Trash2 } from 'lucide-react';
import ImageUpload from '../components/ImageUpload';
import ImageGallery from '../components/ImageGallery';
import AlbumManager from '../components/AlbumManager';
import { ConfirmationModal } from '../components/ConfirmationModal';
import AlertContainer from '../components/AlertContainer';
import { useAlert } from '../hooks/useAlert';
import { apiService } from '../services/api';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { MobileUploadFlow } from '../components/upload/MobileUploadFlow';
import { cn } from '../lib/utils';
import type { Image, Album } from '../types';



interface ImagesProps {
  headerContent?: React.ReactNode;
  onDataChange?: (images: Image[], albums: Album[]) => void;
  showUploadModal?: boolean;
  setShowUploadModal?: (show: boolean) => void;
}

export const Images: React.FC<ImagesProps> = ({ headerContent, onDataChange, showUploadModal: propShowUploadModal, setShowUploadModal: propSetShowUploadModal }) => {
  const navigate = useNavigate();
  const { alerts, removeAlert, success, error: showError, warning, info } = useAlert();
  const { isMobile } = useResponsiveLayout();
  const [images, setImages] = useState<Image[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<Image | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localShowUploadModal, setLocalShowUploadModal] = useState(false);
  
  // Use props if available, otherwise use local state
  const showUploadModal = propShowUploadModal !== undefined ? propShowUploadModal : localShowUploadModal;
  const setShowUploadModal = propSetShowUploadModal || setLocalShowUploadModal;
  const [dragOverAlbum, setDragOverAlbum] = useState<number | string | null>(null);
  
  // Album creation modal state
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  
  // Album edit/delete modal state
  const [showEditAlbumModal, setShowEditAlbumModal] = useState(false);
  const [albumToEdit, setAlbumToEdit] = useState<Album | null>(null);
  const [editAlbumName, setEditAlbumName] = useState('');
  const [showDeleteAlbumModal, setShowDeleteAlbumModal] = useState(false);
  const [albumToDelete, setAlbumToDelete] = useState<Album | null>(null);
  const [deleteAlbumAction, setDeleteAlbumAction] = useState<'delete-images' | 'move-to-unsorted'>('move-to-unsorted');

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

  // Notify parent component when data changes
  useEffect(() => {
    if (onDataChange) {
      onDataChange(images, albums);
    }
  }, [images, albums, onDataChange]);

  // Prevent body scroll when upload modal is open
  useEffect(() => {
    if (showUploadModal) {
      document.body.classList.add('modal-open');
    } else {
      document.body.classList.remove('modal-open');
    }
    
    // Cleanup on unmount
    return () => {
      document.body.classList.remove('modal-open');
    };
  }, [showUploadModal]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [imagesResponse, albumsResponse] = await Promise.all([
        apiService.getImages(undefined, undefined, 1000),
        apiService.getAlbums()
      ]);

      setImages(imagesResponse.data || []);
      setAlbums(albumsResponse.data || []);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load data';
      setError(errorMessage);
      // showError('Failed to Load Images', errorMessage);
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = async (newImages: Image[]) => {
    setImages(prev => [...prev, ...newImages]);
    // Refresh albums to update image counts
    loadAlbums();
    
    if (newImages.length > 0) {
      success(
        'Images Uploaded Successfully',
        `${newImages.length} image${newImages.length !== 1 ? 's' : ''} uploaded successfully`
      );
      
      // Trigger background variant generation for newly uploaded images (fire and forget)
      // Don't await - let it run in the background without blocking UI
      apiService.regenerateImageResolutions()
        .then(() => {
          console.log('✅ Background variant generation completed');
        })
        .catch((err) => {
          // Non-critical - variants can be generated manually later
          console.log('⚠️ Variant generation will occur on next scheduled run:', err);
        });
      
      // Show info immediately without waiting
      info(
        'Generating Variants',
        'Optimized image variants are being generated in the background'
      );
    }
  };

  const loadAlbums = async () => {
    try {
      const response = await apiService.getAlbums();
      setAlbums(response.data || []);
    } catch (err) {
      console.error('Failed to load albums:', err);
    }
  };

  const handleCreateAlbum = async (name: string, description?: string) => {
    try {
      const response = await apiService.createAlbum(name);
      setAlbums(prev => [...prev, response.data]);
      success('Album Created', `"${name}" album has been created successfully`);
      return response.data; // Return the album object
    } catch (err: any) {
      showError('Create Album Failed', err.message || 'Failed to create album');
      throw new Error(err.message || 'Failed to create album');
    }
  };

  const handleCreateAlbumFromModal = async () => {
    if (!newAlbumName.trim()) {
      showError('Invalid Album Name', 'Please enter a valid album name');
      return;
    }

    try {
      await handleCreateAlbum(newAlbumName.trim());
      setShowAlbumModal(false);
      setNewAlbumName('');
    } catch (err) {
      // Error already handled in handleCreateAlbum
    }
  };

  const handleUpdateAlbum = async (id: number, name: string) => {
    try {
      const response = await apiService.updateAlbum(id, name);
      setAlbums(prev => prev.map(album => 
        album.id === id ? response.data : album
      ));
      success('Album Updated', `Album has been renamed to "${name}"`);
    } catch (err: any) {
      showError('Update Album Failed', err.message || 'Failed to update album');
      throw new Error(err.message || 'Failed to update album');
    }
  };

  const handleDeleteAlbum = async (id: number, action: 'delete-images' | 'move-to-unsorted') => {
    try {
      const album = albums.find(album => album.id === id);
      if (!album) return;

      const albumName = album.name;
      const imagesInAlbum = images.filter(img => img.album_id === id);

      if (action === 'delete-images') {
        // Delete all images in the album first
        for (const image of imagesInAlbum) {
          await apiService.deleteImage(image.id);
        }
        // Update local state to remove deleted images
        setImages(prev => prev.filter(img => img.album_id !== id));
        success('Album & Images Deleted', `"${albumName}" album and ${imagesInAlbum.length} images have been deleted`);
      } else {
        // Move images to unsorted (album_id = null)
        for (const image of imagesInAlbum) {
          await apiService.updateImage(image.id, { album_id: null });
        }
        // Update local state to move images to unsorted
        setImages(prev => prev.map(img => 
          img.album_id === id ? { ...img, album_id: null } : img
        ));
        success('Album Deleted', `"${albumName}" album has been deleted and ${imagesInAlbum.length} images moved to unsorted`);
      }

      // Delete the album
      await apiService.deleteAlbum(id);
      setAlbums(prev => prev.filter(album => album.id !== id));
      
      // If the deleted album was selected, clear selection
      if (selectedAlbum?.id === id) {
        setSelectedAlbum(null);
      }
    } catch (err: any) {
      showError('Delete Album Failed', err.message || 'Failed to delete album');
      throw new Error(err.message || 'Failed to delete album');
    }
  };

  const openEditAlbumModal = (album: Album, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setAlbumToEdit(album);
    setEditAlbumName(album.name);
    setShowEditAlbumModal(true);
  };

  const handleEditAlbumSubmit = async () => {
    if (!albumToEdit || !editAlbumName.trim()) return;
    
    try {
      await handleUpdateAlbum(albumToEdit.id, editAlbumName.trim());
      setShowEditAlbumModal(false);
      setAlbumToEdit(null);
      setEditAlbumName('');
    } catch (err) {
      // Error already handled in handleUpdateAlbum
    }
  };

  const openDeleteAlbumModal = (album: Album, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    setAlbumToDelete(album);
    setShowDeleteAlbumModal(true);
  };

  const handleDeleteAlbumSubmit = async () => {
    if (!albumToDelete) return;
    
    try {
      await handleDeleteAlbum(albumToDelete.id, deleteAlbumAction);
      setShowDeleteAlbumModal(false);
      setAlbumToDelete(null);
      setDeleteAlbumAction('move-to-unsorted');
    } catch (err) {
      // Error already handled in handleDeleteAlbum
    }
  };

  const handleImageSelect = (image: Image) => {
    console.log('Selected image:', image);
    // TODO: Implement image preview/modal
  };


  const handleImageDelete = async (image: Image) => {
    console.log('handleImageDelete called for image:', image);
    setImageToDelete(image);
    setShowDeleteModal(true);
  };

  const confirmImageDelete = async () => {
    if (!imageToDelete) return;
    
    try {
      console.log('Deleting image with ID:', imageToDelete.id);
      await apiService.deleteImage(imageToDelete.id);
      setImages(prev => prev.filter(img => img.id !== imageToDelete.id));
      console.log('Image deleted successfully');
      success('Image Deleted', `"${imageToDelete.original_filename}" has been deleted successfully`);
    } catch (err: any) {
      console.error('Failed to delete image:', err);
      showError('Delete Failed', `Failed to delete "${imageToDelete.original_filename}": ${err.message || 'Unknown error'}`);
    } finally {
      setShowDeleteModal(false);
      setImageToDelete(null);
    }
  };

  const handleBulkDelete = async (imageIds: number[]) => {
    console.log('handleBulkDelete called for image IDs:', imageIds);
    try {
      // Delete all images in parallel
      await Promise.all(imageIds.map(id => apiService.deleteImage(id)));
      setImages(prev => prev.filter(img => !imageIds.includes(img.id)));
      console.log('Bulk delete completed successfully');
      // success('Images Deleted', `${imageIds.length} image${imageIds.length !== 1 ? 's' : ''} deleted successfully`);
    } catch (err: any) {
      console.error('Failed to bulk delete images:', err);
      // showError('Bulk Delete Failed', `Failed to delete some images: ${err.message || 'Unknown error'}`);
    }
  };

  const handleImageMove = async (image: Image, albumId: number) => {
    try {
      await apiService.updateImage(image.id, { album_id: albumId });
      setImages(prev => prev.map(img => 
        img.id === image.id ? { ...img, album_id: albumId } : img
      ));
      
      // const albumName = albumId ? albums.find(a => a.id === albumId)?.name || 'Unknown Album' : 'No Album';
      // success('Image Moved', `"${image.original_filename}" moved to ${albumName}`);
    } catch (err: any) {
      console.error('Failed to move image:', err);
      // showError('Move Failed', `Failed to move "${image.original_filename}": ${err.message || 'Unknown error'}`);
    }
  };

  // Drag and Drop Handlers for Sidebar
  const handleSidebarDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleSidebarDrop = (e: React.DragEvent, targetAlbumId: number | string | null) => {
    e.preventDefault();
    setDragOverAlbum(null);
    
    const imageId = e.dataTransfer.getData('text/plain');
    const image = images.find(img => img.id === parseInt(imageId));
    
    if (!image) return;
    
    // Don't move if it's the same album
    if (image.album_id === targetAlbumId) return;
    
    handleImageMove(image, targetAlbumId as number);
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
          <Upload className="w-16 h-16 mx-auto" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Images</h3>
        <p className="text-gray-500 mb-4">{error}</p>
        <button onClick={loadData} className="btn-primary">
          Try Again
        </button>
      </div>
    );
  }


  return (
    <div className="space-y-8">
      {/* Albums Section */}
      <div className="animate-fade-in-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-accent" />
            Albums
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAlbumModal(true)}
            className="shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Album
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4 mb-6 md:mb-8">
          <Card className="gallery-item border-0 shadow-lg bg-card/50 backdrop-blur-sm cursor-pointer" onClick={() => setSelectedAlbum(null)}>
            <CardContent className="p-2 md:p-4">
              <div className="flex items-center gap-2 md:gap-3">
                <div className="w-8 h-8 md:w-12 md:h-12 bg-gradient-to-br from-accent to-secondary rounded-lg flex items-center justify-center">
                  <FolderOpen className="w-4 h-4 md:w-6 md:h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-sm md:text-base">All Images</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">{images.length} images</p>
                </div>
              </div>
            </CardContent>
          </Card>
          {albums.map((album) => (
            <Card 
              key={album.id} 
              className="gallery-item border-0 shadow-lg bg-card/50 backdrop-blur-sm cursor-pointer group relative"
              onClick={() => setSelectedAlbum(album)}
            >
              <CardContent className="p-2 md:p-4">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="w-8 h-8 md:w-12 md:h-12 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                    <FolderOpen className="w-4 h-4 md:w-6 md:h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm md:text-base">{album.name}</h3>
                    <p className="text-xs md:text-sm text-muted-foreground">{images.filter(img => img.album_id === album.id).length} images</p>
                  </div>
                  {/* Action Buttons - Show on Hover */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button
                      onClick={(e) => openEditAlbumModal(album, e)}
                      className="p-1.5 bg-white/90 hover:bg-white rounded-md shadow-md text-gray-600 hover:text-blue-600 transition-colors"
                      title="Rename album"
                    >
                      <Edit className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </button>
                    <button
                      onClick={(e) => openDeleteAlbumModal(album, e)}
                      className="p-1.5 bg-white/90 hover:bg-white rounded-md shadow-md text-gray-600 hover:text-red-600 transition-colors"
                      title="Delete album"
                    >
                      <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Images Grid */}
      <div className="animate-fade-in-up">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-primary" />
          {selectedAlbum ? selectedAlbum.name : 'All Images'}
        </h2>
        
        {/* Image Gallery Component */}
        <div className="min-h-full">
          <ImageGallery
            images={images}
            albums={albums}
            selectedAlbum={selectedAlbum?.id === 'no-album' ? 'no-album' : selectedAlbum?.id || null}
            onImageSelect={handleImageSelect}
            onImageDelete={handleImageDelete}
            onBulkDelete={handleBulkDelete}
            onImageMove={handleImageMove}
            onUploadClick={() => setShowUploadModal(true)}
          />
        </div>
      </div>


      {/* Upload Modal - Full-screen on mobile, modal on desktop */}
      {showUploadModal && (
        <div 
          className={cn(
            "fixed inset-0 z-50",
            isMobile 
              ? "bg-background" 
              : "bg-black bg-opacity-50 flex items-center justify-center mobile-modal"
          )}
          onClick={(e) => {
            // Prevent dismissing on backdrop click for mobile
            if (!isMobile && e.target === e.currentTarget) {
              setShowUploadModal(false);
            }
          }}
        >
          <Card className={cn(
            "w-full overflow-hidden border-0 shadow-2xl flex flex-col",
            isMobile 
              ? "h-full rounded-none" 
              : "max-w-4xl max-h-[90vh] mx-4 mobile-modal-content"
          )}>
            <CardHeader className={cn(
              "flex-shrink-0",
              isMobile && "p-4 border-b"
            )}>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className={cn(
                    isMobile ? "text-2xl" : "text-xl"
                  )}>Upload Images</CardTitle>
                  {!isMobile && (
                    <CardDescription>Add new photos to your library</CardDescription>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size={isMobile ? "lg" : "sm"}
                  onClick={() => setShowUploadModal(false)}
                  className={cn(
                    isMobile 
                      ? "h-12 w-12" 
                      : "h-8 w-8 p-0"
                  )}
                >
                  <Plus className={cn(
                    isMobile ? "w-6 h-6" : "w-4 h-4",
                    "rotate-45"
                  )} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className={cn(
              "flex-1 overflow-y-auto mobile-scroll",
              isMobile && "p-4"
            )}>
              <ImageUpload
                onUploadComplete={(newImages) => {
                  handleUploadComplete(newImages);
                  setShowUploadModal(false);
                }}
                selectedAlbumId={selectedAlbum?.id}
                albums={albums}
                onCreateAlbum={handleCreateAlbum}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Individual Image Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setImageToDelete(null);
        }}
        onConfirm={confirmImageDelete}
        title="Delete Image"
        message={imageToDelete ? `Are you sure you want to permanently delete "${imageToDelete.original_filename}"? This action cannot be undone.` : ''}
        confirmText="Delete Image"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Create Album Modal */}
      {showAlbumModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 border-0 shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Create Album</CardTitle>
                  <CardDescription>Create a new album to organize your images</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowAlbumModal(false);
                    setNewAlbumName('');
                  }}
                  className="h-8 w-8 p-0"
                >
                  <Plus className="w-4 h-4 rotate-45" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="album-name">Album Name</Label>
                <Input
                  id="album-name"
                  placeholder="Enter album name..."
                  value={newAlbumName}
                  onChange={(e) => setNewAlbumName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateAlbumFromModal();
                    }
                    if (e.key === 'Escape') {
                      setShowAlbumModal(false);
                      setNewAlbumName('');
                    }
                  }}
                  autoFocus
                  className="bg-background/50 border-border/50"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAlbumModal(false);
                    setNewAlbumName('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateAlbumFromModal}
                  disabled={!newAlbumName.trim()}
                  className="shadow-lg"
                >
                  <Folder className="w-4 h-4 mr-2" />
                  Create Album
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Album Modal */}
      {showEditAlbumModal && albumToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 border-0 shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Rename Album</CardTitle>
                  <CardDescription>Change the name of "{albumToEdit.name}"</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowEditAlbumModal(false);
                    setAlbumToEdit(null);
                    setEditAlbumName('');
                  }}
                  className="h-8 w-8 p-0"
                >
                  <Plus className="w-4 h-4 rotate-45" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-album-name">Album Name</Label>
                <Input
                  id="edit-album-name"
                  placeholder="Enter new album name..."
                  value={editAlbumName}
                  onChange={(e) => setEditAlbumName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleEditAlbumSubmit();
                    }
                    if (e.key === 'Escape') {
                      setShowEditAlbumModal(false);
                      setAlbumToEdit(null);
                      setEditAlbumName('');
                    }
                  }}
                  autoFocus
                  className="bg-background/50 border-border/50"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowEditAlbumModal(false);
                    setAlbumToEdit(null);
                    setEditAlbumName('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleEditAlbumSubmit}
                  disabled={!editAlbumName.trim() || editAlbumName.trim() === albumToEdit.name}
                  className="shadow-lg"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Rename Album
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Album Modal */}
      {showDeleteAlbumModal && albumToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 border-0 shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Delete Album</CardTitle>
                  <CardDescription>What should happen to the images in "{albumToDelete.name}"?</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowDeleteAlbumModal(false);
                    setAlbumToDelete(null);
                    setDeleteAlbumAction('move-to-unsorted');
                  }}
                  className="h-8 w-8 p-0"
                >
                  <Plus className="w-4 h-4 rotate-45" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-gray-700">
                  This album contains <strong>{images.filter(img => img.album_id === albumToDelete.id).length} images</strong>
                </p>
              </div>
              
              <div className="space-y-3">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="delete-action"
                    value="move-to-unsorted"
                    checked={deleteAlbumAction === 'move-to-unsorted'}
                    onChange={(e) => setDeleteAlbumAction(e.target.value as 'delete-images' | 'move-to-unsorted')}
                    className="mt-0.5 w-4 h-4 text-blue-600"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900">Keep images (recommended)</span>
                    <p className="text-xs text-gray-500 mt-0.5">Delete album but move images to "All Images"</p>
                  </div>
                </label>
                
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="delete-action"
                    value="delete-images"
                    checked={deleteAlbumAction === 'delete-images'}
                    onChange={(e) => setDeleteAlbumAction(e.target.value as 'delete-images' | 'move-to-unsorted')}
                    className="mt-0.5 w-4 h-4 text-red-600"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-medium text-red-900">Delete images too</span>
                    <p className="text-xs text-red-600 mt-0.5">Permanently delete the album AND all its images</p>
                  </div>
                </label>
              </div>
              
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeleteAlbumModal(false);
                    setAlbumToDelete(null);
                    setDeleteAlbumAction('move-to-unsorted');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleDeleteAlbumSubmit}
                  variant="destructive"
                  className="shadow-lg"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  {deleteAlbumAction === 'delete-images' ? 'Delete Album & Images' : 'Delete Album'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alerts */}
      <AlertContainer alerts={alerts} onRemove={removeAlert} />

      {/* Mobile Upload Flow */}
      {isMobile && (
        <MobileUploadFlow
          onUploadComplete={handleUploadComplete}
          albums={albums}
          onCreateAlbum={handleCreateAlbum}
          showAlbumSelection={true}
          buttonPosition="bottom-right"
          buttonSize="md"
          hapticFeedback={true}
        />
      )}
    </div>
  );
};

export default Images;
