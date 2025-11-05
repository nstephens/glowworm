import React from 'react';
import { Settings } from 'lucide-react';

export const SettingsHeader: React.FC = () => {
  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Settings className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">System</h1>
            <p className="text-muted-foreground">Configure your GlowWorm system</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsHeader;

