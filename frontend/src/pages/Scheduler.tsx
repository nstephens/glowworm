import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Plus, RefreshCw } from 'lucide-react';
import apiService from '../services/api';
import { ScheduleForm } from '../components/scheduler/ScheduleForm';
import { ScheduleList } from '../components/scheduler/ScheduleList';
import { SchedulePreview } from '../components/scheduler/SchedulePreview';
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

      console.log('Schedules response:', schedulesResponse);
      console.log('Devices response:', devicesResponse);
      console.log('Playlists response:', playlistsResponse);

      // Ensure we always set arrays
      const schedulesData = Array.isArray(schedulesResponse.data) 
        ? schedulesResponse.data 
        : Array.isArray(schedulesResponse) 
          ? schedulesResponse 
          : [];
      
      const devicesData = Array.isArray(devicesResponse) 
        ? devicesResponse 
        : [];
      
      const playlistsData = Array.isArray(playlistsResponse.data) 
        ? playlistsResponse.data 
        : Array.isArray(playlistsResponse) 
          ? playlistsResponse 
          : [];

      console.log('Setting schedules:', schedulesData);
      setSchedules(schedulesData);
      setDevices(devicesData);
      setPlaylists(playlistsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load scheduler data');
      console.error('Failed to load scheduler data:', err);
      // Set empty arrays on error
      setSchedules([]);
      setDevices([]);
      setPlaylists([]);
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
            <div className="text-2xl font-bold">{Array.isArray(schedules) ? schedules.length : 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {Array.isArray(schedules) ? schedules.filter(s => s.enabled).length : 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Recurring</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.isArray(schedules) ? schedules.filter(s => s.schedule_type === 'recurring').length : 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Specific Dates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.isArray(schedules) ? schedules.filter(s => s.schedule_type === 'specific_date').length : 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedule Preview */}
      <SchedulePreview devices={devices} />

      {/* Schedules List by Device */}
      <ScheduleList
        schedules={schedules}
        devices={devices}
        onToggleEnabled={handleToggleEnabled}
        onEdit={handleStartEdit}
        onDelete={handleDeleteSchedule}
        loading={false}
      />

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

export default SchedulerPage;

