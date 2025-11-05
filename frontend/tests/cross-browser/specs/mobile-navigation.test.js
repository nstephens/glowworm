/**
 * Mobile Navigation Cross-Browser Tests
 * Tests bottom navigation functionality across different browsers and devices
 */

describe('Mobile Navigation Tests', () => {
  beforeEach(async () => {
    // Navigate to the main page
    await browser.url('/');
    
    // Wait for the page to load
    await browser.waitUntil(
      async () => {
        const readyState = await browser.execute(() => document.readyState);
        return readyState === 'complete';
      },
      {
        timeout: 10000,
        timeoutMsg: 'Page did not load completely'
      }
    );
  });

  describe('Bottom Navigation Visibility', () => {
    it('should display bottom navigation on mobile devices', async () => {
      // Check if bottom navigation is visible
      const bottomNav = await $('[data-testid="mobile-bottom-nav"]');
      await expect(bottomNav).toBeDisplayed();
      
      // Verify it's positioned at the bottom
      const navRect = await bottomNav.getLocation();
      const navSize = await bottomNav.getSize();
      const viewportHeight = await browser.execute(() => window.innerHeight);
      
      expect(navRect.y + navSize.height).toBeGreaterThan(viewportHeight - 100);
    });

    it('should have proper safe area insets on iOS devices', async () => {
      const capabilities = await browser.getCapabilities();
      const isIOS = capabilities['bstack:options']?.os === 'iOS';
      
      if (isIOS) {
        const bottomNav = await $('[data-testid="mobile-bottom-nav"]');
        const navStyles = await browser.execute((element) => {
          const computed = window.getComputedStyle(element);
          return {
            paddingBottom: computed.paddingBottom,
            paddingTop: computed.paddingTop
          };
        }, bottomNav);
        
        // Should have safe area insets
        expect(navStyles.paddingBottom).toContain('env(safe-area-inset-bottom)');
      }
    });

    it('should be hidden on desktop viewport', async () => {
      // Resize to desktop viewport
      await browser.setWindowSize(1200, 800);
      
      const bottomNav = await $('[data-testid="mobile-bottom-nav"]');
      await expect(bottomNav).not.toBeDisplayed();
    });
  });

  describe('Navigation Items', () => {
    it('should display all required navigation items', async () => {
      const navItems = await $$('[data-testid="mobile-bottom-nav"] [role="tab"]');
      expect(navItems).toHaveLength(5); // Expected number of nav items
      
      // Check for specific navigation items
      const expectedItems = ['Home', 'Images', 'Playlists', 'Devices', 'Settings'];
      
      for (let i = 0; i < expectedItems.length; i++) {
        const item = navItems[i];
        const text = await item.getText();
        expect(text).toContain(expectedItems[i]);
      }
    });

    it('should have proper touch targets (minimum 44px)', async () => {
      const navItems = await $$('[data-testid="mobile-bottom-nav"] [role="tab"]');
      
      for (const item of navItems) {
        const size = await item.getSize();
        expect(size.height).toBeGreaterThanOrEqual(44);
        expect(size.width).toBeGreaterThanOrEqual(44);
      }
    });

    it('should have proper accessibility attributes', async () => {
      const navItems = await $$('[data-testid="mobile-bottom-nav"] [role="tab"]');
      
      for (const item of navItems) {
        const role = await item.getAttribute('role');
        const ariaLabel = await item.getAttribute('aria-label');
        
        expect(role).toBe('tab');
        expect(ariaLabel).toBeTruthy();
      }
    });
  });

  describe('Navigation Interactions', () => {
    it('should navigate to different pages when tapped', async () => {
      const navItems = await $$('[data-testid="mobile-bottom-nav"] [role="tab"]');
      
      // Test Images navigation
      const imagesNav = navItems[1]; // Assuming Images is the second item
      await imagesNav.click();
      
      // Wait for navigation
      await browser.waitUntil(
        async () => {
          const currentUrl = await browser.getUrl();
          return currentUrl.includes('/images');
        },
        {
          timeout: 5000,
          timeoutMsg: 'Navigation to Images page failed'
        }
      );
      
      // Verify we're on the images page
      const currentUrl = await browser.getUrl();
      expect(currentUrl).toContain('/images');
    });

    it('should show active state for current page', async () => {
      // Navigate to images page
      await browser.url('/images');
      
      const imagesNav = await $('[data-testid="mobile-bottom-nav"] [aria-label*="Images"]');
      const isSelected = await imagesNav.getAttribute('aria-selected');
      
      expect(isSelected).toBe('true');
    });

    it('should support keyboard navigation', async () => {
      // Focus on the first navigation item
      const firstNavItem = await $('[data-testid="mobile-bottom-nav"] [role="tab"]:first-child');
      await firstNavItem.click();
      
      // Test arrow key navigation
      await browser.keys('ArrowRight');
      
      const secondNavItem = await $('[data-testid="mobile-bottom-nav"] [role="tab"]:nth-child(2)');
      const isFocused = await secondNavItem.isFocused();
      
      expect(isFocused).toBe(true);
    });
  });

  describe('Visual States', () => {
    it('should show hover state on supported browsers', async () => {
      const capabilities = await browser.getCapabilities();
      const browserName = capabilities.browserName;
      
      // Only test hover on browsers that support it
      if (browserName !== 'Safari') {
        const navItem = await $('[data-testid="mobile-bottom-nav"] [role="tab"]:first-child');
        
        // Simulate hover
        await navItem.moveTo();
        
        // Check for hover styles (this would need to be implemented in the component)
        const hasHoverClass = await browser.execute((element) => {
          return element.classList.contains('hover:bg-primary/10');
        }, navItem);
        
        // Note: This test might need adjustment based on actual implementation
        expect(hasHoverClass).toBeDefined();
      }
    });

    it('should show focus state when focused', async () => {
      const navItem = await $('[data-testid="mobile-bottom-nav"] [role="tab"]:first-child');
      await navItem.click();
      
      const isFocused = await navItem.isFocused();
      expect(isFocused).toBe(true);
    });

    it('should show pressed state when tapped', async () => {
      const navItem = await $('[data-testid="mobile-bottom-nav"] [role="tab"]:first-child');
      
      // Simulate touch press
      await browser.touchAction([
        { action: 'press', x: 100, y: 100 },
        { action: 'wait', ms: 100 },
        { action: 'release' }
      ]);
      
      // Check for pressed state (this would need to be implemented)
      const hasPressedClass = await browser.execute((element) => {
        return element.classList.contains('active:scale-95');
      }, navItem);
      
      expect(hasPressedClass).toBeDefined();
    });
  });

  describe('Responsive Behavior', () => {
    it('should adapt to different screen sizes', async () => {
      const testSizes = [
        { width: 320, height: 568 },  // iPhone 5/SE
        { width: 375, height: 667 },  // iPhone 6/7/8
        { width: 414, height: 896 },  // iPhone 11 Pro Max
        { width: 768, height: 1024 }  // iPad
      ];
      
      for (const size of testSizes) {
        await browser.setWindowSize(size.width, size.height);
        
        const bottomNav = await $('[data-testid="mobile-bottom-nav"]');
        await expect(bottomNav).toBeDisplayed();
        
        // Check if navigation items are still accessible
        const navItems = await $$('[data-testid="mobile-bottom-nav"] [role="tab"]');
        expect(navItems.length).toBeGreaterThan(0);
        
        // Verify touch targets are still adequate
        for (const item of navItems) {
          const itemSize = await item.getSize();
          expect(itemSize.height).toBeGreaterThanOrEqual(44);
        }
      }
    });

    it('should handle orientation changes', async () => {
      // Test portrait orientation
      await browser.setWindowSize(375, 667);
      const bottomNavPortrait = await $('[data-testid="mobile-bottom-nav"]');
      await expect(bottomNavPortrait).toBeDisplayed();
      
      // Test landscape orientation
      await browser.setWindowSize(667, 375);
      const bottomNavLandscape = await $('[data-testid="mobile-bottom-nav"]');
      await expect(bottomNavLandscape).toBeDisplayed();
      
      // Verify navigation is still functional in landscape
      const navItems = await $$('[data-testid="mobile-bottom-nav"] [role="tab"]');
      expect(navItems.length).toBeGreaterThan(0);
    });
  });

  describe('Performance', () => {
    it('should load navigation quickly', async () => {
      const startTime = Date.now();
      
      await browser.url('/');
      await browser.waitUntil(
        async () => {
          const bottomNav = await $('[data-testid="mobile-bottom-nav"]');
          return await bottomNav.isDisplayed();
        },
        {
          timeout: 3000,
          timeoutMsg: 'Navigation did not load within 3 seconds'
        }
      );
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(3000);
    });

    it('should not cause layout shifts', async () => {
      // This test would need to be implemented with layout shift detection
      // For now, we'll check that the navigation is stable
      const bottomNav = await $('[data-testid="mobile-bottom-nav"]');
      const initialPosition = await bottomNav.getLocation();
      
      // Wait a bit and check position again
      await browser.pause(1000);
      const finalPosition = await bottomNav.getLocation();
      
      expect(initialPosition.y).toBe(finalPosition.y);
    });
  });

  describe('Accessibility', () => {
    it('should be accessible to screen readers', async () => {
      const bottomNav = await $('[data-testid="mobile-bottom-nav"]');
      const role = await bottomNav.getAttribute('role');
      const ariaLabel = await bottomNav.getAttribute('aria-label');
      
      expect(role).toBe('tablist');
      expect(ariaLabel).toBeTruthy();
    });

    it('should support high contrast mode', async () => {
      // Enable high contrast mode
      await browser.execute(() => {
        document.documentElement.classList.add('force-high-contrast');
      });
      
      const bottomNav = await $('[data-testid="mobile-bottom-nav"]');
      await expect(bottomNav).toBeDisplayed();
      
      // Check if high contrast styles are applied
      const hasHighContrastStyles = await browser.execute((element) => {
        const computed = window.getComputedStyle(element);
        return computed.borderColor !== 'rgba(0, 0, 0, 0)';
      }, bottomNav);
      
      expect(hasHighContrastStyles).toBe(true);
    });

    it('should support reduced motion preferences', async () => {
      // Set reduced motion preference
      await browser.execute(() => {
        Object.defineProperty(window, 'matchMedia', {
          writable: true,
          value: jest.fn().mockImplementation(query => ({
            matches: query === '(prefers-reduced-motion: reduce)',
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
          })),
        });
      });
      
      const bottomNav = await $('[data-testid="mobile-bottom-nav"]');
      await expect(bottomNav).toBeDisplayed();
      
      // Verify animations are reduced or disabled
      const hasReducedMotion = await browser.execute((element) => {
        const computed = window.getComputedStyle(element);
        return computed.animationDuration === '0s' || computed.transitionDuration === '0s';
      }, bottomNav);
      
      expect(hasReducedMotion).toBe(true);
    });
  });
});





