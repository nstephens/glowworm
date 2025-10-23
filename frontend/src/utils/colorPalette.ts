/**
 * Color Palette Definitions
 * 
 * Centralized definitions of the application's color palette for testing and documentation
 */

export const lightModeColors = {
  // Primary Palette (WCAG AA compliant)
  primary: '#4f46e5', // Darker indigo for better contrast
  primaryForeground: '#ffffff',
  secondary: '#b45309', // Even darker amber for WCAG AA compliance
  secondaryForeground: '#ffffff',

  // Neutral Palette
  background: '#fafafa', // Warm white
  foreground: '#1f2937', // Charcoal
  muted: '#f3f4f6', // Light gray
  mutedForeground: '#6b7280', // Medium gray

  // Accent Colors (WCAG AA compliant)
  accent: '#db2777', // Darker pink for better contrast
  accentForeground: '#ffffff',
  success: '#059669', // Darker emerald for better contrast
  successForeground: '#ffffff',
  warning: '#b45309', // Even darker amber for WCAG AA compliance
  warningForeground: '#ffffff',
  destructive: '#dc2626', // Darker red for better contrast
  destructiveForeground: '#ffffff',

  // UI Elements
  card: '#ffffff',
  cardForeground: '#1f2937',
  popover: '#ffffff',
  popoverForeground: '#1f2937',
  border: '#e5e7eb',
  input: '#f9fafb',
};

export const darkModeColors = {
  // Primary Palette
  primary: '#818cf8', // Lighter indigo for dark mode
  primaryForeground: '#0f172a',
  secondary: '#fbbf24', // Lighter amber for dark mode
  secondaryForeground: '#0f172a',

  // Neutral Palette
  background: '#0f172a', // Deep navy
  foreground: '#f1f5f9', // Soft white
  muted: '#1e293b', // Slate
  mutedForeground: '#94a3b8', // Light slate

  // Accent Colors
  accent: '#f472b6', // Lighter pink for dark mode
  accentForeground: '#0f172a',
  success: '#34d399', // Lighter emerald
  successForeground: '#0f172a',
  warning: '#fbbf24', // Lighter amber
  warningForeground: '#0f172a',
  destructive: '#f87171', // Lighter red
  destructiveForeground: '#0f172a',

  // UI Elements
  card: '#1e293b',
  cardForeground: '#f1f5f9',
  popover: '#1e293b',
  popoverForeground: '#f1f5f9',
  border: '#334155',
  input: '#1e293b',
};

/**
 * Critical color combinations that must meet WCAG AA standards
 */
export const criticalCombinations = {
  light: [
    { foreground: lightModeColors.foreground, background: lightModeColors.background, name: 'Body text on background' },
    { foreground: lightModeColors.primaryForeground, background: lightModeColors.primary, name: 'Primary button text' },
    { foreground: lightModeColors.secondaryForeground, background: lightModeColors.secondary, name: 'Secondary button text' },
    { foreground: lightModeColors.accentForeground, background: lightModeColors.accent, name: 'Accent button text' },
    { foreground: lightModeColors.destructiveForeground, background: lightModeColors.destructive, name: 'Destructive button text' },
    { foreground: lightModeColors.mutedForeground, background: lightModeColors.background, name: 'Muted text on background' },
    { foreground: lightModeColors.cardForeground, background: lightModeColors.card, name: 'Card text on card background' },
  ],
  dark: [
    { foreground: darkModeColors.foreground, background: darkModeColors.background, name: 'Body text on background' },
    { foreground: darkModeColors.primaryForeground, background: darkModeColors.primary, name: 'Primary button text' },
    { foreground: darkModeColors.secondaryForeground, background: darkModeColors.secondary, name: 'Secondary button text' },
    { foreground: darkModeColors.accentForeground, background: darkModeColors.accent, name: 'Accent button text' },
    { foreground: darkModeColors.destructiveForeground, background: darkModeColors.destructive, name: 'Destructive button text' },
    { foreground: darkModeColors.mutedForeground, background: darkModeColors.background, name: 'Muted text on background' },
    { foreground: darkModeColors.cardForeground, background: darkModeColors.card, name: 'Card text on card background' },
  ],
};

