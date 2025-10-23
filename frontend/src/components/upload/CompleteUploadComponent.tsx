import React, { useState, useCallback, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Upload, Send, X, RotateCcw, AlertTriangle, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UploadZone } from './UploadZone';
import { UploadProgress, UploadFile } from './UploadProgress';
import { AlbumTagSelector, Album, Tag } from './AlbumTagSelector';
import { ErrorHandler, UploadError } from './ErrorHandler';
import { NetworkStatusMonitor, NetworkStatus, ServerStatus } from './NetworkStatusMonitor';
import { UploadProvider, useUpload } from './UploadContext';
import { useUploadMutation, useBatchUpload } from '@/hooks/useUploadMutation';
import { cn } from '@/lib/utils';

interface CompleteUploadComponentProps {
  onUploadComplete?: (uploadedFiles: any[]) => void;
  className?: string;
}

/**
 * CompleteUploadComponent - Full-featured upload system with error handling
 * 
 * Features:
 * - Comprehensive error handling and retry logic
 * - Network status monitoring
 * - Server health checks
 * - Intelligent retry strategies
 * - User-friendly error messages
 * - Offline mode support
 * - Data saver mode detection
 */
const CompleteUploadComponentInner: React.FC<CompleteUploadComponentProps> = ({
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
  const [errors, setErrors] = useState<UploadError[]>([]);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(null);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [activeTab, setActiveTab] = useState('upload');

  // React Query hooks
  const uploadMutation = useUploadMutation();
  const batchUpload = useBatchUpload();

  const handleFilesSelected = useCallback((newFiles: File[]) => {
    addFiles(newFiles);
  }, [addFiles]);

  const handleUpload = useCallback(async () => {
    if (files.length === 0) return;

    const pendingFiles = files.filter(f => f.status === 'pending');
    
    // Check network and server status
    if (!networkStatus?.isOnline) {
      setErrors(prev => [...prev, {
        id: `network-${Date.now()}`,
        code: 'NETWORK_ERROR',
        message: 'No internet connection available',
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3,
        canRetry: true,
        fileId: 'network',
        fileName: 'Network Error',
      }]);
      return;
    }

    if (!serverStatus?.isHealthy) {
      setErrors(prev => [...prev, {
        id: `server-${Date.now()}`,
        code: 'SERVER_ERROR',
        message: 'Server is not responding',
        timestamp: new Date(),
        retryCount: 0,
        maxRetries: 3,
        canRetry: true,
        fileId: 'server',
        fileName: 'Server Error',
      }]);
      return;
    }

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

    // Start batch upload with error handling
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
            
            // Add to errors list
            const uploadError: UploadError = {
              id: `error-${file.id}`,
              code: error.message.includes('network') ? 'NETWORK_ERROR' : 'SERVER_ERROR',
              message: error.message,
              timestamp: new Date(),
              retryCount: 0,
              maxRetries: 3,
              canRetry: true,
              fileId: file.id,
              fileName: file.file.name,
            };
            
            setErrors(prev => [...prev, uploadError]);
          }
        }
      );
    } catch (error) {
      console.error('Batch upload failed:', error);
    }
  }, [files, selectedAlbum, selectedTags, networkStatus, serverStatus, batchUpload, updateFileProgress, updateFileStatus, onUploadComplete]);

  const handleRetry = useCallback(async (errorId: string) => {
    const error = errors.find(e => e.id === errorId);
    if (!error || !error.canRetry) return;

    try {
      if (error.fileId === 'network' || error.fileId === 'server') {
        // Retry network/server errors by re-attempting upload
        await handleUpload();
      } else {
        // Retry specific file
        const file = files.find(f => f.id === error.fileId);
        if (file) {
          updateFileStatus(file.id, 'uploading');
          
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
          updateFileStatus(file.id, 'completed');
          onUploadComplete?.([result]);
        }
      }
      
      // Remove error from list on successful retry
      setErrors(prev => prev.filter(e => e.id !== errorId));
    } catch (retryError) {
      // Update error with increased retry count
      setErrors(prev => prev.map(e => 
        e.id === errorId 
          ? { 
              ...e, 
              retryCount: e.retryCount + 1,
              canRetry: e.retryCount + 1 < e.maxRetries,
              message: retryError instanceof Error ? retryError.message : 'Retry failed'
            }
          : e
      ));
    }
  }, [errors, files, selectedAlbum, selectedTags, handleUpload, uploadMutation, updateFileStatus, onUploadComplete]);

  const handleRetryAll = useCallback(() => {
    const retryableErrors = errors.filter(e => e.canRetry);
    retryableErrors.forEach(error => {
      handleRetry(error.id);
    });
  }, [errors, handleRetry]);

  const handleDismiss = useCallback((errorId: string) => {
    setErrors(prev => prev.filter(e => e.id !== errorId));
  }, []);

  const handleDismissAll = useCallback(() => {
    setErrors([]);
  }, []);

  const handleClearAll = useCallback(() => {
    clearAll();
    setSelectedAlbum(undefined);
    setSelectedTags([]);
    setErrors([]);
  }, [clearAll]);

  const canUpload = files.some(f => f.status === 'pending') && !isUploading;
  const hasFiles = files.length > 0;
  const hasNetworkIssues = !networkStatus?.isOnline || !serverStatus?.isHealthy;

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
            {hasNetworkIssues && (
              <Badge variant="destructive">
                <Wifi className="h-3 w-3 mr-1" />
                Connection Issues
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Network Status */}
      <NetworkStatusMonitor
        onStatusChange={setNetworkStatus}
        onServerStatusChange={setServerStatus}
      />

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="errors">
            Errors
            {errors.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {errors.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
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
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          {/* Upload Progress */}
          {hasFiles && (
            <UploadProgress
              files={files}
              onRetry={retryFile}
              onCancel={cancelFile}
              onRemove={removeFile}
              onClearAll={handleClearAll}
            />
          )}
        </TabsContent>

        <TabsContent value="errors" className="space-y-4">
          {/* Error Handler */}
          {errors.length > 0 && (
            <ErrorHandler
              errors={errors}
              onRetry={handleRetry}
              onRetryAll={handleRetryAll}
              onDismiss={handleDismiss}
              onDismissAll={handleDismissAll}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Upload Actions */}
      {hasFiles && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  {completedCount} completed, {errorCount} failed
                </div>
                {hasNetworkIssues && (
                  <Alert variant="destructive" className="py-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Network or server issues detected. Uploads may fail.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={handleClearAll}
                  disabled={isUploading}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear All
                </Button>
                
                <Button
                  onClick={handleUpload}
                  disabled={!canUpload || hasNetworkIssues}
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
    </div>
  );
};

export const CompleteUploadComponent: React.FC<CompleteUploadComponentProps> = (props) => {
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
        <CompleteUploadComponentInner {...props} />
      </UploadProvider>
    </QueryClientProvider>
  );
};
