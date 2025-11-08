import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LayoutDashboard,
  Images,
  Play,
  Monitor,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Sparkles,
  FileText,
  Database,
  Users,
  User,
  Key,
  Wrench,
  RefreshCw,
  Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiService } from '@/services/api';

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  isMobile?: boolean;
  className?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  isCollapsed, 
  onToggle, 
  isMobile = false,
  className 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [counts, setCounts] = useState({
    images: 0,
    playlists: 0,
    displays: 0,
  });
  const [systemExpanded, setSystemExpanded] = useState(false);

  // Load counts for badges
  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [imagesResponse, playlistsResponse, devicesResponse] = await Promise.all([
          apiService.getImages(undefined, undefined, 1000).catch(() => ({ data: [] })),
          apiService.getPlaylists().catch(() => ({ data: [] })),
          apiService.getDevices().catch(() => []),
        ]);

        setCounts({
          images: imagesResponse.data?.length || 0,
          playlists: playlistsResponse.data?.length || 0,
          displays: Array.isArray(devicesResponse) ? devicesResponse.filter(d => d.status === 'authorized').length : 0,
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
      name: 'Scheduler',
      href: '/admin/scheduler',
      icon: Calendar,
      description: 'Schedule playlists for different times',
    },
  ];

  const systemNavigation = {
    name: 'System',
    icon: Settings,
    description: 'System configuration and logs',
    children: [
      {
        name: 'Logs',
        href: '/admin/logs',
        icon: FileText,
        description: 'View system logs and activity',
      },
      {
        name: 'Processing Queue',
        href: '/admin/processing-queue',
        icon: RefreshCw,
        description: 'Monitor image processing status',
      },
      {
        name: 'General',
        href: '/admin/system/general',
        icon: Wrench,
        description: 'General system settings',
      },
      {
        name: 'Users',
        href: '/admin/system/users',
        icon: Users,
        description: 'User management',
      },
      {
        name: 'Database',
        href: '/admin/system/database',
        icon: Database,
        description: 'Database configuration',
      },
      {
        name: 'Admin',
        href: '/admin/system/admin',
        icon: User,
        description: 'Admin user settings',
      },
      {
        name: 'OAuth',
        href: '/admin/system/oauth',
        icon: Key,
        description: 'OAuth configuration',
      },
      {
        name: 'Display Sizes',
        href: '/admin/system/displays',
        icon: Monitor,
        description: 'Display resolution settings',
      },
      {
        name: 'Utilities',
        href: '/admin/system/utilities',
        icon: Wrench,
        description: 'System utilities and tools',
      },
    ],
  };

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path) || location.pathname + location.hash === path;
  };

  const handleNavigation = (href: string) => {
    navigate(href);
    // Close mobile sidebar after navigation
    if (isMobile) {
      onToggle();
    }
  };
  
  // Auto-expand System if on system pages or logs
  useEffect(() => {
    if (location.pathname.startsWith('/admin/system') || location.pathname === '/admin/logs') {
      setSystemExpanded(true);
    }
  }, [location.pathname]);

  return (
    <aside 
      className={cn(
        "bg-sidebar border-r border-sidebar-border transition-all duration-300 z-50",
        isMobile 
          ? "fixed inset-y-0 left-0 w-64" 
          : isCollapsed 
            ? "w-16" 
            : "w-64",
        className
      )}
      role="complementary"
      aria-label="Main navigation"
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <header className="p-6 border-b border-sidebar-border" role="banner">
          <div className="flex items-center justify-between">
            {(!isCollapsed || isMobile) && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center" aria-hidden="true">
                  <Sparkles className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h2 className="font-bold text-sidebar-foreground">GlowWorm</h2>
                  <p className="text-xs text-muted-foreground">Gallery</p>
                </div>
              </div>
            )}
            {!isMobile && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggle}
                className="h-8 w-8 p-0 hover:bg-sidebar-accent"
                aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!isCollapsed}
              >
                {isCollapsed ? (
                  <ChevronRight className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                )}
              </Button>
            )}
          </div>
        </header>

        {/* Navigation */}
        <nav 
          className="flex-1 p-4 space-y-2"
          role="navigation"
          aria-label="Main navigation"
        >
          {/* Regular navigation items */}
          {navigation.map((item) => {
            const active = isActive(item.href);
            return (
              <Button
                key={item.name}
                variant={active ? 'default' : 'ghost'}
                className={cn(
                  'w-full justify-start h-11 transition-all duration-200 group',
                  isCollapsed && !isMobile ? 'px-3' : 'px-4',
                  active
                    ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg'
                    : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                )}
                onClick={() => handleNavigation(item.href)}
                title={isCollapsed && !isMobile ? item.description : undefined}
                aria-label={item.description}
                aria-current={active ? 'page' : undefined}
                role="link"
              >
                <item.icon 
                  className={cn(
                    'w-5 h-5 flex-shrink-0',
                    isCollapsed && !isMobile ? '' : 'mr-3'
                  )}
                  aria-hidden="true"
                />
                {(!isCollapsed || isMobile) && (
                  <>
                    <span className="flex-1 text-left truncate">{item.name}</span>
                    {item.badge && (
                      <Badge 
                        variant={active ? 'secondary' : 'outline'} 
                        className="ml-auto text-xs flex-shrink-0"
                        aria-label={`${item.badge} ${item.name}`}
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </>
                )}
              </Button>
            );
          })}
          
          {/* System Accordion */}
          <div className="space-y-1">
            <Button
              variant={location.pathname.startsWith('/admin/system') || location.pathname === '/admin/logs' ? 'default' : 'ghost'}
              className={cn(
                'w-full justify-start h-11 transition-all duration-200 group',
                isCollapsed && !isMobile ? 'px-3' : 'px-4',
                location.pathname.startsWith('/admin/system') || location.pathname === '/admin/logs'
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-lg'
                  : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
              onClick={() => {
                if (isCollapsed && !isMobile) {
                  // If collapsed, go to general system settings
                  handleNavigation('/admin/system/general');
                } else {
                  // If expanded, toggle accordion
                  setSystemExpanded(!systemExpanded);
                }
              }}
              title={isCollapsed && !isMobile ? systemNavigation.description : undefined}
              aria-label={systemNavigation.description}
              aria-expanded={systemExpanded}
            >
              <systemNavigation.icon 
                className={cn(
                  'w-5 h-5 flex-shrink-0',
                  isCollapsed && !isMobile ? '' : 'mr-3'
                )}
                aria-hidden="true"
              />
              {(!isCollapsed || isMobile) && (
                <>
                  <span className="flex-1 text-left truncate">{systemNavigation.name}</span>
                  <ChevronDown 
                    className={cn(
                      'w-4 h-4 flex-shrink-0 transition-transform duration-200',
                      systemExpanded && 'transform rotate-180'
                    )}
                    aria-hidden="true"
                  />
                </>
              )}
            </Button>
            
            {/* System sub-items */}
            {systemExpanded && (!isCollapsed || isMobile) && (
              <div className="ml-4 space-y-1 animate-in slide-in-from-top-2 duration-200">
                {systemNavigation.children.map((child) => {
                  const active = isActive(child.href);
                  return (
                    <Button
                      key={child.name}
                      variant="ghost"
                      className={cn(
                        'w-full justify-start h-9 text-sm transition-all duration-200',
                        'px-3',
                        active
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                      )}
                      onClick={() => handleNavigation(child.href)}
                      aria-label={child.description}
                      aria-current={active ? 'page' : undefined}
                      role="link"
                    >
                      <child.icon 
                        className="w-4 h-4 flex-shrink-0 mr-3"
                        aria-hidden="true"
                      />
                      <span className="flex-1 text-left truncate">{child.name}</span>
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        </nav>
      </div>
    </aside>
  );
};
