import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Info, 
  RefreshCw, 
  Play,
  Settings,
  Shield,
  Zap,
  Layout,
  Code,
  Activity,
  Accessibility,
  Eye,
  MousePointer,
  Keyboard,
  Smartphone,
  Monitor,
  Tablet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface PolishCheck {
  id: string;
  name: string;
  description: string;
  category: 'visual' | 'interaction' | 'accessibility' | 'performance' | 'responsive';
  status: 'pending' | 'checking' | 'passed' | 'failed' | 'warning';
  details?: string;
  critical: boolean;
}

interface PolishReport {
  total: number;
  passed: number;
  failed: number;
  warnings: number;
  critical: number;
  criticalPassed: number;
  criticalFailed: number;
  score: number;
}

export const FinalPolish: React.FC = () => {
  const [checks, setChecks] = useState<PolishCheck[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [report, setReport] = useState<PolishReport | null>(null);
  const [activeTab, setActiveTab] = useState<string>('visual');
  const prefersReducedMotion = useReducedMotion();

  // Initialize polish checks
  useEffect(() => {
    const initializeChecks = () => {
      const initialChecks: PolishCheck[] = [
        // Visual checks
        {
          id: 'visual-1',
          name: 'Color Contrast',
          description: 'Check color contrast ratios meet WCAG AA standards',
          category: 'visual',
          status: 'pending',
          critical: true,
        },
        {
          id: 'visual-2',
          name: 'Typography Consistency',
          description: 'Verify consistent typography across all components',
          category: 'visual',
          status: 'pending',
          critical: true,
        },
        {
          id: 'visual-3',
          name: 'Spacing Consistency',
          description: 'Check consistent spacing using design system tokens',
          category: 'visual',
          status: 'pending',
          critical: true,
        },
        {
          id: 'visual-4',
          name: 'Border Radius Consistency',
          description: 'Verify consistent border radius values',
          category: 'visual',
          status: 'pending',
          critical: false,
        },
        {
          id: 'visual-5',
          name: 'Shadow Consistency',
          description: 'Check consistent shadow values and elevation',
          category: 'visual',
          status: 'pending',
          critical: false,
        },
        
        // Interaction checks
        {
          id: 'interaction-1',
          name: 'Hover States',
          description: 'Verify all interactive elements have hover states',
          category: 'interaction',
          status: 'pending',
          critical: true,
        },
        {
          id: 'interaction-2',
          name: 'Focus States',
          description: 'Check focus indicators are visible and consistent',
          category: 'interaction',
          status: 'pending',
          critical: true,
        },
        {
          id: 'interaction-3',
          name: 'Active States',
          description: 'Verify active states for buttons and interactive elements',
          category: 'interaction',
          status: 'pending',
          critical: true,
        },
        {
          id: 'interaction-4',
          name: 'Loading States',
          description: 'Check loading indicators are present and consistent',
          category: 'interaction',
          status: 'pending',
          critical: false,
        },
        {
          id: 'interaction-5',
          name: 'Error States',
          description: 'Verify error states are clear and actionable',
          category: 'interaction',
          status: 'pending',
          critical: true,
        },
        
        // Accessibility checks
        {
          id: 'accessibility-1',
          name: 'ARIA Labels',
          description: 'Check all interactive elements have proper ARIA labels',
          category: 'accessibility',
          status: 'pending',
          critical: true,
        },
        {
          id: 'accessibility-2',
          name: 'Keyboard Navigation',
          description: 'Verify keyboard navigation works for all interactive elements',
          category: 'accessibility',
          status: 'pending',
          critical: true,
        },
        {
          id: 'accessibility-3',
          name: 'Screen Reader Support',
          description: 'Check screen reader compatibility and announcements',
          category: 'accessibility',
          status: 'pending',
          critical: true,
        },
        {
          id: 'accessibility-4',
          name: 'Color Blind Support',
          description: 'Verify color choices work for color blind users',
          category: 'accessibility',
          status: 'pending',
          critical: false,
        },
        {
          id: 'accessibility-5',
          name: 'Motion Preferences',
          description: 'Check reduced motion preferences are respected',
          category: 'accessibility',
          status: 'pending',
          critical: false,
        },
        
        // Performance checks
        {
          id: 'performance-1',
          name: 'Core Web Vitals',
          description: 'Verify Core Web Vitals meet performance targets',
          category: 'performance',
          status: 'pending',
          critical: true,
        },
        {
          id: 'performance-2',
          name: 'Bundle Size',
          description: 'Check JavaScript bundle size is optimized',
          category: 'performance',
          status: 'pending',
          critical: true,
        },
        {
          id: 'performance-3',
          name: 'Image Optimization',
          description: 'Verify images are optimized and use modern formats',
          category: 'performance',
          status: 'pending',
          critical: false,
        },
        {
          id: 'performance-4',
          name: 'Lazy Loading',
          description: 'Check lazy loading is implemented for images and components',
          category: 'performance',
          status: 'pending',
          critical: false,
        },
        {
          id: 'performance-5',
          name: 'Caching Strategy',
          description: 'Verify caching strategies are implemented',
          category: 'performance',
          status: 'pending',
          critical: false,
        },
        
        // Responsive checks
        {
          id: 'responsive-1',
          name: 'Mobile Layout',
          description: 'Check layout works correctly on mobile devices',
          category: 'responsive',
          status: 'pending',
          critical: true,
        },
        {
          id: 'responsive-2',
          name: 'Tablet Layout',
          description: 'Verify layout works on tablet devices',
          category: 'responsive',
          status: 'pending',
          critical: true,
        },
        {
          id: 'responsive-3',
          name: 'Desktop Layout',
          description: 'Check layout works on desktop devices',
          category: 'responsive',
          status: 'pending',
          critical: true,
        },
        {
          id: 'responsive-4',
          name: 'Touch Targets',
          description: 'Verify touch targets are appropriately sized',
          category: 'responsive',
          status: 'pending',
          critical: true,
        },
        {
          id: 'responsive-5',
          name: 'Orientation Support',
          description: 'Check layout works in both portrait and landscape',
          category: 'responsive',
          status: 'pending',
          critical: false,
        },
      ];

      setChecks(initialChecks);
    };

    initializeChecks();
  }, []);

  // Run polish checks
  const runChecks = async () => {
    setIsRunning(true);
    
    // Simulate running checks
    for (let i = 0; i < checks.length; i++) {
      setChecks(prev => prev.map((check, index) => 
        index === i ? { ...check, status: 'checking' } : check
      ));

      // Simulate check duration
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));

      // Simulate check results
      const passed = Math.random() > 0.2; // 80% pass rate
      const warning = Math.random() > 0.8; // 20% warning rate
      
      setChecks(prev => prev.map((check, index) => 
        index === i ? { 
          ...check, 
          status: passed ? 'passed' : warning ? 'warning' : 'failed',
          details: passed ? 'Check passed successfully' : warning ? 'Check passed with warnings' : 'Check failed'
        } : check
      ));
    }

    setIsRunning(false);
    calculateReport();
  };

  // Calculate report
  const calculateReport = () => {
    const total = checks.length;
    const passed = checks.filter(c => c.status === 'passed').length;
    const failed = checks.filter(c => c.status === 'failed').length;
    const warnings = checks.filter(c => c.status === 'warning').length;
    const critical = checks.filter(c => c.critical).length;
    const criticalPassed = checks.filter(c => c.critical && c.status === 'passed').length;
    const criticalFailed = critical - criticalPassed;
    const score = total > 0 ? (passed / total) * 100 : 0;

    setReport({
      total,
      passed,
      failed,
      warnings,
      critical,
      criticalPassed,
      criticalFailed,
      score,
    });
  };

  const getCheckIcon = (status: string) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case 'checking':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />;
      default:
        return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  const getCheckColor = (status: string) => {
    switch (status) {
      case 'passed':
        return 'text-green-600 bg-green-100';
      case 'failed':
        return 'text-red-600 bg-red-100';
      case 'warning':
        return 'text-yellow-600 bg-yellow-100';
      case 'checking':
        return 'text-blue-600 bg-blue-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'visual':
        return <Eye className="h-4 w-4" />;
      case 'interaction':
        return <MousePointer className="h-4 w-4" />;
      case 'accessibility':
        return <Accessibility className="h-4 w-4" />;
      case 'performance':
        return <Activity className="h-4 w-4" />;
      case 'responsive':
        return <Smartphone className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'visual':
        return 'text-blue-600 bg-blue-100';
      case 'interaction':
        return 'text-purple-600 bg-purple-100';
      case 'accessibility':
        return 'text-orange-600 bg-orange-100';
      case 'performance':
        return 'text-green-600 bg-green-100';
      case 'responsive':
        return 'text-pink-600 bg-pink-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getCategoryChecks = (category: string) => {
    return checks.filter(check => check.category === category);
  };

  const getCategoryScore = (category: string) => {
    const categoryChecks = getCategoryChecks(category);
    const passed = categoryChecks.filter(c => c.status === 'passed').length;
    return categoryChecks.length > 0 ? (passed / categoryChecks.length) * 100 : 0;
  };

  return (
    <motion.div
      className="space-y-6"
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Final Polish</h2>
          <p className="text-muted-foreground">
            Comprehensive UI polish and consistency checks
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={runChecks}
            disabled={isRunning}
            size="sm"
          >
            {isRunning ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {isRunning ? 'Running Checks...' : 'Run Checks'}
          </Button>
        </div>
      </div>

      {/* Overall Report */}
      {report && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Overall Report
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Overall Score</span>
                <span className="text-2xl font-bold">{report.score.toFixed(1)}%</span>
              </div>
              
              <Progress value={report.score} className="h-2" />
              
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">{report.passed}</p>
                  <p className="text-sm text-muted-foreground">Passed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-600">{report.failed}</p>
                  <p className="text-sm text-muted-foreground">Failed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-600">{report.warnings}</p>
                  <p className="text-sm text-muted-foreground">Warnings</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">{report.total}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="visual">Visual</TabsTrigger>
          <TabsTrigger value="interaction">Interaction</TabsTrigger>
          <TabsTrigger value="accessibility">Accessibility</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="responsive">Responsive</TabsTrigger>
        </TabsList>

        {['visual', 'interaction', 'accessibility', 'performance', 'responsive'].map((category) => {
          const categoryChecks = getCategoryChecks(category);
          const categoryScore = getCategoryScore(category);

          return (
            <TabsContent key={category} value={category} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getCategoryIcon(category)}
                    {category.charAt(0).toUpperCase() + category.slice(1)} Checks
                  </CardTitle>
                  <CardDescription>
                    {categoryChecks.length} checks • {categoryScore.toFixed(1)}% passed
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Score</span>
                      <span className="text-xl font-bold">{categoryScore.toFixed(1)}%</span>
                    </div>
                    
                    <Progress value={categoryScore} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              {/* Check Results */}
              <Card>
                <CardHeader>
                  <CardTitle>Check Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {categoryChecks.map((check, index) => (
                      <motion.div
                        key={check.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                        initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.1 }}
                      >
                        <div className="flex items-center gap-3">
                          {getCheckIcon(check.status)}
                          <div>
                            <h4 className="font-medium">{check.name}</h4>
                            <p className="text-sm text-muted-foreground">{check.description}</p>
                            {check.details && (
                              <p className="text-xs text-muted-foreground mt-1">{check.details}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getCheckColor(check.status)}>
                            {check.status.charAt(0).toUpperCase() + check.status.slice(1)}
                          </Badge>
                          {check.critical && (
                            <Badge variant="outline">Critical</Badge>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
    </motion.div>
  );
};
