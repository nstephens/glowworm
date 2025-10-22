import React, { useState } from 'react';
import { 
  Grid, 
  List, 
  Search, 
  FolderPlus,
  Trash2, 
  Copy,
  Download,
  Calendar,
  Filter,
  X,
  ChevronDown,
  SortAsc,
  SortDesc,
  Eye,
  ZoomIn,
  Plus
} from 'lucide-react';
import type { Image, Album } from '../types';
import { ConfirmationModal } from './ConfirmationModal';
import { urlResolver } from '../services/urlResolver';

interface ImageGalleryProps {
  images: Image[];
  albums: Album[];
  selectedAlbum?: number | string | null;
  onImageSelect?: (image: Image) => void;
  onImageDelete?: (image: Image) => void;
  onBulkDelete?: (imageIds: number[]) => void;
  onImageMove?: (image: Image, albumId: number) => void;
  onUploadClick?: () => void;
  loading?: boolean;
}

type ViewMode = 'grid' | 'list';
type SortField = 'name' | 'date' | 'size' | 'dimensions';
type SortOrder = 'asc' | 'desc';

interface FilterState {
  fileTypes: string[];
  minSize: number | null;
  maxSize: number | null;
  dateFrom: string | null;
  dateTo: string | null;
  sortBy: SortField;
  sortOrder: SortOrder;
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  albums,
  selectedAlbum: propSelectedAlbum,
  onImageSelect,
  onImageDelete,
  onBulkDelete,
  onImageMove,
  onUploadClick,
  loading = false
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [targetAlbumId, setTargetAlbumId] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [draggedImage, setDraggedImage] = useState<Image | null>(null);
  const [dragOverAlbum, setDragOverAlbum] = useState<number | string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    fileTypes: [],
    minSize: null,
    maxSize: null,
    dateFrom: null,
    dateTo: null,
    sortBy: 'date',
    sortOrder: 'desc'
  });
  const [showFullSizeModal, setShowFullSizeModal] = useState(false);
  const [fullSizeImage, setFullSizeImage] = useState<Image | null>(null);

  // Helper function to get file extension
  const getFileExtension = (filename: string) => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };

  // Helper function to format file size for comparison
  const getFileSizeInBytes = (fileSize: number) => {
    return fileSize;
  };

  // Filter and sort images
  const filteredAndSortedImages = images.filter(image => {
    const matchesSearch = image.original_filename.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Handle album filtering
    let matchesAlbum = true;
    if (propSelectedAlbum !== null && propSelectedAlbum !== undefined) {
      if (propSelectedAlbum === 'no-album') {
        matchesAlbum = !image.album_id;
      } else {
        matchesAlbum = image.album_id === propSelectedAlbum;
      }
    }

    // Handle file type filtering
    const fileExtension = getFileExtension(image.original_filename);
    const matchesFileType = filters.fileTypes.length === 0 || filters.fileTypes.includes(fileExtension);

    // Handle file size filtering
    const fileSizeInBytes = getFileSizeInBytes(image.file_size);
    const matchesMinSize = !filters.minSize || fileSizeInBytes >= filters.minSize;
    const matchesMaxSize = !filters.maxSize || fileSizeInBytes <= filters.maxSize;

    // Handle date filtering
    const imageDate = new Date(image.uploaded_at);
    const matchesDateFrom = !filters.dateFrom || imageDate >= new Date(filters.dateFrom);
    const matchesDateTo = !filters.dateTo || imageDate <= new Date(filters.dateTo);

    return matchesSearch && matchesAlbum && matchesFileType && matchesMinSize && matchesMaxSize && matchesDateFrom && matchesDateTo;
  }).sort((a, b) => {
    let comparison = 0;
    
    switch (filters.sortBy) {
      case 'name':
        comparison = a.original_filename.localeCompare(b.original_filename);
        break;
      case 'date':
        comparison = new Date(a.uploaded_at).getTime() - new Date(b.uploaded_at).getTime();
        break;
      case 'size':
        comparison = a.file_size - b.file_size;
        break;
      case 'dimensions':
        comparison = (a.width * a.height) - (b.width * b.height);
        break;
    }
    
    return filters.sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleImageSelect = (image: Image, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      // Multi-select
      setSelectedImages(prev => {
        const newSet = new Set(prev);
        if (newSet.has(image.id)) {
          newSet.delete(image.id);
        } else {
          newSet.add(image.id);
        }
        return newSet;
      });
    } else {
      // Single select
      setSelectedImages(new Set([image.id]));
      onImageSelect?.(image);
    }
  };

  const handleSelectAll = () => {
    if (selectedImages.size === filteredAndSortedImages.length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(filteredAndSortedImages.map(img => img.id)));
    }
  };

  const handleMoveToAlbum = () => {
    if (targetAlbumId && selectedImages.size > 0) {
      selectedImages.forEach(imageId => {
        const image = images.find(img => img.id === imageId);
        if (image && onImageMove) {
          onImageMove(image, targetAlbumId);
        }
      });
      setSelectedImages(new Set());
      setShowMoveDialog(false);
      setTargetAlbumId(null);
    }
  };

  const handleBulkDelete = () => {
    if (selectedImages.size === 0 || !onBulkDelete) return;
    setShowDeleteModal(true);
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, image: Image) => {
    setDraggedImage(image);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', image.id.toString());
    
    // Create a custom drag image
    const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
    dragImage.style.transform = 'rotate(5deg)';
    dragImage.style.opacity = '0.8';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  const handleDragEnd = () => {
    setDraggedImage(null);
    setDragOverAlbum(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetAlbumId: number | string | null) => {
    e.preventDefault();
    
    if (!draggedImage) return;
    
    // Don't move if it's the same album
    if (draggedImage.album_id === targetAlbumId) {
      setDraggedImage(null);
      setDragOverAlbum(null);
      return;
    }
    
    // Handle the move operation
    if (onImageMove) {
      onImageMove(draggedImage, targetAlbumId as number);
    }
    
    setDraggedImage(null);
    setDragOverAlbum(null);
  };

  const handleViewFullSize = async (image: Image, e: React.MouseEvent) => {
    e.stopPropagation();
    setFullSizeImage(image);
    setShowFullSizeModal(true);
    
    // Fetch scaled versions
    try {
      const response = await api.getImageScaledVersions(image.id);
      if (response.success && response.data) {
        setFullSizeImage(prev => prev ? {
          ...prev,
          scaledVersions: response.data.scaled_versions
        } : null);
      }
    } catch (error) {
      console.error('Failed to fetch scaled versions:', error);
    }
  };

  const confirmBulkDelete = () => {
    if (onBulkDelete) {
      onBulkDelete(Array.from(selectedImages));
      setSelectedImages(new Set());
    }
    setShowDeleteModal(false);
  };

  const formatFileSize = (bytes: number | null | undefined) => {
    if (!bytes) return 'Unknown';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string | undefined) => {
    return dateString ? new Date(dateString).toLocaleDateString() : "Unknown";
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {/* Loading Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-6 sm:gap-8">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="aspect-square bg-gray-200 animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-gray-200 rounded animate-pulse" />
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white rounded-xl p-4 shadow-sm border border-gray-200 space-y-4 sm:space-y-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
          {/* Search */}
          <div className="relative w-full sm:w-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search images..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 w-full sm:w-64 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-md transition-all ${
                viewMode === 'grid' 
                  ? 'bg-white text-primary-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-md transition-all ${
                viewMode === 'list' 
                  ? 'bg-white text-primary-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center space-x-2 px-3 py-2 rounded-lg transition-all ${
              showFilters 
                ? 'bg-primary-100 text-primary-700' 
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Filters</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {/* Sort Dropdown */}
          <div className="relative">
            <select
              value={`${filters.sortBy}-${filters.sortOrder}`}
              onChange={(e) => {
                const [sortBy, sortOrder] = e.target.value.split('-') as [SortField, SortOrder];
                setFilters(prev => ({ ...prev, sortBy, sortOrder }));
              }}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-3 py-2 pr-8 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent w-full sm:w-auto"
            >
              <option value="date-desc">Newest First</option>
              <option value="date-asc">Oldest First</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="size-desc">Largest First</option>
              <option value="size-asc">Smallest First</option>
              <option value="dimensions-desc">Highest Resolution</option>
              <option value="dimensions-asc">Lowest Resolution</option>
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-4 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              {filteredAndSortedImages.length} image{filteredAndSortedImages.length !== 1 ? 's' : ''}
            </span>
            {selectedImages.size > 0 && (
              <span className="text-sm text-primary-600 font-medium bg-primary-50 px-2 py-1 rounded-full">
                {selectedImages.size} selected
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* File Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">File Types</label>
              <div className="space-y-2">
                {['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].map(type => (
                  <label key={type} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={filters.fileTypes.includes(type)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilters(prev => ({ ...prev, fileTypes: [...prev.fileTypes, type] }));
                        } else {
                          setFilters(prev => ({ ...prev, fileTypes: prev.fileTypes.filter(t => t !== type) }));
                        }
                      }}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 uppercase">{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Date Range</label>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">From</label>
                  <input
                    type="date"
                    value={filters.dateFrom || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value || null }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">To</label>
                  <input
                    type="date"
                    value={filters.dateTo || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value || null }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* File Size Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">File Size</label>
              <div className="space-y-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Min Size (MB)</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={filters.minSize ? filters.minSize / (1024 * 1024) : ''}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      minSize: e.target.value ? parseFloat(e.target.value) * 1024 * 1024 : null 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max Size (MB)</label>
                  <input
                    type="number"
                    placeholder="∞"
                    value={filters.maxSize ? filters.maxSize / (1024 * 1024) : ''}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      maxSize: e.target.value ? parseFloat(e.target.value) * 1024 * 1024 : null 
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <button
                onClick={() => setFilters({
                  fileTypes: [],
                  minSize: null,
                  maxSize: null,
                  dateFrom: null,
                  dateTo: null,
                  sortBy: 'date',
                  sortOrder: 'desc'
                })}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
                <span>Clear Filters</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select All */}
      {filteredAndSortedImages.length > 0 && (
        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={selectedImages.size === filteredAndSortedImages.length}
            onChange={handleSelectAll}
            className="rounded border-gray-300"
          />
          <label className="text-sm text-gray-600">
            Select all ({filteredAndSortedImages.length})
          </label>
        </div>
      )}

      {/* Image Grid/List */}
      {filteredAndSortedImages.length === 0 ? (
        <div className="text-center py-16">
          <div className="relative">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-primary-100 to-primary-200 rounded-2xl flex items-center justify-center">
              <Grid className="w-12 h-12 text-primary-600" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">0</span>
            </div>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchTerm || propSelectedAlbum ? 'No images found' : 'No images yet'}
          </h3>
          <p className="text-gray-500 mb-6 max-w-md mx-auto">
            {searchTerm || propSelectedAlbum 
              ? 'Try adjusting your search terms or filters to find what you\'re looking for.' 
              : 'Upload your first images to get started with your gallery.'
            }
          </p>
          {!searchTerm && !propSelectedAlbum && onUploadClick && (
            <button 
              onClick={onUploadClick}
              className="inline-flex items-center space-x-2 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Upload Images</span>
            </button>
          )}
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-6 sm:gap-8' : 'space-y-3'}>
          {filteredAndSortedImages.map((image) => (
            <div
              key={image.id}
              draggable
              onDragStart={(e) => handleDragStart(e, image)}
              onDragEnd={handleDragEnd}
              className={`
                relative group cursor-grab active:cursor-grabbing rounded-xl overflow-hidden bg-white shadow-sm border transition-all duration-200
                ${selectedImages.has(image.id) 
                  ? 'border-primary-500 ring-2 ring-primary-200 shadow-lg scale-[1.02]' 
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-md hover:scale-[1.01]'
                }
                ${draggedImage?.id === image.id ? 'opacity-50 scale-95 cursor-grabbing' : ''}
                ${viewMode === 'list' ? 'flex items-center space-x-4 p-4' : 'p-0'}
              `}
              onClick={(e) => handleImageSelect(image, e)}
            >
              {/* Image Container */}
              <div className={viewMode === 'grid' ? 'aspect-square relative' : 'w-20 h-20 flex-shrink-0 relative'}>
                <img
                  src={urlResolver.getServerBaseUrl() + image.thumbnail_url}
                  alt={image.original_filename}
                  className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                  loading="lazy"
                  key={`thumb-${image.id}-${image.album_id}`}
                />
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                
                {/* Action Buttons Overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200">
                  <div className="flex space-x-2">
                    <button
                      onClick={(e) => handleViewFullSize(image, e)}
                      className="p-2.5 bg-white/90 backdrop-blur-sm rounded-full text-gray-600 hover:text-blue-600 hover:bg-white shadow-lg transition-all duration-200 hover:scale-110"
                      title="View full size"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        console.log('Delete button clicked for image:', image);
                        e.stopPropagation();
                        onImageDelete?.(image);
                      }}
                      className="p-2.5 bg-white/90 backdrop-blur-sm rounded-full text-gray-600 hover:text-red-600 hover:bg-white shadow-lg transition-all duration-200 hover:scale-110"
                      title="Delete image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Selection Indicator */}
                {selectedImages.has(image.id) && (
                  <div className="absolute top-3 right-3 w-7 h-7 bg-primary-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                    <span className="text-white text-sm font-semibold">
                      {Array.from(selectedImages).indexOf(image.id) + 1}
                    </span>
                  </div>
                )}

                {/* Album Badge */}
                {image.album_id && viewMode === 'grid' && (
                  <div className="absolute bottom-3 left-3">
                    <span className="px-2 py-1 bg-primary-600/90 backdrop-blur-sm text-white text-xs font-medium rounded-full">
                      {albums.find(a => a.id === image.album_id)?.name}
                    </span>
                  </div>
                )}
              </div>

              {/* Image Info */}
              <div className={viewMode === 'grid' ? 'p-4' : 'flex-1 min-w-0'}>
                <h4 className="font-semibold text-gray-900 truncate text-sm mb-1">
                  {image.original_filename}
                </h4>
                <div className="text-xs text-gray-500 space-y-1">
                  <div className="space-y-0.5">
                    <p className="font-medium text-gray-700">{image.width} × {image.height}</p>
                    <p>{formatFileSize(image.file_size)}</p>
                    {/* Placeholder for scaled versions - can be enhanced when backend provides this data */}
                    <p className="text-gray-400 italic">Original resolution</p>
                  </div>
                  <p className="text-gray-400">{formatDate(image.uploaded_at)}</p>
                  {image.album_id && viewMode === 'list' && (
                    <p className="text-primary-600 font-medium">
                      {albums.find(a => a.id === image.album_id)?.name}
                    </p>
                  )}
                </div>
              </div>

              {/* Hover Border Effect */}
              <div className="absolute inset-0 rounded-xl border-2 border-transparent group-hover:border-primary-200 transition-colors duration-200 pointer-events-none" />
            </div>
          ))}
        </div>
      )}

      {/* Bulk Actions */}
      {selectedImages.size > 0 && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 bg-white border border-gray-200 rounded-xl shadow-xl p-4 backdrop-blur-sm bg-white/95">
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-semibold">{selectedImages.size}</span>
              </div>
              <span className="text-sm font-semibold text-gray-900">
                {selectedImages.size} image{selectedImages.size !== 1 ? 's' : ''} selected
              </span>
            </div>
            <div className="flex space-x-2 w-full sm:w-auto">
              <button 
                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex-1 sm:flex-none justify-center"
                onClick={() => setShowMoveDialog(true)}
              >
                <FolderPlus className="w-4 h-4" />
                <span>Move</span>
              </button>
              <button className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex-1 sm:flex-none justify-center">
                <Copy className="w-4 h-4" />
                <span>Copy</span>
              </button>
              <button className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex-1 sm:flex-none justify-center">
                <Download className="w-4 h-4" />
                <span>Download</span>
              </button>
              <button 
                className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex-1 sm:flex-none justify-center"
                onClick={handleBulkDelete}
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move to Album Dialog */}
      {showMoveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Move {selectedImages.size} image{selectedImages.size !== 1 ? 's' : ''} to Album
            </h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Album
              </label>
              <select
                value={targetAlbumId || ''}
                onChange={(e) => setTargetAlbumId(e.target.value ? parseInt(e.target.value) : null)}
                className="input-field w-full"
              >
                <option value="">Choose an album...</option>
                {albums.map((album) => (
                  <option key={album.id} value={album.id}>
                    {album.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowMoveDialog(false);
                  setTargetAlbumId(null);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleMoveToAlbum}
                disabled={!targetAlbumId}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Move Images
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={confirmBulkDelete}
        title="Delete Images"
        message={(() => {
          const imageNames = Array.from(selectedImages)
            .map(id => images.find(img => img.id === id)?.original_filename)
            .filter(Boolean)
            .slice(0, 3);
          
          const displayText = imageNames.length === selectedImages.size 
            ? imageNames.join(', ')
            : `${imageNames.join(', ')} and ${selectedImages.size - imageNames.length} more`;
          
          return `Are you sure you want to permanently delete ${selectedImages.size} image(s)? This action cannot be undone.\n\n${displayText}`;
        })()}
        confirmText="Delete Images"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Full Size Image Modal */}
      {showFullSizeModal && fullSizeImage && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-7xl max-h-full w-full h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 text-white">
              <div className="flex items-center space-x-4">
                <h3 className="text-xl font-semibold truncate max-w-md">
                  {fullSizeImage.original_filename}
                </h3>
                <div className="flex items-center space-x-2 text-sm text-gray-300">
                  <span>{fullSizeImage.width} × {fullSizeImage.height}</span>
                  <span>•</span>
                  <span>{(fullSizeImage.file_size / (1024 * 1024)).toFixed(1)} MB</span>
                </div>
              </div>
              <button
                onClick={() => setShowFullSizeModal(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
                title="Close"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Image Container */}
            <div className="flex-1 flex items-center justify-center min-h-0">
              <div className="relative max-w-full max-h-full">
                <img
                  src={fullSizeImage.url}
                  alt={fullSizeImage.original_filename}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  style={{ maxHeight: 'calc(100vh - 120px)' }}
                />
                
                {/* Zoom indicator */}
                <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm flex items-center space-x-2">
                  <ZoomIn className="w-4 h-4" />
                  <span>Full Size</span>
                </div>
              </div>
            </div>

            {/* Footer with image details */}
            <div className="mt-4 text-white text-sm">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <span className="text-gray-400 block">Filename:</span>
                    <div className="font-medium truncate">{fullSizeImage.original_filename}</div>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Dimensions:</span>
                    <div className="font-medium">{fullSizeImage.width} × {fullSizeImage.height}</div>
                  </div>
                  <div>
                    <span className="text-gray-400 block">File Size:</span>
                    <div className="font-medium">{(fullSizeImage.file_size / (1024 * 1024)).toFixed(1)} MB</div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-gray-400 block">Uploaded:</span>
                    <div className="font-medium">
                      {new Date(fullSizeImage.uploaded_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400 block">Available Sizes:</span>
                    <div className="font-medium text-gray-300">
                      <div className="mb-1">Original: {fullSizeImage.width} × {fullSizeImage.height}</div>
                      {fullSizeImage.scaledVersions && fullSizeImage.scaledVersions.length > 0 ? (
                        fullSizeImage.scaledVersions.map((version, index) => (
                          <div key={index} className="text-sm">
                            {version.dimensions}
                          </div>
                        ))
                      ) : (
                        <div className="text-sm italic text-gray-500">
                          Scaled versions will appear here when generated
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageGallery;
