import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import { hapticPatterns } from '@/utils/hapticFeedback';
import { useSwipeGestures } from '@/hooks/useSwipeGestures';
import { useThumbNavigation } from '@/utils/thumbNavigation';
import { useArrowNavigation } from '@/hooks/useFocusManagement';

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
  const [mounted, setMounted] = useState(false);

  // Thumb navigation optimization
  const { spacing, safeArea, layoutClasses } = useThumbNavigation(false, true);

  // Navigation container ref for arrow key navigation
  const navRef = useRef<HTMLElement>(null);

  // Enable arrow key navigation (left/right)
  useArrowNavigation(navRef, {
    direction: 'horizontal',
    loop: true,
    itemSelector: 'button[role="tab"]',
  });

  // Enhanced haptic feedback function using the new system
  const triggerHapticFeedback = (type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light') => {
    const hapticMap = {
      light: () => hapticPatterns.buttonPress(),
      medium: () => hapticPatterns.buttonLongPress(),
      heavy: () => hapticPatterns.impact(),
      success: () => hapticPatterns.success(),
      error: () => hapticPatterns.error()
    };
    
    hapticMap[type]();
  };

  // Mark as mounted for SSR safety
  useEffect(() => {
    setMounted(true);
  }, []);

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
    // Trigger light haptic feedback for navigation
    triggerHapticFeedback('light');
    
    // Add a small delay for visual feedback before navigation
    setTimeout(() => {
      navigate(href);
    }, 100);
  };

  // Swipe gesture support for navigation
  const { gestureProps } = useSwipeGestures({
    onSwipeLeft: () => {
      const currentIndex = navigation.findIndex(item => isActive(item.href));
      if (currentIndex < navigation.length - 1) {
        handleNavigation(navigation[currentIndex + 1].href);
      }
    },
    onSwipeRight: () => {
      const currentIndex = navigation.findIndex(item => isActive(item.href));
      if (currentIndex > 0) {
        handleNavigation(navigation[currentIndex - 1].href);
      }
    },
    enableHaptic: true,
    hapticType: 'swipe',
    threshold: 50,
    velocity: 0.3
  });

  // Reserve space for bottom nav to avoid content being hidden beneath it
  useEffect(() => {
    const prevPadding = document.body.style.paddingBottom;
    document.body.style.paddingBottom = `calc(64px + env(safe-area-inset-bottom, 0px) + constant(safe-area-inset-bottom, 0px))`;
    return () => { document.body.style.paddingBottom = prevPadding; };
  }, []);

  // Adjust for iOS Safari dynamic toolbar using VisualViewport
  useEffect(() => {
    const el = navRef.current;
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!el || !vv) return;

    const update = () => {
      // Amount the visual viewport intrudes into the layout viewport bottom
      const offset = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
      // Pull the bar up by the offset so it stays in view
      el.style.transform = `translate3d(0, ${-offset}px, 0)`;
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  const navEl = (
    <nav 
      ref={navRef}
      {...gestureProps}
      className={cn(
        "mobile-bottom-nav",
        "bg-background supports-[backdrop-filter]:bg-background",
        "border-t border-border shadow-lg",
        "flex items-center justify-around px-1 py-2",
        "lg:hidden", // Only show on mobile
        "safe-area-pb", // Safe area padding for devices with home indicators
        // Ensure highest stacking on all routes and stick to viewport edges
        "fixed left-0 right-0 z-[2147483647]", 
        // Use bottom safe-area inset to keep bar pinned above Safari toolbars
        // Height includes safe area to avoid overlap with home indicator
        "h-16",
        layoutClasses.navigation, // Thumb-optimized navigation
        className
      )}
      role="tablist"
      aria-label="Main navigation"
      aria-orientation="horizontal"
      style={{
        position: 'fixed',
        bottom: 0,
        paddingBottom: `calc(${safeArea.bottom}px + env(safe-area-inset-bottom, 0px) + constant(safe-area-inset-bottom, 0px))`,
        // Compensate height with safe area so content doesn't overlap (support both env() and constant())
        height: `calc(64px + env(safe-area-inset-bottom, 0px) + constant(safe-area-inset-bottom, 0px))`,
        gap: `${spacing.recommendedSpacing}px`,
        zIndex: 2147483647
      }}
    >
      {navigation.map((item) => {
        const active = isActive(item.href);
        return (
          <Button
            key={item.name}
            variant="ghost"
            animated={false}
            className={cn(
              "flex flex-col items-center gap-1 h-16 w-full rounded-lg",
              "hover:bg-accent/50 active:bg-accent/70 transition-all duration-300 ease-in-out",
              "touch-manipulation", // Optimize for touch
              "min-h-[44px] min-w-[44px]", // Ensure minimum touch target size
              "active:scale-95", // Visual feedback on press
              "relative overflow-hidden", // For ripple effect
              "select-none", // Prevent text selection on touch
              active && "bg-accent text-accent-foreground shadow-lg scale-105"
            )}
            onClick={() => handleNavigation(item.href)}
            aria-label={`${item.name}${item.description ? ` - ${item.description}` : ''}`}
            aria-current={active ? 'page' : undefined}
            role="tab"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleNavigation(item.href);
              }
            }}
          >
            {/* Active state background indicator */}
            {active && (
              <div className="absolute inset-0 bg-gradient-to-t from-accent/20 to-transparent rounded-lg" />
            )}
            
            <div className="relative z-10">
              <item.icon className={cn(
                "h-5 w-5 transition-all duration-300 ease-in-out",
                active ? "text-accent-foreground scale-110" : "text-muted-foreground scale-100"
              )} />
              {item.badge && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 h-4 w-4 rounded-full p-0 flex items-center justify-center text-xs animate-pulse"
                >
                  {item.badge}
                </Badge>
              )}
            </div>
            <span className={cn(
              "text-xs font-medium transition-all duration-300 ease-in-out relative z-10",
              "truncate max-w-[60px]", // Prevent text overflow
              active ? "text-accent-foreground font-semibold" : "text-muted-foreground font-normal"
            )}>
              {item.name}
            </span>
          </Button>
        );
      })}
    </nav>
  );

  // Don't render portal on server side (SSR safety)
  if (!mounted || typeof document === 'undefined') {
    return null;
  }

  // Render via portal to escape any transformed ancestors that can break fixed on iOS
  return createPortal(navEl, document.body);
};
