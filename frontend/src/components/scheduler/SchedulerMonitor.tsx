import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Calendar, Clock, RefreshCw, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiService from '../../services/api';
import type { ScheduledPlaylist } from '../../types';

interface SchedulerMonitorProps {
  compact?: boolean;
}

/**
 * Dashboard widget showing scheduler status and recent activity.
 * Provides quick overview and access to scheduler management.
 */
export const SchedulerMonitor: React.FC<SchedulerMonitorProps> = ({ compact = false }) => {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<ScheduledPlaylist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastEvaluation, setLastEvaluation] = useState<Date>(new Date());

  useEffect(() => {
    loadSchedulerStatus();
    
    // Refresh every 60 seconds
    const interval = setInterval(loadSchedulerStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadSchedulerStatus = async () => {
    try {
      const response = await apiService.getSchedules({ enabled: true });
      setSchedules(response.data || []);
      setLastEvaluation(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load scheduler status');
      console.error('Scheduler monitor error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleForceEvaluate = async () => {
    try {
      setError(null);
      await apiService.forceEvaluateSchedules();
      await loadSchedulerStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to trigger evaluation');
    }
  };

  // Count by type
  const recurringCount = schedules.filter(s => s.schedule_type === 'recurring').length;
  const specificCount = schedules.filter(s => s.schedule_type === 'specific_date').length;

  // Get time since last evaluation
  const timeSinceEval = Math.floor((Date.now() - lastEvaluation.getTime()) / 1000);
  const isStale = timeSinceEval > 300; // More than 5 minutes

  if (compact) {
    return (
      <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate('/admin/scheduler')}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Scheduler</CardTitle>
            </div>
            {isStale ? (
              <AlertCircle className="h-4 w-4 text-amber-500" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <p className="text-muted-foreground">Total</p>
              <p className="text-2xl font-bold">{schedules.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Active</p>
              <p className="text-2xl font-bold text-green-600">{schedules.length}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={(e) => {
            e.stopPropagation();
            navigate('/admin/scheduler');
          }}>
            <ExternalLink className="h-3 w-3 mr-2" />
            Manage
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            <CardTitle>Playlist Scheduler</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={handleForceEvaluate}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription>
          Automated playlist scheduling system
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-500">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}

        {/* Status */}
        <div className="flex items-center gap-2">
          {isStale ? (
            <>
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span className="text-sm text-amber-600">
                Scheduler may be offline (last check: {timeSinceEval}s ago)
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-green-600">Scheduler running normally</span>
            </>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <p className="text-2xl font-bold">{schedules.length}</p>
            <p className="text-xs text-muted-foreground">Total Active</p>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <p className="text-2xl font-bold">{recurringCount}</p>
            <p className="text-xs text-muted-foreground">Recurring</p>
          </div>
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <p className="text-2xl font-bold">{specificCount}</p>
            <p className="text-xs text-muted-foreground">Specific Dates</p>
          </div>
        </div>

        {/* Last Evaluation */}
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Last checked: {timeSinceEval < 60 ? `${timeSinceEval}s` : `${Math.floor(timeSinceEval / 60)}m`} ago
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate('/admin/scheduler')}>
            <Calendar className="h-3 w-3 mr-2" />
            Manage Schedules
          </Button>
          <Button variant="outline" size="sm" onClick={handleForceEvaluate}>
            <RefreshCw className="h-3 w-3 mr-2" />
            Evaluate Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SchedulerMonitor;

