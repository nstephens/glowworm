import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { useThumbNavigation } from '../../utils/thumbNavigation';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { 
  Smartphone, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  Settings,
  Hand,
  MousePointer
} from 'lucide-react';

export interface ThumbZoneVisualizerProps {
  isVisible?: boolean;
  onToggle?: (visible: boolean) => void;
  isLeftHanded?: boolean;
  hasBottomNav?: boolean;
  className?: string;
}

export const ThumbZoneVisualizer: React.FC<ThumbZoneVisualizerProps> = ({
  isVisible: controlledVisible,
  onToggle,
  isLeftHanded = false,
  hasBottomNav = true,
  className
}) => {
  const [isVisible, setIsVisible] = useState(controlledVisible ?? false);
  const [showLabels, setShowLabels] = useState(true);
  const [showDifficulty, setShowDifficulty] = useState(true);
  
  const { 
    deviceSize, 
    thumbZones, 
    spacing, 
    fabPosition, 
    safeArea,
    getOptimalPlacement 
  } = useThumbNavigation(isLeftHanded, hasBottomNav);

  const handleToggle = () => {
    const newVisible = !isVisible;
    setIsVisible(newVisible);
    onToggle?.(newVisible);
  };

  // Sync with controlled visibility
  useEffect(() => {
    if (controlledVisible !== undefined) {
      setIsVisible(controlledVisible);
    }
  }, [controlledVisible]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-500';
      case 'comfortable': return 'bg-blue-500';
      case 'stretch': return 'bg-yellow-500';
      case 'difficult': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'Easy Reach';
      case 'comfortable': return 'Comfortable';
      case 'stretch': return 'Stretch';
      case 'difficult': return 'Difficult';
      default: return 'Unknown';
    }
  };

  if (!isVisible) {
    return (
      <Button
        onClick={handleToggle}
        className={cn(
          'fixed top-4 right-4 z-[9999] touch-target',
          'bg-black/80 text-white hover:bg-black/90',
          className
        )}
        size="sm"
      >
        <Eye className="w-4 h-4 mr-2" />
        Show Thumb Zones
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-[9998]">
      {/* Thumb Zone Overlays */}
      {thumbZones.map((zone, index) => (
        <div
          key={index}
          className={cn(
            'thumb-zone-indicator',
            getDifficultyColor(zone.difficulty),
            'absolute'
          )}
          style={{
            left: `${zone.coordinates.x}%`,
            top: `${zone.coordinates.y}%`,
            width: `${zone.radius * 2}%`,
            height: `${zone.radius * 2}%`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none'
          }}
        >
          {showLabels && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-white text-xs font-bold text-center">
                {zone.name.split(' ')[0]}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Control Panel */}
      <div className="fixed top-4 left-4 z-[9999] pointer-events-auto">
        <Card className="w-80 bg-white/95 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Hand className="w-5 h-5" />
              Thumb Zone Visualizer
            </CardTitle>
            <CardDescription>
              Device: {deviceSize.name} ({deviceSize.width}×{deviceSize.height})
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Controls */}
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleToggle}
                variant="outline"
                size="sm"
                className="touch-target"
              >
                <EyeOff className="w-4 h-4 mr-2" />
                Hide
              </Button>
              
              <Button
                onClick={() => setShowLabels(!showLabels)}
                variant="outline"
                size="sm"
                className="touch-target"
              >
                {showLabels ? 'Hide' : 'Show'} Labels
              </Button>
              
              <Button
                onClick={() => setShowDifficulty(!showDifficulty)}
                variant="outline"
                size="sm"
                className="touch-target"
              >
                {showDifficulty ? 'Hide' : 'Show'} Difficulty
              </Button>
            </div>

            {/* Spacing Info */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Optimal Spacing</h4>
              <div className="text-xs text-gray-600 space-y-1">
                <div>Min: {spacing.minSpacing.toFixed(1)}px</div>
                <div>Recommended: {spacing.recommendedSpacing.toFixed(1)}px</div>
                <div>Max: {spacing.maxSpacing.toFixed(1)}px</div>
              </div>
            </div>

            {/* FAB Position */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">FAB Position</h4>
              <div className="text-xs text-gray-600">
                <div>Position: {fabPosition.position}</div>
                <div>Bottom: {fabPosition.bottom}px</div>
                <div>Side: {fabPosition.side}px</div>
              </div>
            </div>

            {/* Safe Area */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Safe Area</h4>
              <div className="text-xs text-gray-600 space-y-1">
                <div>Top: {safeArea.top}px</div>
                <div>Bottom: {safeArea.bottom}px</div>
                <div>Left: {safeArea.left}px</div>
                <div>Right: {safeArea.right}px</div>
              </div>
            </div>

            {/* Difficulty Legend */}
            {showDifficulty && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Difficulty Levels</h4>
                <div className="space-y-1">
                  {['easy', 'comfortable', 'stretch', 'difficult'].map((difficulty) => (
                    <div key={difficulty} className="flex items-center gap-2">
                      <div className={cn('w-3 h-3 rounded-full', getDifficultyColor(difficulty))} />
                      <span className="text-xs text-gray-600">
                        {getDifficultyText(difficulty)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Placement Examples */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Optimal Placements</h4>
              <div className="space-y-1">
                {['primary', 'secondary', 'destructive', 'navigation', 'utility'].map((actionType) => {
                  const placement = getOptimalPlacement(actionType as any);
                  return (
                    <div key={actionType} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600 capitalize">{actionType}:</span>
                      <Badge variant="outline" className="text-xs">
                        {placement.difficulty}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Device Frame */}
      <div className="absolute inset-0 border-4 border-blue-500/20 rounded-lg pointer-events-none">
        <div className="absolute top-2 left-2 text-xs text-blue-600 font-medium">
          {deviceSize.name}
        </div>
      </div>
    </div>
  );
};

export default ThumbZoneVisualizer;
