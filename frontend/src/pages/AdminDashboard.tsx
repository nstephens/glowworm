import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Images, 
  Play, 
  Monitor, 
  Upload, 
  Plus, 
  TrendingUp, 
  Users, 
  Clock,
  BarChart3,
  Activity
} from 'lucide-react';
import { apiService } from '../services/api';
import type { Image, Album } from '../types';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalImages: 0,
    totalAlbums: 0,
    totalPlaylists: 0,
    totalDisplays: 0,
    recentUploads: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const [imagesResponse, albumsResponse, playlistsResponse, devicesResponse] = await Promise.all([
        apiService.getImages(),
        apiService.getAlbums(),
        apiService.getPlaylists(),
        apiService.getDevices()
      ]);

      const images = imagesResponse.data || [];
      const albums = albumsResponse.data || [];
      
      // Debug playlist response
      console.log('Playlists API Response:', playlistsResponse);
      console.log('Playlists Data:', playlistsResponse.data);
      
      const playlists = playlistsResponse.playlists || [];
      const devices = devicesResponse || [];
      
      // Calculate recent uploads (last 7 days)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentUploads = images.filter(img => 
        new Date(img.uploaded_at) > weekAgo
      ).length;

      // Count active displays (devices with status 'authorized')
      const activeDisplays = devices.filter(device => device.status === 'authorized').length;

      setStats({
        totalImages: images.length,
        totalAlbums: albums.length,
        totalPlaylists: playlists.length,
        totalDisplays: activeDisplays,
        recentUploads
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManagePlaylists = () => {
    navigate('/admin/playlists');
  };

  const handleManageDisplays = () => {
    navigate('/admin/displays');
  };

  const handleQuickUpload = () => {
    navigate('/admin/images?upload=true');
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl p-6 shadow-sm">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Welcome Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Glowworm</h1>
        <p className="text-gray-600">Manage your digital signage content and displays</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Images</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalImages}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <Images className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <TrendingUp className="w-4 h-4 mr-1" />
            <span>+{stats.recentUploads} this week</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Albums</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalAlbums}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <Activity className="w-4 h-4 mr-1" />
            <span>Organized collections</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Playlists</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalPlaylists}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Play className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <Clock className="w-4 h-4 mr-1" />
            <span>Scheduled content</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Displays</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalDisplays}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <Monitor className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-500">
            <Activity className="w-4 h-4 mr-1" />
            <span>Authorized & connected</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={handleQuickUpload}
            className="flex items-center space-x-3 p-4 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors group"
          >
            <Upload className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="font-medium">Upload Images</span>
          </button>
          
          <button
            onClick={handleManagePlaylists}
            className="flex items-center space-x-3 p-4 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors group"
          >
            <Plus className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="font-medium">Create Playlist</span>
          </button>
          
          <button
            onClick={handleManageDisplays}
            className="flex items-center space-x-3 p-4 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors group"
          >
            <Monitor className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="font-medium">Add Display</span>
          </button>
        </div>
      </div>

    </div>
  );
};

export default AdminDashboard;
