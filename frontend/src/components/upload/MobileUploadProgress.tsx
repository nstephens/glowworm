import React, { useState, useCallback, useEffect } from 'react';
import { 
  Upload, 
  Check, 
  X, 
  AlertCircle, 
  Pause, 
  Play, 
  RotateCcw,
  MoreHorizontal,
  FileImage,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';

interface UploadFile {
  id: string;
  file: File;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'paused' | 'cancelled';
  progress: number;
  error?: string;
  image?: any;
}

interface MobileUploadProgressProps {
  /** Files being uploaded */
  files: UploadFile[];
  /** Whether upload is in progress */
  isUploading: boolean;
  /** Callback when upload is started */
  onStartUpload: () => void;
  /** Callback when upload is paused */
  onPauseUpload: () => void;
  /** Callback when upload is resumed */
  onResumeUpload: () => void;
  /** Callback when upload is cancelled */
  onCancelUpload: () => void;
  /** Callback when a file is retried */
  onRetryFile: (fileId: string) => void;
  /** Callback when a file is removed */
  onRemoveFile: (fileId: string) => void;
  /** Callback when all files are cleared */
  onClearAll: () => void;
  /** Whether to show detailed progress */
  showDetails?: boolean;
  /** Whether to enable haptic feedback */
  hapticFeedback?: boolean;
  /** Custom className */
  className?: string;
}

export const MobileUploadProgress: React.FC<MobileUploadProgressProps> = ({
  files,
  isUploading,
  onStartUpload,
  onPauseUpload,
  onResumeUpload,
  onCancelUpload,
  onRetryFile,
  onRemoveFile,
  onClearAll,
  showDetails = true,
  hapticFeedback = true,
  className
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);

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

  // Calculate stats
  const stats = React.useMemo(() => {
    const total = files.length;
    const completed = files.filter(f => f.status === 'success').length;
    const failed = files.filter(f => f.status === 'error').length;
    const pending = files.filter(f => f.status === 'pending').length;
    const uploading = files.filter(f => f.status === 'uploading').length;
    const paused = files.filter(f => f.status === 'paused').length;
    
    const totalProgress = total > 0 ? files.reduce((sum, f) => sum + f.progress, 0) / total : 0;
    
    return {
      total,
      completed,
      failed,
      pending,
      uploading,
      paused,
      totalProgress: Math.round(totalProgress)
    };
  }, [files]);

  // Handle action click
  const handleActionClick = useCallback((action: string) => {
    switch (action) {
      case 'start':
        onStartUpload();
        break;
      case 'pause':
        onPauseUpload();
        break;
      case 'resume':
        onResumeUpload();
        break;
      case 'cancel':
        onCancelUpload();
        break;
      case 'retry':
        // Retry all failed files
        files.filter(f => f.status === 'error').forEach(f => onRetryFile(f.id));
        break;
      case 'clear':
        onClearAll();
        break;
    }
    triggerHapticFeedback('medium');
  }, [onStartUpload, onPauseUpload, onResumeUpload, onCancelUpload, onRetryFile, onClearAll, files, triggerHapticFeedback]);

  // Handle file action
  const handleFileAction = useCallback((fileId: string, action: string) => {
    switch (action) {
      case 'retry':
        onRetryFile(fileId);
        break;
      case 'remove':
        onRemoveFile(fileId);
        break;
    }
    triggerHapticFeedback('light');
  }, [onRetryFile, onRemoveFile, triggerHapticFeedback]);

  // Format file size
  const formatFileSize = useCallback((bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }, []);

  // Auto-expand when upload starts
  useEffect(() => {
    if (isUploading && !isExpanded) {
      setIsExpanded(true);
    }
  }, [isUploading, isExpanded]);

  if (files.length === 0) {
    return null;
  }

  return (
    <div className={cn(
      'fixed bottom-4 left-4 right-4 z-50 transition-all duration-300 ease-out',
      className
    )}>
      {/* Main Progress Card */}
      <div className="bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div 
          className="p-4 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                <Upload className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">
                  Upload Progress
                </h3>
                <p className="text-sm text-gray-500">
                  {stats.completed} of {stats.total} completed
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Progress Badge */}
              <Badge variant="secondary" className="text-xs">
                {stats.totalProgress}%
              </Badge>
              
              {/* Status Icons */}
              {stats.failed > 0 && (
                <AlertCircle className="h-4 w-4 text-red-500" />
              )}
              {stats.completed === stats.total && stats.total > 0 && (
                <Check className="h-4 w-4 text-green-500" />
              )}
              
              {/* Expand/Collapse Icon */}
              <div className={cn(
                'transform transition-transform duration-200',
                isExpanded ? 'rotate-180' : 'rotate-0'
              )}>
                <MoreHorizontal className="h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-3">
            <Progress value={stats.totalProgress} className="h-2" />
          </div>
        </div>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="border-t border-gray-200">
            {/* Action Buttons */}
            <div className="p-4 border-b border-gray-100">
              <div className="flex flex-wrap gap-2">
                {stats.pending > 0 && !isUploading && (
                  <Button
                    size="sm"
                    onClick={() => handleActionClick('start')}
                    className="flex items-center gap-1"
                  >
                    <Play className="h-3 w-3" />
                    Start Upload
                  </Button>
                )}
                
                {isUploading && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleActionClick('pause')}
                    className="flex items-center gap-1"
                  >
                    <Pause className="h-3 w-3" />
                    Pause
                  </Button>
                )}
                
                {stats.paused > 0 && (
                  <Button
                    size="sm"
                    onClick={() => handleActionClick('resume')}
                    className="flex items-center gap-1"
                  >
                    <Play className="h-3 w-3" />
                    Resume
                  </Button>
                )}
                
                {isUploading && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleActionClick('cancel')}
                    className="flex items-center gap-1"
                  >
                    <X className="h-3 w-3" />
                    Cancel
                  </Button>
                )}
                
                {stats.failed > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleActionClick('retry')}
                    className="flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Retry Failed
                  </Button>
                )}
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleActionClick('clear')}
                  className="flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Clear All
                </Button>
              </div>
            </div>

            {/* File List */}
            {showDetails && (
              <div className="max-h-64 overflow-y-auto">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center space-x-3 p-3 border-b border-gray-100 last:border-b-0"
                  >
                    {/* File Icon */}
                    <div className="flex-shrink-0">
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center',
                        {
                          'bg-gray-100': file.status === 'pending',
                          'bg-blue-100': file.status === 'uploading',
                          'bg-green-100': file.status === 'success',
                          'bg-red-100': file.status === 'error',
                          'bg-yellow-100': file.status === 'paused'
                        }
                      )}>
                        {file.status === 'success' ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : file.status === 'error' ? (
                          <X className="h-4 w-4 text-red-600" />
                        ) : file.status === 'paused' ? (
                          <Pause className="h-4 w-4 text-yellow-600" />
                        ) : (
                          <FileImage className="h-4 w-4 text-gray-600" />
                        )}
                      </div>
                    </div>

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.file.name}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file.file.size)}
                        </p>
                        <Badge 
                          variant={
                            file.status === 'success' ? 'default' :
                            file.status === 'error' ? 'destructive' :
                            file.status === 'uploading' ? 'secondary' :
                            'outline'
                          }
                          className="text-xs"
                        >
                          {file.status}
                        </Badge>
                      </div>
                      
                      {/* Progress Bar */}
                      {file.status === 'uploading' && (
                        <div className="mt-2">
                          <Progress value={file.progress} className="h-1" />
                        </div>
                      )}
                      
                      {/* Error Message */}
                      {file.status === 'error' && file.error && (
                        <p className="text-xs text-red-600 mt-1 truncate">
                          {file.error}
                        </p>
                      )}
                    </div>

                    {/* File Actions */}
                    <div className="flex items-center space-x-1">
                      {file.status === 'error' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleFileAction(file.id, 'retry')}
                          className="h-8 w-8 p-0"
                          title="Retry upload"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleFileAction(file.id, 'remove')}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                        title="Remove file"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileUploadProgress;





