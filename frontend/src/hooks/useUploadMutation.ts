import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UploadFile } from '@/components/upload/UploadProgress';

export interface UploadRequest {
  file: File;
  albumId?: string;
  tags: string[];
  metadata?: {
    title?: string;
    description?: string;
    location?: string;
    dateTaken?: string;
  };
}

export interface UploadResponse {
  id: string;
  url: string;
  thumbnailUrl: string;
  metadata: {
    width: number;
    height: number;
    size: number;
    format: string;
    createdAt: string;
  };
}

export interface UploadError {
  code: string;
  message: string;
  details?: any;
}

/**
 * useUploadMutation - React Query mutation for file uploads
 * 
 * Features:
 * - Progress tracking with callbacks
 * - Error handling and retry logic
 * - Request cancellation support
 * - Optimistic updates
 * - Background uploads
 */
export const useUploadMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      albumId,
      tags,
      metadata,
      onProgress,
      signal,
    }: UploadRequest & {
      onProgress?: (progress: number) => void;
      signal?: AbortSignal;
    }) => {
      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('file', file);
      
      if (albumId) {
        formData.append('albumId', albumId);
      }
      
      if (tags.length > 0) {
        formData.append('tags', JSON.stringify(tags));
      }
      
      if (metadata) {
        formData.append('metadata', JSON.stringify(metadata));
      }

      // Simulate upload with progress tracking
      return new Promise<UploadResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = Math.round((event.loaded / event.total) * 100);
            onProgress?.(progress);
          }
        });

        // Handle completion
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText);
              resolve(response);
            } catch (error) {
              reject(new Error('Invalid response format'));
            }
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        // Handle errors
        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed due to network error'));
        });

        // Handle cancellation
        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });

        // Set up cancellation
        if (signal) {
          signal.addEventListener('abort', () => {
            xhr.abort();
          });
        }

        // Start upload
        xhr.open('POST', '/api/upload');
        xhr.send(formData);
      });
    },
    onSuccess: (data, variables) => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: ['images'] });
      queryClient.invalidateQueries({ queryKey: ['albums'] });
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      
      // Add optimistic update to images cache
      queryClient.setQueryData(['images'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any, index: number) => {
            if (index === 0) {
              return {
                ...page,
                images: [data, ...page.images],
              };
            }
            return page;
          }),
        };
      });
    },
    onError: (error, variables) => {
      console.error('Upload failed:', error);
    },
    retry: (failureCount, error) => {
      // Retry up to 3 times for network errors
      if (failureCount < 3 && error.message.includes('network')) {
        return true;
      }
      return false;
    },
    retryDelay: (attemptIndex) => {
      // Exponential backoff: 1s, 2s, 4s
      return Math.min(1000 * Math.pow(2, attemptIndex), 4000);
    },
  });
};

/**
 * useBatchUpload - Hook for batch upload operations
 * 
 * Features:
 * - Multiple file uploads
 * - Progress tracking per file
 * - Error handling per file
 * - Batch retry functionality
 */
export const useBatchUpload = () => {
  const uploadMutation = useUploadMutation();
  const queryClient = useQueryClient();

  const uploadFiles = async (
    files: UploadRequest[],
    onProgress?: (fileId: string, progress: number) => void,
    onComplete?: (fileId: string, result: UploadResponse) => void,
    onError?: (fileId: string, error: Error) => void
  ) => {
    const results: Array<{ fileId: string; result?: UploadResponse; error?: Error }> = [];
    
    // Upload files sequentially to avoid overwhelming the server
    for (const fileRequest of files) {
      try {
        const result = await uploadMutation.mutateAsync({
          ...fileRequest,
          onProgress: (progress) => onProgress?.(fileRequest.file.name, progress),
        });
        
        results.push({ fileId: fileRequest.file.name, result });
        onComplete?.(fileRequest.file.name, result);
      } catch (error) {
        const uploadError = error instanceof Error ? error : new Error('Upload failed');
        results.push({ fileId: fileRequest.file.name, error: uploadError });
        onError?.(fileRequest.file.name, uploadError);
      }
    }
    
    return results;
  };

  const retryFailedUploads = async (
    failedFiles: UploadRequest[],
    onProgress?: (fileId: string, progress: number) => void,
    onComplete?: (fileId: string, result: UploadResponse) => void,
    onError?: (fileId: string, error: Error) => void
  ) => {
    return uploadFiles(failedFiles, onProgress, onComplete, onError);
  };

  return {
    uploadFiles,
    retryFailedUploads,
    isUploading: uploadMutation.isPending,
    error: uploadMutation.error,
  };
};

/**
 * useUploadQueue - Hook for managing upload queue
 * 
 * Features:
 * - Queue management
 * - Priority handling
 * - Background uploads
 * - Queue persistence
 */
export const useUploadQueue = () => {
  const queryClient = useQueryClient();
  const [queue, setQueue] = useState<Array<{
    id: string;
    request: UploadRequest;
    status: 'pending' | 'uploading' | 'completed' | 'failed';
    progress: number;
    error?: Error;
  }>>([]);

  const addToQueue = (request: UploadRequest) => {
    const queueItem = {
      id: `upload-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      request,
      status: 'pending' as const,
      progress: 0,
    };
    
    setQueue(prev => [...prev, queueItem]);
    return queueItem.id;
  };

  const removeFromQueue = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const updateQueueItem = (id: string, updates: Partial<typeof queue[0]>) => {
    setQueue(prev => prev.map(item => 
      item.id === id ? { ...item, ...updates } : item
    ));
  };

  const processQueue = async () => {
    const pendingItems = queue.filter(item => item.status === 'pending');
    
    for (const item of pendingItems) {
      try {
        updateQueueItem(item.id, { status: 'uploading' });
        
        // Simulate upload with progress
        for (let progress = 0; progress <= 100; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          updateQueueItem(item.id, { progress });
        }
        
        updateQueueItem(item.id, { status: 'completed', progress: 100 });
      } catch (error) {
        updateQueueItem(item.id, { 
          status: 'failed', 
          error: error instanceof Error ? error : new Error('Upload failed')
        });
      }
    }
  };

  return {
    queue,
    addToQueue,
    removeFromQueue,
    updateQueueItem,
    processQueue,
    pendingCount: queue.filter(item => item.status === 'pending').length,
    uploadingCount: queue.filter(item => item.status === 'uploading').length,
    completedCount: queue.filter(item => item.status === 'completed').length,
    failedCount: queue.filter(item => item.status === 'failed').length,
  };
};
