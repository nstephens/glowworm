import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, CheckCircle, AlertCircle, Image as ImageIcon, Folder, Plus, AlertTriangle } from 'lucide-react';
import { apiService } from '../services/api';
import { calculateFileHash } from '../utils/fileHash';
import type { Image, Album } from '../types';

interface ImageUploadProps {
  onUploadComplete?: (images: Image[]) => void;
  selectedAlbumId?: number;
  albums?: Album[];
  onCreateAlbum?: (name: string) => Promise<Album>;
}

interface UploadFile {
  file: File;
  id: string;
  status: 'pending' | 'checking' | 'duplicate' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
  image?: Image;
  fileHash?: string;
  isDuplicate?: boolean;
  existingImage?: Image;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  onUploadComplete,
  selectedAlbumId,
  albums = [],
  onCreateAlbum
}) => {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentAlbumId, setCurrentAlbumId] = useState<number | null>(selectedAlbumId || null);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'checking',
      progress: 0
    }));

    setUploadFiles(prev => [...prev, ...newFiles]);

    // Check for duplicates for each file
    for (const uploadFile of newFiles) {
      try {
        // Calculate file hash
        const fileHash = await calculateFileHash(uploadFile.file);
        
        // Check for duplicates
        const duplicateCheck = await apiService.checkDuplicateImage(fileHash);
        console.log('Duplicate check response:', duplicateCheck);
        
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { 
                ...f, 
                status: duplicateCheck.is_duplicate ? 'duplicate' : 'pending',
                fileHash,
                isDuplicate: duplicateCheck.is_duplicate,
                existingImage: duplicateCheck.existing_image
              }
            : f
        ));
      } catch (error) {
        console.error('Error checking for duplicates:', error);
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'pending', error: 'Failed to check for duplicates' }
            : f
        ));
      }
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp', '.bmp', '.tiff']
    },
    multiple: true,
    maxSize: 15 * 1024 * 1024, // 15MB limit
    disabled: isUploading
  });

  const uploadFile = async (uploadFile: UploadFile) => {
    const formData = new FormData();
    formData.append('file', uploadFile.file);
    console.log('Uploading file with currentAlbumId:', currentAlbumId);
    if (currentAlbumId) {
      formData.append('album_id', currentAlbumId.toString());
      console.log('Added album_id to FormData:', currentAlbumId);
    } else {
      console.log('No album selected, uploading to root');
    }

    try {
      setUploadFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'uploading', progress: 0 }
          : f
      ));

      const response = await apiService.uploadImage(formData);
      
      setUploadFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'success', progress: 100, image: response.data }
          : f
      ));

      return response.data;
    } catch (error: any) {
      setUploadFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'error', error: error.message || 'Upload failed' }
          : f
      ));
      throw error;
    }
  };

  const handleUpload = async () => {
    const pendingFiles = uploadFiles.filter(f => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);
    const uploadedImages: Image[] = [];

    try {
      for (const file of pendingFiles) {
        try {
          const image = await uploadFile(file);
          if (image) uploadedImages.push(image);
        } catch (error) {
          console.error('Upload failed for file:', file.file.name, error);
        }
      }

      if (uploadedImages.length > 0 && onUploadComplete) {
        onUploadComplete(uploadedImages);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (fileId: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const clearAll = () => {
    setUploadFiles([]);
  };

  const handleCreateAlbum = async () => {
    if (!newAlbumName.trim() || !onCreateAlbum) return;
    
    try {
      setIsCreatingAlbum(true);
      const newAlbum = await onCreateAlbum(newAlbumName.trim());
      setCurrentAlbumId(newAlbum.id);
      setNewAlbumName('');
      setShowCreateAlbum(false);
    } catch (error: any) {
      alert('Failed to create album: ' + (error.message || 'Unknown error'));
    } finally {
      setIsCreatingAlbum(false);
    }
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'uploading':
        return <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />;
      case 'checking':
        return <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />;
      case 'duplicate':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <ImageIcon className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (status: UploadFile['status']) => {
    switch (status) {
      case 'success':
        return 'Uploaded';
      case 'error':
        return 'Failed';
      case 'uploading':
        return 'Uploading...';
      case 'checking':
        return 'Checking for duplicates...';
      case 'duplicate':
        return 'Duplicate detected';
      default:
        return 'Ready';
    }
  };

  const pendingCount = uploadFiles.filter(f => f.status === 'pending').length;
  const successCount = uploadFiles.filter(f => f.status === 'success').length;
  const errorCount = uploadFiles.filter(f => f.status === 'error').length;
  const duplicateCount = uploadFiles.filter(f => f.status === 'duplicate').length;

  return (
    <div className="space-y-6">
      {/* Album Selection */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center space-x-2 mb-3">
          <Folder className="w-5 h-5 text-gray-500" />
          <h3 className="font-medium text-gray-900">Destination Album</h3>
        </div>
        
        <div className="flex items-center space-x-3">
          <select
            value={currentAlbumId || ''}
            onChange={(e) => {
              const albumId = e.target.value ? parseInt(e.target.value) : null;
              setCurrentAlbumId(albumId);
              setShowCreateAlbum(false);
            }}
            className="input-field flex-1"
          >
            <option value="">No album (upload to root)</option>
            {albums.map(album => (
              <option key={album.id} value={album.id}>
                {album.name}
              </option>
            ))}
          </select>
          
          {onCreateAlbum && (
            <button
              onClick={() => setShowCreateAlbum(!showCreateAlbum)}
              className="btn-secondary flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>New Album</span>
            </button>
          )}
        </div>
        
        {/* Create New Album Form */}
        {showCreateAlbum && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <input
                type="text"
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                placeholder="Enter album name..."
                className="input-field flex-1"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateAlbum();
                  }
                }}
              />
              <button
                onClick={handleCreateAlbum}
                disabled={!newAlbumName.trim() || isCreatingAlbum}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingAlbum ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setShowCreateAlbum(false);
                  setNewAlbumName('');
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Upload Area */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive 
            ? 'border-primary-500 bg-primary-50' 
            : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
          }
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {isDragActive ? 'Drop images here' : 'Drag & drop images here'}
        </h3>
        <p className="text-gray-500 mb-4">
          or click to select files
        </p>
        <p className="text-sm text-gray-400">
          Supports: JPEG, PNG, GIF, WebP, BMP, TIFF (max 15MB each)
        </p>
        {currentAlbumId && (
          <p className="text-sm text-primary-600 mt-2">
            Images will be added to: {albums.find(a => a.id === currentAlbumId)?.name || 'Selected Album'}
          </p>
        )}
      </div>

      {/* Upload Summary */}
      {uploadFiles.length > 0 && (
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-gray-900">Upload Queue</h4>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                {pendingCount} pending, {successCount} uploaded, {errorCount} failed{duplicateCount > 0 && `, ${duplicateCount} duplicates`}
              </span>
              <button
                onClick={clearAll}
                className="text-sm text-gray-500 hover:text-gray-700"
                disabled={isUploading}
              >
                Clear All
              </button>
            </div>
          </div>

          {/* File List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {uploadFiles.map((uploadFile) => (
              <div
                key={uploadFile.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {getStatusIcon(uploadFile.status)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {uploadFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(uploadFile.file.size / 1024 / 1024).toFixed(2)} MB • {getStatusText(uploadFile.status)}
                    </p>
                    {uploadFile.error && (
                      <p className="text-xs text-red-500">{uploadFile.error}</p>
                    )}
                    {uploadFile.status === 'duplicate' && uploadFile.existingImage && (
                      <p className="text-xs text-yellow-600">
                        Already exists: {uploadFile.existingImage.original_filename}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removeFile(uploadFile.id)}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={uploadFile.status === 'uploading'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Upload Button */}
          {pendingCount > 0 && (
            <div className="mt-4 pt-4 border-t">
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUploading ? 'Uploading...' : `Upload ${pendingCount} Image${pendingCount > 1 ? 's' : ''}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImageUpload;
