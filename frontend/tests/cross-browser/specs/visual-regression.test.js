/**
 * Visual Regression Cross-Browser Tests
 * Tests visual consistency across different browsers and devices
 */

const { toMatchImageSnapshot } = require('jest-image-snapshot');

// Extend Jest matchers
expect.extend({ toMatchImageSnapshot });

describe('Visual Regression Tests', () => {
  beforeEach(async () => {
    // Set consistent viewport for visual tests
    await browser.setWindowSize(375, 667); // iPhone 6/7/8 size
    
    // Wait for fonts and images to load
    await browser.execute(() => {
      return new Promise((resolve) => {
        if (document.readyState === 'complete') {
          resolve();
        } else {
          window.addEventListener('load', resolve);
        }
      });
    });
  });

  describe('Main Page Visual Tests', () => {
    it('should match main page snapshot', async () => {
      await browser.url('/');
      
      // Wait for page to stabilize
      await browser.pause(1000);
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'main-page'
      });
    });

    it('should match main page with different content states', async () => {
      await browser.url('/');
      
      // Test with loading state
      await browser.execute(() => {
        document.body.classList.add('loading');
      });
      await browser.pause(500);
      
      let screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'main-page-loading'
      });
      
      // Test with loaded state
      await browser.execute(() => {
        document.body.classList.remove('loading');
        document.body.classList.add('loaded');
      });
      await browser.pause(500);
      
      screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'main-page-loaded'
      });
    });
  });

  describe('Navigation Visual Tests', () => {
    it('should match bottom navigation snapshot', async () => {
      await browser.url('/');
      
      const bottomNav = await $('[data-testid="mobile-bottom-nav"]');
      await expect(bottomNav).toBeDisplayed();
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'bottom-navigation'
      });
    });

    it('should match navigation with active states', async () => {
      await browser.url('/images');
      
      const bottomNav = await $('[data-testid="mobile-bottom-nav"]');
      await expect(bottomNav).toBeDisplayed();
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'bottom-navigation-active'
      });
    });

    it('should match navigation hover states', async () => {
      await browser.url('/');
      
      const bottomNav = await $('[data-testid="mobile-bottom-nav"]');
      const firstNavItem = await bottomNav.$('[role="tab"]:first-child');
      
      // Simulate hover
      await firstNavItem.moveTo();
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'bottom-navigation-hover'
      });
    });
  });

  describe('Images Page Visual Tests', () => {
    it('should match images page snapshot', async () => {
      await browser.url('/images');
      
      // Wait for images to load
      await browser.waitUntil(
        async () => {
          const imageCards = await $$('[data-testid="image-card"]');
          return imageCards.length > 0;
        },
        {
          timeout: 10000,
          timeoutMsg: 'Images did not load within 10 seconds'
        }
      );
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'images-page'
      });
    });

    it('should match masonry gallery layout', async () => {
      await browser.url('/images');
      
      const gallery = await $('[data-testid="mobile-masonry-gallery"]');
      await expect(gallery).toBeDisplayed();
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'masonry-gallery'
      });
    });

    it('should match image selection states', async () => {
      await browser.url('/images');
      
      // Select some images
      const imageCards = await $$('[data-testid="image-card"]');
      if (imageCards.length >= 3) {
        await imageCards[0].click();
        await imageCards[1].click();
        await imageCards[2].click();
      }
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'image-selection'
      });
    });

    it('should match image viewer snapshot', async () => {
      await browser.url('/images');
      
      // Open image viewer
      const imageCard = await $('[data-testid="image-card"]:first-child');
      await imageCard.click();
      
      const imageViewer = await $('[data-testid="mobile-image-viewer"]');
      await expect(imageViewer).toBeDisplayed();
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'image-viewer'
      });
    });
  });

  describe('Forms Visual Tests', () => {
    it('should match mobile forms snapshot', async () => {
      await browser.url('/mobile-forms');
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'mobile-forms'
      });
    });

    it('should match form input states', async () => {
      await browser.url('/mobile-forms');
      
      // Focus on an input
      const input = await $('[data-testid="mobile-input"]');
      await input.click();
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'form-input-focused'
      });
    });

    it('should match form validation states', async () => {
      await browser.url('/mobile-forms');
      
      // Trigger validation
      const input = await $('[data-testid="mobile-input"]');
      await input.setValue('invalid@');
      await input.click();
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'form-validation-error'
      });
    });
  });

  describe('Settings Page Visual Tests', () => {
    it('should match settings page snapshot', async () => {
      await browser.url('/settings');
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'settings-page'
      });
    });

    it('should match collapsible sections', async () => {
      await browser.url('/settings');
      
      // Expand a section
      const section = await $('[data-testid="settings-section"]:first-child');
      const toggle = await section.$('[data-testid="section-toggle"]');
      await toggle.click();
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'settings-expanded'
      });
    });

    it('should match toggle switch states', async () => {
      await browser.url('/settings');
      
      // Toggle a switch
      const toggleSwitch = await $('[data-testid="toggle-switch"]:first-child');
      await toggleSwitch.click();
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'toggle-switch-on'
      });
    });
  });

  describe('Responsive Visual Tests', () => {
    it('should match iPhone 5/SE layout', async () => {
      await browser.setWindowSize(320, 568);
      await browser.url('/');
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'iphone-se'
      });
    });

    it('should match iPhone 6/7/8 layout', async () => {
      await browser.setWindowSize(375, 667);
      await browser.url('/');
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'iphone-6-7-8'
      });
    });

    it('should match iPhone 11 Pro Max layout', async () => {
      await browser.setWindowSize(414, 896);
      await browser.url('/');
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'iphone-11-pro-max'
      });
    });

    it('should match iPad layout', async () => {
      await browser.setWindowSize(768, 1024);
      await browser.url('/');
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'ipad'
      });
    });

    it('should match landscape orientation', async () => {
      await browser.setWindowSize(667, 375);
      await browser.url('/');
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'landscape'
      });
    });
  });

  describe('Accessibility Visual Tests', () => {
    it('should match high contrast mode', async () => {
      await browser.url('/');
      
      // Enable high contrast mode
      await browser.execute(() => {
        document.documentElement.classList.add('force-high-contrast');
      });
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'high-contrast'
      });
    });

    it('should match reduced motion mode', async () => {
      await browser.url('/');
      
      // Enable reduced motion
      await browser.execute(() => {
        document.documentElement.classList.add('reduced-motion');
      });
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'reduced-motion'
      });
    });

    it('should match focus states', async () => {
      await browser.url('/');
      
      // Focus on navigation
      const firstNavItem = await $('[data-testid="mobile-bottom-nav"] [role="tab"]:first-child');
      await firstNavItem.click();
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'focus-state'
      });
    });
  });

  describe('Error States Visual Tests', () => {
    it('should match error page snapshot', async () => {
      await browser.url('/nonexistent-page');
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'error-page'
      });
    });

    it('should match loading states', async () => {
      await browser.url('/images?load=slow');
      
      // Wait for loading state to appear
      await browser.waitUntil(
        async () => {
          const skeletons = await $$('[data-testid="image-skeleton"]');
          return skeletons.length > 0;
        },
        {
          timeout: 5000,
          timeoutMsg: 'Loading state did not appear'
        }
      );
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'loading-state'
      });
    });

    it('should match offline state', async () => {
      await browser.url('/');
      
      // Simulate offline
      await browser.execute(() => {
        Object.defineProperty(navigator, 'onLine', {
          writable: true,
          value: false
        });
        window.dispatchEvent(new Event('offline'));
      });
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'offline-state'
      });
    });
  });

  describe('Component Visual Tests', () => {
    it('should match button states', async () => {
      await browser.url('/');
      
      const button = await $('[data-testid="test-button"]');
      await expect(button).toBeDisplayed();
      
      // Test normal state
      let screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'button-normal'
      });
      
      // Test hover state
      await button.moveTo();
      screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'button-hover'
      });
      
      // Test active state
      await button.click();
      screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'button-active'
      });
    });

    it('should match card components', async () => {
      await browser.url('/images');
      
      const imageCard = await $('[data-testid="image-card"]:first-child');
      await expect(imageCard).toBeDisplayed();
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'image-card'
      });
    });

    it('should match modal components', async () => {
      await browser.url('/');
      
      // Open a modal
      const modalTrigger = await $('[data-testid="modal-trigger"]');
      await modalTrigger.click();
      
      const modal = await $('[data-testid="modal"]');
      await expect(modal).toBeDisplayed();
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: 'modal'
      });
    });
  });

  describe('Cross-Browser Consistency', () => {
    it('should have consistent appearance across browsers', async () => {
      const capabilities = await browser.getCapabilities();
      const browserName = capabilities.browserName;
      const deviceName = capabilities['bstack:options']?.deviceName;
      
      await browser.url('/');
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: `cross-browser-${browserName}-${deviceName}`
      });
    });

    it('should handle browser-specific rendering differences', async () => {
      const capabilities = await browser.getCapabilities();
      const browserName = capabilities.browserName;
      
      await browser.url('/images');
      
      // Check for browser-specific CSS properties
      const browserSpecificStyles = await browser.execute(() => {
        const element = document.querySelector('[data-testid="mobile-masonry-gallery"]');
        const computed = window.getComputedStyle(element);
        
        return {
          display: computed.display,
          position: computed.position,
          overflow: computed.overflow,
          webkitOverflowScrolling: computed.webkitOverflowScrolling
        };
      });
      
      // Log browser-specific styles for analysis
      console.log(`${browserName} specific styles:`, browserSpecificStyles);
      
      const screenshot = await browser.takeScreenshot();
      expect(screenshot).toMatchImageSnapshot({
        threshold: 0.2,
        thresholdType: 'percent',
        customSnapshotIdentifier: `browser-specific-${browserName}`
      });
    });
  });
});




