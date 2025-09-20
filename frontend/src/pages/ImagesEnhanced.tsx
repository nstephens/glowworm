import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Grid, Folder, ArrowLeft } from 'lucide-react';
import ImageUpload from '../components/ImageUpload';
import ImageGallery from '../components/ImageGallery';
import { AlbumManagerEnhanced } from '../components/AlbumManagerEnhanced';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { apiService } from '../services/api';
import type { Image, Album } from '../types';

type TabType = 'upload' | 'gallery' | 'albums';

export const ImagesEnhanced: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('gallery');
  const [images, setImages] = useState<Image[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<Image | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, []);

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
      setError(err.message || 'Failed to load data');
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUploadComplete = (newImages: Image[]) => {
    setImages(prev => [...prev, ...newImages]);
    // Refresh albums to update image counts
    loadAlbums();
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
    } catch (err: any) {
      throw new Error(err.message || 'Failed to create album');
    }
  };

  const handleUpdateAlbum = async (id: number, name: string) => {
    try {
      const response = await apiService.updateAlbum(id, name);
      setAlbums(prev => prev.map(album => 
        album.id === id ? response.data : album
      ));
    } catch (err: any) {
      throw new Error(err.message || 'Failed to update album');
    }
  };

  const handleDeleteAlbum = async (id: number) => {
    try {
      await apiService.deleteAlbum(id);
      setAlbums(prev => prev.filter(album => album.id !== id));
      // If the deleted album was selected, clear selection
      if (selectedAlbum?.id === id) {
        setSelectedAlbum(null);
      }
    } catch (err: any) {
      throw new Error(err.message || 'Failed to delete album');
    }
  };

  const handleReorderAlbums = async (reorderedAlbums: Album[]) => {
    try {
      const albumIds = reorderedAlbums.map(album => album.id);
      await apiService.reorderAlbums(albumIds);
      setAlbums(reorderedAlbums);
    } catch (err: any) {
      console.error('Failed to reorder albums:', err);
      // Revert the order on error
      loadAlbums();
    }
  };

  const handleImageSelect = (image: Image) => {
    console.log('Selected image:', image);
    // TODO: Implement image preview/modal
  };

  const handleImageEdit = (image: Image) => {
    console.log('Edit image:', image);
    // TODO: Implement image editing modal
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
    } catch (err: any) {
      console.error('Failed to delete image:', err);
      alert('Failed to delete image: ' + (err.message || 'Unknown error'));
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
    } catch (err: any) {
      console.error('Failed to bulk delete images:', err);
      alert('Failed to delete some images: ' + (err.message || 'Unknown error'));
    }
  };

  const handleImageMove = async (image: Image, albumId: number) => {
    try {
      await apiService.updateImage(image.id, { album_id: albumId });
      setImages(prev => prev.map(img => 
        img.id === image.id ? { ...img, album_id: albumId } : img
      ));
    } catch (err: any) {
      console.error('Failed to move image:', err);
      alert('Failed to move image: ' + (err.message || 'Unknown error'));
    }
  };

  const tabs = [
    { id: 'upload' as TabType, label: 'Upload', icon: Upload },
    { id: 'gallery' as TabType, label: 'Gallery', icon: Grid },
    { id: 'albums' as TabType, label: 'Albums', icon: Folder },
  ];

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

  const handleBackToDashboard = () => {
    navigate('/admin');
  };

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
            <h1 className="text-2xl font-bold text-gray-900">Image Management</h1>
            <p className="text-gray-600">
              Upload, organize, and manage your images with enhanced features
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-500">
            {images.length} images • {albums.length} albums
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm
                  ${activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'upload' && (
          <div className="max-w-4xl">
            <ImageUpload
              onUploadComplete={handleUploadComplete}
              selectedAlbumId={selectedAlbum?.id}
              albums={albums}
            />
          </div>
        )}

        {activeTab === 'gallery' && (
          <div className="space-y-6">
            {/* Album Selector */}
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">
                Filter by album:
              </label>
              <select
                value={selectedAlbum?.id || ''}
                onChange={(e) => {
                  const albumId = e.target.value ? parseInt(e.target.value) : null;
                  const album = albumId ? albums.find(a => a.id === albumId) || null : null;
                  setSelectedAlbum(album);
                }}
                className="input-field w-48"
              >
                <option value="">All Images</option>
                {albums.map(album => (
                  <option key={album.id} value={album.id}>
                    {album.name} ({images.filter(img => img.album_id === album.id).length})
                  </option>
                ))}
              </select>
            </div>

            <ImageGallery
              images={images}
              albums={albums}
              onImageSelect={handleImageSelect}
              onImageEdit={handleImageEdit}
              onImageDelete={handleImageDelete}
              onBulkDelete={handleBulkDelete}
              onImageMove={handleImageMove}
            />
          </div>
        )}

        {activeTab === 'albums' && (
          <div className="max-w-2xl">
            <AlbumManagerEnhanced
              albums={albums}
              images={images}
              onCreateAlbum={handleCreateAlbum}
              onUpdateAlbum={handleUpdateAlbum}
              onDeleteAlbum={handleDeleteAlbum}
              onReorderAlbums={handleReorderAlbums}
              onSelectAlbum={setSelectedAlbum}
              selectedAlbum={selectedAlbum}
            />
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
      </div>
    </div>
  );
};

export default ImagesEnhanced;





