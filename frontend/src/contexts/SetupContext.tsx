import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { setupApi } from '../services/api';
import { urlResolver } from '../services/urlResolver';

interface SetupContextType {
  isConfigured: boolean | null;
  needsBootstrap: boolean;
  needsAdmin: boolean;
  isLoading: boolean;
  checkSetupStatus: () => Promise<void>;
  getNetworkInterfaces: () => Promise<any>;
  testDatabaseConnection: (connectionData: any) => Promise<any>;
  checkUser: (userData: any) => Promise<any>;
  recreateUser: (userData: any) => Promise<any>;
  completeSetup: (setupData: any) => Promise<boolean>;
  createAdmin: (password: string) => Promise<boolean>;
}

const SetupContext = createContext<SetupContextType | undefined>(undefined);

interface SetupProviderProps {
  children: ReactNode;
}

export const SetupProvider: React.FC<SetupProviderProps> = ({ children }) => {
  // Optimistically assume configured to prevent showing setup wizard on network errors
  const [isConfigured, setIsConfigured] = useState<boolean | null>(true);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [needsAdmin, setNeedsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkSetupStatus = async () => {
    try {
      setIsLoading(true);
      const status = await setupApi.getStatus();
      console.log('🔍 Setup Status Response:', status);
      console.log('  is_configured:', status.is_configured);
      console.log('  needs_bootstrap:', status.needs_bootstrap);
      console.log('  needs_admin:', status.needs_admin);
      setIsConfigured(status.is_configured);
      setNeedsBootstrap(status.needs_bootstrap || false);
      setNeedsAdmin(status.needs_admin || false);
      
      // Remember successful setup in localStorage
      if (status.is_configured) {
        localStorage.setItem('glowworm_setup_complete', 'true');
      }
    } catch (error) {
      console.error('❌ Failed to check setup status:', error);
      console.error('  This is likely a CORS or network error.');
      console.error('  If you just reset the database, restart the backend server.');
      
      // Check if setup was previously completed
      const wasSetupComplete = localStorage.getItem('glowworm_setup_complete') === 'true';
      
      if (wasSetupComplete) {
        // Don't redirect to setup if it was previously complete
        // This prevents temporary connection issues from breaking the UI
        console.warn('⚠️ Backend unreachable, but setup was previously complete. Maintaining configured state.');
        setIsConfigured(true);
        setNeedsBootstrap(false);
        setNeedsAdmin(false);
      } else {
        // First-time setup or setup never completed
        setIsConfigured(false);
        setNeedsBootstrap(true);
        setNeedsAdmin(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getNetworkInterfaces = async (): Promise<any> => {
    try {
      return await setupApi.getNetworkInterfaces();
    } catch (error) {
      console.error('Failed to get network interfaces:', error);
      throw error;
    }
  };

  const testDatabaseConnection = async (connectionData: any): Promise<any> => {
    try {
      return await setupApi.testDatabaseConnection(connectionData);
    } catch (error) {
      console.error('Failed to test database connection:', error);
      throw error;
    }
  };

  const checkUser = async (userData: any): Promise<any> => {
    try {
      return await setupApi.checkUser(userData);
    } catch (error) {
      console.error('Failed to check user:', error);
      throw error;
    }
  };

  const recreateUser = async (userData: any): Promise<any> => {
    try {
      return await setupApi.recreateUser(userData);
    } catch (error) {
      console.error('Failed to recreate user:', error);
      throw error;
    }
  };

  const completeSetup = async (setupData: any): Promise<boolean> => {
    try {
      const result = await setupApi.completeSetup(setupData);
      if (result.success) {
        await checkSetupStatus(); // Refresh status
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to complete setup:', error);
      return false;
    }
  };

  const createAdmin = async (password: string): Promise<boolean> => {
    try {
      const response = await fetch(urlResolver.getApiUrl('/setup/create-admin'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          admin_password: password
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        await checkSetupStatus(); // Refresh status
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to create admin:', error);
      return false;
    }
  };

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const value: SetupContextType = {
    isConfigured,
    needsBootstrap,
    needsAdmin,
    isLoading,
    checkSetupStatus,
    getNetworkInterfaces,
    testDatabaseConnection,
    checkUser,
    recreateUser,
    completeSetup,
    createAdmin,
  };

  return (
    <SetupContext.Provider value={value}>
      {children}
    </SetupContext.Provider>
  );
};

export const useSetup = (): SetupContextType => {
  const context = useContext(SetupContext);
  if (context === undefined) {
    throw new Error('useSetup must be used within a SetupProvider');
  }
  return context;
};
