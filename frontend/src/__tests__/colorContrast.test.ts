/**
 * Color Contrast Accessibility Tests
 * 
 * Tests to ensure all color combinations meet WCAG 2.1 AA compliance standards
 */

import { describe, it, expect } from 'vitest';
import { testColorCombination } from '../utils/colorContrast';
import { criticalCombinations, lightModeColors, darkModeColors } from '../utils/colorPalette';

describe('Color Contrast - WCAG 2.1 AA Compliance', () => {
  describe('Light Mode', () => {
    it.each(criticalCombinations.light)(
      'should meet WCAG AA for $name',
      ({ foreground, background, name }) => {
        const result = testColorCombination(foreground, background);

        expect(result.meetsAA, `${name} (${foreground} on ${background}) has contrast ratio of ${result.contrastRatio}:1, which fails WCAG AA (requires 4.5:1 for normal text)`).toBe(true);
      }
    );

    it('primary button combination should have high contrast', () => {
      const result = testColorCombination(
        lightModeColors.primaryForeground,
        lightModeColors.primary
      );

      expect(result.contrastRatio).toBeGreaterThanOrEqual(4.5);
      expect(result.meetsAA).toBe(true);
    });

    it('secondary button combination should have high contrast', () => {
      const result = testColorCombination(
        lightModeColors.secondaryForeground,
        lightModeColors.secondary
      );

      expect(result.contrastRatio).toBeGreaterThanOrEqual(4.5);
      expect(result.meetsAA).toBe(true);
    });

    it('body text should have sufficient contrast', () => {
      const result = testColorCombination(
        lightModeColors.foreground,
        lightModeColors.background
      );

      expect(result.contrastRatio).toBeGreaterThanOrEqual(4.5);
      expect(result.meetsAA).toBe(true);
    });

    it('muted text should meet AA for large text (3:1)', () => {
      const result = testColorCombination(
        lightModeColors.mutedForeground,
        lightModeColors.background
      );

      // Muted text might not meet AA for normal text, but should meet it for large text
      expect(result.meetsAA_LargeText).toBe(true);
    });
  });

  describe('Dark Mode', () => {
    it.each(criticalCombinations.dark)(
      'should meet WCAG AA for $name',
      ({ foreground, background, name }) => {
        const result = testColorCombination(foreground, background);

        expect(result.meetsAA, `${name} (${foreground} on ${background}) has contrast ratio of ${result.contrastRatio}:1, which fails WCAG AA (requires 4.5:1 for normal text)`).toBe(true);
      }
    );

    it('primary button combination should have high contrast', () => {
      const result = testColorCombination(
        darkModeColors.primaryForeground,
        darkModeColors.primary
      );

      expect(result.contrastRatio).toBeGreaterThanOrEqual(4.5);
      expect(result.meetsAA).toBe(true);
    });

    it('secondary button combination should have high contrast', () => {
      const result = testColorCombination(
        darkModeColors.secondaryForeground,
        darkModeColors.secondary
      );

      expect(result.contrastRatio).toBeGreaterThanOrEqual(4.5);
      expect(result.meetsAA).toBe(true);
    });

    it('body text should have sufficient contrast', () => {
      const result = testColorCombination(
        darkModeColors.foreground,
        darkModeColors.background
      );

      expect(result.contrastRatio).toBeGreaterThanOrEqual(4.5);
      expect(result.meetsAA).toBe(true);
    });

    it('muted text should meet AA for large text (3:1)', () => {
      const result = testColorCombination(
        darkModeColors.mutedForeground,
        darkModeColors.background
      );

      // Muted text might not meet AA for normal text, but should meet it for large text
      expect(result.meetsAA_LargeText).toBe(true);
    });
  });

  describe('Contrast Ratio Calculations', () => {
    it('should calculate correct contrast ratio for black on white', () => {
      const result = testColorCombination('#000000', '#ffffff');
      expect(result.contrastRatio).toBe(21); // Maximum contrast ratio
    });

    it('should calculate correct contrast ratio for white on black', () => {
      const result = testColorCombination('#ffffff', '#000000');
      expect(result.contrastRatio).toBe(21); // Maximum contrast ratio (order doesn't matter)
    });

    it('should calculate correct contrast ratio for same colors', () => {
      const result = testColorCombination('#6366f1', '#6366f1');
      expect(result.contrastRatio).toBe(1); // Minimum contrast ratio
    });
  });

  describe('WCAG Standards', () => {
    it('should identify combinations that meet AAA standards', () => {
      const result = testColorCombination('#000000', '#ffffff');
      expect(result.meetsAAA).toBe(true);
      expect(result.meetsAAA_LargeText).toBe(true);
    });

    it('should correctly classify borderline AA compliance', () => {
      // A combination with exactly 4.5:1 ratio should pass AA for normal text
      const result = testColorCombination('#767676', '#ffffff');
      expect(result.contrastRatio).toBeGreaterThanOrEqual(4.5);
      expect(result.meetsAA).toBe(true);
    });
  });
});

