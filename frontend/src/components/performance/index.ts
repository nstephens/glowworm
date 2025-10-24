// Performance Components
export { PerformanceMonitor } from './PerformanceMonitor';

// Performance Hooks
export { 
  usePerformance, 
  useDebounce, 
  useThrottle, 
  useIntersectionObserver, 
  useVirtualScroll, 
  useMemoryUsage, 
  useNetworkStatus 
} from '@/hooks/usePerformance';

// Service Worker
export { 
  useServiceWorker, 
  useOfflineDetection, 
  useCacheManagement 
} from '@/hooks/useServiceWorker';

// Image Optimization
export { 
  useImageOptimization, 
  useResponsiveImage 
} from '@/utils/imageOptimization';

// Bundle Analysis
export { 
  useBundleAnalysis, 
  checkBundleSizeBudget 
} from '@/utils/bundleAnalyzer';

// Virtualized Components
export { 
  VirtualizedList, 
  VirtualizedGrid, 
  useVirtualizedList 
} from '@/components/common/VirtualizedList';
