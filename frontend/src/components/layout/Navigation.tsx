import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { TopBar } from './TopBar';
import { Sidebar } from './Sidebar';
import { Breadcrumb } from './Breadcrumb';
import { MobileBottomNav } from './MobileBottomNav';
import { cn } from '@/lib/utils';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

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
  const { isMobile, isHydrated } = useResponsiveLayout();

  const handleSidebarToggle = () => {
    // Only toggle on desktop since sidebar never appears on mobile
    if (!isMobile) {
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
      case 'logs':
        return 'View system logs and activity';
      case 'settings':
        return 'Configure system settings and preferences';
      default:
        return 'Overview and quick actions';
    }
  };

  return (
    <div className={cn("flex min-h-screen bg-background", className)} role="application">
      {/* Desktop Sidebar - ALWAYS Hidden on mobile devices */}
      {(!isMobile && isHydrated) && (
        <aside className="desktop-only sidebar-container" role="complementary">
          <Sidebar
            isCollapsed={sidebarCollapsed}
            onToggle={handleSidebarToggle}
            isMobile={false}
          />
        </aside>
      )}

      {/* Main Content Area */}
      <div className={cn(
        "flex-1 flex flex-col transition-all duration-300",
        !isMobile && (sidebarCollapsed ? "ml-16" : "ml-64"),
        "pb-[calc(64px+env(safe-area-inset-bottom,0px)+constant(safe-area-inset-bottom,0px))] lg:pb-0" // Add padding for mobile bottom nav
      )}>
        {/* Top Bar / Header - Hidden on mobile to save space */}
        {(!isMobile && isHydrated) && (
          <header role="banner" className="desktop-only topbar-container">
            <TopBar
              onMenuToggle={handleSidebarToggle}
              isMobile={isMobile}
            />
          </header>
        )}

        {/* Main Content */}
        <main 
          id="main-content"
          className="flex-1 px-2 py-4 lg:px-6 lg:py-6 overflow-y-auto"
          role="main"
          aria-label={`${getPageTitle()} page`}
        >
          <div className={cn(
            "mx-auto",
            isMobile ? "max-w-[320px] w-full" : "max-w-full sm:max-w-7xl"
          )}>
            {/* Breadcrumb Navigation - Hidden on mobile */}
            {(!isMobile && isHydrated) && (
              <nav aria-label="Breadcrumb" className="mb-6 desktop-only">
                <Breadcrumb />
              </nav>
            )}

            {/* Header Content or Page Title */}
            {headerContent ? (
              <header className="mb-8" role="region" aria-label="Page header">
                {headerContent}
              </header>
            ) : (
              <header className={cn("mb-8 animate-fade-in-up", isMobile && "mb-4")} role="region" aria-label="Page header">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-2 h-8 bg-gradient-to-b from-primary to-accent rounded-full" aria-hidden="true" />
                  <h1 className="text-2xl lg:text-3xl font-bold text-balance">{getPageTitle()}</h1>
                </div>
                <p className="text-muted-foreground text-base lg:text-lg">
                  {getPageDescription()}
                </p>
              </header>
            )}

            {/* Page Content */}
            <div className="animate-fade-in-up" role="region" aria-label="Main content">
              {children}
            </div>
          </div>
        </main>

        {/* Mobile Bottom Navigation - Always visible on mobile */}
        {isMobile && (
          <div className="mobile-only">
            <MobileBottomNav />
          </div>
        )}
      </div>
    </div>
  );
};
