import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Save, Monitor, Database, User, Key, Plus, Trash2, AlertTriangle, Users, Settings as SettingsIcon, Server, Shield, Info, RefreshCw, Loader2, Wrench, Sparkles } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { apiService } from '../services/api';
import { urlResolver } from '../services/urlResolver';
import { updateLogSettings } from '../utils/logger';
import { detectDockerEnvironment, shouldDisableInDocker, getDisabledReason } from '../utils/dockerDetection';
import { RegenerationProgressModal } from '../components/RegenerationProgressModal';
import { type RegenerationProgress } from '../services/websocketService';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { MobileSettingsWrapper } from '../components/settings/MobileSettingsWrapper';
import { SettingsSection } from '../components/settings/SettingsSection';
import { ToggleSwitch } from '../components/settings/ToggleSwitch';
import { SettingsInput } from '../components/settings/SettingsItem';

interface DockerEnvironment {
  isDocker: boolean;
  isDockerCompose: boolean;
  environment: 'docker' | 'traditional' | 'unknown';
}
import UserManagement from '../components/UserManagement';

interface SystemSettings {
  // Database settings
  mysql_host: string;
  mysql_port: number;
  mysql_root_user: string;
  mysql_root_password: string;
  app_db_user: string;
  app_db_password: string;
  
  // Admin settings
  admin_password: string;
  
  // Server settings
  server_base_url: string;
  backend_port: number;
  frontend_port: number;
  
  // Display settings
  default_display_time_seconds: number;
  target_display_sizes: string[];
  
  // File storage settings
  upload_directory: string;
  
  // Status check settings
  display_status_check_interval: number;
  display_websocket_check_interval: number;
  
  // Logging settings
  log_level: string;
  
  // OAuth settings
  google_client_id: string;
  google_client_secret: string;
}

interface DisplaySize {
  id: string;
  name: string;
  width: number;
  height: number;
  isCustom: boolean;
}

const Settings: React.FC = () => {
  const { toast } = useToast();
  const { isMobile } = useResponsiveLayout();
  const location = useLocation();
  const isCoarsePointer = typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  const isMobileView = isMobile || isCoarsePointer;
  const hasLoadedSettings = useRef(false);
  const [settings, setSettings] = useState<SystemSettings>({
    mysql_host: 'localhost',
    mysql_port: 3306,
    mysql_root_user: 'root',
    mysql_root_password: '',
    app_db_user: 'glowworm',
    app_db_password: '',
    admin_password: '',
    server_base_url: 'http://localhost:8001',
    backend_port: 8001,
    frontend_port: 3003,
    default_display_time_seconds: 30,
    upload_directory: 'uploads',
    display_status_check_interval: 30,
    display_websocket_check_interval: 5,
    log_level: 'INFO',
    google_client_id: '',
    google_client_secret: '',
    target_display_sizes: []
  });

  const [displaySizes, setDisplaySizes] = useState<DisplaySize[]>([
    { id: '1080p', name: 'Full HD (1920x1080)', width: 1920, height: 1080, isCustom: false },
    { id: '2k', name: '2K QHD (2560x1440)', width: 2560, height: 1440, isCustom: false },
    { id: '4k', name: '4K UHD (3840x2160)', width: 3840, height: 2160, isCustom: false },
    { id: '2k-portrait', name: '2K Portrait (1080x1920)', width: 1080, height: 1920, isCustom: false },
    { id: '4k-portrait', name: '4K Portrait (2160x3840)', width: 2160, height: 3840, isCustom: false }
  ]);

  const [newDisplaySize, setNewDisplaySize] = useState({ name: '', width: '', height: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [resolutionSuggestions, setResolutionSuggestions] = useState<any[]>([]);
  
  // Determine active section from route
  const getActiveSection = (): 'database' | 'admin' | 'oauth' | 'displays' | 'general' | 'users' | 'utilities' => {
    const pathParts = location.pathname.split('/');
    const section = pathParts[pathParts.length - 1];
    const validSections = ['general', 'users', 'database', 'admin', 'oauth', 'displays', 'utilities'];
    return validSections.includes(section) ? section as any : 'general';
  };
  
  const activeTab = getActiveSection();
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [variantStatus, setVariantStatus] = useState<any[]>([]);
  const [isLoadingVariantStatus, setIsLoadingVariantStatus] = useState(false);
  const [dockerEnv, setDockerEnv] = useState<DockerEnvironment>({
    isDocker: false,
    isDockerCompose: false,
    environment: 'unknown'
  });

  // Regeneration progress state
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [regenerationTaskId, setRegenerationTaskId] = useState<string | null>(null);
  const [initialProgress, setInitialProgress] = useState<RegenerationProgress | null>(null);

  // Variant generation state
  const [isGeneratingImageVariants, setIsGeneratingImageVariants] = useState(false);
  const [isGeneratingPlaylistVariants, setIsGeneratingPlaylistVariants] = useState(false);
  
  // Track original display sizes for change detection
  const [originalDisplaySizes, setOriginalDisplaySizes] = useState<string[]>([]);
  
  // Variant deletion confirmation
  const [showVariantDeletionModal, setShowVariantDeletionModal] = useState(false);
  const [resolutionToRemove, setResolutionToRemove] = useState<{id: string, resolution: string} | null>(null);
  const [removedResolutions, setRemovedResolutions] = useState<string[]>([]); // Track resolutions to clean up on save

  // Load settings and detect Docker environment on component mount
  useEffect(() => {
    loadSettings();
    loadResolutionSuggestions();
    loadVariantStatus();
    detectDockerEnvironment().then(setDockerEnv);
  }, []);

  // Reload variant status when switching to displays tab
  useEffect(() => {
    if (activeTab === 'displays') {
      loadVariantStatus();
    }
  }, [activeTab]);

  const loadResolutionSuggestions = async () => {
    try {
      setIsLoadingSuggestions(true);
      const response = await apiService.getDisplaySizeSuggestions();
      if (response.success) {
        setResolutionSuggestions(response.suggestions || []);
      }
    } catch (error) {
      console.error('Failed to load resolution suggestions:', error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const loadVariantStatus = async () => {
    try {
      setIsLoadingVariantStatus(true);
      const response = await apiService.getVariantStatusByResolution();
      if (response.success) {
        setVariantStatus(response.status || []);
      }
    } catch (error) {
      console.error('Failed to load variant status:', error);
    } finally {
      setIsLoadingVariantStatus(false);
    }
  };

  const handleAddSuggestedResolution = async (resolution: string) => {
    try {
      const response = await apiService.addDisplaySize(resolution);
      
      if (response.success) {
        if (response.already_exists) {
          toast({
            title: "Already Configured",
            description: `${resolution} is already in your display sizes`,
            variant: "default",
          });
        } else {
          toast({
            title: "Resolution Added",
            description: `${resolution} has been added to display sizes`,
            variant: "success",
          });
          
          // Reload settings and suggestions
          await loadSettings();
          await loadResolutionSuggestions();
        }
      }
    } catch (error) {
      console.error('Failed to add resolution:', error);
      toast({
        title: "Error",
        description: "Failed to add resolution. Please try again.",
        variant: "destructive",
      });
    }
  };

  const loadSettings = async () => {
    if (hasLoadedSettings.current) return;
    
    try {
      const response = await apiService.getSettings();
      if (response.success) {
        setSettings(response.settings);
        // Store original display sizes for change detection
        setOriginalDisplaySizes(response.settings.target_display_sizes || []);
        
        // Update urlResolver with the loaded server URL
        if (response.settings.server_base_url) {
          urlResolver.updateServerUrl(response.settings.server_base_url);
        }
        
        // Update log settings
        updateLogSettings({
          logLevel: response.settings.log_level,
          enableDebugLogging: response.settings.enable_debug_logging
        });
        
        hasLoadedSettings.current = true;
        // Don't show toast on load - only show on user actions
      }
    } catch (err: any) {
      // Settings API not available yet, use defaults
      console.log('Settings API not available, using defaults');
      hasLoadedSettings.current = true;
      setSettings({
        mysql_host: 'localhost',
        mysql_port: 3306,
        mysql_root_user: 'root',
        mysql_root_password: '',
        app_db_user: 'glowworm',
        app_db_password: '',
        admin_password: '',
        server_base_url: 'http://localhost:8001',
        backend_port: 8001,
        frontend_port: 3003,
        default_display_time_seconds: 30,
        upload_directory: 'uploads',
        display_status_check_interval: 30,
        display_websocket_check_interval: 5,
        log_level: 'INFO',
        google_client_id: '',
        google_client_secret: '',
        target_display_sizes: []
      });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setSettings(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    }));
  };

  const handleSaveSettings = async () => {
    setIsLoading(true);
    try {
      // Handle admin password update separately if provided
      if (settings.admin_password && settings.admin_password.trim() !== '') {
        try {
          // Get current user to find admin user ID
          const currentUserResponse = await apiService.getCurrentUser();
          if (currentUserResponse.success && currentUserResponse.data) {
            const adminUserId = currentUserResponse.data.id;
            await apiService.resetUserPassword(adminUserId, settings.admin_password);
            toast({
              title: "Admin Password Updated",
              description: "Admin password has been updated successfully",
              variant: "success",
            });
          }
        } catch (passwordErr: any) {
          toast({
            title: "Password Update Failed",
            description: `Failed to update admin password: ${passwordErr.message}`,
            variant: "error",
          });
          return; // Don't continue with other settings if password update fails
        }
      }

      // Update other settings (excluding admin_password)
      const settingsToUpdate = { ...settings };
      delete settingsToUpdate.admin_password; // Remove admin_password from settings update
      
      const response = await apiService.updateSettings(settingsToUpdate);
      if (response.success) {
        // Update the urlResolver with the new server URL
        if (settings.server_base_url) {
          urlResolver.updateServerUrl(settings.server_base_url);
        }
        
        // Update log settings
        updateLogSettings({
          logLevel: settings.log_level,
          enableDebugLogging: settings.enable_debug_logging
        });
        
        // Check if display sizes have changed
        const currentDisplaySizes = settings.target_display_sizes || [];
        
        // Check for ADDED resolutions (new ones that weren't in original)
        const addedResolutions = currentDisplaySizes.filter(
          size => !originalDisplaySizes.includes(size)
        );
        
        // Clean up variants for removed resolutions
        if (removedResolutions.length > 0) {
          console.log('🧹 Cleaning up variants for removed resolutions:', removedResolutions);
          try {
            for (const resolution of removedResolutions) {
              await apiService.deleteVariantsForResolution(resolution);
            }
            toast({
              title: "Variants Cleaned Up",
              description: `Removed variants for ${removedResolutions.length} resolution(s)`,
            });
          } catch (err: any) {
            console.error('Failed to clean up variants:', err);
            toast({
              title: "Cleanup Warning",
              description: "Some variants may not have been deleted. Check logs for details.",
              variant: "warning",
            });
          }
          setRemovedResolutions([]); // Clear the list
        }
        
        if (addedResolutions.length > 0) {
          // New resolutions added - automatically trigger variant regeneration
          console.log('🆕 New resolutions detected:', addedResolutions);
          
          // Update the original sizes tracker
          setOriginalDisplaySizes(currentDisplaySizes);
          
          // Trigger image variant regeneration and show progress modal
          handleRegenerateResolutions();
          
          toast({
            title: "Settings Saved",
            description: `New resolution(s) added. Variant regeneration started automatically.`,
            variant: "success",
          });
        } else {
          // No new resolutions - just save settings
          setOriginalDisplaySizes(currentDisplaySizes); // Still update the tracker
          toast({
            title: "Settings Saved",
            description: "System settings have been updated successfully",
            variant: "success",
          });
        }
      }
    } catch (err: any) {
      toast({
        title: "Settings API Not Available",
        description: "Settings API is not available yet. Changes will be saved when the backend is ready.",
        variant: "warning",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDisplaySize = () => {
    if (!newDisplaySize.name.trim() || !newDisplaySize.width || !newDisplaySize.height) {
      toast({
        title: "Invalid Input",
        description: "Please fill in all fields for the display size",
        variant: "warning",
      });
      return;
    }

    const width = parseInt(newDisplaySize.width);
    const height = parseInt(newDisplaySize.height);

    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      toast({
        title: "Invalid Dimensions",
        description: "Width and height must be positive numbers",
        variant: "warning",
      });
      return;
    }

    const newSize: DisplaySize = {
      id: `custom-${Date.now()}`,
      name: newDisplaySize.name.trim(),
      width,
      height,
      isCustom: true
    };

    setDisplaySizes(prev => [...prev, newSize]);
    setNewDisplaySize({ name: '', width: '', height: '' });
    toast({
      title: "Display Size Added",
      description: `"${newSize.name}" has been added to the list`,
      variant: "success",
    });
  };

  const handleRemoveDisplaySize = (id: string) => {
    const size = displaySizes.find(s => s.id === id);
    if (size) {
      setDisplaySizes(prev => prev.filter(s => s.id !== id));
      toast({
        title: "Display Size Removed",
        description: `"${size.name}" has been removed from the list`,
        variant: "success",
      });
    }
  };

  const handleToggleDisplaySize = async (id: string) => {
    // Find the display size object to get dimensions
    const displaySize = displaySizes.find(s => s.id === id);
    if (!displaySize) return;
    
    const dimensionString = `${displaySize.width}x${displaySize.height}`;
    const isSelected = settings.target_display_sizes.includes(dimensionString);
    
    // If deselecting (removing), show confirmation modal
    if (isSelected) {
      setResolutionToRemove({ id, resolution: dimensionString });
      setShowVariantDeletionModal(true);
      return;
    }
    
    // If selecting (adding), toggle immediately
    const newDisplaySizes = [...settings.target_display_sizes, dimensionString];
    
    setSettings(prev => ({
      ...prev,
      target_display_sizes: newDisplaySizes
    }));

    // Auto-save display sizes when toggled
    try {
      await apiService.updateDisplaySizes(newDisplaySizes);
    } catch (err: any) {
      // Settings API not available yet, just update local state
      console.log('Display sizes updated locally, will sync when API is available');
    }
  };

  const confirmRemoveResolution = () => {
    if (!resolutionToRemove) return;
    
    const dimensionString = resolutionToRemove.resolution;
    const newDisplaySizes = settings.target_display_sizes.filter(sizeId => sizeId !== dimensionString);
    
    setSettings(prev => ({
      ...prev,
      target_display_sizes: newDisplaySizes
    }));
    
    // Track this resolution for cleanup on save
    setRemovedResolutions(prev => [...prev, dimensionString]);
    
    setShowVariantDeletionModal(false);
    setResolutionToRemove(null);
    
    toast({
      title: "Resolution Removed",
      description: `${dimensionString} will be removed and variants cleaned up when you save settings.`,
      variant: "warning",
    });
  };

  const cancelRemoveResolution = () => {
    setShowVariantDeletionModal(false);
    setResolutionToRemove(null);
  };

  const handleRegenerateResolutions = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.regenerateImageResolutions();
      
      // Set up progress tracking
      setRegenerationTaskId(response.data.task_id);
      setInitialProgress({
        task_id: response.data.task_id,
        status: 'pending',
        total_images: response.data.total_images,
        processed_images: 0,
        error_count: 0,
        display_sizes: response.data.display_sizes,
        progress_percentage: 0
      });
      
      // Show progress modal
      setShowProgressModal(true);
      
      toast({
        title: "Resolution Regeneration Started",
        description: `Background regeneration started for ${response.data.total_images} images.`,
        variant: "success",
      });
    } catch (err: any) {
      toast({
        title: "Failed to Start Regeneration",
        description: err.message || "Could not start resolution regeneration",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderDatabaseSettings = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
          <Database className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Database Configuration</h3>
          <p className="text-sm text-muted-foreground">MySQL database connection settings</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="mysql_host">MySQL Host</Label>
          <Input
            id="mysql_host"
            name="mysql_host"
            type="text"
            value={settings.mysql_host}
            onChange={handleInputChange}
            disabled={shouldDisableInDocker('mysql_host', dockerEnv)}
            required
          />
          {shouldDisableInDocker('mysql_host', dockerEnv) && (
            <div className="flex items-center text-sm text-gray-500">
              <Info className="w-4 h-4 mr-1" />
              {getDisabledReason('mysql_host', dockerEnv)}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="mysql_port">MySQL Port</Label>
          <Input
            id="mysql_port"
            name="mysql_port"
            type="number"
            value={settings.mysql_port}
            onChange={handleInputChange}
            disabled={shouldDisableInDocker('mysql_port', dockerEnv)}
            required
          />
          {shouldDisableInDocker('mysql_port', dockerEnv) && (
            <div className="flex items-center text-sm text-gray-500">
              <Info className="w-4 h-4 mr-1" />
              {getDisabledReason('mysql_port', dockerEnv)}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            MySQL Root User
          </label>
          <input
            type="text"
            name="mysql_root_user"
            value={settings.mysql_root_user}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            MySQL Root Password
          </label>
          <input
            type="password"
            name="mysql_root_password"
            value={settings.mysql_root_password}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Leave blank to keep current"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Application DB User
          </label>
          <input
            type="text"
            name="app_db_user"
            value={settings.app_db_user}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Application DB Password
          </label>
          <input
            type="password"
            name="app_db_password"
            value={settings.app_db_password}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Leave blank to keep current"
          />
        </div>
      </div>
    </div>
  );

  const renderAdminSettings = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
          <User className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Admin Account</h3>
          <p className="text-sm text-gray-600">Administrator account settings</p>
        </div>
      </div>

      <div className="max-w-md">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Admin Password
        </label>
        <input
          type="password"
          name="admin_password"
          value={settings.admin_password}
          onChange={handleInputChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Leave blank to keep current"
        />
        <p className="text-xs text-gray-500 mt-1">
          Leave blank to keep the current password unchanged
        </p>
      </div>

    </div>
  );

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <Monitor className="w-5 h-5 text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">General Settings</h3>
          <p className="text-sm text-gray-600">Basic system configuration</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Server Base URL
          </label>
          <input
            type="url"
            name="server_base_url"
            value={settings.server_base_url}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="http://localhost:8001"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Base URL for the server (used for API endpoints and image URLs)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Upload Directory
          </label>
          <input
            type="text"
            name="upload_directory"
            value={settings.upload_directory}
            onChange={handleInputChange}
            disabled={shouldDisableInDocker('upload_directory', dockerEnv)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder="uploads"
            required
          />
          {shouldDisableInDocker('upload_directory', dockerEnv) ? (
            <div className="flex items-center text-sm text-gray-500 mt-1">
              <Info className="w-4 h-4 mr-1" />
              {getDisabledReason('upload_directory', dockerEnv)}
            </div>
          ) : (
            <p className="text-xs text-gray-500 mt-1">
              Directory for uploaded files (relative to backend root)
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Backend Port
          </label>
          <input
            type="number"
            name="backend_port"
            value={settings.backend_port}
            onChange={handleInputChange}
            disabled={shouldDisableInDocker('backend_port', dockerEnv)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder="8001"
            min="1024"
            max="65535"
            required
          />
          {shouldDisableInDocker('backend_port', dockerEnv) ? (
            <div className="flex items-center text-sm text-gray-500 mt-1">
              <Info className="w-4 h-4 mr-1" />
              {getDisabledReason('backend_port', dockerEnv)}
            </div>
          ) : (
            <p className="text-xs text-gray-500 mt-1">
              Port for the backend API server
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Frontend Port
          </label>
          <input
            type="number"
            name="frontend_port"
            value={settings.frontend_port}
            onChange={handleInputChange}
            disabled={shouldDisableInDocker('frontend_port', dockerEnv)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            placeholder="3003"
            min="1024"
            max="65535"
            required
          />
          {shouldDisableInDocker('frontend_port', dockerEnv) ? (
            <div className="flex items-center text-sm text-gray-500 mt-1">
              <Info className="w-4 h-4 mr-1" />
              {getDisabledReason('frontend_port', dockerEnv)}
            </div>
          ) : (
            <p className="text-xs text-gray-500 mt-1">
              Port for the frontend development server
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Default Display Time (seconds)
          </label>
          <input
            type="number"
            name="default_display_time_seconds"
            value={settings.default_display_time_seconds}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="30"
            min="1"
            max="300"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Default time to display each image in playlists
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Display Status Check Interval (seconds)
          </label>
          <input
            type="number"
            name="display_status_check_interval"
            value={settings.display_status_check_interval}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="30"
            min="5"
            max="300"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            How often to check display device status
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            WebSocket Status Check Interval (seconds)
          </label>
          <input
            type="number"
            name="display_websocket_check_interval"
            value={settings.display_websocket_check_interval}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="5"
            min="1"
            max="60"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            How often to check WebSocket display connections
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Log Level
          </label>
          <select
            name="log_level"
            value={settings.log_level}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            required
          >
            <option value="CRITICAL">Critical (Errors only)</option>
            <option value="ERROR">Error (Errors and critical issues)</option>
            <option value="WARNING">Warning (Errors, warnings, and critical issues)</option>
            <option value="INFO">Info (General information and above)</option>
            <option value="DEBUG">Debug (Detailed debugging information)</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            Level of detail for system logging
          </p>
        </div>
      </div>
    </div>
  );

  const renderOAuthSettings = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
          <Key className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">OAuth Configuration</h3>
          <p className="text-sm text-gray-600">Google OAuth settings for user authentication</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Google Client ID
          </label>
          <input
            type="text"
            name="google_client_id"
            value={settings.google_client_id}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Optional - for Google OAuth login"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Google Client Secret
          </label>
          <input
            type="password"
            name="google_client_secret"
            value={settings.google_client_secret}
            onChange={handleInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Optional - for Google OAuth login"
          />
        </div>
      </div>
    </div>
  );

  const renderDisplaySettings = () => (
    <div className="space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
          <Monitor className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Target Display Sizes</h3>
          <p className="text-sm text-gray-600">Configure display sizes for automatic image resizing</p>
        </div>
      </div>

      {/* Selected Display Sizes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-700">Selected Display Sizes</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadVariantStatus}
            disabled={isLoadingVariantStatus}
            title="Refresh variant generation status"
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingVariantStatus ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="space-y-2">
          {displaySizes.map((size) => {
            const dimensionString = `${size.width}x${size.height}`;
            const isSelected = settings.target_display_sizes.includes(dimensionString);
            const status = variantStatus.find(s => s.resolution === dimensionString);
            
            return (
              <div
                key={size.id}
                className={`flex items-center justify-between p-3 border rounded-lg ${
                  isSelected ? 'border-primary-200 bg-primary-50' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center space-x-3 flex-1">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleDisplaySize(size.id)}
                    className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{size.name}</div>
                    <div className="text-sm text-gray-500">
                      {size.width} × {size.height} pixels
                    </div>
                    {isSelected && status && (
                      <div className="text-xs text-gray-600 mt-1 flex items-center gap-3">
                        <span className={status.images_with_variants === status.total_images ? 'text-green-600 font-medium' : ''}>
                          📸 {status.images_with_variants}/{status.total_images} images
                        </span>
                        <span className={status.playlists_with_variants === status.total_playlists ? 'text-green-600 font-medium' : ''}>
                          🎵 {status.playlists_with_variants}/{status.total_playlists} playlists
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {size.isCustom && (
                    <button
                      onClick={() => handleRemoveDisplaySize(size.id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Suggested Resolutions from Devices */}
      {resolutionSuggestions.length > 0 && (
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-700">
              Suggested Resolutions from Your Devices
            </h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadResolutionSuggestions}
              disabled={isLoadingSuggestions}
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingSuggestions ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          <div className="space-y-2">
            {resolutionSuggestions.map((suggestion) => (
              <div
                key={suggestion.resolution}
                className={`flex items-center justify-between p-3 border rounded-lg ${
                  suggestion.is_configured
                    ? 'border-green-200 bg-green-50'
                    : 'border-blue-200 bg-blue-50'
                }`}
              >
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900">
                      {suggestion.resolution}
                    </span>
                    {suggestion.is_configured && (
                      <Badge className="bg-green-100 text-green-800">
                        Configured
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {suggestion.device_count} device{suggestion.device_count > 1 ? 's' : ''}: {suggestion.devices.join(', ')}
                  </div>
                </div>
                {!suggestion.is_configured && (
                  <Button
                    onClick={() => handleAddSuggestedResolution(suggestion.resolution)}
                    size="sm"
                    className="ml-4"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Custom Display Size */}
      <div className="border-t pt-6">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Add Custom Display Size</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={newDisplaySize.name}
              onChange={(e) => setNewDisplaySize(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="e.g., Custom Portrait"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Width (px)
            </label>
            <input
              type="number"
              value={newDisplaySize.width}
              onChange={(e) => setNewDisplaySize(prev => ({ ...prev, width: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="1920"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Height (px)
            </label>
            <input
              type="number"
              value={newDisplaySize.height}
              onChange={(e) => setNewDisplaySize(prev => ({ ...prev, height: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="1080"
            />
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={handleAddDisplaySize}
            className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Display Size</span>
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-blue-900">Image Resizing</h4>
            <p className="text-sm text-blue-700 mt-1">
              When enabled, images will be automatically resized to match the selected display sizes during upload. 
              Original images are always preserved.
            </p>
          </div>
        </div>
      </div>

      {/* Regenerate Resolutions Button */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-green-900">Resolution Management</h4>
            <p className="text-sm text-green-700 mt-1">
              Regenerate resolution variants for all existing images in the background. 
              Processing will continue even if you navigate away from this page.
            </p>
          </div>
          <Button
            onClick={handleRegenerateResolutions}
            disabled={isLoading}
            variant="outline"
            className="border-green-300 text-green-700 hover:bg-green-100"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Regenerate Resolutions
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  const handleGenerateImageVariants = async () => {
    // Use the same approach as handleRegenerateResolutions to show progress modal
    handleRegenerateResolutions();
  };

  const handleGeneratePlaylistVariants = async () => {
    try {
      setIsGeneratingPlaylistVariants(true);
      const response = await apiService.generateAllPlaylistVariants();
      
      const results = (response as any).results || {};
      const totalVariants = results.variants_created || 0;
      
      toast({
        title: 'Success',
        description: `Generated ${totalVariants} playlist variants successfully`,
      });
    } catch (error: any) {
      console.error('Failed to generate playlist variants:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate playlist variants',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPlaylistVariants(false);
    }
  };

  const renderUtilitiesSettings = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
          <Wrench className="w-5 h-5 text-purple-600" />
        </div>
        <div>
          <h3 className="text-lg font-medium">Utilities & Jobs</h3>
          <p className="text-sm text-gray-500">Background tasks and maintenance operations</p>
        </div>
      </div>

      {/* Image Variant Generation */}
      <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-purple-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Image Variant Generation
            </h4>
            <p className="text-sm text-purple-700 mt-1">
              Generate resolution-optimized variants for all images to match your configured display sizes.
              This improves performance on display devices.
            </p>
          </div>
          <Button
            onClick={handleGenerateImageVariants}
            disabled={isGeneratingImageVariants}
            variant="outline"
            className="border-purple-300 text-purple-700 hover:bg-purple-100"
          >
            {isGeneratingImageVariants ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Image Variants
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Playlist Variant Generation */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-medium text-indigo-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Playlist Variant Generation
            </h4>
            <p className="text-sm text-indigo-700 mt-1">
              Generate resolution-optimized variants for all images in all playlists.
              This pre-generates variants for efficient playlist serving.
            </p>
          </div>
          <Button
            onClick={handleGeneratePlaylistVariants}
            disabled={isGeneratingPlaylistVariants}
            variant="outline"
            className="border-indigo-300 text-indigo-700 hover:bg-indigo-100"
          >
            {isGeneratingPlaylistVariants ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Playlist Variants
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">Automatic Variant Generation</p>
            <p className="text-blue-700">
              Variants are automatically generated when you modify display sizes in Settings.
              Use these buttons to manually regenerate variants if needed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'general', label: 'General', icon: Monitor },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'admin', label: 'Admin', icon: User },
    { id: 'oauth', label: 'OAuth', icon: Key },
    { id: 'displays', label: 'Displays', icon: Monitor },
    { id: 'utilities', label: 'Utilities', icon: Wrench }
  ];

  // Mobile layout with collapsible sections
  if (isMobileView) {
    return (
      <MobileSettingsWrapper
        onSave={handleSaveSettings}
        isLoading={isLoading}
        hasChanges={true}
      >
        <div className="space-y-4">
          <SettingsSection
            title="General Settings"
            description="Server and display configuration"
            icon={<Monitor className="w-5 h-5" />}
            defaultExpanded={activeTab === 'general'}
          >
            {renderGeneralSettings()}
          </SettingsSection>

          <SettingsSection
            title="User Management"
            description="Manage users and permissions"
            icon={<Users className="w-5 h-5" />}
            defaultExpanded={activeTab === 'users'}
          >
            <UserManagement />
          </SettingsSection>

          <SettingsSection
            title="Database Configuration"
            description="MySQL database connection settings"
            icon={<Database className="w-5 h-5" />}
            defaultExpanded={activeTab === 'database'}
          >
            {renderDatabaseSettings()}
          </SettingsSection>

          <SettingsSection
            title="Admin Settings"
            description="Admin password and security"
            icon={<Shield className="w-5 h-5" />}
            defaultExpanded={activeTab === 'admin'}
          >
            {renderAdminSettings()}
          </SettingsSection>

          <SettingsSection
            title="OAuth Configuration"
            description="Google OAuth settings"
            icon={<Key className="w-5 h-5" />}
            defaultExpanded={activeTab === 'oauth'}
          >
            {renderOAuthSettings()}
          </SettingsSection>

          <SettingsSection
            title="Display Settings"
            description="Display sizes and resolutions"
            icon={<Monitor className="w-5 h-5" />}
            defaultExpanded={activeTab === 'displays'}
          >
            {renderDisplaySettings()}
          </SettingsSection>

          <SettingsSection
            title="Utilities"
            description="Background tasks and maintenance"
            icon={<Wrench className="w-5 h-5" />}
            defaultExpanded={activeTab === 'utilities'}
          >
            {renderUtilitiesSettings()}
          </SettingsSection>
        </div>

        {/* Regeneration Progress Modal */}
        {regenerationTaskId && (
          <RegenerationProgressModal
            isOpen={showProgressModal}
            onClose={() => {
              setShowProgressModal(false);
              loadVariantStatus(); // Refresh variant status after regeneration
            }}
            taskId={regenerationTaskId}
            initialProgress={initialProgress}
          />
        )}

        {/* Variant Deletion Confirmation Modal */}
        {showVariantDeletionModal && resolutionToRemove && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Remove Resolution & Delete Variants?
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Removing <span className="font-mono font-semibold">{resolutionToRemove.resolution}</span> will delete all generated variants for this resolution, including:
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1 ml-4 mb-4">
                    <li>• Scaled image files for all images</li>
                    <li>• Playlist variants for all playlists</li>
                  </ul>
                  <p className="text-sm text-red-600 font-medium">
                    This action cannot be undone. The variants will be deleted when you save settings.
                  </p>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <Button
                  onClick={cancelRemoveResolution}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmRemoveResolution}
                  variant="destructive"
                  className="bg-red-600 hover:bg-red-700"
                >
                  Remove & Delete Variants
                </Button>
              </div>
            </div>
          </div>
        )}
      </MobileSettingsWrapper>
    );
  }

  // Desktop layout with tabs
  return (
    <div className="space-y-8">
      {/* Content based on route */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm animate-fade-in-up">
        <CardContent className="p-6">
          {activeTab === 'general' && renderGeneralSettings()}
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'database' && renderDatabaseSettings()}
          {activeTab === 'admin' && renderAdminSettings()}
          {activeTab === 'oauth' && renderOAuthSettings()}
          {activeTab === 'displays' && renderDisplaySettings()}
          {activeTab === 'utilities' && renderUtilitiesSettings()}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSaveSettings}
          disabled={isLoading}
          className="shadow-lg"
        >
          <Save className="w-4 h-4 mr-2" />
          {isLoading ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>

      {/* Regeneration Progress Modal */}
      {regenerationTaskId && (
        <RegenerationProgressModal
          isOpen={showProgressModal}
          onClose={() => {
            setShowProgressModal(false);
            loadVariantStatus(); // Refresh variant status after regeneration
          }}
          taskId={regenerationTaskId}
          initialProgress={initialProgress}
        />
      )}

      {/* Variant Deletion Confirmation Modal */}
      {showVariantDeletionModal && resolutionToRemove && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Remove Resolution & Delete Variants?
                </h3>
                <p className="text-sm text-gray-600 mb-3">
                  Removing <span className="font-mono font-semibold">{resolutionToRemove.resolution}</span> will delete all generated variants for this resolution, including:
                </p>
                <ul className="text-sm text-gray-600 space-y-1 ml-4 mb-4">
                  <li>• Scaled image files for all images</li>
                  <li>• Playlist variants for all playlists</li>
                </ul>
                <p className="text-sm text-red-600 font-medium">
                  This action cannot be undone. The variants will be deleted when you save settings.
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                onClick={cancelRemoveResolution}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={confirmRemoveResolution}
                variant="destructive"
                className="bg-red-600 hover:bg-red-700"
              >
                Remove & Delete Variants
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
