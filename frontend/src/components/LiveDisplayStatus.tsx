import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  Monitor, 
  Wifi, 
  WifiOff, 
  Play, 
  Pause,
  Clock,
  RefreshCw
} from 'lucide-react';
import { apiService } from '../services/api';

interface DisplayDevice {
  id: number;
  device_token: string;
  device_name: string | null;
  device_identifier: string | null;
  status: 'pending' | 'authorized' | 'rejected' | 'offline';
  playlist_id: number | null;
  playlist_name: string | null;
  last_seen: string;
  created_at: string;
  updated_at: string;
}

const LiveDisplayStatus: React.FC = () => {
  const [displays, setDisplays] = useState<DisplayDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDisplays = async () => {
    try {
      setError(null);
      const devices = await apiService.getDevices();
      setDisplays(devices || []);
    } catch (err: any) {
      console.error('Failed to fetch displays:', err);
      setError('Failed to load display status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDisplays();
    
    // Refresh display status every 30 seconds
    const interval = setInterval(fetchDisplays, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string, lastSeen: string) => {
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const minutesAgo = Math.floor((now.getTime() - lastSeenDate.getTime()) / (1000 * 60));

    if (status === 'authorized' && minutesAgo < 5) {
      return 'bg-green-500'; // Online
    } else if (status === 'authorized' && minutesAgo < 30) {
      return 'bg-yellow-500'; // Recently seen
    } else if (status === 'pending') {
      return 'bg-blue-500'; // Pending authorization
    } else {
      return 'bg-gray-500'; // Offline
    }
  };

  const getStatusText = (status: string, lastSeen: string) => {
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const minutesAgo = Math.floor((now.getTime() - lastSeenDate.getTime()) / (1000 * 60));

    if (status === 'pending') {
      return 'Pending Authorization';
    } else if (status === 'authorized' && minutesAgo < 5) {
      return 'Online';
    } else if (status === 'authorized' && minutesAgo < 30) {
      return `Last seen ${minutesAgo}m ago`;
    } else {
      return 'Offline';
    }
  };

  const formatLastSeen = (lastSeen: string) => {
    const lastSeenDate = new Date(lastSeen);
    const now = new Date();
    const minutesAgo = Math.floor((now.getTime() - lastSeenDate.getTime()) / (1000 * 60));

    if (minutesAgo < 1) {
      return 'Just now';
    } else if (minutesAgo < 60) {
      return `${minutesAgo}m ago`;
    } else if (minutesAgo < 1440) {
      const hoursAgo = Math.floor(minutesAgo / 60);
      return `${hoursAgo}h ago`;
    } else {
      const daysAgo = Math.floor(minutesAgo / 1440);
      return `${daysAgo}d ago`;
    }
  };

  if (loading) {
    return (
      <Card className="animate-fade-in-up border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-primary" />
            Live Display Status
          </CardTitle>
          <CardDescription>Real-time status of your photo displays</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading displays...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="animate-fade-in-up border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-primary" />
            Live Display Status
          </CardTitle>
          <CardDescription>Real-time status of your photo displays</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchDisplays} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-in-up border-0 shadow-lg bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Monitor className="w-5 h-5 text-primary" />
            Live Display Status
          </div>
          <Button onClick={fetchDisplays} variant="ghost" size="sm">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </CardTitle>
        <CardDescription>Real-time status of your photo displays</CardDescription>
      </CardHeader>
      <CardContent>
        {displays.length === 0 ? (
          <div className="text-center py-8">
            <Monitor className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-4">No display devices registered</p>
            <Button variant="outline" size="sm" onClick={() => window.open('/display', '_blank')}>
              Register First Display
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {displays.map((display) => {
              const isOnline = display.status === 'authorized' && 
                Math.floor((new Date().getTime() - new Date(display.last_seen).getTime()) / (1000 * 60)) < 5;
              
              return (
                <div
                  key={display.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  {/* Status Indicator */}
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(display.status, display.last_seen)}`} />
                    {isOnline ? (
                      <Wifi className="w-4 h-4 text-green-600" />
                    ) : (
                      <WifiOff className="w-4 h-4 text-gray-400" />
                    )}
                  </div>

                  {/* Display Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-sm truncate">
                        {display.device_name || display.device_identifier || `Display ${display.id}`}
                      </h3>
                      <Badge variant={display.status === 'authorized' ? 'default' : 'secondary'} className="text-xs">
                        {display.status}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatLastSeen(display.last_seen)}
                      </div>
                      
                      {display.playlist_name && (
                        <div className="flex items-center gap-1">
                          <Play className="w-3 h-3" />
                          Playing: {display.playlist_name}
                        </div>
                      )}
                      
                      {!display.playlist_name && display.status === 'authorized' && (
                        <div className="flex items-center gap-1">
                          <Pause className="w-3 h-3" />
                          No playlist assigned
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Text */}
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {getStatusText(display.status, display.last_seen)}
                    </p>
                    {display.status === 'pending' && (
                      <p className="text-xs text-blue-600">
                        Token: {display.device_token}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LiveDisplayStatus;
