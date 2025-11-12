import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info,
  Download,
  RefreshCw,
  Eye,
  EyeOff,
  Keyboard,
  MousePointer,
  Volume2,
  Shield
} from 'lucide-react';
import { 
  runAccessibilityTests, 
  generateAccessibilityReport, 
  exportTestResults,
  AccessibilityTestSuite,
  AccessibilityTestResult 
} from '@/utils/accessibilityTesting';

interface AccessibilityTestRunnerProps {
  className?: string;
  autoRun?: boolean;
  showDetails?: boolean;
}

/**
 * Comprehensive Accessibility Test Runner Component
 * Provides automated testing and reporting for WCAG 2.1 AA compliance
 */
export const AccessibilityTestRunner: React.FC<AccessibilityTestRunnerProps> = ({
  className,
  autoRun = false,
  showDetails = true
}) => {
  const [testSuite, setTestSuite] = useState<AccessibilityTestSuite | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showIssues, setShowIssues] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Auto-run tests on mount if enabled
  useEffect(() => {
    if (autoRun) {
      runTests();
    }
  }, [autoRun]);

  const runTests = async () => {
    setIsRunning(true);
    
    // Simulate test execution time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const results = runAccessibilityTests();
    setTestSuite(results);
    setIsRunning(false);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeVariant = (score: number) => {
    if (score >= 90) return 'default';
    if (score >= 70) return 'secondary';
    return 'destructive';
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'high':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'low':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <Info className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-red-50 text-red-700 border-red-100';
      case 'medium':
        return 'bg-yellow-50 text-yellow-700 border-yellow-100';
      case 'low':
        return 'bg-blue-50 text-blue-700 border-blue-100';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-100';
    }
  };

  const filteredTests = testSuite ? testSuite.tests.filter(test => {
    if (selectedCategory === 'all') return true;
    if (selectedCategory === 'errors') return test.type === 'error';
    if (selectedCategory === 'warnings') return test.type === 'warning';
    return test.type === selectedCategory;
  }) : [];

  const downloadReport = () => {
    if (!testSuite) return;
    
    const report = generateAccessibilityReport(testSuite);
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accessibility-report-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadJson = () => {
    if (!testSuite) return;
    
    const json = exportTestResults(testSuite);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `accessibility-results-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold">Accessibility Test Suite</h2>
          <p className="text-muted-foreground">
            Comprehensive WCAG 2.1 AA compliance testing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={runTests}
            disabled={isRunning}
            className="flex items-center gap-2"
          >
            {isRunning ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {isRunning ? 'Running Tests...' : 'Run Tests'}
          </Button>
        </div>
      </div>

      {/* Test Results Summary */}
      {testSuite && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Test Results Summary
            </CardTitle>
            <CardDescription>
              Overall accessibility compliance score and test statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className={`text-3xl font-bold ${getScoreColor(testSuite.score)}`}>
                  {testSuite.score}%
                </div>
                <div className="text-sm text-muted-foreground">Overall Score</div>
                <Progress value={testSuite.score} className="mt-2" />
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">
                  {testSuite.passed}
                </div>
                <div className="text-sm text-muted-foreground">Passed</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-red-600">
                  {testSuite.failed}
                </div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">
                  {testSuite.warnings}
                </div>
                <div className="text-sm text-muted-foreground">Warnings</div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowIssues(!showIssues)}
                className="flex items-center gap-2"
              >
                {showIssues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showIssues ? 'Hide Issues' : 'Show Issues'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadReport}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download Report
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadJson}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Export JSON
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Categories */}
      {testSuite && showIssues && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Test Categories</CardTitle>
            <CardDescription>
              Filter test results by category and severity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { id: 'all', label: 'All Tests', count: testSuite.tests.length },
                { id: 'errors', label: 'Errors', count: testSuite.failed },
                { id: 'warnings', label: 'Warnings', count: testSuite.warnings },
              ].map((category) => (
                <Button
                  key={category.id}
                  variant={selectedCategory === category.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(category.id)}
                  className="flex items-center gap-2"
                >
                  {category.label}
                  <Badge variant="secondary" className="ml-1">
                    {category.count}
                  </Badge>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Results Details */}
      {testSuite && showIssues && filteredTests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              Detailed results for {selectedCategory === 'all' ? 'all tests' : selectedCategory}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredTests.map((test, index) => (
                <div
                  key={`${test.id}-${index}`}
                  className="flex items-start gap-4 p-4 border rounded-lg"
                >
                  <div className="flex-shrink-0 mt-1">
                    {getSeverityIcon(test.severity)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant={test.type === 'error' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {test.type}
                      </Badge>
                      <Badge
                        className={`text-xs ${getSeverityColor(test.severity)}`}
                      >
                        {test.severity}
                      </Badge>
                      {test.wcagLevel && (
                        <Badge variant="outline" className="text-xs">
                          WCAG {test.wcagLevel}
                        </Badge>
                      )}
                    </div>
                    <h4 className="font-medium text-sm mb-1">{test.message}</h4>
                    {test.element && (
                      <p className="text-xs text-muted-foreground mb-2">
                        Element: <code>{test.element.tagName.toLowerCase()}</code>
                        {test.element.className && (
                          <span> with class: <code>{test.element.className}</code></span>
                        )}
                      </p>
                    )}
                    {test.fix && (
                      <div className="bg-blue-50 border border-blue-200 rounded p-2">
                        <p className="text-xs font-medium text-blue-800 mb-1">Fix:</p>
                        <p className="text-xs text-blue-700">{test.fix}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Issues Message */}
      {testSuite && showIssues && filteredTests.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Issues Found</h3>
            <p className="text-muted-foreground">
              {selectedCategory === 'all' 
                ? 'All accessibility tests passed! Your application meets WCAG 2.1 AA standards.'
                : `No ${selectedCategory} found in the current test results.`
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Accessibility Guidelines */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>WCAG 2.1 AA Guidelines</CardTitle>
          <CardDescription>
            Key accessibility principles and testing criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Perceivable
              </h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Alt text for images</li>
                <li>• Color contrast (4.5:1)</li>
                <li>• Text resizing support</li>
                <li>• Audio/video captions</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Keyboard className="h-4 w-4" />
                Operable
              </h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Keyboard navigation</li>
                <li>• Focus management</li>
                <li>• Touch target size (44px)</li>
                <li>• No seizure triggers</li>
              </ul>
            </div>
            <div className="space-y-2">
              <h4 className="font-semibold flex items-center gap-2">
                <Volume2 className="h-4 w-4" />
                Understandable
              </h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Clear language</li>
                <li>• Consistent navigation</li>
                <li>• Error identification</li>
                <li>• Help and instructions</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};








