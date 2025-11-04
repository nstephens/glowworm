import React from 'react';
import { Image as ImageIcon, Link2 } from 'lucide-react';

interface PairingEntry {
  type: 'single' | 'pair';
  images: number[];
}

interface Image {
  id: number;
  original_filename: string;
  width: number;
  height: number;
}

interface PlaylistPairingViewProps {
  /** Computed pairing sequence */
  computedSequence: PairingEntry[] | null;
  /** Full list of images */
  images: Image[];
  /** Display orientation for this playlist */
  displayOrientation: 'portrait' | 'landscape';
  /** Whether to show warnings for suboptimal pairing */
  showWarnings?: boolean;
  /** Compact mode (smaller display) */
  compact?: boolean;
}

/**
 * Classify image by aspect ratio
 */
const classifyImage = (width: number, height: number): 'landscape' | 'portrait' => {
  const aspectRatio = width / height;
  if (aspectRatio > 1.1) return 'landscape';
  return 'portrait';
};

/**
 * Check if an image should ideally be paired based on display orientation
 */
const shouldBePaired = (image: Image, displayOrientation: 'portrait' | 'landscape'): boolean => {
  const imageType = classifyImage(image.width, image.height);
  
  // Portrait display: landscapes should be paired
  if (displayOrientation === 'portrait') {
    return imageType === 'landscape';
  }
  
  // Landscape display: portraits should be paired
  return imageType === 'portrait';
};

/**
 * Component to visualize playlist image pairing structure
 */
export const PlaylistPairingView: React.FC<PlaylistPairingViewProps> = ({
  computedSequence,
  images,
  displayOrientation,
  showWarnings = true,
  compact = false
}) => {
  if (!computedSequence || computedSequence.length === 0) {
    return (
      <div className="text-sm text-gray-500 italic">
        No pairing structure computed yet. Save the playlist to compute optimal pairing.
      </div>
    );
  }

  // Create image map for quick lookup
  const imageMap = new Map(images.map(img => [img.id, img]));

  return (
    <div className="playlist-pairing-view">
      {/* Legend */}
      {!compact && (
        <div className="flex items-center gap-4 mb-3 text-xs text-gray-600">
          <div className="flex items-center gap-1">
            <ImageIcon className="w-3 h-3" />
            <span>Single (Full Screen)</span>
          </div>
          <div className="flex items-center gap-1">
            <Link2 className="w-3 h-3" />
            <span>Paired (Split Screen)</span>
          </div>
        </div>
      )}

      {/* Pairing List */}
      <div className="space-y-1">
        {computedSequence.map((entry, entryIndex) => {
          if (entry.type === 'single') {
            const image = imageMap.get(entry.images[0]);
            if (!image) return null;

            const imageType = classifyImage(image.width, image.height);
            const isUnpaired = shouldBePaired(image, displayOrientation);

            return (
              <div
                key={`entry-${entryIndex}`}
                className={`flex items-center gap-2 py-1 px-2 rounded ${
                  isUnpaired && showWarnings ? 'bg-yellow-50 border-l-2 border-yellow-400' : 'bg-gray-50'
                }`}
              >
                <ImageIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="text-sm text-gray-700 flex-1 truncate">
                  {image.original_filename}
                </span>
                <span className="text-xs text-gray-500 capitalize flex-shrink-0">
                  {imageType}
                </span>
                {isUnpaired && showWarnings && (
                  <span className="text-xs text-yellow-600 flex-shrink-0" title="This image could be paired with another for better screen utilization">
                    ⚠️ Unpaired
                  </span>
                )}
              </div>
            );
          } else {
            // Paired images
            const image1 = imageMap.get(entry.images[0]);
            const image2 = imageMap.get(entry.images[1]);

            if (!image1 || !image2) return null;

            const imageType1 = classifyImage(image1.width, image1.height);
            const imageType2 = classifyImage(image2.width, image2.height);

            return (
              <div
                key={`entry-${entryIndex}`}
                className="bg-blue-50 rounded border-l-2 border-blue-400 py-1"
              >
                {/* First image in pair */}
                <div className="flex items-center gap-2 px-2">
                  <div className="text-gray-400 flex-shrink-0">├─</div>
                  <Link2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700 flex-1 truncate">
                    {image1.original_filename}
                  </span>
                  <span className="text-xs text-gray-500 capitalize flex-shrink-0">
                    {imageType1}
                  </span>
                </div>

                {/* Second image in pair */}
                <div className="flex items-center gap-2 px-2">
                  <div className="text-gray-400 flex-shrink-0">└─</div>
                  <Link2 className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <span className="text-sm text-gray-700 flex-1 truncate">
                    {image2.original_filename}
                  </span>
                  <span className="text-xs text-gray-500 capitalize flex-shrink-0">
                    {imageType2}
                  </span>
                </div>
              </div>
            );
          }
        })}
      </div>

      {/* Info text */}
      {!compact && (
        <div className="mt-3 text-xs text-gray-500">
          <p>
            ℹ️ Pairing optimized for <span className="font-medium capitalize">{displayOrientation}</span> display.
            Images are automatically paired to maximize screen space usage.
          </p>
        </div>
      )}
    </div>
  );
};

export default PlaylistPairingView;

