import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  Upload, 
  Download, 
  Share, 
  Trash2, 
  Star, 
  Copy, 
  Move, 
  Edit,
  Eye,
  MoreHorizontal,
  Smartphone,
  Zap,
  Settings
} from 'lucide-react';
import { FloatingActionButton } from '../ui/FloatingActionButton';
import { MobileActionBar } from '../ui/MobileActionBar';
import { QuickActionMenu } from '../ui/QuickActionMenu';
import type { Image, Album } from '../../types';

interface QuickActionsDemoProps {
  images: Image[];
  albums: Album[];
}

/**
 * Demo component showcasing all quick action features
 */
export const QuickActionsDemo: React.FC<QuickActionsDemoProps> = ({
  images,
  albums
}) => {
  const [selectedCount, setSelectedCount] = useState(0);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [showFAB, setShowFAB] = useState(true);
  const [showActionBar, setShowActionBar] = useState(false);
  const [demoMode, setDemoMode] = useState<'fab' | 'actionbar' | 'quickmenu'>('fab');

  // Demo actions
  const handleAction = useCallback((action: string, context?: string) => {
    console.log(`Action: ${action}`, context ? `Context: ${context}` : '');
    
    // Simulate action feedback
    if (navigator.vibrate) {
      navigator.vibrate([50, 25, 50]);
    }
  }, []);

  const handleUpload = useCallback(() => {
    handleAction('upload');
  }, [handleAction]);

  const handleDownload = useCallback(() => {
    handleAction('download', `${selectedCount} images`);
  }, [handleAction, selectedCount]);

  const handleShare = useCallback(() => {
    handleAction('share', `${selectedCount} images`);
  }, [handleAction, selectedCount]);

  const handleDelete = useCallback(() => {
    handleAction('delete', `${selectedCount} images`);
    setSelectedCount(0);
  }, [handleAction, selectedCount]);

  const handleSelectAll = useCallback(() => {
    setSelectedCount(images.length);
    handleAction('select-all', `${images.length} images`);
  }, [images.length, handleAction]);

  const handleClearSelection = useCallback(() => {
    setSelectedCount(0);
    handleAction('clear-selection');
  }, [handleAction]);

  const handleToggleSelection = useCallback(() => {
    if (selectedCount === 0) {
      setSelectedCount(Math.min(3, images.length));
    } else {
      setSelectedCount(0);
    }
  }, [selectedCount, images.length]);

  return (
    <div className="space-y-6">
      {/* Demo Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            Quick Actions Demo
          </CardTitle>
          <CardDescription>
            Test different quick action components and interactions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Mode Selection */}
          <div className="space-y-2">
            <h4 className="font-medium">Demo Mode</h4>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'fab', label: 'Floating Action Button', icon: <Upload className="h-4 w-4" /> },
                { id: 'actionbar', label: 'Mobile Action Bar', icon: <Settings className="h-4 w-4" /> },
                { id: 'quickmenu', label: 'Quick Action Menu', icon: <MoreHorizontal className="h-4 w-4" /> }
              ].map((mode) => (
                <Button
                  key={mode.id}
                  variant={demoMode === mode.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDemoMode(mode.id as any)}
                  className="flex items-center gap-2"
                >
                  {mode.icon}
                  {mode.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Selection Controls */}
          <div className="space-y-2">
            <h4 className="font-medium">Selection Controls</h4>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleSelection}
              >
                {selectedCount === 0 ? 'Select 3 Images' : 'Clear Selection'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
                disabled={selectedCount === images.length}
              >
                Select All ({images.length})
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSelection}
                disabled={selectedCount === 0}
              >
                Clear Selection
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                {selectedCount} selected
              </Badge>
              {selectedCount > 0 && (
                <Badge variant="outline">
                  {Math.round((selectedCount / images.length) * 100)}% of total
                </Badge>
              )}
            </div>
          </div>

          {/* Component Toggles */}
          <div className="space-y-2">
            <h4 className="font-medium">Component Visibility</h4>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={showFAB ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFAB(!showFAB)}
              >
                {showFAB ? 'Hide' : 'Show'} FAB
              </Button>
              <Button
                variant={showActionBar ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowActionBar(!showActionBar)}
                disabled={selectedCount === 0}
              >
                {showActionBar ? 'Hide' : 'Show'} Action Bar
              </Button>
              <Button
                variant={showQuickMenu ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowQuickMenu(!showQuickMenu)}
              >
                {showQuickMenu ? 'Hide' : 'Show'} Quick Menu
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Descriptions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-600" />
              Floating Action Button
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p>• Expandable action menu</p>
            <p>• Haptic feedback</p>
            <p>• Touch-optimized</p>
            <p>• Customizable position</p>
            <p>• Auto-collapse on action</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="h-5 w-5 text-green-600" />
              Mobile Action Bar
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p>• Selection-aware actions</p>
            <p>• Progress indicators</p>
            <p>• Overflow menu</p>
            <p>• Bulk operations</p>
            <p>• Context-sensitive</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <MoreHorizontal className="h-5 w-5 text-purple-600" />
              Quick Action Menu
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-600">
            <p>• Grouped actions</p>
            <p>• Descriptions & shortcuts</p>
            <p>• Modal overlay</p>
            <p>• Keyboard navigation</p>
            <p>• Accessibility support</p>
          </CardContent>
        </Card>
      </div>

      {/* Demo Components */}
      <div className="relative min-h-[400px] bg-gray-50 rounded-lg border-2 border-dashed border-gray-300 p-8">
        <div className="text-center text-gray-500 mb-4">
          <Smartphone className="h-8 w-8 mx-auto mb-2" />
          <p>Mobile Viewport Demo</p>
          <p className="text-sm">Try the quick action components below</p>
        </div>

        {/* Floating Action Button */}
        {showFAB && demoMode === 'fab' && (
          <FloatingActionButton
            mainIcon={<Upload className="h-5 w-5" />}
            onMainAction={handleUpload}
            actions={[
              {
                id: 'upload',
                icon: <Upload className="h-4 w-4" />,
                label: 'Upload Images',
                onClick: handleUpload
              },
              {
                id: 'camera',
                icon: <Eye className="h-4 w-4" />,
                label: 'Take Photo',
                onClick: () => handleAction('camera')
              },
              {
                id: 'scan',
                icon: <Edit className="h-4 w-4" />,
                label: 'Scan Document',
                onClick: () => handleAction('scan')
              }
            ]}
            position="bottom-right"
            size="md"
            showLabels={true}
            hapticFeedback={true}
          />
        )}

        {/* Mobile Action Bar */}
        {showActionBar && demoMode === 'actionbar' && selectedCount > 0 && (
          <MobileActionBar
            selectedCount={selectedCount}
            totalCount={images.length}
            visible={true}
            primaryActions={[
              {
                id: 'download',
                icon: <Download className="h-4 w-4" />,
                label: 'Download',
                onClick: handleDownload
              },
              {
                id: 'share',
                icon: <Share className="h-4 w-4" />,
                label: 'Share',
                onClick: handleShare
              },
              {
                id: 'delete',
                icon: <Trash2 className="h-4 w-4" />,
                label: 'Delete',
                onClick: handleDelete,
                variant: 'destructive'
              }
            ]}
            secondaryActions={[
              {
                id: 'favorite',
                icon: <Star className="h-4 w-4" />,
                label: 'Add to Favorites',
                onClick: () => handleAction('favorite')
              },
              {
                id: 'copy',
                icon: <Copy className="h-4 w-4" />,
                label: 'Copy',
                onClick: () => handleAction('copy')
              },
              {
                id: 'move',
                icon: <Move className="h-4 w-4" />,
                label: 'Move to Album',
                onClick: () => handleAction('move')
              }
            ]}
            onClearSelection={handleClearSelection}
            onSelectAll={handleSelectAll}
            allSelected={selectedCount === images.length}
            hapticFeedback={true}
          />
        )}

        {/* Quick Action Menu */}
        {showQuickMenu && demoMode === 'quickmenu' && (
          <QuickActionMenu
            visible={true}
            onVisibilityChange={setShowQuickMenu}
            actionGroups={[
              {
                title: 'Selection Actions',
                actions: [
                  {
                    id: 'select-all',
                    icon: <Eye className="h-4 w-4" />,
                    label: 'Select All',
                    description: 'Select all visible images',
                    onClick: handleSelectAll
                  },
                  {
                    id: 'clear-selection',
                    icon: <Trash2 className="h-4 w-4" />,
                    label: 'Clear Selection',
                    description: 'Deselect all images',
                    onClick: handleClearSelection
                  }
                ]
              },
              {
                title: 'Bulk Actions',
                actions: [
                  {
                    id: 'bulk-download',
                    icon: <Download className="h-4 w-4" />,
                    label: 'Download Selected',
                    description: 'Download all selected images',
                    onClick: handleDownload,
                    disabled: selectedCount === 0
                  },
                  {
                    id: 'bulk-share',
                    icon: <Share className="h-4 w-4" />,
                    label: 'Share Selected',
                    description: 'Share selected images',
                    onClick: handleShare,
                    disabled: selectedCount === 0
                  },
                  {
                    id: 'bulk-delete',
                    icon: <Trash2 className="h-4 w-4" />,
                    label: 'Delete Selected',
                    description: 'Permanently delete selected images',
                    onClick: handleDelete,
                    variant: 'destructive',
                    disabled: selectedCount === 0
                  }
                ]
              }
            ]}
            position="center"
            size="md"
            showDescriptions={true}
            showShortcuts={false}
            hapticFeedback={true}
            closeOnAction={true}
          />
        )}
      </div>

      {/* Instructions */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <h4 className="font-medium text-blue-800">How to Test</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Select a demo mode above</li>
              <li>• Use selection controls to simulate image selection</li>
              <li>• Toggle component visibility to test different states</li>
              <li>• Try different actions and observe haptic feedback</li>
              <li>• Test on mobile devices for full experience</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QuickActionsDemo;






