import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info,
  Eye,
  Keyboard,
  MousePointer,
  Volume2,
  Smartphone,
  Monitor,
  Tablet
} from 'lucide-react';

interface TestItem {
  id: string;
  category: string;
  title: string;
  description: string;
  instructions: string[];
  completed: boolean;
  critical: boolean;
  wcagLevel: 'A' | 'AA' | 'AAA';
}

interface ManualTestingChecklistProps {
  className?: string;
}

/**
 * Manual Accessibility Testing Checklist Component
 * Provides a comprehensive checklist for manual accessibility testing
 */
export const ManualTestingChecklist: React.FC<ManualTestingChecklistProps> = ({
  className
}) => {
  const [testItems, setTestItems] = useState<TestItem[]>([
    // Visual Testing
    {
      id: 'visual-1',
      category: 'Visual',
      title: 'Color Contrast Testing',
      description: 'Verify sufficient color contrast ratios',
      instructions: [
        'Test all text against background colors',
        'Ensure 4.5:1 ratio for normal text (14px+)',
        'Ensure 3:1 ratio for large text (18px+)',
        'Test in both light and dark modes',
        'Use browser dev tools or contrast checker'
      ],
      completed: false,
      critical: true,
      wcagLevel: 'AA'
    },
    {
      id: 'visual-2',
      category: 'Visual',
      title: 'High Contrast Mode',
      description: 'Test application in high contrast mode',
      instructions: [
        'Enable Windows High Contrast Mode',
        'Enable browser high contrast settings',
        'Verify all content remains readable',
        'Check that information isn\'t conveyed by color alone',
        'Test all interactive elements'
      ],
      completed: false,
      critical: true,
      wcagLevel: 'AA'
    },
    {
      id: 'visual-3',
      category: 'Visual',
      title: 'Text Scaling',
      description: 'Test text scaling up to 200%',
      instructions: [
        'Zoom browser to 200%',
        'Verify all text remains readable',
        'Check that horizontal scrolling isn\'t required',
        'Test on different screen sizes',
        'Ensure UI elements don\'t overlap'
      ],
      completed: false,
      critical: true,
      wcagLevel: 'AA'
    },

    // Keyboard Testing
    {
      id: 'keyboard-1',
      category: 'Keyboard',
      title: 'Tab Navigation',
      description: 'Test keyboard navigation with Tab key',
      instructions: [
        'Use Tab to navigate through all interactive elements',
        'Verify logical tab order',
        'Check that focus is visible on all elements',
        'Test Shift+Tab for reverse navigation',
        'Ensure no keyboard traps'
      ],
      completed: false,
      critical: true,
      wcagLevel: 'A'
    },
    {
      id: 'keyboard-2',
      category: 'Keyboard',
      title: 'Arrow Key Navigation',
      description: 'Test arrow key navigation in lists and menus',
      instructions: [
        'Use arrow keys in dropdown menus',
        'Test navigation in image galleries',
        'Verify arrow keys work in tab lists',
        'Check that focus moves logically',
        'Test both horizontal and vertical navigation'
      ],
      completed: false,
      critical: true,
      wcagLevel: 'A'
    },
    {
      id: 'keyboard-3',
      category: 'Keyboard',
      title: 'Keyboard Shortcuts',
      description: 'Test all keyboard shortcuts and shortcuts',
      instructions: [
        'Test all announced keyboard shortcuts',
        'Verify shortcuts work consistently',
        'Check that shortcuts don\'t conflict with browser shortcuts',
        'Test shortcuts in different contexts',
        'Ensure shortcuts are discoverable'
      ],
      completed: false,
      critical: false,
      wcagLevel: 'A'
    },

    // Screen Reader Testing
    {
      id: 'screenreader-1',
      category: 'Screen Reader',
      title: 'Screen Reader Navigation',
      description: 'Test with screen reader software',
      instructions: [
        'Use NVDA (Windows) or VoiceOver (Mac)',
        'Navigate through all content using screen reader',
        'Verify all interactive elements are announced',
        'Check that form labels are read correctly',
        'Test heading navigation (H key)'
      ],
      completed: false,
      critical: true,
      wcagLevel: 'A'
    },
    {
      id: 'screenreader-2',
      category: 'Screen Reader',
      title: 'ARIA Announcements',
      description: 'Test ARIA live regions and announcements',
      instructions: [
        'Trigger dynamic content changes',
        'Verify live regions announce changes',
        'Check that status updates are announced',
        'Test error and success messages',
        'Ensure announcements are not too frequent'
      ],
      completed: false,
      critical: true,
      wcagLevel: 'A'
    },
    {
      id: 'screenreader-3',
      category: 'Screen Reader',
      title: 'Landmark Navigation',
      description: 'Test landmark and region navigation',
      instructions: [
        'Use landmark navigation (D key in NVDA)',
        'Verify main, navigation, and other landmarks',
        'Check that landmarks are properly labeled',
        'Test region navigation',
        'Ensure content is properly structured'
      ],
      completed: false,
      critical: true,
      wcagLevel: 'A'
    },

    // Touch Testing
    {
      id: 'touch-1',
      category: 'Touch',
      title: 'Touch Target Size',
      description: 'Test touch target sizes on mobile devices',
      instructions: [
        'Test on actual mobile device',
        'Verify all touch targets are at least 44px',
        'Check spacing between touch targets',
        'Test with different finger sizes',
        'Ensure targets don\'t overlap'
      ],
      completed: false,
      critical: true,
      wcagLevel: 'AA'
    },
    {
      id: 'touch-2',
      category: 'Touch',
      title: 'Touch Gestures',
      description: 'Test touch gestures and interactions',
      instructions: [
        'Test swipe gestures for navigation',
        'Verify pinch-to-zoom works',
        'Test long-press for context menus',
        'Check that gestures are discoverable',
        'Test alternative methods for all gestures'
      ],
      completed: false,
      critical: false,
      wcagLevel: 'A'
    },
    {
      id: 'touch-3',
      category: 'Touch',
      title: 'Orientation Support',
      description: 'Test portrait and landscape orientations',
      instructions: [
        'Test in both portrait and landscape',
        'Verify content remains accessible',
        'Check that orientation changes work',
        'Test with different device sizes',
        'Ensure no content is cut off'
      ],
      completed: false,
      critical: true,
      wcagLevel: 'AA'
    },

    // Form Testing
    {
      id: 'form-1',
      category: 'Forms',
      title: 'Form Labels and Instructions',
      description: 'Test form accessibility and labeling',
      instructions: [
        'Verify all form fields have labels',
        'Check that labels are associated correctly',
        'Test required field indicators',
        'Verify error messages are clear',
        'Test form validation announcements'
      ],
      completed: false,
      critical: true,
      wcagLevel: 'A'
    },
    {
      id: 'form-2',
      category: 'Forms',
      title: 'Form Error Handling',
      description: 'Test form error identification and correction',
      instructions: [
        'Submit forms with invalid data',
        'Verify errors are clearly identified',
        'Check that error messages are helpful',
        'Test error correction process',
        'Verify errors are announced to screen readers'
      ],
      completed: false,
      critical: true,
      wcagLevel: 'A'
    },

    // Content Testing
    {
      id: 'content-1',
      category: 'Content',
      title: 'Heading Structure',
      description: 'Test heading hierarchy and structure',
      instructions: [
        'Verify proper heading hierarchy (h1, h2, h3, etc.)',
        'Check that headings are not skipped',
        'Test heading navigation in screen reader',
        'Verify headings describe content sections',
        'Check that page has only one h1'
      ],
      completed: false,
      critical: true,
      wcagLevel: 'A'
    },
    {
      id: 'content-2',
      category: 'Content',
      title: 'Link and Button Text',
      description: 'Test descriptive link and button text',
      instructions: [
        'Verify all links have descriptive text',
        'Check that link text makes sense out of context',
        'Test button text clarity',
        'Verify no "click here" or "read more" links',
        'Test link and button announcements'
      ],
      completed: false,
      critical: true,
      wcagLevel: 'A'
    },
    {
      id: 'content-3',
      category: 'Content',
      title: 'Image Alt Text',
      description: 'Test image alternative text',
      instructions: [
        'Verify all images have alt text',
        'Check that alt text is descriptive',
        'Test decorative images have empty alt',
        'Verify complex images have detailed descriptions',
        'Test alt text in screen reader'
      ],
      completed: false,
      critical: true,
      wcagLevel: 'A'
    }
  ]);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const toggleTestItem = (id: string) => {
    setTestItems(prev => 
      prev.map(item => 
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const resetAllTests = () => {
    setTestItems(prev => 
      prev.map(item => ({ ...item, completed: false }))
    );
  };

  const completeAllTests = () => {
    setTestItems(prev => 
      prev.map(item => ({ ...item, completed: true }))
    );
  };

  const categories = ['all', 'Visual', 'Keyboard', 'Screen Reader', 'Touch', 'Forms', 'Content'];
  
  const filteredItems = selectedCategory === 'all' 
    ? testItems 
    : testItems.filter(item => item.category === selectedCategory);

  const completedCount = filteredItems.filter(item => item.completed).length;
  const totalCount = filteredItems.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const criticalItems = filteredItems.filter(item => item.critical);
  const criticalCompleted = criticalItems.filter(item => item.completed).length;
  const criticalProgress = criticalItems.length > 0 ? (criticalCompleted / criticalItems.length) * 100 : 100;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Visual': return <Eye className="h-4 w-4" />;
      case 'Keyboard': return <Keyboard className="h-4 w-4" />;
      case 'Screen Reader': return <Volume2 className="h-4 w-4" />;
      case 'Touch': return <Smartphone className="h-4 w-4" />;
      case 'Forms': return <MousePointer className="h-4 w-4" />;
      case 'Content': return <Info className="h-4 w-4" />;
      default: return <Monitor className="h-4 w-4" />;
    }
  };

  const getWcagBadgeVariant = (level: string) => {
    switch (level) {
      case 'A': return 'default';
      case 'AA': return 'secondary';
      case 'AAA': return 'outline';
      default: return 'outline';
    }
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Manual Testing Checklist</h2>
          <p className="text-muted-foreground">
            Comprehensive manual accessibility testing checklist
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={resetAllTests}>
            Reset All
          </Button>
          <Button variant="outline" size="sm" onClick={completeAllTests}>
            Complete All
          </Button>
        </div>
      </div>

      {/* Progress Summary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Testing Progress</CardTitle>
          <CardDescription>
            Track your manual testing progress across all categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Overall Progress</span>
                <span>{completedCount}/{totalCount} ({Math.round(progress)}%)</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span>Critical Tests</span>
                <span>{criticalCompleted}/{criticalItems.length} ({Math.round(criticalProgress)}%)</span>
              </div>
              <Progress value={criticalProgress} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Filter */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Test Categories</CardTitle>
          <CardDescription>
            Filter tests by category to focus on specific areas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => {
              const count = category === 'all' 
                ? testItems.length 
                : testItems.filter(item => item.category === category).length;
              const completed = category === 'all'
                ? testItems.filter(item => item.completed).length
                : testItems.filter(item => item.category === category && item.completed).length;
              
              return (
                <Button
                  key={category}
                  variant={selectedCategory === category ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category)}
                  className="flex items-center gap-2"
                >
                  {getCategoryIcon(category)}
                  {category}
                  <Badge variant="secondary" className="ml-1">
                    {completed}/{count}
                  </Badge>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Test Items */}
      <div className="space-y-4">
        {filteredItems.map((item) => (
          <Card key={item.id} className={item.completed ? 'border-green-200 bg-green-50' : ''}>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <Checkbox
                  checked={item.completed}
                  onCheckedChange={() => toggleTestItem(item.id)}
                  className="mt-1"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{item.title}</h3>
                    {item.critical && (
                      <Badge variant="destructive" className="text-xs">
                        Critical
                      </Badge>
                    )}
                    <Badge variant={getWcagBadgeVariant(item.wcagLevel)} className="text-xs">
                      WCAG {item.wcagLevel}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{item.description}</p>
                  
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Instructions:</h4>
                    <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                      {item.instructions.map((instruction, index) => (
                        <li key={index}>{instruction}</li>
                      ))}
                    </ol>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {item.completed ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <div className="h-5 w-5 border-2 border-gray-300 rounded-full" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Testing Tips */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Testing Tips</CardTitle>
          <CardDescription>
            Best practices for manual accessibility testing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Testing Tools</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Browser Developer Tools</li>
                <li>• Screen readers (NVDA, VoiceOver, JAWS)</li>
                <li>• Color contrast checkers</li>
                <li>• Keyboard-only navigation</li>
                <li>• Mobile device testing</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Testing Environment</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Test on multiple browsers</li>
                <li>• Test on different screen sizes</li>
                <li>• Test with different input methods</li>
                <li>• Test with assistive technologies</li>
                <li>• Test in different lighting conditions</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};







