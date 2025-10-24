import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  PerformanceMonitor, 
  VirtualizedList, 
  usePerformance, 
  useMemoryUsage, 
  useNetworkStatus,
  useServiceWorker,
  useImageOptimization
} from '@/components/performance';
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
  Info,
  Image as ImageIcon,
  List,
  Grid,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// Mock data for virtualized list
const generateMockData = (count: number) => {
  return Array.from({ length: count }, (_, index) => ({
    id: index,
    title: `Item ${index + 1}`,
    description: `This is a description for item ${index + 1}`,
    value: Math.floor(Math.random() * 1000),
    status: ['active', 'inactive', 'pending'][Math.floor(Math.random() * 3)],
  }));
};

const mockData = generateMockData(1000);

export const PerformanceShowcase: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'monitor' | 'virtualization' | 'optimization'>('monitor');
  const [isLoading, setIsLoading] = useState(false);
  const [renderCount, setRenderCount] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  // Performance hooks
  const { renderCount: perfRenderCount, renderTime } = usePerformance('PerformanceShowcase');
  const memoryInfo = useMemoryUsage();
  const { isOnline, connectionType } = useNetworkStatus();
  const swState = useServiceWorker();

  // Image optimization example
  const { optimizedSrc, isLoading: imageLoading } = useImageOptimization(
    'https://picsum.photos/800/600?random=1',
    { width: 400, height: 300, quality: 80 }
  );

  // Simulate loading
  const handleLoading = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 2000);
  };

  // Render item for virtualized list
  const renderItem = (item: any, index: number) => (
    <motion.div
      key={item.id}
      className="p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.01 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{item.title}</h3>
          <p className="text-sm text-muted-foreground">{item.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
            {item.status}
          </Badge>
          <span className="text-sm font-mono">{item.value}</span>
        </div>
      </div>
    </motion.div>
  );

  return (
    <motion.div
      className="p-6 space-y-6"
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Performance Showcase</h1>
          <p className="text-muted-foreground">
            Explore performance optimization features including monitoring, virtualization, and image optimization
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === 'monitor' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('monitor')}
          >
            <Activity className="h-4 w-4 mr-2" />
            Monitor
          </Button>
          <Button
            variant={activeTab === 'virtualization' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('virtualization')}
          >
            <List className="h-4 w-4 mr-2" />
            Virtualization
          </Button>
          <Button
            variant={activeTab === 'optimization' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('optimization')}
          >
            <Settings className="h-4 w-4 mr-2" />
            Optimization
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="monitor">Performance Monitor</TabsTrigger>
          <TabsTrigger value="virtualization">Virtualization</TabsTrigger>
          <TabsTrigger value="optimization">Optimization</TabsTrigger>
        </TabsList>

        <TabsContent value="monitor" className="space-y-6">
          <PerformanceMonitor showDetails={true} autoRefresh={true} />
          
          {/* Additional Performance Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wifi className="h-5 w-5" />
                  Network Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Status</span>
                    <Badge variant={isOnline ? 'default' : 'destructive'}>
                      {isOnline ? 'Online' : 'Offline'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Connection</span>
                    <span className="text-sm font-mono">{connectionType}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

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
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="virtualization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Virtualized List</CardTitle>
              <CardDescription>
                Efficiently render large lists with virtualization. This list contains 1000 items but only renders visible ones.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-96 border rounded-lg">
                <VirtualizedList
                  items={mockData}
                  itemHeight={80}
                  containerHeight={384}
                  renderItem={renderItem}
                  enableAnimations={!prefersReducedMotion}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance Benefits</CardTitle>
              <CardDescription>
                Virtualization provides significant performance improvements for large datasets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">Without Virtualization</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Renders all 1000 items</li>
                    <li>• High memory usage</li>
                    <li>• Slow initial render</li>
                    <li>• Poor scroll performance</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">With Virtualization</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Renders only visible items</li>
                    <li>• Low memory usage</li>
                    <li>• Fast initial render</li>
                    <li>• Smooth scroll performance</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="optimization" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Image Optimization</CardTitle>
              <CardDescription>
                Automatic image optimization with format detection and responsive loading
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold">Original Image</h4>
                    <div className="border rounded-lg p-4">
                      <img
                        src="https://picsum.photos/800/600?random=1"
                        alt="Original"
                        className="w-full h-48 object-cover rounded"
                      />
                      <p className="text-sm text-muted-foreground mt-2">800x600, ~200KB</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h4 className="font-semibold">Optimized Image</h4>
                    <div className="border rounded-lg p-4">
                      {imageLoading ? (
                        <div className="w-full h-48 bg-muted rounded flex items-center justify-center">
                          <RefreshCw className="h-6 w-6 animate-spin" />
                        </div>
                      ) : (
                        <img
                          src={optimizedSrc}
                          alt="Optimized"
                          className="w-full h-48 object-cover rounded"
                        />
                      )}
                      <p className="text-sm text-muted-foreground mt-2">400x300, ~50KB</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold">Optimization Features</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Automatic format detection (WebP, AVIF)</li>
                    <li>• Responsive image generation</li>
                    <li>• Quality optimization</li>
                    <li>• Lazy loading support</li>
                    <li>• Blur placeholder generation</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>
                Real-time performance monitoring and optimization recommendations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">Component Performance</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-sm">Render Count</span>
                      <span className="text-sm font-mono">{perfRenderCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Render Time</span>
                      <span className="text-sm font-mono">{renderTime.toFixed(2)}ms</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-semibold">Optimization Tips</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Use React.memo for expensive components</li>
                    <li>• Implement useMemo for heavy calculations</li>
                    <li>• Use useCallback for event handlers</li>
                    <li>• Implement code splitting</li>
                    <li>• Optimize images and assets</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};
