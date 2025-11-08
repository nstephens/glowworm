import React from 'react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Play, Pause, Trash2, Edit, Calendar, Clock } from 'lucide-react';
import type { ScheduledPlaylist } from '../../types';

interface ScheduleCardProps {
  schedule: ScheduledPlaylist;
  onToggleEnabled: (schedule: ScheduledPlaylist) => void;
  onDelete: (id: number) => void;
  onEdit: (schedule: ScheduledPlaylist) => void;
}

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

export const ScheduleCard: React.FC<ScheduleCardProps> = ({
  schedule,
  onToggleEnabled,
  onDelete,
  onEdit,
}) => {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
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
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1">
              <Play className="h-3 w-3" />
              {schedule.playlist_name || `Playlist ${schedule.playlist_id}`}
            </span>
            
            {schedule.schedule_type === 'recurring' && schedule.days_of_week && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {schedule.days_of_week.map(d => d.substring(0, 3).toUpperCase()).join(', ')}
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
          title={schedule.enabled ? 'Disable schedule' : 'Enable schedule'}
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
          title="Edit schedule"
        >
          <Edit className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (confirm(`Are you sure you want to delete "${schedule.name}"?`)) {
              onDelete(schedule.id);
            }
          }}
          title="Delete schedule"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default ScheduleCard;

