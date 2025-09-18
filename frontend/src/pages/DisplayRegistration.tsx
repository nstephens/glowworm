import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api';
import { applyDeviceOptimizations } from '../utils/deviceDetection';
import { urlResolver } from '../services/urlResolver';

interface DeviceStatus {
  id: number;
  device_token: string;
  device_name?: string;
  device_identifier?: string;
  status: 'pending' | 'authorized' | 'rejected' | 'offline';
  authorized_at?: string;
  last_seen: string;
  created_at: string;
  updated_at: string;
  playlist_id?: number;
  playlist_name?: string;
}

const DisplayRegistration: React.FC = () => {
  const navigate = useNavigate();
  const [deviceStatus, setDeviceStatus] = useState<DeviceStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Add display-mode class to body for frameless display and apply device optimizations
  useEffect(() => {
    document.body.classList.add('display-mode');
    const deviceInfo = applyDeviceOptimizations();
    console.log('Applied device optimizations:', deviceInfo);
    
    return () => {
      document.body.classList.remove('display-mode', 'pi-mode', 'low-power-mode');
    };
  }, []);

  // Check if device is already registered, auto-register if needed
  useEffect(() => {
    checkDeviceStatus();
  }, []);

  // Auto-register device if not already registered
  useEffect(() => {
    if (!isLoading && !deviceStatus && !isRegistering && !error) {
      registerDevice();
    }
  }, [isLoading, deviceStatus, isRegistering, error]);

  // Auto-check status for pending devices and retry for rejected devices
  useEffect(() => {
    if (deviceStatus?.status === 'pending' || deviceStatus?.status === 'rejected') {
      const interval = setInterval(() => {
        if (deviceStatus?.status === 'rejected') {
          // For rejected devices, try to re-register
          setDeviceStatus(null);
          setError(null);
        } else {
          // For pending devices, just check status
          checkDeviceStatus(false); // Don't show loading spinner for background checks
        }
      }, 10000); // Check every 10 seconds for rejected, 5 seconds for pending

      return () => clearInterval(interval);
    }
  }, [deviceStatus?.status]);

  const checkDeviceStatus = async (showLoading = true) => {
    try {
      if (showLoading) {
        setIsLoading(true);
      }
      setError(null);
      
      const response = await fetch(urlResolver.getApiUrl('/display-devices/status'), {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setDeviceStatus(data);
        
        // If device is authorized, redirect to its display page
        if (data.status === 'authorized') {
          const deviceSlug = data.device_name?.toLowerCase().replace(/\s+/g, '-') || `device-${data.id}`;
          navigate(`/display/${deviceSlug}`);
          return;
        }
      } else if (response.status === 401) {
        // Device not registered, will show registration form
        setDeviceStatus(null);
      } else {
        throw new Error('Failed to check device status');
      }
    } catch (err) {
      console.error('Error checking device status:', err);
      setError('Failed to check device status');
    } finally {
      if (showLoading) {
        setIsLoading(false);
      }
    }
  };

  const registerDevice = async () => {
    try {
      setIsRegistering(true);
      setError(null);

      const userAgent = navigator.userAgent;
      const response = await fetch(urlResolver.getApiUrl('/display-devices/register'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          user_agent: userAgent,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setDeviceStatus({
          id: 0, // Will be updated when we check status
          device_token: data.device_token,
          status: data.status,
          last_seen: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      } else {
        throw new Error('Failed to register device');
      }
    } catch (err) {
      console.error('Error registering device:', err);
      setError('Failed to register device. Please try again.');
    } finally {
      setIsRegistering(false);
    }
  };

  const getStatusMessage = () => {
    if (!deviceStatus) return null;

    switch (deviceStatus.status) {
      case 'pending':
        return {
          title: 'Waiting for Authorization',
          message: 'Your device has been registered and is waiting for administrator approval.',
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50',
          borderColor: 'border-yellow-200',
        };
      case 'authorized':
        return {
          title: 'Device Authorized',
          message: 'Your device has been approved. Redirecting to display...',
          color: 'text-green-600',
          bgColor: 'bg-green-50',
          borderColor: 'border-green-200',
        };
      case 'rejected':
        return {
          title: 'Device Rejected',
          message: 'This device has been rejected by an administrator.',
          color: 'text-red-600',
          bgColor: 'bg-red-50',
          borderColor: 'border-red-200',
        };
      case 'offline':
        return {
          title: 'Device Offline',
          message: 'This device appears to be offline.',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
        };
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <img 
              src="/glowworm_icon.png" 
              alt="Glowworm Logo" 
              className="w-12 h-12 object-contain"
            />
            <h1 className="text-2xl font-bold">Glowworm Display</h1>
          </div>
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Checking device status...</p>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusMessage();

  return (
    <div className="frameless-display bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {!deviceStatus ? (
          // Device not registered - show auto-registration status
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mb-6">
              <div className="flex items-center justify-center space-x-3 mb-4">
                <img 
                  src="/glowworm_icon.png" 
                  alt="Glowworm Logo" 
                  className="w-10 h-10 object-contain"
                />
                <h1 className="text-2xl font-bold text-gray-900">Initializing Display Device</h1>
              </div>
              <p className="text-gray-600">
                {isRegistering ? 'Registering device...' : 'Preparing display system...'}
              </p>
            </div>
            
            <div className="flex justify-center mb-6">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
            
            <div className="text-sm text-gray-500">
              <p>This device will be automatically registered and ready for administrator approval.</p>
            </div>
          </div>
        ) : (
          // Device registered - show status
          <div className={`rounded-lg shadow-lg p-8 text-center border ${statusInfo?.borderColor} ${statusInfo?.bgColor}`}>
            <div className="mb-6">
              <h1 className={`text-2xl font-bold mb-2 ${statusInfo?.color}`}>
                {statusInfo?.title}
              </h1>
              <p className="text-gray-600">
                {statusInfo?.message}
              </p>
            </div>

            {deviceStatus.status === 'pending' && (
              <div className="space-y-6">
                <div className="animate-pulse">
                  <div className="h-2 bg-yellow-200 rounded-full"></div>
                </div>
                
                {/* Prominent Device Token Display */}
                <div className="bg-white border-4 border-yellow-300 rounded-lg p-6 shadow-lg">
                  <p className="text-sm text-gray-600 mb-2">Device Code:</p>
                  <div className="text-6xl font-bold text-gray-900 tracking-wider text-center">
                    {deviceStatus.device_token}
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Give this code to an administrator for approval
                  </p>
                </div>
                
                <p className="text-sm text-gray-500 text-center">
                  This page will automatically update when an administrator approves this device.
                </p>
              </div>
            )}

            {deviceStatus.status === 'rejected' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Please contact an administrator for assistance.
                </p>
                <p className="text-sm text-gray-500">
                  This device will automatically retry registration in case the rejection was temporary.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DisplayRegistration;
