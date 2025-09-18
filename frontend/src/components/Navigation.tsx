import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Images, 
  Play, 
  Monitor, 
  Settings, 
  LogOut, 
  Menu, 
  X,
  ChevronRight,
  Home
} from 'lucide-react';
import Breadcrumb from './Breadcrumb';

interface NavigationItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  description?: string;
}

const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/admin',
    description: 'Overview and quick actions'
  },
  {
    id: 'images',
    label: 'Images',
    icon: Images,
    path: '/admin/images',
    description: 'Upload and manage images'
  },
  {
    id: 'playlists',
    label: 'Playlists',
    icon: Play,
    path: '/admin/playlists',
    description: 'Create and manage playlists'
  },
  {
    id: 'displays',
    label: 'Displays',
    icon: Monitor,
    path: '/admin/displays',
    description: 'Manage display devices'
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    path: '/admin/settings',
    description: 'System configuration'
  }
];

interface NavigationProps {
  children: React.ReactNode;
  headerContent?: React.ReactNode;
}

export const Navigation: React.FC<NavigationProps> = ({ children, headerContent }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  const getPageTitle = () => {
    const currentItem = navigationItems.find(item => isActive(item.path));
    return currentItem?.label || 'Admin';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div 
        className={`
          fixed top-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex-shrink-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ height: 'calc(100vh - 100px)' }}
      >
        <div className="flex flex-col" style={{ height: 'calc(100vh - 100px)' }}>
          {/* Logo/Brand */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <img 
                src="/glowworm_icon.png" 
                alt="Glowworm Logo" 
                className="w-8 h-8 object-contain"
              />
              <span className="text-xl font-bold text-gray-900">Glowworm</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    navigate(item.path);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-all duration-200 group
                    ${active 
                      ? 'bg-primary-50 text-primary-700 border border-primary-200' 
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                    }
                  `}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`w-5 h-5 ${active ? 'text-primary-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
                    <div>
                      <div className="font-medium">{item.label}</div>
                      {item.description && (
                        <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
                      )}
                    </div>
                  </div>
                  {active && (
                    <ChevronRight className="w-4 h-4 text-primary-600" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-3 text-gray-700 hover:bg-red-50 hover:text-red-700 rounded-lg transition-all duration-200 group"
            >
              <LogOut className="w-5 h-5 text-gray-400 group-hover:text-red-600" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top Bar */}
        <div className="bg-white shadow-sm border-b border-gray-200 flex-shrink-0">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className={`flex items-center ${headerContent ? 'py-6' : 'h-16'}`}>
              {headerContent ? (
                <div className="flex items-center w-full">
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 mr-4"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                  {headerContent}
                </div>
              ) : (
                <div className="flex items-center space-x-4">
                  <button
                    onClick={() => setSidebarOpen(true)}
                    className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  >
                    <Menu className="w-5 h-5" />
                  </button>
                  <div>
                    <h1 className="text-xl font-semibold text-gray-900">{getPageTitle()}</h1>
                    <p className="text-sm text-gray-500">
                      {navigationItems.find(item => isActive(item.path))?.description}
                    </p>
                  </div>
                </div>
              )}
            </div>
            {/* Breadcrumb */}
            <div className="pb-4">
              <Breadcrumb />
            </div>
          </div>
        </div>

        {/* Page Content */}
        <main className="flex-1 min-h-0">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Navigation;
