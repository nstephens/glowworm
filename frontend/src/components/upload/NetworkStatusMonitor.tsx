import React, { useState, useEffect, useCallback } from 'react';
import { 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Server
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export interface NetworkStatus {
  isOnline: boolean;
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | 'unknown';
  downlink: number; // Mbps
  rtt: number; // ms
  saveData: boolean;
  lastChecked: Date;
}

export interface ServerStatus {
  isHealthy: boolean;
  responseTime: number; // ms
  lastChecked: Date;
  error?: string;
}

interface NetworkStatusMonitorProps {
  onStatusChange?: (status: NetworkStatus) => void;
  onServerStatusChange?: (status: ServerStatus) => void;
  className?: string;
}

/**
 * NetworkStatusMonitor - Real-time network and server monitoring
 * 
 * Features:
 * - Network connection monitoring
 * - Connection quality assessment
 * - Server health checks
 * - Upload recommendations
 * - Offline mode detection
 * - Data saver mode detection
 */
export const NetworkStatusMonitor: React.FC<NetworkStatusMonitorProps> = ({
  onStatusChange,
  onServerStatusChange,
  className,
}) => {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    connectionType: 'unknown',
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0,
    saveData: false,
    lastChecked: new Date(),
  });

  const [serverStatus, setServerStatus] = useState<ServerStatus>({
    isHealthy: true,
    responseTime: 0,
    lastChecked: new Date(),
  });

  const [isChecking, setIsChecking] = useState(false);

  const checkNetworkStatus = useCallback(async () => {
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    if (connection) {
      const newStatus: NetworkStatus = {
        isOnline: navigator.onLine,
        connectionType: connection.type || 'unknown',
        effectiveType: connection.effectiveType || 'unknown',
        downlink: connection.downlink || 0,
        rtt: connection.rtt || 0,
        saveData: connection.saveData || false,
        lastChecked: new Date(),
      };
      
      setNetworkStatus(newStatus);
      onStatusChange?.(newStatus);
    }
  }, [onStatusChange]);

  const checkServerStatus = useCallback(async () => {
    setIsChecking(true);
    
    try {
      const startTime = Date.now();
      const response = await fetch('/api/health', {
        method: 'GET',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      const endTime = Date.now();
      
      const newStatus: ServerStatus = {
        isHealthy: response.ok,
        responseTime: endTime - startTime,
        lastChecked: new Date(),
        error: response.ok ? undefined : `Server returned ${response.status}`,
      };
      
      setServerStatus(newStatus);
      onServerStatusChange?.(newStatus);
    } catch (error) {
      const newStatus: ServerStatus = {
        isHealthy: false,
        responseTime: 0,
        lastChecked: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      
      setServerStatus(newStatus);
      onServerStatusChange?.(newStatus);
    } finally {
      setIsChecking(false);
    }
  }, [onServerStatusChange]);

  // Monitor network changes
  useEffect(() => {
    const handleOnline = () => {
      checkNetworkStatus();
      checkServerStatus();
    };

    const handleOffline = () => {
      setNetworkStatus(prev => ({ ...prev, isOnline: false, lastChecked: new Date() }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    checkNetworkStatus();
    checkServerStatus();

    // Periodic checks
    const networkInterval = setInterval(checkNetworkStatus, 30000); // Every 30 seconds
    const serverInterval = setInterval(checkServerStatus, 60000); // Every minute

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(networkInterval);
      clearInterval(serverInterval);
    };
  }, [checkNetworkStatus, checkServerStatus]);

  const getConnectionIcon = () => {
    if (!networkStatus.isOnline) {
      return <WifiOff className="h-4 w-4 text-destructive" />;
    }
    
    switch (networkStatus.effectiveType) {
      case '4g':
        return <Wifi className="h-4 w-4 text-success" />;
      case '3g':
        return <Wifi className="h-4 w-4 text-warning" />;
      case '2g':
      case 'slow-2g':
        return <Wifi className="h-4 w-4 text-destructive" />;
      default:
        return <Wifi className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getConnectionColor = () => {
    if (!networkStatus.isOnline) return 'destructive';
    
    switch (networkStatus.effectiveType) {
      case '4g':
        return 'success';
      case '3g':
        return 'warning';
      case '2g':
      case 'slow-2g':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getUploadRecommendation = () => {
    if (!networkStatus.isOnline) {
      return 'You are offline. Uploads will be queued until connection is restored.';
    }
    
    if (networkStatus.saveData) {
      return 'Data saver mode is enabled. Consider using Wi-Fi for large uploads.';
    }
    
    if (networkStatus.effectiveType === 'slow-2g' || networkStatus.effectiveType === '2g') {
      return 'Slow connection detected. Consider reducing file sizes or using Wi-Fi.';
    }
    
    if (networkStatus.effectiveType === '3g') {
      return 'Moderate connection speed. Large files may take longer to upload.';
    }
    
    return 'Good connection speed. Uploads should proceed normally.';
  };

  const getServerStatusIcon = () => {
    if (isChecking) {
      return <Clock className="h-4 w-4 text-muted-foreground animate-pulse" />;
    }
    
    if (serverStatus.isHealthy) {
      return <CheckCircle className="h-4 w-4 text-success" />;
    }
    
    return <Server className="h-4 w-4 text-destructive" />;
  };

  const getServerStatusColor = () => {
    if (isChecking) return 'secondary';
    return serverStatus.isHealthy ? 'success' : 'destructive';
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5" />
          Network Status
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Network Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getConnectionIcon()}
            <span className="font-medium">
              {networkStatus.isOnline ? 'Online' : 'Offline'}
            </span>
            <Badge variant={getConnectionColor()}>
              {networkStatus.effectiveType.toUpperCase()}
            </Badge>
          </div>
          
          <div className="text-sm text-muted-foreground">
            {networkStatus.downlink > 0 && `${networkStatus.downlink} Mbps`}
            {networkStatus.rtt > 0 && ` • ${networkStatus.rtt}ms`}
          </div>
        </div>

        {/* Server Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getServerStatusIcon()}
            <span className="font-medium">
              Server {serverStatus.isHealthy ? 'Healthy' : 'Unhealthy'}
            </span>
            <Badge variant={getServerStatusColor()}>
              {serverStatus.responseTime}ms
            </Badge>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={checkServerStatus}
            disabled={isChecking}
          >
            {isChecking ? 'Checking...' : 'Check'}
          </Button>
        </div>

        {/* Recommendations */}
        <Alert variant={networkStatus.isOnline && serverStatus.isHealthy ? 'default' : 'destructive'}>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {getUploadRecommendation()}
          </AlertDescription>
        </Alert>

        {/* Connection Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-medium mb-1">Connection Type</div>
            <div className="text-muted-foreground capitalize">
              {networkStatus.connectionType}
            </div>
          </div>
          <div>
            <div className="font-medium mb-1">Data Saver</div>
            <div className="text-muted-foreground">
              {networkStatus.saveData ? 'Enabled' : 'Disabled'}
            </div>
          </div>
        </div>

        {/* Server Error Details */}
        {serverStatus.error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                <div className="font-medium">Server Error:</div>
                <div className="text-sm">{serverStatus.error}</div>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
