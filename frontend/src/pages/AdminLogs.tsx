import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, RefreshCw, AlertCircle, Info, AlertTriangle, Bug, Zap, Filter, Copy, CheckCircle2, Monitor, Server, Globe, User, Trash2 } from 'lucide-react';
import { urlResolver } from '../services/urlResolver';
import { useToast } from '../hooks/use-toast';

interface DeviceLog {
  id: number;
  device_id: number;
  device_name: string | null;
  device_token: string;
  log_level: string;
  message: string;
  context: any;
  created_at: string;
}

interface UserLog {
  id: number;
  user_id: number | null;
  username: string | null;
  log_level: string;
  action: string;
  message: string;
  context: any;
  url: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface FileLog {
  line_number: number;
  timestamp: string;
  level: string;
  logger_name?: string;
  message: string;
}

type LogTab = 'display' | 'backend' | 'frontend' | 'user';

const AdminLogs: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<LogTab>('display');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  
  // Display logs
  const [displayLogs, setDisplayLogs] = useState<DeviceLog[]>([]);
  const [displayFilters, setDisplayFilters] = useState({
    deviceId: null as number | null,
    logLevel: '',
    limit: 100
  });
  
  // Get unique devices from display logs for filtering
  const uniqueDevices = Array.from(new Map(
    displayLogs.map(log => [log.device_id, { id: log.device_id, name: log.device_name, token: log.device_token }])
  ).values());
  
  // User logs
  const [userLogs, setUserLogs] = useState<UserLog[]>([]);
  const [userFilters, setUserFilters] = useState({
    userId: null as number | null,
    username: '',
    logLevel: '',
    action: '',
    limit: 100
  });
  
  // File logs (backend/frontend)
  const [fileLogs, setFileLogs] = useState<FileLog[]>([]);
  const [fileLogLines, setFileLogLines] = useState(1000);
  
  // Selection and export
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
  const [showCopied, setShowCopied] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [activeTab]);

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSelectedIds(new Set());

      switch (activeTab) {
        case 'display':
          await fetchDisplayLogs();
          break;
        case 'backend':
          await fetchBackendLogs();
          break;
        case 'frontend':
          await fetchFrontendLogs();
          break;
        case 'user':
          await fetchUserLogs();
          break;
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
      setError('Failed to load logs');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDisplayLogs = async (overrideFilters?: Partial<typeof displayFilters>) => {
    const filters = { ...displayFilters, ...overrideFilters };
    const params = new URLSearchParams();
    if (filters.deviceId) params.append('device_id', filters.deviceId.toString());
    if (filters.logLevel) params.append('log_level', filters.logLevel);
    params.append('limit', filters.limit.toString());

    console.log('[DISPLAY_LOGS] Fetching with filter:', filters.logLevel);

    const response = await fetch(urlResolver.getApiUrl(`/display-devices/admin/logs?${params}`), {
      credentials: 'include',
    });

    if (!response.ok) throw new Error('Failed to fetch display logs');
    const data = await response.json();
    console.log('[DISPLAY_LOGS] Received', data.length, 'logs');
    if (data.length > 0) {
      console.log('[DISPLAY_LOGS] First 3 log levels:', data.slice(0, 3).map((l: any) => l.log_level));
    }
    setDisplayLogs(data);
  };

  const fetchUserLogs = async () => {
    const params = new URLSearchParams();
    if (userFilters.userId) params.append('user_id', userFilters.userId.toString());
    if (userFilters.username) params.append('username', userFilters.username);
    if (userFilters.logLevel) params.append('log_level', userFilters.logLevel);
    if (userFilters.action) params.append('action', userFilters.action);
    params.append('limit', userFilters.limit.toString());

    const response = await fetch(urlResolver.getApiUrl(`/logs/user?${params}`), {
      credentials: 'include',
    });

    if (!response.ok) throw new Error('Failed to fetch user logs');
    const data = await response.json();
    setUserLogs(data);
  };

  const fetchBackendLogs = async () => {
    const response = await fetch(urlResolver.getApiUrl(`/logs/backend?lines=${fileLogLines}`), {
      credentials: 'include',
    });

    if (!response.ok) throw new Error('Failed to fetch backend logs');
    const data = await response.json();
    setFileLogs(data.logs || []);
  };

  const fetchFrontendLogs = async () => {
    const response = await fetch(urlResolver.getApiUrl(`/logs/frontend?lines=${fileLogLines}`), {
      credentials: 'include',
    });

    if (!response.ok) throw new Error('Failed to fetch frontend logs');
    const data = await response.json();
    setFileLogs(data.logs || []);
  };

  const toggleSelection = (id: number | string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (activeTab === 'display') {
      if (selectedIds.size === displayLogs.length) {
        setSelectedIds(new Set());
      } else {
        setSelectedIds(new Set(displayLogs.map(log => log.id)));
      }
    } else if (activeTab === 'user') {
      if (selectedIds.size === userLogs.length) {
        setSelectedIds(new Set());
      } else {
        setSelectedIds(new Set(userLogs.map(log => log.id)));
      }
    } else {
      // For file logs, use line numbers
      if (selectedIds.size === fileLogs.length) {
        setSelectedIds(new Set());
      } else {
        setSelectedIds(new Set(fileLogs.map(log => log.line_number)));
      }
    }
  };

  const exportLogs = async () => {
    let exportText = '';

    if (activeTab === 'display') {
      const selected = displayLogs.filter(log => selectedIds.has(log.id));
      exportText = selected.map(log => {
        let text = `[${log.log_level.toUpperCase()}] ${new Date(log.created_at).toLocaleString()}\n`;
        text += `Device: ${log.device_name || log.device_token}\n`;
        text += `Message: ${log.message}\n`;
        if (log.context) text += `Context:\n${JSON.stringify(log.context, null, 2)}\n`;
        return text;
      }).join('\n' + '='.repeat(80) + '\n\n');
    } else if (activeTab === 'user') {
      const selected = userLogs.filter(log => selectedIds.has(log.id));
      exportText = selected.map(log => {
        let text = `[${log.log_level.toUpperCase()}] [${log.action}] ${new Date(log.created_at).toLocaleString()}\n`;
        text += `User: ${log.username || 'Anonymous'}\n`;
        text += `Message: ${log.message}\n`;
        if (log.url) text += `URL: ${log.url}\n`;
        if (log.context) text += `Context:\n${JSON.stringify(log.context, null, 2)}\n`;
        return text;
      }).join('\n' + '='.repeat(80) + '\n\n');
    } else {
      const selected = fileLogs.filter(log => selectedIds.has(log.line_number));
      exportText = selected.map(log => 
        `[${log.level}] ${log.timestamp} ${log.logger_name || ''} - ${log.message}`
      ).join('\n');
    }

    const header = `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Logs Export\n`;
    const header2 = `Exported: ${new Date().toLocaleString()}\n`;
    const header3 = `Total logs: ${selectedIds.size}\n`;
    const fullExport = header + header2 + header3 + '='.repeat(80) + '\n\n' + exportText;

    // Copy to clipboard with fallback
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullExport);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = fullExport;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
      }
    } catch (err) {
      alert('Failed to copy logs to clipboard');
    }
  };

  const getLogIcon = (level: string) => {
    switch (level.toLowerCase()) {
      case 'debug':
        return <Bug className="w-4 h-4" />;
      case 'info':
        return <Info className="w-4 h-4" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />;
      case 'error':
      case 'critical':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const getLogBadgeClass = (level: string) => {
    const baseClasses = "flex items-center gap-1";
    switch (level.toLowerCase()) {
      case 'debug':
        return `${baseClasses} bg-gray-100 text-gray-800`;
      case 'info':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case 'warning':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'error':
      case 'critical':
        return `${baseClasses} bg-red-100 text-red-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const clearCurrentTabLogs = async () => {
    if (!confirm(`Are you sure you want to clear all ${activeTab} logs? This action cannot be undone.`)) {
      return;
    }

    try {
      setIsClearing(true);
      let endpoint = '';
      
      switch (activeTab) {
        case 'display':
          endpoint = '/display-devices/admin/logs';
          break;
        case 'backend':
          endpoint = '/logs/backend';
          break;
        case 'frontend':
          endpoint = '/logs/frontend';
          break;
        case 'user':
          endpoint = '/logs/user';
          break;
      }

      const response = await fetch(urlResolver.getApiUrl(endpoint), {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to clear logs');
      
      const data = await response.json();
      
      toast({
        title: 'Logs Cleared',
        description: data.message || `${activeTab} logs cleared successfully`,
      });

      // Refresh the logs
      await fetchLogs();
      
    } catch (err) {
      console.error('Failed to clear logs:', err);
      toast({
        title: 'Error',
        description: 'Failed to clear logs',
        variant: 'destructive',
      });
    } finally {
      setIsClearing(false);
    }
  };

  const clearAllLogs = async () => {
    if (!confirm('Are you sure you want to clear ALL logs (display, user, backend, frontend)? This action cannot be undone.')) {
      return;
    }

    try {
      setIsClearing(true);

      const response = await fetch(urlResolver.getApiUrl('/logs/all'), {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to clear all logs');
      
      const data = await response.json();
      
      toast({
        title: 'All Logs Cleared',
        description: data.message || 'All logs cleared successfully',
      });

      // Refresh the current tab
      await fetchLogs();
      
    } catch (err) {
      console.error('Failed to clear all logs:', err);
      toast({
        title: 'Error',
        description: 'Failed to clear all logs',
        variant: 'destructive',
      });
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex items-center justify-end gap-2">
          {selectedIds.size > 0 && (
            <Button
              onClick={exportLogs}
              className="flex items-center gap-2"
            >
              {showCopied ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Export ({selectedIds.size})
                </>
              )}
            </Button>
          )}
          <Button
            onClick={clearAllLogs}
            disabled={isClearing || isLoading}
            variant="destructive"
            className="flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear All Logs
          </Button>
          <Button
            onClick={fetchLogs}
            disabled={isLoading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('display')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'display'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Monitor className="w-4 h-4" />
            Display Devices
          </button>
          <button
            onClick={() => setActiveTab('backend')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'backend'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Server className="w-4 h-4" />
            Backend
          </button>
          <button
            onClick={() => setActiveTab('frontend')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'frontend'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Globe className="w-4 h-4" />
            Frontend
          </button>
          <button
            onClick={() => setActiveTab('user')}
            className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
              activeTab === 'user'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <User className="w-4 h-4" />
            User Activity
          </button>
        </nav>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Display Logs Tab */}
      {activeTab === 'display' && (
        <div className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="w-4 h-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Device</label>
                  <select
                    value={displayFilters.deviceId || ''}
                    onChange={(e) => {
                      const newDeviceId = e.target.value ? parseInt(e.target.value) : null;
                      setDisplayFilters({ ...displayFilters, deviceId: newDeviceId });
                      setDisplayLogs([]); // Clear stale data immediately
                      fetchDisplayLogs({ deviceId: newDeviceId }); // Pass new value directly
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">All Devices</option>
                    {uniqueDevices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name || `Device ${device.token.substring(0, 8)}...`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Log Level</label>
                  <select
                    value={displayFilters.logLevel}
                    onChange={(e) => {
                      const newLevel = e.target.value;
                      setDisplayFilters({ ...displayFilters, logLevel: newLevel });
                      setDisplayLogs([]); // Clear stale data immediately
                      fetchDisplayLogs({ logLevel: newLevel }); // Pass new value directly
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">All Levels</option>
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Limit</label>
                  <select
                    value={displayFilters.limit}
                    onChange={(e) => {
                      const newLimit = parseInt(e.target.value);
                      setDisplayFilters({ ...displayFilters, limit: newLimit });
                      fetchDisplayLogs({ limit: newLimit }); // Pass new value directly
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="500">500</option>
                    <option value="1000">1000</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Display Logs Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Device Logs ({displayLogs.length})</CardTitle>
                <Button
                  onClick={clearCurrentTabLogs}
                  disabled={isClearing || isLoading || displayLogs.length === 0}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear Display Logs
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {displayLogs.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No logs found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={displayLogs.length > 0 && selectedIds.size === displayLogs.length}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Level</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Device</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Message</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {displayLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleSelection(log.id)}>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(log.id)}
                              onChange={() => toggleSelection(log.id)}
                              className="w-4 h-4 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Badge className={getLogBadgeClass(log.log_level)}>
                              {getLogIcon(log.log_level)}
                              <span className="uppercase text-xs">{log.log_level}</span>
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm">{log.device_name || log.device_token.substring(0, 8)}</td>
                          <td className="px-4 py-3 text-sm max-w-md truncate">{log.message}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* User Logs Tab */}
      {activeTab === 'user' && (
        <div className="space-y-4">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="w-4 h-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                  <input
                    type="text"
                    value={userFilters.username}
                    onChange={(e) => setUserFilters({ ...userFilters, username: e.target.value })}
                    onBlur={fetchUserLogs}
                    placeholder="Search..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                  <select
                    value={userFilters.action}
                    onChange={(e) => {
                      setUserFilters({ ...userFilters, action: e.target.value });
                      setTimeout(fetchUserLogs, 100);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">All Actions</option>
                    <option value="login">Login</option>
                    <option value="logout">Logout</option>
                    <option value="create">Create</option>
                    <option value="update">Update</option>
                    <option value="delete">Delete</option>
                    <option value="view">View</option>
                    <option value="upload">Upload</option>
                    <option value="error">Error</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Log Level</label>
                  <select
                    value={userFilters.logLevel}
                    onChange={(e) => {
                      const newLevel = e.target.value;
                      setUserFilters({ ...userFilters, logLevel: newLevel });
                      setUserLogs([]); // Clear stale data immediately
                      setTimeout(fetchUserLogs, 100);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="">All Levels</option>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="error">Error</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Limit</label>
                  <select
                    value={userFilters.limit}
                    onChange={(e) => {
                      setUserFilters({ ...userFilters, limit: parseInt(e.target.value) });
                      setTimeout(fetchUserLogs, 100);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="50">50</option>
                    <option value="100">100</option>
                    <option value="500">500</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* User Logs Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>User Activity ({userLogs.length})</CardTitle>
                <Button
                  onClick={clearCurrentTabLogs}
                  disabled={isClearing || isLoading || userLogs.length === 0}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear User Logs
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {userLogs.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No user logs found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={userLogs.length > 0 && selectedIds.size === userLogs.length}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Level</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Action</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">User</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Message</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {userLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleSelection(log.id)}>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(log.id)}
                              onChange={() => toggleSelection(log.id)}
                              className="w-4 h-4 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <Badge className={getLogBadgeClass(log.log_level)}>
                              {getLogIcon(log.log_level)}
                              <span className="uppercase text-xs">{log.log_level}</span>
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-sm">
                            <Badge variant="outline">{log.action}</Badge>
                          </td>
                          <td className="px-4 py-3 text-sm">{log.username || 'Anonymous'}</td>
                          <td className="px-4 py-3 text-sm max-w-md truncate">{log.message}</td>
                          <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Backend/Frontend Logs Tab (File-based) */}
      {(activeTab === 'backend' || activeTab === 'frontend') && (
        <div className="space-y-4">
          {/* Lines selector */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Show last:</label>
            <select
              value={fileLogLines}
              onChange={(e) => {
                setFileLogLines(parseInt(e.target.value));
                setTimeout(fetchLogs, 100);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="100">100 lines</option>
              <option value="500">500 lines</option>
              <option value="1000">1000 lines</option>
              <option value="5000">5000 lines</option>
            </select>
          </div>

          {/* File Logs Display */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{activeTab === 'backend' ? 'Backend' : 'Frontend'} Logs ({fileLogs.length} lines)</CardTitle>
                <Button
                  onClick={clearCurrentTabLogs}
                  disabled={isClearing || isLoading || fileLogs.length === 0}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Clear {activeTab === 'backend' ? 'Backend' : 'Frontend'} Logs
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {fileLogs.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No logs found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full font-mono text-xs">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={fileLogs.length > 0 && selectedIds.size === fileLogs.length}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 cursor-pointer"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Line</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Time</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Level</th>
                        {activeTab === 'backend' && (
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Logger</th>
                        )}
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-600">Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {fileLogs.map((log) => (
                        <tr key={log.line_number} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleSelection(log.line_number)}>
                          <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(log.line_number)}
                              onChange={() => toggleSelection(log.line_number)}
                              className="w-4 h-4 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-2 text-gray-500">{log.line_number}</td>
                          <td className="px-4 py-2 whitespace-nowrap">{log.timestamp}</td>
                          <td className="px-4 py-2">
                            {log.level && (
                              <Badge className={getLogBadgeClass(log.level)} style={{ fontSize: '10px', padding: '2px 6px' }}>
                                {log.level}
                              </Badge>
                            )}
                          </td>
                          {activeTab === 'backend' && (
                            <td className="px-4 py-2 text-gray-600">{log.logger_name}</td>
                          )}
                          <td className="px-4 py-2">{log.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdminLogs;

