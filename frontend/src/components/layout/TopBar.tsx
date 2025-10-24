import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, User, Menu, X, Settings, LogOut, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [notifications, setNotifications] = useState(0);
  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Load user data and notifications
  useEffect(() => {
    const loadUserData = async () => {
      try {
        // TODO: Implement user data loading
        setUser({ name: 'Admin User', email: 'admin@glowworm.local' });
        setNotifications(3); // Mock notifications
      } catch (error) {
        console.error('Failed to load user data:', error);
      }
    };

    loadUserData();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // TODO: Implement global search
      console.log('Searching for:', searchQuery);
      navigate(`/admin/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleLogout = async () => {
    try {
      await apiService.logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      navigate('/login');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
      searchRef.current?.blur();
    }
  };

  return (
    <header className={cn(
      "sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      className
    )}>
      <div className="flex h-16 items-center px-4 sm:px-6 lg:px-8">
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

        {/* Center section - Search */}
        <div className="flex-1 max-w-md mx-4">
          <form onSubmit={handleSearch} className="relative">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchRef}
                type="text"
                placeholder="Search images, albums, tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                onKeyDown={handleKeyDown}
                className={cn(
                  "pl-9 pr-4 h-10 transition-all duration-200",
                  isSearchFocused && "ring-2 ring-primary ring-offset-2"
                )}
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </form>
        </div>

        {/* Right section - Notifications and User menu */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {notifications > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
              >
                {notifications > 9 ? '9+' : notifications}
              </Badge>
            )}
          </Button>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="relative h-10 w-10 rounded-full"
                aria-label="User menu"
              >
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                  <User className="h-4 w-4 text-primary-foreground" />
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
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};
