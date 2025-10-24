import { useEffect, RefObject, useCallback, useRef } from 'react';

interface FocusTrapOptions {
  isActive?: boolean;
  initialFocus?: boolean;
  returnFocusOnDeactivate?: boolean;
  preventScroll?: boolean;
}

export function useFocusTrap(
  ref: RefObject<HTMLElement>, 
  options: FocusTrapOptions = {}
) {
  const {
    isActive = true,
    initialFocus = true,
    returnFocusOnDeactivate = true,
    preventScroll = false,
  } = options;

  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Get all focusable elements within the container
  const getFocusableElements = useCallback((container: HTMLElement): HTMLElement[] => {
    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
    ].join(', ');

    return Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!ref.current || !isActive) return;

    const focusableElements = getFocusableElements(ref.current);
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement as HTMLElement;

    // Handle Tab key
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        // Shift + Tab: move backwards
        if (activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        // Tab: move forwards
        if (activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    }

    // Handle Escape key to deactivate trap
    if (e.key === 'Escape') {
      if (returnFocusOnDeactivate && previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    }
  }, [ref, isActive, getFocusableElements, returnFocusOnDeactivate]);

  // Activate focus trap
  useEffect(() => {
    if (!isActive || !ref.current) return;

    // Store the previously focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    const container = ref.current;
    const focusableElements = getFocusableElements(container);

    if (focusableElements.length === 0) return;

    // Focus the first element if initial focus is enabled
    if (initialFocus) {
      const firstElement = focusableElements[0];
      if (preventScroll) {
        firstElement.focus({ preventScroll: true });
      } else {
        firstElement.focus();
      }
    }

    // Add event listener
    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, ref, initialFocus, preventScroll, handleKeyDown, getFocusableElements]);

  // Return focus to previous element when trap is deactivated
  useEffect(() => {
    if (!isActive && returnFocusOnDeactivate && previousActiveElement.current) {
      previousActiveElement.current.focus();
    }
  }, [isActive, returnFocusOnDeactivate]);

  return {
    getFocusableElements: () => ref.current ? getFocusableElements(ref.current) : [],
  };
}
