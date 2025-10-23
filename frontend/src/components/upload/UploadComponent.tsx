import React, { useState, useCallback } from 'react';
import { Upload, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UploadZone } from './UploadZone';
import { UploadProgress } from './UploadProgress';
import { AlbumTagSelector, Album, Tag } from './AlbumTagSelector';
import { UploadProvider, useUpload } from './UploadContext';
import { cn } from '@/lib/utils';

interface UploadComponentProps {
  onUploadComplete?: (uploadedFiles: any[]) => void;
  className?: string;
}

/**
 * UploadComponent - Main upload interface
 * 
 * Features:
 * - Drag and drop file selection
 * - Album and tag selection
 * - Upload progress tracking
 * - Batch operations
 * - Error handling
 * - Preview functionality
 */
const UploadComponentInner: React.FC<UploadComponentProps> = ({
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
  const [availableAlbums, setAvailableAlbums] = useState<Album[]>([
    {
      id: '1',
      name: 'Recent Photos',
      description: 'Recently uploaded photos',
      imageCount: 42,
      createdAt: new Date('2024-01-15'),
    },
    {
      id: '2',
      name: 'Vacation 2024',
      description: 'Summer vacation photos',
      imageCount: 156,
      createdAt: new Date('2024-07-20'),
    },
    {
      id: '3',
      name: 'Family',
      description: 'Family photos and memories',
      imageCount: 89,
      createdAt: new Date('2024-03-10'),
    },
  ]);

  const [availableTags, setAvailableTags] = useState<Tag[]>([
    { id: '1', name: 'nature', color: '#10b981', usageCount: 23 },
    { id: '2', name: 'portrait', color: '#3b82f6', usageCount: 15 },
    { id: '3', name: 'landscape', color: '#8b5cf6', usageCount: 31 },
    { id: '4', name: 'black-and-white', color: '#6b7280', usageCount: 8 },
    { id: '5', name: 'macro', color: '#f59e0b', usageCount: 12 },
  ]);

  const handleFilesSelected = useCallback((newFiles: File[]) => {
    addFiles(newFiles);
  }, [addFiles]);

  const handleUpload = useCallback(async () => {
    if (files.length === 0) return;

    const pendingFiles = files.filter(f => f.status === 'pending');
    
    for (const file of pendingFiles) {
      try {
        updateFileStatus(file.id, 'uploading');
        
        // Simulate upload progress
        for (let progress = 0; progress <= 100; progress += 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          updateFileProgress(file.id, progress);
        }
        
        updateFileStatus(file.id, 'completed');
      } catch (error) {
        updateFileStatus(file.id, 'error', error instanceof Error ? error.message : 'Upload failed');
      }
    }
  }, [files, updateFileStatus, updateFileProgress]);

  const handleCreateAlbum = useCallback((name: string, description?: string) => {
    const newAlbum: Album = {
      id: Date.now().toString(),
      name,
      description,
      imageCount: 0,
      createdAt: new Date(),
    };
    setAvailableAlbums(prev => [...prev, newAlbum]);
  }, []);

  const handleCreateTag = useCallback((name: string, color?: string) => {
    const newTag: Tag = {
      id: Date.now().toString(),
      name,
      color,
      usageCount: 0,
    };
    setAvailableTags(prev => [...prev, newTag]);
  }, []);

  const handleRetry = useCallback((fileId: string) => {
    retryFile(fileId);
  }, [retryFile]);

  const handleCancel = useCallback((fileId: string) => {
    cancelFile(fileId);
  }, [cancelFile]);

  const handleRemove = useCallback((fileId: string) => {
    removeFile(fileId);
  }, [removeFile]);

  const handleClearAll = useCallback(() => {
    clearAll();
    setSelectedAlbum(undefined);
    setSelectedTags([]);
  }, [clearAll]);

  const canUpload = files.some(f => f.status === 'pending') && !isUploading;
  const hasFiles = files.length > 0;

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
          availableAlbums={availableAlbums}
          availableTags={availableTags}
          onAlbumChange={setSelectedAlbum}
          onTagsChange={setSelectedTags}
          onCreateAlbum={handleCreateAlbum}
          onCreateTag={handleCreateTag}
        />
      )}

      {/* Upload Progress */}
      {hasFiles && (
        <UploadProgress
          files={files}
          onRetry={handleRetry}
          onCancel={handleCancel}
          onRemove={handleRemove}
          onClearAll={handleClearAll}
        />
      )}

      {/* Upload Actions */}
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
    </div>
  );
};

export const UploadComponent: React.FC<UploadComponentProps> = (props) => {
  return (
    <UploadProvider>
      <UploadComponentInner {...props} />
    </UploadProvider>
  );
};
