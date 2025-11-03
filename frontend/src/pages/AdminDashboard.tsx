import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { 
  Images, 
  FolderOpen,
  Play, 
  Monitor, 
  Upload, 
  Plus, 
  Settings,
  Clock,
  Zap,
  X
} from 'lucide-react';
import { apiService } from '../services/api';
import LiveDisplayStatus from '../components/LiveDisplayStatus';
import ImageUpload from '../components/ImageUpload';
import type { Image, Album } from '../types';
import { useToast } from '../hooks/use-toast';
import { Dashboard } from '../components/dashboard/Dashboard';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState({
    totalImages: 0,
    totalAlbums: 0,
    totalPlaylists: 0,
    totalDisplays: 0,
    recentUploads: 0
  });
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);

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

  const handleCreatePlaylist = () => {
    setShowCreatePlaylistModal(true);
  };

  const handleManageDisplays = () => {
    navigate('/admin/displays');
  };

  const handleQuickUpload = () => {
    setShowUploadModal(true);
  };

  const handleCreatePlaylistSubmit = async () => {
    if (!newPlaylistName.trim()) return;

    try {
      setIsCreatingPlaylist(true);
      await apiService.createPlaylist(newPlaylistName.trim());
      setNewPlaylistName('');
      setShowCreatePlaylistModal(false);
      // Refresh stats to show updated playlist count
      loadStats();
      
      // Show success toast
      toast({
        title: "Playlist Created",
        description: `"${newPlaylistName.trim()}" has been created successfully.`,
        variant: "success",
      });
    } catch (error) {
      console.error('Failed to create playlist:', error);
      
      // Show error toast
      toast({
        title: "Failed to Create Playlist",
        description: "There was an error creating the playlist. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreatingPlaylist(false);
    }
  };

  const handleUploadComplete = (newImages: Image[]) => {
    setShowUploadModal(false);
    // Refresh stats to show updated image count
    loadStats();
    
    // Show success toast
    toast({
      title: "Images Uploaded",
      description: `${newImages.length} image${newImages.length === 1 ? '' : 's'} uploaded successfully.`,
      variant: "success",
    });
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
      onClick: handleQuickUpload,
    },
    {
      title: 'Create Playlist',
      description: 'Organize images for display',
      icon: Plus,
      color: 'bg-secondary',
      onClick: handleCreatePlaylist,
    },
    {
      title: 'Manage Displays',
      description: 'Configure display devices',
      icon: Settings,
      color: 'bg-accent',
      onClick: handleManageDisplays,
    },
  ];

  // Convert stats to Dashboard component format
  const dashboardData = {
    stats: {
      totalFiles: stats.totalImages,
      totalStorage: 2.4 * 1024 * 1024 * 1024, // Mock storage data
      totalUsers: stats.totalDisplays,
      totalDownloads: stats.recentUploads,
      uploadsToday: Math.floor(stats.recentUploads / 7),
      downloadsToday: Math.floor(stats.recentUploads / 7),
    },
    storage: {
      used: 1.8 * 1024 * 1024 * 1024,
      total: 5 * 1024 * 1024 * 1024,
      breakdown: {
        images: 1.2 * 1024 * 1024 * 1024,
        videos: 0.4 * 1024 * 1024 * 1024,
        documents: 0.15 * 1024 * 1024 * 1024,
        other: 0.05 * 1024 * 1024 * 1024,
      },
    },
    trends: {
      uploads: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        values: [12, 19, 8, 15, 22, 18, 14],
        trend: 'up' as const,
      },
      downloads: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        values: [8, 15, 12, 18, 25, 20, 16],
        trend: 'up' as const,
      },
    },
    activities: [
      {
        id: '1',
        type: 'upload' as const,
        title: 'New photos uploaded',
        description: `${stats.recentUploads} photos added recently`,
        timestamp: new Date(Date.now() - 1000 * 60 * 30),
        user: 'Admin',
        metadata: {
          fileSize: '2.4 MB',
          fileType: 'image/jpeg',
          albumName: 'Recent Uploads',
          tags: ['recent', 'upload'],
        },
      },
    ],
    recommendations: [
      // Remove storage upgrade recommendation
    ],
  };

  return (
    <div className="space-y-8">
      {/* Use the new mobile-optimized Dashboard component */}
      <Dashboard 
        data={dashboardData} 
        loading={loading}
        className="animate-fade-in-up"
      />

      {/* Live Display Status */}
      <LiveDisplayStatus />

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto mx-4 border-0 shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Upload Images</CardTitle>
                  <CardDescription>Add new photos to your library</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowUploadModal(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <ImageUpload
                onUploadComplete={handleUploadComplete}
                albums={[]}
                onCreateAlbum={async () => {}}
              />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create Playlist Modal */}
      {showCreatePlaylistModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4 border-0 shadow-2xl">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl">Create Playlist</CardTitle>
                  <CardDescription>Create a new playlist to organize your content</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowCreatePlaylistModal(false);
                    setNewPlaylistName('');
                  }}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="playlist-name">Playlist Name</Label>
                <Input
                  id="playlist-name"
                  placeholder="Enter playlist name..."
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreatePlaylistSubmit();
                    }
                    if (e.key === 'Escape') {
                      setShowCreatePlaylistModal(false);
                      setNewPlaylistName('');
                    }
                  }}
                  autoFocus
                  className="bg-background/50 border-border/50"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreatePlaylistModal(false);
                    setNewPlaylistName('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreatePlaylistSubmit}
                  disabled={!newPlaylistName.trim() || isCreatingPlaylist}
                  className="shadow-lg"
                >
                  {isCreatingPlaylist ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Playlist
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
