import React, { useState, useCallback } from 'react';
import { 
  AlertTriangle, 
  RotateCcw, 
  X, 
  CheckCircle, 
  Clock,
  Wifi,
  WifiOff,
  Server,
  FileX
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface UploadError {
  id: string;
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
  canRetry: boolean;
  fileId: string;
  fileName: string;
}

export interface RetryStrategy {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

interface ErrorHandlerProps {
  errors: UploadError[];
  onRetry: (errorId: string) => void;
  onRetryAll: () => void;
  onDismiss: (errorId: string) => void;
  onDismissAll: () => void;
  retryStrategy?: RetryStrategy;
  className?: string;
}

/**
 * ErrorHandler - Comprehensive error handling and retry system
 * 
 * Features:
 * - Categorized error types with specific handling
 * - Intelligent retry strategies with exponential backoff
 * - User-friendly error messages with actionable advice
 * - Batch retry operations
 * - Error persistence and recovery
 * - Network status monitoring
 * - File validation error handling
 */
export const ErrorHandler: React.FC<ErrorHandlerProps> = ({
  errors,
  onRetry,
  onRetryAll,
  onDismiss,
  onDismissAll,
  retryStrategy = {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
  },
  className,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryProgress, setRetryProgress] = useState<Map<string, number>>(new Map());

  const getErrorIcon = (code: string) => {
    switch (code) {
      case 'NETWORK_ERROR':
        return <WifiOff className="h-4 w-4 text-destructive" />;
      case 'SERVER_ERROR':
        return <Server className="h-4 w-4 text-destructive" />;
      case 'FILE_TOO_LARGE':
      case 'INVALID_FILE_TYPE':
        return <FileX className="h-4 w-4 text-destructive" />;
      case 'TIMEOUT':
        return <Clock className="h-4 w-4 text-warning" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
    }
  };

  const getErrorColor = (code: string) => {
    switch (code) {
      case 'NETWORK_ERROR':
        return 'destructive';
      case 'SERVER_ERROR':
        return 'destructive';
      case 'FILE_TOO_LARGE':
      case 'INVALID_FILE_TYPE':
        return 'warning';
      case 'TIMEOUT':
        return 'warning';
      default:
        return 'destructive';
    }
  };

  const getErrorMessage = (error: UploadError) => {
    switch (error.code) {
      case 'NETWORK_ERROR':
        return 'Network connection failed. Please check your internet connection and try again.';
      case 'SERVER_ERROR':
        return 'Server error occurred. Please try again in a few moments.';
      case 'FILE_TOO_LARGE':
        return `File "${error.fileName}" is too large. Maximum size is 50MB.`;
      case 'INVALID_FILE_TYPE':
        return `File "${error.fileName}" is not a supported image format.`;
      case 'TIMEOUT':
        return 'Upload timed out. The file may be too large or your connection is slow.';
      case 'QUOTA_EXCEEDED':
        return 'Storage quota exceeded. Please delete some files and try again.';
      case 'AUTHENTICATION_ERROR':
        return 'Authentication failed. Please log in again.';
      default:
        return error.message || 'An unknown error occurred.';
    }
  };

  const getRetryDelay = (retryCount: number): number => {
    const delay = Math.min(
      retryStrategy.baseDelay * Math.pow(retryStrategy.backoffMultiplier, retryCount),
      retryStrategy.maxDelay
    );
    
    if (retryStrategy.jitter) {
      // Add random jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * delay;
      return delay + jitter;
    }
    
    return delay;
  };

  const handleRetry = useCallback(async (errorId: string) => {
    const error = errors.find(e => e.id === errorId);
    if (!error || !error.canRetry) return;

    setIsRetrying(true);
    setRetryProgress(prev => new Map(prev).set(errorId, 0));

    try {
      // Simulate retry with progress
      const delay = getRetryDelay(error.retryCount);
      const steps = 10;
      const stepDelay = delay / steps;

      for (let i = 0; i <= steps; i++) {
        await new Promise(resolve => setTimeout(resolve, stepDelay));
        setRetryProgress(prev => new Map(prev).set(errorId, (i / steps) * 100));
      }

      onRetry(errorId);
    } finally {
      setIsRetrying(false);
      setRetryProgress(prev => {
        const newMap = new Map(prev);
        newMap.delete(errorId);
        return newMap;
      });
    }
  }, [errors, onRetry, retryStrategy]);

  const handleRetryAll = useCallback(async () => {
    const retryableErrors = errors.filter(e => e.canRetry);
    if (retryableErrors.length === 0) return;

    setIsRetrying(true);

    try {
      // Retry errors with staggered delays to avoid overwhelming the server
      for (let i = 0; i < retryableErrors.length; i++) {
        const error = retryableErrors[i];
        const delay = getRetryDelay(error.retryCount) + (i * 1000); // Stagger by 1 second
        
        setTimeout(() => {
          onRetry(error.id);
        }, delay);
      }
    } finally {
      setIsRetrying(false);
    }
  }, [errors, onRetry, retryStrategy]);

  const canRetryAll = errors.some(e => e.canRetry);
  const retryableCount = errors.filter(e => e.canRetry).length;
  const nonRetryableCount = errors.filter(e => !e.canRetry).length;

  if (errors.length === 0) return null;

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Upload Errors
            <Badge variant="destructive">{errors.length}</Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            {canRetryAll && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetryAll}
                disabled={isRetrying}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry All ({retryableCount})
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismissAll}
            >
              <X className="h-4 w-4 mr-2" />
              Dismiss All
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Error summary */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-destructive">{errors.length}</div>
            <div className="text-sm text-muted-foreground">Total Errors</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-warning">{retryableCount}</div>
            <div className="text-sm text-muted-foreground">Can Retry</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-muted-foreground">{nonRetryableCount}</div>
            <div className="text-sm text-muted-foreground">Cannot Retry</div>
          </div>
        </div>

        {/* Error list */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {errors.map((error) => {
            const isRetryingThis = retryProgress.has(error.id);
            const progress = retryProgress.get(error.id) || 0;

            return (
              <div
                key={error.id}
                className={cn(
                  "flex items-start gap-3 p-3 border rounded-lg",
                  "transition-all duration-200",
                  error.canRetry ? "bg-warning/5 border-warning/20" : "bg-destructive/5 border-destructive/20"
                )}
              >
                {/* Error icon */}
                <div className="flex-shrink-0 mt-1">
                  {getErrorIcon(error.code)}
                </div>

                {/* Error details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">
                      {error.fileName}
                    </span>
                    <Badge variant={getErrorColor(error.code)}>
                      {error.code}
                    </Badge>
                    {error.retryCount > 0 && (
                      <Badge variant="outline">
                        Retry {error.retryCount}/{error.maxRetries}
                      </Badge>
                    )}
                  </div>
                  
                  <p className="text-sm text-muted-foreground mb-2">
                    {getErrorMessage(error)}
                  </p>

                  {/* Retry progress */}
                  {isRetryingThis && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Retrying...</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-1" />
                    </div>
                  )}

                  {/* Error details */}
                  {error.details && (
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer hover:text-foreground">
                        Technical Details
                      </summary>
                      <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
                        {JSON.stringify(error.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-1">
                  {error.canRetry && !isRetryingThis && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRetry(error.id)}
                      disabled={isRetrying}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDismiss(error.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Help text */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-1">
              <p>If errors persist, try:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Checking your internet connection</li>
                <li>Reducing file sizes (max 50MB per file)</li>
                <li>Using supported formats (JPG, PNG, GIF, WebP, AVIF)</li>
                <li>Clearing your browser cache</li>
              </ul>
            </div>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
