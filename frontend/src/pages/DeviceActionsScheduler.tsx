import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Plus, Monitor } from 'lucide-react';
import apiService from '../services/api';
import { ActionForm } from '../components/scheduler/ActionForm';
import { ActionList } from '../components/scheduler/ActionList';
import type { Device, ScheduledAction, ActionFormData } from '../types';

interface DeviceActionsSchedulerProps {}

export const DeviceActionsScheduler: React.FC<DeviceActionsSchedulerProps> = () => {
  const [actions, setActions] = useState<ScheduledAction[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingAction, setEditingAction] = useState<ScheduledAction | undefined>(undefined);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [actionsResponse, devicesResponse] = await Promise.all([
        apiService.getActions(),
        apiService.getDevices()
      ]);
      
      const actionsData = Array.isArray(actionsResponse.data) 
        ? actionsResponse.data 
        : [];

      const devicesData = Array.isArray(devicesResponse) 
        ? devicesResponse 
        : [];

      // Filter to only show authorized devices
      const authorizedDevices = devicesData.filter((d: any) => d.status === 'authorized');
      
      setActions(actionsData);
      setDevices(authorizedDevices);
    } catch (err: any) {
      setError(err.message || 'Failed to load device actions data');
      console.error('Failed to load device actions data:', err);
      setDevices([]);
      setActions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async (actionId: number) => {
    try {
      await apiService.toggleAction(actionId);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to toggle action');
    }
  };

  const handleDeleteAction = async (actionId: number) => {
    if (!confirm('Are you sure you want to delete this action?')) {
      return;
    }

    try {
      await apiService.deleteAction(actionId);
      setActions(prev => prev.filter(a => a.id !== actionId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete action');
    }
  };

  const handleCreateAction = async (data: ActionFormData) => {
    try {
      await apiService.createAction(data);
      setShowCreateForm(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to create action');
    }
  };

  const handleEditAction = async (data: ActionFormData) => {
    if (!editingAction) return;

    try {
      await apiService.updateAction(editingAction.id, data);
      setEditingAction(undefined);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update action');
    }
  };

  const handleStartEdit = (action: ScheduledAction) => {
    setEditingAction(action);
    setShowCreateForm(false);
  };

  const handleCancelForm = () => {
    setShowCreateForm(false);
    setEditingAction(undefined);
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
            <div className="text-2xl font-bold">{Array.isArray(actions) ? actions.length : 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {Array.isArray(actions) ? actions.filter(a => a.enabled).length : 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Power Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.isArray(actions) ? actions.filter(a => a.action_type === 'power_on' || a.action_type === 'power_off').length : 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Input Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Array.isArray(actions) ? actions.filter(a => a.action_type === 'set_input').length : 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Actions List */}
      {actions.length > 0 ? (
        <ActionList
          actions={actions}
          devices={devices}
          onToggleEnabled={handleToggleEnabled}
          onEdit={handleStartEdit}
          onDelete={handleDeleteAction}
          loading={false}
        />
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {devices.length === 0 
                  ? 'No authorized devices found. Please authorize devices first from the Displays page.'
                  : 'No device actions scheduled yet. Click "Create Action" to get started.'
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Action Form Modal */}
      {(showCreateForm || editingAction) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-auto">
          <div className="my-8">
            <ActionForm
              action={editingAction}
              devices={devices}
              onSubmit={editingAction ? handleEditAction : handleCreateAction}
              onCancel={handleCancelForm}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default DeviceActionsScheduler;

