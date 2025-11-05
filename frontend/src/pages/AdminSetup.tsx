import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { urlResolver } from '../services/urlResolver';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Camera, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';

/**
 * Simplified Admin Setup Component
 * For Docker deployments where database is pre-configured via environment variables
 * Only handles admin user creation (Stage 2 of setup)
 */
const AdminSetup: React.FC = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    fetchVersion();
  }, []);

  const fetchVersion = async () => {
    try {
      // Try to get version from Docker Hub
      const response = await fetch('https://registry.hub.docker.com/v2/repositories/nickstephens/glowworm-frontend/tags/?page_size=10');
      if (response.ok) {
        const data = await response.json();
        const versionTags = data.results
          ?.filter((tag: any) => /^\d+\.\d+\.\d+$/.test(tag.name))
          ?.sort((a: any, b: any) => {
            const aParts = a.name.split('.').map(Number);
            const bParts = b.name.split('.').map(Number);
            for (let i = 0; i < 3; i++) {
              if (aParts[i] !== bParts[i]) {
                return bParts[i] - aParts[i];
              }
            }
            return 0;
          });
        
        if (versionTags && versionTags.length > 0) {
          setVersion(versionTags[0].name);
        }
      }
    } catch (error) {
      console.log('Could not fetch version:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!password) {
      setError('Please enter a password');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setIsSubmitting(true);

      // Call create-admin endpoint
      const response = await fetch(urlResolver.getApiUrl('/setup/create-admin'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin_password: password
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(true);
        
        // Redirect to login after 2 seconds using window.location for reliability
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        setError(data.detail || 'Failed to create admin user');
      }
    } catch (err: any) {
      console.error('Admin creation error:', err);
      setError(err.message || 'Failed to create admin user');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-card/40 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-0 shadow-2xl backdrop-blur-sm">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="rounded-full bg-green-100 p-3">
                  <CheckCircle className="w-12 h-12 text-green-600" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-foreground">Setup Complete!</h2>
              <p className="text-muted-foreground">
                Your admin account has been created successfully.
              </p>
              <p className="text-sm text-muted-foreground">
                Redirecting to login...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/20 to-card/40 flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-0 shadow-2xl backdrop-blur-sm">
        <CardHeader className="text-center space-y-2">
          <div className="flex justify-center items-center gap-3 mb-4">
            <div className="relative">
              <Camera className="w-12 h-12 text-primary" />
              <Sparkles className="w-6 h-6 text-accent absolute -top-1 -right-1" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold">
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Welcome to Glowworm
            </span>
          </CardTitle>
          <CardDescription className="text-base">
            Create your admin account to get started
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Admin Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter a secure password"
                  className="bg-input/50 border-border/50 focus:bg-background"
                  disabled={isSubmitting}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 8 characters
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="bg-input/50 border-border/50 focus:bg-background"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full shadow-lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating Admin Account...' : 'Create Admin Account'}
            </Button>

            <div className="text-center space-y-2">
              <p className="text-xs text-muted-foreground">
                Database is already configured via Docker
              </p>
              {version && (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xs text-muted-foreground">Version:</span>
                  <Badge variant="outline" className="text-xs">
                    {version}
                  </Badge>
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSetup;

