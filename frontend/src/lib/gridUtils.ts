import { cn } from '@/lib/utils';

/**
 * Grid utility functions for mobile-first responsive layouts
 */

export type GridVariant = 'default' | 'compact' | 'auto';

export interface GridOptions {
  variant?: GridVariant;
  equalHeight?: boolean;
  className?: string;
}

/**
 * Get responsive grid classes based on variant
 */
export function getResponsiveGridClasses(options: GridOptions = {}) {
  const { variant = 'default', equalHeight = false, className } = options;
  
  const baseClasses = {
    default: 'responsive-grid',
    compact: 'responsive-grid-compact', 
    auto: 'responsive-grid-auto',
  };
  
  return cn(
    baseClasses[variant],
    equalHeight && 'items-stretch',
    className
  );
}

/**
 * Convert legacy grid classes to responsive grid
 * This helps migrate existing hardcoded grid classes
 */
export function migrateGridClasses(legacyClasses: string): string {
  // Map common patterns to our responsive classes
  const patterns = [
    // Standard grid patterns
    { 
      pattern: /grid\s+grid-cols-1\s+sm:grid-cols-2\s+md:grid-cols-3\s+lg:grid-cols-4/g,
      replacement: 'responsive-grid'
    },
    { 
      pattern: /grid\s+grid-cols-1\s+sm:grid-cols-2\s+md:grid-cols-3\s+lg:grid-cols-3\s+xl:grid-cols-4/g,
      replacement: 'responsive-grid'
    },
    { 
      pattern: /grid\s+grid-cols-2\s+md:grid-cols-3\s+lg:grid-cols-4/g,
      replacement: 'responsive-grid'
    },
    // Compact patterns for dense layouts
    { 
      pattern: /grid\s+grid-cols-2\s+md:grid-cols-4\s+lg:grid-cols-6/g,
      replacement: 'responsive-grid-compact'
    },
    { 
      pattern: /grid\s+grid-cols-3\s+md:grid-cols-5\s+lg:grid-cols-6/g,
      replacement: 'responsive-grid-compact'
    },
    // Auto-fit patterns
    { 
      pattern: /grid\s+grid-cols-1\s+sm:grid-cols-2\s+md:grid-cols-3\s+lg:grid-cols-4\s+xl:grid-cols-4\s+2xl:grid-cols-5/g,
      replacement: 'responsive-grid-auto'
    },
  ];
  
  let migratedClasses = legacyClasses;
  
  patterns.forEach(({ pattern, replacement }) => {
    migratedClasses = migratedClasses.replace(pattern, replacement);
  });
  
  return migratedClasses;
}

/**
 * Mobile-first gap utilities
 */
export const mobileGaps = {
  xs: 'gap-1',      // 4px
  sm: 'gap-2',      // 8px  
  md: 'gap-3',      // 12px
  lg: 'gap-4',      // 16px
  xl: 'gap-6',      // 24px
  '2xl': 'gap-8',   // 32px
} as const;

/**
 * Get responsive gap classes
 */
export function getResponsiveGaps(mobile: keyof typeof mobileGaps = 'md') {
  return {
    mobile: mobileGaps[mobile],
    tablet: mobileGaps[Math.min(mobile === 'xs' ? 'sm' : mobile === 'sm' ? 'md' : mobile, 'xl') as keyof typeof mobileGaps],
    desktop: mobileGaps[Math.min(mobile === 'xs' ? 'md' : mobile === 'sm' ? 'lg' : mobile === 'md' ? 'xl' : '2xl', '2xl') as keyof typeof mobileGaps],
  };
}

/**
 * Content-specific grid utilities
 */
export const contentGrids = {
  // Dashboard info cards - compact mobile layout
  dashboard: {
    stats: 'responsive-grid-compact', // 3→4→5→6 columns for stat cards
    charts: 'responsive-grid', // 2→3→4→5→6 columns for chart layouts
    sidebar: 'responsive-grid', // Standard responsive grid
  },
  
  // Image galleries - dense mobile layout
  gallery: {
    images: 'responsive-grid-compact', // 3→4→5→6 columns for image thumbnails
    masonry: 'responsive-grid-auto', // Auto-fit for masonry layouts
    filters: 'responsive-grid', // 2→3→4→5→6 columns for filter controls
  },
  
  // Playlists - standard responsive
  playlists: {
    grid: 'responsive-grid', // 2→3→4→5→6 columns for playlist cards
    items: 'responsive-grid-compact', // 3→4→5→6 columns for playlist items
  },
  
  // Settings forms - single column mobile
  settings: {
    form: 'responsive-grid', // 1→2→3→4→5 columns for form fields
    sections: 'responsive-grid', // 1→2→3→4→5 columns for setting sections
  },
  
  // Device management - responsive cards
  devices: {
    cards: 'responsive-grid', // 1→2→3→4→5 columns for device cards
    details: 'responsive-grid', // 1→2→3→4→5 columns for device details
  },
} as const;

/**
 * Get content-specific grid classes
 */
export function getContentGrid(contentType: keyof typeof contentGrids, layout: string) {
  const contentGrid = contentGrids[contentType];
  return contentGrid[layout as keyof typeof contentGrid] || 'responsive-grid';
}

/**
 * Mobile-first spacing utilities
 */
export const mobileSpacing = {
  // Container padding
  container: {
    mobile: 'p-4', // 16px
    tablet: 'md:p-6', // 24px
    desktop: 'lg:p-8', // 32px
  },
  
  // Section spacing
  section: {
    mobile: 'space-y-4', // 16px
    tablet: 'md:space-y-6', // 24px
    desktop: 'lg:space-y-8', // 32px
  },
  
  // Card spacing
  card: {
    mobile: 'p-4', // 16px
    tablet: 'md:p-6', // 24px
    desktop: 'lg:p-8', // 32px
  },
} as const;

/**
 * Get mobile-first spacing classes
 */
export function getMobileSpacing(type: keyof typeof mobileSpacing) {
  const spacing = mobileSpacing[type];
  return cn(spacing.mobile, spacing.tablet, spacing.desktop);
}

/**
 * Mobile-optimized layout utilities
 */
export const mobileLayouts = {
  // Single column mobile, multi-column desktop
  singleToMulti: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  
  // Two column mobile, more on desktop
  twoToMulti: 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
  
  // Three column mobile, more on desktop
  threeToMulti: 'grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
  
  // Auto-fit with mobile constraints
  autoFit: 'grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] lg:grid-cols-[repeat(auto-fit,minmax(240px,1fr))]',
} as const;

/**
 * Get mobile-optimized layout classes
 */
export function getMobileLayout(layout: keyof typeof mobileLayouts) {
  return mobileLayouts[layout];
}
