import React, { useState, useCallback, useEffect } from 'react';
import { MobileUploadButton } from './MobileUploadButton';
import { MobileUploadProgress } from './MobileUploadProgress';
import { MobileAlbumSelector } from './MobileAlbumSelector';
import { useMobileUpload } from '../../hooks/useMobileUpload';
import type { Album, Image } from '../../types';

interface MobileUploadFlowProps {
  /** Callback when upload completes */
  onUploadComplete?: (images: Image[]) => void;
  /** Available albums */
  albums?: Album[];
  /** Callback when new album is created */
  onCreateAlbum?: (name: string, description?: string) => Promise<Album>;
  /** Whether to show album selection */
  showAlbumSelection?: boolean;
  /** Position of the upload button */
  buttonPosition?: 'bottom-right' | 'bottom-center' | 'bottom-left';
  /** Size of the upload button */
  buttonSize?: 'sm' | 'md' | 'lg';
  /** Whether to enable haptic feedback */
  hapticFeedback?: boolean;
  /** Custom className */
  className?: string;
}

export const MobileUploadFlow: React.FC<MobileUploadFlowProps> = ({
  onUploadComplete,
  albums = [],
  onCreateAlbum,
  showAlbumSelection = true,
  buttonPosition = 'bottom-right',
  buttonSize = 'md',
  hapticFeedback = true,
  className
}) => {
  const [showAlbumSelector, setShowAlbumSelector] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<Image[]>([]);

  // Mobile upload hook
  const {
    files,
    isUploading,
    selectedAlbum,
    progress,
    stats,
    addFiles,
    startUpload,
    pauseUpload,
    resumeUpload,
    cancelUpload,
    retryFailed,
    retryFile,
    removeFile,
    clearAll,
    setSelectedAlbum
  } = useMobileUpload({
    onUploadComplete: (images) => {
      setUploadedImages(prev => [...prev, ...images]);
      onUploadComplete?.(images);
    },
    albums,
    hapticFeedback
  });

  // Handle file selection
  const handleFilesSelected = useCallback((selectedFiles: File[]) => {
    addFiles(selectedFiles);
  }, [addFiles]);

  // Handle upload start
  const handleUpload = useCallback(() => {
    if (files.length === 0) return;
    startUpload();
  }, [files.length, startUpload]);

  // Handle album change
  const handleAlbumChange = useCallback((album: Album | null) => {
    setSelectedAlbum(album);
  }, [setSelectedAlbum]);

  // Handle create album
  const handleCreateAlbum = useCallback(async (name: string, description?: string) => {
    if (!onCreateAlbum) {
      console.warn('onCreateAlbum callback not provided');
      return;
    }
    
    try {
      const newAlbum = await onCreateAlbum(name, description);
      // The album will be available in the albums prop on next render
      setSelectedAlbum(newAlbum);
    } catch (error) {
      console.error('Failed to create album:', error);
      throw error;
    }
  }, [onCreateAlbum, setSelectedAlbum]);

  // Handle upload completion
  useEffect(() => {
    if (stats.completed === stats.total && stats.total > 0 && !isUploading) {
      // All uploads completed
      setTimeout(() => {
        clearAll();
        setUploadedImages([]);
      }, 3000); // Clear after 3 seconds
    }
  }, [stats.completed, stats.total, isUploading, clearAll]);

  // Show progress if there are files
  const showProgress = files.length > 0;

  return (
    <>
      {/* Upload Button */}
      <MobileUploadButton
        onFilesSelected={handleFilesSelected}
        onUpload={handleUpload}
        isUploading={isUploading}
        fileCount={files.length}
        showAlbumSelection={showAlbumSelection}
        albums={albums}
        selectedAlbum={selectedAlbum}
        onAlbumChange={handleAlbumChange}
        position={buttonPosition}
        size={buttonSize}
        hapticFeedback={hapticFeedback}
        className={className}
      />

      {/* Upload Progress */}
      {showProgress && (
        <MobileUploadProgress
          files={files}
          isUploading={isUploading}
          onStartUpload={startUpload}
          onPauseUpload={pauseUpload}
          onResumeUpload={resumeUpload}
          onCancelUpload={cancelUpload}
          onRetryFile={retryFile}
          onRemoveFile={removeFile}
          onClearAll={clearAll}
          showDetails={true}
          hapticFeedback={hapticFeedback}
        />
      )}

      {/* Album Selector */}
      {showAlbumSelection && (
        <MobileAlbumSelector
          albums={albums}
          selectedAlbum={selectedAlbum}
          onAlbumChange={handleAlbumChange}
          onCreateAlbum={handleCreateAlbum}
          visible={showAlbumSelector}
          onVisibilityChange={setShowAlbumSelector}
          hapticFeedback={hapticFeedback}
        />
      )}
    </>
  );
};

export default MobileUploadFlow;






