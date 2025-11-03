import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, Filter, RefreshCw, AlertCircle, Info, AlertTriangle, Bug, Zap, Copy, CheckCircle2 } from 'lucide-react';
import { urlResolver } from '../services/urlResolver';

interface DeviceLog {
  id: number;
  device_id: number;
  device_name: string | null;
  device_token: string;
  log_level: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  message: string;
  context: any;
  created_at: string;
}

const DisplayLogs: React.FC = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<DeviceLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
  const [selectedLogLevel, setSelectedLogLevel] = useState<string>('');
  const [deviceNameFilter, setDeviceNameFilter] = useState<string>('');
  const [limit, setLimit] = useState<number>(100);
  
  // Selection and export
  const [selectedLogIds, setSelectedLogIds] = useState<Set<number>>(new Set());
  const [showCopied, setShowCopied] = useState(false);
  
  // Get unique devices from logs for filtering
  const uniqueDevices = Array.from(new Map(
    logs.map(log => [log.device_id, { id: log.device_id, name: log.device_name, token: log.device_token }])
  ).values());

  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      
      // Build query parameters
      const params = new URLSearchParams();
      if (selectedDeviceId) params.append('device_id', selectedDeviceId.toString());
      if (selectedLogLevel) params.append('log_level', selectedLogLevel);
      if (deviceNameFilter) params.append('device_name', deviceNameFilter);
      params.append('limit', limit.toString());
      
      const url = urlResolver.getApiUrl(`/display-devices/admin/logs?${params.toString()}`);
      const response = await fetch(url, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data);
        setError(null);
      } else {
        throw new Error('Failed to fetch logs');
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
      setError('Failed to load device logs');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // Clear selection when filters change
    setSelectedLogIds(new Set());
  }, [selectedDeviceId, selectedLogLevel, deviceNameFilter, limit]);

  // Selection handlers
  const toggleLogSelection = (logId: number) => {
    setSelectedLogIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLogIds.size === logs.length) {
      setSelectedLogIds(new Set());
    } else {
      setSelectedLogIds(new Set(logs.map(log => log.id)));
    }
  };

  const clearSelection = () => {
    setSelectedLogIds(new Set());
  };

  // Export selected logs to clipboard
  const exportSelectedLogs = async () => {
    const selectedLogs = logs.filter(log => selectedLogIds.has(log.id));
    
    if (selectedLogs.length === 0) {
      return;
    }

    // Format logs for export
    const exportText = selectedLogs.map(log => {
      let text = `[${log.log_level.toUpperCase()}] ${formatTimestamp(log.created_at)}\n`;
      text += `Device: ${log.device_name || log.device_token}\n`;
      text += `Message: ${log.message}\n`;
      
      if (log.context && Object.keys(log.context).length > 0) {
        text += `Context:\n${JSON.stringify(log.context, null, 2)}\n`;
      }
      
      return text;
    }).join('\n' + '='.repeat(80) + '\n\n');

    // Add header
    const header = `Display Device Logs Export\n`;
    const header2 = `Exported: ${new Date().toLocaleString()}\n`;
    const header3 = `Total logs: ${selectedLogs.length}\n`;
    const fullExport = header + header2 + header3 + '='.repeat(80) + '\n\n' + exportText;

    // Copy to clipboard with fallback for non-secure contexts
    try {
      // Try modern Clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullExport);
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
      } else {
        // Fallback for browsers without Clipboard API (or non-HTTPS)
        const textArea = document.createElement('textarea');
        textArea.value = fullExport;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          const successful = document.execCommand('copy');
          if (successful) {
            setShowCopied(true);
            setTimeout(() => setShowCopied(false), 2000);
          } else {
            throw new Error('Copy command was unsuccessful');
          }
        } finally {
          document.body.removeChild(textArea);
        }
      }
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      
      // Last resort: show the text in an alert so user can manually copy
      if (confirm('Unable to copy automatically. Click OK to see the logs in a popup where you can manually copy them.')) {
        const popup = window.open('', 'Log Export', 'width=800,height=600');
        if (popup) {
          popup.document.write('<pre style="white-space: pre-wrap; word-wrap: break-word; font-family: monospace; padding: 20px;">');
          popup.document.write(fullExport.replace(/</g, '&lt;').replace(/>/g, '&gt;'));
          popup.document.write('</pre>');
          popup.document.close();
        } else {
          alert('Failed to copy logs to clipboard. Please allow popups and try again.');
        }
      }
    }
  };

  const getLogLevelIcon = (level: string) => {
    switch (level) {
      case 'debug':
        return <Bug className="w-4 h-4" />;
      case 'info':
        return <Info className="w-4 h-4" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4" />;
      case 'error':
        return <AlertCircle className="w-4 h-4" />;
      case 'critical':
        return <Zap className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  const getLogLevelBadgeClass = (level: string) => {
    const baseClasses = "flex items-center gap-1";
    switch (level) {
      case 'debug':
        return `${baseClasses} bg-gray-100 text-gray-800`;
      case 'info':
        return `${baseClasses} bg-blue-100 text-blue-800`;
      case 'warning':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'error':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'critical':
        return `${baseClasses} bg-purple-100 text-purple-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (isLoading && logs.length === 0) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button 
            onClick={fetchLogs}
            className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin/displays')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Displays
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Display Device Logs</h1>
            <p className="text-gray-600">Remote troubleshooting logs from display devices</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {selectedLogIds.size > 0 && (
            <>
              <Button
                variant="outline"
                onClick={clearSelection}
                className="flex items-center gap-2"
              >
                Clear ({selectedLogIds.size})
              </Button>
              <Button
                onClick={exportSelectedLogs}
                disabled={selectedLogIds.size === 0}
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
                    Export ({selectedLogIds.size})
                  </>
                )}
              </Button>
            </>
          )}
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
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Device
              </label>
              <select
                value={selectedDeviceId || ''}
                onChange={(e) => setSelectedDeviceId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Log Level
              </label>
              <select
                value={selectedLogLevel}
                onChange={(e) => setSelectedLogLevel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Levels</option>
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Device Name
              </label>
              <input
                type="text"
                value={deviceNameFilter}
                onChange={(e) => setDeviceNameFilter(e.target.value)}
                placeholder="Search by name..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Limit
              </label>
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
                <option value="500">500</option>
                <option value="1000">1000</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logs Display */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Logs ({logs.length})</CardTitle>
            {logs.length > 0 && (
              <p className="text-sm text-gray-600">
                Latest: {formatRelativeTime(logs[0].created_at)}
              </p>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No logs found matching the current filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={logs.length > 0 && selectedLogIds.size === logs.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                        title="Select all logs"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Level
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Device
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Message
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Context
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr 
                      key={log.id} 
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => toggleLogSelection(log.id)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedLogIds.has(log.id)}
                          onChange={() => toggleLogSelection(log.id)}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
                          title="Select log"
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Badge className={getLogLevelBadgeClass(log.log_level)}>
                          {getLogLevelIcon(log.log_level)}
                          <span className="uppercase text-xs font-semibold">{log.log_level}</span>
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {log.device_name || `Device ${log.device_token.substring(0, 8)}...`}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900" onClick={(e) => {
                        // Stop propagation if clicking on details element
                        if ((e.target as HTMLElement).closest('details')) {
                          e.stopPropagation();
                        }
                      }}>
                        <div className="max-w-md">
                          {log.message.length > 100 ? (
                            <details className="cursor-pointer">
                              <summary className="hover:text-blue-600">
                                {log.message.substring(0, 100)}...
                              </summary>
                              <div className="mt-2 whitespace-pre-wrap">{log.message}</div>
                            </details>
                          ) : (
                            log.message
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        <div className="flex flex-col">
                          <span className="text-xs text-gray-500">{formatRelativeTime(log.created_at)}</span>
                          <span className="text-xs text-gray-400">{formatTimestamp(log.created_at)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm" onClick={(e) => {
                        // Stop propagation if clicking on details element
                        if ((e.target as HTMLElement).closest('details')) {
                          e.stopPropagation();
                        }
                      }}>
                        {log.context && Object.keys(log.context).length > 0 ? (
                          <details className="cursor-pointer">
                            <summary className="text-blue-600 hover:text-blue-800 text-xs">
                              View ({Object.keys(log.context).length} items)
                            </summary>
                            <div className="mt-2 p-2 bg-gray-50 rounded max-w-xs">
                              <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                                {JSON.stringify(log.context, null, 2)}
                              </pre>
                            </div>
                          </details>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
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
  );
};

export default DisplayLogs;

