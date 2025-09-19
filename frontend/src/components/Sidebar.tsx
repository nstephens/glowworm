import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  Camera,
  LayoutDashboard,
  Images,
  Play,
  Monitor,
  Settings,
  LogOut,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { apiService } from '../services/api';

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [counts, setCounts] = useState({
    images: 0,
    playlists: 0,
    displays: 0,
  });
  const navigate = useNavigate();
  const location = useLocation();

  // Load counts for badges
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [imagesResponse, playlistsResponse, devicesResponse] = await Promise.all([
          apiService.getImages().catch(() => ({ data: [] })),
          apiService.getPlaylists().catch(() => ({ playlists: [] })),
          apiService.getDevices().catch(() => []),
        ]);

        console.log('Sidebar API Responses:', {
          imagesResponse,
          playlistsResponse,
          devicesResponse
        });

        const imageCount = imagesResponse.data?.length || 0;
        const playlistCount = playlistsResponse.playlists?.length || playlistsResponse.count || 0;
        const displayCount = Array.isArray(devicesResponse) ? devicesResponse.filter(d => d.status === 'authorized').length : 0;

        console.log('Sidebar Counts:', { imageCount, playlistCount, displayCount });

        setCounts({
          images: imageCount,
          playlists: playlistCount,
          displays: displayCount,
        });
      } catch (error) {
        console.log('Could not load sidebar counts:', error);
      }
    };

    loadCounts();
    
    // Refresh counts every 30 seconds
    const interval = setInterval(loadCounts, 30000);
    return () => clearInterval(interval);
  }, []);

  const navigation = [
    {
      name: 'Dashboard',
      href: '/admin',
      icon: LayoutDashboard,
    },
    {
      name: 'Images',
      href: '/admin/images',
      icon: Images,
      badge: counts.images > 0 ? counts.images.toString() : undefined,
    },
    {
      name: 'Playlists',
      href: '/admin/playlists',
      icon: Play,
      badge: counts.playlists > 0 ? counts.playlists.toString() : undefined,
    },
    {
      name: 'Displays',
      href: '/admin/displays',
      icon: Monitor,
      badge: counts.displays > 0 ? counts.displays.toString() : undefined,
    },
    {
      name: 'Settings',
      href: '/admin/settings',
      icon: Settings,
    },
  ];

  const handleLogout = async () => {
    try {
      // Import apiService dynamically to avoid circular dependencies
      const { apiService } = await import('../services/api');
      await apiService.logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      navigate('/login');
    }
  };

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div
      className={cn(
        'fixed left-0 top-0 h-full bg-sidebar border-r border-sidebar-border transition-all duration-300 z-50',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            {!collapsed && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Camera className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="font-bold text-sidebar-foreground">Glowworm</h2>
                  <div className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-accent" />
                    <span className="text-xs text-muted-foreground">Gallery</span>
                  </div>
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCollapsed(!collapsed)}
              className="h-8 w-8 p-0 hover:bg-sidebar-accent"
            >
              {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navigation.map((item) => {
            const active = isActive(item.href);
            return (
              <Button
                key={item.name}
                variant={active ? 'default' : 'ghost'}
                className={cn(
                  'w-full justify-start h-11 transition-all duration-200',
                  collapsed ? 'px-3' : 'px-4',
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg'
                    : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
                onClick={() => navigate(item.href)}
              >
                <item.icon className={cn('w-5 h-5', collapsed ? '' : 'mr-3')} />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left">{item.name}</span>
                    {item.badge && (
                      <Badge variant={active ? 'secondary' : 'outline'} className="ml-auto text-xs">
                        {item.badge}
                      </Badge>
                    )}
                  </>
                )}
              </Button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border">
          <Button
            variant="ghost"
            className={cn(
              'w-full justify-start h-11 text-muted-foreground hover:text-destructive hover:bg-destructive/10',
              collapsed ? 'px-3' : 'px-4'
            )}
            onClick={handleLogout}
          >
            <LogOut className={cn('w-5 h-5', collapsed ? '' : 'mr-3')} />
            {!collapsed && <span>Logout</span>}
          </Button>
        </div>
      </div>
    </div>
  );
}
