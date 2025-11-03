import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiService } from '../../services/api';

interface BreadcrumbItem {
  label: string;
  path: string;
  current?: boolean;
}

interface BreadcrumbProps {
  className?: string;
  showHome?: boolean;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({ 
  className,
  showHome = true 
}) => {
  const location = useLocation();
  const [playlistName, setPlaylistName] = useState<string | null>(null);
  
  // Fetch playlist name if we're on a playlist detail page
  useEffect(() => {
    const pathParts = location.pathname.split('/');
    const playlistIndex = pathParts.indexOf('playlists');
    
    if (playlistIndex !== -1 && pathParts[playlistIndex + 1]) {
      const playlistIdOrSlug = pathParts[playlistIndex + 1];
      
      // Check if it's a numeric ID or a slug
      if (isNaN(Number(playlistIdOrSlug))) {
        // It's a slug, we can use it directly
        setPlaylistName(playlistIdOrSlug.replace(/-/g, ' '));
      } else {
        // It's a numeric ID, fetch the playlist name
        const fetchPlaylistName = async () => {
          try {
            const response = await apiService.getPlaylist(Number(playlistIdOrSlug));
            setPlaylistName(response.data.name);
          } catch (error) {
            console.warn('Failed to fetch playlist name:', error);
            setPlaylistName(`Playlist ${playlistIdOrSlug}`);
          }
        };
        fetchPlaylistName();
      }
    } else {
      setPlaylistName(null);
    }
  }, [location.pathname]);
  
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const pathnames = location.pathname.split('/').filter(x => x);
    const breadcrumbs: BreadcrumbItem[] = [];
    
    // Always start with home/dashboard
    if (showHome) {
      breadcrumbs.push({
        label: 'Dashboard',
        path: '/admin'
      });
    }
    
    let currentPath = '';
    pathnames.forEach((pathname, index) => {
      currentPath += `/${pathname}`;
      
      // Skip the 'admin' part as it's already covered by Dashboard
      if (pathname === 'admin') return;
      
      const isLast = index === pathnames.length - 1;
      let label = pathname;
      
      // Convert pathname to readable label
      switch (pathname) {
        case 'images':
          label = 'Images';
          break;
        case 'playlists':
          label = 'Playlists';
          break;
        case 'displays':
          label = 'Displays';
          break;
        case 'settings':
          label = 'Settings';
          break;
        case 'search':
          label = 'Search';
          break;
        default:
          // Special handling for playlist detail pages
          if (pathname === 'playlists' && pathnames[index + 1]) {
            // This is a playlist detail page, use the playlist name if available
            if (playlistName) {
              label = playlistName;
            } else {
              // Fallback to the ID or slug
              const nextPath = pathnames[index + 1];
              if (isNaN(Number(nextPath))) {
                label = nextPath.replace(/-/g, ' ');
              } else {
                label = `Playlist ${nextPath}`;
              }
            }
          } else {
            // Capitalize first letter and replace hyphens with spaces
            label = pathname.charAt(0).toUpperCase() + pathname.slice(1).replace(/-/g, ' ');
          }
      }
      
      breadcrumbs.push({
        label,
        path: currentPath,
        current: isLast
      });
    });
    
    return breadcrumbs;
  };
  
  const breadcrumbs = generateBreadcrumbs();
  
  // Don't show breadcrumbs on the main dashboard or if no breadcrumbs
  if (location.pathname === '/admin' || breadcrumbs.length === 0) {
    return null;
  }
  
  return (
    <nav 
      className={cn(
        "flex items-center space-x-2 text-sm text-muted-foreground",
        className
      )}
      aria-label="Breadcrumb"
    >
      {showHome && (
        <>
          <Home className="w-4 h-4" />
          <ChevronRight className="w-4 h-4" />
        </>
      )}
      {breadcrumbs.map((breadcrumb, index) => (
        <React.Fragment key={breadcrumb.path}>
          {index > 0 && <ChevronRight className="w-4 h-4" />}
          {breadcrumb.current ? (
            <span className="text-foreground font-medium">
              {breadcrumb.label}
            </span>
          ) : (
            <Link
              to={breadcrumb.path}
              className="hover:text-foreground transition-colors duration-200"
            >
              {breadcrumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};
