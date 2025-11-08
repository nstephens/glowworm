import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from './use-toast';

/**
 * useProcessingUpdates - Hook for handling real-time image processing WebSocket updates
 * 
 * Listens to WebSocket events for background image processing and updates the
 * React Query cache in real-time, providing instant feedback to users.
 * 
 * Events handled:
 * - image:processing:thumbnail_complete - Thumbnails generated
 * - image:processing:variant_complete - Display variants generated
 * - image:processing:complete - All processing finished
 * - image:processing:failed - Processing failed
 */
export const useProcessingUpdates = () => {
  const queryClient = useQueryClient();
  
  // Track processed images count for logging
  const processedCountRef = useRef(0);
  const failedCountRef = useRef(0);

  useEffect(() => {
    // Get the WebSocket client (assuming it's a global or context-provided)
    // For now, we'll use the browser's native WebSocket
    // TODO: Integrate with existing WebSocketClient if available
    
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/ws/admin`;
    let ws: WebSocket | null = null;
    
    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          console.log('✅ Connected to processing updates WebSocket');
        };
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            // Handle different event types
            switch (message.type) {
              case 'image:processing:thumbnail_complete':
                handleThumbnailComplete(message);
                break;
                
              case 'image:processing:variant_complete':
                handleVariantComplete(message);
                break;
                
              case 'image:processing:complete':
                handleProcessingComplete(message);
                break;
                
              case 'image:processing:failed':
                handleProcessingFailed(message);
                break;
                
              default:
                // Ignore other message types
                break;
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
        
        ws.onclose = () => {
          console.log('WebSocket disconnected, will reconnect...');
          // Reconnect after 5 seconds
          setTimeout(connect, 5000);
        };
      } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
        // Retry connection after 5 seconds
        setTimeout(connect, 5000);
      }
    };
    
    // Event handlers
    const handleThumbnailComplete = (data: any) => {
      queryClient.setQueryData(['images'], (oldData: any) => {
        if (!oldData?.pages) return oldData;
        
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            images: page.images.map((img: any) =>
              img.id === data.image_id
                ? { 
                    ...img, 
                    thumbnail_status: 'complete',
                    // Keep processing flag if variants aren't done yet
                    processing_status: img.variant_status === 'complete' ? 'complete' : 'processing'
                  }
                : img
            ),
          })),
        };
      });
      
      console.log(`✅ Thumbnails complete for image ${data.image_id}`);
    };
    
    const handleVariantComplete = (data: any) => {
      queryClient.setQueryData(['images'], (oldData: any) => {
        if (!oldData?.pages) return oldData;
        
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            images: page.images.map((img: any) =>
              img.id === data.image_id
                ? { 
                    ...img, 
                    variant_status: 'complete',
                    // Keep processing flag if thumbnails aren't done yet
                    processing_status: img.thumbnail_status === 'complete' ? 'complete' : 'processing'
                  }
                : img
            ),
          })),
        };
      });
      
      console.log(`✅ Variants complete for image ${data.image_id}`);
    };
    
    const handleProcessingComplete = (data: any) => {
      queryClient.setQueryData(['images'], (oldData: any) => {
        if (!oldData?.pages) return oldData;
        
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            images: page.images.map((img: any) =>
              img.id === data.image_id
                ? { 
                    ...img, 
                    processing_status: 'complete',
                    thumbnail_status: 'complete',
                    variant_status: 'complete',
                    processing_error: null
                  }
                : img
            ),
          })),
        };
      });
      
      // Increment counter silently (no toast)
      processedCountRef.current += 1;
      
      console.log(`🎉 All processing complete for image ${data.image_id} (total: ${processedCountRef.current})`);
    };
    
    const handleProcessingFailed = (data: any) => {
      queryClient.setQueryData(['images'], (oldData: any) => {
        if (!oldData?.pages) return oldData;
        
        return {
          ...oldData,
          pages: oldData.pages.map((page: any) => ({
            ...page,
            images: page.images.map((img: any) =>
              img.id === data.image_id
                ? { 
                    ...img, 
                    processing_status: 'failed',
                    processing_error: data.error || 'Processing failed'
                  }
                : img
            ),
          })),
        };
      });
      
      // Increment failure counter silently (badge will show failure)
      failedCountRef.current += 1;
      
      console.error(`❌ Processing failed for image ${data.image_id}:`, data.error);
    };
    
    // Connect to WebSocket
    connect();
    
    // Cleanup on unmount
    return () => {
      if (ws) {
        ws.close();
        ws = null;
      }
    };
  }, [queryClient]);
};

