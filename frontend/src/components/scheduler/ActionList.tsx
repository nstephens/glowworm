import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Power, MonitorOff, Cable, Edit, Trash2, Calendar, Clock } from 'lucide-react';
import type { ScheduledAction, Device } from '../../types';

interface ActionListProps {
  actions: ScheduledAction[];
  devices: Device[];
  onToggleEnabled: (actionId: number) => Promise<void>;
  onEdit: (action: ScheduledAction) => void;
  onDelete: (actionId: number) => Promise<void>;
  loading: boolean;
}

const ACTION_ICONS = {
  power_on: Power,
  power_off: MonitorOff,
  set_input: Cable,
};

const ACTION_LABELS = {
  power_on: 'Power On',
  power_off: 'Power Off',
  set_input: 'Set Input',
};

const formatTime = (timeStr: string | undefined) => {
  if (!timeStr) return '';
  // Convert HH:MM:SS to h:MM AM/PM
  const [hours, minutes] = timeStr.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
};

const formatDays = (days: string[] | undefined) => {
  if (!days || days.length === 0) return '';
  if (days.length === 7) return 'Every day';
  return days.map(d => d.substring(0, 3).toUpperCase()).join(', ');
};

export const ActionList: React.FC<ActionListProps> = ({
  actions,
  devices,
  onToggleEnabled,
  onEdit,
  onDelete,
  loading,
}) => {
  // Group actions by device
  const actionsByDevice = actions.reduce((acc, action) => {
    if (!acc[action.device_id]) {
      acc[action.device_id] = [];
    }
    acc[action.device_id].push(action);
    return acc;
  }, {} as Record<number, ScheduledAction[]>);

  const getDeviceName = (deviceId: number) => {
    const device = devices.find(d => d.id === deviceId);
    return device?.device_name || `Device ${deviceId}`;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading actions...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (actions.length === 0) {
    return null; // Parent component handles empty state
  }

  return (
    <div className="space-y-6">
      {Object.entries(actionsByDevice).map(([deviceIdStr, deviceActions]) => {
        const deviceId = parseInt(deviceIdStr);
        return (
          <Card key={deviceId}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                {getDeviceName(deviceId)}
                <Badge variant="outline">{deviceActions.length} action{deviceActions.length !== 1 ? 's' : ''}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {deviceActions.map(action => {
                  const Icon = ACTION_ICONS[action.action_type];
                  return (
                    <div
                      key={action.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded ${
                            action.action_type === 'power_on' ? 'bg-green-100 text-green-700' :
                            action.action_type === 'power_off' ? 'bg-red-100 text-red-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <h4 className="font-medium">{action.name}</h4>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Badge variant="outline" className="text-xs">
                                {ACTION_LABELS[action.action_type]}
                              </Badge>
                              {action.action_type === 'set_input' && action.action_data?.input_name && (
                                <span className="text-xs">→ {action.action_data.input_name}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-muted-foreground ml-12">
                          {action.schedule_type === 'recurring' ? (
                            <>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatDays(action.days_of_week)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTime(action.start_time)}
                                {action.end_time && ` - ${formatTime(action.end_time)}`}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {action.specific_date}
                                {action.annual_recurrence && ' (Annual)'}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatTime(action.specific_start_time)}
                                {action.specific_end_time && ` - ${formatTime(action.specific_end_time)}`}
                              </span>
                            </>
                          )}
                          {action.priority > 0 && (
                            <Badge variant="secondary" className="text-xs">
                              Priority: {action.priority}
                            </Badge>
                          )}
                        </div>

                        {action.description && (
                          <p className="text-xs text-muted-foreground ml-12 italic">
                            {action.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <Switch
                          checked={action.enabled}
                          onCheckedChange={() => onToggleEnabled(action.id)}
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(action)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDelete(action.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default ActionList;

