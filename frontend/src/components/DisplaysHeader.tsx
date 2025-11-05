import React from 'react';
import { Monitor } from 'lucide-react';

interface DisplaysHeaderProps {
  activeCount?: number;
  pendingCount?: number;
}

export const DisplaysHeader: React.FC<DisplaysHeaderProps> = ({ 
  activeCount = 0,
  pendingCount = 0 
}) => {
  const totalDisplays = activeCount + pendingCount;
  const statusText = pendingCount > 0 
    ? `${activeCount} active, ${pendingCount} pending approval` 
    : `${totalDisplays} display${totalDisplays !== 1 ? 's' : ''} connected`;
    
  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Monitor className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Displays</h1>
            <p className="text-muted-foreground">{statusText}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisplaysHeader;
