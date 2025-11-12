import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Maximize, 
  Minimize,
  Smartphone,
  Mouse,
  Zap,
  Eye,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { MobileImageViewer } from './MobileImageViewer';
import { usePinchZoom } from '../../hooks/usePinchZoom';
import { useSwipeNavigation } from '../../hooks/useSwipeNavigation';
import type { Image } from '../../types';

interface PinchZoomDemoProps {
  images: Image[];
}

/**
 * Demo component showcasing pinch-to-zoom and swipe navigation
 */
export const PinchZoomDemo: React.FC<PinchZoomDemoProps> = ({
  images
}) => {
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [demoMode, setDemoMode] = useState<'viewer' | 'hook'>('viewer');

  // Pinch zoom hook demo
  const {
    zoom,
    pan,
    isZooming,
    isPanning,
    isDoubleTapping,
    reset: resetZoom,
    setZoom,
    touchHandlers: zoomTouchHandlers,
    mouseHandlers: zoomMouseHandlers,
    wheelHandlers: zoomWheelHandlers
  } = usePinchZoom({
    minZoom: 0.5,
    maxZoom: 5,
    initialZoom: 1,
    enableDoubleTap: true,
    enablePinch: true,
    enablePan: true,
    hapticFeedback: true,
    onZoomChange: (newZoom) => {
      console.log('Zoom changed:', newZoom);
    },
    onPanChange: (newPan) => {
      console.log('Pan changed:', newPan);
    }
  });

  // Swipe navigation hook demo
  const {
    currentIndex,
    isSwiping,
    swipeDirection,
    canGoPrevious,
    canGoNext,
    goPrevious,
    goNext,
    goToIndex,
    touchHandlers: swipeTouchHandlers,
    mouseHandlers: swipeMouseHandlers
  } = useSwipeNavigation({
    totalItems: images.length,
    currentIndex: viewerIndex,
    enabled: true,
    minSwipeDistance: 50,
    maxSwipeTime: 300,
    hapticFeedback: true,
    onIndexChange: (newIndex) => {
      setViewerIndex(newIndex);
      console.log('Index changed:', newIndex);
    },
    onSwipeStart: (direction) => {
      console.log('Swipe started:', direction);
    },
    onSwipeEnd: (direction) => {
      console.log('Swipe ended:', direction);
    }
  });

  const handleOpenViewer = useCallback((index: number) => {
    setViewerIndex(index);
    setShowImageViewer(true);
  }, []);

  const handleImageAction = useCallback((action: string, image: Image) => {
    console.log('Image action:', action, image);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoom(Math.min(5, zoom * 1.2));
  }, [zoom, setZoom]);

  const handleZoomOut = useCallback(() => {
    setZoom(Math.max(0.5, zoom / 1.2));
  }, [zoom, setZoom]);

  const handleResetZoom = useCallback(() => {
    resetZoom();
  }, [resetZoom]);

  return (
    <div className="space-y-6">
      {/* Demo Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            Pinch-to-Zoom & Swipe Navigation Demo
          </CardTitle>
          <CardDescription>
            Test advanced touch gestures and navigation features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Selection */}
          <div className="space-y-2">
            <h4 className="font-medium">Demo Mode</h4>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={demoMode === 'viewer' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDemoMode('viewer')}
                className="flex items-center gap-2"
              >
                <Eye className="h-4 w-4" />
                Full Image Viewer
              </Button>
              <Button
                variant={demoMode === 'hook' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setDemoMode('hook')}
                className="flex items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                Hook Demo
              </Button>
            </div>
          </div>

          {/* Viewer Controls */}
          {demoMode === 'viewer' && (
            <div className="space-y-2">
              <h4 className="font-medium">Viewer Controls</h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenViewer(0)}
                >
                  Open First Image
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenViewer(Math.floor(images.length / 2))}
                >
                  Open Middle Image
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenViewer(images.length - 1)}
                >
                  Open Last Image
                </Button>
              </div>
            </div>
          )}

          {/* Hook Demo Controls */}
          {demoMode === 'hook' && (
            <div className="space-y-2">
              <h4 className="font-medium">Hook Demo Controls</h4>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goPrevious}
                  disabled={!canGoPrevious}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goNext}
                  disabled={!canGoNext}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleZoomIn}
                >
                  <ZoomIn className="h-4 w-4 mr-1" />
                  Zoom In
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleZoomOut}
                >
                  <ZoomOut className="h-4 w-4 mr-1" />
                  Zoom Out
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetZoom}
                >
                  Reset Zoom
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feature Descriptions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ZoomIn className="h-5 w-5 text-blue-600" />
              Pinch-to-Zoom
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p>• Two-finger pinch to zoom in/out</p>
            <p>• Double-tap to zoom in/out</p>
            <p>• Pan when zoomed in</p>
            <p>• Mouse wheel zoom</p>
            <p>• Haptic feedback</p>
            <p>• Configurable zoom limits</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <ChevronLeft className="h-5 w-5 text-green-600" />
              Swipe Navigation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p>• Swipe left/right to navigate</p>
            <p>• Touch and mouse support</p>
            <p>• Configurable thresholds</p>
            <p>• Boundary detection</p>
            <p>• Visual feedback</p>
            <p>• Keyboard navigation</p>
          </CardContent>
        </Card>
      </div>

      {/* Demo Area */}
      <div className="relative min-h-[400px] bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-8">
        <div className="text-center text-gray-500 mb-4">
          <Smartphone className="h-8 w-8 mx-auto mb-2" />
          <p>Mobile Viewport Demo</p>
          <p className="text-sm">Try the gestures below</p>
        </div>

        {demoMode === 'viewer' ? (
          /* Full Image Viewer Demo */
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {images.slice(0, 8).map((image, index) => (
                <div
                  key={image.id}
                  className="aspect-square bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleOpenViewer(index)}
                >
                  <img
                    src={image.thumbnail_url}
                    alt={image.original_filename}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))}
            </div>
            
            <div className="text-center">
              <Button
                onClick={() => handleOpenViewer(0)}
                className="mt-4"
              >
                Open Image Viewer
              </Button>
            </div>
          </div>
        ) : (
          /* Hook Demo */
          <div className="space-y-4">
            {/* Current Image */}
            <div className="relative max-w-md mx-auto">
              <div
                className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200"
                style={{
                  transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                  transformOrigin: 'center center',
                  touchAction: 'none'
                }}
                {...zoomTouchHandlers}
                {...zoomMouseHandlers}
                {...zoomWheelHandlers}
              >
                <img
                  src={images[currentIndex]?.thumbnail_url}
                  alt={images[currentIndex]?.original_filename}
                  className="w-full h-64 object-cover"
                  draggable={false}
                />
              </div>
              
              {/* Zoom Indicator */}
              <div className="absolute top-2 right-2 bg-black/50 text-white px-2 py-1 rounded text-sm">
                {Math.round(zoom * 100)}%
              </div>
              
              {/* Swipe Direction Indicator */}
              {swipeDirection && (
                <div className={cn(
                  'absolute top-1/2 transform -translate-y-1/2 text-4xl text-gray-400',
                  swipeDirection === 'left' ? 'right-4' : 'left-4'
                )}>
                  {swipeDirection === 'left' ? '→' : '←'}
                </div>
              )}
            </div>

            {/* Status Display */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-2">Zoom Status</h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Zoom:</span>
                    <Badge variant="secondary">{Math.round(zoom * 100)}%</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Pan X:</span>
                    <span className="font-mono">{Math.round(pan.x)}px</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pan Y:</span>
                    <span className="font-mono">{Math.round(pan.y)}px</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Zooming:</span>
                    <Badge variant={isZooming ? 'default' : 'secondary'}>
                      {isZooming ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Panning:</span>
                    <Badge variant={isPanning ? 'default' : 'secondary'}>
                      {isPanning ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <h4 className="font-medium text-gray-900 mb-2">Navigation Status</h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span>Current:</span>
                    <Badge variant="secondary">{currentIndex + 1}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Total:</span>
                    <span>{images.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Swiping:</span>
                    <Badge variant={isSwiping ? 'default' : 'secondary'}>
                      {isSwiping ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Can Prev:</span>
                    <Badge variant={canGoPrevious ? 'default' : 'secondary'}>
                      {canGoPrevious ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Can Next:</span>
                    <Badge variant={canGoNext ? 'default' : 'secondary'}>
                      {canGoNext ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <h4 className="font-medium text-blue-800">How to Test</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• <strong>Pinch-to-zoom:</strong> Use two fingers to pinch in/out</li>
              <li>• <strong>Double-tap:</strong> Tap twice quickly to zoom in/out</li>
              <li>• <strong>Pan:</strong> Drag when zoomed in to move around</li>
              <li>• <strong>Swipe:</strong> Swipe left/right to navigate between images</li>
              <li>• <strong>Mouse:</strong> Use mouse wheel to zoom, drag to pan</li>
              <li>• <strong>Keyboard:</strong> Use arrow keys to navigate, +/- to zoom</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Mobile Image Viewer */}
      <MobileImageViewer
        images={images}
        currentIndex={viewerIndex}
        visible={showImageViewer}
        onVisibilityChange={setShowImageViewer}
        onImageChange={setViewerIndex}
        onImageAction={handleImageAction}
        showControls={true}
        enableSwipe={true}
        enableZoom={true}
        hapticFeedback={true}
      />
    </div>
  );
};

export default PinchZoomDemo;








