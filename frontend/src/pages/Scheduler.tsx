import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Plus, Calendar, Clock, Play, Pause, Trash2, Edit, RefreshCw } from 'lucide-react';
import apiService from '../services/api';
import { ScheduleForm } from '../components/scheduler/ScheduleForm';
import type { ScheduledPlaylist, Device, Playlist, ScheduleFormData } from '../types';

interface SchedulerPageProps {}

export const SchedulerPage: React.FC<SchedulerPageProps> = () => {
  const [schedules, setSchedules] = useState<ScheduledPlaylist[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledPlaylist | undefined>(undefined);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [schedulesResponse, devicesResponse, playlistsResponse] = await Promise.all([
        apiService.getSchedules(),
        apiService.getDevices(),
        apiService.getPlaylists()
      ]);

      setSchedules(schedulesResponse.data || []);
      setDevices(devicesResponse || []);
      setPlaylists(playlistsResponse.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load scheduler data');
      console.error('Failed to load scheduler data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSchedule = async (scheduleId: number) => {
    if (!confirm('Are you sure you want to delete this schedule?')) {
      return;
    }

    try {
      await apiService.deleteSchedule(scheduleId);
      setSchedules(prev => prev.filter(s => s.id !== scheduleId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete schedule');
    }
  };

  const handleToggleEnabled = async (schedule: ScheduledPlaylist) => {
    try {
      await apiService.updateSchedule(schedule.id, {
        enabled: !schedule.enabled
      });
      setSchedules(prev =>
        prev.map(s => s.id === schedule.id ? { ...s, enabled: !s.enabled } : s)
      );
    } catch (err: any) {
      setError(err.message || 'Failed to toggle schedule');
    }
  };

  const handleForceEvaluate = async () => {
    try {
      setError(null);
      await apiService.forceEvaluateSchedules();
      // Reload schedules to see updated active status
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to trigger evaluation');
    }
  };

  const handleCreateSchedule = async (data: ScheduleFormData) => {
    try {
      await apiService.createSchedule(data);
      setShowCreateForm(false);
      await loadData();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to create schedule');
    }
  };

  const handleEditSchedule = async (data: ScheduleFormData) => {
    if (!editingSchedule) return;
    
    try {
      await apiService.updateSchedule(editingSchedule.id, data);
      setEditingSchedule(undefined);
      await loadData();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to update schedule');
    }
  };

  const handleStartEdit = (schedule: ScheduledPlaylist) => {
    setEditingSchedule(schedule);
    setShowCreateForm(false);
  };

  const handleCancelForm = () => {
    setShowCreateForm(false);
    setEditingSchedule(undefined);
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    // Convert 'HH:MM:SS' to 'h:MM AM/PM'
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getDeviceSchedules = (deviceId: number) => {
    return schedules.filter(s => s.device_id === deviceId);
  };

  const groupedSchedules = devices.reduce((acc, device) => {
    acc[device.id] = getDeviceSchedules(device.id);
    return acc;
  }, {} as Record<number, ScheduledPlaylist[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading scheduler...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Playlist Scheduler</h1>
          <p className="text-muted-foreground">
            Schedule different playlists to play at different times
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleForceEvaluate}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Evaluate Now
          </Button>
          <Button
            onClick={() => setShowCreateForm(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Schedule
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Schedules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{schedules.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {schedules.filter(s => s.enabled).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Recurring</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schedules.filter(s => s.schedule_type === 'recurring').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Specific Dates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {schedules.filter(s => s.schedule_type === 'specific_date').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedules List by Device */}
      <Card>
        <CardHeader>
          <CardTitle>Schedules by Device</CardTitle>
          <CardDescription>
            View and manage schedules organized by display device
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="all">All Devices</TabsTrigger>
              {devices.map(device => (
                <TabsTrigger key={device.id} value={device.id.toString()}>
                  {device.device_name || `Device ${device.id}`}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="all" className="space-y-4">
              {devices.map(device => {
                const deviceSchedules = groupedSchedules[device.id] || [];
                if (deviceSchedules.length === 0) return null;
                
                return (
                  <div key={device.id} className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">
                      {device.device_name || `Device ${device.id}`}
                    </h3>
                    <div className="space-y-2">
                      {deviceSchedules.map(schedule => (
                        <ScheduleCard
                          key={schedule.id}
                          schedule={schedule}
                          onToggleEnabled={handleToggleEnabled}
                          onDelete={handleDeleteSchedule}
                          onEdit={handleStartEdit}
                          formatTime={formatTime}
                          formatDate={formatDate}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </TabsContent>
            {devices.map(device => {
              const deviceSchedules = groupedSchedules[device.id] || [];
              
              return (
                <TabsContent key={device.id} value={device.id.toString()} className="space-y-2">
                  {deviceSchedules.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No schedules configured for this device
                    </div>
                  ) : (
                    deviceSchedules.map(schedule => (
                      <ScheduleCard
                        key={schedule.id}
                        schedule={schedule}
                        onToggleEnabled={handleToggleEnabled}
                        onDelete={handleDeleteSchedule}
                        onEdit={handleStartEdit}
                        formatTime={formatTime}
                        formatDate={formatDate}
                      />
                    ))
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </CardContent>
      </Card>

      {/* Create/Edit Schedule Form Modal */}
      {(showCreateForm || editingSchedule) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-auto">
          <div className="my-8">
            <ScheduleForm
              schedule={editingSchedule}
              devices={devices}
              playlists={playlists}
              onSubmit={editingSchedule ? handleEditSchedule : handleCreateSchedule}
              onCancel={handleCancelForm}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Schedule Card Component
interface ScheduleCardProps {
  schedule: ScheduledPlaylist;
  onToggleEnabled: (schedule: ScheduledPlaylist) => void;
  onDelete: (id: number) => void;
  onEdit: (schedule: ScheduledPlaylist) => void;
  formatTime: (time?: string) => string;
  formatDate: (date?: string) => string;
}

const ScheduleCard: React.FC<ScheduleCardProps> = ({
  schedule,
  onToggleEnabled,
  onDelete,
  onEdit,
  formatTime,
  formatDate
}) => {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium">{schedule.name}</span>
          <Badge variant={schedule.enabled ? "default" : "secondary"}>
            {schedule.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
          <Badge variant="outline">
            {schedule.schedule_type === 'recurring' ? 'Recurring' : 'Specific Date'}
          </Badge>
          <Badge variant="outline">Priority: {schedule.priority}</Badge>
        </div>
        
        <div className="text-sm text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Play className="h-3 w-3" />
              {schedule.playlist_name || `Playlist ${schedule.playlist_id}`}
            </span>
            
            {schedule.schedule_type === 'recurring' && schedule.days_of_week && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {schedule.days_of_week.map(d => d.substring(0, 3)).join(', ')}
              </span>
            )}
            
            {schedule.schedule_type === 'specific_date' && schedule.specific_date && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(schedule.specific_date)}
                {schedule.annual_recurrence && ' (Annual)'}
              </span>
            )}
            
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {schedule.schedule_type === 'recurring' 
                ? `${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}`
                : `${formatTime(schedule.specific_start_time)} - ${formatTime(schedule.specific_end_time)}`
              }
            </span>
          </div>
        </div>
        
        {schedule.description && (
          <p className="text-xs text-muted-foreground mt-1">{schedule.description}</p>
        )}
      </div>
      
      <div className="flex items-center gap-2 ml-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggleEnabled(schedule)}
        >
          {schedule.enabled ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(schedule)}
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(schedule.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default SchedulerPage;

