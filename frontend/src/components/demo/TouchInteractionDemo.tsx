import React, { useState, useCallback } from 'react';
import { TouchButton } from '../ui/TouchButton';
import { TouchLink } from '../ui/TouchLink';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
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
  Pause
} from 'lucide-react';

const TouchInteractionDemo: React.FC = () => {
  const [interactionCount, setInteractionCount] = useState(0);
  const [lastInteraction, setLastInteraction] = useState<string>('');
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const [visualFeedbackEnabled, setVisualFeedbackEnabled] = useState(true);

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

  const handleInteraction = useCallback((interactionType: string) => {
    setInteractionCount(prev => prev + 1);
    setLastInteraction(interactionType);
  }, []);

  const summary = getSummary();

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Touch Interaction Demo</h1>
        <p className="text-lg text-gray-600">
          Test touch-optimized components with haptic feedback and visual responses
        </p>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Demo Controls
          </CardTitle>
          <CardDescription>
            Configure haptic feedback and visual responses
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <TouchButton
              onClick={() => setHapticEnabled(!hapticEnabled)}
              variant={hapticEnabled ? "default" : "outline"}
              hapticType="selection"
            >
              {hapticEnabled ? 'Haptic On' : 'Haptic Off'}
            </TouchButton>
            
            <TouchButton
              onClick={() => setVisualFeedbackEnabled(!visualFeedbackEnabled)}
              variant={visualFeedbackEnabled ? "default" : "outline"}
              hapticType="selection"
            >
              {visualFeedbackEnabled ? 'Visual On' : 'Visual Off'}
            </TouchButton>

            <TouchButton
              onClick={auditAll}
              disabled={isAuditing}
              variant="secondary"
              hapticType="impact"
            >
              {isAuditing ? 'Auditing...' : 'Audit Touch Targets'}
            </TouchButton>

            {auditResults.length > 0 && (
              <TouchButton
                onClick={applyAllFixes}
                variant="destructive"
                hapticType="success"
              >
                Apply Fixes ({auditResults.length})
              </TouchButton>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Audit Results */}
      {auditResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              Touch Target Issues
            </CardTitle>
            <CardDescription>
              Found {auditResults.length} elements that don't meet the 44px minimum
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {auditResults.slice(0, 5).map((result, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-orange-50 rounded">
                  <div>
                    <span className="font-medium">{result.selector}</span>
                    <span className="text-sm text-gray-500 ml-2">
                      {result.currentSize.width}×{result.currentSize.height}px
                    </span>
                  </div>
                  <Badge variant={result.priority === 'high' ? 'destructive' : 'secondary'}>
                    {result.priority}
                  </Badge>
                </div>
              ))}
              {auditResults.length > 5 && (
                <p className="text-sm text-gray-500">
                  ... and {auditResults.length - 5} more issues
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Interaction Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="w-5 h-5" />
            Interaction Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{interactionCount}</div>
              <div className="text-sm text-gray-500">Total Interactions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{summary.total - summary.high - summary.medium - summary.low}</div>
              <div className="text-sm text-gray-500">Compliant Elements</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{summary.total}</div>
              <div className="text-sm text-gray-500">Issues Found</div>
            </div>
          </div>
          {lastInteraction && (
            <div className="mt-4 p-3 bg-gray-50 rounded">
              <p className="text-sm text-gray-600">
                Last interaction: <span className="font-medium">{lastInteraction}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Touch Button Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Touch-Optimized Buttons</CardTitle>
          <CardDescription>
            All buttons meet the 44px minimum touch target requirement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          <Separator />

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

      {/* Touch Link Examples */}
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

      {/* Haptic Feedback Test */}
      <Card>
        <CardHeader>
          <CardTitle>Haptic Feedback Test</CardTitle>
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
    </div>
  );
};

export { TouchInteractionDemo };
