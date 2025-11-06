import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Smartphone, 
  Touch, 
  Zap, 
  Eye, 
  Download, 
  Share, 
  Trash2,
  Upload,
  Camera,
  Scan
} from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { MobileMasonryGallery } from './MobileMasonryGallery';
import { TouchImageCard } from './TouchImageCard';
import { FloatingActionButton } from '../ui/FloatingActionButton';
import { MobileActionBar } from './MobileActionBar';
import { QuickActionMenu } from './QuickActionMenu';
import { MobileImageViewer } from './MobileImageViewer';
import { useTouchSelection } from '../../hooks/useTouchSelection';
import type { Image, Album } from '../../types';

// Mock data for demonstration
const mockImages: Image[] = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  url: `https://picsum.photos/400/600?random=${i + 1}`,
  thumbnail_url: `https://picsum.photos/200/300?random=${i + 1}`,
  original_filename: `image-${i + 1}.jpg`,
  filename: `image-${i + 1}.jpg`,
  width: 400,
  height: 600,
  size: Math.floor(Math.random() * 1000000) + 100000,
  created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
  album: {
    id: Math.floor(Math.random() * 3) + 1,
    name: `Album ${Math.floor(Math.random() * 3) + 1}`,
  },
}));

const mockAlbums: Album[] = [
  { id: 1, name: 'Nature', description: 'Nature photos' },
  { id: 2, name: 'Urban', description: 'City photos' },
  { id: 3, name: 'Abstract', description: 'Abstract art' },
];

const MobileGalleryDemo: React.FC = () => {
  const [showGallery, setShowGallery] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [viewerImageIndex, setViewerImageIndex] = useState(0);
  const [showQuickActions, setShowQuickActions] = useState(false);

  const {
    selectedIds,
    isSelected,
    toggleSelection,
    selectItem,
    clearSelection,
    selectAll,
    selectedCount,
    hasSelection,
  } = useTouchSelection({
    multiSelect: true,
    longPressSelection: true,
    hapticFeedback: true,
  });

  const handleImageSelect = useCallback((image: Image) => {
    console.log('Image selected:', image);
  }, []);

  const handleImageDelete = useCallback((image: Image) => {
    console.log('Image deleted:', image);
  }, []);

  const handleBulkDelete = useCallback((imageIds: number[]) => {
    console.log('Bulk delete:', imageIds);
  }, []);

  const handleImageMove = useCallback((image: Image, albumId: number) => {
    console.log('Image moved:', image, 'to album:', albumId);
  }, []);

  const handleUploadClick = useCallback(() => {
    console.log('Upload clicked');
  }, []);

  const handleImageAction = useCallback((action: string, imageId: string) => {
    console.log('Image action:', action, 'for image:', imageId);
  }, []);

  const handleQuickAction = useCallback((action: string) => {
    console.log('Quick action:', action);
  }, []);

  const primaryActions = [
    {
      id: 'download',
      label: 'Download',
      icon: <Download className="w-4 h-4" />,
      onClick: () => console.log('Download selected'),
      variant: 'default' as const,
    },
    {
      id: 'share',
      label: 'Share',
      icon: <Share className="w-4 h-4" />,
      onClick: () => console.log('Share selected'),
      variant: 'outline' as const,
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: () => handleBulkDelete(selectedIds),
      variant: 'destructive' as const,
    },
  ];

  const secondaryActions = [
    {
      id: 'copy',
      label: 'Copy',
      icon: <Download className="w-4 h-4" />,
      onClick: () => console.log('Copy selected'),
      variant: 'ghost' as const,
    },
    {
      id: 'move',
      label: 'Move',
      icon: <Share className="w-4 h-4" />,
      onClick: () => console.log('Move selected'),
      variant: 'ghost' as const,
    },
  ];

  const fabActions = [
    {
      id: 'upload',
      label: 'Upload',
      icon: <Upload className="w-5 h-5" />,
      onClick: handleUploadClick,
    },
    {
      id: 'camera',
      label: 'Camera',
      icon: <Camera className="w-5 h-5" />,
      onClick: () => console.log('Camera'),
    },
    {
      id: 'scan',
      label: 'Scan',
      icon: <Scan className="w-5 h-5" />,
      onClick: () => console.log('Scan'),
    },
  ];

  const features = [
    {
      icon: <Touch className="w-6 h-6" />,
      title: 'Touch Gestures',
      description: 'Swipe, pinch, and long-press interactions',
      color: 'text-blue-600',
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Haptic Feedback',
      description: 'Tactile responses for better UX',
      color: 'text-yellow-600',
    },
    {
      icon: <Eye className="w-6 h-6" />,
      title: 'Image Viewer',
      description: 'Full-screen viewing with zoom and pan',
      color: 'text-green-600',
    },
    {
      icon: <Download className="w-6 h-6" />,
      title: 'Bulk Actions',
      description: 'Select and manage multiple images',
      color: 'text-purple-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Smartphone className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Mobile Gallery Demo</h1>
              <p className="text-gray-600">Touch-optimized image gallery with advanced interactions</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">React</Badge>
            <Badge variant="secondary">TypeScript</Badge>
            <Badge variant="secondary">Framer Motion</Badge>
            <Badge variant="secondary">Touch Gestures</Badge>
            <Badge variant="secondary">Haptic Feedback</Badge>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="h-full">
                <CardHeader className="pb-3">
                  <div className={cn("p-2 rounded-lg w-fit", feature.color.replace('text-', 'bg-').replace('-600', '-100'))}>
                    {feature.icon}
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>{feature.description}</CardDescription>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Demo Controls */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Interactive Demo</CardTitle>
            <CardDescription>
              Experience the mobile-optimized gallery with touch gestures and haptic feedback
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={() => setShowGallery(!showGallery)}
                className="flex items-center space-x-2"
              >
                <Eye className="w-4 h-4" />
                <span>{showGallery ? 'Hide' : 'Show'} Gallery</span>
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setShowImageViewer(!showImageViewer)}
                className="flex items-center space-x-2"
              >
                <Eye className="w-4 h-4" />
                <span>{showImageViewer ? 'Hide' : 'Show'} Image Viewer</span>
              </Button>
              
              <Button
                variant="outline"
                onClick={() => setShowQuickActions(!showQuickActions)}
                className="flex items-center space-x-2"
              >
                <Share className="w-4 h-4" />
                <span>{showQuickActions ? 'Hide' : 'Show'} Quick Actions</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Gallery Demo */}
        {showGallery && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-8"
          >
            <Card>
              <CardHeader>
                <CardTitle>Mobile Masonry Gallery</CardTitle>
                <CardDescription>
                  Touch-optimized gallery with infinite scroll, selection, and bulk actions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-gray-100 rounded-lg p-4 min-h-[400px]">
                  <MobileMasonryGallery
                    images={mockImages}
                    albums={mockAlbums}
                    onImageSelect={handleImageSelect}
                    onImageDelete={handleImageDelete}
                    onBulkDelete={handleBulkDelete}
                    onImageMove={handleImageMove}
                    onUploadClick={handleUploadClick}
                    loading={false}
                    hasMore={true}
                    isFetchingMore={false}
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Quick Actions Demo */}
        {showQuickActions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="mb-8"
          >
            <Card>
              <CardHeader>
                <CardTitle>Quick Action Menu</CardTitle>
                <CardDescription>
                  Contextual actions with haptic feedback
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex justify-center">
                  <QuickActionMenu
                    onAction={handleQuickAction}
                    hapticFeedback={true}
                    position="bottom-right"
                    size="lg"
                  />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Floating Action Button Demo */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Floating Action Button</CardTitle>
            <CardDescription>
              Primary actions with expandable menu
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              <FloatingActionButton
                mainIcon={<Plus className="w-6 h-6" />}
                onMainAction={handleUploadClick}
                actions={fabActions}
                position="bottom-right"
                size="lg"
                showLabels={true}
                hapticFeedback={true}
              />
            </div>
          </CardContent>
        </Card>

        {/* Mobile Action Bar Demo */}
        {hasSelection && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ duration: 0.3 }}
            className="mb-8"
          >
            <Card>
              <CardHeader>
                <CardTitle>Mobile Action Bar</CardTitle>
                <CardDescription>
                  Bulk actions for selected items
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MobileActionBar
                  selectedCount={selectedCount}
                  totalCount={mockImages.length}
                  visible={hasSelection}
                  primaryActions={primaryActions}
                  secondaryActions={secondaryActions}
                  onClearSelection={clearSelection}
                  onSelectAll={selectAll}
                  allSelected={selectedIds.length === mockImages.length}
                  hapticFeedback={true}
                />
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Image Viewer Demo */}
        {showImageViewer && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3 }}
            className="mb-8"
          >
            <Card>
              <CardHeader>
                <CardTitle>Mobile Image Viewer</CardTitle>
                <CardDescription>
                  Full-screen image viewing with pinch-to-zoom and swipe navigation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {mockImages.slice(0, 4).map((image, index) => (
                    <TouchImageCard
                      key={image.id}
                      image={image}
                      albums={mockAlbums}
                      isSelected={isSelected(image.id)}
                      onSelect={() => toggleSelection(image.id)}
                      onDelete={handleImageDelete}
                      onViewFullSize={() => {
                        setViewerImageIndex(index);
                        setShowImageViewer(true);
                      }}
                      onAction={handleImageAction}
                      showSelection={true}
                      enableMultiSelect={true}
                      enableLongPress={true}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Image Viewer Modal */}
        <MobileImageViewer
          images={mockImages}
          currentIndex={viewerImageIndex}
          visible={showImageViewer}
          onVisibilityChange={setShowImageViewer}
          onImageChange={setViewerImageIndex}
          onImageAction={handleImageAction}
          showControls={true}
          enableSwipe={true}
          enableZoom={true}
          hapticFeedback={true}
        />
      </div>
    </div>
  );
};

export { MobileGalleryDemo };






