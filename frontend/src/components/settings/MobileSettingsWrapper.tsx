import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Monitor, Database, User, Key, Users, Settings as SettingsIcon, Shield, Info, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { SettingsSection } from './SettingsSection';
import { ToggleSwitch } from './ToggleSwitch';
import { SettingsInput, SettingsSelect, SettingsTextarea } from './SettingsItem';
import { useResponsiveLayout } from '../../hooks/useResponsiveLayout';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

interface MobileSettingsWrapperProps {
  children: React.ReactNode;
  onSave?: () => void;
  isLoading?: boolean;
  hasChanges?: boolean;
}

/**
 * Mobile-optimized wrapper component for Settings page
 * Converts tab-based navigation into collapsible sections
 */
const MobileSettingsWrapper: React.FC<MobileSettingsWrapperProps> = ({
  children,
  onSave,
  isLoading = false,
  hasChanges = false
}) => {
  const navigate = useNavigate();
  const { isMobile } = useResponsiveLayout();

  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/admin')}
              className="p-2"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
              {hasChanges && (
                <p className="text-xs text-orange-600 mt-0.5">You have unsaved changes</p>
              )}
            </div>
          </div>
          
          {onSave && (
            <Button
              onClick={onSave}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
              size="sm"
            >
              <Save className="w-4 h-4 mr-1" />
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 pb-24">
        {children}
      </div>
    </div>
  );
};

export { MobileSettingsWrapper };
