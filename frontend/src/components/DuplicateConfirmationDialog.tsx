import React from 'react';
import { AlertTriangle, X, CheckCircle, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Badge } from './ui/badge';
import type { Image } from '../types';

interface DuplicateConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (proceedWithDuplicates: boolean) => void;
  duplicates: Array<{
    fileHash: string;
    filename: string;
    existingImage: Image;
  }>;
  totalFiles: number;
}

export const DuplicateConfirmationDialog: React.FC<DuplicateConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  duplicates,
  totalFiles
}) => {
  const handleProceedWithDuplicates = () => {
    onConfirm(true);
  };

  const handleSkipDuplicates = () => {
    onConfirm(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Duplicate Images Found
          </DialogTitle>
          <DialogDescription>
            {duplicates.length} of {totalFiles} images already exist in your library.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800">What would you like to do?</h4>
                <p className="text-sm text-amber-700 mt-1">
                  You can either upload all images (including duplicates) or skip the duplicates and only upload new images.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Duplicate Images:</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {duplicates.map((duplicate, index) => (
                <div key={duplicate.fileHash} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                      <img 
                        src={`/api/images/${duplicate.existingImage.id}/file?size=thumbnail`}
                        alt={duplicate.existingImage.original_filename}
                        className="w-8 h-8 object-cover rounded"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{duplicate.filename}</p>
                      <p className="text-xs text-gray-500">
                        Already exists as: {duplicate.existingImage.original_filename}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    Duplicate
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleProceedWithDuplicates}
              className="flex-1"
              variant="default"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Upload All ({totalFiles} images)
            </Button>
            <Button
              onClick={handleSkipDuplicates}
              className="flex-1"
              variant="outline"
            >
              <X className="h-4 w-4 mr-2" />
              Skip Duplicates ({totalFiles - duplicates.length} images)
            </Button>
          </div>

          <div className="text-xs text-gray-500 text-center">
            Note: If you choose to upload all images, duplicates will be skipped during the upload process.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

