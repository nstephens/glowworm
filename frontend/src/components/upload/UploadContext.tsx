import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { UploadFile } from './UploadProgress';

interface UploadContextType {
  files: UploadFile[];
  addFiles: (files: File[]) => void;
  updateFileProgress: (fileId: string, progress: number) => void;
  updateFileStatus: (fileId: string, status: UploadFile['status'], error?: string) => void;
  removeFile: (fileId: string) => void;
  clearAll: () => void;
  retryFile: (fileId: string) => void;
  cancelFile: (fileId: string) => void;
  getFileById: (fileId: string) => UploadFile | undefined;
  getFilesByStatus: (status: UploadFile['status']) => UploadFile[];
  isUploading: boolean;
  hasErrors: boolean;
  completedCount: number;
  errorCount: number;
}

const UploadContext = createContext<UploadContextType | undefined>(undefined);

export const useUpload = () => {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUpload must be used within an UploadProvider');
  }
  return context;
};

interface UploadProviderProps {
  children: React.ReactNode;
}

/**
 * UploadProvider - Context for managing upload state
 * 
 * Features:
 * - Centralized upload state management
 * - File progress tracking
 * - Status updates
 * - Batch operations
 * - Error handling
 */
export const UploadProvider: React.FC<UploadProviderProps> = ({ children }) => {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const uploadAbortControllers = useRef<Map<string, AbortController>>(new Map());

  const generateFileId = () => {
    return `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const addFiles = useCallback((newFiles: File[]) => {
    const uploadFiles: UploadFile[] = newFiles.map(file => ({
      id: generateFileId(),
      file,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
      progress: 0,
      status: 'pending',
      size: file.size,
    }));

    setFiles(prev => [...prev, ...uploadFiles]);
  }, []);

  const updateFileProgress = useCallback((fileId: string, progress: number) => {
    setFiles(prev => prev.map(file => 
      file.id === fileId 
        ? { ...file, progress: Math.min(100, Math.max(0, progress)) }
        : file
    ));
  }, []);

  const updateFileStatus = useCallback((fileId: string, status: UploadFile['status'], error?: string) => {
    setFiles(prev => prev.map(file => 
      file.id === fileId 
        ? { 
            ...file, 
            status, 
            error,
            uploadedAt: status === 'uploading' ? new Date() : file.uploadedAt,
            progress: status === 'completed' ? 100 : file.progress
          }
        : file
    ));
  }, []);

  const removeFile = useCallback((fileId: string) => {
    setFiles(prev => {
      const fileToRemove = prev.find(f => f.id === fileId);
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove.preview);
      }
      
      // Cancel upload if in progress
      const controller = uploadAbortControllers.current.get(fileId);
      if (controller) {
        controller.abort();
        uploadAbortControllers.current.delete(fileId);
      }
      
      return prev.filter(f => f.id !== fileId);
    });
  }, []);

  const clearAll = useCallback(() => {
    // Clean up all preview URLs
    files.forEach(file => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview);
      }
    });

    // Cancel all active uploads
    uploadAbortControllers.current.forEach(controller => {
      controller.abort();
    });
    uploadAbortControllers.current.clear();

    setFiles([]);
  }, [files]);

  const retryFile = useCallback((fileId: string) => {
    setFiles(prev => prev.map(file => 
      file.id === fileId 
        ? { ...file, status: 'pending', progress: 0, error: undefined }
        : file
    ));
  }, []);

  const cancelFile = useCallback((fileId: string) => {
    // Cancel the upload
    const controller = uploadAbortControllers.current.get(fileId);
    if (controller) {
      controller.abort();
      uploadAbortControllers.current.delete(fileId);
    }

    updateFileStatus(fileId, 'cancelled');
  }, [updateFileStatus]);

  const getFileById = useCallback((fileId: string) => {
    return files.find(f => f.id === fileId);
  }, [files]);

  const getFilesByStatus = useCallback((status: UploadFile['status']) => {
    return files.filter(f => f.status === status);
  }, [files]);

  const isUploading = files.some(f => f.status === 'uploading');
  const hasErrors = files.some(f => f.status === 'error');
  const completedCount = files.filter(f => f.status === 'completed').length;
  const errorCount = files.filter(f => f.status === 'error').length;

  const value: UploadContextType = {
    files,
    addFiles,
    updateFileProgress,
    updateFileStatus,
    removeFile,
    clearAll,
    retryFile,
    cancelFile,
    getFileById,
    getFilesByStatus,
    isUploading,
    hasErrors,
    completedCount,
    errorCount,
  };

  return (
    <UploadContext.Provider value={value}>
      {children}
    </UploadContext.Provider>
  );
};
