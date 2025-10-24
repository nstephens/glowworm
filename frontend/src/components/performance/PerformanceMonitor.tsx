import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  Zap, 
  Database, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useServiceWorker } from '@/hooks/useServiceWorker';
import { useMemoryUsage } from '@/hooks/usePerformance';
import { useBundleAnalysis } from '@/utils/bundleAnalyzer';

interface PerformanceMetrics {
  fcp: number; // First Contentful Paint
  lcp: number; // Largest Contentful Paint
  fid: number; // First Input Delay
  cls: number; // Cumulative Layout Shift
  ttfb: number; // Time to First Byte
  tti: number; // Time to Interactive
}

interface PerformanceMonitorProps {
  className?: string;
  showDetails?: boolean;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  className,
  showDetails = false,
  autoRefresh = true,
  refreshInterval = 5000,
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const swState = useServiceWorker();
  const memoryInfo = useMemoryUsage();
  const bundleAnalysis = useBundleAnalysis();

  // Get performance metrics
  const getPerformanceMetrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get Core Web Vitals
      const fcp = await getMetric('first-contentful-paint');
      const lcp = await getMetric('largest-contentful-paint');
      const fid = await getMetric('first-input-delay');
      const cls = await getMetric('cumulative-layout-shift');
      const ttfb = await getMetric('time-to-first-byte');
      const tti = await getMetric('time-to-interactive');

      setMetrics({
        fcp: fcp?.value || 0,
        lcp: lcp?.value || 0,
        fid: fid?.value || 0,
        cls: cls?.value || 0,
        ttfb: ttfb?.value || 0,
        tti: tti?.value || 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get performance metrics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Get specific metric
  const getMetric = async (name: string) => {
    return new Promise<any>((resolve) => {
      if ('PerformanceObserver' in window) {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            resolve(entries[entries.length - 1]);
          }
        });
        observer.observe({ entryTypes: [name] });
      } else {
        resolve(null);
      }
    });
  };

  // Auto-refresh metrics
  useEffect(() => {
    if (autoRefresh) {
      getPerformanceMetrics();
      const interval = setInterval(getPerformanceMetrics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval, getPerformanceMetrics]);

  // Get performance score
  const getPerformanceScore = (metric: number, thresholds: { good: number; poor: number }): 'good' | 'needs-improvement' | 'poor' => {
    if (metric <= thresholds.good) return 'good';
    if (metric <= thresholds.poor) return 'needs-improvement';
    return 'poor';
  };

  // Get metric color
  const getMetricColor = (score: 'good' | 'needs-improvement' | 'poor') => {
    switch (score) {
      case 'good': return 'text-green-600 bg-green-100';
      case 'needs-improvement': return 'text-yellow-600 bg-yellow-100';
      case 'poor': return 'text-red-600 bg-red-100';
    }
  };

  // Get metric icon
  const getMetricIcon = (score: 'good' | 'needs-improvement' | 'poor') => {
    switch (score) {
      case 'good': return <CheckCircle className="h-4 w-4" />;
      case 'needs-improvement': return <AlertTriangle className="h-4 w-4" />;
      case 'poor': return <XCircle className="h-4 w-4" />;
    }
  };

  if (error) {
    return (
      <Card className={cn('border-destructive', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Performance Monitor Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={getPerformanceMetrics} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      className={cn('space-y-4', className)}
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Core Web Vitals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Core Web Vitals
          </CardTitle>
          <CardDescription>
            Real-time performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
            </div>
          ) : metrics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* First Contentful Paint */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">First Contentful Paint</span>
                  <Badge className={getMetricColor(getPerformanceScore(metrics.fcp, { good: 1800, poor: 3000 }))}>
                    {getMetricIcon(getPerformanceScore(metrics.fcp, { good: 1800, poor: 3000 }))}
                  </Badge>
                </div>
                <p className="text-2xl font-bold">{metrics.fcp.toFixed(0)}ms</p>
                <p className="text-xs text-muted-foreground">Good: &lt;1.8s, Poor: &gt;3.0s</p>
              </div>

              {/* Largest Contentful Paint */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Largest Contentful Paint</span>
                  <Badge className={getMetricColor(getPerformanceScore(metrics.lcp, { good: 2500, poor: 4000 }))}>
                    {getMetricIcon(getPerformanceScore(metrics.lcp, { good: 2500, poor: 4000 }))}
                  </Badge>
                </div>
                <p className="text-2xl font-bold">{metrics.lcp.toFixed(0)}ms</p>
                <p className="text-xs text-muted-foreground">Good: &lt;2.5s, Poor: &gt;4.0s</p>
              </div>

              {/* First Input Delay */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">First Input Delay</span>
                  <Badge className={getMetricColor(getPerformanceScore(metrics.fid, { good: 100, poor: 300 }))}>
                    {getMetricIcon(getPerformanceScore(metrics.fid, { good: 100, poor: 300 }))}
                  </Badge>
                </div>
                <p className="text-2xl font-bold">{metrics.fid.toFixed(0)}ms</p>
                <p className="text-xs text-muted-foreground">Good: &lt;100ms, Poor: &gt;300ms</p>
              </div>

              {/* Cumulative Layout Shift */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Cumulative Layout Shift</span>
                  <Badge className={getMetricColor(getPerformanceScore(metrics.cls, { good: 0.1, poor: 0.25 }))}>
                    {getMetricIcon(getPerformanceScore(metrics.cls, { good: 0.1, poor: 0.25 }))}
                  </Badge>
                </div>
                <p className="text-2xl font-bold">{metrics.cls.toFixed(3)}</p>
                <p className="text-xs text-muted-foreground">Good: &lt;0.1, Poor: &gt;0.25</p>
              </div>

              {/* Time to First Byte */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Time to First Byte</span>
                  <Badge className={getMetricColor(getPerformanceScore(metrics.ttfb, { good: 800, poor: 1800 }))}>
                    {getMetricIcon(getPerformanceScore(metrics.ttfb, { good: 800, poor: 1800 }))}
                  </Badge>
                </div>
                <p className="text-2xl font-bold">{metrics.ttfb.toFixed(0)}ms</p>
                <p className="text-xs text-muted-foreground">Good: &lt;800ms, Poor: &gt;1.8s</p>
              </div>

              {/* Time to Interactive */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Time to Interactive</span>
                  <Badge className={getMetricColor(getPerformanceScore(metrics.tti, { good: 3800, poor: 7300 }))}>
                    {getMetricIcon(getPerformanceScore(metrics.tti, { good: 3800, poor: 7300 }))}
                  </Badge>
                </div>
                <p className="text-2xl font-bold">{metrics.tti.toFixed(0)}ms</p>
                <p className="text-xs text-muted-foreground">Good: &lt;3.8s, Poor: &gt;7.3s</p>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No performance data available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Memory Usage */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Memory Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            {memoryInfo ? (
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm">Used</span>
                  <span className="text-sm font-mono">{(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(1)} MB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Total</span>
                  <span className="text-sm font-mono">{(memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(1)} MB</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Limit</span>
                  <span className="text-sm font-mono">{(memoryInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(1)} MB</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${(memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100}%` 
                    }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Memory info not available</p>
            )}
          </CardContent>
        </Card>

        {/* Service Worker Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Service Worker
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Status</span>
                <Badge variant={swState.isRegistered ? 'default' : 'secondary'}>
                  {swState.isRegistered ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Cache Size</span>
                <span className="text-sm font-mono">{(swState.cacheSize / 1024).toFixed(1)} KB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Online</span>
                <Badge variant={swState.isOnline ? 'default' : 'destructive'}>
                  {swState.isOnline ? 'Yes' : 'No'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bundle Analysis */}
      {showDetails && bundleAnalysis.analysis && (
        <Card>
          <CardHeader>
            <CardTitle>Bundle Analysis</CardTitle>
            <CardDescription>
              Current bundle size and optimization opportunities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total Size</p>
                  <p className="text-2xl font-bold">{(bundleAnalysis.analysis.totalSize / 1024).toFixed(1)} KB</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Gzipped Size</p>
                  <p className="text-2xl font-bold">{(bundleAnalysis.analysis.gzippedSize / 1024).toFixed(1)} KB</p>
                </div>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Recommendations</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {bundleAnalysis.analysis.recommendations.map((rec, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
};
