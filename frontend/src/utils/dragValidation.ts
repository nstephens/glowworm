/**
 * Drag-and-Drop Validation Utilities
 * 
 * Validates playlist reorder operations to detect when moves break optimal pairing
 */

interface PairingEntry {
  type: 'single' | 'pair';
  images: number[];
}

interface Image {
  id: number;
  width: number;
  height: number;
}

interface DragValidationResult {
  isValid: boolean;
  warning?: string;
  breaksPairing?: boolean;
  affectedImages?: number[];
  pairLoss?: number;  // Number of pairs lost by this move
}

/**
 * Classify image by aspect ratio
 */
export const classifyImage = (width: number, height: number): 'landscape' | 'portrait' => {
  const aspectRatio = width / height;
  if (aspectRatio > 1.1) return 'landscape';
  return 'portrait';
};

/**
 * Compute pairing sequence for given orientation
 */
const computePairingSequence = (
  images: Image[],
  displayOrientation: 'portrait' | 'landscape'
): PairingEntry[] => {
  const result: PairingEntry[] = [];
  const buffer: Image[] = [];
  
  const pairableType = displayOrientation === 'portrait' ? 'landscape' : 'portrait';
  
  for (const image of images) {
    const imageType = classifyImage(image.width, image.height);
    
    if (imageType === pairableType) {
      buffer.push(image);
      
      if (buffer.length === 2) {
        result.push({
          type: 'pair',
          images: [buffer[0].id, buffer[1].id]
        });
        buffer.length = 0;
      }
    } else {
      // Flush buffer
      if (buffer.length === 1) {
        result.push({
          type: 'single',
          images: [buffer[0].id]
        });
        buffer.length = 0;
      }
      
      result.push({
        type: 'single',
        images: [image.id]
      });
    }
  }
  
  // Flush remaining
  if (buffer.length === 1) {
    result.push({
      type: 'single',
      images: [buffer[0].id]
    });
  }
  
  return result;
};

/**
 * Validate a drag-and-drop move for pairing consistency
 */
export const validateDragMove = (
  sourceIndex: number,
  destinationIndex: number,
  currentSequence: number[],
  images: Image[],
  displayOrientation: 'portrait' | 'landscape'
): DragValidationResult => {
  // Create new sequence with the move applied
  const newSequence = [...currentSequence];
  const [movedImageId] = newSequence.splice(sourceIndex, 1);
  newSequence.splice(destinationIndex, 0, movedImageId);
  
  // Create image map
  const imageMap = new Map(images.map(img => [img.id, img]));
  
  // Get ordered images for both sequences
  const currentOrdered = currentSequence
    .map(id => imageMap.get(id))
    .filter(img => img !== undefined) as Image[];
    
  const newOrdered = newSequence
    .map(id => imageMap.get(id))
    .filter(img => img !== undefined) as Image[];
  
  // Compute pairing for both
  const currentPairing = computePairingSequence(currentOrdered, displayOrientation);
  const newPairing = computePairingSequence(newOrdered, displayOrientation);
  
  // Count pairs in each
  const currentPairs = currentPairing.filter(e => e.type === 'pair').length;
  const newPairs = newPairing.filter(e => e.type === 'pair').length;
  
  // If we lose pairs, it's suboptimal
  const pairLoss = currentPairs - newPairs;
  
  if (pairLoss > 0) {
    return {
      isValid: true,  // Allow but warn
      warning: `This move will reduce optimal pairing by ${pairLoss} pair${pairLoss > 1 ? 's' : ''}`,
      breaksPairing: true,
      pairLoss
    };
  }
  
  if (pairLoss < 0) {
    // Actually improves pairing!
    return {
      isValid: true,
      warning: `This move improves pairing by ${Math.abs(pairLoss)} pair${Math.abs(pairLoss) > 1 ? 's' : ''}! ✨`,
      breaksPairing: false,
      pairLoss: 0
    };
  }
  
  // No change in pairing quality
  return {
    isValid: true,
    breaksPairing: false,
    pairLoss: 0
  };
};

/**
 * Check if two images can form a valid pair
 */
export const canFormPair = (
  image1: Image,
  image2: Image,
  displayOrientation: 'portrait' | 'landscape'
): boolean => {
  const type1 = classifyImage(image1.width, image1.height);
  const type2 = classifyImage(image2.width, image2.height);
  
  // Both must be same orientation
  if (type1 !== type2) return false;
  
  // Must be the pairable type for this display
  const pairableType = displayOrientation === 'portrait' ? 'landscape' : 'portrait';
  
  return type1 === pairableType;
};

/**
 * Get optimal sequence from current sequence
 */
export const getOptimalSequence = (
  currentSequence: number[],
  images: Image[],
  displayOrientation: 'portrait' | 'landscape'
): number[] => {
  const imageMap = new Map(images.map(img => [img.id, img]));
  const orderedImages = currentSequence
    .map(id => imageMap.get(id))
    .filter(img => img !== undefined) as Image[];
  
  const pairing = computePairingSequence(orderedImages, displayOrientation);
  
  return pairing.flatMap(entry => entry.images);
};



