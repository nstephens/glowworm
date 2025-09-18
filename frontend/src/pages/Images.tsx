import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Folder, Plus, Search, Filter, Settings } from 'lucide-react';
import ImageUpload from '../components/ImageUpload';
import ImageGallery from '../components/ImageGallery';
import AlbumManager from '../components/AlbumManager';
import { ConfirmationModal } from '../components/ConfirmationModal';
import AlertContainer from '../components/AlertContainer';
import { useAlert } from '../hooks/useAlert';
import { apiService } from '../services/api';
import type { Image, Album } from '../types';


// Export the header content component for use in App.tsx
export const ImagesHeader: React.FC<{ images: Image[]; albums: Album[]; onUploadClick: () => void }> = ({ 
  images, 
  albums, 
  onUploadClick 
}) => (
  <div className="flex items-center justify-between w-full">
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Image Management</h1>
      <p className="text-sm text-gray-600 mt-1">
        Manage your image library and organize content
      </p>
    </div>
    
    <div className="flex items-center space-x-4">
      {/* Stats Cards */}
      <div className="flex items-center space-x-3">
        <div className="bg-blue-50 px-3 py-2 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-sm font-medium text-blue-700">{images.length}</span>
            <span className="text-xs text-blue-600">images</span>
          </div>
        </div>
        <div className="bg-green-50 px-3 py-2 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm font-medium text-green-700">{albums.length}</span>
            <span className="text-xs text-green-600">albums</span>
          </div>
        </div>
      </div>
      
      {/* Upload Button */}
      <button
        onClick={onUploadClick}
        className="flex items-center space-x-2 bg-primary-600 text-white px-5 py-2.5 rounded-lg hover:bg-primary-700 transition-all duration-200 shadow-sm hover:shadow-md font-medium"
      >
        <Plus className="w-4 h-4" />
        <span>Upload Images</span>
      </button>
    </div>
  </div>
);

interface ImagesProps {
  headerContent?: React.ReactNode;
  onDataChange?: (images: Image[], albums: Album[]) => void;
  showUploadModal?: boolean;
  setShowUploadModal?: (show: boolean) => void;
}

export const Images: React.FC<ImagesProps> = ({ headerContent, onDataChange, showUploadModal: propShowUploadModal, setShowUploadModal: propSetShowUploadModal }) => {
  const navigate = useNavigate();
  const { alerts, removeAlert, success, error: showError, warning, info } = useAlert();
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

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [imagesResponse, albumsResponse] = await Promise.all([
        apiService.getImages(),
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

  const handleUploadComplete = (newImages: Image[]) => {
    setImages(prev => [...prev, ...newImages]);
    // Refresh albums to update image counts
    loadAlbums();
    
    if (newImages.length > 0) {
      success(
        'Images Uploaded Successfully',
        `${newImages.length} image${newImages.length !== 1 ? 's' : ''} uploaded successfully`
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

  const handleCreateAlbum = async (name: string) => {
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
    <div className="p-6 bg-gray-50 min-h-full">
      {/* Page Header - only show if not using custom header content */}
      {!headerContent && (
        <div className="mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Image Management</h1>
              <p className="text-gray-600">
                {images.length} images • {albums.length} albums
              </p>
            </div>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center space-x-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Upload Images</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        <div className="flex gap-6">
        {/* Left Sidebar - Albums */}
        <div className="w-80 bg-white rounded-lg shadow-sm border border-gray-200 flex-shrink-0">
          <div className="p-4">
            {/* Sidebar Header */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Albums</h2>
              <p className="text-sm text-gray-500 mt-1">Filter and manage your image collections</p>
            </div>

            {/* Album Management */}
            <div className="mb-6">
              <AlbumManager
                albums={albums}
                images={images}
                onCreateAlbum={handleCreateAlbum}
                onUpdateAlbum={handleUpdateAlbum}
                onDeleteAlbum={handleDeleteAlbum}
                onSelectAlbum={setSelectedAlbum}
                selectedAlbum={selectedAlbum}
              />
            </div>

            {/* Album Filter */}
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Filter by Album</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedAlbum(null)}
                  onDragOver={handleSidebarDragOver}
                  onDrop={(e) => handleSidebarDrop(e, null)}
                  onDragEnter={() => setDragOverAlbum(null)}
                  onDragLeave={() => setDragOverAlbum(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                    !selectedAlbum 
                      ? 'bg-primary-100 text-primary-700' 
                      : dragOverAlbum === null
                      ? 'bg-blue-50 border-2 border-dashed border-blue-300 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  All Images ({images.length})
                </button>
                <button
                  onClick={() => setSelectedAlbum({ id: 'no-album', name: 'Not in Album' } as any)}
                  onDragOver={handleSidebarDragOver}
                  onDrop={(e) => handleSidebarDrop(e, 'no-album')}
                  onDragEnter={() => setDragOverAlbum('no-album')}
                  onDragLeave={() => setDragOverAlbum(null)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                    selectedAlbum?.id === 'no-album' 
                      ? 'bg-primary-100 text-primary-700' 
                      : dragOverAlbum === 'no-album'
                      ? 'bg-blue-50 border-2 border-dashed border-blue-300 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  Not in Album ({images.filter(img => !img.album_id).length})
                </button>
                {albums.map(album => (
                  <button
                    key={album.id}
                    onClick={() => setSelectedAlbum(album)}
                    onDragOver={handleSidebarDragOver}
                    onDrop={(e) => handleSidebarDrop(e, album.id)}
                    onDragEnter={() => setDragOverAlbum(album.id)}
                    onDragLeave={() => setDragOverAlbum(null)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all duration-200 ${
                      selectedAlbum?.id === album.id 
                        ? 'bg-primary-100 text-primary-700' 
                        : dragOverAlbum === album.id
                        ? 'bg-blue-50 border-2 border-dashed border-blue-300 text-blue-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {album.name} ({images.filter(img => img.album_id === album.id).length})
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-6">
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
          
          {/* Drag Overlay */}
          {dragOverAlbum !== null && (
            <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-400 flex items-center justify-center pointer-events-none">
              <div className="bg-white rounded-lg shadow-lg p-4 flex items-center space-x-3">
                <Folder className="w-6 h-6 text-blue-600" />
                <span className="text-blue-700 font-medium">
                  Drop to move to {dragOverAlbum === 'no-album' ? 'Not in Album' : 
                    dragOverAlbum === null ? 'All Images' : 
                    albums.find(a => a.id === dragOverAlbum)?.name || 'Album'}
                </span>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Upload Images</h3>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <ImageUpload
              onUploadComplete={(newImages) => {
                handleUploadComplete(newImages);
                setShowUploadModal(false);
              }}
              selectedAlbumId={selectedAlbum?.id}
              albums={albums}
              onCreateAlbum={handleCreateAlbum}
            />
          </div>
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

      {/* Alerts */}
      <AlertContainer alerts={alerts} onRemove={removeAlert} />
    </div>
  );
};

export default Images;
