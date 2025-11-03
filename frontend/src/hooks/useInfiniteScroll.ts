import { useState, useCallback, useRef, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';

interface UseInfiniteScrollOptions {
  /** Function to fetch more data */
  fetchMore: () => Promise<any>;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Whether currently fetching more data */
  isFetching: boolean;
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Threshold for intersection observer */
  threshold?: number;
  /** Delay before triggering fetch (in ms) */
  delay?: number;
  /** Maximum number of retries on error */
  maxRetries?: number;
}

interface UseInfiniteScrollReturn {
  /** Ref to attach to the element that should trigger loading */
  loadMoreRef: (node?: Element | null) => void;
  /** Whether the load more element is in view */
  inView: boolean;
  /** Whether currently loading more data */
  isLoadingMore: boolean;
  /** Error state */
  error: Error | null;
  /** Retry function */
  retry: () => void;
  /** Reset function */
  reset: () => void;
}

/**
 * Custom hook for infinite scroll functionality
 * 
 * @param options Configuration options for infinite scroll
 * @returns Object with refs and state for infinite scroll
 */
export const useInfiniteScroll = ({
  fetchMore,
  hasMore,
  isFetching,
  rootMargin = '100px',
  threshold = 0.1,
  delay = 0,
  maxRetries = 3
}: UseInfiniteScrollOptions): UseInfiniteScrollReturn => {
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Intersection observer hook
  const { ref: loadMoreRef, inView } = useInView({
    rootMargin,
    threshold,
    triggerOnce: false,
  });

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Fetch more data with error handling and retries
  const fetchMoreData = useCallback(async () => {
    if (isFetching || isLoadingMore || !hasMore || error) {
      return;
    }

    setIsLoadingMore(true);
    setError(null);

    try {
      await fetchMore();
      setRetryCount(0);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch more data');
      
      if (retryCount < maxRetries) {
        setRetryCount(prev => prev + 1);
        // Exponential backoff for retries
        const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
        setTimeout(() => {
          if (isMountedRef.current) {
            fetchMoreData();
          }
        }, retryDelay);
      } else {
        setError(error);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingMore(false);
      }
    }
  }, [fetchMore, isFetching, isLoadingMore, hasMore, error, retryCount, maxRetries]);

  // Trigger fetch when element comes into view
  useEffect(() => {
    if (inView && hasMore && !isFetching && !isLoadingMore && !error) {
      if (delay > 0) {
        timeoutRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            fetchMoreData();
          }
        }, delay);
      } else {
        fetchMoreData();
      }
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [inView, hasMore, isFetching, isLoadingMore, error, delay, fetchMoreData]);

  // Retry function
  const retry = useCallback(() => {
    setError(null);
    setRetryCount(0);
    fetchMoreData();
  }, [fetchMoreData]);

  // Reset function
  const reset = useCallback(() => {
    setError(null);
    setRetryCount(0);
    setIsLoadingMore(false);
  }, []);

  return {
    loadMoreRef,
    inView,
    isLoadingMore,
    error,
    retry,
    reset
  };
};

export default useInfiniteScroll;




