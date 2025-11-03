/**
 * Thumb navigation utilities for mobile-optimized layouts
 * Ensures proper spacing and positioning for one-handed operation
 */

import { useState, useEffect } from 'react';

export interface ThumbZone {
  name: string;
  description: string;
  difficulty: 'easy' | 'comfortable' | 'stretch' | 'difficult';
  coordinates: {
    x: number; // Percentage from left
    y: number; // Percentage from top
  };
  radius: number; // Percentage radius
}

export interface DeviceSize {
  width: number;
  height: number;
  name: string;
}

export class ThumbNavigationOptimizer {
  private deviceSizes: DeviceSize[] = [
    { width: 375, height: 667, name: 'iPhone SE' },
    { width: 390, height: 844, name: 'iPhone 12/13' },
    { width: 414, height: 896, name: 'iPhone 11 Pro Max' },
    { width: 428, height: 926, name: 'iPhone 12/13 Pro Max' },
    { width: 360, height: 640, name: 'Android Small' },
    { width: 412, height: 915, name: 'Android Medium' },
    { width: 430, height: 932, name: 'Android Large' }
  ];

  /**
   * Get thumb zones for a specific device size
   */
  getThumbZones(deviceWidth: number, deviceHeight: number): ThumbZone[] {
    const aspectRatio = deviceWidth / deviceHeight;
    
    // Adjust zones based on device aspect ratio
    const isNarrow = aspectRatio < 0.5; // Very tall devices
    const isWide = aspectRatio > 0.6; // Wider devices
    
    return [
      {
        name: 'Easy Reach - Bottom Right',
        description: 'Most comfortable for right-handed users',
        difficulty: 'easy',
        coordinates: { x: 85, y: 85 },
        radius: 15
      },
      {
        name: 'Easy Reach - Bottom Left',
        description: 'Most comfortable for left-handed users',
        difficulty: 'easy',
        coordinates: { x: 15, y: 85 },
        radius: 15
      },
      {
        name: 'Comfortable - Bottom Center',
        description: 'Good for both hands',
        difficulty: 'comfortable',
        coordinates: { x: 50, y: 80 },
        radius: 20
      },
      {
        name: 'Comfortable - Right Side',
        description: 'Good for right-handed users',
        difficulty: 'comfortable',
        coordinates: { x: 90, y: 60 },
        radius: 12
      },
      {
        name: 'Comfortable - Left Side',
        description: 'Good for left-handed users',
        difficulty: 'comfortable',
        coordinates: { x: 10, y: 60 },
        radius: 12
      },
      {
        name: 'Stretch - Top Right',
        description: 'Requires thumb stretch',
        difficulty: 'stretch',
        coordinates: { x: 85, y: 25 },
        radius: 10
      },
      {
        name: 'Stretch - Top Left',
        description: 'Requires thumb stretch',
        difficulty: 'stretch',
        coordinates: { x: 15, y: 25 },
        radius: 10
      },
      {
        name: 'Difficult - Top Center',
        description: 'Requires two-handed operation',
        difficulty: 'difficult',
        coordinates: { x: 50, y: 15 },
        radius: 8
      }
    ];
  }

  /**
   * Get optimal button placement for a specific action type
   */
  getOptimalPlacement(actionType: 'primary' | 'secondary' | 'destructive' | 'navigation' | 'utility', isLeftHanded = false): ThumbZone {
    const zones = this.getThumbZones(375, 667); // Default to iPhone SE size
    
    switch (actionType) {
      case 'primary':
        return isLeftHanded ? zones[1] : zones[0]; // Easy reach zones
      case 'secondary':
        return zones[2]; // Bottom center
      case 'destructive':
        return isLeftHanded ? zones[4] : zones[3]; // Side zones for safety
      case 'navigation':
        return zones[2]; // Bottom center for easy access
      case 'utility':
        return isLeftHanded ? zones[4] : zones[3]; // Side zones
      default:
        return zones[2]; // Default to bottom center
    }
  }

  /**
   * Calculate optimal spacing between touch targets
   */
  getOptimalSpacing(deviceWidth: number, deviceHeight: number): {
    minSpacing: number;
    recommendedSpacing: number;
    maxSpacing: number;
  } {
    const diagonal = Math.sqrt(deviceWidth * deviceWidth + deviceHeight * deviceHeight);
    const baseSpacing = Math.max(8, diagonal * 0.02); // 2% of diagonal as base
    
    return {
      minSpacing: Math.max(8, baseSpacing * 0.8),
      recommendedSpacing: baseSpacing,
      maxSpacing: baseSpacing * 1.5
    };
  }

  /**
   * Get floating action button position
   */
  getFABPosition(isLeftHanded = false, hasBottomNav = true): {
    position: 'bottom-right' | 'bottom-left' | 'bottom-center';
    bottom: number;
    side: number;
  } {
    const bottomOffset = hasBottomNav ? 80 : 20; // Account for bottom navigation
    
    if (isLeftHanded) {
      return {
        position: 'bottom-left',
        bottom: bottomOffset,
        side: 16
      };
    } else {
      return {
        position: 'bottom-right',
        bottom: bottomOffset,
        side: 16
      };
    }
  }

  /**
   * Get safe area insets for different devices
   */
  getSafeAreaInsets(deviceWidth: number, deviceHeight: number): {
    top: number;
    bottom: number;
    left: number;
    right: number;
  } {
    // Basic safe area calculation - in real app, use CSS env() variables
    const hasNotch = deviceHeight > 800; // Rough detection
    const hasHomeIndicator = deviceHeight > 700;
    
    return {
      top: hasNotch ? 44 : 20,
      bottom: hasHomeIndicator ? 34 : 0,
      left: 0,
      right: 0
    };
  }

  /**
   * Generate CSS classes for thumb-optimized layouts
   */
  generateThumbLayoutClasses(isLeftHanded = false, hasBottomNav = true): {
    fab: string;
    primaryActions: string;
    secondaryActions: string;
    navigation: string;
    spacing: string;
  } {
    const fabPos = this.getFABPosition(isLeftHanded, hasBottomNav);
    
    return {
      fab: `fab-${fabPos.position}`,
      primaryActions: isLeftHanded ? 'thumb-primary-left' : 'thumb-primary-right',
      secondaryActions: 'thumb-secondary-center',
      navigation: 'thumb-navigation',
      spacing: 'thumb-spacing'
    };
  }
}

// Create singleton instance
export const thumbOptimizer = new ThumbNavigationOptimizer();

/**
 * React hook for thumb navigation optimization
 */
export function useThumbNavigation(isLeftHanded = false, hasBottomNav = true) {
  const [deviceSize, setDeviceSize] = useState<DeviceSize>({ width: 375, height: 667, name: 'iPhone SE' });
  
  useEffect(() => {
    const updateDeviceSize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Find closest device size
      const closest = thumbOptimizer.deviceSizes.reduce((prev, curr) => {
        const prevDiff = Math.abs(prev.width - width) + Math.abs(prev.height - height);
        const currDiff = Math.abs(curr.width - width) + Math.abs(curr.height - height);
        return currDiff < prevDiff ? curr : prev;
      });
      
      setDeviceSize(closest);
    };

    updateDeviceSize();
    window.addEventListener('resize', updateDeviceSize);
    return () => window.removeEventListener('resize', updateDeviceSize);
  }, []);

  const thumbZones = thumbOptimizer.getThumbZones(deviceSize.width, deviceSize.height);
  const spacing = thumbOptimizer.getOptimalSpacing(deviceSize.width, deviceSize.height);
  const fabPosition = thumbOptimizer.getFABPosition(isLeftHanded, hasBottomNav);
  const safeArea = thumbOptimizer.getSafeAreaInsets(deviceSize.width, deviceSize.height);
  const layoutClasses = thumbOptimizer.generateThumbLayoutClasses(isLeftHanded, hasBottomNav);

  return {
    deviceSize,
    thumbZones,
    spacing,
    fabPosition,
    safeArea,
    layoutClasses,
    getOptimalPlacement: (actionType: 'primary' | 'secondary' | 'destructive' | 'navigation' | 'utility') => 
      thumbOptimizer.getOptimalPlacement(actionType, isLeftHanded)
  };
}

export default thumbOptimizer;
