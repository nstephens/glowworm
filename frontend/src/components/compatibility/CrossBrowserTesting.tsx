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
  Pause,
  Settings,
  Shield,
  Zap,
  Layout,
  Code,
  Activity,
  Accessibility
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { 
  useCrossBrowserTesting,
  createDefaultTestSuites,
  type TestResult,
  type TestSummary 
} from '@/utils/crossBrowserTesting';
import { detectBrowser } from '@/utils/browserDetection';

interface CrossBrowserTestingProps {
  className?: string;
  autoRun?: boolean;
  showDetails?: boolean;
}

export const CrossBrowserTesting: React.FC<CrossBrowserTestingProps> = ({
  className,
  autoRun = false,
  showDetails = true,
}) => {
  const [browserInfo, setBrowserInfo] = useState<any>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const {
    tester,
    results,
    isRunning,
    error,
    runTests,
    getSuiteResults,
    getSuiteSummary,
    getAllSummaries,
  } = useCrossBrowserTesting();

  // Initialize browser detection
  useEffect(() => {
    const initialize = async () => {
      try {
        const info = await detectBrowser();
        setBrowserInfo(info);
        tester.initialize(info.name, info.version.toString());
        setIsInitialized(true);

        if (autoRun) {
          runTests();
        }
      } catch (err) {
        console.error('Failed to initialize browser detection:', err);
      }
    };

    initialize();
  }, [tester, autoRun, runTests]);

  const getTestIcon = (passed: boolean, critical: boolean) => {
    if (passed) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    if (critical) {
      return <XCircle className="h-4 w-4 text-red-600" />;
    }
    return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
  };

  const getTestColor = (passed: boolean, critical: boolean) => {
    if (passed) {
      return 'text-green-600 bg-green-100';
    }
    if (critical) {
      return 'text-red-600 bg-red-100';
    }
    return 'text-yellow-600 bg-yellow-100';
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'layout':
        return <Layout className="h-4 w-4" />;
      case 'functionality':
        return <Code className="h-4 w-4" />;
      case 'performance':
        return <Activity className="h-4 w-4" />;
      case 'accessibility':
        return <Accessibility className="h-4 w-4" />;
      default:
        return <Settings className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'layout':
        return 'text-blue-600 bg-blue-100';
      case 'functionality':
        return 'text-purple-600 bg-purple-100';
      case 'performance':
        return 'text-green-600 bg-green-100';
      case 'accessibility':
        return 'text-orange-600 bg-orange-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (error) {
    return (
      <Card className={cn('border-destructive', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Testing Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={runTests} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!isInitialized) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const allSummaries = getAllSummaries();
  const totalTests = Array.from(allSummaries.values()).reduce((sum, summary) => sum + summary.total, 0);
  const totalPassed = Array.from(allSummaries.values()).reduce((sum, summary) => sum + summary.passed, 0);
  const totalFailed = totalTests - totalPassed;
  const overallScore = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;

  return (
    <motion.div
      className={cn('space-y-6', className)}
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Cross-Browser Testing</h2>
          <p className="text-muted-foreground">
            Comprehensive testing across all supported browsers and devices
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={runTests}
            disabled={isRunning}
            size="sm"
          >
            {isRunning ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {isRunning ? 'Running Tests...' : 'Run Tests'}
          </Button>
        </div>
      </div>

      {/* Browser Information */}
      {browserInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Browser Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {browserInfo.name === 'chrome' ? '🟢' : 
                   browserInfo.name === 'firefox' ? '🟠' : 
                   browserInfo.name === 'safari' ? '🔵' : 
                   browserInfo.name === 'edge' ? '🔷' : '❓'}
                </span>
                <div>
                  <h3 className="font-semibold capitalize">{browserInfo.name}</h3>
                  <p className="text-sm text-muted-foreground">Version {browserInfo.version}</p>
                </div>
              </div>
              <Badge variant={browserInfo.isSupported ? 'default' : 'destructive'}>
                {browserInfo.isSupported ? 'Supported' : 'Unsupported'}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overall Results */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Overall Results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Score</span>
              <span className="text-2xl font-bold">{overallScore.toFixed(1)}%</span>
            </div>
            
            <Progress value={overallScore} className="h-2" />
            
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{totalPassed}</p>
                <p className="text-sm text-muted-foreground">Passed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{totalFailed}</p>
                <p className="text-sm text-muted-foreground">Failed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{totalTests}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Suites */}
      <Tabs defaultValue="layout" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="layout">Layout</TabsTrigger>
          <TabsTrigger value="functionality">Functionality</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="accessibility">Accessibility</TabsTrigger>
        </TabsList>

        {['layout', 'functionality', 'performance', 'accessibility'].map((category) => {
          const suiteName = `${category.charAt(0).toUpperCase() + category.slice(1)} Tests`;
          const suiteResults = getSuiteResults(suiteName);
          const suiteSummary = getSuiteSummary(suiteName);

          return (
            <TabsContent key={category} value={category} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {getCategoryIcon(category)}
                    {suiteName}
                  </CardTitle>
                  <CardDescription>
                    {suiteSummary ? `${suiteSummary.passed}/${suiteSummary.total} tests passed` : 'No results yet'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {suiteSummary && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Score</span>
                        <span className="text-xl font-bold">{suiteSummary.score.toFixed(1)}%</span>
                      </div>
                      
                      <Progress value={suiteSummary.score} className="h-2" />
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="text-center">
                          <p className="text-lg font-bold text-green-600">{suiteSummary.passed}</p>
                          <p className="text-sm text-muted-foreground">Passed</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-red-600">{suiteSummary.failed}</p>
                          <p className="text-sm text-muted-foreground">Failed</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Test Results */}
              {showDetails && suiteResults.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Test Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {suiteResults.map((result, index) => (
                        <motion.div
                          key={index}
                          className="flex items-center justify-between p-3 border rounded-lg"
                          initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: index * 0.1 }}
                        >
                          <div className="flex items-center gap-3">
                            {getTestIcon(result.passed, result.details?.critical)}
                            <div>
                              <h4 className="font-medium">{result.testName}</h4>
                              <p className="text-sm text-muted-foreground">
                                {result.details?.category} • {result.details?.duration?.toFixed(2)}ms
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={getTestColor(result.passed, result.details?.critical)}>
                              {result.passed ? 'Passed' : 'Failed'}
                            </Badge>
                            {result.details?.critical && (
                              <Badge variant="outline">Critical</Badge>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </motion.div>
  );
};
