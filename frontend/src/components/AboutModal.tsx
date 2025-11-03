import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ExternalLink, Github, Info, Package, Calendar } from 'lucide-react';
import { apiService } from '../services/api';

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface VersionInfo {
  version: string;
  buildDate: string;
  source: 'docker' | 'package' | 'fallback';
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchVersionInfo();
    }
  }, [isOpen]);

  const fetchVersionInfo = async () => {
    setLoading(true);
    try {
      // Try to get version from Docker Hub first
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
          const latestVersion = versionTags[0];
          setVersionInfo({
            version: latestVersion.name,
            buildDate: new Date(latestVersion.last_pushed).toLocaleDateString(),
            source: 'docker'
          });
          setLoading(false);
          return;
        }
      }
    } catch (error) {
      console.log('Could not fetch Docker Hub version:', error);
    }

    // Fallback to package.json version
    try {
      const response = await fetch('/package.json');
      if (response.ok) {
        const data = await response.json();
        setVersionInfo({
          version: data.version || '1.0.0',
          buildDate: new Date().toLocaleDateString(),
          source: 'package'
        });
      } else {
        throw new Error('Package.json not found');
      }
    } catch (error) {
      console.log('Could not fetch package.json version:', error);
      // Final fallback
      setVersionInfo({
        version: '1.0.0',
        buildDate: new Date().toLocaleDateString(),
        source: 'fallback'
      });
    }
    
    setLoading(false);
  };

  const getVersionBadgeColor = (source: string) => {
    switch (source) {
      case 'docker': return 'bg-blue-500';
      case 'package': return 'bg-green-500';
      case 'fallback': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getVersionSourceText = (source: string) => {
    switch (source) {
      case 'docker': return 'Docker Hub';
      case 'package': return 'Package.json';
      case 'fallback': return 'Default';
      default: return 'Unknown';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-500" />
            About GlowWorm
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Application Info */}
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <img 
                src="/glowworm-logo.svg" 
                alt="GlowWorm Logo" 
                className="h-16 w-16"
              />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">GlowWorm</h2>
            <p className="text-gray-600 mb-4">
              A modern digital signage platform for displaying images and playlists
            </p>
          </div>

          {/* Version Information */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Version Information
            </h3>
            
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                <span className="text-sm text-gray-600">Loading version information...</span>
              </div>
            ) : versionInfo ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Version:</span>
                  <div className="flex items-center gap-2">
                    <Badge className={getVersionBadgeColor(versionInfo.source)}>
                      {versionInfo.version}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      ({getVersionSourceText(versionInfo.source)})
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Build Date:</span>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-gray-900">{versionInfo.buildDate}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">Version information unavailable</div>
            )}
          </div>

          {/* Links */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Links</h3>
            <div className="space-y-2">
              <a
                href="https://github.com/nickstephens/glowworm"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
              >
                <Github className="h-4 w-4" />
                <span>GitHub Repository</span>
                <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="https://hub.docker.com/r/nickstephens/glowworm-frontend"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
              >
                <Package className="h-4 w-4" />
                <span>Docker Hub</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-900">Features</h3>
            <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
              <div>• Image Management</div>
              <div>• Playlist Creation</div>
              <div>• Display Devices</div>
              <div>• Batch Upload</div>
              <div>• Duplicate Detection</div>
              <div>• Responsive Design</div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

