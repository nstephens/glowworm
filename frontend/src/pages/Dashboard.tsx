import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/Card';
import { Image, FolderOpen, List, HardDrive } from 'lucide-react';

export const Dashboard: React.FC = () => {
  // Mock data - will be replaced with real API calls
  const stats = {
    totalImages: 1247,
    totalAlbums: 23,
    totalPlaylists: 8,
    storageUsed: '2.4 GB',
  };

  const recentActivity = [
    { id: 1, action: 'Uploaded 5 new images', time: '2 hours ago' },
    { id: 2, action: 'Created album "Vacation 2024"', time: '1 day ago' },
    { id: 3, action: 'Updated playlist "Family Photos"', time: '2 days ago' },
    { id: 4, action: 'Authorized display device "Living Room TV"', time: '3 days ago' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome to your GlowWorm photo display system</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center">
            <div className="flex-shrink-0">
              <Image className="h-8 w-8 text-primary-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Images</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalImages.toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center">
            <div className="flex-shrink-0">
              <FolderOpen className="h-8 w-8 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Albums</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalAlbums}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center">
            <div className="flex-shrink-0">
              <List className="h-8 w-8 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Playlists</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalPlaylists}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center">
            <div className="flex-shrink-0">
              <HardDrive className="h-8 w-8 text-orange-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Storage Used</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.storageUsed}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="h-2 w-2 bg-primary-600 rounded-full mt-2"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{activity.action}</p>
                    <p className="text-sm text-gray-500">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <button className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                <div className="font-medium text-gray-900">Upload New Images</div>
                <div className="text-sm text-gray-500">Add photos to your collection</div>
              </button>
              <button className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                <div className="font-medium text-gray-900">Create New Album</div>
                <div className="text-sm text-gray-500">Organize your photos</div>
              </button>
              <button className="w-full text-left px-4 py-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                <div className="font-medium text-gray-900">Manage Displays</div>
                <div className="text-sm text-gray-500">Configure your display devices</div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
