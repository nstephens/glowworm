import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AccessibilityTestRunner 
} from './AccessibilityTestRunner';
import { 
  ManualTestingChecklist 
} from './ManualTestingChecklist';
import { 
  CheckCircle, 
  AlertTriangle, 
  Info,
  Shield,
  TestTube,
  ClipboardCheck,
  Download,
  RefreshCw
} from 'lucide-react';

interface AccessibilityTestingDashboardProps {
  className?: string;
}

/**
 * Comprehensive Accessibility Testing Dashboard
 * Combines automated and manual testing tools for complete accessibility validation
 */
export const AccessibilityTestingDashboard: React.FC<AccessibilityTestingDashboardProps> = ({
  className
}) => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Accessibility Testing Dashboard</h1>
          <p className="text-muted-foreground">
            Comprehensive WCAG 2.1 AA compliance testing and validation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="flex items-center gap-1">
            <Shield className="h-3 w-3" />
            WCAG 2.1 AA
          </Badge>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <TestTube className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold">Automated Testing</h3>
                <p className="text-sm text-muted-foreground">
                  Run comprehensive automated accessibility tests
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <ClipboardCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold">Manual Testing</h3>
                <p className="text-sm text-muted-foreground">
                  Complete manual testing checklist
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold">Compliance</h3>
                <p className="text-sm text-muted-foreground">
                  WCAG 2.1 AA standards compliance
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Testing Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="automated">Automated Tests</TabsTrigger>
          <TabsTrigger value="manual">Manual Tests</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Testing Overview</CardTitle>
              <CardDescription>
                Get started with comprehensive accessibility testing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <TestTube className="h-4 w-4" />
                    Automated Testing
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Run automated tests to quickly identify common accessibility issues.
                    These tests check for WCAG 2.1 AA compliance automatically.
                  </p>
                  <ul className="text-sm space-y-1 text-muted-foreground mb-4">
                    <li>• Color contrast validation</li>
                    <li>• ARIA attribute verification</li>
                    <li>• Form label checking</li>
                    <li>• Heading hierarchy validation</li>
                    <li>• Keyboard navigation testing</li>
                  </ul>
                  <Button 
                    onClick={() => setActiveTab('automated')}
                    className="w-full"
                  >
                    Run Automated Tests
                  </Button>
                </div>

                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <ClipboardCheck className="h-4 w-4" />
                    Manual Testing
                  </h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Complete manual testing checklist to ensure comprehensive accessibility.
                    Manual testing catches issues that automated tools might miss.
                  </p>
                  <ul className="text-sm space-y-1 text-muted-foreground mb-4">
                    <li>• Screen reader testing</li>
                    <li>• Keyboard-only navigation</li>
                    <li>• Touch device testing</li>
                    <li>• High contrast mode testing</li>
                    <li>• User experience validation</li>
                  </ul>
                  <Button 
                    onClick={() => setActiveTab('manual')}
                    variant="outline"
                    className="w-full"
                  >
                    Start Manual Testing
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Start Guide */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Start Guide</CardTitle>
              <CardDescription>
                Follow these steps for comprehensive accessibility testing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold">Run Automated Tests</h4>
                    <p className="text-sm text-muted-foreground">
                      Start with automated testing to identify obvious issues quickly.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold">Fix Critical Issues</h4>
                    <p className="text-sm text-muted-foreground">
                      Address all critical and high-severity issues found by automated tests.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold">Complete Manual Testing</h4>
                    <p className="text-sm text-muted-foreground">
                      Use the manual testing checklist to verify user experience and catch edge cases.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                    4
                  </div>
                  <div>
                    <h4 className="font-semibold">Generate Reports</h4>
                    <p className="text-sm text-muted-foreground">
                      Export test results and generate compliance reports for stakeholders.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Testing Standards */}
          <Card>
            <CardHeader>
              <CardTitle>Testing Standards</CardTitle>
              <CardDescription>
                Our testing follows established accessibility standards
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">WCAG 2.1 AA Compliance</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    All tests are designed to ensure compliance with Web Content Accessibility Guidelines 2.1 Level AA.
                  </p>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Perceivable</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Operable</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Understandable</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Robust</span>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Testing Coverage</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Comprehensive testing across all accessibility dimensions.
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Visual accessibility</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Motor accessibility</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Cognitive accessibility</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">Assistive technology</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Automated Tests Tab */}
        <TabsContent value="automated">
          <AccessibilityTestRunner 
            autoRun={false}
            showDetails={true}
          />
        </TabsContent>

        {/* Manual Tests Tab */}
        <TabsContent value="manual">
          <ManualTestingChecklist />
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Test Reports</CardTitle>
              <CardDescription>
                Generate and download accessibility test reports
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Automated Test Report</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Download detailed automated test results in Markdown format.
                  </p>
                  <Button variant="outline" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Download Report
                  </Button>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Manual Test Report</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Export manual testing checklist results and progress.
                  </p>
                  <Button variant="outline" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Export Results
                  </Button>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">Compliance Summary</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Generate a high-level compliance summary for stakeholders.
                  </p>
                  <Button variant="outline" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Generate Summary
                  </Button>
                </div>

                <div className="p-4 border rounded-lg">
                  <h4 className="font-semibold mb-2">JSON Export</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Export raw test data in JSON format for integration.
                  </p>
                  <Button variant="outline" className="w-full">
                    <Download className="h-4 w-4 mr-2" />
                    Export JSON
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Report Templates */}
          <Card>
            <CardHeader>
              <CardTitle>Report Templates</CardTitle>
              <CardDescription>
                Use these templates for consistent reporting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-semibold">Executive Summary Template</h4>
                    <p className="text-sm text-muted-foreground">
                      High-level summary for management and stakeholders
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-semibold">Developer Report Template</h4>
                    <p className="text-sm text-muted-foreground">
                      Detailed technical report for development teams
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <h4 className="font-semibold">QA Testing Template</h4>
                    <p className="text-sm text-muted-foreground">
                      Comprehensive testing checklist for QA teams
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};







