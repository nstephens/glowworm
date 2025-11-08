import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Calendar, Clock, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiService from '../../services/api';
import type { ActiveScheduleResponse } from '../../types';

interface ScheduleWidgetProps {
  deviceId: number;
  deviceName?: string;
  compact?: boolean;
}

/**
 * Widget showing the current active schedule for a device.
 * Can be embedded in device cards or detail pages.
 */
export const ScheduleWidget: React.FC<ScheduleWidgetProps> = ({
  deviceId,
  deviceName,
  compact = false
}) => {
  const navigate = useNavigate();
  const [activeSchedule, setActiveSchedule] = useState<ActiveScheduleResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadActiveSchedule();
    
    // Refresh every minute to update active schedule
    const interval = setInterval(loadActiveSchedule, 60000);
    return () => clearInterval(interval);
  }, [deviceId]);

  const loadActiveSchedule = async () => {
    try {
      const response = await apiService.getActiveDeviceSchedule(deviceId);
      setActiveSchedule(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load schedule');
      console.error('Failed to load active schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (isoString: string | null) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  if (loading) {
    return (
      <Card className="bg-muted/20">
        <CardContent className="p-3">
          <div className="text-xs text-muted-foreground">Loading schedule...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return null; // Silently fail for widget
  }

  if (!activeSchedule) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        {activeSchedule.is_default ? (
          <>
            <Badge variant="outline" className="text-xs">Default</Badge>
            <span className="text-muted-foreground">{activeSchedule.playlist_name}</span>
          </>
        ) : (
          <>
            <Badge variant="default" className="text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              Scheduled
            </Badge>
            <span className="text-muted-foreground">{activeSchedule.schedule_name}</span>
          </>
        )}
      </div>
    );
  }

  return (
    <Card className="bg-muted/20 border-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">
              {activeSchedule.is_default ? 'Default Playlist' : 'Active Schedule'}
            </span>
          </div>
          {!activeSchedule.is_default && (
            <Badge variant="default">Scheduled</Badge>
          )}
        </div>

        <div className="space-y-1.5">
          {!activeSchedule.is_default && activeSchedule.schedule_name && (
            <div className="text-sm">
              <span className="text-muted-foreground">Schedule: </span>
              <span className="font-medium">{activeSchedule.schedule_name}</span>
            </div>
          )}
          
          <div className="text-sm">
            <span className="text-muted-foreground">Playlist: </span>
            <span className="font-medium">{activeSchedule.playlist_name || 'None'}</span>
          </div>

          {!activeSchedule.is_default && (
            <>
              {activeSchedule.active_since && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Active since {formatTime(activeSchedule.active_since)}
                </div>
              )}
              
              {activeSchedule.active_until && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Until {formatTime(activeSchedule.active_until)}
                </div>
              )}
            </>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => navigate('/admin/scheduler')}
        >
          <ExternalLink className="h-3 w-3 mr-2" />
          Manage Schedules
        </Button>
      </CardContent>
    </Card>
  );
};

export default ScheduleWidget;

