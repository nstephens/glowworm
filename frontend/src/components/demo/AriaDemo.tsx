import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ToggleSwitch } from '@/components/settings/ToggleSwitch';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SwipeableImageCarousel } from '@/components/ui/SwipeableImageCarousel';
import { 
  createAriaAttributes, 
  generateAriaId, 
  getAriaAttributes,
  srOnly,
  validateAriaAttributes,
  ARIA_ROLES,
  ARIA_STATES
} from '@/utils/ariaUtils';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info,
  Settings,
  User,
  Bell,
  Shield,
  Eye,
  EyeOff
} from 'lucide-react';

/**
 * Demo component showcasing ARIA attributes implementation
 * This component demonstrates how custom components use ARIA attributes for accessibility
 */
export const AriaDemo: React.FC = () => {
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Sample images for carousel
  const sampleImages = [
    {
      id: '1',
      src: 'https://via.placeholder.com/800x600/4f46e5/ffffff?text=Sample+Image+1',
      alt: 'Sample image 1 showing a blue background',
      title: 'Sample Image 1',
      description: 'This is a sample image for demonstration purposes'
    },
    {
      id: '2',
      src: 'https://via.placeholder.com/800x600/059669/ffffff?text=Sample+Image+2',
      alt: 'Sample image 2 showing a green background',
      title: 'Sample Image 2',
      description: 'Another sample image with different colors'
    },
    {
      id: '3',
      src: 'https://via.placeholder.com/800x600/dc2626/ffffff?text=Sample+Image+3',
      alt: 'Sample image 3 showing a red background',
      title: 'Sample Image 3',
      description: 'A third sample image for the carousel'
    }
  ];

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Validate ARIA attributes on mount
  React.useEffect(() => {
    const validateAccessibility = () => {
      const issues: string[] = [];
      
      // Check all interactive elements
      const interactiveElements = document.querySelectorAll('button, [role="button"], input, select, textarea, [role="switch"], [role="tab"]');
      interactiveElements.forEach((element) => {
        const elementIssues = validateAriaAttributes(element as HTMLElement);
        issues.push(...elementIssues);
      });

      if (issues.length > 0) {
        console.warn('ARIA validation issues found:', issues);
      } else {
        console.log('✅ All ARIA attributes are properly implemented');
      }
    };

    // Run validation after component mounts
    setTimeout(validateAccessibility, 1000);
  }, []);

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ARIA Attributes Demo</h1>
          <p className="text-muted-foreground">
            Demonstration of proper ARIA attributes implementation in custom components
          </p>
        </div>
        <Badge variant="outline" className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          WCAG 2.1 AA Compliant
        </Badge>
      </div>

      {/* ARIA Roles and States Reference */}
      <Card>
        <CardHeader>
          <CardTitle>ARIA Implementation Reference</CardTitle>
          <CardDescription>
            Key ARIA roles and states used throughout the application
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Common Roles</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• <code>button</code> - Interactive buttons</li>
                <li>• <code>switch</code> - Toggle switches</li>
                <li>• <code>tab</code> - Tab navigation</li>
                <li>• <code>tabpanel</code> - Tab content</li>
                <li>• <code>dialog</code> - Modal dialogs</li>
                <li>• <code>region</code> - Page sections</li>
                <li>• <code>img</code> - Images and graphics</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Common States</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• <code>aria-expanded</code> - Collapsible content</li>
                <li>• <code>aria-checked</code> - Checkboxes/switches</li>
                <li>• <code>aria-selected</code> - Selected items</li>
                <li>• <code>aria-pressed</code> - Toggle buttons</li>
                <li>• <code>aria-hidden</code> - Decorative elements</li>
                <li>• <code>aria-live</code> - Dynamic content</li>
                <li>• <code>aria-current</code> - Current page/item</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Relationships</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• <code>aria-labelledby</code> - Element labels</li>
                <li>• <code>aria-describedby</code> - Descriptions</li>
                <li>• <code>aria-controls</code> - Controlled elements</li>
                <li>• <code>aria-owns</code> - Owned elements</li>
                <li>• <code>aria-activedescendant</code> - Active child</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Toggle Switches with ARIA */}
      <Card>
        <CardHeader>
          <CardTitle>Toggle Switches with ARIA</CardTitle>
          <CardDescription>
            Switch components with proper ARIA attributes for screen readers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ToggleSwitch
            label="Push Notifications"
            description="Receive notifications for important updates"
            checked={notifications}
            onChange={setNotifications}
          />
          
          <ToggleSwitch
            label="Dark Mode"
            description="Switch between light and dark themes"
            checked={darkMode}
            onChange={setDarkMode}
          />
          
          <ToggleSwitch
            label="Privacy Mode"
            description="Hide sensitive information from other users"
            checked={privacyMode}
            onChange={setPrivacyMode}
          />
        </CardContent>
      </Card>

      {/* Collapsible Sections with ARIA */}
      <Card>
        <CardHeader>
          <CardTitle>Collapsible Sections with ARIA</CardTitle>
          <CardDescription>
            Accordion-style sections with proper ARIA expanded states
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingsSection
            title="Account Settings"
            description="Manage your account preferences and security"
            icon={<User className="h-5 w-5" />}
            defaultExpanded={false}
            onToggle={(expanded) => setExpandedSection(expanded ? 'account' : null)}
          >
            <div className="space-y-4">
              <div>
                <Label htmlFor="username">Username</Label>
                <Input id="username" defaultValue="john.doe" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" defaultValue="john@example.com" />
              </div>
            </div>
          </SettingsSection>

          <SettingsSection
            title="Notification Preferences"
            description="Configure how and when you receive notifications"
            icon={<Bell className="h-5 w-5" />}
            defaultExpanded={false}
            onToggle={(expanded) => setExpandedSection(expanded ? 'notifications' : null)}
          >
            <div className="space-y-4">
              <ToggleSwitch
                label="Email Notifications"
                description="Receive notifications via email"
                checked={true}
                onChange={() => {}}
              />
              <ToggleSwitch
                label="Push Notifications"
                description="Receive push notifications on your device"
                checked={notifications}
                onChange={setNotifications}
              />
            </div>
          </SettingsSection>

          <SettingsSection
            title="Privacy & Security"
            description="Control your privacy settings and security options"
            icon={<Shield className="h-5 w-5" />}
            defaultExpanded={false}
            onToggle={(expanded) => setExpandedSection(expanded ? 'privacy' : null)}
          >
            <div className="space-y-4">
              <ToggleSwitch
                label="Two-Factor Authentication"
                description="Add an extra layer of security to your account"
                checked={false}
                onChange={() => {}}
              />
              <ToggleSwitch
                label="Data Encryption"
                description="Encrypt your data for additional security"
                checked={true}
                onChange={() => {}}
              />
            </div>
          </SettingsSection>
        </CardContent>
      </Card>

      {/* Image Carousel with ARIA */}
      <Card>
        <CardHeader>
          <CardTitle>Image Carousel with ARIA</CardTitle>
          <CardDescription>
            Accessible image carousel with proper ARIA roles and live regions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SwipeableImageCarousel
            images={sampleImages}
            currentIndex={currentImageIndex}
            onIndexChange={setCurrentImageIndex}
            showControls={true}
            showThumbnails={true}
            enableFullscreen={true}
            enableSwipe={true}
            autoPlay={false}
            className="h-96"
          />
        </CardContent>
      </Card>

      {/* Custom ARIA Implementation Examples */}
      <Card>
        <CardHeader>
          <CardTitle>Custom ARIA Implementation</CardTitle>
          <CardDescription>
            Examples of custom ARIA attributes using utility functions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Progress Bar Example */}
            <div>
              <h4 className="font-semibold mb-2">Progress Bar</h4>
              <div
                {...createAriaAttributes.progressBar({
                  value: 65,
                  min: 0,
                  max: 100,
                  labelledBy: 'progress-label',
                })}
                className="w-full bg-gray-200 rounded-full h-2"
              >
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: '65%' }}
                />
              </div>
              <Label id="progress-label" className="text-sm text-muted-foreground">
                Upload Progress: 65%
              </Label>
            </div>

            {/* Tab Navigation Example */}
            <div>
              <h4 className="font-semibold mb-2">Tab Navigation</h4>
              <div role="tablist" aria-label="Settings tabs" className="flex border-b">
                {['General', 'Advanced', 'About'].map((tab, index) => (
                  <button
                    key={tab}
                    {...createAriaAttributes.tab({
                      label: tab,
                      selected: index === 0,
                      controls: `tabpanel-${index}`,
                    })}
                    className="px-4 py-2 text-sm font-medium border-b-2 border-transparent hover:border-gray-300 focus:outline-none focus:border-blue-500"
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <div
                {...createAriaAttributes.tabPanel({
                  labelledBy: 'tab-0',
                })}
                id="tabpanel-0"
                className="mt-4 p-4 border rounded-lg"
              >
                <p>General settings content goes here.</p>
              </div>
            </div>

            {/* Live Region Example */}
            <div>
              <h4 className="font-semibold mb-2">Live Region Announcements</h4>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    // Simulate an action that triggers a live region announcement
                    const liveRegion = document.getElementById('live-region');
                    if (liveRegion) {
                      liveRegion.textContent = 'Action completed successfully!';
                      setTimeout(() => {
                        liveRegion.textContent = '';
                      }, 3000);
                    }
                  }}
                >
                  Trigger Announcement
                </Button>
                <Button
                  onClick={() => {
                    const liveRegion = document.getElementById('live-region');
                    if (liveRegion) {
                      liveRegion.textContent = 'Error: Something went wrong!';
                      setTimeout(() => {
                        liveRegion.textContent = '';
                      }, 3000);
                    }
                  }}
                  variant="destructive"
                >
                  Trigger Error
                </Button>
              </div>
              <div
                id="live-region"
                {...createAriaAttributes.liveRegion({
                  politeness: 'polite',
                  atomic: true,
                })}
                className="sr-only"
                aria-live="polite"
                aria-atomic="true"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Accessibility Guidelines */}
      <Card>
        <CardHeader>
          <CardTitle>ARIA Implementation Guidelines</CardTitle>
          <CardDescription>
            Best practices for implementing ARIA attributes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-3 text-green-600">✅ Do</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Use semantic HTML elements first, ARIA as enhancement</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Provide clear, descriptive labels for all interactive elements</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Use ARIA live regions for dynamic content updates</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Test with screen readers and keyboard navigation</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Use ARIA attributes consistently across similar components</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-red-600">❌ Don't</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <span>Use ARIA attributes on native HTML elements that already have semantics</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <span>Rely solely on color or visual cues to convey information</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <span>Use generic labels like "button" or "link" without context</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <span>Overuse ARIA attributes - keep it simple and necessary</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <span>Forget to test with actual assistive technologies</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};







