import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { TouchButton } from '../ui/TouchButton';
import { TouchLink } from '../ui/TouchLink';
import { SwipeableListItem, SwipeableList, swipeActions } from '../ui/SwipeableListItem';
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
  RotateCcw
} from 'lucide-react';

const TouchInteractionShowcase: React.FC = () => {
  const [interactionCount, setInteractionCount] = useState(0);
  const [lastInteraction, setLastInteraction] = useState<string>('');
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [visualFeedbackEnabled, setVisualFeedbackEnabled] = useState(true);
  const [swipeEnabled, setSwipeEnabled] = useState(true);

  const {
    auditResults,
    isAuditing,
    auditAll,
    applyAllFixes,
    generateReport,
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
    { id: 1, title: 'Sample Item 1', description: 'This is a swipeable item' },
    { id: 2, title: 'Sample Item 2', description: 'Swipe left or right for actions' },
    { id: 3, title: 'Sample Item 3', description: 'Try different swipe directions' },
    { id: 4, title: 'Sample Item 4', description: 'Haptic feedback included' },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-gray-900">Touch Interaction Showcase</h1>
        <p className="text-lg text-gray-600">
          Comprehensive demonstration of mobile-optimized touch interactions
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Interaction Controls
          </CardTitle>
          <CardDescription>
            Configure haptic feedback, visual responses, and swipe gestures
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <TouchButton
              onClick={() => {
                setHapticEnabled(!hapticEnabled);
                handleInteraction('Toggle Haptic');
              }}
              variant={hapticEnabled ? "default" : "outline"}
              hapticType="selection"
              enableHaptic={hapticEnabled}
            >
              {hapticEnabled ? 'Haptic On' : 'Haptic Off'}
            </TouchButton>
            
            <TouchButton
              onClick={() => {
                setVisualFeedbackEnabled(!visualFeedbackEnabled);
                handleInteraction('Toggle Visual');
              }}
              variant={visualFeedbackEnabled ? "default" : "outline"}
              hapticType="selection"
              enableHaptic={hapticEnabled}
            >
              {visualFeedbackEnabled ? 'Visual On' : 'Visual Off'}
            </TouchButton>

            <TouchButton
              onClick={() => {
                setSwipeEnabled(!swipeEnabled);
                handleInteraction('Toggle Swipe');
              }}
              variant={swipeEnabled ? "default" : "outline"}
              hapticType="selection"
              enableHaptic={hapticEnabled}
            >
              {swipeEnabled ? 'Swipe On' : 'Swipe Off'}
            </TouchButton>

            <TouchButton
              onClick={() => {
                auditAll();
                handleInteraction('Audit Touch Targets');
              }}
              disabled={isAuditing}
              variant="secondary"
              hapticType="impact"
              enableHaptic={hapticEnabled}
            >
              {isAuditing ? 'Auditing...' : 'Audit All'}
            </TouchButton>
          </div>

          {auditResults.length > 0 && (
            <div className="mt-4 p-4 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                  <span className="font-medium text-orange-800">
                    {auditResults.length} touch target issues found
                  </span>
                </div>
                <TouchButton
                  onClick={() => {
                    const fixed = applyAllFixes();
                    handleInteraction(`Fixed ${fixed} issues`);
                  }}
                  variant="destructive"
                  size="sm"
                  hapticType="success"
                  enableHaptic={hapticEnabled}
                >
                  Fix All
                </TouchButton>
              </div>
            </div>
          )}
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

      {/* Touch Buttons */}
      <Card>
        <CardHeader>
          <CardTitle>Touch-Optimized Buttons</CardTitle>
          <CardDescription>
            All buttons meet 44px minimum touch target with haptic feedback
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <TouchButton
              onClick={() => handleInteraction('Primary Button')}
              hapticType="light"
              enableHaptic={hapticEnabled}
              enableVisualFeedback={visualFeedbackEnabled}
            >
              Primary
            </TouchButton>

            <TouchButton
              onClick={() => handleInteraction('Secondary Button')}
              variant="secondary"
              hapticType="medium"
              enableHaptic={hapticEnabled}
              enableVisualFeedback={visualFeedbackEnabled}
            >
              Secondary
            </TouchButton>

            <TouchButton
              onClick={() => handleInteraction('Destructive Button')}
              variant="destructive"
              hapticType="heavy"
              enableHaptic={hapticEnabled}
              enableVisualFeedback={visualFeedbackEnabled}
            >
              Destructive
            </TouchButton>

            <TouchButton
              onClick={() => handleInteraction('Outline Button')}
              variant="outline"
              hapticType="selection"
              enableHaptic={hapticEnabled}
              enableVisualFeedback={visualFeedbackEnabled}
            >
              Outline
            </TouchButton>
          </div>

          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            <TouchButton
              onClick={() => handleInteraction('Download')}
              variant="outline"
              size="sm"
              hapticType="light"
              enableHaptic={hapticEnabled}
              enableVisualFeedback={visualFeedbackEnabled}
            >
              <Download className="w-4 h-4" />
            </TouchButton>

            <TouchButton
              onClick={() => handleInteraction('Upload')}
              variant="outline"
              size="sm"
              hapticType="light"
              enableHaptic={hapticEnabled}
              enableVisualFeedback={visualFeedbackEnabled}
            >
              <Upload className="w-4 h-4" />
            </TouchButton>

            <TouchButton
              onClick={() => handleInteraction('Share')}
              variant="outline"
              size="sm"
              hapticType="light"
              enableHaptic={hapticEnabled}
              enableVisualFeedback={visualFeedbackEnabled}
            >
              <Share className="w-4 h-4" />
            </TouchButton>

            <TouchButton
              onClick={() => handleInteraction('Heart')}
              variant="outline"
              size="sm"
              hapticType="light"
              enableHaptic={hapticEnabled}
              enableVisualFeedback={visualFeedbackEnabled}
            >
              <Heart className="w-4 h-4" />
            </TouchButton>

            <TouchButton
              onClick={() => handleInteraction('Star')}
              variant="outline"
              size="sm"
              hapticType="light"
              enableHaptic={hapticEnabled}
              enableVisualFeedback={visualFeedbackEnabled}
            >
              <Star className="w-4 h-4" />
            </TouchButton>

            <TouchButton
              onClick={() => handleInteraction('Trash')}
              variant="outline"
              size="sm"
              hapticType="heavy"
              enableHaptic={hapticEnabled}
              enableVisualFeedback={visualFeedbackEnabled}
            >
              <Trash2 className="w-4 h-4" />
            </TouchButton>
          </div>
        </CardContent>
      </Card>

      {/* Swipeable List */}
      <Card>
        <CardHeader>
          <CardTitle>Swipeable List Items</CardTitle>
          <CardDescription>
            Swipe left or right on items to reveal actions with haptic feedback
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
            <TouchButton
              onClick={() => {
                hapticPatterns.light();
                handleInteraction('Light Haptic');
              }}
              variant="outline"
              hapticType="light"
              enableHaptic={hapticEnabled}
            >
              Light
            </TouchButton>

            <TouchButton
              onClick={() => {
                hapticPatterns.medium();
                handleInteraction('Medium Haptic');
              }}
              variant="outline"
              hapticType="medium"
              enableHaptic={hapticEnabled}
            >
              Medium
            </TouchButton>

            <TouchButton
              onClick={() => {
                hapticPatterns.heavy();
                handleInteraction('Heavy Haptic');
              }}
              variant="outline"
              hapticType="heavy"
              enableHaptic={hapticEnabled}
            >
              Heavy
            </TouchButton>

            <TouchButton
              onClick={() => {
                hapticPatterns.success();
                handleInteraction('Success Pattern');
              }}
              variant="outline"
              hapticType="success"
              enableHaptic={hapticEnabled}
            >
              Success
            </TouchButton>
          </div>
        </CardContent>
      </Card>

      {/* Touch Links */}
      <Card>
        <CardHeader>
          <CardTitle>Touch-Optimized Links</CardTitle>
          <CardDescription>
            Links with proper touch targets and haptic feedback
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TouchLink
              to="/dashboard"
              onClick={() => handleInteraction('Dashboard Link')}
              enableHaptic={hapticEnabled}
              enableVisualFeedback={visualFeedbackEnabled}
              className="p-4 border rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5" />
                <div>
                  <div className="font-medium">Dashboard</div>
                  <div className="text-sm text-gray-500">View your dashboard</div>
                </div>
              </div>
            </TouchLink>

            <TouchLink
              to="/settings"
              onClick={() => handleInteraction('Settings Link')}
              enableHaptic={hapticEnabled}
              enableVisualFeedback={visualFeedbackEnabled}
              className="p-4 border rounded-lg hover:bg-gray-50"
            >
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5" />
                <div>
                  <div className="font-medium">Settings</div>
                  <div className="text-sm text-gray-500">Configure your app</div>
                </div>
              </div>
            </TouchLink>
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

export { TouchInteractionShowcase };
