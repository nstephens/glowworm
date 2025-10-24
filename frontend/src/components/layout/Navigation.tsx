import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { Breadcrumb } from './Breadcrumb';
import { MobileBottomNav } from './MobileBottomNav';
import { cn } from '@/lib/utils';

interface NavigationProps {
  children: React.ReactNode;
  headerContent?: React.ReactNode;
  className?: string;
}

export const Navigation: React.FC<NavigationProps> = ({ 
  children, 
  headerContent,
  className 
}) => {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Handle responsive behavior
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (mobileMenuOpen && isMobile) {
        const target = event.target as HTMLElement;
        if (!target.closest('[data-mobile-menu]') && !target.closest('[data-mobile-trigger]')) {
          setMobileMenuOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen, isMobile]);

  const handleSidebarToggle = () => {
    if (isMobile) {
      setMobileMenuOpen(!mobileMenuOpen);
    } else {
      setSidebarCollapsed(!sidebarCollapsed);
    }
  };

  const getPageTitle = () => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1];
    
    if (!lastSegment || lastSegment === 'admin') {
      return 'Dashboard';
    }
    
    return lastSegment.charAt(0).toUpperCase() + lastSegment.slice(1);
  };

  const getPageDescription = () => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const lastSegment = pathSegments[pathSegments.length - 1];
    
    switch (lastSegment) {
      case 'images':
        return 'Upload and manage your image collection';
      case 'playlists':
        return 'Create and organize your playlists';
      case 'displays':
        return 'Manage your display devices';
      case 'settings':
        return 'Configure system settings and preferences';
      default:
        return 'Overview and quick actions';
    }
  };

  return (
    <div className={cn("flex min-h-screen bg-background", className)}>
      {/* Desktop Sidebar */}
      {!isMobile && (
        <Sidebar
          isCollapsed={sidebarCollapsed}
          onToggle={handleSidebarToggle}
          isMobile={false}
        />
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobile && mobileMenuOpen && (
        <div className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden" />
      )}

      {/* Mobile Sidebar */}
      {isMobile && (
        <div
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
          data-mobile-menu
        >
          <Sidebar
            isCollapsed={false}
            onToggle={handleSidebarToggle}
            isMobile={true}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className={cn(
        "flex-1 flex flex-col transition-all duration-300",
        !isMobile && (sidebarCollapsed ? "ml-16" : "ml-64")
      )}>
        {/* Top Bar */}
        <TopBar
          onMenuToggle={handleSidebarToggle}
          isMobile={isMobile}
        />

        {/* Main Content */}
        <main className={cn(
          "flex-1 p-6",
          isMobile && "pb-20" // Add padding for mobile bottom nav
        )}>
          <div className="max-w-7xl mx-auto">
            {/* Breadcrumb */}
            <div className="mb-6">
              <Breadcrumb />
            </div>

            {/* Header Content or Page Title */}
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
                  {getPageDescription()}
                </p>
              </div>
            )}

            {/* Page Content */}
            <div className="animate-fade-in-up">
              {children}
            </div>
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        {isMobile && <MobileBottomNav />}
      </div>
    </div>
  );
};
