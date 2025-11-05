import React from 'react';
import { LayoutDashboard } from 'lucide-react';

export const AdminDashboardHeader: React.FC = () => {
  return (
    <div className="animate-fade-in-up">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <LayoutDashboard className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Overview of your GlowWorm system</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboardHeader;
