import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  Images, 
  FolderOpen,
  Play, 
  Monitor, 
  Upload, 
  Plus, 
  Settings,
  TrendingUp, 
  Clock,
  Zap
} from 'lucide-react';
import { apiService } from '../services/api';
import LiveDisplayStatus from '../components/LiveDisplayStatus';
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
        apiService.getImages(undefined, undefined, 1000),
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
      <div className="space-y-8">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-muted rounded w-3/4"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const statsData = [
    {
      title: 'Total Images',
      value: stats.totalImages.toString(),
      change: `+${stats.recentUploads} this week`,
      icon: Images,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Albums',
      value: stats.totalAlbums.toString(),
      change: 'Organized collections',
      icon: FolderOpen,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
    },
    {
      title: 'Playlists',
      value: stats.totalPlaylists.toString(),
      change: 'Scheduled content',
      icon: Play,
      color: 'text-secondary',
      bgColor: 'bg-secondary/10',
    },
    {
      title: 'Active Displays',
      value: stats.totalDisplays.toString(),
      change: 'Connected devices',
      icon: Monitor,
      color: 'text-success',
      bgColor: 'bg-success/10',
    },
  ];

  const quickActions = [
    {
      title: 'Upload Images',
      description: 'Add new photos to your library',
      icon: Upload,
      color: 'bg-primary',
      href: '/admin/images',
      onClick: handleQuickUpload,
    },
    {
      title: 'Create Playlist',
      description: 'Organize images for display',
      icon: Plus,
      color: 'bg-secondary',
      href: '/admin/playlists',
      onClick: handleManagePlaylists,
    },
    {
      title: 'Manage Displays',
      description: 'Configure display devices',
      icon: Settings,
      color: 'bg-accent',
      href: '/admin/displays',
      onClick: handleManageDisplays,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in-up">
        {statsData.map((stat, index) => (
          <Card key={stat.title} className="gallery-item border-0 shadow-lg bg-card/50 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-xl ${stat.bgColor}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <Badge variant="secondary" className="text-xs">
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {stat.change}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-2 mb-6">
          <Zap className="w-5 h-5 text-accent" />
          <h2 className="text-xl font-semibold">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickActions.map((action) => (
            <Card
              key={action.title}
              className="gallery-item border-0 shadow-lg bg-card/50 backdrop-blur-sm cursor-pointer group"
              onClick={action.onClick}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div
                    className={`p-3 rounded-xl ${action.color} group-hover:scale-110 transition-transform duration-200`}
                  >
                    <action.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{action.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{action.description}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-primary hover:text-primary-foreground hover:bg-primary"
                    >
                      Get Started →
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Live Display Status */}
      <LiveDisplayStatus />
    </div>
  );
};

export default AdminDashboard;
