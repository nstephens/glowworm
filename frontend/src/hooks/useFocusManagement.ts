import { useEffect, useRef, useCallback } from 'react';

interface FocusManagementOptions {
  trapFocus?: boolean;
  restoreFocus?: boolean;
  initialFocus?: HTMLElement | null;
  onFocusChange?: (element: HTMLElement | null) => void;
}

/**
 * useFocusManagement - Hook for managing focus in accessible components
 * 
 * Features:
 * - Focus trapping for modals and dialogs
 * - Focus restoration on component unmount
 * - Initial focus management
 * - Focus change callbacks
 * - Keyboard navigation support
 */
export const useFocusManagement = (options: FocusManagementOptions = {}) => {
  const {
    trapFocus = false,
    restoreFocus = false,
    initialFocus = null,
    onFocusChange
  } = options;

  const containerRef = useRef<HTMLElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const focusableElements = useRef<HTMLElement[]>([]);

  // Get all focusable elements within the container
  const getFocusableElements = useCallback(() => {
    if (!containerRef.current) return [];

    const focusableSelectors = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ');

    return Array.from(containerRef.current.querySelectorAll(focusableSelectors)) as HTMLElement[];
  }, []);

  // Update focusable elements list
  const updateFocusableElements = useCallback(() => {
    focusableElements.current = getFocusableElements();
  }, [getFocusableElements]);

  // Focus the first focusable element
  const focusFirst = useCallback(() => {
    updateFocusableElements();
    if (focusableElements.current.length > 0) {
      focusableElements.current[0].focus();
      onFocusChange?.(focusableElements.current[0]);
    }
  }, [updateFocusableElements, onFocusChange]);

  // Focus the last focusable element
  const focusLast = useCallback(() => {
    updateFocusableElements();
    if (focusableElements.current.length > 0) {
      const lastElement = focusableElements.current[focusableElements.current.length - 1];
      lastElement.focus();
      onFocusChange?.(lastElement);
    }
  }, [updateFocusableElements, onFocusChange]);

  // Focus the next focusable element
  const focusNext = useCallback(() => {
    updateFocusableElements();
    const currentIndex = focusableElements.current.indexOf(document.activeElement as HTMLElement);
    const nextIndex = currentIndex + 1;
    
    if (nextIndex < focusableElements.current.length) {
      focusableElements.current[nextIndex].focus();
      onFocusChange?.(focusableElements.current[nextIndex]);
    } else if (trapFocus) {
      // Loop back to first element
      focusFirst();
    }
  }, [updateFocusableElements, onFocusChange, trapFocus, focusFirst]);

  // Focus the previous focusable element
  const focusPrevious = useCallback(() => {
    updateFocusableElements();
    const currentIndex = focusableElements.current.indexOf(document.activeElement as HTMLElement);
    const prevIndex = currentIndex - 1;
    
    if (prevIndex >= 0) {
      focusableElements.current[prevIndex].focus();
      onFocusChange?.(focusableElements.current[prevIndex]);
    } else if (trapFocus) {
      // Loop back to last element
      focusLast();
    }
  }, [updateFocusableElements, onFocusChange, trapFocus, focusLast]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!trapFocus) return;

    switch (event.key) {
      case 'Tab':
        if (event.shiftKey) {
          event.preventDefault();
          focusPrevious();
        } else {
          event.preventDefault();
          focusNext();
        }
        break;
      case 'Escape':
        // Allow escape to close modals
        break;
    }
  }, [trapFocus, focusNext, focusPrevious]);

  // Set up focus management
  useEffect(() => {
    if (!containerRef.current) return;

    // Store the previously focused element
    if (restoreFocus) {
      previousActiveElement.current = document.activeElement as HTMLElement;
    }

    // Set initial focus
    if (initialFocus) {
      initialFocus.focus();
      onFocusChange?.(initialFocus);
    } else if (trapFocus) {
      // Focus first element if trapping focus
      focusFirst();
    }

    // Add keyboard event listener
    if (trapFocus) {
      document.addEventListener('keydown', handleKeyDown);
    }

    // Update focusable elements when DOM changes
    const observer = new MutationObserver(updateFocusableElements);
    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'tabindex']
    });

    return () => {
      if (trapFocus) {
        document.removeEventListener('keydown', handleKeyDown);
      }
      observer.disconnect();

      // Restore focus if requested
      if (restoreFocus && previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [trapFocus, restoreFocus, initialFocus, onFocusChange, focusFirst, handleKeyDown, updateFocusableElements]);

  return {
    containerRef,
    focusFirst,
    focusLast,
    focusNext,
    focusPrevious,
    updateFocusableElements
  };
};
