/**
 * Utility functions for generating image URLs
 */

import { urlResolver } from '../services/urlResolver';

/**
 * Get the URL for an image file with optional size parameter
 * @param imageId - The image ID
 * @param size - The size variant (original, large, medium, small, thumbnail)
 * @returns The full URL to the image
 */
export const getImageUrl = (imageId: number, size: string = 'medium'): string => {
  return urlResolver.getImageUrl(imageId, size as any);
};

/**
 * Get the thumbnail URL for an image
 * @param imageId - The image ID
 * @returns The full URL to the image thumbnail
 */
export const getThumbnailUrl = (imageId: number): string => {
  return getImageUrl(imageId, 'medium');
};

/**
 * Get the original image URL
 * @param imageId - The image ID
 * @returns The full URL to the original image
 */
export const getOriginalImageUrl = (imageId: number): string => {
  return getImageUrl(imageId, 'original');
};

/**
 * Get the best available image URL from an image object
 * This function handles both the thumbnail_url field from the backend
 * and falls back to generating the URL if needed
 * @param image - The image object
 * @param size - The desired size (default: medium)
 * @returns The best available image URL
 */
export const getBestImageUrl = (image: any, size: string = 'medium'): string => {
  // If the image has a thumbnail_url field, use it
  if (image.thumbnail_url) {
    return image.thumbnail_url;
  }
  
  // If the image has a url field, use it
  if (image.url) {
    return image.url;
  }
  
  // Fall back to generating the URL
  return getImageUrl(image.id, size);
};

/**
 * Get smart image URL for display devices with resolution matching
 * @param imageId - The image ID
 * @param deviceToken - The device token for resolution matching
 * @returns The smart image URL
 */
export const getSmartImageUrl = (imageId: number, deviceToken?: string): string => {
  const baseUrl = urlResolver.getApiUrl(`/images/${imageId}/smart`);
  return deviceToken ? `${baseUrl}?device_token=${deviceToken}` : baseUrl;
};

/**
 * Get smart image URL from an image object for display devices
 * @param image - The image object
 * @param deviceToken - The device token for resolution matching
 * @returns The smart image URL
 */
export const getSmartImageUrlFromImage = (image: any, deviceToken?: string): string => {
  return getSmartImageUrl(image.id, deviceToken);
};



