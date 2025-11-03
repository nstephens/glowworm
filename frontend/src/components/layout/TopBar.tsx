import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Menu, Settings, LogOut, Camera, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { apiService } from '@/services/api';
import { AboutModal } from '@/components/AboutModal';

interface TopBarProps {
  onMenuToggle: () => void;
  isMobile?: boolean;
  className?: string;
}

export const TopBar: React.FC<TopBarProps> = ({ 
  onMenuToggle, 
  isMobile = false, 
  className 
}) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const [showAboutModal, setShowAboutModal] = useState(false);

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      try {
        // TODO: Implement user data loading
        setUser({ name: 'Admin User', email: 'admin@glowworm.local' });
      } catch (error) {
        console.error('Failed to load user data:', error);
      }
    };

    loadUserData();
  }, []);


  const handleLogout = async () => {
    try {
      // Log logout before actual logout (while user is still authenticated)
      const { userLogger } = await import('@/services/userLogger');
      if (user?.name) {
        userLogger.logLogout(user.name);
      }
      
      await apiService.logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      navigate('/login');
    }
  };


  return (
    <header className={cn(
      "sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      className
    )}>
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left section - Logo and Menu toggle */}
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuToggle}
            className="lg:hidden"
            aria-label="Toggle menu"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Camera className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold text-foreground">GlowWorm</h1>
              <p className="text-xs text-muted-foreground">Gallery</p>
            </div>
          </div>
        </div>

        {/* Right section - User menu */}
        <div className="flex items-center">
          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-12 w-12 rounded-full p-0 mobile-button"
                aria-label="User menu"
              >
                <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                  <User className="h-5 w-5 text-primary-foreground" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {user?.name || 'Admin User'}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email || 'admin@glowworm.local'}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => navigate('/admin/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowAboutModal(true)}>
                <Info className="mr-2 h-4 w-4" />
                <span>About</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* About Modal */}
      <AboutModal 
        isOpen={showAboutModal} 
        onClose={() => setShowAboutModal(false)} 
      />
    </header>
  );
};
