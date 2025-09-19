import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Save, Monitor, Database, User, Key, Plus, Trash2, AlertTriangle, Users, Settings as SettingsIcon, Server, Shield } from 'lucide-react';
import { useAlert } from '../hooks/useAlert';
import AlertContainer from '../components/AlertContainer';
import { apiService } from '../services/api';
import { urlResolver } from '../services/urlResolver';
import { updateLogSettings } from '../utils/logger';
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
  enable_debug_logging: boolean;
  
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
  const { alerts, removeAlert, success, error: showError, warning, info } = useAlert();
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
    enable_debug_logging: false,
    google_client_id: '',
    google_client_secret: '',
    target_display_sizes: []
  });

  const [displaySizes, setDisplaySizes] = useState<DisplaySize[]>([
    { id: '2k-portrait', name: '2K Portrait (1080x1920)', width: 1080, height: 1920, isCustom: false },
    { id: '4k-portrait', name: '4K Portrait (2160x3840)', width: 2160, height: 3840, isCustom: false }
  ]);

  const [newDisplaySize, setNewDisplaySize] = useState({ name: '', width: '', height: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'database' | 'admin' | 'oauth' | 'displays' | 'general' | 'users'>('general');

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await apiService.getSettings();
      if (response.success) {
        setSettings(response.settings);
        // Update urlResolver with the loaded server URL
        if (response.settings.server_base_url) {
          urlResolver.updateServerUrl(response.settings.server_base_url);
        }
        
        // Update log settings
        updateLogSettings({
          logLevel: response.settings.log_level,
          enableDebugLogging: response.settings.enable_debug_logging
        });
        
        info('Settings Loaded', 'Current system settings loaded successfully');
      }
    } catch (err: any) {
      // Settings API not available yet, use defaults
      console.log('Settings API not available, using defaults');
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
        enable_debug_logging: false,
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
      const response = await apiService.updateSettings(settings);
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
        
        success('Settings Saved', 'System settings have been updated successfully');
      }
    } catch (err: any) {
      warning('Settings API Not Available', 'Settings API is not available yet. Changes will be saved when the backend is ready.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDisplaySize = () => {
    if (!newDisplaySize.name.trim() || !newDisplaySize.width || !newDisplaySize.height) {
      warning('Invalid Input', 'Please fill in all fields for the display size');
      return;
    }

    const width = parseInt(newDisplaySize.width);
    const height = parseInt(newDisplaySize.height);

    if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
      warning('Invalid Dimensions', 'Width and height must be positive numbers');
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
    success('Display Size Added', `"${newSize.name}" has been added to the list`);
  };

  const handleRemoveDisplaySize = (id: string) => {
    const size = displaySizes.find(s => s.id === id);
    if (size) {
      setDisplaySizes(prev => prev.filter(s => s.id !== id));
      success('Display Size Removed', `"${size.name}" has been removed from the list`);
    }
  };

  const handleToggleDisplaySize = async (id: string) => {
    // Find the display size object to get dimensions
    const displaySize = displaySizes.find(s => s.id === id);
    if (!displaySize) return;
    
    const dimensionString = `${displaySize.width}x${displaySize.height}`;
    const isSelected = settings.target_display_sizes.includes(dimensionString);
    const newDisplaySizes = isSelected
      ? settings.target_display_sizes.filter(sizeId => sizeId !== dimensionString)
      : [...settings.target_display_sizes, dimensionString];
    
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

  const renderDatabaseSettings = () => (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-chart-1/10 rounded-lg flex items-center justify-center">
          <Database className="w-5 h-5 text-chart-1" />
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
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="mysql_port">MySQL Port</Label>
          <Input
            id="mysql_port"
            name="mysql_port"
            type="number"
            value={settings.mysql_port}
            onChange={handleInputChange}
            required
          />
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="uploads"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Directory for uploaded files (relative to backend root)
          </p>
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="8001"
            min="1024"
            max="65535"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Port for the backend API server
          </p>
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
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="3003"
            min="1024"
            max="65535"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Port for the frontend development server
          </p>
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

        <div>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="enable_debug_logging"
              checked={settings.enable_debug_logging}
              onChange={handleInputChange}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm font-medium text-gray-700">
              Enable Debug Logging
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-1">
            Enable detailed debug logging for development (may impact performance)
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
        <h4 className="text-sm font-medium text-gray-700 mb-3">Selected Display Sizes</h4>
        <div className="space-y-2">
          {displaySizes.map((size) => {
            const dimensionString = `${size.width}x${size.height}`;
            const isSelected = settings.target_display_sizes.includes(dimensionString);
            return (
              <div
                key={size.id}
                className={`flex items-center justify-between p-3 border rounded-lg ${
                  isSelected ? 'border-primary-200 bg-primary-50' : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleToggleDisplaySize(size.id)}
                    className="w-4 h-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{size.name}</div>
                    <div className="text-sm text-gray-500">
                      {size.width} × {size.height} pixels
                    </div>
                  </div>
                </div>
                {size.isCustom && (
                  <button
                    onClick={() => handleRemoveDisplaySize(size.id)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

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
    </div>
  );

  const tabs = [
    { id: 'general', label: 'General', icon: Monitor },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'admin', label: 'Admin', icon: User },
    { id: 'oauth', label: 'OAuth', icon: Key },
    { id: 'displays', label: 'Displays', icon: Monitor }
  ];

  return (
    <div className="space-y-8">
      <AlertContainer alerts={alerts} onRemove={removeAlert} />
      
      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2 h-8 bg-gradient-to-b from-chart-4 to-chart-5 rounded-full" />
          <h1 className="text-3xl font-bold">System Settings</h1>
        </div>
        <p className="text-muted-foreground">Configure system-wide settings and preferences</p>
      </div>

      {/* Tabs */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm">
        <CardContent className="p-0">
          <div className="border-b border-border">
            <nav className="flex space-x-1 p-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <Button
                    key={tab.id}
                    variant={activeTab === tab.id ? "default" : "ghost"}
                    onClick={() => setActiveTab(tab.id as any)}
                    className="flex items-center gap-2 h-10"
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </Button>
                );
              })}
            </nav>
          </div>
        </CardContent>
      </Card>

      {/* Tab Content */}
      <Card className="border-0 shadow-lg bg-card/50 backdrop-blur-sm animate-fade-in-up">
        <CardContent className="p-6">
          {activeTab === 'general' && renderGeneralSettings()}
          {activeTab === 'users' && <UserManagement />}
          {activeTab === 'database' && renderDatabaseSettings()}
          {activeTab === 'admin' && renderAdminSettings()}
          {activeTab === 'oauth' && renderOAuthSettings()}
          {activeTab === 'displays' && renderDisplaySettings()}
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSaveSettings}
          disabled={isLoading}
          className="bg-gradient-to-r from-primary to-primary/90 shadow-lg"
        >
          <Save className="w-4 h-4 mr-2" />
          {isLoading ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
};

export default Settings;
