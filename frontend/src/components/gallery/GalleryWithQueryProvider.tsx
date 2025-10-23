import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GalleryShowcase } from './GalleryShowcase';

// Create a client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

/**
 * GalleryWithQueryProvider - Wraps the gallery with React Query provider
 * 
 * This component provides the QueryClient context needed for the
 * MasonryGallery's infinite scroll functionality.
 */
export const GalleryWithQueryProvider: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <GalleryShowcase />
    </QueryClientProvider>
  );
};
