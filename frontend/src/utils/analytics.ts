/**
 * Analytics integration utilities for mobile application
 * Provides tracking for user behavior, performance metrics, and business events
 */

export interface AnalyticsEvent {
  name: string;
  category: string;
  action: string;
  label?: string;
  value?: number;
  properties?: Record<string, any>;
  timestamp: number;
  userId?: string;
  sessionId?: string;
}

export interface PageViewEvent {
  page: string;
  title: string;
  url: string;
  referrer?: string;
  timestamp: number;
  userId?: string;
  sessionId?: string;
  properties?: Record<string, any>;
}

export interface PerformanceEvent {
  metric: string;
  value: number;
  unit: string;
  timestamp: number;
  userId?: string;
  sessionId?: string;
  properties?: Record<string, any>;
}

export interface UserEvent {
  event: string;
  properties?: Record<string, any>;
  timestamp: number;
  userId?: string;
  sessionId?: string;
}

// Analytics configuration
interface AnalyticsConfig {
  enabled: boolean;
  debug: boolean;
  providers: {
    googleAnalytics?: {
      measurementId: string;
      enabled: boolean;
    };
    mixpanel?: {
      token: string;
      enabled: boolean;
    };
    amplitude?: {
      apiKey: string;
      enabled: boolean;
    };
  };
  batchSize: number;
  flushInterval: number;
}

// Default configuration
const defaultConfig: AnalyticsConfig = {
  enabled: true,
  debug: process.env.NODE_ENV === 'development',
  providers: {
    googleAnalytics: {
      measurementId: process.env.REACT_APP_GA_MEASUREMENT_ID || '',
      enabled: !!process.env.REACT_APP_GA_MEASUREMENT_ID
    },
    mixpanel: {
      token: process.env.REACT_APP_MIXPANEL_TOKEN || '',
      enabled: !!process.env.REACT_APP_MIXPANEL_TOKEN
    },
    amplitude: {
      apiKey: process.env.REACT_APP_AMPLITUDE_API_KEY || '',
      enabled: !!process.env.REACT_APP_AMPLITUDE_API_KEY
    }
  },
  batchSize: 10,
  flushInterval: 10000 // 10 seconds
};

let config = { ...defaultConfig };
let eventQueue: AnalyticsEvent[] = [];
let flushTimer: NodeJS.Timeout | null = null;

/**
 * Initialize analytics
 */
export function initAnalytics(customConfig?: Partial<AnalyticsConfig>): void {
  config = { ...config, ...customConfig };
  
  if (!config.enabled) {
    console.log('Analytics disabled');
    return;
  }

  // Initialize Google Analytics
  if (config.providers.googleAnalytics?.enabled) {
    initGoogleAnalytics();
  }

  // Initialize Mixpanel
  if (config.providers.mixpanel?.enabled) {
    initMixpanel();
  }

  // Initialize Amplitude
  if (config.providers.amplitude?.enabled) {
    initAmplitude();
  }

  // Start flush timer
  startFlushTimer();

  console.log('Analytics initialized');
}

/**
 * Initialize Google Analytics 4
 */
function initGoogleAnalytics(): void {
  if (typeof window === 'undefined') return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${config.providers.googleAnalytics!.measurementId}`;
  document.head.appendChild(script);

  (window as any).dataLayer = (window as any).dataLayer || [];
  (window as any).gtag = function() {
    (window as any).dataLayer.push(arguments);
  };

  (window as any).gtag('js', new Date());
  (window as any).gtag('config', config.providers.googleAnalytics!.measurementId, {
    send_page_view: false
  });
}

/**
 * Initialize Mixpanel
 */
function initMixpanel(): void {
  if (typeof window === 'undefined') return;

  // Load Mixpanel script
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js';
  document.head.appendChild(script);

  script.onload = () => {
    (window as any).mixpanel.init(config.providers.mixpanel!.token, {
      debug: config.debug,
      track_pageview: false
    });
  };
}

/**
 * Initialize Amplitude
 */
function initAmplitude(): void {
  if (typeof window === 'undefined') return;

  // Load Amplitude script
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://cdn.amplitude.com/libs/amplitude-8.21.0-min.gz.js';
  document.head.appendChild(script);

  script.onload = () => {
    (window as any).amplitude.getInstance().init(config.providers.amplitude!.apiKey, undefined, {
      saveEvents: true,
      includeUtm: true,
      includeReferrer: true,
      includeGclid: true,
      includeFbclid: true
    });
  };
}

/**
 * Track a custom event
 */
export function trackEvent(
  name: string,
  category: string,
  action: string,
  label?: string,
  value?: number,
  properties?: Record<string, any>,
  userId?: string,
  sessionId?: string
): void {
  if (!config.enabled) return;

  const event: AnalyticsEvent = {
    name,
    category,
    action,
    label,
    value,
    properties,
    timestamp: Date.now(),
    userId,
    sessionId
  };

  eventQueue.push(event);

  // Send to providers
  sendToProviders(event);

  // Flush if queue is full
  if (eventQueue.length >= config.batchSize) {
    flushEvents();
  }

  if (config.debug) {
    console.log('Analytics Event:', event);
  }
}

/**
 * Track page view
 */
export function trackPageView(
  page: string,
  title: string,
  url: string,
  referrer?: string,
  userId?: string,
  sessionId?: string,
  properties?: Record<string, any>
): void {
  if (!config.enabled) return;

  const pageViewEvent: PageViewEvent = {
    page,
    title,
    url,
    referrer,
    timestamp: Date.now(),
    userId,
    sessionId,
    properties
  };

  // Send to Google Analytics
  if (config.providers.googleAnalytics?.enabled && (window as any).gtag) {
    (window as any).gtag('event', 'page_view', {
      page_title: title,
      page_location: url,
      page_path: page,
      user_id: userId,
      session_id: sessionId,
      ...properties
    });
  }

  // Send to Mixpanel
  if (config.providers.mixpanel?.enabled && (window as any).mixpanel) {
    (window as any).mixpanel.track('Page View', {
      page,
      title,
      url,
      referrer,
      user_id: userId,
      session_id: sessionId,
      ...properties
    });
  }

  // Send to Amplitude
  if (config.providers.amplitude?.enabled && (window as any).amplitude) {
    (window as any).amplitude.getInstance().logEvent('Page View', {
      page,
      title,
      url,
      referrer,
      user_id: userId,
      session_id: sessionId,
      ...properties
    });
  }

  if (config.debug) {
    console.log('Page View:', pageViewEvent);
  }
}

/**
 * Track performance metrics
 */
export function trackPerformance(
  metric: string,
  value: number,
  unit: string = 'ms',
  userId?: string,
  sessionId?: string,
  properties?: Record<string, any>
): void {
  if (!config.enabled) return;

  const performanceEvent: PerformanceEvent = {
    metric,
    value,
    unit,
    timestamp: Date.now(),
    userId,
    sessionId,
    properties
  };

  // Send to Google Analytics
  if (config.providers.googleAnalytics?.enabled && (window as any).gtag) {
    (window as any).gtag('event', 'timing_complete', {
      name: metric,
      value: value,
      event_category: 'Performance',
      user_id: userId,
      session_id: sessionId,
      ...properties
    });
  }

  // Send to Mixpanel
  if (config.providers.mixpanel?.enabled && (window as any).mixpanel) {
    (window as any).mixpanel.track('Performance Metric', {
      metric,
      value,
      unit,
      user_id: userId,
      session_id: sessionId,
      ...properties
    });
  }

  if (config.debug) {
    console.log('Performance Event:', performanceEvent);
  }
}

/**
 * Track user identification
 */
export function identifyUser(
  userId: string,
  properties?: Record<string, any>
): void {
  if (!config.enabled) return;

  // Send to Google Analytics
  if (config.providers.googleAnalytics?.enabled && (window as any).gtag) {
    (window as any).gtag('config', config.providers.googleAnalytics.measurementId, {
      user_id: userId
    });
  }

  // Send to Mixpanel
  if (config.providers.mixpanel?.enabled && (window as any).mixpanel) {
    (window as any).mixpanel.identify(userId);
    if (properties) {
      (window as any).mixpanel.people.set(properties);
    }
  }

  // Send to Amplitude
  if (config.providers.amplitude?.enabled && (window as any).amplitude) {
    (window as any).amplitude.getInstance().setUserId(userId);
    if (properties) {
      (window as any).amplitude.getInstance().setUserProperties(properties);
    }
  }

  if (config.debug) {
    console.log('User Identified:', { userId, properties });
  }
}

/**
 * Track user properties
 */
export function setUserProperties(properties: Record<string, any>): void {
  if (!config.enabled) return;

  // Send to Mixpanel
  if (config.providers.mixpanel?.enabled && (window as any).mixpanel) {
    (window as any).mixpanel.people.set(properties);
  }

  // Send to Amplitude
  if (config.providers.amplitude?.enabled && (window as any).amplitude) {
    (window as any).amplitude.getInstance().setUserProperties(properties);
  }

  if (config.debug) {
    console.log('User Properties Set:', properties);
  }
}

/**
 * Send events to all enabled providers
 */
function sendToProviders(event: AnalyticsEvent): void {
  // Send to Google Analytics
  if (config.providers.googleAnalytics?.enabled && (window as any).gtag) {
    (window as any).gtag('event', event.action, {
      event_category: event.category,
      event_label: event.label,
      value: event.value,
      user_id: event.userId,
      session_id: event.sessionId,
      ...event.properties
    });
  }

  // Send to Mixpanel
  if (config.providers.mixpanel?.enabled && (window as any).mixpanel) {
    (window as any).mixpanel.track(event.name, {
      category: event.category,
      action: event.action,
      label: event.label,
      value: event.value,
      user_id: event.userId,
      session_id: event.sessionId,
      ...event.properties
    });
  }

  // Send to Amplitude
  if (config.providers.amplitude?.enabled && (window as any).amplitude) {
    (window as any).amplitude.getInstance().logEvent(event.name, {
      category: event.category,
      action: event.action,
      label: event.label,
      value: event.value,
      user_id: event.userId,
      session_id: event.sessionId,
      ...event.properties
    });
  }
}

/**
 * Start flush timer
 */
function startFlushTimer(): void {
  if (flushTimer) {
    clearInterval(flushTimer);
  }

  flushTimer = setInterval(() => {
    if (eventQueue.length > 0) {
      flushEvents();
    }
  }, config.flushInterval);
}

/**
 * Flush queued events
 */
export function flushEvents(): void {
  if (eventQueue.length === 0) return;

  // In production, you would send these to your analytics backend
  if (config.debug) {
    console.log('Flushing events:', eventQueue);
  }

  eventQueue = [];
}

/**
 * Common event tracking functions
 */
export const commonEvents = {
  // User actions
  buttonClick: (buttonName: string, location?: string) => 
    trackEvent('Button Click', 'User Action', 'click', buttonName, undefined, { location }),
  
  linkClick: (linkText: string, destination: string) => 
    trackEvent('Link Click', 'User Action', 'click', linkText, undefined, { destination }),
  
  formSubmit: (formName: string, success: boolean) => 
    trackEvent('Form Submit', 'User Action', 'submit', formName, undefined, { success }),
  
  formError: (formName: string, errorType: string) => 
    trackEvent('Form Error', 'User Action', 'error', formName, undefined, { errorType }),
  
  // Navigation
  pageView: (page: string, title: string) => 
    trackPageView(page, title, window.location.href),
  
  navigation: (from: string, to: string) => 
    trackEvent('Navigation', 'User Action', 'navigate', `${from} to ${to}`),
  
  // Media interactions
  imageView: (imageId: string, source: string) => 
    trackEvent('Image View', 'Media', 'view', imageId, undefined, { source }),
  
  imageUpload: (imageCount: number, success: boolean) => 
    trackEvent('Image Upload', 'Media', 'upload', undefined, imageCount, { success }),
  
  imageDelete: (imageId: string) => 
    trackEvent('Image Delete', 'Media', 'delete', imageId),
  
  // Performance
  pageLoad: (loadTime: number, page: string) => 
    trackPerformance('page_load', loadTime, 'ms', undefined, undefined, { page }),
  
  apiCall: (endpoint: string, duration: number, success: boolean) => 
    trackPerformance('api_call', duration, 'ms', undefined, undefined, { endpoint, success }),
  
  // Errors
  error: (errorType: string, errorMessage: string, context?: string) => 
    trackEvent('Error', 'System', 'error', errorType, undefined, { errorMessage, context }),
  
  // Business events
  conversion: (conversionType: string, value?: number) => 
    trackEvent('Conversion', 'Business', 'convert', conversionType, value),
  
  subscription: (plan: string, value: number) => 
    trackEvent('Subscription', 'Business', 'subscribe', plan, value),
  
  // A/B Testing
  abTestExposure: (testName: string, variant: string) => 
    trackEvent('AB Test Exposure', 'Experiment', 'expose', testName, undefined, { variant }),
  
  abTestConversion: (testName: string, variant: string) => 
    trackEvent('AB Test Conversion', 'Experiment', 'convert', testName, undefined, { variant })
};

/**
 * React hook for analytics
 */
export function useAnalytics() {
  const trackEvent = React.useCallback((
    name: string,
    category: string,
    action: string,
    label?: string,
    value?: number,
    properties?: Record<string, any>
  ) => {
    trackEvent(name, category, action, label, value, properties);
  }, []);

  const trackPageView = React.useCallback((
    page: string,
    title: string,
    properties?: Record<string, any>
  ) => {
    trackPageView(page, title, window.location.href, undefined, undefined, undefined, properties);
  }, []);

  const trackPerformance = React.useCallback((
    metric: string,
    value: number,
    unit?: string,
    properties?: Record<string, any>
  ) => {
    trackPerformance(metric, value, unit, undefined, undefined, properties);
  }, []);

  return {
    trackEvent,
    trackPageView,
    trackPerformance,
    commonEvents
  };
}

// Import React for the hook
import React from 'react';




