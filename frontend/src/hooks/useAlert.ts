import { useState, useCallback } from 'react';

// Define types locally to avoid import issues
type AlertType = 'success' | 'error' | 'warning' | 'info';

type AlertData = {
  id: string;
  type: AlertType;
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
};

export const useAlert = () => {
  const [alerts, setAlerts] = useState<AlertData[]>([]);

  const addAlert = useCallback((
    type: AlertType,
    title: string,
    message?: string,
    duration: number = 5000,
    action?: { label: string; onClick: () => void }
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    const alert: AlertData = {
      id,
      type,
      title,
      message,
      duration,
      action,
    };

    setAlerts(prev => [...prev, alert]);

    // Auto-remove alert after duration
    if (duration > 0) {
      setTimeout(() => {
        removeAlert(id);
      }, duration);
    }

    return id;
  }, []);

  const removeAlert = useCallback((id: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== id));
  }, []);

  const success = useCallback((title: string, message?: string, duration?: number) => {
    return addAlert('success', title, message, duration);
  }, [addAlert]);

  const error = useCallback((title: string, message?: string, duration?: number) => {
    return addAlert('error', title, message, duration);
  }, [addAlert]);

  const warning = useCallback((title: string, message?: string, duration?: number) => {
    return addAlert('warning', title, message, duration);
  }, [addAlert]);

  const info = useCallback((title: string, message?: string, duration?: number) => {
    return addAlert('info', title, message, duration);
  }, [addAlert]);

  const clearAll = useCallback(() => {
    setAlerts([]);
  }, []);

  return {
    alerts,
    addAlert,
    removeAlert,
    success,
    error,
    warning,
    info,
    clearAll,
  };
};

export default useAlert;
