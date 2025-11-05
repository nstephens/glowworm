import React, { useState, useCallback } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { 
  Check, 
  X, 
  Trash2, 
  Download, 
  Share, 
  Star,
  Smartphone,
  Mouse,
  Zap
} from 'lucide-react';
import { TouchImageCard } from './TouchImageCard';
import { useTouchSelection } from '../../hooks/useTouchSelection';
import type { Image, Album } from '../../types';

interface TouchSelectionDemoProps {
  images: Image[];
  albums: Album[];
}

/**
 * Demo component showcasing touch-optimized image selection
 */
export const TouchSelectionDemo: React.FC<TouchSelectionDemoProps> = ({
  images,
  albums
}) => {
  const [selectedImages, setSelectedImages] = useState<Image[]>([]);
  const [showInstructions, setShowInstructions] = useState(true);

  // Touch selection hook
  const {
    selectedIds,
    isSelected,
    toggleSelection,
    selectItem,
    selectItems,
    clearSelection,
    selectAll,
    selectedCount,
    hasSelection
  } = useTouchSelection({
    multiSelect: true,
    longPressSelection: true,
    hapticFeedback: true,
    onSelectionChange: (selectedIds) => {
      const selected = images.filter(img => selectedIds.has(img.id));
      setSelectedImages(selected);
    }
  });

  const handleImageSelect = useCallback((image: Image, event: React.MouseEvent | React.TouchEvent) => {
    if (event.type === 'click' && (event as React.MouseEvent).ctrlKey || (event as React.MouseEvent).metaKey) {
      toggleSelection(image.id, event);
    } else {
      selectItem(image.id, event);
    }
  }, [toggleSelection, selectItem]);

  const handleImageDelete = useCallback((image: Image) => {
    console.log('Delete image:', image);
  }, []);

  const handleViewFullSize = useCallback((image: Image) => {
    console.log('View full size:', image);
  }, []);

  const handleBulkAction = useCallback((action: string) => {
    console.log('Bulk action:', action, 'on', selectedImages);
  }, [selectedImages]);

  const handleSelectAll = useCallback(() => {
    if (selectedCount === images.length) {
      clearSelection();
    } else {
      selectAll(images.map(img => img.id));
    }
  }, [selectedCount, images.length, clearSelection, selectAll, images]);

  return (
    <div className="space-y-6">
      {/* Instructions */}
      {showInstructions && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="h-5 w-5 text-blue-600" />
              Touch Selection Demo
            </CardTitle>
            <CardDescription>
              Try different selection methods on the images below
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  Touch Interactions
                </h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• <strong>Tap:</strong> Select single image</li>
                  <li>• <strong>Long press:</strong> Multi-select mode</li>
                  <li>• <strong>Tap selected:</strong> Deselect</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium flex items-center gap-2">
                  <Mouse className="h-4 w-4" />
                  Mouse Interactions
                </h4>
                <ul className="space-y-1 text-gray-600">
                  <li>• <strong>Click:</strong> Select single image</li>
                  <li>• <strong>Ctrl+Click:</strong> Multi-select</li>
                  <li>• <strong>Click selected:</strong> Deselect</li>
                </ul>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInstructions(false)}
              className="w-full"
            >
              Got it!
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Selection Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Selection Controls</CardTitle>
              <CardDescription>
                {selectedCount} of {images.length} images selected
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {hasSelection && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectAll}
                >
                  {selectedCount === images.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
              {hasSelection && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSelection}
                >
                  <X className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {hasSelection && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  {selectedCount} selected
                </Badge>
                <Badge variant="outline">
                  {Math.round((selectedCount / images.length) * 100)}% of total
                </Badge>
              </div>
              
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('download')}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('share')}
                >
                  <Share className="h-4 w-4 mr-2" />
                  Share
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction('favorite')}
                >
                  <Star className="h-4 w-4 mr-2" />
                  Favorite
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleBulkAction('delete')}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {images.slice(0, 12).map((image) => (
          <TouchImageCard
            key={image.id}
            image={image}
            albums={albums}
            isSelected={isSelected(image.id)}
            onSelect={handleImageSelect}
            onDelete={handleImageDelete}
            onViewFullSize={handleViewFullSize}
            onAction={(action, image) => {
              console.log('Action:', action, 'on', image);
            }}
            showSelection={true}
            enableMultiSelect={true}
            enableLongPress={true}
          />
        ))}
      </div>

      {/* Selection Summary */}
      {hasSelection && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <h4 className="font-medium text-green-800">Selected Images</h4>
              <div className="flex flex-wrap gap-2">
                {selectedImages.map((image) => (
                  <Badge key={image.id} variant="secondary" className="text-xs">
                    {image.original_filename}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TouchSelectionDemo;





