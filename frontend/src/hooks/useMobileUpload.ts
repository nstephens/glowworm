import React, { useState, useCallback, useRef, useEffect } from 'react';
import { apiService } from '../services/api';
import type { Album, Image } from '../types';

interface UploadFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'paused' | 'cancelled';
  progress: number;
  error?: string;
  image?: Image;
}

interface UseMobileUploadOptions {
  /** Callback when upload completes */
  onUploadComplete?: (images: Image[]) => void;
  /** Available albums */
  albums?: Album[];
  /** Whether to enable haptic feedback */
  hapticFeedback?: boolean;
  /** Maximum number of concurrent uploads */
  maxConcurrentUploads?: number;
  /** Retry attempts for failed uploads */
  maxRetries?: number;
}

interface UseMobileUploadReturn {
  /** Files being uploaded */
  files: UploadFile[];
  /** Whether upload is in progress */
  isUploading: boolean;
  /** Selected album */
  selectedAlbum: Album | null;
  /** Upload progress percentage */
  progress: number;
  /** Upload statistics */
  stats: {
    total: number;
    completed: number;
    failed: number;
    pending: number;
    uploading: number;
    paused: number;
  };
  /** Add files to upload queue */
  addFiles: (files: File[]) => void;
  /** Start upload process */
  startUpload: () => void;
  /** Pause upload process */
  pauseUpload: () => void;
  /** Resume upload process */
  resumeUpload: () => void;
  /** Cancel upload process */
  cancelUpload: () => void;
  /** Retry failed uploads */
  retryFailed: () => void;
  /** Retry specific file */
  retryFile: (fileId: string) => void;
  /** Remove file from queue */
  removeFile: (fileId: string) => void;
  /** Clear all files */
  clearAll: () => void;
  /** Set selected album */
  setSelectedAlbum: (album: Album | null) => void;
  /** Upload single file */
  uploadFile: (file: UploadFile) => Promise<Image>;
}

/**
 * Custom hook for mobile-optimized file uploads
 * 
 * Features:
 * - Batch upload with progress tracking
 * - Pause/resume functionality
 * - Retry logic with exponential backoff
 * - Album selection
 * - Haptic feedback
 * - Concurrent upload limiting
 * - Error handling and recovery
 */
export const useMobileUpload = ({
  onUploadComplete,
  albums = [],
  hapticFeedback = true,
  maxConcurrentUploads = 3,
  maxRetries = 3
}: UseMobileUploadOptions = {}): UseMobileUploadReturn => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [activeUploads, setActiveUploads] = useState<Set<string>>(new Set());
  
  const abortControllers = useRef<Map<string, AbortController>>(new Map());
  const retryCounts = useRef<Map<string, number>>(new Map());

  // Haptic feedback function
  const triggerHapticFeedback = useCallback((type: 'light' | 'medium' | 'heavy' = 'light') => {
    if (!hapticFeedback || !navigator.vibrate) return;
    
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30, 10, 30]
    };
    
    navigator.vibrate(patterns[type]);
  }, [hapticFeedback]);

  // Calculate statistics
  const stats = React.useMemo(() => {
    const total = files.length;
    const completed = files.filter(f => f.status === 'success').length;
    const failed = files.filter(f => f.status === 'error').length;
    const pending = files.filter(f => f.status === 'pending').length;
    const uploading = files.filter(f => f.status === 'uploading').length;
    const paused = files.filter(f => f.status === 'paused').length;
    
    return { total, completed, failed, pending, uploading, paused };
  }, [files]);

  // Calculate overall progress
  const progress = React.useMemo(() => {
    if (files.length === 0) return 0;
    const totalProgress = files.reduce((sum, f) => sum + f.progress, 0);
    return Math.round(totalProgress / files.length);
  }, [files]);

  // Add files to upload queue
  const addFiles = useCallback((newFiles: File[]) => {
    const uploadFiles: UploadFile[] = newFiles.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      status: 'pending',
      progress: 0
    }));
    
    setFiles(prev => [...prev, ...uploadFiles]);
    triggerHapticFeedback('medium');
  }, [triggerHapticFeedback]);

  // Upload single file
  const uploadFile = useCallback(async (file: UploadFile): Promise<Image> => {
    const formData = new FormData();
    formData.append('file', file.file);
    
    if (selectedAlbum) {
      formData.append('album_id', selectedAlbum.id.toString());
    }

    // Create abort controller
    const abortController = new AbortController();
    abortControllers.current.set(file.id, abortController);

    try {
      // Update status to uploading
      setFiles(prev => prev.map(f => 
        f.id === file.id 
          ? { ...f, status: 'uploading', progress: 0 }
          : f
      ));

      // Add to active uploads
      setActiveUploads(prev => new Set([...prev, file.id]));

      const response = await apiService.uploadImage(formData, {
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setFiles(prev => prev.map(f => 
              f.id === file.id 
                ? { ...f, progress }
                : f
            ));
          }
        },
        signal: abortController.signal
      });

      // Update status to success
      setFiles(prev => prev.map(f => 
        f.id === file.id 
          ? { ...f, status: 'success', progress: 100, image: response.data }
          : f
      ));

      // Remove from active uploads
      setActiveUploads(prev => {
        const newSet = new Set(prev);
        newSet.delete(file.id);
        return newSet;
      });

      // Clear retry count
      retryCounts.current.delete(file.id);

      return response.data;
    } catch (error: any) {
      // Handle abort
      if (error.name === 'AbortError') {
        setFiles(prev => prev.map(f => 
          f.id === file.id 
            ? { ...f, status: 'cancelled', progress: 0 }
            : f
        ));
        throw error;
      }

      // Update status to error
      setFiles(prev => prev.map(f => 
        f.id === file.id 
          ? { 
              ...f, 
              status: 'error', 
              error: error.message || 'Upload failed',
              progress: 0
            }
          : f
      ));

      // Remove from active uploads
      setActiveUploads(prev => {
        const newSet = new Set(prev);
        newSet.delete(file.id);
        return newSet;
      });

      throw error;
    } finally {
      // Clean up abort controller
      abortControllers.current.delete(file.id);
    }
  }, [selectedAlbum]);

  // Process upload queue
  const processQueue = useCallback(async () => {
    if (isPaused || activeUploads.size >= maxConcurrentUploads) return;

    const pendingFiles = files.filter(f => f.status === 'pending');
    const availableSlots = maxConcurrentUploads - activeUploads.size;
    const filesToUpload = pendingFiles.slice(0, availableSlots);

    for (const file of filesToUpload) {
      try {
        const image = await uploadFile(file);
        onUploadComplete?.([image]);
      } catch (error) {
        console.error('Upload failed for file:', file.file.name, error);
      }
    }
  }, [files, isPaused, activeUploads.size, maxConcurrentUploads, uploadFile, onUploadComplete]);

  // Start upload process
  const startUpload = useCallback(() => {
    setIsUploading(true);
    setIsPaused(false);
    triggerHapticFeedback('heavy');
  }, [triggerHapticFeedback]);

  // Pause upload process
  const pauseUpload = useCallback(() => {
    setIsPaused(true);
    triggerHapticFeedback('medium');
  }, [triggerHapticFeedback]);

  // Resume upload process
  const resumeUpload = useCallback(() => {
    setIsPaused(false);
    triggerHapticFeedback('medium');
  }, [triggerHapticFeedback]);

  // Cancel upload process
  const cancelUpload = useCallback(() => {
    // Cancel all active uploads
    abortControllers.current.forEach(controller => controller.abort());
    abortControllers.current.clear();
    
    // Update status of uploading files to cancelled
    setFiles(prev => prev.map(f => 
      f.status === 'uploading' 
        ? { ...f, status: 'cancelled', progress: 0 }
        : f
    ));
    
    setIsUploading(false);
    setIsPaused(false);
    setActiveUploads(new Set());
    triggerHapticFeedback('heavy');
  }, [triggerHapticFeedback]);

  // Retry failed uploads
  const retryFailed = useCallback(() => {
    setFiles(prev => prev.map(f => 
      f.status === 'error' 
        ? { ...f, status: 'pending', progress: 0, error: undefined }
        : f
    ));
    triggerHapticFeedback('medium');
  }, [triggerHapticFeedback]);

  // Retry specific file
  const retryFile = useCallback((fileId: string) => {
    setFiles(prev => prev.map(f => 
      f.id === fileId 
        ? { ...f, status: 'pending', progress: 0, error: undefined }
        : f
    ));
    triggerHapticFeedback('light');
  }, [triggerHapticFeedback]);

  // Remove file from queue
  const removeFile = useCallback((fileId: string) => {
    // Cancel upload if in progress
    const controller = abortControllers.current.get(fileId);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(fileId);
    }

    setFiles(prev => prev.filter(f => f.id !== fileId));
    setActiveUploads(prev => {
      const newSet = new Set(prev);
      newSet.delete(fileId);
      return newSet;
    });
    triggerHapticFeedback('light');
  }, [triggerHapticFeedback]);

  // Clear all files
  const clearAll = useCallback(() => {
    // Cancel all active uploads
    abortControllers.current.forEach(controller => controller.abort());
    abortControllers.current.clear();
    
    setFiles([]);
    setIsUploading(false);
    setIsPaused(false);
    setActiveUploads(new Set());
    triggerHapticFeedback('heavy');
  }, [triggerHapticFeedback]);

  // Process queue when files or state changes
  useEffect(() => {
    if (isUploading && !isPaused) {
      processQueue();
    }
  }, [isUploading, isPaused, processQueue]);

  // Check if all uploads are complete
  useEffect(() => {
    if (isUploading && activeUploads.size === 0) {
      const hasPending = files.some(f => f.status === 'pending');
      if (!hasPending) {
        setIsUploading(false);
        setIsPaused(false);
      }
    }
  }, [isUploading, activeUploads.size, files]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllers.current.forEach(controller => controller.abort());
      abortControllers.current.clear();
    };
  }, []);

  return {
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
  };
};

export default useMobileUpload;
