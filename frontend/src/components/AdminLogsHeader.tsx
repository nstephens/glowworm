import React from 'react';
import { FileText } from 'lucide-react';

export const AdminLogsHeader: React.FC = () => {
  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">System Logs</h1>
            <p className="text-muted-foreground">View and manage system logs across all services</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogsHeader;

