import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';
import apiService from '../services/api';

/**
 * useRetryProcessing - Hook for retrying failed image processing
 * 
 * Provides a mutation to retry thumbnail and variant generation for images
 * where background processing failed. Resets the circuit breaker and queues
 * new background tasks.
 */
export const useRetryProcessing = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (imageId: number) => {
      const response = await apiService.post(`/api/images/${imageId}/retry-processing`);
      return response.data;
    },
    onMutate: async (imageId) => {
      // Optimistically update the image status to 'pending'
      queryClient.setQueryData(['images'], (oldData: any) => {
        if (!oldData?.pages) return oldData;
        
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            images: page.images.map((img: any) =>
              img.id === imageId
                ? {
                    ...img,
                    processing_status: 'pending',
                    thumbnail_status: 'pending',
                    variant_status: 'pending',
                    processing_error: null,
                  }
                : img
            ),
          })),
        };
      });
      
      toast({
        title: "Retry initiated",
        description: "Processing has been queued. Please wait...",
        duration: 3000,
      });
    },
    onSuccess: (data, imageId) => {
      // Invalidate queries to refetch latest data
      queryClient.invalidateQueries({ queryKey: ['images'] });
      
      console.log(`✅ Retry processing queued for image ${imageId}`);
    },
    onError: (error: any, imageId) => {
      console.error(`Failed to retry processing for image ${imageId}:`, error);
      
      toast({
        title: "Retry failed",
        description: error.message || "Failed to restart processing. Please try again.",
        variant: "destructive",
        duration: 5000,
      });
      
      // Revert optimistic update
      queryClient.invalidateQueries({ queryKey: ['images'] });
    },
  });
};

