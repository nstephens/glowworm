/**
 * A/B Testing utilities for mobile application
 * Provides deterministic variant selection, exposure tracking, and analytics integration
 */

export interface ABTestConfig {
  name: string;
  variants: string[];
  trafficAllocation?: number; // 0-1, default 1.0
  startDate?: Date;
  endDate?: Date;
  targetAudience?: {
    userIds?: string[];
    userSegments?: string[];
    deviceTypes?: ('mobile' | 'tablet' | 'desktop')[];
    platforms?: ('ios' | 'android' | 'web')[];
  };
}

export interface ABTestResult {
  testName: string;
  variant: string;
  userId: string;
  sessionId: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface ABTestEvent {
  testName: string;
  variant: string;
  eventName: string;
  userId: string;
  sessionId: string;
  timestamp: number;
  properties?: Record<string, any>;
}

// In-memory storage for tests (in production, this would be in a database)
const activeTests = new Map<string, ABTestConfig>();
const testResults = new Map<string, ABTestResult[]>();
const testEvents = new Map<string, ABTestEvent[]>();

/**
 * Simple hash function for deterministic variant selection
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Check if user is eligible for a test
 */
function isUserEligible(
  userId: string, 
  sessionId: string, 
  config: ABTestConfig
): boolean {
  // Check traffic allocation
  if (config.trafficAllocation && config.trafficAllocation < 1) {
    const userHash = hashCode(userId + config.name);
    const allocation = userHash % 100 / 100;
    if (allocation > config.trafficAllocation) {
      return false;
    }
  }

  // Check date range
  const now = new Date();
  if (config.startDate && now < config.startDate) return false;
  if (config.endDate && now > config.endDate) return false;

  // Check target audience
  if (config.targetAudience) {
    const { userIds, userSegments, deviceTypes, platforms } = config.targetAudience;
    
    if (userIds && !userIds.includes(userId)) return false;
    
    // Check device type
    if (deviceTypes) {
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isTablet = /iPad|Android(?=.*Mobile)/i.test(navigator.userAgent);
      const isDesktop = !isMobile && !isTablet;
      
      const currentDeviceType = isMobile ? 'mobile' : isTablet ? 'tablet' : 'desktop';
      if (!deviceTypes.includes(currentDeviceType as any)) return false;
    }
    
    // Check platform
    if (platforms) {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      const isWeb = !isIOS && !isAndroid;
      
      const currentPlatform = isIOS ? 'ios' : isAndroid ? 'android' : 'web';
      if (!platforms.includes(currentPlatform as any)) return false;
    }
  }

  return true;
}

/**
 * Get deterministic variant for a user
 */
function getVariant(userId: string, testName: string, variants: string[]): string {
  const hash = hashCode(userId + testName);
  const index = hash % variants.length;
  return variants[index];
}

/**
 * Register a new A/B test
 */
export function registerABTest(config: ABTestConfig): void {
  activeTests.set(config.name, config);
  testResults.set(config.name, []);
  testEvents.set(config.name, []);
}

/**
 * Get variant for a user in a specific test
 */
export function getABTestVariant(
  testName: string, 
  userId: string, 
  sessionId: string,
  fallbackVariant?: string
): string | null {
  const config = activeTests.get(testName);
  if (!config) {
    console.warn(`AB Test "${testName}" not found`);
    return fallbackVariant || null;
  }

  // Check if user is eligible
  if (!isUserEligible(userId, sessionId, config)) {
    return fallbackVariant || null;
  }

  // Get or create test result
  const existingResult = testResults.get(testName)?.find(
    result => result.userId === userId && result.sessionId === sessionId
  );

  if (existingResult) {
    return existingResult.variant;
  }

  // Create new test result
  const variant = getVariant(userId, testName, config.variants);
  const result: ABTestResult = {
    testName,
    variant,
    userId,
    sessionId,
    timestamp: Date.now()
  };

  const results = testResults.get(testName) || [];
  results.push(result);
  testResults.set(testName, results);

  // Track exposure
  trackABTestEvent(testName, variant, 'exposure', userId, sessionId);

  return variant;
}

/**
 * Track an event for an A/B test
 */
export function trackABTestEvent(
  testName: string,
  variant: string,
  eventName: string,
  userId: string,
  sessionId: string,
  properties?: Record<string, any>
): void {
  const event: ABTestEvent = {
    testName,
    variant,
    eventName,
    userId,
    sessionId,
    timestamp: Date.now(),
    properties
  };

  const events = testEvents.get(testName) || [];
  events.push(event);
  testEvents.set(testName, events);

  // Send to analytics (in production, this would integrate with your analytics service)
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'ab_test_event', {
      test_name: testName,
      variant: variant,
      event_name: eventName,
      user_id: userId,
      session_id: sessionId,
      ...properties
    });
  }
}

/**
 * Get test results and statistics
 */
export function getABTestResults(testName: string): {
  config: ABTestConfig | undefined;
  results: ABTestResult[];
  events: ABTestEvent[];
  statistics: {
    totalUsers: number;
    variantDistribution: Record<string, number>;
    eventCounts: Record<string, Record<string, number>>;
    conversionRates: Record<string, number>;
  };
} {
  const config = activeTests.get(testName);
  const results = testResults.get(testName) || [];
  const events = testEvents.get(testName) || [];

  // Calculate statistics
  const totalUsers = results.length;
  const variantDistribution: Record<string, number> = {};
  const eventCounts: Record<string, Record<string, number>> = {};
  const conversionRates: Record<string, number> = {};

  // Count variant distribution
  results.forEach(result => {
    variantDistribution[result.variant] = (variantDistribution[result.variant] || 0) + 1;
  });

  // Count events by variant
  events.forEach(event => {
    if (!eventCounts[event.variant]) {
      eventCounts[event.variant] = {};
    }
    eventCounts[event.variant][event.eventName] = 
      (eventCounts[event.variant][event.eventName] || 0) + 1;
  });

  // Calculate conversion rates (assuming 'conversion' is the key event)
  Object.keys(variantDistribution).forEach(variant => {
    const variantUsers = variantDistribution[variant];
    const conversions = eventCounts[variant]?.['conversion'] || 0;
    conversionRates[variant] = variantUsers > 0 ? conversions / variantUsers : 0;
  });

  return {
    config,
    results,
    events,
    statistics: {
      totalUsers,
      variantDistribution,
      eventCounts,
      conversionRates
    }
  };
}

/**
 * End an A/B test and get final results
 */
export function endABTest(testName: string): {
  config: ABTestConfig | undefined;
  results: ABTestResult[];
  events: ABTestEvent[];
  statistics: {
    totalUsers: number;
    variantDistribution: Record<string, number>;
    eventCounts: Record<string, Record<string, number>>;
    conversionRates: Record<string, number>;
    winner?: string;
    confidence?: number;
  };
} {
  const results = getABTestResults(testName);
  
  // Remove from active tests
  activeTests.delete(testName);

  // Determine winner based on conversion rates
  const { conversionRates } = results.statistics;
  const variants = Object.keys(conversionRates);
  let winner: string | undefined;
  let confidence: number | undefined;

  if (variants.length > 1) {
    const sortedVariants = variants.sort((a, b) => conversionRates[b] - conversionRates[a]);
    winner = sortedVariants[0];
    
    // Simple confidence calculation (in production, use proper statistical methods)
    const winnerRate = conversionRates[winner];
    const secondBestRate = conversionRates[sortedVariants[1]];
    confidence = winnerRate > secondBestRate ? 
      Math.min(95, ((winnerRate - secondBestRate) / winnerRate) * 100) : 0;
  }

  return {
    ...results,
    statistics: {
      ...results.statistics,
      winner,
      confidence
    }
  };
}

/**
 * React hook for A/B testing
 */
export function useABTest(
  testName: string,
  userId: string,
  sessionId: string,
  fallbackVariant?: string
): {
  variant: string | null;
  trackEvent: (eventName: string, properties?: Record<string, any>) => void;
  isLoading: boolean;
} {
  const [variant, setVariant] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    const testVariant = getABTestVariant(testName, userId, sessionId, fallbackVariant);
    setVariant(testVariant);
    setIsLoading(false);
  }, [testName, userId, sessionId, fallbackVariant]);

  const trackEvent = React.useCallback((
    eventName: string, 
    properties?: Record<string, any>
  ) => {
    if (variant) {
      trackABTestEvent(testName, variant, eventName, userId, sessionId, properties);
    }
  }, [testName, variant, userId, sessionId]);

  return { variant, trackEvent, isLoading };
}

// Import React for the hook
import React from 'react';

// Predefined common A/B tests
export const commonABTests = {
  // Button style tests
  buttonStyle: {
    name: 'upload_button_style',
    variants: ['prominent', 'subtle', 'minimal'],
    trafficAllocation: 1.0
  },
  
  // Navigation tests
  navigationStyle: {
    name: 'mobile_navigation_style',
    variants: ['bottom', 'top', 'sidebar'],
    trafficAllocation: 1.0
  },
  
  // Form layout tests
  formLayout: {
    name: 'mobile_form_layout',
    variants: ['single_column', 'two_column', 'card_based'],
    trafficAllocation: 1.0
  },
  
  // Image gallery tests
  galleryLayout: {
    name: 'image_gallery_layout',
    variants: ['masonry', 'grid', 'list'],
    trafficAllocation: 1.0
  },
  
  // Color scheme tests
  colorScheme: {
    name: 'color_scheme',
    variants: ['default', 'high_contrast', 'dark'],
    trafficAllocation: 0.5
  }
};

// Initialize common tests
Object.values(commonABTests).forEach(test => {
  registerABTest(test);
});







