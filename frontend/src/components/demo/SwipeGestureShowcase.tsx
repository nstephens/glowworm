import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { SwipeableCard } from '../ui/SwipeableCard';
import { SwipeableListItem, SwipeableList, swipeActions } from '../ui/SwipeableListItem';
import { SwipeableImageCarousel } from '../ui/SwipeableImageCarousel';
import { useTouchTargets } from '../../hooks/useTouchTarget';
import { hapticPatterns } from '../../utils/hapticFeedback';
import { 
  Smartphone, 
  CheckCircle, 
  AlertCircle, 
  Info, 
  Settings, 
  Download,
  Upload,
  Share,
  Heart,
  Star,
  Trash2,
  Edit,
  Eye,
  Play,
  Pause,
  Menu,
  X,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Maximize2
} from 'lucide-react';

const SwipeGestureShowcase: React.FC = () => {
  const [interactionCount, setInteractionCount] = useState(0);
  const [lastInteraction, setLastInteraction] = useState<string>('');
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [swipeEnabled, setSwipeEnabled] = useState(true);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const {
    auditResults,
    isAuditing,
    auditAll,
    applyAllFixes,
    getSummary
  } = useTouchTargets({
    minimumSize: 44,
    autoFix: true
  });

  const handleInteraction = (interactionType: string) => {
    setInteractionCount(prev => prev + 1);
    setLastInteraction(interactionType);
  };

  const summary = getSummary();

  const sampleItems = [
    { id: 1, title: 'Swipeable Item 1', description: 'Swipe left or right for actions' },
    { id: 2, title: 'Swipeable Item 2', description: 'Try different swipe directions' },
    { id: 3, title: 'Swipeable Item 3', description: 'Haptic feedback included' },
    { id: 4, title: 'Swipeable Item 4', description: 'Visual feedback on swipe' },
  ];

  const sampleImages = [
    {
      id: 1,
      src: 'https://picsum.photos/800/600?random=1',
      alt: 'Sample Image 1',
      title: 'Beautiful Landscape',
      description: 'A stunning view of mountains and lakes'
    },
    {
      id: 2,
      src: 'https://picsum.photos/800/600?random=2',
      alt: 'Sample Image 2',
      title: 'Urban Architecture',
      description: 'Modern city skyline at sunset'
    },
    {
      id: 3,
      src: 'https://picsum.photos/800/600?random=3',
      alt: 'Sample Image 3',
      title: 'Nature Photography',
      description: 'Close-up of flowers in bloom'
    },
    {
      id: 4,
      src: 'https://picsum.photos/800/600?random=4',
      alt: 'Sample Image 4',
      title: 'Abstract Art',
      description: 'Colorful abstract composition'
    }
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">Swipe Gesture Showcase</h1>
        <p className="text-lg text-gray-600">
          Comprehensive demonstration of swipe gestures and touch interactions
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Gesture Controls
          </CardTitle>
          <CardDescription>
            Configure haptic feedback and swipe gestures
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              onClick={() => {
                setHapticEnabled(!hapticEnabled);
                handleInteraction('Toggle Haptic');
              }}
              variant={hapticEnabled ? "default" : "outline"}
            >
              {hapticEnabled ? 'Haptic On' : 'Haptic Off'}
            </Button>
            
            <Button
              onClick={() => {
                setSwipeEnabled(!swipeEnabled);
                handleInteraction('Toggle Swipe');
              }}
              variant={swipeEnabled ? "default" : "outline"}
            >
              {swipeEnabled ? 'Swipe On' : 'Swipe Off'}
            </Button>

            <Button
              onClick={() => {
                auditAll();
                handleInteraction('Audit Touch Targets');
              }}
              disabled={isAuditing}
              variant="secondary"
            >
              {isAuditing ? 'Auditing...' : 'Audit All'}
            </Button>

            {auditResults.length > 0 && (
              <Button
                onClick={() => {
                  const fixed = applyAllFixes();
                  handleInteraction(`Fixed ${fixed} issues`);
                }}
                variant="destructive"
              >
                Fix All ({auditResults.length})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{interactionCount}</div>
            <div className="text-sm text-gray-500">Interactions</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">
              {summary.total - summary.high - summary.medium - summary.low}
            </div>
            <div className="text-sm text-gray-500">Compliant</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{summary.total}</div>
            <div className="text-sm text-gray-500">Issues</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {summary.high + summary.medium + summary.low}
            </div>
            <div className="text-sm text-gray-500">Priority</div>
          </CardContent>
        </Card>
      </div>

      {/* Swipeable Cards */}
      <Card>
        <CardHeader>
          <CardTitle>Swipeable Cards</CardTitle>
          <CardDescription>
            Cards with multi-directional swipe gestures and actions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SwipeableCard
              leftAction={{
                icon: <Edit className="w-5 h-5" />,
                label: 'Edit',
                color: '#3b82f6',
                action: () => handleInteraction('Edit Card')
              }}
              rightAction={{
                icon: <Trash2 className="w-5 h-5" />,
                label: 'Delete',
                color: '#ef4444',
                action: () => handleInteraction('Delete Card')
              }}
              upAction={{
                icon: <Share className="w-5 h-5" />,
                label: 'Share',
                color: '#10b981',
                action: () => handleInteraction('Share Card')
              }}
              downAction={{
                icon: <Download className="w-5 h-5" />,
                label: 'Download',
                color: '#8b5cf6',
                action: () => handleInteraction('Download Card')
              }}
              enableHaptic={hapticEnabled}
              disabled={!swipeEnabled}
              showSwipeHints={true}
            >
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-2">Swipeable Card</h3>
                <p className="text-gray-600 mb-4">
                  This card supports swipe gestures in all directions. Try swiping left, right, up, or down to reveal different actions.
                </p>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <ChevronLeft className="w-4 h-4" />
                  <span>Left: Edit</span>
                  <ChevronRight className="w-4 h-4" />
                  <span>Right: Delete</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                  <ChevronUp className="w-4 h-4" />
                  <span>Up: Share</span>
                  <ChevronDown className="w-4 h-4" />
                  <span>Down: Download</span>
                </div>
              </div>
            </SwipeableCard>

            <SwipeableCard
              leftAction={{
                icon: <Heart className="w-5 h-5" />,
                label: 'Like',
                color: '#ec4899',
                action: () => handleInteraction('Like Card')
              }}
              rightAction={{
                icon: <Star className="w-5 h-5" />,
                label: 'Favorite',
                color: '#f59e0b',
                action: () => handleInteraction('Favorite Card')
              }}
              enableHaptic={hapticEnabled}
              disabled={!swipeEnabled}
              showSwipeHints={true}
            >
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-2">Simple Swipe Card</h3>
                <p className="text-gray-600 mb-4">
                  This card only supports horizontal swipes. Swipe left to like or right to favorite.
                </p>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <ChevronLeft className="w-4 h-4" />
                  <span>Left: Like</span>
                  <ChevronRight className="w-4 h-4" />
                  <span>Right: Favorite</span>
                </div>
              </div>
            </SwipeableCard>
          </div>
        </CardContent>
      </Card>

      {/* Swipeable List */}
      <Card>
        <CardHeader>
          <CardTitle>Swipeable List Items</CardTitle>
          <CardDescription>
            List items with swipe actions and haptic feedback
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SwipeableList spacing="md">
            {sampleItems.map((item) => (
              <SwipeableListItem
                key={item.id}
                leftAction={{
                  ...swipeActions.edit,
                  action: () => handleInteraction(`Edit ${item.title}`)
                }}
                rightAction={{
                  ...swipeActions.delete,
                  action: () => handleInteraction(`Delete ${item.title}`)
                }}
                enableHaptic={hapticEnabled}
                disabled={!swipeEnabled}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{item.title}</h3>
                      <p className="text-sm text-gray-500">{item.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </div>
                </div>
              </SwipeableListItem>
            ))}
          </SwipeableList>
        </CardContent>
      </Card>

      {/* Swipeable Image Carousel */}
      <Card>
        <CardHeader>
          <CardTitle>Swipeable Image Carousel</CardTitle>
          <CardDescription>
            Image carousel with swipe navigation and fullscreen support
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SwipeableImageCarousel
            images={sampleImages}
            currentIndex={carouselIndex}
            onIndexChange={setCarouselIndex}
            onImageClick={(image, index) => handleInteraction(`Clicked image ${index + 1}`)}
            enableHaptic={hapticEnabled}
            enableSwipe={swipeEnabled}
            autoPlay={false}
            showControls={true}
            showThumbnails={true}
            enableFullscreen={true}
            className="h-96"
          />
        </CardContent>
      </Card>

      {/* Haptic Feedback Test */}
      <Card>
        <CardHeader>
          <CardTitle>Haptic Feedback Patterns</CardTitle>
          <CardDescription>
            Test different haptic feedback patterns
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              onClick={() => {
                hapticPatterns.light();
                handleInteraction('Light Haptic');
              }}
              variant="outline"
              disabled={!hapticEnabled}
            >
              Light
            </Button>

            <Button
              onClick={() => {
                hapticPatterns.medium();
                handleInteraction('Medium Haptic');
              }}
              variant="outline"
              disabled={!hapticEnabled}
            >
              Medium
            </Button>

            <Button
              onClick={() => {
                hapticPatterns.heavy();
                handleInteraction('Heavy Haptic');
              }}
              variant="outline"
              disabled={!hapticEnabled}
            >
              Heavy
            </Button>

            <Button
              onClick={() => {
                hapticPatterns.success();
                handleInteraction('Success Pattern');
              }}
              variant="outline"
              disabled={!hapticEnabled}
            >
              Success
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Last Interaction Display */}
      {lastInteraction && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-500" />
              <span className="text-sm text-gray-600">
                Last interaction: <span className="font-medium">{lastInteraction}</span>
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export { SwipeGestureShowcase };
