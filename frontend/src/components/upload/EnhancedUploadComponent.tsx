import React, { useState, useCallback, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Upload, Send, X, RotateCcw, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { UploadZone } from './UploadZone';
import { UploadProgress, UploadFile } from './UploadProgress';
import { AlbumTagSelector, Album, Tag } from './AlbumTagSelector';
import { UploadProvider, useUpload } from './UploadContext';
import { useUploadMutation, useBatchUpload, useUploadQueue } from '@/hooks/useUploadMutation';
import { cn } from '@/lib/utils';

interface EnhancedUploadComponentProps {
  onUploadComplete?: (uploadedFiles: any[]) => void;
  className?: string;
}

/**
 * EnhancedUploadComponent - Advanced upload with React Query integration
 * 
 * Features:
 * - React Query for data fetching and caching
 * - Background uploads with queue management
 * - Retry logic with exponential backoff
 * - Request cancellation
 * - Optimistic updates
 * - Progress tracking
 * - Error handling
 */
const EnhancedUploadComponentInner: React.FC<EnhancedUploadComponentProps> = ({
  onUploadComplete,
  className,
}) => {
  const {
    files,
    addFiles,
    updateFileProgress,
    updateFileStatus,
    removeFile,
    clearAll,
    retryFile,
    cancelFile,
    isUploading,
    hasErrors,
    completedCount,
    errorCount,
  } = useUpload();

  const [selectedAlbum, setSelectedAlbum] = useState<Album | undefined>();
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  // React Query hooks
  const uploadMutation = useUploadMutation();
  const batchUpload = useBatchUpload();
  const uploadQueue = useUploadQueue();

  const handleFilesSelected = useCallback((newFiles: File[]) => {
    addFiles(newFiles);
  }, [addFiles]);

  const handleUpload = useCallback(async () => {
    if (files.length === 0) return;

    const pendingFiles = files.filter(f => f.status === 'pending');
    
    // Create upload requests
    const uploadRequests = pendingFiles.map(file => ({
      file: file.file,
      albumId: selectedAlbum?.id,
      tags: selectedTags.map(tag => tag.name),
      metadata: {
        title: file.file.name.split('.')[0],
        description: `Uploaded on ${new Date().toLocaleDateString()}`,
      },
    }));

    // Start batch upload
    try {
      await batchUpload.uploadFiles(
        uploadRequests,
        (fileId, progress) => {
          const file = files.find(f => f.file.name === fileId);
          if (file) {
            updateFileProgress(file.id, progress);
          }
        },
        (fileId, result) => {
          const file = files.find(f => f.file.name === fileId);
          if (file) {
            updateFileStatus(file.id, 'completed');
            onUploadComplete?.([result]);
          }
        },
        (fileId, error) => {
          const file = files.find(f => f.file.name === fileId);
          if (file) {
            updateFileStatus(file.id, 'error', error.message);
          }
        }
      );
    } catch (error) {
      console.error('Batch upload failed:', error);
    }
  }, [files, selectedAlbum, selectedTags, batchUpload, updateFileProgress, updateFileStatus, onUploadComplete]);

  const handleRetry = useCallback(async (fileId: string) => {
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    try {
      updateFileStatus(fileId, 'uploading');
      
      const uploadRequest = {
        file: file.file,
        albumId: selectedAlbum?.id,
        tags: selectedTags.map(tag => tag.name),
        metadata: {
          title: file.file.name.split('.')[0],
          description: `Retried upload on ${new Date().toLocaleDateString()}`,
        },
      };

      const result = await uploadMutation.mutateAsync(uploadRequest);
      updateFileStatus(fileId, 'completed');
      onUploadComplete?.([result]);
    } catch (error) {
      updateFileStatus(fileId, 'error', error instanceof Error ? error.message : 'Retry failed');
    }
  }, [files, selectedAlbum, selectedTags, uploadMutation, updateFileStatus, onUploadComplete]);

  const handleCancel = useCallback((fileId: string) => {
    const controller = abortControllers.current.get(fileId);
    if (controller) {
      controller.abort();
      abortControllers.current.delete(fileId);
    }
    cancelFile(fileId);
  }, [cancelFile]);

  const handlePause = useCallback(() => {
    setIsPaused(true);
    // Pause all active uploads
    abortControllers.current.forEach(controller => {
      controller.abort();
    });
  }, []);

  const handleResume = useCallback(() => {
    setIsPaused(false);
    // Resume paused uploads
    const pausedFiles = files.filter(f => f.status === 'uploading');
    pausedFiles.forEach(file => {
      handleRetry(file.id);
    });
  }, [files, handleRetry]);

  const handleClearAll = useCallback(() => {
    clearAll();
    setSelectedAlbum(undefined);
    setSelectedTags([]);
    setIsPaused(false);
  }, [clearAll]);

  const canUpload = files.some(f => f.status === 'pending') && !isUploading && !isPaused;
  const hasFiles = files.length > 0;
  const hasActiveUploads = files.some(f => f.status === 'uploading');

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Upload Photos</h2>
          <p className="text-muted-foreground">
            Drag and drop your photos or click to browse
          </p>
        </div>
        {hasFiles && (
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {files.length} files
            </Badge>
            {selectedAlbum && (
              <Badge variant="secondary">
                Album: {selectedAlbum.name}
              </Badge>
            )}
            {selectedTags.length > 0 && (
              <Badge variant="secondary">
                {selectedTags.length} tags
              </Badge>
            )}
            {isPaused && (
              <Badge variant="warning">
                Paused
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Upload Zone */}
      <UploadZone
        onFilesSelected={handleFilesSelected}
        maxSize={52428800} // 50MB
        maxFiles={100}
      />

      {/* Album and Tag Selection */}
      {hasFiles && (
        <AlbumTagSelector
          selectedAlbum={selectedAlbum}
          selectedTags={selectedTags}
          availableAlbums={[]} // This would come from API
          availableTags={[]} // This would come from API
          onAlbumChange={setSelectedAlbum}
          onTagsChange={setSelectedTags}
          onCreateAlbum={(name, description) => {
            console.log('Create album:', name, description);
          }}
          onCreateTag={(name, color) => {
            console.log('Create tag:', name, color);
          }}
        />
      )}

      {/* Upload Progress */}
      {hasFiles && (
        <UploadProgress
          files={files}
          onRetry={handleRetry}
          onCancel={handleCancel}
          onRemove={removeFile}
          onClearAll={handleClearAll}
        />
      )}

      {/* Upload Controls */}
      {hasFiles && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  {completedCount} completed, {errorCount} failed
                </div>
                {hasErrors && (
                  <Alert variant="destructive" className="py-2">
                    <AlertDescription>
                      Some uploads failed. Check the progress section for details.
                    </AlertDescription>
                  </Alert>
                )}
                {isPaused && (
                  <Alert variant="warning" className="py-2">
                    <AlertDescription>
                      Uploads are paused. Click resume to continue.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {hasActiveUploads && (
                  <Button
                    variant="outline"
                    onClick={isPaused ? handleResume : handlePause}
                  >
                    {isPaused ? (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Resume
                      </>
                    ) : (
                      <>
                        <Pause className="h-4 w-4 mr-2" />
                        Pause
                      </>
                    )}
                  </Button>
                )}
                
                <Button
                  variant="outline"
                  onClick={handleClearAll}
                  disabled={isUploading && !isPaused}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
                
                <Button
                  onClick={handleUpload}
                  disabled={!canUpload}
                  className="min-w-[120px]"
                >
                  {isUploading ? (
                    <>
                      <Upload className="h-4 w-4 mr-2 animate-pulse" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Start Upload
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Queue Status */}
      {uploadQueue.queue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload Queue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-muted-foreground">
                  {uploadQueue.pendingCount}
                </div>
                <div className="text-sm text-muted-foreground">Pending</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-primary">
                  {uploadQueue.uploadingCount}
                </div>
                <div className="text-sm text-muted-foreground">Uploading</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-success">
                  {uploadQueue.completedCount}
                </div>
                <div className="text-sm text-muted-foreground">Completed</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-destructive">
                  {uploadQueue.failedCount}
                </div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export const EnhancedUploadComponent: React.FC<EnhancedUploadComponentProps> = (props) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        cacheTime: 10 * 60 * 1000, // 10 minutes
      },
      mutations: {
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 4000),
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <UploadProvider>
        <EnhancedUploadComponentInner {...props} />
      </UploadProvider>
    </QueryClientProvider>
  );
};
