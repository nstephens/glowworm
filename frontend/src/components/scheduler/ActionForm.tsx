import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Slider } from '../ui/slider';
import { Switch } from '../ui/switch';
import { Alert, AlertDescription } from '../ui/alert';
import { X, Info, Power, MonitorOff, Cable } from 'lucide-react';
import type { Device, ActionFormData, ActionType, ScheduleType } from '../../types';

interface ActionFormProps {
  action?: any; // ScheduledAction for editing
  devices: Device[];
  onSubmit: (data: ActionFormData) => Promise<void>;
  onCancel: () => void;
}

const ACTION_TYPES: { value: ActionType; label: string; description: string; icon: any }[] = [
  { 
    value: 'power_on', 
    label: 'Power On', 
    description: 'Turn display on',
    icon: Power
  },
  { 
    value: 'power_off', 
    label: 'Power Off', 
    description: 'Turn display off',
    icon: MonitorOff
  },
  { 
    value: 'set_input', 
    label: 'Set Input', 
    description: 'Switch HDMI input',
    icon: Cable
  },
];

const DAYS_OF_WEEK = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
];

export const ActionForm: React.FC<ActionFormProps> = ({
  action,
  devices,
  onSubmit,
  onCancel,
}) => {
  const [formData, setFormData] = useState<ActionFormData>({
    device_id: action?.device_id || 0,
    action_type: action?.action_type || 'power_on',
    action_data: action?.action_data || {},
    schedule_type: action?.schedule_type || 'recurring',
    name: action?.name || '',
    description: action?.description || '',
    priority: action?.priority || 0,
    enabled: action?.enabled !== undefined ? action.enabled : true,
    days_of_week: action?.days_of_week || [],
    start_time: action?.start_time ? action.start_time.substring(0, 5) : '',
    end_time: action?.end_time ? action.end_time.substring(0, 5) : '',
    specific_date: action?.specific_date || '',
    specific_start_time: action?.specific_start_time ? action.specific_start_time.substring(0, 5) : '',
    specific_end_time: action?.specific_end_time ? action.specific_end_time.substring(0, 5) : '',
    annual_recurrence: action?.annual_recurrence || false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // For set_input action type
  const [inputName, setInputName] = useState(action?.action_data?.input_name || '');
  const [inputAddress, setInputAddress] = useState(action?.action_data?.input_address || '');

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.device_id) {
      newErrors.device_id = 'Device is required';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (formData.action_type === 'set_input') {
      if (!inputName.trim()) {
        newErrors.input_name = 'Input name is required for Set Input actions';
      }
      if (!inputAddress.trim()) {
        newErrors.input_address = 'Input address is required for Set Input actions';
      }
    }

    if (formData.schedule_type === 'recurring') {
      if (!formData.days_of_week || formData.days_of_week.length === 0) {
        newErrors.days_of_week = 'At least one day must be selected';
      }
      if (!formData.start_time) {
        newErrors.start_time = 'Start time is required';
      }
    } else if (formData.schedule_type === 'specific_date') {
      if (!formData.specific_date) {
        newErrors.specific_date = 'Date is required';
      }
      if (!formData.specific_start_time) {
        newErrors.specific_start_time = 'Start time is required';
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

    setSubmitting(true);

    try {
      const submitData = { ...formData };
      
      // Add action_data for set_input type
      if (formData.action_type === 'set_input') {
        submitData.action_data = {
          input_name: inputName,
          input_address: inputAddress,
        };
      } else {
        submitData.action_data = {};
      }

      await onSubmit(submitData);
    } catch (err) {
      console.error('Form submission error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleDay = (day: string) => {
    const currentDays = formData.days_of_week || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    
    setFormData({ ...formData, days_of_week: newDays });
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{action ? 'Edit Action' : 'Create Action'}</CardTitle>
            <CardDescription>
              Schedule display power and input control actions
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Device Selection */}
          <div className="space-y-2">
            <Label htmlFor="device">Device *</Label>
            <Select
              value={formData.device_id.toString()}
              onValueChange={(value) => setFormData({ ...formData, device_id: parseInt(value) })}
            >
              <SelectTrigger id="device" className={errors.device_id ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select a device" />
              </SelectTrigger>
              <SelectContent>
                {devices.map(device => (
                  <SelectItem key={device.id} value={device.id.toString()}>
                    {device.device_name || `Device ${device.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.device_id && <p className="text-sm text-red-600">{errors.device_id}</p>}
          </div>

          {/* Action Type */}
          <div className="space-y-2">
            <Label htmlFor="action-type">Action Type *</Label>
            <Select
              value={formData.action_type}
              onValueChange={(value: ActionType) => setFormData({ ...formData, action_type: value })}
            >
              <SelectTrigger id="action-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_TYPES.map(type => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <div>
                          <div className="font-medium">{type.label}</div>
                          <div className="text-xs text-muted-foreground">{type.description}</div>
                        </div>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Input fields for set_input action */}
          {formData.action_type === 'set_input' && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-3">
                  <p className="text-sm">Configure HDMI input switching parameters:</p>
                  
                  <div className="space-y-2">
                    <Label htmlFor="input-name">Input Name *</Label>
                    <Input
                      id="input-name"
                      value={inputName}
                      onChange={(e) => setInputName(e.target.value)}
                      placeholder="e.g., HDMI 3, Raspberry Pi"
                      className={errors.input_name ? 'border-red-500' : ''}
                    />
                    {errors.input_name && <p className="text-sm text-red-600">{errors.input_name}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="input-address">Input Address *</Label>
                    <Input
                      id="input-address"
                      value={inputAddress}
                      onChange={(e) => setInputAddress(e.target.value)}
                      placeholder="e.g., 3, 0 (for self)"
                      className={errors.input_address ? 'border-red-500' : ''}
                    />
                    {errors.input_address && <p className="text-sm text-red-600">{errors.input_address}</p>}
                    <p className="text-xs text-muted-foreground">
                      Use '0' or 'self' to switch to the device running Glowworm
                    </p>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Morning Power On, Evening Shutdown"
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Optional notes about this action"
              rows={2}
            />
          </div>

          {/* Schedule Type */}
          <div className="space-y-2">
            <Label htmlFor="schedule-type">Schedule Type *</Label>
            <Select
              value={formData.schedule_type}
              onValueChange={(value: ScheduleType) => setFormData({ ...formData, schedule_type: value })}
            >
              <SelectTrigger id="schedule-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recurring">
                  <div>
                    <div className="font-medium">Recurring</div>
                    <div className="text-xs text-muted-foreground">Repeat on specific days each week</div>
                  </div>
                </SelectItem>
                <SelectItem value="specific_date">
                  <div>
                    <div className="font-medium">Specific Date</div>
                    <div className="text-xs text-muted-foreground">One-time or annual event</div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Recurring Schedule Fields */}
          {formData.schedule_type === 'recurring' && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <div className="space-y-2">
                <Label>Days of Week * </Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map(day => {
                    const isSelected = formData.days_of_week?.includes(day);
                    return (
                      <Button
                        key={day}
                        type="button"
                        variant={isSelected ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => toggleDay(day)}
                        className="capitalize"
                      >
                        {day.substring(0, 3)}
                      </Button>
                    );
                  })}
                </div>
                {errors.days_of_week && <p className="text-sm text-red-600">{errors.days_of_week}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-time">Start Time *</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                    className={errors.start_time ? 'border-red-500' : ''}
                  />
                  {errors.start_time && <p className="text-sm text-red-600">{errors.start_time}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end-time">End Time (Optional)</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Leave empty for no end time</p>
                </div>
              </div>
            </div>
          )}

          {/* Specific Date Fields */}
          {formData.schedule_type === 'specific_date' && (
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <div className="space-y-2">
                <Label htmlFor="specific-date">Date *</Label>
                <Input
                  id="specific-date"
                  type="date"
                  value={formData.specific_date}
                  onChange={(e) => setFormData({ ...formData, specific_date: e.target.value })}
                  className={errors.specific_date ? 'border-red-500' : ''}
                />
                {errors.specific_date && <p className="text-sm text-red-600">{errors.specific_date}</p>}
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="annual-recurrence"
                  checked={formData.annual_recurrence}
                  onCheckedChange={(checked) => setFormData({ ...formData, annual_recurrence: checked })}
                />
                <Label htmlFor="annual-recurrence" className="cursor-pointer">
                  Repeat annually (e.g., birthdays, holidays)
                </Label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="specific-start-time">Start Time *</Label>
                  <Input
                    id="specific-start-time"
                    type="time"
                    value={formData.specific_start_time}
                    onChange={(e) => setFormData({ ...formData, specific_start_time: e.target.value })}
                    className={errors.specific_start_time ? 'border-red-500' : ''}
                  />
                  {errors.specific_start_time && <p className="text-sm text-red-600">{errors.specific_start_time}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specific-end-time">End Time (Optional)</Label>
                  <Input
                    id="specific-end-time"
                    type="time"
                    value={formData.specific_end_time}
                    onChange={(e) => setFormData({ ...formData, specific_end_time: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">Leave empty for no end time</p>
                </div>
              </div>
            </div>
          )}

          {/* Priority */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="priority">Priority</Label>
              <span className="text-sm text-muted-foreground">{formData.priority}</span>
            </div>
            <Slider
              id="priority"
              min={0}
              max={100}
              step={1}
              value={[formData.priority]}
              onValueChange={([value]) => setFormData({ ...formData, priority: value })}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Higher priority actions take precedence when multiple actions overlap
            </p>
          </div>

          {/* Enabled Toggle */}
          <div className="flex items-center space-x-2">
            <Switch
              id="enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
            />
            <Label htmlFor="enabled" className="cursor-pointer">
              Enabled
            </Label>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1"
            >
              {submitting ? 'Saving...' : action ? 'Update Action' : 'Create Action'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default ActionForm;

