/**
 * Color Contrast Utilities
 * 
 * Utilities for testing color contrast ratios for WCAG 2.1 AA compliance
 */

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Calculate relative luminance according to WCAG 2.1
 */
function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);

  if (!rgb1 || !rgb2) {
    throw new Error('Invalid hex color provided');
  }

  const lum1 = getRelativeLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getRelativeLuminance(rgb2.r, rgb2.g, rgb2.b);

  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG 2.1 AA standards
 */
export function meetsWCAG_AA(contrastRatio: number, isLargeText: boolean = false): boolean {
  const requiredRatio = isLargeText ? 3 : 4.5;
  return contrastRatio >= requiredRatio;
}

/**
 * Check if contrast ratio meets WCAG 2.1 AAA standards
 */
export function meetsWCAG_AAA(contrastRatio: number, isLargeText: boolean = false): boolean {
  const requiredRatio = isLargeText ? 4.5 : 7;
  return contrastRatio >= requiredRatio;
}

/**
 * Test a color combination for WCAG compliance
 */
export interface ColorTest {
  foreground: string;
  background: string;
  contrastRatio: number;
  meetsAA: boolean;
  meetsAAA: boolean;
  meetsAA_LargeText: boolean;
  meetsAAA_LargeText: boolean;
}

export function testColorCombination(
  foreground: string,
  background: string
): ColorTest {
  const contrastRatio = getContrastRatio(foreground, background);

  return {
    foreground,
    background,
    contrastRatio: Math.round(contrastRatio * 100) / 100,
    meetsAA: meetsWCAG_AA(contrastRatio, false),
    meetsAAA: meetsWCAG_AAA(contrastRatio, false),
    meetsAA_LargeText: meetsWCAG_AA(contrastRatio, true),
    meetsAAA_LargeText: meetsWCAG_AAA(contrastRatio, true),
  };
}

