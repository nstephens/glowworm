import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Info, 
  Eye, 
  EyeOff,
  Keyboard,
  MousePointer
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccessibilityIssue {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  element?: HTMLElement;
  severity: 'high' | 'medium' | 'low';
  wcagLevel: 'A' | 'AA' | 'AAA';
  fix?: string;
}

interface AccessibilityAuditProps {
  children: React.ReactNode;
  enableInDevelopment?: boolean;
  showIssues?: boolean;
  className?: string;
}

export const AccessibilityAudit: React.FC<AccessibilityAuditProps> = ({
  children,
  enableInDevelopment = true,
  showIssues = false,
  className,
}) => {
  const [issues, setIssues] = useState<AccessibilityIssue[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [showAuditPanel, setShowAuditPanel] = useState(showIssues);

  // Run accessibility audit
  const runAudit = async () => {
    if (!enableInDevelopment || process.env.NODE_ENV === 'production') return;

    setIsAuditing(true);
    const foundIssues: AccessibilityIssue[] = [];

    try {
      // Check for missing alt text on images
      const images = document.querySelectorAll('img');
      images.forEach((img, index) => {
        if (!img.alt && !img.getAttribute('aria-label')) {
          foundIssues.push({
            id: `missing-alt-${index}`,
            type: 'error',
            message: 'Image missing alt text',
            element: img,
            severity: 'high',
            wcagLevel: 'A',
            fix: 'Add alt attribute or aria-label to describe the image',
          });
        }
      });

      // Check for missing form labels
      const inputs = document.querySelectorAll('input, select, textarea');
      inputs.forEach((input, index) => {
        const id = input.getAttribute('id');
        const ariaLabel = input.getAttribute('aria-label');
        const ariaLabelledBy = input.getAttribute('aria-labelledby');
        
        if (!id && !ariaLabel && !ariaLabelledBy) {
          foundIssues.push({
            id: `missing-label-${index}`,
            type: 'error',
            message: 'Form control missing label',
            element: input as HTMLElement,
            severity: 'high',
            wcagLevel: 'A',
            fix: 'Add id attribute and associate with a label element',
          });
        }
      });

      // Check for missing heading hierarchy
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      let previousLevel = 0;
      headings.forEach((heading, index) => {
        const level = parseInt(heading.tagName.charAt(1));
        if (level > previousLevel + 1) {
          foundIssues.push({
            id: `heading-skip-${index}`,
            type: 'warning',
            message: `Heading level skipped from h${previousLevel} to h${level}`,
            element: heading as HTMLElement,
            severity: 'medium',
            wcagLevel: 'AA',
            fix: 'Use sequential heading levels (h1, h2, h3, etc.)',
          });
        }
        previousLevel = level;
      });

      // Check for missing focus indicators
      const focusableElements = document.querySelectorAll(
        'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusableElements.forEach((element, index) => {
        const computedStyle = window.getComputedStyle(element);
        const outline = computedStyle.outline;
        const boxShadow = computedStyle.boxShadow;
        
        if (outline === 'none' && !boxShadow.includes('rgb')) {
          foundIssues.push({
            id: `missing-focus-${index}`,
            type: 'warning',
            message: 'Focusable element missing visible focus indicator',
            element: element as HTMLElement,
            severity: 'medium',
            wcagLevel: 'AA',
            fix: 'Add visible focus indicator using CSS outline or box-shadow',
          });
        }
      });

      // Check for color contrast (simplified check)
      const textElements = document.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6');
      textElements.forEach((element, index) => {
        const computedStyle = window.getComputedStyle(element);
        const color = computedStyle.color;
        const backgroundColor = computedStyle.backgroundColor;
        
        // This is a simplified check - in a real implementation, you'd use a proper contrast checker
        if (color === backgroundColor) {
          foundIssues.push({
            id: `contrast-${index}`,
            type: 'error',
            message: 'Text and background colors are the same',
            element: element as HTMLElement,
            severity: 'high',
            wcagLevel: 'AA',
            fix: 'Ensure sufficient color contrast (4.5:1 for normal text, 3:1 for large text)',
          });
        }
      });

      // Check for missing ARIA labels on interactive elements
      const interactiveElements = document.querySelectorAll(
        'button, a, input, select, textarea, [role="button"], [role="link"]'
      );
      interactiveElements.forEach((element, index) => {
        const hasAriaLabel = element.getAttribute('aria-label');
        const hasAriaLabelledBy = element.getAttribute('aria-labelledby');
        const hasTextContent = element.textContent?.trim();
        const hasTitle = element.getAttribute('title');
        
        if (!hasAriaLabel && !hasAriaLabelledBy && !hasTextContent && !hasTitle) {
          foundIssues.push({
            id: `missing-aria-${index}`,
            type: 'warning',
            message: 'Interactive element missing accessible name',
            element: element as HTMLElement,
            severity: 'medium',
            wcagLevel: 'A',
            fix: 'Add aria-label, aria-labelledby, or visible text content',
          });
        }
      });

      setIssues(foundIssues);
    } catch (error) {
      console.error('Accessibility audit failed:', error);
    } finally {
      setIsAuditing(false);
    }
  };

  // Run audit on mount and when children change
  useEffect(() => {
    if (enableInDevelopment && process.env.NODE_ENV !== 'production') {
      const timer = setTimeout(runAudit, 1000);
      return () => clearTimeout(timer);
    }
  }, [children, enableInDevelopment]);

  const getIssueIcon = (type: AccessibilityIssue['type']) => {
    switch (type) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getSeverityBadge = (severity: AccessibilityIssue['severity']) => {
    const variants = {
      high: 'destructive',
      medium: 'secondary',
      low: 'outline',
    } as const;

    return (
      <Badge variant={variants[severity]} className="text-xs">
        {severity}
      </Badge>
    );
  };

  if (!enableInDevelopment || process.env.NODE_ENV === 'production') {
    return <>{children}</>;
  }

  return (
    <div className={cn("relative", className)}>
      {children}
      
      {/* Audit Panel */}
      {showAuditPanel && (
        <div className="fixed top-4 right-4 z-50 max-w-md">
          <Card className="shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Accessibility Audit</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAuditPanel(false)}
                    aria-label="Close audit panel"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardDescription>
                Found {issues.length} accessibility issues
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-3 max-h-96 overflow-y-auto">
              {issues.length === 0 ? (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">No accessibility issues found!</span>
                </div>
              ) : (
                issues.map((issue) => (
                  <Alert key={issue.id} className="p-3">
                    <div className="flex items-start gap-2">
                      {getIssueIcon(issue.type)}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{issue.message}</span>
                          {getSeverityBadge(issue.severity)}
                          <Badge variant="outline" className="text-xs">
                            WCAG {issue.wcagLevel}
                          </Badge>
                        </div>
                        {issue.fix && (
                          <p className="text-xs text-muted-foreground">{issue.fix}</p>
                        )}
                      </div>
                    </div>
                  </Alert>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Toggle Button */}
      <Button
        variant="outline"
        size="sm"
        className="fixed bottom-4 right-4 z-50"
        onClick={() => setShowAuditPanel(!showAuditPanel)}
        aria-label="Toggle accessibility audit panel"
      >
        {showAuditPanel ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        <span className="ml-2">
          {issues.length > 0 && (
            <Badge variant="destructive" className="ml-1">
              {issues.length}
            </Badge>
          )}
        </span>
      </Button>
    </div>
  );
};
