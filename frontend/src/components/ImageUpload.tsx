import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, CheckCircle, AlertCircle, Image as ImageIcon, Folder, Plus, AlertTriangle, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { apiService } from '../services/api';
import { calculateFileHash } from '../utils/fileHash';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { cn } from '../lib/utils';
import type { Image, Album } from '../types';
import AnimatedProgressCard from './AnimatedProgressCard';
import UploadProgressHeader from './UploadProgressHeader';
import SuccessAnimation from './SuccessAnimation';
import { DuplicateConfirmationDialog } from './DuplicateConfirmationDialog';

interface ImageUploadProps {
  onUploadComplete?: (images: Image[]) => void;
  selectedAlbumId?: number;
  albums?: Album[];
  onCreateAlbum?: (name: string) => Promise<Album>;
}

interface UploadFile {
  file: File;
  id: string;
  status: 'pending' | 'checking' | 'duplicate' | 'uploading' | 'processing' | 'success' | 'error';
  progress?: number;
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
  const { isMobile } = useResponsiveLayout();
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [currentAlbumId, setCurrentAlbumId] = useState<number | null>(selectedAlbumId || null);
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [newAlbumName, setNewAlbumName] = useState('');
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicates, setDuplicates] = useState<Array<{
    fileHash: string;
    filename: string;
    existingImage: Image;
  }>>([]);
  const [proceedWithDuplicates, setProceedWithDuplicates] = useState(false);
  const [maxConcurrent, setMaxConcurrent] = useState(5); // Increased from 2 to 5 for faster uploads

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Immediately add files to state so picker can close
    const newFiles: UploadFile[] = acceptedFiles.map(file => ({
      file,
      id: Math.random().toString(36).substr(2, 9),
      status: 'checking',
      progress: 0
    }));

    setUploadFiles(prev => [...prev, ...newFiles]);

    // Process files asynchronously in background (non-blocking)
    // This allows the native picker to close immediately
    (async () => {
      try {
        // Calculate file hashes for all files
        const fileHashPromises = newFiles.map(async (uploadFile) => {
          const fileHash = await calculateFileHash(uploadFile.file);
          return { uploadFile, fileHash };
        });

        const fileHashResults = await Promise.all(fileHashPromises);
        
        // Update files with their hashes
        setUploadFiles(prev => prev.map(f => {
          const hashResult = fileHashResults.find(r => r.uploadFile.id === f.id);
          return hashResult ? { ...f, fileHash: hashResult.fileHash } : f;
        }));

        // Batch check for duplicates
        const fileHashes = fileHashResults.map(r => r.fileHash);
        const duplicateCheckResults = await apiService.checkDuplicatesBatch(fileHashes);
        
        // Process results
        const duplicatesFound: Array<{
          fileHash: string;
          filename: string;
          existingImage: Image;
        }> = [];

        setUploadFiles(prev => prev.map(f => {
          const hashResult = fileHashResults.find(r => r.uploadFile.id === f.id);
          if (!hashResult) return f;

          const result = duplicateCheckResults.results[hashResult.fileHash];
          if (result.is_duplicate) {
            duplicatesFound.push({
              fileHash: hashResult.fileHash,
              filename: f.file.name,
              existingImage: result.existing_image!
            });
          }

          return {
            ...f,
            status: result.is_duplicate ? 'duplicate' : 'pending',
            isDuplicate: result.is_duplicate,
            existingImage: result.existing_image
          };
        }));

        // Show duplicate confirmation dialog if duplicates found
        if (duplicatesFound.length > 0) {
          setDuplicates(duplicatesFound);
          setShowDuplicateDialog(true);
        }
      } catch (error) {
        console.error('Error checking for duplicates:', error);
        setUploadFiles(prev => prev.map(f => 
          f.status === 'checking' 
            ? { ...f, status: 'pending', error: 'Failed to check for duplicates' }
            : f
        ));
      }
    })();
  }, []);

  const handleDuplicateConfirmation = (proceedWithDuplicates: boolean) => {
    setProceedWithDuplicates(proceedWithDuplicates);
    setShowDuplicateDialog(false);
    
    // Update file statuses based on user choice
    setUploadFiles(prev => prev.map(f => {
      if (f.isDuplicate && !proceedWithDuplicates) {
        return { ...f, status: 'error', error: 'Skipped - duplicate' };
      }
      return f;
    }));
  };

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

  const uploadWithRetry = async (file: UploadFile, maxRetries: number = 3): Promise<Image | null> => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Exponential backoff: 0ms, 1000ms, 2000ms, 4000ms
        if (attempt > 0) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`Retrying upload for ${file.file.name} (attempt ${attempt + 1}/${maxRetries + 1}) after ${delay}ms delay`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Update status to show retry attempt
        if (attempt > 0) {
          setUploadFiles(prev => 
            prev.map(f => 
              f.id === file.id 
                ? { ...f, status: 'processing' as const, progress: 0, error: `Retrying... (${attempt}/${maxRetries})` }
                : f
            )
          );
        }

        const image = await uploadFile(file);
        return image;
      } catch (error) {
        lastError = error as Error;
        console.error(`Upload attempt ${attempt + 1} failed for ${file.file.name}:`, error);
        
        // Update status to show retry attempt
        setUploadFiles(prev => 
          prev.map(f => 
            f.id === file.id 
              ? { ...f, status: 'processing' as const, error: `Retry ${attempt + 1}/${maxRetries + 1} failed` }
              : f
          )
        );
      }
    }

    // All retries failed
    console.error(`All upload attempts failed for ${file.file.name}:`, lastError);
    setUploadFiles(prev => 
      prev.map(f => 
        f.id === file.id 
          ? { ...f, status: 'error' as const, error: lastError?.message || 'Upload failed after all retries' }
          : f
      )
    );
    return null;
  };

  const handleUpload = async () => {
    // Filter files to upload based on user's duplicate choice
    const filesToUpload = uploadFiles.filter(f => {
      if (f.status === 'pending') return true;
      if (f.status === 'duplicate' && proceedWithDuplicates) return true;
      return false;
    });
    
    if (filesToUpload.length === 0) return;

    setIsUploading(true);
    const uploadedImages: Image[] = [];
    
    // Intelligent concurrency limiting based on file count
    // Use higher concurrency for mobile and local WiFi uploads
    const smartConcurrency = Math.min(
      maxConcurrent, 
      filesToUpload.length
    );

    console.log(`Starting upload of ${filesToUpload.length} files with concurrency: ${smartConcurrency}`);

    try {
      // Process all uploads concurrently with controlled concurrency
      const uploadPromises = filesToUpload.map(async (file) => {
        try {
          // Set to processing status
          setUploadFiles(prev => 
            prev.map(f => 
              f.id === file.id 
                ? { ...f, status: 'processing' as const, progress: 0 }
                : f
            )
          );

          const image = await uploadWithRetry(file);
          if (image) {
            uploadedImages.push(image);
          }
          return { success: true, file: file.id };
        } catch (error) {
          console.error(`Error uploading ${file.file.name}:`, error);
          // Mark file as error if not already marked
          setUploadFiles(prev => 
            prev.map(f => 
              f.id === file.id && f.status !== 'error'
                ? { ...f, status: 'error' as const, error: error instanceof Error ? error.message : 'Upload failed' }
                : f
            )
          );
          return { success: false, file: file.id, error };
        }
      });

      // Process with controlled concurrency
      const results = [];
      for (let i = 0; i < uploadPromises.length; i += smartConcurrency) {
        const batch = uploadPromises.slice(i, i + smartConcurrency);
        const batchResults = await Promise.allSettled(batch);
        
        const successCount = batchResults.filter(r => r.status === 'fulfilled' && r.value?.success).length;
        const failCount = batchResults.length - successCount;
        console.log(`Upload batch ${Math.floor(i / smartConcurrency) + 1}: ${successCount} succeeded, ${failCount} failed`);
        
        results.push(...batchResults);
      }
      
      const finalSuccess = results.filter(r => r.status === 'fulfilled' && r.value?.success).length;
      const finalFail = results.length - finalSuccess;
      console.log(`All uploads complete: ${finalSuccess} succeeded, ${finalFail} failed`);

      // Always call onUploadComplete if any images were uploaded
      if (uploadedImages.length > 0 && onUploadComplete) {
        onUploadComplete(uploadedImages);
        // Trigger success animation
        setShowSuccessAnimation(true);
      }
      
    } catch (error) {
      console.error('Fatal error during upload process:', error);
      // Mark all pending files as error
      setUploadFiles(prev => 
        prev.map(f => 
          f.status === 'pending' || f.status === 'processing'
            ? { ...f, status: 'error' as const, error: error instanceof Error ? error.message : 'Upload process failed' }
            : f
        )
      );
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

  const retryFailed = async () => {
    const failedFiles = uploadFiles.filter(f => f.status === 'error');
    if (failedFiles.length === 0) return;

    console.log(`Retrying ${failedFiles.length} failed uploads...`);
    
    setIsUploading(true);
    const uploadedImages: Image[] = [];

    try {
      // Reset failed files to pending
      setUploadFiles(prev => 
        prev.map(f => 
          f.status === 'error' 
            ? { ...f, status: 'pending' as const, error: undefined }
            : f
        )
      );

      // Retry all failed files with controlled concurrency
      const retryConcurrency = Math.min(5, failedFiles.length);
      
      const retryPromises = failedFiles.map(async (file) => {
        try {
          setUploadFiles(prev => 
            prev.map(f => 
              f.id === file.id 
                ? { ...f, status: 'processing' as const, progress: 0 }
                : f
            )
          );

          const image = await uploadWithRetry(file);
          if (image) {
            uploadedImages.push(image);
          }
          return { success: true, file: file.id };
        } catch (error) {
          return { success: false, file: file.id, error };
        }
      });

      // Process with controlled concurrency
      for (let i = 0; i < retryPromises.length; i += retryConcurrency) {
        const batch = retryPromises.slice(i, i + retryConcurrency);
        await Promise.allSettled(batch);
      }

      if (uploadedImages.length > 0 && onUploadComplete) {
        onUploadComplete(uploadedImages);
        setShowSuccessAnimation(true);
      }
    } finally {
      setIsUploading(false);
    }
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
      case 'processing':
        return 'Processing...';
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
    <div className={cn("space-y-6", isMobile && "space-y-4")}>
      {/* Album Selection */}
      <div className={cn(
        "bg-white rounded-lg border",
        isMobile ? "p-3" : "p-4"
      )}>
        <div className={cn(
          "flex items-center space-x-2",
          isMobile ? "mb-2" : "mb-3"
        )}>
          <Folder className={cn(
            isMobile ? "w-4 h-4" : "w-5 h-5",
            "text-gray-500"
          )} />
          <h3 className={cn(
            "font-medium text-gray-900",
            isMobile ? "text-base" : "text-lg"
          )}>Destination Album</h3>
        </div>
        
        <div className={cn(
          "flex items-center",
          isMobile ? "flex-col space-y-2" : "space-x-3"
        )}>
          <select
            value={currentAlbumId || ''}
            onChange={(e) => {
              const albumId = e.target.value ? parseInt(e.target.value) : null;
              setCurrentAlbumId(albumId);
              setShowCreateAlbum(false);
            }}
            className={cn(
              "input-field flex-1",
              isMobile && "text-base h-12" // Prevent zoom on iOS
            )}
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
              className={cn(
                "btn-secondary flex items-center space-x-2",
                isMobile && "w-full h-12 justify-center"
              )}
            >
              <Plus className={cn(isMobile ? "w-5 h-5" : "w-4 h-4")} />
              <span>New Album</span>
            </button>
          )}
        </div>
        
        {/* Create New Album Form */}
        {showCreateAlbum && (
          <div className={cn(
            "mt-3 bg-gray-50 rounded-lg",
            isMobile ? "p-2" : "p-3"
          )}>
            <div className={cn(
              "flex items-center",
              isMobile ? "flex-col space-y-2" : "space-x-3"
            )}>
              <input
                type="text"
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                placeholder="Enter album name..."
                className={cn(
                  "input-field flex-1",
                  isMobile && "text-base h-12"
                )}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateAlbum();
                  }
                }}
              />
              <button
                onClick={handleCreateAlbum}
                disabled={!newAlbumName.trim() || isCreatingAlbum}
                className={cn(
                  "btn-primary disabled:opacity-50 disabled:cursor-not-allowed",
                  isMobile && "w-full h-12"
                )}
              >
                {isCreatingAlbum ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => {
                  setShowCreateAlbum(false);
                  setNewAlbumName('');
                }}
                className={cn(
                  "btn-secondary",
                  isMobile && "w-full h-12"
                )}
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
        className={cn(
          "border-2 border-dashed rounded-lg text-center cursor-pointer transition-colors",
          isMobile ? "p-6" : "p-8",
          isDragActive 
            ? 'border-primary-500 bg-primary-50' 
            : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50',
          isUploading && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />
        <Upload className={cn(
          "mx-auto mb-4 text-gray-400",
          isMobile ? "w-10 h-10" : "w-12 h-12"
        )} />
        <h3 className={cn(
          "font-medium text-gray-900",
          isMobile ? "text-base mb-2" : "text-lg mb-2"
        )}>
          {isDragActive ? 'Drop images here' : isMobile ? 'Tap to select photos' : 'Drag & drop images here'}
        </h3>
        <p className={cn(
          "text-gray-500",
          isMobile ? "mb-3 text-sm" : "mb-4"
        )}>
          {isMobile ? 'Select multiple photos from your library' : 'or click to select files'}
        </p>
        <p className={cn(
          "text-gray-400",
          isMobile ? "text-xs" : "text-sm"
        )}>
          Supports: JPEG, PNG, GIF, WebP, BMP, TIFF (max 15MB each)
        </p>
        {currentAlbumId && (
          <p className={cn(
            "text-primary-600 mt-2",
            isMobile ? "text-xs" : "text-sm"
          )}>
            Images will be added to: {albums.find(a => a.id === currentAlbumId)?.name || 'Selected Album'}
          </p>
        )}
      </div>

      {/* Upload Settings */}
      {uploadFiles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "bg-gray-50 rounded-lg mb-4",
            isMobile ? "p-3" : "p-4"
          )}
        >
          <div className={cn(
            isMobile ? "space-y-2" : "flex items-center justify-between"
          )}>
            <div className="flex items-center gap-2">
              <Settings className={cn(
                isMobile ? "h-4 w-4" : "h-4 w-4",
                "text-gray-500"
              )} />
              <span className={cn(
                "font-medium text-gray-700",
                isMobile ? "text-sm" : "text-sm"
              )}>Upload Settings</span>
            </div>
            <div className={cn(
              "flex items-center gap-2",
              isMobile && "w-full"
            )}>
              <label className={cn(
                isMobile ? "text-xs" : "text-sm",
                "text-gray-600"
              )}>Concurrent uploads:</label>
              <select
                value={maxConcurrent}
                onChange={(e) => setMaxConcurrent(parseInt(e.target.value))}
                disabled={isUploading}
                className={cn(
                  "border border-gray-300 rounded bg-white",
                  isMobile ? "text-sm px-2 py-2 h-10 flex-1" : "text-sm px-2 py-1"
                )}
              >
                <option value={1}>1 (Slowest)</option>
                <option value={2}>2 (Recommended)</option>
                <option value={3}>3</option>
                <option value={5}>5 (Fast)</option>
                <option value={8}>8 (Very Fast)</option>
                <option value={10}>10 (Fastest)</option>
              </select>
            </div>
          </div>
          <p className={cn(
            "text-gray-500",
            isMobile ? "text-xs mt-1" : "text-xs mt-1"
          )}>
            Higher values upload faster but may overwhelm the server. Recommended: 2-3 for most cases.
          </p>
        </motion.div>
      )}

      {/* Animated Upload Progress */}
      {uploadFiles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Upload Buttons - Moved to top for mobile accessibility */}
          <div className="space-y-2">
            {/* Upload Button */}
            {pendingCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="upload-button-mobile"
              >
                <button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className={cn(
                    "w-full bg-primary text-primary-foreground font-medium py-3 px-4 rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md hover:shadow-lg",
                    isMobile && "h-12"
                  )}
                >
                  {isUploading ? 'Uploading...' : `Upload ${pendingCount} Image${pendingCount > 1 ? 's' : ''}`}
                </button>
              </motion.div>
            )}

            {/* Retry Failed Button */}
            {errorCount > 0 && !isUploading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="upload-button-mobile"
              >
                <button
                  onClick={retryFailed}
                  className="w-full btn-secondary mobile-button"
                >
                  🔄 Retry {errorCount} Failed Upload{errorCount > 1 ? 's' : ''}
                </button>
              </motion.div>
            )}
          </div>

          {/* Progress Header */}
          <UploadProgressHeader
            totalFiles={uploadFiles.length}
            pendingCount={pendingCount}
            uploadingCount={uploadFiles.filter(f => f.status === 'uploading').length}
            processingCount={uploadFiles.filter(f => f.status === 'processing').length}
            checkingCount={uploadFiles.filter(f => f.status === 'checking').length}
            successCount={successCount}
            errorCount={errorCount}
            duplicateCount={duplicateCount}
            onClearAll={clearAll}
            isUploading={isUploading}
            concurrentUploads={maxConcurrent}
          />

          {/* Animated Progress Cards */}
          <div className="space-y-3 max-h-96 overflow-y-auto mobile-scroll">
            <AnimatePresence>
              {uploadFiles.map((uploadFile, index) => (
                <AnimatedProgressCard
                  key={uploadFile.id}
                  uploadFile={uploadFile}
                  onRemove={removeFile}
                  index={index}
                />
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      )}

      {/* Success Animation */}
      <SuccessAnimation
        show={showSuccessAnimation}
        onComplete={() => setShowSuccessAnimation(false)}
        message="Upload Complete!"
      />

      {/* Duplicate Confirmation Dialog */}
      <DuplicateConfirmationDialog
        isOpen={showDuplicateDialog}
        onClose={() => setShowDuplicateDialog(false)}
        onConfirm={handleDuplicateConfirmation}
        duplicates={duplicates}
        totalFiles={uploadFiles.length}
      />
    </div>
  );
};

export default ImageUpload;
