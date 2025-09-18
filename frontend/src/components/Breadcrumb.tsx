import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  path: string;
  current?: boolean;
}

export const Breadcrumb: React.FC = () => {
  const location = useLocation();
  
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const pathnames = location.pathname.split('/').filter(x => x);
    const breadcrumbs: BreadcrumbItem[] = [];
    
    // Always start with home/dashboard
    breadcrumbs.push({
      label: 'Dashboard',
      path: '/admin'
    });
    
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
        default:
          // Capitalize first letter and replace hyphens with spaces
          label = pathname.charAt(0).toUpperCase() + pathname.slice(1).replace(/-/g, ' ');
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
  
  // Don't show breadcrumbs on the main dashboard
  if (location.pathname === '/admin') {
    return null;
  }
  
  return (
    <nav className="flex items-center space-x-2 text-sm text-gray-500 mb-4">
      <Home className="w-4 h-4" />
      {breadcrumbs.map((breadcrumb, index) => (
        <React.Fragment key={breadcrumb.path}>
          {index > 0 && <ChevronRight className="w-4 h-4" />}
          {breadcrumb.current ? (
            <span className="text-gray-900 font-medium">
              {breadcrumb.label}
            </span>
          ) : (
            <Link
              to={breadcrumb.path}
              className="hover:text-gray-700 transition-colors"
            >
              {breadcrumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default Breadcrumb;

