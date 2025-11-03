/**
 * Display Modes Type Definitions
 * 
 * Defines types and configurations for all photo slideshow display modes.
 * Each mode has performance characteristics, visual effects, and behavioral specs.
 */

/**
 * All available display modes for photo slideshows
 */
export enum DisplayMode {
  // Existing modes
  DEFAULT = 'default',
  AUTO_SORT = 'auto_sort',
  MOVEMENT = 'movement',
  
  // Phase 1: Tier 1 - Raspberry Pi Safe
  KEN_BURNS_PLUS = 'ken_burns_plus',
  SOFT_GLOW = 'soft_glow',
  AMBIENT_PULSE = 'ambient_pulse',
  
  // Phase 2: Tier 2 - Moderate Performance
  DREAMY_REVEAL = 'dreamy_reveal',
  STACKED_REVEAL = 'stacked_reveal',
  PARALLAX_DEPTH = 'parallax_depth',
  
  // Phase 3: Tier 2 - Immersive
  COLOR_HARMONY = 'color_harmony',
  CINEMATIC_BARS = 'cinematic_bars',
  
  // Phase 4: Tier 3 - High Performance
  MAGIC_DUST = 'magic_dust',
  LIQUID_BLEND = 'liquid_blend',
}

/**
 * Performance tier classification
 */
export enum PerformanceTier {
  /** Safe for all Raspberry Pi devices - 30fps minimum */
  TIER_1 = 1,
  /** Moderate performance - 24fps minimum on RPi4 */
  TIER_2 = 2,
  /** High performance required - Desktop/high-end only */
  TIER_3 = 3,
}

/**
 * Emotional tone categories for display modes
 */
export enum EmotionalTone {
  WARM_NOSTALGIA = 'warm_nostalgia',
  DREAMY_MAGIC = 'dreamy_magic',
  MODERN_ELEGANCE = 'modern_elegance',
}

/**
 * Configuration for a display mode
 */
export interface DisplayModeConfig {
  /** Internal mode identifier */
  mode: DisplayMode;
  
  /** User-facing display name */
  displayName: string;
  
  /** Short description of the effect */
  description: string;
  
  /** Detailed explanation of how it works */
  detailedDescription?: string;
  
  /** Emotional feeling the mode creates */
  emotionalTone: EmotionalTone;
  
  /** Performance tier classification */
  tier: PerformanceTier;
  
  /** Whether mode requires WebGL support */
  requiresWebGL?: boolean;
  
  /** Whether mode requires Canvas API */
  requiresCanvas?: boolean;
  
  /** Whether mode requires color extraction (backend) */
  requiresColorData?: boolean;
  
  /** Warning message for high-performance modes */
  warningMessage?: string;
  
  /** Icon name or emoji for UI */
  icon?: string;
  
  /** Whether mode works with portrait images */
  supportsPortrait: boolean;
  
  /** Whether mode works with landscape images */
  supportsLandscape: boolean;
  
  /** Whether mode works with split-screen (stacked landscape) */
  supportsSplitScreen: boolean;
}

/**
 * Runtime state for Ken Burns Plus mode
 */
export interface KenBurnsState {
  /** Zoom direction for current image */
  zoomDirection: 'in' | 'out';
  
  /** Target pan position (percentage) */
  panTarget: {
    x: number; // 0-100
    y: number; // 0-100
  };
  
  /** Rotation angle in degrees */
  rotation: number; // -2 to 2
  
  /** Animation duration in ms */
  duration: number; // 25000-35000
  
  /** Current zoom level */
  scale: number; // 1.0 to 1.15
}

/**
 * Runtime state for Soft Glow mode
 */
export interface SoftGlowState {
  /** Brightness of outgoing image (1.0 → 0.7) */
  outgoingBrightness: number;
  
  /** Brightness of incoming image (1.3 → 1.0) */
  incomingBrightness: number;
  
  /** Opacity of outgoing image */
  outgoingOpacity: number;
  
  /** Opacity of incoming image */
  incomingOpacity: number;
}

/**
 * Runtime state for Ambient Pulse mode
 */
export interface AmbientPulseState {
  /** Animation duration synced with display interval (ms) */
  duration: number;
  
  /** Whether vignette is currently active */
  isActive: boolean;
  
  /** Current vignette intensity (0-1) */
  intensity: number;
}

/**
 * Runtime state for Dreamy Reveal mode
 */
export interface DreamyRevealState {
  /** Current blur amount in px (30 → 0) */
  blur: number;
  
  /** Current opacity (0.5 → 1.0) */
  opacity: number;
  
  /** Current scale (1.05 → 1.0) */
  scale: number;
  
  /** Whether to use advanced canvas-based blur */
  useAdvanced: boolean;
  
  /** Canvas reference for advanced mode */
  canvasRef?: HTMLCanvasElement;
}

/**
 * Runtime state for Stacked Reveal mode
 */
export interface StackedRevealState {
  /** Transform CSS for top image */
  topTransform: string;
  
  /** Transform CSS for bottom image */
  bottomTransform: string;
  
  /** Opacity for top image */
  topOpacity: number;
  
  /** Opacity for bottom image */
  bottomOpacity: number;
  
  /** Whether layers are staggered */
  isStaggered: boolean;
  
  /** Stagger delay in ms */
  staggerDelay: number;
}

/**
 * Runtime state for Parallax Depth mode
 */
export interface ParallaxDepthState {
  /** Offset for top layer (percentage) */
  topLayerOffset: number;
  
  /** Offset for bottom layer (percentage) */
  bottomLayerOffset: number;
  
  /** Parallax factor (0.6 = bottom moves 60% of top) */
  parallaxFactor: number;
  
  /** Pan direction */
  direction: 'left' | 'right' | 'up' | 'down';
  
  /** Edge blur gradient active */
  edgeBlur: boolean;
}

/**
 * Runtime state for Cinematic Bars mode
 */
export interface CinematicBarsState {
  /** Whether bars are currently visible */
  isVisible: boolean;
  
  /** Delay before bars fade in (ms) */
  fadeInDelay: number;
  
  /** Delay before bars fade out (ms) */
  fadeOutDelay: number;
  
  /** Bar opacity (0-0.4) */
  opacity: number;
  
  /** Bar height as percentage of screen */
  heightPercent: number;
}

/**
 * Runtime state for Color Harmony mode
 */
export interface ColorHarmonyState {
  /** Array of dominant color hex codes */
  dominantColors: string[]; // ["#RGB", "#RGB", "#RGB"]
  
  /** Background gradient opacity */
  backgroundOpacity: number;
  
  /** Whether colors are transitioning */
  isTransitioning: boolean;
  
  /** Previous colors (for smooth transitions) */
  previousColors?: string[];
}

/**
 * Particle definition for Magic Dust mode
 */
export interface Particle {
  /** X position in pixels */
  x: number;
  
  /** Y position in pixels */
  y: number;
  
  /** Velocity X (pixels per frame) */
  vx: number;
  
  /** Velocity Y (pixels per frame) */
  vy: number;
  
  /** Particle radius in pixels */
  radius: number; // 2-5
  
  /** Particle opacity */
  opacity: number; // 0.1-0.3
  
  /** Particle lifetime (0-1, controls fade) */
  life: number;
  
  /** Maximum lifetime in frames */
  maxLife: number;
}

/**
 * Runtime state for Magic Dust mode
 */
export interface MagicDustState {
  /** Array of active particles */
  particles: Particle[];
  
  /** Number of particles (device-dependent) */
  particleCount: number;
  
  /** Whether particle system is active */
  isActive: boolean;
  
  /** Canvas element reference */
  canvasRef: HTMLCanvasElement | null;
  
  /** Animation frame ID for cleanup */
  animationFrameId: number | null;
}

/**
 * Runtime state for Liquid Blend mode
 */
export interface LiquidBlendState {
  /** WebGL rendering context */
  gl: WebGLRenderingContext | null;
  
  /** Compiled shader program */
  program: WebGLProgram | null;
  
  /** Blend progress (0.0 to 1.0) */
  progress: number;
  
  /** Displacement texture for morphing */
  displacementTexture: WebGLTexture | null;
  
  /** Whether WebGL is being used */
  useWebGL: boolean;
  
  /** Fallback to CSS if WebGL unavailable */
  useFallback: boolean;
}

/**
 * Combined state for all display modes
 */
export interface DisplayModeState {
  currentMode: DisplayMode;
  kenBurns?: KenBurnsState;
  softGlow?: SoftGlowState;
  ambientPulse?: AmbientPulseState;
  dreamyReveal?: DreamyRevealState;
  stackedReveal?: StackedRevealState;
  parallaxDepth?: ParallaxDepthState;
  cinematicBars?: CinematicBarsState;
  colorHarmony?: ColorHarmonyState;
  magicDust?: MagicDustState;
  liquidBlend?: LiquidBlendState;
}

/**
 * Display mode configurations map
 * Used for UI rendering and capability checking
 */
export const DISPLAY_MODE_CONFIGS: Record<DisplayMode, DisplayModeConfig> = {
  [DisplayMode.DEFAULT]: {
    mode: DisplayMode.DEFAULT,
    displayName: 'Default Fade',
    description: 'Simple, elegant cross-fade transitions',
    emotionalTone: EmotionalTone.WARM_NOSTALGIA,
    tier: PerformanceTier.TIER_1,
    icon: '🔄',
    supportsPortrait: true,
    supportsLandscape: true,
    supportsSplitScreen: true,
  },
  
  [DisplayMode.AUTO_SORT]: {
    mode: DisplayMode.AUTO_SORT,
    displayName: 'Auto Sort (Stacked)',
    description: 'Stacks landscape images with offset transitions',
    emotionalTone: EmotionalTone.MODERN_ELEGANCE,
    tier: PerformanceTier.TIER_1,
    icon: '📚',
    supportsPortrait: true,
    supportsLandscape: true,
    supportsSplitScreen: true,
  },
  
  [DisplayMode.MOVEMENT]: {
    mode: DisplayMode.MOVEMENT,
    displayName: 'Movement (Ken Burns)',
    description: 'Slow pan across landscape images',
    emotionalTone: EmotionalTone.WARM_NOSTALGIA,
    tier: PerformanceTier.TIER_1,
    icon: '🎬',
    supportsPortrait: false,
    supportsLandscape: true,
    supportsSplitScreen: false,
  },
  
  [DisplayMode.KEN_BURNS_PLUS]: {
    mode: DisplayMode.KEN_BURNS_PLUS,
    displayName: 'Ken Burns Plus',
    description: 'Enhanced movement with zoom and subtle rotation',
    detailedDescription: 'Adds random zoom direction, combined pan movements, and gentle rotation for organic, non-repetitive viewing',
    emotionalTone: EmotionalTone.WARM_NOSTALGIA,
    tier: PerformanceTier.TIER_1,
    icon: '🎥',
    supportsPortrait: true,
    supportsLandscape: true,
    supportsSplitScreen: false,
  },
  
  [DisplayMode.SOFT_GLOW]: {
    mode: DisplayMode.SOFT_GLOW,
    displayName: 'Soft Glow',
    description: 'Warm, glowing transitions with brightness shifts',
    detailedDescription: 'Images fade with a gentle brightness bloom, creating a warm, nostalgic glow during transitions',
    emotionalTone: EmotionalTone.WARM_NOSTALGIA,
    tier: PerformanceTier.TIER_1,
    icon: '✨',
    supportsPortrait: true,
    supportsLandscape: true,
    supportsSplitScreen: true,
  },
  
  [DisplayMode.AMBIENT_PULSE]: {
    mode: DisplayMode.AMBIENT_PULSE,
    displayName: 'Ambient Pulse',
    description: 'Breathing vignette that pulses with the rhythm',
    detailedDescription: 'Subtle edge darkening that gently expands and contracts, creating a living, breathing feeling',
    emotionalTone: EmotionalTone.WARM_NOSTALGIA,
    tier: PerformanceTier.TIER_1,
    icon: '💫',
    supportsPortrait: true,
    supportsLandscape: true,
    supportsSplitScreen: true,
  },
  
  [DisplayMode.DREAMY_REVEAL]: {
    mode: DisplayMode.DREAMY_REVEAL,
    displayName: 'Dreamy Reveal',
    description: 'Images emerge from soft blur, like focusing your eyes',
    detailedDescription: 'Each image fades in from a dreamlike blur, mimicking natural eye focus for an ethereal, magical entrance',
    emotionalTone: EmotionalTone.DREAMY_MAGIC,
    tier: PerformanceTier.TIER_1, // Simple CSS version
    requiresCanvas: true, // Advanced version only
    icon: '🌙',
    supportsPortrait: true,
    supportsLandscape: true,
    supportsSplitScreen: true,
  },
  
  [DisplayMode.STACKED_REVEAL]: {
    mode: DisplayMode.STACKED_REVEAL,
    displayName: 'Stacked Reveal',
    description: 'Landscape layers slide in from opposite corners',
    detailedDescription: 'Each stacked layer moves independently with a gentle bounce, creating dynamic depth and visual interest',
    emotionalTone: EmotionalTone.MODERN_ELEGANCE,
    tier: PerformanceTier.TIER_2,
    icon: '📐',
    supportsPortrait: false,
    supportsLandscape: true,
    supportsSplitScreen: true,
  },
  
  [DisplayMode.PARALLAX_DEPTH]: {
    mode: DisplayMode.PARALLAX_DEPTH,
    displayName: 'Parallax Depth',
    description: 'Layers move at different speeds, creating 3D depth',
    detailedDescription: 'Foreground and background move independently with edge blur, creating a sense of dimensional space',
    emotionalTone: EmotionalTone.DREAMY_MAGIC,
    tier: PerformanceTier.TIER_2,
    icon: '🌄',
    supportsPortrait: true,
    supportsLandscape: true,
    supportsSplitScreen: true,
  },
  
  [DisplayMode.COLOR_HARMONY]: {
    mode: DisplayMode.COLOR_HARMONY,
    displayName: 'Color Harmony',
    description: 'Background adapts to each image\'s dominant colors',
    detailedDescription: 'Creates an immersive color environment by extracting and displaying dominant colors behind each image',
    emotionalTone: EmotionalTone.DREAMY_MAGIC,
    tier: PerformanceTier.TIER_2,
    requiresColorData: true,
    icon: '🎨',
    supportsPortrait: true,
    supportsLandscape: true,
    supportsSplitScreen: true,
  },
  
  [DisplayMode.CINEMATIC_BARS]: {
    mode: DisplayMode.CINEMATIC_BARS,
    displayName: 'Cinematic',
    description: 'Subtle letterbox bars for focused viewing',
    detailedDescription: 'Elegant black bars fade in and out, creating a cinematic, focused viewing experience',
    emotionalTone: EmotionalTone.MODERN_ELEGANCE,
    tier: PerformanceTier.TIER_2,
    icon: '🎞️',
    supportsPortrait: false,
    supportsLandscape: true,
    supportsSplitScreen: false,
  },
  
  [DisplayMode.MAGIC_DUST]: {
    mode: DisplayMode.MAGIC_DUST,
    displayName: 'Magic Dust ⚡',
    description: 'Floating particles like dust in sunlight',
    detailedDescription: 'Subtle particle effects drift across the screen, creating an ethereal, magical atmosphere',
    emotionalTone: EmotionalTone.DREAMY_MAGIC,
    tier: PerformanceTier.TIER_3,
    requiresCanvas: true,
    warningMessage: 'This effect requires high-performance hardware and may not run smoothly on Raspberry Pi devices.',
    icon: '✨',
    supportsPortrait: true,
    supportsLandscape: true,
    supportsSplitScreen: true,
  },
  
  [DisplayMode.LIQUID_BLEND]: {
    mode: DisplayMode.LIQUID_BLEND,
    displayName: 'Liquid Blend ⚡',
    description: 'Fluid morphing transitions between images',
    detailedDescription: 'Images blend through intermediate morphed states using advanced WebGL effects for stunning, dreamlike transitions',
    emotionalTone: EmotionalTone.DREAMY_MAGIC,
    tier: PerformanceTier.TIER_3,
    requiresWebGL: true,
    warningMessage: 'This effect requires WebGL support and high-performance hardware. Not recommended for Raspberry Pi devices.',
    icon: '🌊',
    supportsPortrait: true,
    supportsLandscape: true,
    supportsSplitScreen: false,
  },
};

/**
 * Get display modes grouped by performance tier
 */
export function getDisplayModesByTier(): Record<PerformanceTier, DisplayModeConfig[]> {
  const grouped: Record<PerformanceTier, DisplayModeConfig[]> = {
    [PerformanceTier.TIER_1]: [],
    [PerformanceTier.TIER_2]: [],
    [PerformanceTier.TIER_3]: [],
  };
  
  Object.values(DISPLAY_MODE_CONFIGS).forEach(config => {
    grouped[config.tier].push(config);
  });
  
  return grouped;
}

/**
 * Check if a display mode is compatible with current image type
 */
export function isModeCompatible(
  mode: DisplayMode,
  isPortrait: boolean,
  isSplitScreen: boolean
): boolean {
  const config = DISPLAY_MODE_CONFIGS[mode];
  
  if (isSplitScreen) {
    return config.supportsSplitScreen;
  }
  
  return isPortrait ? config.supportsPortrait : config.supportsLandscape;
}

/**
 * Get user-friendly tier description
 */
export function getTierDescription(tier: PerformanceTier): string {
  switch (tier) {
    case PerformanceTier.TIER_1:
      return '✓ Raspberry Pi Safe';
    case PerformanceTier.TIER_2:
      return '⚠ Moderate Performance';
    case PerformanceTier.TIER_3:
      return '⚡ High Performance Required';
  }
}

