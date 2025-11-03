import React from 'react';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

interface VariantGenerationModalProps {
  isOpen: boolean;
  isGenerating: boolean;
  playlistName?: string;
  variantCount?: number;
  error?: string | null;
  onClose: () => void;
}

export const VariantGenerationModal: React.FC<VariantGenerationModalProps> = ({
  isOpen,
  isGenerating,
  playlistName,
  variantCount,
  error,
  onClose
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="text-center">
          {isGenerating ? (
            <>
              <Loader2 className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Generating Variants...
              </h3>
              {playlistName && (
                <p className="text-sm text-gray-600 mb-4">
                  Creating resolution-optimized variants for <span className="font-medium">{playlistName}</span>
                </p>
              )}
              <p className="text-xs text-gray-500">
                This may take a minute depending on playlist size...
              </p>
            </>
          ) : error ? (
            <>
              <XCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Generation Failed
              </h3>
              <p className="text-sm text-gray-600 mb-4">{error}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </>
          ) : (
            <>
              <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Variants Generated!
              </h3>
              {variantCount !== undefined && (
                <p className="text-sm text-gray-600 mb-4">
                  Created {variantCount} resolution variant{variantCount !== 1 ? 's' : ''}
                  {playlistName && ` for ${playlistName}`}
                </p>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VariantGenerationModal;

