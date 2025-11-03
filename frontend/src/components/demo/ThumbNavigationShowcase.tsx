import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ThumbActionBar } from '../ui/ThumbActionBar';
import { ThumbZoneVisualizer } from '../demo/ThumbZoneVisualizer';
import { useThumbNavigation } from '../../utils/thumbNavigation';
import { 
  Plus, 
  Upload, 
  Download, 
  Share, 
  Edit, 
  Trash2, 
  Settings,
  Heart,
  Star,
  Eye,
  Copy,
  Move,
  Smartphone,
  Hand,
  MousePointer,
  RotateCcw
} from 'lucide-react';

const ThumbNavigationShowcase: React.FC = () => {
  const [isLeftHanded, setIsLeftHanded] = useState(false);
  const [showThumbZones, setShowThumbZones] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);
  const [lastInteraction, setLastInteraction] = useState<string>('');

  const { 
    deviceSize, 
    thumbZones, 
    spacing, 
    fabPosition, 
    safeArea,
    getOptimalPlacement 
  } = useThumbNavigation(isLeftHanded, true);

  const handleInteraction = (interactionType: string) => {
    setInteractionCount(prev => prev + 1);
    setLastInteraction(interactionType);
  };

  // Sample actions for ThumbActionBar
  const primaryActions = [
    {
      id: 'upload',
      label: 'Upload',
      icon: <Upload className="w-5 h-5" />,
      action: () => handleInteraction('Upload'),
      type: 'primary' as const,
      hapticType: 'medium' as const
    },
    {
      id: 'create',
      label: 'Create',
      icon: <Plus className="w-5 h-5" />,
      action: () => handleInteraction('Create'),
      type: 'primary' as const,
      hapticType: 'medium' as const
    }
  ];

  const secondaryActions = [
    {
      id: 'share',
      label: 'Share',
      icon: <Share className="w-5 h-5" />,
      action: () => handleInteraction('Share'),
      type: 'secondary' as const,
      hapticType: 'light' as const
    },
    {
      id: 'download',
      label: 'Download',
      icon: <Download className="w-5 h-5" />,
      action: () => handleInteraction('Download'),
      type: 'secondary' as const,
      hapticType: 'light' as const
    }
  ];

  const destructiveActions = [
    {
      id: 'delete',
      label: 'Delete',
      icon: <Trash2 className="w-5 h-5" />,
      action: () => handleInteraction('Delete'),
      type: 'destructive' as const,
      hapticType: 'heavy' as const
    }
  ];

  const utilityActions = [
    {
      id: 'edit',
      label: 'Edit',
      icon: <Edit className="w-5 h-5" />,
      action: () => handleInteraction('Edit'),
      type: 'utility' as const,
      hapticType: 'light' as const
    },
    {
      id: 'copy',
      label: 'Copy',
      icon: <Copy className="w-5 h-5" />,
      action: () => handleInteraction('Copy'),
      type: 'utility' as const,
      hapticType: 'light' as const
    },
    {
      id: 'move',
      label: 'Move',
      icon: <Move className="w-5 h-5" />,
      action: () => handleInteraction('Move'),
      type: 'utility' as const,
      hapticType: 'light' as const
    }
  ];

  const allActions = [...primaryActions, ...secondaryActions, ...destructiveActions, ...utilityActions];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">Thumb Navigation Showcase</h1>
        <p className="text-lg text-gray-600">
          Optimized layouts for one-handed mobile operation
        </p>
      </div>

      {/* Device Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Device Information
          </CardTitle>
          <CardDescription>
            Current device size and thumb zone analysis
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{deviceSize.name}</div>
              <div className="text-sm text-gray-500">{deviceSize.width} × {deviceSize.height}</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {isLeftHanded ? 'Left' : 'Right'}-handed
              </div>
              <div className="text-sm text-gray-500">Handedness</div>
            </div>
            
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">{interactionCount}</div>
              <div className="text-sm text-gray-500">Interactions</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Navigation Controls
          </CardTitle>
          <CardDescription>
            Configure thumb navigation settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={() => setIsLeftHanded(!isLeftHanded)}
              variant={isLeftHanded ? "default" : "outline"}
              className="touch-target"
            >
              <Hand className="w-4 h-4 mr-2" />
              {isLeftHanded ? 'Left-handed' : 'Right-handed'}
            </Button>
            
            <Button
              onClick={() => setShowThumbZones(!showThumbZones)}
              variant={showThumbZones ? "default" : "outline"}
              className="touch-target"
            >
              <Eye className="w-4 h-4 mr-2" />
              {showThumbZones ? 'Hide' : 'Show'} Thumb Zones
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Thumb Zones Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Thumb Zone Analysis</CardTitle>
          <CardDescription>
            Optimal placement zones for different action types
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {['primary', 'secondary', 'destructive', 'navigation', 'utility'].map((actionType) => {
              const placement = getOptimalPlacement(actionType as any);
              const difficultyColor = {
                easy: 'bg-green-100 text-green-800',
                comfortable: 'bg-blue-100 text-blue-800',
                stretch: 'bg-yellow-100 text-yellow-800',
                difficult: 'bg-red-100 text-red-800'
              }[placement.difficulty];
              
              return (
                <div key={actionType} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium capitalize">{actionType}</span>
                    <Badge className={difficultyColor}>
                      {placement.difficulty}
                    </Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    <div>X: {placement.coordinates.x}%</div>
                    <div>Y: {placement.coordinates.y}%</div>
                    <div>Radius: {placement.radius}%</div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Spacing Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle>Spacing Guidelines</CardTitle>
          <CardDescription>
            Optimal spacing for touch targets on current device
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {spacing.minSpacing.toFixed(0)}px
              </div>
              <div className="text-sm text-gray-600">Minimum Spacing</div>
            </div>
            
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {spacing.recommendedSpacing.toFixed(0)}px
              </div>
              <div className="text-sm text-gray-600">Recommended Spacing</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {spacing.maxSpacing.toFixed(0)}px
              </div>
              <div className="text-sm text-gray-600">Maximum Spacing</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FAB Position Info */}
      <Card>
        <CardHeader>
          <CardTitle>Floating Action Button Position</CardTitle>
          <CardDescription>
            Optimal FAB placement for current configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {fabPosition.position}
              </div>
              <div className="text-sm text-gray-500">Position</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {fabPosition.bottom}px
              </div>
              <div className="text-sm text-gray-500">Bottom Offset</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {fabPosition.side}px
              </div>
              <div className="text-sm text-gray-500">Side Offset</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Safe Area Info */}
      <Card>
        <CardHeader>
          <CardTitle>Safe Area Insets</CardTitle>
          <CardDescription>
            Device-specific safe area measurements
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {safeArea.top}px
              </div>
              <div className="text-sm text-gray-500">Top</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {safeArea.bottom}px
              </div>
              <div className="text-sm text-gray-500">Bottom</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {safeArea.left}px
              </div>
              <div className="text-sm text-gray-500">Left</div>
            </div>
            
            <div className="text-center">
              <div className="text-lg font-semibold text-gray-900">
                {safeArea.right}px
              </div>
              <div className="text-sm text-gray-500">Right</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last Interaction */}
      {lastInteraction && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MousePointer className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-gray-600">
                Last interaction: <span className="font-medium">{lastInteraction}</span>
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Thumb Action Bars */}
      <div className="space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>Thumb Action Bars</CardTitle>
            <CardDescription>
              Optimized action bars for different use cases
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-medium mb-2">Primary Actions</h4>
              <ThumbActionBar
                actions={primaryActions}
                isLeftHanded={isLeftHanded}
                hasBottomNav={true}
                enableHaptic={true}
                maxVisibleActions={2}
                showLabels={false}
              />
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Mixed Actions</h4>
              <ThumbActionBar
                actions={allActions}
                isLeftHanded={isLeftHanded}
                hasBottomNav={true}
                enableHaptic={true}
                maxVisibleActions={3}
                showLabels={false}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Thumb Zone Visualizer */}
      <ThumbZoneVisualizer
        isVisible={showThumbZones}
        onToggle={setShowThumbZones}
        isLeftHanded={isLeftHanded}
        hasBottomNav={true}
      />
    </div>
  );
};

export { ThumbNavigationShowcase };
