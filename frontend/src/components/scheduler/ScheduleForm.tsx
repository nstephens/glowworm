import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Slider } from '../ui/slider';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { X, Calendar, Clock, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useScheduleConflicts } from '../../hooks/useScheduleConflicts';
import type { ScheduleFormData, ScheduledPlaylist, Playlist } from '../../types';

interface ScheduleFormProps {
  schedule?: ScheduledPlaylist; // For editing
  devices: any[];
  playlists: Playlist[];
  onSubmit: (data: ScheduleFormData) => Promise<void>;
  onCancel: () => void;
}

const DAYS_OF_WEEK = [
  { value: 'monday', label: 'Monday' },
  { value: 'tuesday', label: 'Tuesday' },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday', label: 'Thursday' },
  { value: 'friday', label: 'Friday' },
  { value: 'saturday', label: 'Saturday' },
  { value: 'sunday', label: 'Sunday' },
];

export const ScheduleForm: React.FC<ScheduleFormProps> = ({
  schedule,
  devices,
  playlists,
  onSubmit,
  onCancel,
}) => {
  const [formData, setFormData] = useState<ScheduleFormData>({
    device_id: schedule?.device_id || 0,
    playlist_id: schedule?.playlist_id || 0,
    schedule_type: schedule?.schedule_type || 'recurring',
    name: schedule?.name || '',
    description: schedule?.description || '',
    priority: schedule?.priority || 0,
    enabled: schedule?.enabled !== undefined ? schedule.enabled : true,
    // Recurring fields
    days_of_week: schedule?.days_of_week || [],
    start_time: schedule?.start_time?.substring(0, 5) || '', // HH:MM
    end_time: schedule?.end_time?.substring(0, 5) || '', // HH:MM
    // Specific date fields
    specific_date: schedule?.specific_date || '',
    specific_start_time: schedule?.specific_start_time?.substring(0, 5) || '',
    specific_end_time: schedule?.specific_end_time?.substring(0, 5) || '',
    annual_recurrence: schedule?.annual_recurrence || false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const { conflicts, loading: conflictsLoading, checkConflicts } = useScheduleConflicts();

  // Check for conflicts when form data changes
  useEffect(() => {
    const timer = setTimeout(() => {
      checkConflicts(formData, schedule?.id);
    }, 500); // Debounce to avoid too many API calls

    return () => clearTimeout(timer);
  }, [
    formData.device_id,
    formData.schedule_type,
    formData.days_of_week,
    formData.start_time,
    formData.end_time,
    formData.specific_date,
    formData.specific_start_time,
    formData.specific_end_time,
    formData.priority,
  ]);

  // Toggle day selection
  const toggleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      days_of_week: prev.days_of_week?.includes(day)
        ? prev.days_of_week.filter(d => d !== day)
        : [...(prev.days_of_week || []), day]
    }));
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Common validations
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.device_id) {
      newErrors.device_id = 'Device is required';
    }
    if (!formData.playlist_id) {
      newErrors.playlist_id = 'Playlist is required';
    }

    // Schedule type specific validations
    if (formData.schedule_type === 'recurring') {
      if (!formData.days_of_week || formData.days_of_week.length === 0) {
        newErrors.days_of_week = 'At least one day must be selected';
      }
      if (!formData.start_time) {
        newErrors.start_time = 'Start time is required';
      }
      if (!formData.end_time) {
        newErrors.end_time = 'End time is required';
      }
      if (formData.start_time && formData.end_time && formData.start_time >= formData.end_time) {
        newErrors.time_range = 'Start time must be before end time';
      }
    } else if (formData.schedule_type === 'specific_date') {
      if (!formData.specific_date) {
        newErrors.specific_date = 'Date is required';
      }
      if (!formData.specific_start_time) {
        newErrors.specific_start_time = 'Start time is required';
      }
      if (!formData.specific_end_time) {
        newErrors.specific_end_time = 'End time is required';
      }
      if (formData.specific_start_time && formData.specific_end_time && 
          formData.specific_start_time >= formData.specific_end_time) {
        newErrors.specific_time_range = 'Start time must be before end time';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      
      // Prepare data for submission - append :00 for seconds
      const submitData: ScheduleFormData = {
        ...formData,
        start_time: formData.start_time ? `${formData.start_time}:00` : undefined,
        end_time: formData.end_time ? `${formData.end_time}:00` : undefined,
        specific_start_time: formData.specific_start_time ? `${formData.specific_start_time}:00` : undefined,
        specific_end_time: formData.specific_end_time ? `${formData.specific_end_time}:00` : undefined,
      };
      
      await onSubmit(submitData);
    } catch (err: any) {
      setErrors({ submit: err.message || 'Failed to save schedule' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>{schedule ? 'Edit Schedule' : 'Create New Schedule'}</CardTitle>
          <CardDescription>
            {formData.schedule_type === 'recurring' 
              ? 'Schedule a playlist to play on specific days and times'
              : 'Schedule a playlist for a specific date'}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Error Alert */}
          {errors.submit && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errors.submit}</AlertDescription>
            </Alert>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Schedule Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Weekend Morning Playlist"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description for this schedule"
                rows={2}
              />
            </div>
          </div>

          {/* Device & Playlist Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="device">Display Device *</Label>
              <Select
                value={formData.device_id.toString()}
                onValueChange={(value) => setFormData(prev => ({ ...prev, device_id: parseInt(value) }))}
              >
                <SelectTrigger className={errors.device_id ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select device" />
                </SelectTrigger>
                <SelectContent>
                  {devices.map(device => (
                    <SelectItem key={device.id} value={device.id.toString()}>
                      {device.device_name || `Device ${device.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.device_id && <p className="text-sm text-red-500 mt-1">{errors.device_id}</p>}
            </div>

            <div>
              <Label htmlFor="playlist">Playlist *</Label>
              <Select
                value={formData.playlist_id.toString()}
                onValueChange={(value) => setFormData(prev => ({ ...prev, playlist_id: parseInt(value) }))}
              >
                <SelectTrigger className={errors.playlist_id ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select playlist" />
                </SelectTrigger>
                <SelectContent>
                  {playlists.map(playlist => (
                    <SelectItem key={playlist.id} value={playlist.id.toString()}>
                      {playlist.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.playlist_id && <p className="text-sm text-red-500 mt-1">{errors.playlist_id}</p>}
            </div>
          </div>

          {/* Schedule Type */}
          <div>
            <Label>Schedule Type *</Label>
            <div className="flex gap-4 mt-2">
              <Button
                type="button"
                variant={formData.schedule_type === 'recurring' ? 'default' : 'outline'}
                onClick={() => setFormData(prev => ({ ...prev, schedule_type: 'recurring' }))}
                className="flex-1"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Recurring
              </Button>
              <Button
                type="button"
                variant={formData.schedule_type === 'specific_date' ? 'default' : 'outline'}
                onClick={() => setFormData(prev => ({ ...prev, schedule_type: 'specific_date' }))}
                className="flex-1"
              >
                <Calendar className="h-4 w-4 mr-2" />
                Specific Date
              </Button>
            </div>
          </div>

          {/* Recurring Schedule Fields */}
          {formData.schedule_type === 'recurring' && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
              <div>
                <Label>Days of Week *</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {DAYS_OF_WEEK.map(day => (
                    <Badge
                      key={day.value}
                      variant={formData.days_of_week?.includes(day.value) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleDay(day.value)}
                    >
                      {day.label}
                    </Badge>
                  ))}
                </div>
                {errors.days_of_week && <p className="text-sm text-red-500 mt-1">{errors.days_of_week}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_time">Start Time *</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="start_time"
                      type="time"
                      value={formData.start_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, start_time: e.target.value }))}
                      className={`pl-10 ${errors.start_time ? 'border-red-500' : ''}`}
                    />
                  </div>
                  {errors.start_time && <p className="text-sm text-red-500 mt-1">{errors.start_time}</p>}
                </div>

                <div>
                  <Label htmlFor="end_time">End Time *</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="end_time"
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                      className={`pl-10 ${errors.end_time ? 'border-red-500' : ''}`}
                    />
                  </div>
                  {errors.end_time && <p className="text-sm text-red-500 mt-1">{errors.end_time}</p>}
                </div>
              </div>
              {errors.time_range && <p className="text-sm text-red-500">{errors.time_range}</p>}
            </div>
          )}

          {/* Specific Date Schedule Fields */}
          {formData.schedule_type === 'specific_date' && (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/20">
              <div>
                <Label htmlFor="specific_date">Date *</Label>
                <Input
                  id="specific_date"
                  type="date"
                  value={formData.specific_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, specific_date: e.target.value }))}
                  className={errors.specific_date ? 'border-red-500' : ''}
                />
                {errors.specific_date && <p className="text-sm text-red-500 mt-1">{errors.specific_date}</p>}
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="annual_recurrence"
                  checked={formData.annual_recurrence}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, annual_recurrence: checked }))}
                />
                <Label htmlFor="annual_recurrence" className="cursor-pointer">
                  Repeat annually (e.g., for birthdays or holidays)
                </Label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="specific_start_time">Start Time *</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="specific_start_time"
                      type="time"
                      value={formData.specific_start_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, specific_start_time: e.target.value }))}
                      className={`pl-10 ${errors.specific_start_time ? 'border-red-500' : ''}`}
                    />
                  </div>
                  {errors.specific_start_time && <p className="text-sm text-red-500 mt-1">{errors.specific_start_time}</p>}
                </div>

                <div>
                  <Label htmlFor="specific_end_time">End Time *</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="specific_end_time"
                      type="time"
                      value={formData.specific_end_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, specific_end_time: e.target.value }))}
                      className={`pl-10 ${errors.specific_end_time ? 'border-red-500' : ''}`}
                    />
                  </div>
                  {errors.specific_end_time && <p className="text-sm text-red-500 mt-1">{errors.specific_end_time}</p>}
                </div>
              </div>
              {errors.specific_time_range && <p className="text-sm text-red-500">{errors.specific_time_range}</p>}
            </div>
          )}

          {/* Conflict Warnings */}
          {conflicts.length > 0 && (
            <Alert variant={conflicts.some(c => !c.will_override) ? "destructive" : "default"} className="border-amber-500 bg-amber-50 dark:bg-amber-950">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertTitle className="text-amber-900 dark:text-amber-100">
                Schedule Conflicts Detected ({conflicts.length})
              </AlertTitle>
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                <div className="space-y-2 mt-2">
                  {conflicts.map((conflict) => (
                    <div key={conflict.schedule_id} className="flex items-start gap-2 text-sm">
                      <Badge variant={conflict.will_override ? "default" : "destructive"} className="mt-0.5">
                        {conflict.will_override ? 'Will Override' : 'Will Be Overridden'}
                      </Badge>
                      <div>
                        <p className="font-medium">{conflict.schedule_name}</p>
                        <p className="text-xs">{conflict.reason}</p>
                      </div>
                    </div>
                  ))}
                  <p className="text-xs mt-2 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Adjust the priority slider below to change conflict resolution
                  </p>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Priority */}
          <div>
            <Label>Priority: {formData.priority}</Label>
            <p className="text-sm text-muted-foreground mb-2">
              Higher priority schedules override lower ones when they overlap
              {formData.schedule_type === 'specific_date' && (
                <span className="text-primary"> (Specific dates get +1000 boost)</span>
              )}
            </p>
            <Slider
              value={[formData.priority]}
              onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value[0] }))}
              min={0}
              max={100}
              step={1}
              className="w-full"
            />
            {conflictsLoading && (
              <p className="text-xs text-muted-foreground mt-1">Checking for conflicts...</p>
            )}
          </div>

          {/* Enabled Toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, enabled: checked }))}
            />
            <Label htmlFor="enabled" className="cursor-pointer">
              Enable this schedule immediately
            </Label>
          </div>
        </CardContent>

        <CardFooter className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : schedule ? 'Update Schedule' : 'Create Schedule'}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
};

export default ScheduleForm;

