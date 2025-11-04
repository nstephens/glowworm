/**
 * Display Mode Type Definitions and Configuration
 * 
 * Defines all available display modes, performance tiers, and their metadata
 * for the GlowWorm photo slideshow system.
 */

export enum DisplayMode {
  // Original modes
  DEFAULT = 'default',
  MOVEMENT = 'movement',
  
  // Tier 1: Raspberry Pi Safe (30fps)
  KEN_BURNS_PLUS = 'ken_burns_plus',
  SOFT_GLOW = 'soft_glow',
  AMBIENT_PULSE = 'ambient_pulse',
  
  // Tier 2: Moderate Performance (24-30fps)
  DREAMY_REVEAL = 'dreamy_reveal',
  STACKED_REVEAL = 'stacked_reveal',
}

export enum PerformanceTier {
  TIER_1 = 1, // Raspberry Pi Safe - 30fps on RPi4
  TIER_2 = 2, // Moderate Performance - 24-30fps on RPi4
  TIER_3 = 3, // High Performance Required - 15-24fps on RPi4
}

export interface DisplayModeConfig {
  /** Internal mode identifier */
  mode: DisplayMode;
  /** User-friendly display name */
  displayName: string;
  /** Brief description of the effect */
  description: string;
  /** Emotional tone (Warm Nostalgia, Dreamy Magic, Modern Elegance) */
  emotionalTone: string;
  /** Performance tier classification */
  tier: PerformanceTier;
  /** Whether this mode requires WebGL support */
  requiresWebGL?: boolean;
  /** Whether this mode requires Canvas support */
  requiresCanvas?: boolean;
  /** Warning message for high-performance modes */
  warningMessage?: string;
  /** Whether this mode works with split-screen */
  supportsSplitScreen?: boolean;
  /** Whether this mode is landscape-only */
  landscapeOnly?: boolean;
}

/**
 * Complete configuration for all display modes
 */
export const DISPLAY_MODE_CONFIGS: Record<DisplayMode, DisplayModeConfig> = {
  [DisplayMode.DEFAULT]: {
    mode: DisplayMode.DEFAULT,
    displayName: 'Default Fade',
    description: 'Simple cross-fade transitions between images',
    emotionalTone: 'Classic',
    tier: PerformanceTier.TIER_1,
    supportsSplitScreen: true
  },
  
  [DisplayMode.MOVEMENT]: {
    mode: DisplayMode.MOVEMENT,
    displayName: 'Movement (Legacy)',
    description: 'Ken Burns-style pan for landscape images',
    emotionalTone: 'Dynamic',
    tier: PerformanceTier.TIER_1,
    landscapeOnly: true
  },
  
  [DisplayMode.KEN_BURNS_PLUS]: {
    mode: DisplayMode.KEN_BURNS_PLUS,
    displayName: 'Ken Burns Plus',
    description: 'Enhanced zoom, pan, and rotation effects',
    emotionalTone: 'Warm Nostalgia',
    tier: PerformanceTier.TIER_1
  },
  
  [DisplayMode.SOFT_GLOW]: {
    mode: DisplayMode.SOFT_GLOW,
    displayName: 'Soft Glow',
    description: 'Warm glowing cross-fades like memories',
    emotionalTone: 'Warm Nostalgia',
    tier: PerformanceTier.TIER_1
  },
  
  [DisplayMode.AMBIENT_PULSE]: {
    mode: DisplayMode.AMBIENT_PULSE,
    displayName: 'Ambient Pulse',
    description: 'Breathing vignette creates living atmosphere',
    emotionalTone: 'Warm Nostalgia',
    tier: PerformanceTier.TIER_1
  },
  
  [DisplayMode.DREAMY_REVEAL]: {
    mode: DisplayMode.DREAMY_REVEAL,
    displayName: 'Dreamy Reveal',
    description: 'Images emerge from soft blur to focus',
    emotionalTone: 'Dreamy Magic',
    tier: PerformanceTier.TIER_1
  },
  
  [DisplayMode.STACKED_REVEAL]: {
    mode: DisplayMode.STACKED_REVEAL,
    displayName: 'Stacked Reveal',
    description: 'Dynamic dual-layer slide-in animations',
    emotionalTone: 'Modern Elegance',
    tier: PerformanceTier.TIER_2,
    supportsSplitScreen: true,
    landscapeOnly: true
  },
};

/**
 * Get display mode configuration by mode value
 */
export const getDisplayModeConfig = (mode: string): DisplayModeConfig => {
  const displayMode = mode as DisplayMode;
  return DISPLAY_MODE_CONFIGS[displayMode] || DISPLAY_MODE_CONFIGS[DisplayMode.DEFAULT];
};

/**
 * Get all display modes for a specific tier
 */
export const getDisplayModesByTier = (tier: PerformanceTier): DisplayModeConfig[] => {
  return Object.values(DISPLAY_MODE_CONFIGS).filter(config => config.tier === tier);
};

/**
 * Performance tier labels and descriptions
 */
export const PERFORMANCE_TIER_LABELS = {
  [PerformanceTier.TIER_1]: {
    label: '✓ Raspberry Pi Safe (Tier 1)',
    description: '30fps on RPi4, 60fps on desktop'
  },
  [PerformanceTier.TIER_2]: {
    label: '⚠ Moderate Performance (Tier 2)',
    description: '24-30fps on RPi4, 60fps on desktop'
  },
  [PerformanceTier.TIER_3]: {
    label: '⚡ High Performance Only (Tier 3)',
    description: '15-24fps on RPi4, 60fps on desktop'
  }
};
