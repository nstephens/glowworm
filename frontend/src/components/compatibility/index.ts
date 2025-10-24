// Compatibility Components
export { BrowserCompatibility } from './BrowserCompatibility';
export { CrossBrowserTesting } from './CrossBrowserTesting';
export { FinalPolish } from './FinalPolish';

// Browser Detection
export { 
  detectBrowser, 
  getBrowserInfo, 
  getCapabilities, 
  isFeatureSupported,
  getUnsupportedFeatures,
  getPerformanceRecommendations 
} from '@/utils/browserDetection';

// Cross-Browser Testing
export { 
  useCrossBrowserTesting,
  createDefaultTestSuites,
  layoutTests,
  functionalityTests,
  performanceTests,
  accessibilityTests
} from '@/utils/crossBrowserTesting';
