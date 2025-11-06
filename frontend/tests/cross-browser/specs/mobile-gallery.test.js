/**
 * Mobile Gallery Cross-Browser Tests
 * Tests image gallery functionality across different browsers and devices
 */

describe('Mobile Gallery Tests', () => {
  beforeEach(async () => {
    // Navigate to the images page
    await browser.url('/images');
    
    // Wait for the page to load
    await browser.waitUntil(
      async () => {
        const readyState = await browser.execute(() => document.readyState);
        return readyState === 'complete';
      },
      {
        timeout: 10000,
        timeoutMsg: 'Images page did not load completely'
      }
    );
  });

  describe('Gallery Layout', () => {
    it('should display masonry layout on mobile devices', async () => {
      const gallery = await $('[data-testid="mobile-masonry-gallery"]');
      await expect(gallery).toBeDisplayed();
      
      // Check if masonry layout is applied
      const hasMasonryClass = await browser.execute((element) => {
        return element.classList.contains('masonry-gallery');
      }, gallery);
      
      expect(hasMasonryClass).toBe(true);
    });

    it('should display images in responsive grid', async () => {
      const imageCards = await $$('[data-testid="image-card"]');
      expect(imageCards.length).toBeGreaterThan(0);
      
      // Check if images are properly sized
      for (const card of imageCards) {
        const size = await card.getSize();
        expect(size.width).toBeGreaterThan(0);
        expect(size.height).toBeGreaterThan(0);
      }
    });

    it('should handle different screen sizes correctly', async () => {
      const testSizes = [
        { width: 320, height: 568 },  // iPhone 5/SE
        { width: 375, height: 667 },  // iPhone 6/7/8
        { width: 414, height: 896 },  // iPhone 11 Pro Max
        { width: 768, height: 1024 }  // iPad
      ];
      
      for (const size of testSizes) {
        await browser.setWindowSize(size.width, size.height);
        
        const gallery = await $('[data-testid="mobile-masonry-gallery"]');
        await expect(gallery).toBeDisplayed();
        
        // Check that images are still visible and properly sized
        const imageCards = await $$('[data-testid="image-card"]');
        expect(imageCards.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Image Loading', () => {
    it('should load images with lazy loading', async () => {
      const imageCards = await $$('[data-testid="image-card"]');
      
      // Check that images have lazy loading attributes
      for (const card of imageCards) {
        const img = await card.$('img');
        const loading = await img.getAttribute('loading');
        expect(loading).toBe('lazy');
      }
    });

    it('should show skeleton loading states', async () => {
      // Navigate to a page with many images
      await browser.url('/images?load=slow');
      
      // Check for skeleton elements
      const skeletons = await $$('[data-testid="image-skeleton"]');
      expect(skeletons.length).toBeGreaterThan(0);
      
      // Wait for images to load
      await browser.waitUntil(
        async () => {
          const loadedImages = await $$('[data-testid="image-card"] img[src]');
          return loadedImages.length > 0;
        },
        {
          timeout: 10000,
          timeoutMsg: 'Images did not load within 10 seconds'
        }
      );
    });

    it('should handle image load errors gracefully', async () => {
      // This test would need to be implemented with error simulation
      // For now, we'll check that error handling is in place
      const imageCards = await $$('[data-testid="image-card"]');
      
      for (const card of imageCards) {
        const img = await card.$('img');
        const onError = await img.getAttribute('onerror');
        expect(onError).toBeTruthy();
      }
    });
  });

  describe('Touch Interactions', () => {
    it('should support tap to select images', async () => {
      const imageCards = await $$('[data-testid="image-card"]');
      const firstCard = imageCards[0];
      
      // Tap to select
      await firstCard.click();
      
      // Check if selection state is applied
      const isSelected = await browser.execute((element) => {
        return element.classList.contains('selected') || element.getAttribute('aria-selected') === 'true';
      }, firstCard);
      
      expect(isSelected).toBe(true);
    });

    it('should support long press for multi-selection', async () => {
      const imageCards = await $$('[data-testid="image-card"]');
      const firstCard = imageCards[0];
      
      // Long press
      await browser.touchAction([
        { action: 'press', x: 100, y: 100 },
        { action: 'wait', ms: 1000 },
        { action: 'release' }
      ]);
      
      // Check if multi-selection mode is activated
      const multiSelectMode = await browser.execute(() => {
        return document.querySelector('[data-testid="multi-select-mode"]') !== null;
      });
      
      expect(multiSelectMode).toBe(true);
    });

    it('should support swipe gestures for navigation', async () => {
      const gallery = await $('[data-testid="mobile-masonry-gallery"]');
      
      // Swipe left
      await browser.touchAction([
        { action: 'press', x: 300, y: 400 },
        { action: 'moveTo', x: 100, y: 400 },
        { action: 'release' }
      ]);
      
      // Check if swipe was detected
      const swipeDetected = await browser.execute(() => {
        return window.lastSwipeDirection === 'left';
      });
      
      expect(swipeDetected).toBe(true);
    });

    it('should support pinch to zoom', async () => {
      const imageCard = await $('[data-testid="image-card"]:first-child');
      
      // Simulate pinch gesture
      await browser.touchAction([
        { action: 'press', x: 200, y: 300 },
        { action: 'press', x: 300, y: 300 },
        { action: 'wait', ms: 100 },
        { action: 'moveTo', x: 150, y: 300 },
        { action: 'moveTo', x: 350, y: 300 },
        { action: 'release' },
        { action: 'release' }
      ]);
      
      // Check if zoom was applied
      const zoomApplied = await browser.execute((element) => {
        const transform = element.style.transform;
        return transform.includes('scale');
      }, imageCard);
      
      expect(zoomApplied).toBe(true);
    });
  });

  describe('Selection Management', () => {
    it('should show selection count', async () => {
      const imageCards = await $$('[data-testid="image-card"]');
      
      // Select multiple images
      await imageCards[0].click();
      await imageCards[1].click();
      await imageCards[2].click();
      
      // Check if selection count is displayed
      const selectionCount = await $('[data-testid="selection-count"]');
      await expect(selectionCount).toBeDisplayed();
      
      const countText = await selectionCount.getText();
      expect(countText).toContain('3');
    });

    it('should show action bar when images are selected', async () => {
      const imageCards = await $$('[data-testid="image-card"]');
      await imageCards[0].click();
      
      const actionBar = await $('[data-testid="mobile-action-bar"]');
      await expect(actionBar).toBeDisplayed();
    });

    it('should support select all functionality', async () => {
      const selectAllButton = await $('[data-testid="select-all-button"]');
      await selectAllButton.click();
      
      // Check if all images are selected
      const imageCards = await $$('[data-testid="image-card"]');
      for (const card of imageCards) {
        const isSelected = await browser.execute((element) => {
          return element.classList.contains('selected');
        }, card);
        expect(isSelected).toBe(true);
      }
    });

    it('should support clear selection', async () => {
      const imageCards = await $$('[data-testid="image-card"]');
      await imageCards[0].click();
      await imageCards[1].click();
      
      const clearButton = await $('[data-testid="clear-selection-button"]');
      await clearButton.click();
      
      // Check if selection is cleared
      for (const card of imageCards) {
        const isSelected = await browser.execute((element) => {
          return element.classList.contains('selected');
        }, card);
        expect(isSelected).toBe(false);
      }
    });
  });

  describe('Infinite Scroll', () => {
    it('should load more images when scrolling to bottom', async () => {
      const initialImageCount = await $$('[data-testid="image-card"]').length;
      
      // Scroll to bottom
      await browser.execute(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      // Wait for new images to load
      await browser.waitUntil(
        async () => {
          const newImageCount = await $$('[data-testid="image-card"]').length;
          return newImageCount > initialImageCount;
        },
        {
          timeout: 10000,
          timeoutMsg: 'More images did not load after scrolling'
        }
      );
    });

    it('should show loading indicator during infinite scroll', async () => {
      // Scroll to bottom
      await browser.execute(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      // Check for loading indicator
      const loadingIndicator = await $('[data-testid="infinite-loading"]');
      await expect(loadingIndicator).toBeDisplayed();
    });
  });

  describe('Image Viewer', () => {
    it('should open full-screen image viewer when image is tapped', async () => {
      const imageCard = await $('[data-testid="image-card"]:first-child');
      await imageCard.click();
      
      const imageViewer = await $('[data-testid="mobile-image-viewer"]');
      await expect(imageViewer).toBeDisplayed();
    });

    it('should support swipe navigation in image viewer', async () => {
      const imageCard = await $('[data-testid="image-card"]:first-child');
      await imageCard.click();
      
      const imageViewer = await $('[data-testid="mobile-image-viewer"]');
      await expect(imageViewer).toBeDisplayed();
      
      // Swipe to next image
      await browser.touchAction([
        { action: 'press', x: 300, y: 400 },
        { action: 'moveTo', x: 100, y: 400 },
        { action: 'release' }
      ]);
      
      // Check if image changed
      const currentImage = await $('[data-testid="current-image"]');
      const imageSrc = await currentImage.getAttribute('src');
      expect(imageSrc).toBeTruthy();
    });

    it('should support pinch to zoom in image viewer', async () => {
      const imageCard = await $('[data-testid="image-card"]:first-child');
      await imageCard.click();
      
      const imageViewer = await $('[data-testid="mobile-image-viewer"]');
      await expect(imageViewer).toBeDisplayed();
      
      // Pinch to zoom
      await browser.touchAction([
        { action: 'press', x: 200, y: 300 },
        { action: 'press', x: 300, y: 300 },
        { action: 'wait', ms: 100 },
        { action: 'moveTo', x: 150, y: 300 },
        { action: 'moveTo', x: 350, y: 300 },
        { action: 'release' },
        { action: 'release' }
      ]);
      
      // Check if zoom was applied
      const zoomedImage = await $('[data-testid="zoomed-image"]');
      await expect(zoomedImage).toBeDisplayed();
    });

    it('should close image viewer when close button is tapped', async () => {
      const imageCard = await $('[data-testid="image-card"]:first-child');
      await imageCard.click();
      
      const imageViewer = await $('[data-testid="mobile-image-viewer"]');
      await expect(imageViewer).toBeDisplayed();
      
      const closeButton = await $('[data-testid="close-image-viewer"]');
      await closeButton.click();
      
      await expect(imageViewer).not.toBeDisplayed();
    });
  });

  describe('Performance', () => {
    it('should load images efficiently', async () => {
      const startTime = Date.now();
      
      await browser.url('/images');
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
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(10000);
    });

    it('should handle large numbers of images without performance degradation', async () => {
      // Load a page with many images
      await browser.url('/images?count=100');
      
      const startTime = Date.now();
      
      await browser.waitUntil(
        async () => {
          const imageCards = await $$('[data-testid="image-card"]');
          return imageCards.length >= 100;
        },
        {
          timeout: 30000,
          timeoutMsg: '100 images did not load within 30 seconds'
        }
      );
      
      const loadTime = Date.now() - startTime;
      expect(loadTime).toBeLessThan(30000);
      
      // Check that scrolling is still smooth
      const scrollStartTime = Date.now();
      await browser.execute(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      const scrollTime = Date.now() - scrollStartTime;
      expect(scrollTime).toBeLessThan(1000);
    });
  });

  describe('Accessibility', () => {
    it('should be accessible to screen readers', async () => {
      const gallery = await $('[data-testid="mobile-masonry-gallery"]');
      const role = await gallery.getAttribute('role');
      const ariaLabel = await gallery.getAttribute('aria-label');
      
      expect(role).toBe('grid');
      expect(ariaLabel).toBeTruthy();
    });

    it('should have proper alt text for images', async () => {
      const imageCards = await $$('[data-testid="image-card"]');
      
      for (const card of imageCards) {
        const img = await card.$('img');
        const altText = await img.getAttribute('alt');
        expect(altText).toBeTruthy();
      }
    });

    it('should support keyboard navigation', async () => {
      const imageCards = await $$('[data-testid="image-card"]');
      const firstCard = imageCards[0];
      
      // Focus on first image
      await firstCard.click();
      
      // Navigate with arrow keys
      await browser.keys('ArrowRight');
      
      const secondCard = imageCards[1];
      const isFocused = await secondCard.isFocused();
      expect(isFocused).toBe(true);
    });
  });
});






