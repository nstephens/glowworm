import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { HighContrastToggle, HighContrastIndicator } from '@/components/ui/HighContrastToggle';
import { useHighContrast } from '@/hooks/useHighContrast';
import { cn } from '@/lib/utils';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info,
  Download,
  Upload,
  Settings,
  User
} from 'lucide-react';

/**
 * Demo component showcasing high contrast mode support
 * This component demonstrates how various UI elements adapt to high contrast mode
 */
export const HighContrastDemo: React.FC = () => {
  const { isHighContrast } = useHighContrast();

  return (
    <div className="space-y-6 p-6">
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">High Contrast Mode Demo</h1>
          <p className="text-muted-foreground">
            Test how the application adapts to high contrast mode for better accessibility
          </p>
        </div>
        <div className="flex items-center gap-4">
          <HighContrastIndicator />
          <HighContrastToggle />
        </div>
      </div>

      {/* Status indicator */}
      <div className={cn(
        "p-4 rounded-lg border-2",
        isHighContrast 
          ? "bg-primary text-primary-foreground border-current" 
          : "bg-muted text-muted-foreground border-border"
      )}>
        <div className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          <span className="font-medium">
            {isHighContrast ? 'High contrast mode is active' : 'Normal contrast mode'}
          </span>
        </div>
        <p className="text-sm mt-1">
          {isHighContrast 
            ? 'All elements have been adapted for maximum contrast and visibility'
            : 'Toggle high contrast mode to see accessibility improvements'
          }
        </p>
      </div>

      {/* Buttons section */}
      <Card>
        <CardHeader>
          <CardTitle>Buttons & Interactive Elements</CardTitle>
          <CardDescription>
            Test button states and interactive elements in high contrast mode
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="default">Primary Button</Button>
            <Button variant="secondary">Secondary Button</Button>
            <Button variant="outline">Outline Button</Button>
            <Button variant="destructive">Destructive Button</Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="link">Link Button</Button>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button size="sm">Small</Button>
            <Button size="default">Default</Button>
            <Button size="lg">Large</Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button disabled>Disabled Button</Button>
            <Button className="min-w-[44px] min-h-[44px]">Touch Target</Button>
          </div>
        </CardContent>
      </Card>

      {/* Form elements section */}
      <Card>
        <CardHeader>
          <CardTitle>Form Elements</CardTitle>
          <CardDescription>
            Test form controls and input elements
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="demo-input">Text Input</Label>
              <Input id="demo-input" placeholder="Enter text here" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-email">Email Input</Label>
              <Input id="demo-email" type="email" placeholder="email@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-password">Password Input</Label>
              <Input id="demo-password" type="password" placeholder="Enter password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-disabled">Disabled Input</Label>
              <Input id="demo-disabled" disabled placeholder="Disabled input" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Status badges section */}
      <Card>
        <CardHeader>
          <CardTitle>Status Indicators & Badges</CardTitle>
          <CardDescription>
            Test status indicators and badge components
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="default">Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="destructive">Error</Badge>
            <Badge variant="outline">Outline</Badge>
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span>Success State</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              <span>Error State</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <span>Warning State</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation section */}
      <Card>
        <CardHeader>
          <CardTitle>Navigation Elements</CardTitle>
          <CardDescription>
            Test navigation and menu components
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <nav className="flex flex-wrap gap-2" role="navigation" aria-label="Demo navigation">
            <Button variant="ghost" role="link" aria-current="page">
              <User className="h-4 w-4 mr-2" />
              Current Page
            </Button>
            <Button variant="ghost" role="link">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Button variant="ghost" role="link">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button variant="ghost" role="link">
              <Upload className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </nav>
        </CardContent>
      </Card>

      {/* Cards section */}
      <Card>
        <CardHeader>
          <CardTitle>Card Components</CardTitle>
          <CardDescription>
            Test card layouts and content containers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Info Card</CardTitle>
                <CardDescription>This is a description</CardDescription>
              </CardHeader>
              <CardContent>
                <p>Card content goes here with some text to test readability.</p>
              </CardContent>
            </Card>
            
            <Card className="border-2">
              <CardHeader>
                <CardTitle>Bordered Card</CardTitle>
                <CardDescription>Card with enhanced border</CardDescription>
              </CardHeader>
              <CardContent>
                <p>This card has a thicker border for better visibility.</p>
              </CardContent>
            </Card>

            <Card className="bg-muted">
              <CardHeader>
                <CardTitle>Muted Card</CardTitle>
                <CardDescription>Card with muted background</CardDescription>
              </CardHeader>
              <CardContent>
                <p>This card uses a muted background color.</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Accessibility notes */}
      <Card>
        <CardHeader>
          <CardTitle>Accessibility Notes</CardTitle>
          <CardDescription>
            Key accessibility features demonstrated
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>All text meets WCAG 2.1 AA contrast requirements (4.5:1 minimum)</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Interactive elements have clear visual boundaries</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Focus indicators are highly visible and meet accessibility standards</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>Status information is conveyed through both color and text</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <span>All touch targets meet minimum 44px size requirements</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};








