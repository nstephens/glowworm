import React, { useEffect, useState } from 'react';
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { apiService } from '../../services/api';
import { useToast } from '../../hooks/useToast';

interface HealthIssue {
  type: string;
  severity: 'error' | 'warning' | 'info';
  count: number;
  message: string;
  action: string | null;
  action_label: string | null;
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  issues: HealthIssue[];
  warnings: HealthIssue[];
  timestamp: string;
}

export const SystemHealthBanner: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isPerformingAction, setIsPerformingAction] = useState(false);
  const { toast } = useToast();

  const fetchHealth = async () => {
    try {
      const response = await apiService.api.get('/images/admin/system-health');
      setHealth(response.data);
      
      // Reset dismissal if status changes
      if (response.data.status !== 'healthy') {
        setIsDismissed(false);
      }
    } catch (error) {
      console.error('Failed to fetch system health:', error);
    }
  };

  useEffect(() => {
    // Initial check
    fetchHealth();
    
    // Poll every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (action: string, label: string) => {
    setIsPerformingAction(true);
    
    try {
      if (action === 'optimize_database') {
        const response = await apiService.api.post('/images/admin/optimize-database');
        toast({
          title: 'Database Optimized',
          description: `${response.data.data.stale_processing_reset} stale records reset`,
        });
      } else if (action === 'generate_variants') {
        const response = await apiService.api.post('/images/regenerate-resolutions');
        toast({
          title: 'Variants Queued',
          description: response.data.message,
        });
      }
      
      // Refresh health status
      setTimeout(fetchHealth, 2000);
    } catch (error: any) {
      toast({
        title: 'Action Failed',
        description: error.response?.data?.detail || 'Failed to perform action',
        variant: 'destructive',
      });
    } finally {
      setIsPerformingAction(false);
    }
  };

  if (!health || health.status === 'healthy' || isDismissed) {
    return null;
  }

  const allIssues = [...health.issues, ...health.warnings];
  const hasCritical = health.status === 'critical';

  const getIcon = () => {
    if (hasCritical) return <AlertCircle className="h-5 w-5 text-red-600" />;
    return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
  };

  const getBgColor = () => {
    if (hasCritical) return 'bg-red-50 border-red-200';
    return 'bg-yellow-50 border-yellow-200';
  };

  return (
    <div className={`border-l-4 p-4 mb-6 ${getBgColor()} rounded-r-lg shadow-sm relative`}>
      <button
        onClick={() => setIsDismissed(true)}
        className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
      >
        <X className="h-5 w-5" />
      </button>
      
      <div className="flex items-start">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-gray-900">
            {hasCritical ? 'System Issues Detected' : 'System Warnings'}
          </h3>
          
          <div className="mt-2 space-y-2">
            {allIssues.map((issue, index) => (
              <div key={index} className="flex items-center justify-between">
                <p className="text-sm text-gray-700">
                  {issue.message}
                </p>
                
                {issue.action && issue.action_label && (
                  <button
                    onClick={() => handleAction(issue.action!, issue.action_label!)}
                    disabled={isPerformingAction}
                    className={`ml-4 px-3 py-1 text-sm font-medium rounded-md ${
                      issue.severity === 'error'
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-yellow-600 text-white hover:bg-yellow-700'
                    } disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                  >
                    {isPerformingAction ? 'Processing...' : issue.action_label}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

