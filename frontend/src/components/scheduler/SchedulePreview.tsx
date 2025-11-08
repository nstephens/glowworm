import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Calendar, Clock, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import apiService from '../../services/api';

interface SchedulePreviewProps {
  devices: any[];
}

interface PreviewResult {
  datetime: string;
  active_schedule: {
    id: number | null;
    name: string;
    playlist_id: number | null;
    playlist_name: string | null;
    priority: number;
    reason: string;
  } | null;
  conflicting_schedules: Array<{
    id: number;
    name: string;
    priority: number;
    reason: string;
  }>;
}

export const SchedulePreview: React.FC<SchedulePreviewProps> = ({ devices }) => {
  // Filter to only show authorized devices
  const authorizedDevices = devices.filter((d: any) => d.status === 'authorized');
  
  const [selectedDevice, setSelectedDevice] = useState<number>(0);
  const [previewDate, setPreviewDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [previewTime, setPreviewTime] = useState<string>(
    new Date().toTimeString().split(' ')[0].substring(0, 5)
  );
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePreview = async () => {
    if (!selectedDevice) {
      setError('Please select a device');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await apiService.previewDeviceSchedule(
        selectedDevice,
        previewDate,
        previewTime
      );
      
      setResult(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to preview schedule');
      console.error('Preview error:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (datetime: string) => {
    const date = new Date(datetime);
    return date.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Schedule Preview
        </CardTitle>
        <CardDescription>
          Simulate a specific date and time to see which schedule would be active
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Device Selection */}
        <div>
          <Label htmlFor="preview-device">Device</Label>
          <Select
            value={selectedDevice.toString()}
            onValueChange={(value) => setSelectedDevice(parseInt(value))}
          >
            <SelectTrigger id="preview-device">
              <SelectValue placeholder="Select a device" />
            </SelectTrigger>
            <SelectContent>
              {authorizedDevices.length === 0 ? (
                <div className="p-2 text-sm text-muted-foreground">No authorized devices</div>
              ) : (
                authorizedDevices.map(device => (
                  <SelectItem key={device.id} value={device.id.toString()}>
                    {device.device_name || `Device ${device.id}`}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Date and Time Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="preview-date">Date</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="preview-date"
                type="date"
                value={previewDate}
                onChange={(e) => setPreviewDate(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="preview-time">Time</Label>
            <div className="relative">
              <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="preview-time"
                type="time"
                value={previewTime}
                onChange={(e) => setPreviewTime(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {/* Preview Button */}
        <Button onClick={handlePreview} disabled={loading || !selectedDevice} className="w-full">
          {loading ? 'Loading...' : 'Preview Schedule'}
        </Button>

        {/* Error */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4" />
              <span>Preview for {formatDateTime(result.datetime)}</span>
            </div>

            {/* Active Schedule */}
            {result.active_schedule && (
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Active Schedule
                </h3>
                <Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  <CardContent className="pt-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{result.active_schedule.name}</span>
                        <Badge variant="default">
                          Priority: {result.active_schedule.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Playlist: {result.active_schedule.playlist_name || 'Default'}
                      </p>
                      <p className="text-xs text-muted-foreground italic">
                        {result.active_schedule.reason}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Conflicting Schedules */}
            {result.conflicting_schedules && result.conflicting_schedules.length > 0 && (
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                  Conflicting Schedules ({result.conflicting_schedules.length})
                </h3>
                <div className="space-y-2">
                  {result.conflicting_schedules.map((conflict) => (
                    <Card 
                      key={conflict.id}
                      className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800"
                    >
                      <CardContent className="pt-4">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{conflict.name}</span>
                            <Badge variant="outline">
                              Priority: {conflict.priority}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground italic">
                            {conflict.reason}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* No Active Schedule */}
            {!result.active_schedule && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  No schedule is active at this time. The device will use its default playlist.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SchedulePreview;

