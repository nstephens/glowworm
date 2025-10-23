import React from 'react';
import { 
  CheckCircle, 
  AlertCircle, 
  X, 
  Upload, 
  RotateCcw,
  Clock,
  FileImage
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface UploadFile {
  id: string;
  file: File;
  preview?: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'cancelled';
  error?: string;
  uploadedAt?: Date;
  size: number;
}

interface UploadProgressProps {
  files: UploadFile[];
  onRetry: (fileId: string) => void;
  onCancel: (fileId: string) => void;
  onRemove: (fileId: string) => void;
  onClearAll: () => void;
  className?: string;
}

/**
 * UploadProgress - Comprehensive upload progress component
 * 
 * Features:
 * - Real-time progress indicators
 * - Status badges and icons
 * - Retry functionality for failed uploads
 * - Cancel in-progress uploads
 * - File preview thumbnails
 * - Batch operations
 * - Accessibility support
 */
export const UploadProgress: React.FC<UploadProgressProps> = ({
  files,
  onRetry,
  onCancel,
  onRemove,
  onClearAll,
  className,
}) => {
  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'uploading':
        return <Upload className="h-4 w-4 text-primary animate-pulse" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      case 'cancelled':
        return <X className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: UploadFile['status']) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'error':
        return 'destructive';
      case 'uploading':
        return 'default';
      case 'pending':
        return 'secondary';
      case 'cancelled':
        return 'outline';
    }
  };

  const getStatusText = (status: UploadFile['status']) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Failed';
      case 'uploading':
        return 'Uploading';
      case 'pending':
        return 'Pending';
      case 'cancelled':
        return 'Cancelled';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatDuration = (startTime: Date, endTime?: Date): string => {
    const duration = (endTime || new Date()).getTime() - startTime.getTime();
    const seconds = Math.floor(duration / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const completedFiles = files.filter(f => f.status === 'completed').length;
  const errorFiles = files.filter(f => f.status === 'error').length;
  const uploadingFiles = files.filter(f => f.status === 'uploading').length;
  const pendingFiles = files.filter(f => f.status === 'pending').length;

  const hasErrors = errorFiles > 0;
  const hasUploading = uploadingFiles > 0;
  const allCompleted = files.length > 0 && files.every(f => f.status === 'completed');

  if (files.length === 0) return null;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Progress
            <Badge variant="outline">{files.length} files</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {hasErrors && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  files
                    .filter(f => f.status === 'error')
                    .forEach(f => onRetry(f.id));
                }}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry Failed
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
            >
              Clear All
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-success">{completedFiles}</div>
            <div className="text-sm text-muted-foreground">Completed</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{uploadingFiles}</div>
            <div className="text-sm text-muted-foreground">Uploading</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-muted-foreground">{pendingFiles}</div>
            <div className="text-sm text-muted-foreground">Pending</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-destructive">{errorFiles}</div>
            <div className="text-sm text-muted-foreground">Failed</div>
          </div>
        </div>

        {/* Overall progress */}
        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Overall Progress</span>
              <span>{Math.round((completedFiles / files.length) * 100)}%</span>
            </div>
            <Progress 
              value={(completedFiles / files.length) * 100} 
              className="h-2"
            />
          </div>
        )}

        {/* File list */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {files.map((file) => (
            <div
              key={file.id}
              className={cn(
                "flex items-center gap-3 p-3 border rounded-lg",
                "transition-all duration-200",
                file.status === 'completed' && "bg-success/5 border-success/20",
                file.status === 'error' && "bg-destructive/5 border-destructive/20",
                file.status === 'uploading' && "bg-primary/5 border-primary/20"
              )}
            >
              {/* File preview */}
              <div className="flex-shrink-0">
                {file.preview ? (
                  <img
                    src={file.preview}
                    alt={file.file.name}
                    className="w-12 h-12 object-cover rounded border"
                  />
                ) : (
                  <div className="w-12 h-12 bg-muted rounded border flex items-center justify-center">
                    <FileImage className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* File info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm truncate">
                    {file.file.name}
                  </span>
                  <Badge variant={getStatusColor(file.status)}>
                    {getStatusText(file.status)}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{formatFileSize(file.size)}</span>
                  {file.uploadedAt && (
                    <span>
                      {formatDuration(file.uploadedAt, file.status === 'completed' ? new Date() : undefined)}
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                {file.status === 'uploading' && (
                  <div className="mt-2">
                    <Progress value={file.progress} className="h-1" />
                  </div>
                )}

                {/* Error message */}
                {file.status === 'error' && file.error && (
                  <div className="mt-1 text-xs text-destructive">
                    {file.error}
                  </div>
                )}
              </div>

              {/* Status icon */}
              <div className="flex-shrink-0">
                {getStatusIcon(file.status)}
              </div>

              {/* Actions */}
              <div className="flex-shrink-0 flex items-center gap-1">
                {file.status === 'error' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRetry(file.id)}
                    className="h-8 w-8 p-0"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
                
                {file.status === 'uploading' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onCancel(file.id)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                
                {(file.status === 'completed' || file.status === 'cancelled') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(file.id)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Completion message */}
        {allCompleted && (
          <div className="text-center py-4">
            <CheckCircle className="h-8 w-8 text-success mx-auto mb-2" />
            <p className="text-success font-medium">All files uploaded successfully!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
