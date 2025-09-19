import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import Breadcrumb from './Breadcrumb';

const navigationItems = [
  { path: '/admin', label: 'Dashboard', description: 'Overview and quick actions' },
  { path: '/admin/images', label: 'Images', description: 'Upload and manage images' },
  { path: '/admin/playlists', label: 'Playlists', description: 'Create and manage playlists' },
  { path: '/admin/displays', label: 'Displays', description: 'Manage display devices' },
  { path: '/admin/settings', label: 'Settings', description: 'System configuration' }
];

interface NavigationProps {
  children: React.ReactNode;
  headerContent?: React.ReactNode;
}

export const Navigation: React.FC<NavigationProps> = ({ children, headerContent }) => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/admin') {
      return location.pathname === '/admin';
    }
    return location.pathname.startsWith(path);
  };

  const getPageTitle = () => {
    const currentItem = navigationItems.find(item => isActive(item.path));
    return currentItem?.label || 'Admin';
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <main className="flex-1 p-8 ml-64">
        <div className="max-w-7xl mx-auto">
          {/* Mobile menu button */}
          <div className="lg:hidden mb-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* Header content or page title */}
          {headerContent ? (
            <div className="mb-8">
              {headerContent}
            </div>
          ) : (
            <div className="mb-8 animate-fade-in-up">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-2 h-8 bg-gradient-to-b from-primary to-accent rounded-full" />
                <h1 className="text-3xl font-bold text-balance">{getPageTitle()}</h1>
              </div>
              <p className="text-muted-foreground text-lg">
                {navigationItems.find(item => isActive(item.path))?.description}
              </p>
            </div>
          )}

          {/* Breadcrumb */}
          <div className="mb-6">
            <Breadcrumb />
          </div>

          {/* Page content */}
          <div className="animate-fade-in-up">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Navigation;
