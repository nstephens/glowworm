import React, { useState, useCallback, useEffect } from 'react';
import { MobileMasonryGallery } from './MobileMasonryGallery';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { RefreshCw, AlertCircle } from 'lucide-react';
import type { Image, Album } from '../../types';

interface InfiniteScrollDemoProps {
  /** Initial images to display */
  initialImages?: Image[];
  /** Albums for the gallery */
  albums: Album[];
  /** Function to fetch more images from API */
  fetchImages: (page: number, limit?: number) => Promise<{ images: Image[]; hasMore: boolean }>;
  /** Page size for pagination */
  pageSize?: number;
}

/**
 * Demo component showing how to use MobileMasonryGallery with infinite scroll
 */
export const InfiniteScrollDemo: React.FC<InfiniteScrollDemoProps> = ({
  initialImages = [],
  albums,
  fetchImages,
  pageSize = 20
}) => {
  const [images, setImages] = useState<Image[]>(initialImages);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(initialImages.length === 0);

  // Load more images function
  const loadMoreImages = useCallback(async () => {
    if (isFetchingMore || !hasMore) return;

    setIsFetchingMore(true);
    setError(null);

    try {
      const result = await fetchImages(currentPage, pageSize);
      
      setImages(prev => [...prev, ...result.images]);
      setHasMore(result.hasMore);
      setCurrentPage(prev => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load images'));
    } finally {
      setIsFetchingMore(false);
    }
  }, [currentPage, isFetchingMore, hasMore, fetchImages, pageSize]);

  // Initial load
  useEffect(() => {
    if (isInitialLoad) {
      loadMoreImages();
      setIsInitialLoad(false);
    }
  }, [isInitialLoad, loadMoreImages]);

  // Handle image selection
  const handleImageSelect = useCallback((image: Image) => {
    console.log('Selected image:', image);
  }, []);

  // Handle image deletion
  const handleImageDelete = useCallback((image: Image) => {
    setImages(prev => prev.filter(img => img.id !== image.id));
  }, []);

  // Handle bulk deletion
  const handleBulkDelete = useCallback((imageIds: number[]) => {
    setImages(prev => prev.filter(img => !imageIds.includes(img.id)));
  }, []);

  // Handle image move
  const handleImageMove = useCallback((image: Image, albumId: number) => {
    console.log('Move image:', image, 'to album:', albumId);
    // Implement move logic here
  }, []);

  // Handle upload click
  const handleUploadClick = useCallback(() => {
    console.log('Upload clicked');
    // Implement upload logic here
  }, []);

  // Retry function
  const handleRetry = useCallback(() => {
    setError(null);
    loadMoreImages();
  }, [loadMoreImages]);

  // Reset function
  const handleReset = useCallback(() => {
    setImages(initialImages);
    setCurrentPage(1);
    setHasMore(true);
    setError(null);
    setIsInitialLoad(initialImages.length === 0);
  }, [initialImages]);

  return (
    <div className="space-y-4">
      {/* Demo Controls */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">
            {images.length} images loaded
          </span>
          {hasMore && (
            <span className="text-sm text-green-600">
              {isFetchingMore ? 'Loading...' : 'More available'}
            </span>
          )}
          {!hasMore && images.length > 0 && (
            <span className="text-sm text-gray-500">
              All images loaded
            </span>
          )}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isFetchingMore}
          >
            Reset
          </Button>
          {error && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetry}
              disabled={isFetchingMore}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Mobile Masonry Gallery */}
      <MobileMasonryGallery
        images={images}
        albums={albums}
        onImageSelect={handleImageSelect}
        onImageDelete={handleImageDelete}
        onBulkDelete={handleBulkDelete}
        onImageMove={handleImageMove}
        onUploadClick={handleUploadClick}
        loading={isInitialLoad}
        onLoadMore={loadMoreImages}
        hasMore={hasMore}
        isFetchingMore={isFetchingMore}
        infiniteScrollError={error}
        onRetryInfiniteScroll={handleRetry}
      />
    </div>
  );
};

export default InfiniteScrollDemo;





