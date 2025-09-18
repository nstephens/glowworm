import React from 'react';
import { Alert } from './Alert';

// Define the type locally to avoid import issues
type AlertData = {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
};

interface AlertContainerProps {
  alerts: AlertData[];
  onRemove: (id: string) => void;
}

export const AlertContainer: React.FC<AlertContainerProps> = ({ 
  alerts, 
  onRemove 
}) => {
  if (alerts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-4">
      {alerts.map((alert) => (
        <Alert
          key={alert.id}
          alert={alert}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
};

export default AlertContainer;
