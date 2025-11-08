import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScheduleCard } from './ScheduleCard';
import type { ScheduledPlaylist } from '../../types';

interface ScheduleListProps {
  schedules: ScheduledPlaylist[];
  devices: any[];
  onToggleEnabled: (schedule: ScheduledPlaylist) => void;
  onEdit: (schedule: ScheduledPlaylist) => void;
  onDelete: (id: number) => void;
  loading?: boolean;
}

export const ScheduleList: React.FC<ScheduleListProps> = ({
  schedules,
  devices,
  onToggleEnabled,
  onEdit,
  onDelete,
  loading = false,
}) => {
  const getDeviceSchedules = (deviceId: number) => {
    return schedules.filter(s => s.device_id === deviceId);
  };

  const groupedSchedules = devices.reduce((acc, device) => {
    acc[device.id] = getDeviceSchedules(device.id);
    return acc;
  }, {} as Record<number, ScheduledPlaylist[]>);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            Loading schedules...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (devices.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Authorized Devices</CardTitle>
          <CardDescription>
            You need to authorize at least one display device before creating schedules.
            Visit the Displays page to authorize pending devices.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedules by Device</CardTitle>
        <CardDescription>
          View and manage schedules organized by display device
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="all">All Devices</TabsTrigger>
            {devices.map(device => {
              const deviceSchedules = groupedSchedules[device.id] || [];
              return (
                <TabsTrigger key={device.id} value={device.id.toString()}>
                  {device.device_name || `Device ${device.id}`}
                  {deviceSchedules.length > 0 && (
                    <span className="ml-1.5 text-xs bg-primary/20 px-1.5 py-0.5 rounded">
                      {deviceSchedules.length}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
          
          {/* All Devices Tab */}
          <TabsContent value="all" className="space-y-4">
            {schedules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No schedules configured yet.</p>
                <p className="text-sm mt-1">Create your first schedule to get started!</p>
              </div>
            ) : (
              devices.map(device => {
                const deviceSchedules = groupedSchedules[device.id] || [];
                if (deviceSchedules.length === 0) return null;
                
                return (
                  <div key={device.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">
                        {device.device_name || `Device ${device.id}`}
                      </h3>
                      <span className="text-sm text-muted-foreground">
                        {deviceSchedules.length} schedule{deviceSchedules.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {deviceSchedules.map(schedule => (
                        <ScheduleCard
                          key={schedule.id}
                          schedule={schedule}
                          onToggleEnabled={onToggleEnabled}
                          onDelete={onDelete}
                          onEdit={onEdit}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </TabsContent>
          
          {/* Individual Device Tabs */}
          {devices.map(device => {
            const deviceSchedules = groupedSchedules[device.id] || [];
            
            return (
              <TabsContent key={device.id} value={device.id.toString()} className="space-y-2">
                {deviceSchedules.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No schedules configured for this device</p>
                    <p className="text-sm mt-1">Create a schedule to control what plays and when</p>
                  </div>
                ) : (
                  deviceSchedules.map(schedule => (
                    <ScheduleCard
                      key={schedule.id}
                      schedule={schedule}
                      onToggleEnabled={onToggleEnabled}
                      onDelete={onDelete}
                      onEdit={onEdit}
                    />
                  ))
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ScheduleList;

