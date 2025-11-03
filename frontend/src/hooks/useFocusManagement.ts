import { useEffect, useRef, RefObject } from 'react';

/**
 * Options for focus management hook
 */
export interface UseFocusManagementOptions {
  /**
   * Whether to trap focus within the element
   */
  trapFocus?: boolean;
  /**
   * Whether to restore focus when unmounting
   */
  restoreFocus?: boolean;
  /**
   * Element to focus when component mounts
   */
  initialFocus?: RefObject<HTMLElement> | HTMLElement | null;
  /**
   * Element to focus when component unmounts
   */
  returnFocus?: RefObject<HTMLElement> | HTMLElement | null;
  /**
   * Callback when focus escapes the trap
   */
  onEscape?: () => void;
}

/**
 * Hook for managing focus within a component
 * Useful for modals, dropdowns, and other focusable containers
 */
export const useFocusManagement = (
  ref: RefObject<HTMLElement>,
  options: UseFocusManagementOptions = {}
) => {
  const {
    trapFocus = false,
    restoreFocus = false,
    initialFocus,
    returnFocus,
    onEscape,
  } = options;

  const previouslyFocusedElement = useRef<HTMLElement | null>(null);
  const firstFocusableElement = useRef<HTMLElement | null>(null);
  const lastFocusableElement = useRef<HTMLElement | null>(null);

  // Get all focusable elements within the container
  const getFocusableElements = (container: HTMLElement): HTMLElement[] => {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
    ].join(', ');

    return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors)).filter(
      (el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      }
    );
  };

  // Set initial focus
  useEffect(() => {
    if (!ref.current) return;

    // Store previously focused element
    previouslyFocusedElement.current = document.activeElement as HTMLElement;

    // Focus initial element or first focusable element
    if (initialFocus) {
      const element = 'current' in initialFocus ? initialFocus.current : initialFocus;
      element?.focus();
    } else {
      const focusableElements = getFocusableElements(ref.current);
      if (focusableElements.length > 0) {
        firstFocusableElement.current = focusableElements[0];
        focusableElements[0].focus();
      }
    }

    // Store first and last focusable elements
    const focusableElements = getFocusableElements(ref.current);
    if (focusableElements.length > 0) {
      firstFocusableElement.current = focusableElements[0];
      lastFocusableElement.current = focusableElements[focusableElements.length - 1];
    }
  }, [ref, initialFocus]);

  // Handle focus trap
  useEffect(() => {
    if (!trapFocus || !ref.current) return;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusableElements = getFocusableElements(ref.current!);
      if (focusableElements.length === 0) {
        e.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        onEscape();
      }
    };

    ref.current.addEventListener('keydown', handleTabKey);
    document.addEventListener('keydown', handleEscape);

    return () => {
      ref.current?.removeEventListener('keydown', handleTabKey);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [trapFocus, ref, onEscape]);

  // Restore focus on unmount
  useEffect(() => {
    if (!restoreFocus) return;

    return () => {
      const elementToFocus = returnFocus
        ? ('current' in returnFocus ? returnFocus.current : returnFocus)
        : previouslyFocusedElement.current;

      if (elementToFocus && typeof elementToFocus.focus === 'function') {
        elementToFocus.focus();
      }
    };
  }, [restoreFocus, returnFocus]);

  return {
    /**
     * Focus the first focusable element
     */
    focusFirst: () => {
      if (firstFocusableElement.current) {
        firstFocusableElement.current.focus();
      }
    },
    /**
     * Focus the last focusable element
     */
    focusLast: () => {
      if (lastFocusableElement.current) {
        lastFocusableElement.current.focus();
      }
    },
    /**
     * Get all focusable elements
     */
    getFocusableElements: () => {
      return ref.current ? getFocusableElements(ref.current) : [];
    },
  };
};

/**
 * Hook for keyboard shortcuts
 */
export interface UseKeyboardShortcutsOptions {
  /**
   * Keyboard shortcut handlers
   * Key format: "key" or "modifier+key" (e.g., "ctrl+k", "shift+tab")
   */
  shortcuts: Record<string, (e: KeyboardEvent) => void>;
  /**
   * Whether to prevent default behavior
   */
  preventDefault?: boolean;
  /**
   * Target element to attach listeners to (defaults to document)
   */
  target?: RefObject<HTMLElement> | HTMLElement | null;
  /**
   * Whether shortcuts are enabled
   */
  enabled?: boolean;
}

/**
 * Hook for handling keyboard shortcuts
 */
export const useKeyboardShortcuts = (options: UseKeyboardShortcutsOptions) => {
  const { shortcuts, preventDefault = false, target, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const pressedKey = e.key.toLowerCase();
      const modifiers: string[] = [];
      
      if (e.ctrlKey || e.metaKey) modifiers.push('ctrl');
      if (e.altKey) modifiers.push('alt');
      if (e.shiftKey) modifiers.push('shift');

      const keyCombination = modifiers.length > 0
        ? `${modifiers.join('+')}+${pressedKey}`
        : pressedKey;

      const handler = shortcuts[keyCombination];
      if (handler) {
        if (preventDefault) {
          e.preventDefault();
        }
        handler(e);
      }
    };

    const targetElement = target
      ? ('current' in target ? target.current : target)
      : document;

    if (targetElement) {
      targetElement.addEventListener('keydown', handleKeyDown);
      return () => {
        targetElement.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [shortcuts, preventDefault, target, enabled]);
};

/**
 * Hook for arrow key navigation
 */
export interface UseArrowNavigationOptions {
  /**
   * Navigation direction
   */
  direction?: 'horizontal' | 'vertical' | 'both';
  /**
   * Whether to loop navigation
   */
  loop?: boolean;
  /**
   * Callback when navigation reaches edge
   */
  onEdge?: (edge: 'start' | 'end') => void;
  /**
   * Custom selector for focusable items
   */
  itemSelector?: string;
}

/**
 * Hook for arrow key navigation in lists
 */
export const useArrowNavigation = (
  containerRef: RefObject<HTMLElement>,
  options: UseArrowNavigationOptions = {}
) => {
  const {
    direction = 'both',
    loop = false,
    onEdge,
    itemSelector = '[role="option"], [role="menuitem"], [role="tab"], button, a',
  } = options;

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    const getFocusableItems = (): HTMLElement[] => {
      return Array.from(container.querySelectorAll<HTMLElement>(itemSelector)).filter(
        (el) => {
          const style = window.getComputedStyle(el);
          return style.display !== 'none' && style.visibility !== 'hidden';
        }
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const items = getFocusableItems();
      if (items.length === 0) return;

      const currentIndex = items.findIndex((item) => item === document.activeElement);
      if (currentIndex === -1) return;

      let nextIndex = currentIndex;

      switch (e.key) {
        case 'ArrowDown':
          if (direction === 'vertical' || direction === 'both') {
            e.preventDefault();
            nextIndex = currentIndex + 1;
            if (nextIndex >= items.length) {
              if (loop) {
                nextIndex = 0;
              } else {
                onEdge?.('end');
                return;
              }
            }
            items[nextIndex].focus();
          }
          break;

        case 'ArrowUp':
          if (direction === 'vertical' || direction === 'both') {
            e.preventDefault();
            nextIndex = currentIndex - 1;
            if (nextIndex < 0) {
              if (loop) {
                nextIndex = items.length - 1;
              } else {
                onEdge?.('start');
                return;
              }
            }
            items[nextIndex].focus();
          }
          break;

        case 'ArrowRight':
          if (direction === 'horizontal' || direction === 'both') {
            e.preventDefault();
            nextIndex = currentIndex + 1;
            if (nextIndex >= items.length) {
              if (loop) {
                nextIndex = 0;
              } else {
                onEdge?.('end');
                return;
              }
            }
            items[nextIndex].focus();
          }
          break;

        case 'ArrowLeft':
          if (direction === 'horizontal' || direction === 'both') {
            e.preventDefault();
            nextIndex = currentIndex - 1;
            if (nextIndex < 0) {
              if (loop) {
                nextIndex = items.length - 1;
              } else {
                onEdge?.('start');
                return;
              }
            }
            items[nextIndex].focus();
          }
          break;

        case 'Home':
          e.preventDefault();
          items[0].focus();
          break;

        case 'End':
          e.preventDefault();
          items[items.length - 1].focus();
          break;
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [containerRef, direction, loop, onEdge, itemSelector]);
};
