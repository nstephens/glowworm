import React, { useState, useEffect } from 'react';
import { useSetup } from '../contexts/SetupContext';

interface SetupFormData {
  mysql_host: string;
  mysql_port: number;
  mysql_root_user: string;
  mysql_root_password: string;
  app_db_user: string;
  app_db_password: string;
  admin_password: string;
  server_base_url: string;
  backend_port: number;
  frontend_port: number;
  default_display_time_seconds: number;
  upload_directory: string;
  display_status_check_interval: number;
  display_websocket_check_interval: number;
  log_level: string;
}

interface NetworkInterface {
  name: string;
  ip_address: string;
  is_up: boolean;
  is_loopback: boolean;
}

const SetupWizard: React.FC = () => {
  const { completeSetup, testDatabaseConnection, checkUser, recreateUser, getNetworkInterfaces } = useSetup();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationStep, setValidationStep] = useState<'database' | 'user' | 'complete' | null>(null);
  const [userCheckResult, setUserCheckResult] = useState<any>(null);
  const [networkInterfaces, setNetworkInterfaces] = useState<NetworkInterface[]>([]);
  const [interfacesLoaded, setInterfacesLoaded] = useState(false);
  const [showUserRecreateModal, setShowUserRecreateModal] = useState(false);
  const [userRecreateInfo, setUserRecreateInfo] = useState<{username: string, shouldRecreate: boolean} | null>(null);
  const [formData, setFormData] = useState<SetupFormData>({
    mysql_host: 'localhost',
    mysql_port: 3306,
    mysql_root_user: 'root',
    mysql_root_password: '',
    app_db_user: 'glowworm',
    app_db_password: '',
    admin_password: '',
    server_base_url: '',
    backend_port: 8001,
    frontend_port: 3003,
    default_display_time_seconds: 30,
    upload_directory: 'uploads',
    display_status_check_interval: 30,
    display_websocket_check_interval: 5,
    log_level: 'INFO',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    }));
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Load network interfaces on component mount
  useEffect(() => {
    const loadNetworkInterfaces = async () => {
      try {
        const response = await getNetworkInterfaces();
        setNetworkInterfaces(response.interfaces || []);
        setInterfacesLoaded(true);
        
        // Set default to first non-loopback interface
        const nonLoopback = response.interfaces?.find(iface => !iface.is_loopback);
        if (nonLoopback) {
          setFormData(prev => ({
            ...prev,
            server_base_url: nonLoopback.ip_address
          }));
        }
      } catch (error) {
        console.error('Failed to load network interfaces:', error);
        setInterfacesLoaded(true);
      }
    };

    loadNetworkInterfaces();
  }, [getNetworkInterfaces]);

  const handleUserRecreateConfirm = async (shouldRecreate: boolean) => {
    setShowUserRecreateModal(false);
    
    if (!shouldRecreate) {
      setError('Setup cancelled - user password is incorrect and recreation was declined.');
      return;
    }

    setIsLoading(true);
    setValidationStep('user');

    try {
      const recreateResult = await recreateUser({
        mysql_host: formData.mysql_host,
        mysql_port: formData.mysql_port,
        mysql_root_user: formData.mysql_root_user,
        mysql_root_password: formData.mysql_root_password,
        app_db_user: formData.app_db_user,
        app_db_password: formData.app_db_password
      });

      if (!recreateResult.success) {
        throw new Error(`User recreation failed: ${recreateResult.message}`);
      }

      // Continue with setup completion
      setValidationStep('complete');
      const response = await completeSetup(formData);
      if (response.success) {
        // Setup successful - redirect to login page
        window.location.href = '/login';
      } else {
        setError('Setup failed. Please check your configuration and try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during setup. Please try again.');
      console.error('Setup error:', err);
    } finally {
      setIsLoading(false);
      setValidationStep(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setValidationStep('database');

    try {
      // Step 1: Test database connection
      const dbTest = await testDatabaseConnection({
        mysql_host: formData.mysql_host,
        mysql_port: formData.mysql_port,
        mysql_root_user: formData.mysql_root_user,
        mysql_root_password: formData.mysql_root_password
      });

      if (!dbTest.success) {
        throw new Error(`Database connection failed: ${dbTest.message}`);
      }

      // Step 2: Check user
      setValidationStep('user');
      const userCheck = await checkUser({
        mysql_host: formData.mysql_host,
        mysql_port: formData.mysql_port,
        mysql_root_user: formData.mysql_root_user,
        mysql_root_password: formData.mysql_root_password,
        app_db_user: formData.app_db_user,
        app_db_password: formData.app_db_password
      });

      if (!userCheck.success) {
        throw new Error(`User check failed: ${userCheck.message}`);
      }

      setUserCheckResult(userCheck);

      // Step 3: Handle user validation result
      if (userCheck.exists && userCheck.action_required === 'recreate') {
        // User exists but password is wrong - show modal to ask user what to do
        setUserRecreateInfo({ username: formData.app_db_user, shouldRecreate: false });
        setShowUserRecreateModal(true);
        setIsLoading(false);
        
        // Wait for user decision (this will be handled by the modal)
        return;
      }

      // Step 4: Complete setup
      setValidationStep('complete');
      const response = await completeSetup(formData);
      if (response.success) {
        // Setup successful - redirect to login page
        window.location.href = '/login';
      } else {
        setError('Setup failed. Please check your configuration and try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during setup. Please try again.');
      console.error('Setup error:', err);
    } finally {
      setIsLoading(false);
      setValidationStep(null);
    }
  };

  const nextStep = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white mb-6">Database Configuration</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            MySQL Host
          </label>
          <input
            type="text"
            name="mysql_host"
            value={formData.mysql_host}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            MySQL Port
          </label>
          <input
            type="number"
            name="mysql_port"
            value={formData.mysql_port}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            MySQL Root User
          </label>
          <input
            type="text"
            name="mysql_root_user"
            value={formData.mysql_root_user}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            MySQL Root Password
          </label>
          <input
            type="password"
            name="mysql_root_password"
            value={formData.mysql_root_password}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white mb-6">Application Database User</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Application DB User
          </label>
          <input
            type="text"
            name="app_db_user"
            value={formData.app_db_user}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Application DB Password
          </label>
          <input
            type="password"
            name="app_db_password"
            value={formData.app_db_password}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white mb-6">Admin Account & Optional Services</h2>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Admin Password
          </label>
          <input
            type="password"
            name="admin_password"
            value={formData.admin_password}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Interface to use for API and Frontend server
          </label>
          <select
            name="server_base_url"
            value={formData.server_base_url}
            onChange={handleSelectChange}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary"
            required
            disabled={!interfacesLoaded}
          >
            {!interfacesLoaded ? (
              <option value="">Loading network interfaces...</option>
            ) : (
              networkInterfaces.map((iface) => (
                <option key={iface.ip_address} value={iface.ip_address}>
                  {iface.ip_address} {iface.is_loopback ? '(localhost)' : `(${iface.name})`} {!iface.is_up && '(down)'}
                </option>
              ))
            )}
          </select>
          <p className="text-sm text-gray-400 mt-1">
            Select the IP address for network access (display devices will connect to this address)
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Backend Port
            </label>
            <input
              type="number"
              name="backend_port"
              value={formData.backend_port}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="8001"
              min="1024"
              max="65535"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Frontend Port
            </label>
            <input
              type="number"
              name="frontend_port"
              value={formData.frontend_port}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="3003"
              min="1024"
              max="65535"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Default Display Time (seconds)
          </label>
          <input
            type="number"
            name="default_display_time_seconds"
            value={formData.default_display_time_seconds}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="30"
            min="1"
            max="300"
            required
          />
          <p className="text-sm text-gray-400 mt-1">
            Default time to display each image in playlists
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Upload Directory
          </label>
          <input
            type="text"
            name="upload_directory"
            value={formData.upload_directory}
            onChange={handleInputChange}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="uploads"
            required
          />
          <p className="text-sm text-gray-400 mt-1">
            Directory for uploaded files (relative to backend root)
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Status Check Interval (seconds)
            </label>
            <input
              type="number"
              name="display_status_check_interval"
              value={formData.display_status_check_interval}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="30"
              min="5"
              max="300"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              WebSocket Check Interval (seconds)
            </label>
            <input
              type="number"
              name="display_websocket_check_interval"
              value={formData.display_websocket_check_interval}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="5"
              min="1"
              max="60"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Log Level
            </label>
            <select
              name="log_level"
              value={formData.log_level}
              onChange={handleInputChange}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-primary"
              required
            >
              <option value="CRITICAL">Critical (Errors only)</option>
              <option value="ERROR">Error (Errors and critical issues)</option>
              <option value="WARNING">Warning (Errors, warnings, and critical issues)</option>
              <option value="INFO">Info (General information and above)</option>
              <option value="DEBUG">Debug (Detailed debugging information)</option>
            </select>
          </div>
        </div>

      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-gray-800 rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <img 
                src="/glowworm_icon.png" 
                alt="Glowworm Logo" 
                className="w-12 h-12 object-contain"
              />
              <h1 className="text-3xl font-bold text-white">Welcome to Glowworm</h1>
            </div>
            <p className="text-gray-400">Let's get your digital signage system set up</p>
          </div>

          {/* Progress indicator */}
          <div className="flex justify-center mb-8">
            <div className="flex space-x-4">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step <= currentStep
                      ? 'bg-primary text-white'
                      : 'bg-gray-600 text-gray-400'
                  }`}
                >
                  {step}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}

            {error && (
              <div className="mt-4 p-4 bg-red-900 border border-red-700 rounded-md">
                <p className="text-red-200">{error}</p>
              </div>
            )}

            <div className="flex justify-between mt-8">
              <button
                type="button"
                onClick={prevStep}
                disabled={currentStep === 1}
                className="px-6 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>

              {currentStep < 3 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2 bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {validationStep === 'database' && 'Testing database connection...'}
                      {validationStep === 'user' && 'Checking user credentials...'}
                      {validationStep === 'complete' && 'Completing setup...'}
                      {!validationStep && 'Setting up...'}
                    </div>
                  ) : (
                    'Complete Setup'
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* User Recreate Modal */}
      {showUserRecreateModal && userRecreateInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-white mb-4">
              User Already Exists
            </h3>
            <p className="text-gray-300 mb-6">
              User '{userRecreateInfo.username}' exists but the password is incorrect. 
              Would you like to recreate the user with the new password?
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => handleUserRecreateConfirm(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Cancel Setup
              </button>
              <button
                onClick={() => handleUserRecreateConfirm(true)}
                className="px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
              >
                Recreate User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SetupWizard;
