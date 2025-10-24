import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Info, 
  RefreshCw, 
  Download,
  ExternalLink,
  Settings,
  Shield,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { 
  detectBrowser, 
  getBrowserInfo, 
  getCapabilities, 
  getUnsupportedFeatures,
  getPerformanceRecommendations 
} from '@/utils/browserDetection';
import type { BrowserInfo, BrowserCapabilities } from '@/utils/browserDetection';

interface BrowserCompatibilityProps {
  className?: string;
  showDetails?: boolean;
  onCompatibilityChange?: (isCompatible: boolean) => void;
}

export const BrowserCompatibility: React.FC<BrowserCompatibilityProps> = ({
  className,
  showDetails = false,
  onCompatibilityChange,
}) => {
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo | null>(null);
  const [capabilities, setCapabilities] = useState<BrowserCapabilities | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUnsupportedWarning, setShowUnsupportedWarning] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const checkCompatibility = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const info = await detectBrowser();
        const caps = getCapabilities();

        setBrowserInfo(info);
        setCapabilities(caps);

        // Check if browser is supported
        if (!info.isSupported) {
          setShowUnsupportedWarning(true);
        }

        onCompatibilityChange?.(info.isSupported);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to detect browser');
      } finally {
        setIsLoading(false);
      }
    };

    checkCompatibility();
  }, [onCompatibilityChange]);

  const handleRetry = () => {
    setError(null);
    setIsLoading(true);
    // Retry detection
    detectBrowser().then((info) => {
      setBrowserInfo(info);
      setCapabilities(getCapabilities());
      setIsLoading(false);
    }).catch((err) => {
      setError(err.message);
      setIsLoading(false);
    });
  };

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

  if (error) {
    return (
      <Card className={cn('border-destructive', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <XCircle className="h-5 w-5" />
            Browser Detection Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={handleRetry} size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!browserInfo) {
    return null;
  }

  const unsupportedFeatures = getUnsupportedFeatures();
  const performanceRecommendations = getPerformanceRecommendations();

  return (
    <motion.div
      className={cn('space-y-4', className)}
      initial={prefersReducedMotion ? {} : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Unsupported Browser Warning */}
      <AnimatePresence>
        {showUnsupportedWarning && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <Alert className="border-destructive bg-destructive/10">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Browser Not Supported</AlertTitle>
              <AlertDescription>
                Your browser ({browserInfo.name} {browserInfo.version}) is not supported.
                Please upgrade to a newer version or use one of the following browsers:
              </AlertDescription>
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm">• Chrome 90+</span>
                  <Button size="sm" variant="outline" asChild>
                    <a href="https://www.google.com/chrome/" target="_blank" rel="noopener noreferrer">
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </a>
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">• Firefox 88+</span>
                  <Button size="sm" variant="outline" asChild>
                    <a href="https://www.mozilla.org/firefox/" target="_blank" rel="noopener noreferrer">
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </a>
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">• Safari 14+</span>
                  <Button size="sm" variant="outline" asChild>
                    <a href="https://www.apple.com/safari/" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Learn More
                    </a>
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">• Edge 90+</span>
                  <Button size="sm" variant="outline" asChild>
                    <a href="https://www.microsoft.com/edge/" target="_blank" rel="noopener noreferrer">
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </a>
                  </Button>
                </div>
              </div>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Browser Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Browser Information
          </CardTitle>
          <CardDescription>
            Current browser and compatibility status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Browser Details */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getBrowserIcon(browserInfo.name)}</span>
                <div>
                  <h3 className="font-semibold capitalize">{browserInfo.name}</h3>
                  <p className="text-sm text-muted-foreground">Version {browserInfo.version}</p>
                </div>
              </div>
              <Badge className={getBrowserColor(browserInfo.name)}>
                {browserInfo.isSupported ? (
                  <CheckCircle className="h-3 w-3 mr-1" />
                ) : (
                  <XCircle className="h-3 w-3 mr-1" />
                )}
                {browserInfo.isSupported ? 'Supported' : 'Unsupported'}
              </Badge>
            </div>

            {/* Platform Information */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Platform</h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Mobile</span>
                    <Badge variant={browserInfo.isMobile ? 'default' : 'secondary'}>
                      {browserInfo.isMobile ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">iOS</span>
                    <Badge variant={browserInfo.isIOS ? 'default' : 'secondary'}>
                      {browserInfo.isIOS ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Android</span>
                    <Badge variant={browserInfo.isAndroid ? 'default' : 'secondary'}>
                      {browserInfo.isAndroid ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Compatibility</h4>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Supported</span>
                    <Badge variant={browserInfo.isSupported ? 'default' : 'destructive'}>
                      {browserInfo.isSupported ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Features</span>
                    <span className="text-sm font-mono">
                      {capabilities ? Object.values(capabilities).filter(Boolean).length : 0}/
                      {capabilities ? Object.keys(capabilities).length : 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Capabilities */}
      {showDetails && capabilities && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Browser Capabilities
            </CardTitle>
            <CardDescription>
              Detailed feature support and recommendations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Feature Support */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Feature Support</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {Object.entries(capabilities).map(([feature, supported]) => (
                    <div
                      key={feature}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <span className="text-sm capitalize">
                        {feature.replace(/([A-Z])/g, ' $1').trim()}
                      </span>
                      <Badge variant={supported ? 'default' : 'secondary'}>
                        {supported ? (
                          <CheckCircle className="h-3 w-3 mr-1" />
                        ) : (
                          <XCircle className="h-3 w-3 mr-1" />
                        )}
                        {supported ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Unsupported Features */}
              {unsupportedFeatures.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-destructive">Unsupported Features</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {unsupportedFeatures.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <XCircle className="h-3 w-3 text-destructive" />
                        {feature.replace(/([A-Z])/g, ' $1').trim()}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Performance Recommendations */}
              {performanceRecommendations.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-amber-600">Performance Recommendations</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {performanceRecommendations.map((recommendation, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Zap className="h-3 w-3 text-amber-600 mt-0.5 flex-shrink-0" />
                        {recommendation}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
};
