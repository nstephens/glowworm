import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Plus, Monitor } from 'lucide-react';
import apiService from '../services/api';
import type { Device } from '../types';

interface DeviceActionsSchedulerProps {}

export const DeviceActionsScheduler: React.FC<DeviceActionsSchedulerProps> = () => {
  const [actions, setActions] = useState<any[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const devicesResponse = await apiService.getDevices();
      
      const devicesData = Array.isArray(devicesResponse) 
        ? devicesResponse 
        : [];

      // Filter to only show authorized devices
      const authorizedDevices = devicesData.filter((d: any) => d.status === 'authorized');
      
      setDevices(authorizedDevices);
      // TODO: Load scheduled actions from backend
      setActions([]);
    } catch (err: any) {
      setError(err.message || 'Failed to load device actions data');
      console.error('Failed to load device actions data:', err);
      setDevices([]);
      setActions([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading device actions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-lg">
            <Monitor className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Device Actions</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Schedule display power on/off and input switching
            </p>
          </div>
        </div>
        
        <Button
          onClick={() => setShowCreateForm(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Action
        </Button>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{actions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {actions.filter(a => a.enabled).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Power Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {actions.filter(a => a.action_type === 'power_on' || a.action_type === 'power_off').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Input Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {actions.filter(a => a.action_type === 'set_input').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Coming Soon Message */}
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <Monitor className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Device Actions Scheduler</h3>
            <p className="text-muted-foreground mb-4">
              Schedule your displays to turn on/off at specific times and automatically switch inputs.
            </p>
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg max-w-2xl mx-auto">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                <strong>Coming Soon:</strong> Full implementation of device action scheduling including:
              </p>
              <ul className="text-sm text-blue-800 dark:text-blue-200 mt-2 space-y-1 text-left list-disc list-inside">
                <li>Power on/off displays at scheduled times</li>
                <li>Automatic input switching (e.g., ensure TV is on correct HDMI input)</li>
                <li>Recurring schedules (daily, weekly patterns)</li>
                <li>Specific date actions (holidays, events)</li>
                <li>Integration with existing Playlist Scheduler</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions List Placeholder */}
      {devices.length > 0 && actions.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No device actions scheduled yet. Click "Create Action" to get started.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {devices.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                No authorized devices found. Please authorize devices first from the Displays page.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DeviceActionsScheduler;

