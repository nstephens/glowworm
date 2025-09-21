import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, X, RotateCcw, Monitor, Wifi, WifiOff, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { apiService } from '../services/api';
import { urlResolver } from '../services/urlResolver';
import { displayLogger } from '../utils/logger';
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

const Displays: React.FC = () => {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<DisplayDevice[]>([]);
  const [activeDevices, setActiveDevices] = useState<DisplayDevice[]>([]);
  const [pendingDevices, setPendingDevices] = useState<DisplayDevice[]>([]);
  const [rejectedDevices, setRejectedDevices] = useState<DisplayDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'active' | 'pending' | 'rejected'>('active');
  
  // Modal states
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [deviceToReject, setDeviceToReject] = useState<DisplayDevice | null>(null);
  const [showAuthorizeModal, setShowAuthorizeModal] = useState(false);
  const [deviceToAuthorize, setDeviceToAuthorize] = useState<DisplayDevice | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [deviceToUpdate, setDeviceToUpdate] = useState<DisplayDevice | null>(null);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const [deviceToAssignPlaylist, setDeviceToAssignPlaylist] = useState<DisplayDevice | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deviceToDelete, setDeviceToDelete] = useState<DisplayDevice | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showRejectFromEditModal, setShowRejectFromEditModal] = useState(false);
  const [deviceToRejectFromEdit, setDeviceToRejectFromEdit] = useState<DisplayDevice | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [deviceToReset, setDeviceToReset] = useState<DisplayDevice | null>(null);
  const [deviceName, setDeviceName] = useState('');
  const [deviceIdentifier, setDeviceIdentifier] = useState('');
  
  // Playlist state
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<number | null>(null);

  // Fetch all devices
  const fetchDevices = async () => {
    try {
      const response = await fetch(urlResolver.getApiUrl('/display-devices/admin/devices'), {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setDevices(data);
        setActiveDevices(data.filter((device: DisplayDevice) => device.status === 'authorized'));
        setPendingDevices(data.filter((device: DisplayDevice) => device.status === 'pending'));
        setRejectedDevices(data.filter((device: DisplayDevice) => device.status === 'rejected'));
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
      setPlaylists(response.playlists || []);
    } catch (err) {
      displayLogger.error('Failed to fetch playlists:', err);
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchPlaylists();
  }, []);

  const handleAuthorizeDevice = async () => {
    if (!deviceToAuthorize) return;
    
    try {
      const response = await fetch(urlResolver.getApiUrl(`/display-devices/admin/devices/${deviceToAuthorize.id}/authorize`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          device_name: deviceName || undefined,
          device_identifier: deviceIdentifier || undefined,
        }),
      });

      if (response.ok) {
        await fetchDevices(); // Refresh the list
        setShowAuthorizeModal(false);
        setDeviceToAuthorize(null);
        setDeviceName('');
        setDeviceIdentifier('');
      } else {
        throw new Error('Failed to authorize device');
      }
    } catch (err) {
      displayLogger.error('Failed to authorize device:', err);
      setError('Failed to authorize device');
    }
  };

  const handleRejectDevice = async () => {
    if (!deviceToReject) return;
    
    try {
      const response = await fetch(`${urlResolver.getApiUrl()}/display-devices/admin/devices/${deviceToReject.id}/reject`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        await fetchDevices(); // Refresh the list
        setShowRejectModal(false);
        setDeviceToReject(null);
      } else {
        throw new Error('Failed to reject device');
      }
    } catch (err) {
      displayLogger.error('Failed to reject device:', err);
      setError('Failed to reject device');
    }
  };

  const handleUpdateDevice = async () => {
    if (!deviceToUpdate) return;
    
    try {
      const response = await fetch(`${urlResolver.getApiUrl()}/display-devices/admin/devices/${deviceToUpdate.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          device_name: deviceName || undefined,
          device_identifier: deviceIdentifier || undefined,
        }),
      });

      if (response.ok) {
        await fetchDevices(); // Refresh the list
        setShowUpdateModal(false);
        setDeviceToUpdate(null);
        setDeviceName('');
        setDeviceIdentifier('');
      } else {
        throw new Error('Failed to update device');
      }
    } catch (err) {
      displayLogger.error('Failed to update device:', err);
      setError('Failed to update device');
    }
  };

  // Helper functions to open modals
  const openAuthorizeModal = (device: DisplayDevice) => {
    setDeviceToAuthorize(device);
    setDeviceName('');
    setDeviceIdentifier('');
    setShowAuthorizeModal(true);
  };

  const openRejectModal = (device: DisplayDevice) => {
    setDeviceToReject(device);
    setShowRejectModal(true);
  };

  const openUpdateModal = (device: DisplayDevice) => {
    setDeviceToUpdate(device);
    setDeviceName(device.device_name || '');
    setDeviceIdentifier(device.device_identifier || '');
    setShowUpdateModal(true);
  };

  const openDeleteModal = (device: DisplayDevice) => {
    setDeviceToDelete(device);
    setShowDeleteModal(true);
  };

  const openBulkDeleteModal = () => {
    setShowBulkDeleteModal(true);
  };

  const openRejectFromEditModal = (device: DisplayDevice) => {
    setDeviceToRejectFromEdit(device);
    setShowRejectFromEditModal(true);
  };

  const openPlaylistModal = (device: DisplayDevice) => {
    setDeviceToAssignPlaylist(device);
    setSelectedPlaylistId(device.playlist_id || null);
    setShowPlaylistModal(true);
  };

  const handleAssignPlaylist = async () => {
    if (!deviceToAssignPlaylist) return;
    
    try {
      const response = await fetch(`${urlResolver.getApiUrl()}/display-devices/admin/devices/${deviceToAssignPlaylist.id}/playlist`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          playlist_id: selectedPlaylistId,
        }),
      });

      if (response.ok) {
        await fetchDevices(); // Refresh the list
        setShowPlaylistModal(false);
        setDeviceToAssignPlaylist(null);
        setSelectedPlaylistId(null);
      } else {
        throw new Error('Failed to assign playlist');
      }
    } catch (err) {
      displayLogger.error('Failed to assign playlist:', err);
      setError('Failed to assign playlist');
    }
  };

  const handleDeleteDevice = async () => {
    if (!deviceToDelete) return;
    
    try {
      const response = await fetch(`${urlResolver.getApiUrl()}/display-devices/admin/devices/${deviceToDelete.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        await fetchDevices(); // Refresh the list
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

  const handleBulkDeleteRejected = async () => {
    try {
      // Delete all rejected devices
      const deletePromises = rejectedDevices.map(device => 
        fetch(`${urlResolver.getApiUrl()}/display-devices/admin/devices/${device.id}`, {
          method: 'DELETE',
          credentials: 'include',
        })
      );

      await Promise.all(deletePromises);
      await fetchDevices(); // Refresh the list
      setShowBulkDeleteModal(false);
    } catch (err) {
      displayLogger.error('Failed to bulk delete rejected devices:', err);
      setError('Failed to delete rejected devices');
    }
  };

  const handleRefreshBrowser = async (device: DisplayDevice) => {
    try {
      const response = await fetch(`${urlResolver.getServerBaseUrl()}/ws/device/${device.device_token}/command?command=refresh_browser`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        displayLogger.info(`Refresh browser command sent to device ${device.device_name || device.id}`);
      } else {
        const errorText = await response.text();
        displayLogger.error('Failed to send refresh command:', errorText);
        throw new Error(`Failed to send refresh command: ${response.status}`);
      }
    } catch (err) {
      displayLogger.error('Failed to refresh browser:', err);
      setError('Failed to refresh browser');
    }
  };

  const handleRejectFromEdit = async () => {
    if (!deviceToRejectFromEdit) return;
    
    try {
      const response = await fetch(`${urlResolver.getApiUrl()}/display-devices/admin/devices/${deviceToRejectFromEdit.id}/reject`, {
        method: 'PUT',
        credentials: 'include',
      });

      if (response.ok) {
        await fetchDevices(); // Refresh the list
        setShowRejectFromEditModal(false);
        setShowUpdateModal(false); // Close the edit modal too
        setDeviceToRejectFromEdit(null);
        setDeviceToUpdate(null);
      } else {
        throw new Error('Failed to reject device');
      }
    } catch (err) {
      displayLogger.error('Failed to reject device:', err);
      setError('Failed to reject device');
    }
  };

  const handleResetDevice = async () => {
    if (!deviceToReset) return;
    
    try {
      const response = await apiService.resetDisplayDevice(deviceToReset.id);
      if (response.success) {
        displayLogger.info(`Device ${deviceToReset.device_name || deviceToReset.id} reset successfully`);
        setShowResetModal(false);
        setDeviceToReset(null);
        fetchDevices(); // Refresh the device list
      } else {
        throw new Error(response.message || 'Failed to reset device');
      }
    } catch (err) {
      displayLogger.error('Failed to reset device:', err);
      setError('Failed to reset device');
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = "px-2 py-1 rounded-full text-xs font-medium";
    switch (status) {
      case 'pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'authorized':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'rejected':
        return `${baseClasses} bg-red-100 text-red-800`;
      case 'offline':
        return `${baseClasses} bg-gray-100 text-gray-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
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
            onClick={fetchDevices}
            className="mt-2 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const currentDevices = activeTab === 'active' ? activeDevices : 
                        activeTab === 'pending' ? pendingDevices : 
                        rejectedDevices;

  const handleBackToDashboard = () => {
    navigate('/admin');
  };

  return (
    <div className="p-8">

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('active')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'active'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Active Devices ({activeDevices.length})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'pending'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pending Devices ({pendingDevices.length})
            </button>
            <button
              onClick={() => setActiveTab('rejected')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'rejected'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Rejected Devices ({rejectedDevices.length})
            </button>
          </nav>
        </div>
      </div>

      {/* Bulk Actions for Rejected Devices */}
      {activeTab === 'rejected' && rejectedDevices.length > 0 && (
        <div className="mb-4 flex justify-end">
          <button
            onClick={openBulkDeleteModal}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
          >
            Delete All Rejected Devices ({rejectedDevices.length})
          </button>
        </div>
      )}

      {/* Devices List */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {currentDevices.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">
              {activeTab === 'active' ? 'No active devices' : 
               activeTab === 'pending' ? 'No pending devices' : 
               'No rejected devices'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {currentDevices.map((device) => (
              <li key={device.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {device.device_name || `Device ${device.id}`}
                        </p>
                        <p className="text-sm text-gray-500">
                          Token: {device.device_token.substring(0, 12)}...
                        </p>
                        {device.device_identifier && (
                          <p className="text-sm text-gray-500">
                            ID: {device.device_identifier}
                          </p>
                        )}
                      </div>
                      <span className={getStatusBadge(device.status)}>
                        {device.status}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      <p>Created: {formatDate(device.created_at)}</p>
                      <p>Last seen: {formatDate(device.last_seen)}</p>
                      {device.authorized_at && (
                        <p>Authorized: {formatDate(device.authorized_at)}</p>
                      )}
                      {device.status === 'authorized' && (
                        <p className="mt-1">
                          <span className="font-medium">Playlist:</span> {device.playlist_name || 'None assigned'}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {device.status === 'pending' && (
                      <>
                        <button
                          onClick={() => openAuthorizeModal(device)}
                          className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                        >
                          Authorize
                        </button>
                        <button
                          onClick={() => openRejectModal(device)}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    
                    {device.status === 'authorized' && (
                      <>
                        <button
                          onClick={() => openPlaylistModal(device)}
                          className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700"
                        >
                          {device.playlist_name ? 'Change Playlist' : 'Select Playlist'}
                        </button>
                        <button
                          onClick={() => handleRefreshBrowser(device)}
                          className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700"
                        >
                          Refresh Browser
                        </button>
                        <button
                          onClick={() => openUpdateModal(device)}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setDeviceToReset(device);
                            setShowResetModal(true);
                          }}
                          className="bg-orange-600 text-white px-3 py-1 rounded text-sm hover:bg-orange-700"
                          title="Reset Device (forces re-registration)"
                        >
                          <RotateCcw className="w-4 h-4 inline mr-1" />
                          Reset
                        </button>
                      </>
                    )}
                    
                    {device.status === 'rejected' && (
                      <>
                        <button
                          onClick={() => openUpdateModal(device)}
                          className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openDeleteModal(device)}
                          className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Refresh Button */}
      <div className="mt-6">
        <button
          onClick={fetchDevices}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Reject Confirmation Modal */}
      <ConfirmationModal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setDeviceToReject(null);
        }}
        onConfirm={handleRejectDevice}
        title="Reject Device"
        message={deviceToReject ? `Are you sure you want to reject this device? This action cannot be undone.` : ''}
        confirmText="Reject"
        variant="danger"
      />

      {/* Authorize Device Modal */}
      {showAuthorizeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Authorize Device</h3>
              <button
                onClick={() => {
                  setShowAuthorizeModal(false);
                  setDeviceToAuthorize(null);
                  setDeviceName('');
                  setDeviceIdentifier('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Device Name (optional)
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter device name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Device Identifier (optional)
                </label>
                <input
                  type="text"
                  value={deviceIdentifier}
                  onChange={(e) => setDeviceIdentifier(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter device identifier"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowAuthorizeModal(false);
                    setDeviceToAuthorize(null);
                    setDeviceName('');
                    setDeviceIdentifier('');
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAuthorizeDevice}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Authorize
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Update Device Modal */}
      {showUpdateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Update Device</h3>
              <button
                onClick={() => {
                  setShowUpdateModal(false);
                  setDeviceToUpdate(null);
                  setDeviceName('');
                  setDeviceIdentifier('');
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Device Name
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter device name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Device Identifier
                </label>
                <input
                  type="text"
                  value={deviceIdentifier}
                  onChange={(e) => setDeviceIdentifier(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter device identifier"
                />
              </div>
              <div className="flex justify-between">
                {/* Left side - Delete and Reject buttons for active devices */}
                {deviceToUpdate?.status === 'authorized' && (
                  <div className="flex space-x-2">
                    <button
                      onClick={() => openRejectFromEditModal(deviceToUpdate)}
                      className="px-3 py-2 text-sm font-medium text-white bg-yellow-600 rounded-md hover:bg-yellow-700 transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => {
                        setShowUpdateModal(false);
                        setDeviceToUpdate(null);
                        setDeviceName('');
                        setDeviceIdentifier('');
                        openDeleteModal(deviceToUpdate);
                      }}
                      className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
                
                {/* Right side - Cancel and Update buttons */}
                <div className="flex space-x-3 ml-auto">
                  <button
                    onClick={() => {
                      setShowUpdateModal(false);
                      setDeviceToUpdate(null);
                      setDeviceName('');
                      setDeviceIdentifier('');
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateDevice}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Playlist Selection Modal */}
      {showPlaylistModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Select Playlist</h3>
              <button
                onClick={() => {
                  setShowPlaylistModal(false);
                  setDeviceToAssignPlaylist(null);
                  setSelectedPlaylistId(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Choose a playlist for this device:
                </label>
                <select
                  value={selectedPlaylistId || ''}
                  onChange={(e) => setSelectedPlaylistId(e.target.value ? parseInt(e.target.value) : null)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">No playlist (remove assignment)</option>
                  {playlists.map((playlist) => (
                    <option key={playlist.id} value={playlist.id}>
                      {playlist.name}
                    </option>
                  ))}
                </select>
              </div>
              {deviceToAssignPlaylist && (
                <div className="text-sm text-gray-600">
                  <p><strong>Device:</strong> {deviceToAssignPlaylist.device_name || 'Unnamed Device'}</p>
                  <p><strong>Current playlist:</strong> {deviceToAssignPlaylist.playlist_name || 'None'}</p>
                </div>
              )}
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowPlaylistModal(false);
                    setDeviceToAssignPlaylist(null);
                    setSelectedPlaylistId(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignPlaylist}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                >
                  Assign Playlist
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Device Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeviceToDelete(null);
        }}
        onConfirm={handleDeleteDevice}
        title="Delete Device"
        message={deviceToDelete ? `Are you sure you want to permanently delete this device? This action cannot be undone.` : ''}
        confirmText="Delete"
        variant="danger"
      />

      {/* Bulk Delete Rejected Devices Confirmation Modal */}
      <ConfirmationModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDeleteRejected}
        title="Delete All Rejected Devices"
        message={`Are you sure you want to permanently delete all ${rejectedDevices.length} rejected devices? This action cannot be undone.`}
        confirmText="Delete All"
        variant="danger"
      />

      {/* Reject Device from Edit Modal Confirmation */}
      <ConfirmationModal
        isOpen={showRejectFromEditModal}
        onClose={() => {
          setShowRejectFromEditModal(false);
          setDeviceToRejectFromEdit(null);
        }}
        onConfirm={handleRejectFromEdit}
        title="Reject Device"
        message={deviceToRejectFromEdit ? `Are you sure you want to reject this device? It will be moved to the rejected devices list.` : ''}
        confirmText="Reject"
        variant="warning"
      />

      {/* Reset Device Confirmation Modal */}
      <ConfirmationModal
        isOpen={showResetModal}
        onClose={() => {
          setShowResetModal(false);
          setDeviceToReset(null);
        }}
        onConfirm={handleResetDevice}
        title="Reset Device"
        message={deviceToReset ? `Are you sure you want to reset device "${deviceToReset.device_name || deviceToReset.device_token}"? This will invalidate its authentication and force it to re-register. The device will need to generate a new registration code.` : ''}
        confirmText="Reset Device"
        variant="warning"
      />
    </div>
  );
};

export default Displays;
