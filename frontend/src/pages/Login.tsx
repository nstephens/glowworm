import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Camera, Sparkles } from 'lucide-react';
import { apiService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { userLogger } from '../services/userLogger';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { checkAuthStatus, clearAuthCache } = useAuth();
  const [credentials, setCredentials] = useState({
    username: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Clear all authentication state when login page mounts
  useEffect(() => {
    const clearAllAuthState = async () => {
      try {
        console.log('🧹 Clearing all authentication state on login page mount');
        
        // Clear localStorage
        localStorage.removeItem('glowworm_last_auth');
        
        // Clear any existing sessions via logout API
        try {
          await apiService.logout();
        } catch (e) {
          console.log('Logout call failed (expected if no session):', e);
        }
        
        // Get the current hostname for cookie clearing
        const hostname = window.location.hostname;
        
        // Clear all cookies by setting them to expire
        const cookieNames = ['glowworm_session', 'glowworm_refresh', 'glowworm_csrf'];
        cookieNames.forEach(cookieName => {
          // Clear with domain (for cross-port access)
          if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
            document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${hostname};`;
          }
          // Also clear without domain
          document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        });
        
        console.log('✅ Cleared all authentication state');
      } catch (error) {
        console.warn('Failed to clear auth state:', error);
      }
    };
    
    clearAllAuthState();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('🔐 Starting login process...');
      
      const response = await apiService.login(credentials.username, credentials.password);
      console.log('🔐 Login API response:', response);
      
      if (response.success) {
        console.log('🔐 Login successful, waiting for cookies to set...');
        
        // Log successful login
        userLogger.logLogin(credentials.username);
        
        // Longer delay to ensure session cookie is properly set
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        console.log('🔐 Clearing auth cache and checking status...');
        // Clear the auth cache to force fresh check
        clearAuthCache();
        
        // Force a fresh authentication check (bypass cache)
        await checkAuthStatus(true);
        
        console.log('🔐 Navigating to admin dashboard...');
        navigate('/admin');
      } else {
        setError(response.message || 'Login failed');
        userLogger.logError(`Failed login attempt for user: ${credentials.username}`);
      }
    } catch (err: any) {
      console.error('🔐 Login error:', err);
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-card/40 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in-up">
        {/* Logo and Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4 shadow-lg">
            <Camera className="w-8 h-8 text-primary-foreground" />
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Glowworm
            </h1>
            <Sparkles className="w-6 h-6 text-accent" />
          </div>
          <p className="text-muted-foreground text-sm">Elegant photo display management</p>
        </div>

        {/* Login Card */}
        <Card className="border-0 shadow-2xl bg-card/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-semibold">Welcome back</CardTitle>
            <CardDescription>Sign in to manage your photo displays</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="username" className="text-sm font-medium">
                  Username
                </Label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  placeholder="Enter your username"
                  value={credentials.username}
                  onChange={handleInputChange}
                  className="h-11 bg-input/50 border-border/50 focus:bg-background transition-colors"
                  required
                  autoComplete="username"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  value={credentials.password}
                  onChange={handleInputChange}
                  className="h-11 bg-input/50 border-border/50 focus:bg-background transition-colors"
                  required
                  autoComplete="current-password"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 shadow-lg hover:shadow-xl transition-all duration-200"
                disabled={loading || !credentials.username || !credentials.password}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>

            <div className="border-t pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/display')}
                className="w-full h-11"
              >
                Display View
              </Button>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              Need help? Contact your system administrator
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Login;
