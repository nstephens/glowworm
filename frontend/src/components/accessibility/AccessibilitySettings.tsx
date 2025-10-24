import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Accessibility, 
  Eye, 
  Keyboard, 
  MousePointer, 
  Volume2, 
  VolumeX,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { useHighContrast } from '@/hooks/useHighContrast';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { cn } from '@/lib/utils';

interface AccessibilitySettingsProps {
  className?: string;
  onSettingsChange?: (settings: AccessibilitySettings) => void;
}

interface AccessibilitySettings {
  highContrast: boolean;
  reducedMotion: boolean;
  fontSize: number;
  focusIndicator: boolean;
  soundEffects: boolean;
  keyboardNavigation: boolean;
}

const defaultSettings: AccessibilitySettings = {
  highContrast: false,
  reducedMotion: false,
  fontSize: 100, // percentage
  focusIndicator: true,
  soundEffects: true,
  keyboardNavigation: true,
};

export const AccessibilitySettings: React.FC<AccessibilitySettingsProps> = ({
  className,
  onSettingsChange,
}) => {
  const [settings, setSettings] = useState<AccessibilitySettings>(defaultSettings);
  const { isHighContrast, toggleHighContrast } = useHighContrast();
  const { prefersReducedMotion } = useReducedMotion();

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('accessibility-settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings({ ...defaultSettings, ...parsed });
      } catch (error) {
        console.error('Failed to load accessibility settings:', error);
      }
    }
  }, []);

  // Save settings to localStorage and notify parent
  useEffect(() => {
    localStorage.setItem('accessibility-settings', JSON.stringify(settings));
    onSettingsChange?.(settings);
  }, [settings, onSettingsChange]);

  // Apply settings to document
  useEffect(() => {
    const root = document.documentElement;
    
    // Apply high contrast
    if (settings.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Apply reduced motion
    if (settings.reducedMotion) {
      root.classList.add('reduced-motion');
    } else {
      root.classList.remove('reduced-motion');
    }

    // Apply font size
    root.style.fontSize = `${settings.fontSize}%`;

    // Apply focus indicator
    if (settings.focusIndicator) {
      root.classList.add('focus-visible');
    } else {
      root.classList.remove('focus-visible');
    }

    // Apply keyboard navigation
    if (settings.keyboardNavigation) {
      root.classList.add('keyboard-navigation');
    } else {
      root.classList.remove('keyboard-navigation');
    }
  }, [settings]);

  const updateSetting = <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const resetSettings = () => {
    setSettings(defaultSettings);
  };

  return (
    <Card className={cn("w-full max-w-2xl", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Accessibility className="h-5 w-5" />
          Accessibility Settings
        </CardTitle>
        <CardDescription>
          Customize your experience to meet your accessibility needs
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* High Contrast */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="high-contrast" className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              High Contrast Mode
            </Label>
            <p className="text-sm text-muted-foreground">
              Increase color contrast for better visibility
            </p>
          </div>
          <Switch
            id="high-contrast"
            checked={settings.highContrast}
            onCheckedChange={(checked) => updateSetting('highContrast', checked)}
            aria-describedby="high-contrast-description"
          />
        </div>

        {/* Reduced Motion */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="reduced-motion" className="flex items-center gap-2">
              <MousePointer className="h-4 w-4" />
              Reduced Motion
            </Label>
            <p className="text-sm text-muted-foreground">
              Minimize animations and transitions
            </p>
          </div>
          <Switch
            id="reduced-motion"
            checked={settings.reducedMotion}
            onCheckedChange={(checked) => updateSetting('reducedMotion', checked)}
            aria-describedby="reduced-motion-description"
          />
        </div>

        {/* Font Size */}
        <div className="space-y-3">
          <Label htmlFor="font-size" className="flex items-center gap-2">
            <ZoomIn className="h-4 w-4" />
            Font Size
          </Label>
          <div className="space-y-2">
            <Slider
              id="font-size"
              value={[settings.fontSize]}
              onValueChange={([value]) => updateSetting('fontSize', value)}
              min={75}
              max={150}
              step={5}
              className="w-full"
              aria-label="Font size percentage"
            />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>75%</span>
              <span className="font-medium">{settings.fontSize}%</span>
              <span>150%</span>
            </div>
          </div>
        </div>

        {/* Focus Indicator */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="focus-indicator" className="flex items-center gap-2">
              <Keyboard className="h-4 w-4" />
              Enhanced Focus Indicators
            </Label>
            <p className="text-sm text-muted-foreground">
              Make keyboard focus more visible
            </p>
          </div>
          <Switch
            id="focus-indicator"
            checked={settings.focusIndicator}
            onCheckedChange={(checked) => updateSetting('focusIndicator', checked)}
            aria-describedby="focus-indicator-description"
          />
        </div>

        {/* Sound Effects */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="sound-effects" className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Sound Effects
            </Label>
            <p className="text-sm text-muted-foreground">
              Enable audio feedback for interactions
            </p>
          </div>
          <Switch
            id="sound-effects"
            checked={settings.soundEffects}
            onCheckedChange={(checked) => updateSetting('soundEffects', checked)}
            aria-describedby="sound-effects-description"
          />
        </div>

        {/* Keyboard Navigation */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="keyboard-navigation" className="flex items-center gap-2">
              <Keyboard className="h-4 w-4" />
              Enhanced Keyboard Navigation
            </Label>
            <p className="text-sm text-muted-foreground">
              Improve keyboard navigation experience
            </p>
          </div>
          <Switch
            id="keyboard-navigation"
            checked={settings.keyboardNavigation}
            onCheckedChange={(checked) => updateSetting('keyboardNavigation', checked)}
            aria-describedby="keyboard-navigation-description"
          />
        </div>

        {/* Reset Button */}
        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={resetSettings}>
            Reset to Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
