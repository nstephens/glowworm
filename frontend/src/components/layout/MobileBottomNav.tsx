import React from 'react';
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

interface MobileBottomNavProps {
  className?: string;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ className }) => {
  const navigate = useNavigate();
  const location = useLocation();

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
    },
    {
      name: 'Playlists',
      href: '/admin/playlists',
      icon: Play,
    },
    {
      name: 'Displays',
      href: '/admin/displays',
      icon: Monitor,
    },
    {
      name: 'Settings',
      href: '/admin/settings',
      icon: Settings,
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
    <nav className={cn(
      "fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border",
      "flex items-center justify-around px-2 py-1",
      "lg:hidden", // Only show on mobile
      className
    )}>
      {navigation.map((item) => {
        const active = isActive(item.href);
        return (
          <Button
            key={item.name}
            variant="ghost"
            className={cn(
              "flex flex-col items-center gap-1 h-16 w-full rounded-none",
              "hover:bg-accent/50 transition-colors duration-200",
              active && "bg-accent text-accent-foreground"
            )}
            onClick={() => handleNavigation(item.href)}
            aria-label={item.name}
          >
            <item.icon className={cn(
              "h-5 w-5",
              active ? "text-accent-foreground" : "text-muted-foreground"
            )} />
            <span className={cn(
              "text-xs font-medium",
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
