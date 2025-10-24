import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BrowserCompatibility, 
  CrossBrowserTesting, 
  FinalPolish 
} from '@/components/compatibility';
import { 
  Shield, 
  TestTube, 
  CheckCircle, 
  Settings,
  Globe,
  Smartphone,
  Monitor,
  Tablet,
  Zap,
  Eye,
  MousePointer,
  Accessibility,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export const CompatibilityShowcase: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'browser' | 'testing' | 'polish'>('browser');
  const [browserInfo, setBrowserInfo] = useState<any>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    // Simulate browser detection
    const detectBrowser = async () => {
      // Mock browser detection
      const mockBrowser = {
        name: 'chrome',
        version: 120,
        isMobile: false,
        isIOS: false,
        isAndroid: false,
        isSupported: true,
        capabilities: {
          webp: true,
          avif: true,
          webgl: true,
          webWorkers: true,
          serviceWorker: true,
          intersectionObserver: true,
          resizeObserver: true,
          customElements: true,
          shadowDOM: true,
          cssGrid: true,
          flexbox: true,
          cssVariables: true,
          es6Modules: true,
          asyncAwait: true,
          fetch: true,
          localStorage: true,
          sessionStorage: true,
          indexedDB: true,
          webRTC: true,
          webAudio: true,
          webSpeech: true,
          geolocation: true,
          notifications: true,
          pushNotifications: true,
          backgroundSync: true,
          cacheAPI: true,
          requestIdleCallback: true,
          requestAnimationFrame: true,
          performanceObserver: true,
          intersectionObserverV2: true,
          passiveEventListeners: true,
          touchEvents: false,
          pointerEvents: true,
          mediaQueries: true,
          prefersReducedMotion: false,
          prefersColorScheme: true,
          prefersContrast: true,
          forcedColors: false,
        },
      };

      setBrowserInfo(mockBrowser);
    };

    detectBrowser();
  }, []);

  const getBrowserIcon = (name: string) => {
    switch (name.toLowerCase()) {
      case 'chrome':
        return '🟢';
      case 'firefox':
        return '🟠';
      case 'safari':
        return '🔵';
      case 'edge':
        return '🔷';
      default:
        return '❓';
    }
  };

  const getBrowserColor = (name: string) => {
    switch (name.toLowerCase()) {
      case 'chrome':
        return 'text-green-600 bg-green-100';
      case 'firefox':
        return 'text-orange-600 bg-orange-100';
      case 'safari':
        return 'text-blue-600 bg-blue-100';
      case 'edge':
        return 'text-indigo-600 bg-indigo-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

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
          <h1 className="text-3xl font-bold">Cross-Browser Compatibility</h1>
          <p className="text-muted-foreground">
            Comprehensive testing and compatibility validation across all supported browsers and devices
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant={activeTab === 'browser' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('browser')}
          >
            <Globe className="h-4 w-4 mr-2" />
            Browser
          </Button>
          <Button
            variant={activeTab === 'testing' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('testing')}
          >
            <TestTube className="h-4 w-4 mr-2" />
            Testing
          </Button>
          <Button
            variant={activeTab === 'polish' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('polish')}
          >
            <Settings className="h-4 w-4 mr-2" />
            Polish
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="browser">Browser Compatibility</TabsTrigger>
          <TabsTrigger value="testing">Cross-Browser Testing</TabsTrigger>
          <TabsTrigger value="polish">Final Polish</TabsTrigger>
        </TabsList>

        <TabsContent value="browser" className="space-y-6">
          <BrowserCompatibility showDetails={true} />
          
          {/* Browser Support Matrix */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Browser Support Matrix
              </CardTitle>
              <CardDescription>
                Supported browsers and their minimum versions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl mb-2">🟢</div>
                  <h3 className="font-semibold">Chrome</h3>
                  <p className="text-sm text-muted-foreground">Version 90+</p>
                  <Badge className="mt-2 text-green-600 bg-green-100">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Supported
                  </Badge>
                </div>
                
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl mb-2">🟠</div>
                  <h3 className="font-semibold">Firefox</h3>
                  <p className="text-sm text-muted-foreground">Version 88+</p>
                  <Badge className="mt-2 text-green-600 bg-green-100">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Supported
                  </Badge>
                </div>
                
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl mb-2">🔵</div>
                  <h3 className="font-semibold">Safari</h3>
                  <p className="text-sm text-muted-foreground">Version 14+</p>
                  <Badge className="mt-2 text-green-600 bg-green-100">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Supported
                  </Badge>
                </div>
                
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl mb-2">🔷</div>
                  <h3 className="font-semibold">Edge</h3>
                  <p className="text-sm text-muted-foreground">Version 90+</p>
                  <Badge className="mt-2 text-green-600 bg-green-100">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Supported
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Device Support */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Device Support
              </CardTitle>
              <CardDescription>
                Supported devices and screen sizes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <Smartphone className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <h3 className="font-semibold">Mobile</h3>
                  <p className="text-sm text-muted-foreground">320px - 768px</p>
                  <Badge className="mt-2 text-green-600 bg-green-100">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Supported
                  </Badge>
                </div>
                
                <div className="text-center p-4 border rounded-lg">
                  <Tablet className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                  <h3 className="font-semibold">Tablet</h3>
                  <p className="text-sm text-muted-foreground">768px - 1024px</p>
                  <Badge className="mt-2 text-green-600 bg-green-100">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Supported
                  </Badge>
                </div>
                
                <div className="text-center p-4 border rounded-lg">
                  <Monitor className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <h3 className="font-semibold">Desktop</h3>
                  <p className="text-sm text-muted-foreground">1024px+</p>
                  <Badge className="mt-2 text-green-600 bg-green-100">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Supported
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="testing" className="space-y-6">
          <CrossBrowserTesting autoRun={false} showDetails={true} />
          
          {/* Testing Features */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube className="h-5 w-5" />
                Testing Features
              </CardTitle>
              <CardDescription>
                Comprehensive testing capabilities and validation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Layout className="h-4 w-4 text-blue-600" />
                    Layout Tests
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• CSS Grid support validation</li>
                    <li>• Flexbox compatibility checks</li>
                    <li>• CSS Variables support</li>
                    <li>• Transform and animation support</li>
                    <li>• Responsive design validation</li>
                  </ul>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Code className="h-4 w-4 text-purple-600" />
                    Functionality Tests
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• ES6 Modules support</li>
                    <li>• Async/Await compatibility</li>
                    <li>• Fetch API validation</li>
                    <li>• Local Storage support</li>
                    <li>• Service Worker compatibility</li>
                  </ul>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Activity className="h-4 w-4 text-green-600" />
                    Performance Tests
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Request Animation Frame support</li>
                    <li>• Performance Observer validation</li>
                    <li>• Web Workers compatibility</li>
                    <li>• Request Idle Callback support</li>
                    <li>• Core Web Vitals measurement</li>
                  </ul>
                </div>
                
                <div className="space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Accessibility className="h-4 w-4 text-orange-600" />
                    Accessibility Tests
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• ARIA attributes support</li>
                    <li>• Focus management validation</li>
                    <li>• Screen reader compatibility</li>
                    <li>• Keyboard navigation support</li>
                    <li>• Color contrast validation</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="polish" className="space-y-6">
          <FinalPolish />
          
          {/* Polish Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Polish Categories
              </CardTitle>
              <CardDescription>
                Comprehensive UI polish and consistency validation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye className="h-4 w-4 text-blue-600" />
                    <h4 className="font-semibold">Visual</h4>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Color contrast validation</li>
                    <li>• Typography consistency</li>
                    <li>• Spacing consistency</li>
                    <li>• Border radius uniformity</li>
                    <li>• Shadow consistency</li>
                  </ul>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <MousePointer className="h-4 w-4 text-purple-600" />
                    <h4 className="font-semibold">Interaction</h4>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Hover state consistency</li>
                    <li>• Focus indicator visibility</li>
                    <li>• Active state validation</li>
                    <li>• Loading state consistency</li>
                    <li>• Error state clarity</li>
                  </ul>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Accessibility className="h-4 w-4 text-orange-600" />
                    <h4 className="font-semibold">Accessibility</h4>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• ARIA label completeness</li>
                    <li>• Keyboard navigation</li>
                    <li>• Screen reader support</li>
                    <li>• Color blind compatibility</li>
                    <li>• Motion preference respect</li>
                  </ul>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="h-4 w-4 text-green-600" />
                    <h4 className="font-semibold">Performance</h4>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Core Web Vitals validation</li>
                    <li>• Bundle size optimization</li>
                    <li>• Image optimization</li>
                    <li>• Lazy loading implementation</li>
                    <li>• Caching strategy validation</li>
                  </ul>
                </div>
                
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Smartphone className="h-4 w-4 text-pink-600" />
                    <h4 className="font-semibold">Responsive</h4>
                  </div>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Mobile layout validation</li>
                    <li>• Tablet layout checks</li>
                    <li>• Desktop layout verification</li>
                    <li>• Touch target sizing</li>
                    <li>• Orientation support</li>
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
