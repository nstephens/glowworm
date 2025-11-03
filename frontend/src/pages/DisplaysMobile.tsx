import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Plus, 
  Search, 
  Filter,
  RefreshCw,
  Trash2,
  CheckCircle,
  X,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '../components/ui/dialog';
import { MobileDeviceCard } from '../components/devices/MobileDeviceCard';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';
import { apiService } from '../services/api';
import { urlResolver } from '../services/urlResolver';
import { displayLogger } from '../utils/logger';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { Playlist } from '../types';

interface DisplayDevice {
  id: number;
  device_token: string;
  device_name?: string;
  device_identifier?: string;
  status: 'pending' | 'authorized' | 'rejected' | 'offline';
  playlist_id?: number;
  playlist_name?: string;
  authorized_at?: string;
  last_seen: string;
  created_at: string;
  updated_at: string;
}

const DisplaysMobile: React.FC = () => {
  const navigate = useNavigate();
  const { isMobile } = useResponsiveLayout();
  
  // Device state
  const [devices, setDevices] = useState<DisplayDevice[]>([]);
  const [filteredDevices, setFilteredDevices] = useState<DisplayDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter and search state
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'pending' | 'rejected' | 'offline'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'lastSeen' | 'created'>('lastSeen');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Modal states
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<DisplayDevice | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [selectedDevices, setSelectedDevices] = useState<Set<number>>(new Set());
  
  // Playlist state
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  // Fetch devices
  const fetchDevices = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(urlResolver.getApiUrl('/display-devices/admin/devices'), {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setDevices(data);
        setError(null);
      } else {
        throw new Error('Failed to fetch devices');
      }
    } catch (err) {
      displayLogger.error('Failed to fetch devices:', err);
      setError('Failed to load devices');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch playlists
  const fetchPlaylists = async () => {
    try {
      const response = await apiService.getPlaylists();
      setPlaylists(response.data || []);
    } catch (err) {
      displayLogger.error('Failed to fetch playlists:', err);
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchPlaylists();
  }, []);

  // Filter and sort devices
  useEffect(() => {
    let filtered = [...devices];

    // Filter by tab
    if (activeTab !== 'all') {
      filtered = filtered.filter(device => {
        switch (activeTab) {
          case 'active':
            return device.status === 'authorized';
          case 'pending':
            return device.status === 'pending';
          case 'rejected':
            return device.status === 'rejected';
          case 'offline':
            return device.status === 'offline';
          default:
            return true;
        }
      });
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(device => 
        device.device_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.device_identifier?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        device.device_token.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Sort devices
    filtered.sort((a, b) => {
      let aValue: any, bValue: any;
      
      switch (sortBy) {
        case 'name':
          aValue = a.device_name || `Device ${a.id}`;
          bValue = b.device_name || `Device ${b.id}`;
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'lastSeen':
          aValue = new Date(a.last_seen).getTime();
          bValue = new Date(b.last_seen).getTime();
          break;
        case 'created':
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    setFilteredDevices(filtered);
  }, [devices, activeTab, searchTerm, sortBy, sortOrder]);

  const getTabCounts = () => {
    return {
      all: devices.length,
      active: devices.filter(d => d.status === 'authorized').length,
      pending: devices.filter(d => d.status === 'pending').length,
      rejected: devices.filter(d => d.status === 'rejected').length,
      offline: devices.filter(d => d.status === 'offline').length
    };
  };

  const handleAuthorizeDevice = async (device: DisplayDevice) => {
    try {
      const response = await fetch(`${urlResolver.getApiUrl()}/display-devices/admin/devices/${device.id}/authorize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          device_name: device.device_name || `Device ${device.id}`,
          device_identifier: device.device_identifier || '',
        }),
      });

      if (response.ok) {
        await fetchDevices();
      } else {
        throw new Error('Failed to authorize device');
      }
    } catch (err) {
      displayLogger.error('Failed to authorize device:', err);
      setError('Failed to authorize device');
    }
  };

  const handleRejectDevice = async (device: DisplayDevice) => {
    try {
      const response = await fetch(`${urlResolver.getApiUrl()}/display-devices/admin/devices/${device.id}/reject`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        await fetchDevices();
      } else {
        throw new Error('Failed to reject device');
      }
    } catch (err) {
      displayLogger.error('Failed to reject device:', err);
      setError('Failed to reject device');
    }
  };

  const handleDeleteDevice = async (device: DisplayDevice) => {
    try {
      const response = await fetch(`${urlResolver.getApiUrl()}/display-devices/admin/devices/${device.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        await fetchDevices();
        setShowDeleteModal(false);
        setDeviceToDelete(null);
      } else {
        throw new Error('Failed to delete device');
      }
    } catch (err) {
      displayLogger.error('Failed to delete device:', err);
      setError('Failed to delete device');
    }
  };

  const handleBulkDelete = async () => {
    try {
      const deletePromises = Array.from(selectedDevices).map(deviceId => 
        fetch(`${urlResolver.getApiUrl()}/display-devices/admin/devices/${deviceId}`, {
          method: 'DELETE',
          credentials: 'include',
        })
      );

      await Promise.all(deletePromises);
      await fetchDevices();
      setSelectedDevices(new Set());
      setShowBulkDeleteModal(false);
    } catch (err) {
      displayLogger.error('Failed to delete devices:', err);
      setError('Failed to delete devices');
    }
  };

  const handleRefreshDevice = async (device: DisplayDevice) => {
    try {
      const response = await fetch(`${urlResolver.getApiUrl()}/display-devices/admin/devices/${device.id}/refresh`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        // Show success feedback
        if (navigator.vibrate) {
          navigator.vibrate(50);
        }
      } else {
        throw new Error('Failed to refresh device');
      }
    } catch (err) {
      displayLogger.error('Failed to refresh device:', err);
      setError('Failed to refresh device');
    }
  };

  const handleAssignPlaylist = (device: DisplayDevice) => {
    // Navigate to playlist assignment or open modal
    navigate(`/admin/devices/${device.id}/playlist`);
  };

  const handleEditDevice = (device: DisplayDevice) => {
    navigate(`/admin/devices/${device.id}/edit`);
  };

  const handleSwipeLeft = (device: DisplayDevice) => {
    setDeviceToDelete(device);
    setShowDeleteModal(true);
  };

  const handleSwipeRight = (device: DisplayDevice) => {
    handleEditDevice(device);
  };

  const tabs = [
    { id: 'all', label: 'All', icon: null },
    { id: 'active', label: 'Active', icon: <CheckCircle className="w-4 h-4" /> },
    { id: 'pending', label: 'Pending', icon: <Clock className="w-4 h-4" /> },
    { id: 'rejected', label: 'Rejected', icon: <X className="w-4 h-4" /> },
    { id: 'offline', label: 'Offline', icon: <AlertTriangle className="w-4 h-4" /> }
  ];

  const counts = getTabCounts();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <Button 
            onClick={fetchDevices}
            className="mt-2"
            variant="destructive"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-lg sticky top-0 z-10 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/admin')}
                className="p-2"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-semibold text-gray-900">Devices</h1>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchDevices}
                className="p-2"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                onClick={() => navigate('/admin/devices/add')}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Device
              </Button>
            </div>
          </div>

          {/* Search and Filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search devices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                  <SelectItem value="lastSeen">Last Seen</SelectItem>
                  <SelectItem value="created">Created</SelectItem>
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-3"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="pt-2">
          <div className="flex flex-wrap gap-1 bg-gray-100 rounded-lg p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <Badge variant="secondary" className="ml-1 text-xs">
                  {counts[tab.id as keyof typeof counts]}
                </Badge>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div>
        {filteredDevices.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No devices found
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm 
                ? 'Try adjusting your search terms'
                : activeTab === 'all' 
                  ? 'No devices have been registered yet'
                  : `No ${activeTab} devices found`
              }
            </p>
            {!searchTerm && activeTab === 'all' && (
              <Button onClick={() => navigate('/admin/devices/add')}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Device
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {filteredDevices.map((device) => (
                <motion.div
                  key={device.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <MobileDeviceCard
                    device={device}
                    onAuthorize={handleAuthorizeDevice}
                    onReject={handleRejectDevice}
                    onEdit={handleEditDevice}
                    onDelete={(device) => {
                      setDeviceToDelete(device);
                      setShowDeleteModal(true);
                    }}
                    onRefresh={handleRefreshDevice}
                    onAssignPlaylist={handleAssignPlaylist}
                    onSwipeLeft={handleSwipeLeft}
                    onSwipeRight={handleSwipeRight}
                    enableSwipe={true}
                    hapticFeedback={true}
                    compact={true}
                    minimal={true}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
        {/* Spacer to ensure content never sits under the bottom nav */}
        <div style={{ height: '80px' }} aria-hidden="true" />
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Device</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this device? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deviceToDelete && handleDeleteDevice(deviceToDelete)}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DisplaysMobile;
