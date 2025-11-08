import React from 'react';
import { Calendar } from 'lucide-react';

interface SchedulerHeaderProps {
  scheduleCount?: number;
  activeCount?: number;
}

const SchedulerHeader: React.FC<SchedulerHeaderProps> = ({
  scheduleCount = 0,
  activeCount = 0
}) => {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 p-2 rounded-lg">
          <Calendar className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Scheduler</h1>
          <p className="text-sm text-muted-foreground">
            {scheduleCount} schedule{scheduleCount !== 1 ? 's' : ''} · {activeCount} active
          </p>
        </div>
      </div>
    </div>
  );
};

export default SchedulerHeader;

