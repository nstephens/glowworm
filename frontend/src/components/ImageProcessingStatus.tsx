import React from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { useRetryProcessing } from '../hooks/useRetryProcessing';

interface ImageProcessingStatusProps {
  imageId: number;
  processingStatus?: 'pending' | 'processing' | 'complete' | 'failed';
  thumbnailStatus?: 'pending' | 'processing' | 'complete' | 'failed';
  variantStatus?: 'pending' | 'processing' | 'complete' | 'failed';
  processingError?: string | null;
  className?: string;
}

/**
 * ImageProcessingStatus - Component for displaying background processing status
 * 
 * Shows status badges and retry buttons for images being processed in the background.
 * Handles different processing states (pending, processing, complete, failed) and
 * provides visual feedback to users.
 * 
 * Features:
 * - Processing indicator with animated spinner
 * - Error state with retry button
 * - Stage-specific status (thumbnails vs variants)
 * - Graceful fallback handling
 */
export const ImageProcessingStatus: React.FC<ImageProcessingStatusProps> = ({
  imageId,
  processingStatus = 'complete',
  thumbnailStatus = 'complete',
  variantStatus = 'complete',
  processingError,
  className = '',
}) => {
  const retryMutation = useRetryProcessing();

  // Don't show anything if processing is complete
  if (processingStatus === 'complete' && !processingError) {
    return null;
  }

  // Failed state with retry button
  if (processingStatus === 'failed' || processingError) {
    return (
      <div className={`absolute top-2 right-2 bg-red-500/90 text-white px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2 ${className}`}>
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm font-medium">Processing failed</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-white hover:bg-red-600"
          onClick={() => retryMutation.mutate(imageId)}
          disabled={retryMutation.isPending}
        >
          {retryMutation.isPending ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <RefreshCw className="w-3 h-3" />
          )}
        </Button>
      </div>
    );
  }

  // Processing state with stage indicator
  if (processingStatus === 'processing' || processingStatus === 'pending') {
    let statusText = 'Processing...';
    
    if (thumbnailStatus === 'processing') {
      statusText = 'Generating thumbnails...';
    } else if (thumbnailStatus === 'complete' && variantStatus === 'processing') {
      statusText = 'Generating variants...';
    } else if (thumbnailStatus === 'complete') {
      statusText = 'Finalizing...';
    }
    
    return (
      <div className={`absolute top-2 right-2 bg-blue-500/90 text-white px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2 ${className}`}>
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm font-medium">{statusText}</span>
      </div>
    );
  }

  return null;
};

/**
 * useImageFallback - Hook for handling image loading with fallback to original
 * 
 * Provides smart image URL selection based on processing status.
 * Falls back to original image if thumbnails aren't ready yet.
 * 
 * Usage:
 *   const imageUrl = useImageFallback(image);
 *   <img src={imageUrl} alt={image.filename} />
 */
export const useImageFallback = (image: {
  id: number;
  thumbnail_url?: string;
  url?: string;
  thumbnail_status?: string;
}) => {
  // If thumbnail is complete, use thumbnail URL
  if (image.thumbnail_status === 'complete' && image.thumbnail_url) {
    return image.thumbnail_url;
  }
  
  // Fall back to original image (scaled down by browser if needed)
  return image.url || image.thumbnail_url || '';
};

