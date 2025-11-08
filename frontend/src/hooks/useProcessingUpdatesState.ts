import { useEffect } from 'react';
import type { Image } from '../types';

/**
 * useProcessingUpdatesState - Hook for handling real-time image processing WebSocket updates
 * 
 * State-based version for components using useState instead of React Query.
 * Listens to WebSocket events and updates the images state directly.
 * 
 * Events handled:
 * - image:processing:thumbnail_complete - Thumbnails generated
 * - image:processing:variant_complete - Display variants generated
 * - image:processing:complete - All processing finished
 * - image:processing:failed - Processing failed
 */
export const useProcessingUpdatesState = (
  images: Image[],
  setImages: React.Dispatch<React.SetStateAction<Image[]>>
) => {
  useEffect(() => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const wsUrl = `${wsProtocol}//${wsHost}/api/ws/admin`;
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    
    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          // Connected to processing updates
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
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };
        
        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };
        
        ws.onclose = () => {
          console.log('WebSocket disconnected, will reconnect in 5s...');
          // Reconnect after 5 seconds
          reconnectTimeout = setTimeout(connect, 5000);
        };
      } catch (error) {
        console.error('Failed to connect to WebSocket:', error);
        // Retry connection after 5 seconds
        reconnectTimeout = setTimeout(connect, 5000);
      }
    };
    
    // Event handlers
    const handleThumbnailComplete = (message: any) => {
      setImages((prevImages) =>
        prevImages.map((img) =>
          img.id === message.image_id
            ? {
                ...img,
                thumbnail_status: 'complete' as const,
                // Keep processing status if variants aren't done yet
                processing_status:
                  img.variant_status === 'complete' ? ('complete' as const) : ('processing' as const),
              }
            : img
        )
      );
    };
    
    const handleVariantComplete = (message: any) => {
      setImages((prevImages) =>
        prevImages.map((img) =>
          img.id === message.image_id
            ? {
                ...img,
                variant_status: 'complete' as const,
                // Keep processing status if thumbnails aren't done yet
                processing_status:
                  img.thumbnail_status === 'complete' ? ('complete' as const) : ('processing' as const),
              }
            : img
        )
      );
    };
    
    const handleProcessingComplete = (message: any) => {
      setImages((prevImages) =>
        prevImages.map((img) =>
          img.id === message.image_id
            ? {
                ...img,
                processing_status: 'complete' as const,
                thumbnail_status: 'complete' as const,
                variant_status: 'complete' as const,
                processing_error: null,
              }
            : img
        )
      );
    };
    
    const handleProcessingFailed = (message: any) => {
      setImages((prevImages) =>
        prevImages.map((img) =>
          img.id === message.image_id
            ? {
                ...img,
                processing_status: 'failed' as const,
                processing_error: message.error || 'Processing failed',
              }
            : img
        )
      );
    };
    
    // Connect to WebSocket
    connect();
    
    // Cleanup on unmount
    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws) {
        ws.close();
        ws = null;
      }
    };
  }, [setImages]); // Only depend on setImages, not images array
};
