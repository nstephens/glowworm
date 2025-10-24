import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Images, 
  Play, 
  Monitor, 
  Settings 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { apiService } from '@/services/api';

interface MobileBottomNavProps {
  className?: string;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ className }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [counts, setCounts] = useState({
    images: 0,
    playlists: 0,
    displays: 0,
  });

  // Load counts for badges
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [imagesResponse, playlistsResponse, devicesResponse] = await Promise.all([
          apiService.getImages(undefined, undefined, 1000).catch(() => ({ data: [] })),
          apiService.getPlaylists().catch(() => ({ playlists: [] })),
          apiService.getDevices().catch(() => []),
        ]);

        setCounts({
          images: imagesResponse.data?.length || 0,
          playlists: playlistsResponse.playlists?.length || playlistsResponse.count || 0,
          displays: Array.isArray(devicesResponse) ? devicesResponse.filter(d => d.status === 'authorized').length : 0,
        });
      } catch (error) {
        console.log('Could not load mobile nav counts:', error);
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
      description: 'Overview and quick actions',
    },
    {
      name: 'Images',
      href: '/admin/images',
      icon: Images,
      description: 'Upload and manage images',
      badge: counts.images > 0 ? counts.images.toString() : undefined,
    },
    {
      name: 'Playlists',
      href: '/admin/playlists',
      icon: Play,
      description: 'Create and manage playlists',
      badge: counts.playlists > 0 ? counts.playlists.toString() : undefined,
    },
    {
      name: 'Displays',
      href: '/admin/displays',
      icon: Monitor,
      description: 'Manage display devices',
      badge: counts.displays > 0 ? counts.displays.toString() : undefined,
    },
    {
      name: 'Settings',
      href: '/admin/settings',
      icon: Settings,
      description: 'Configure system settings',
    },
  ];

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  const handleNavigation = (href: string) => {
    navigate(href);
  };

  return (
    <nav 
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
        "border-t border-border shadow-lg",
        "flex items-center justify-around px-1 py-2",
        "lg:hidden", // Only show on mobile
        "safe-area-pb", // Safe area padding for devices with home indicators
        className
      )}
      role="navigation"
      aria-label="Main navigation"
    >
      {navigation.map((item) => {
        const active = isActive(item.href);
        return (
          <Button
            key={item.name}
            variant="ghost"
            className={cn(
              "flex flex-col items-center gap-1 h-16 w-full rounded-lg",
              "hover:bg-accent/50 active:bg-accent/70 transition-all duration-200",
              "touch-manipulation", // Optimize for touch
              active && "bg-accent text-accent-foreground shadow-sm"
            )}
            onClick={() => handleNavigation(item.href)}
            aria-label={`${item.name}${item.description ? ` - ${item.description}` : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <div className="relative">
              <item.icon className={cn(
                "h-5 w-5 transition-colors duration-200",
                active ? "text-accent-foreground" : "text-muted-foreground"
              )} />
              {item.badge && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 h-4 w-4 rounded-full p-0 flex items-center justify-center text-xs"
                >
                  {item.badge}
                </Badge>
              )}
            </div>
            <span className={cn(
              "text-xs font-medium transition-colors duration-200",
              "truncate max-w-[60px]", // Prevent text overflow
              active ? "text-accent-foreground" : "text-muted-foreground"
            )}>
              {item.name}
            </span>
          </Button>
        );
      })}
    </nav>
  );
};
