import React, { useState, useEffect } from 'react';
import { Power, MonitorPlay, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { apiService } from '../services/api';

interface DeviceDaemonControlProps {
  deviceId: number;
  daemonEnabled?: boolean;
  currentUrl?: string;
}

interface CECInput {
  address: string;
  name: string;
  type: string;
}

export const DeviceDaemonControl: React.FC<DeviceDaemonControlProps> = ({
  deviceId,
  daemonEnabled = false,
  currentUrl = '',
}) => {
  const [browserUrl, setBrowserUrl] = useState(currentUrl || '');
  const [cecInputs, setCecInputs] = useState<CECInput[]>([]);
  const [selectedInput, setSelectedInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [cecAvailable, setCecAvailable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (daemonEnabled) {
      loadCECInputs();
    }
  }, [deviceId, daemonEnabled]);

  const loadCECInputs = async () => {
    try {
      const response = await apiService.getDeviceInputs(deviceId);
      setCecAvailable(response.cec_available);
      if (response.inputs) {
        setCecInputs(response.inputs);
      }
      if (response.current_input) {
        setSelectedInput(response.current_input.address);
      }
    } catch (err) {
      console.error('Failed to load CEC inputs:', err);
    }
  };

  const handleUpdateUrl = async () => {
    if (!browserUrl.trim()) {
      setError('URL cannot be empty');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await apiService.updateDeviceBrowserUrl(deviceId, browserUrl);
      setSuccess('Browser URL update queued');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update URL');
    } finally {
      setLoading(false);
    }
  };

  const handlePowerControl = async (power: 'on' | 'off') => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await apiService.controlDevicePower(deviceId, power);
      setSuccess(`Power ${power} command queued`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || `Failed to power ${power}`);
    } finally {
      setLoading(false);
    }
  };

  const handleScanInputs = async () => {
    setLoading(true);
    setError(null);

    try {
      await apiService.scanDeviceInputs(deviceId);
      setSuccess('Input scan queued - refresh in a moment');
      setTimeout(() => {
        loadCECInputs();
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to scan inputs');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectInput = async () => {
    // Allow "self" for quick Pi switch, otherwise require selection
    if (!selectedInput && selectedInput !== 'self') {
      setError('Please select an input');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const inputInfo = cecInputs.find(i => i.address === selectedInput);
      const inputName = selectedInput === 'self' ? 'This Device' : inputInfo?.name;
      await apiService.selectDeviceInput(deviceId, selectedInput, inputName);
      setSuccess(selectedInput === 'self' ? 'Switching TV to Glowworm display...' : 'Input switch command queued');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to switch input');
    } finally {
      setLoading(false);
    }
  };

  if (!daemonEnabled) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center text-gray-500">
          <WifiOff className="w-5 h-5 mr-2" />
          <span className="text-sm">Daemon control not enabled for this device</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* Browser URL Configuration */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
          <MonitorPlay className="w-4 h-4 mr-2" />
          Browser URL Configuration
        </h4>
        <div className="space-y-2">
          <input
            type="url"
            value={browserUrl}
            onChange={(e) => setBrowserUrl(e.target.value)}
            placeholder="http://10.10.10.2:3000/display/abc123"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleUpdateUrl}
            disabled={loading}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Updating...' : 'Update Browser URL'}
          </button>
        </div>
      </div>

      {/* CEC Power Control */}
      {cecAvailable && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
            <Power className="w-4 h-4 mr-2" />
            Display Power (HDMI CEC)
          </h4>
          <div className="flex space-x-2">
            <button
              onClick={() => handlePowerControl('on')}
              disabled={loading}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              Power On
            </button>
            <button
              onClick={() => handlePowerControl('off')}
              disabled={loading}
              className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              Power Off
            </button>
          </div>
        </div>
      )}

      {/* HDMI Input Selection */}
      {cecAvailable && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">HDMI Input Control</h4>
          <div className="space-y-3">
            {/* Quick action: Switch to Pi */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-xs text-blue-900 mb-2">
                Switch TV from FireTV/SmartTV to this Raspberry Pi
              </p>
              <button
                onClick={() => {
                  // Use "self" to trigger 'as' command
                  setSelectedInput('self');
                  handleSelectInput();
                }}
                disabled={loading}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                <MonitorPlay className="w-4 h-4 mr-2" />
                Switch to Glowworm Display
              </button>
            </div>

            {/* Advanced: Select specific device */}
            {cecInputs.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer text-gray-600 hover:text-gray-900 mb-2">
                  Advanced: Switch to Other Devices
                </summary>
                <div className="space-y-2 mt-2">
                  <select
                    value={selectedInput}
                    onChange={(e) => setSelectedInput(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select device...</option>
                    {cecInputs.map((input) => (
                      <option key={input.address} value={input.address}>
                        {input.name} (Address: {input.address})
                      </option>
                    ))}
                  </select>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleSelectInput}
                      disabled={loading || !selectedInput}
                      className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
                    >
                      Switch to Selected
                    </button>
                    <button
                      onClick={handleScanInputs}
                      disabled={loading}
                      className="bg-gray-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-600 transition-colors disabled:opacity-50 flex items-center justify-center"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      {/* CEC Not Available Message */}
      {daemonEnabled && !cecAvailable && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <Wifi className="w-5 h-5 text-yellow-600 mr-2 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-700">
              <p className="font-medium">HDMI CEC Not Available</p>
              <p className="mt-1">
                CEC control requires cec-utils to be installed on the device.
                URL updates are still available.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

