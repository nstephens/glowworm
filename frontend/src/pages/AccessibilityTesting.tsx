import React from 'react';
import { AccessibilityTestingDashboard } from '@/components/testing/AccessibilityTestingDashboard';

/**
 * Accessibility Testing Page
 * Comprehensive testing interface for WCAG 2.1 AA compliance
 */
const AccessibilityTesting: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <AccessibilityTestingDashboard />
      </div>
    </div>
  );
};

export default AccessibilityTesting;





