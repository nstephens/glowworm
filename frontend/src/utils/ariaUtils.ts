/**
 * ARIA Utilities for Enhanced Accessibility
 * Provides helper functions and constants for implementing ARIA attributes
 */

import * as React from 'react';

// ARIA Role Constants
export const ARIA_ROLES = {
  // Landmark roles
  BANNER: 'banner',
  COMPLEMENTARY: 'complementary',
  CONTENTINFO: 'contentinfo',
  FORM: 'form',
  MAIN: 'main',
  NAVIGATION: 'navigation',
  REGION: 'region',
  SEARCH: 'search',

  // Widget roles
  BUTTON: 'button',
  CHECKBOX: 'checkbox',
  DIALOG: 'dialog',
  GRID: 'grid',
  GRIDCELL: 'gridcell',
  LINK: 'link',
  LISTBOX: 'listbox',
  MENU: 'menu',
  MENUITEM: 'menuitem',
  MENUITEMCHECKBOX: 'menuitemcheckbox',
  MENUITEMRADIO: 'menuitemradio',
  OPTION: 'option',
  PROGRESSBAR: 'progressbar',
  RADIO: 'radio',
  RADIOGROUP: 'radiogroup',
  SLIDER: 'slider',
  SPINBUTTON: 'spinbutton',
  SWITCH: 'switch',
  TAB: 'tab',
  TABLIST: 'tablist',
  TABPANEL: 'tabpanel',
  TEXTBOX: 'textbox',
  TOOLTIP: 'tooltip',
  TREE: 'tree',
  TREEITEM: 'treeitem',

  // Live region roles
  ALERT: 'alert',
  LOG: 'log',
  MARQUEE: 'marquee',
  STATUS: 'status',
  TIMER: 'timer',

  // Document structure roles
  ARTICLE: 'article',
  CELL: 'cell',
  COLUMNHEADER: 'columnheader',
  DEFINITION: 'definition',
  DIRECTORY: 'directory',
  DOCUMENT: 'document',
  FEED: 'feed',
  FIGURE: 'figure',
  GROUP: 'group',
  HEADING: 'heading',
  IMG: 'img',
  LIST: 'list',
  LISTITEM: 'listitem',
  MATH: 'math',
  NONE: 'none',
  NOTE: 'note',
  PRESENTATION: 'presentation',
  ROW: 'row',
  ROWGROUP: 'rowgroup',
  ROWHEADER: 'rowheader',
  SEPARATOR: 'separator',
  TABLE: 'table',
  TERM: 'term',
  TOOLBAR: 'toolbar',
} as const;

// ARIA State and Property Constants
export const ARIA_STATES = {
  // Widget attributes
  ARIA_EXPANDED: 'aria-expanded',
  ARIA_SELECTED: 'aria-selected',
  ARIA_CHECKED: 'aria-checked',
  ARIA_PRESSED: 'aria-pressed',
  ARIA_DISABLED: 'aria-disabled',
  ARIA_READONLY: 'aria-readonly',
  ARIA_REQUIRED: 'aria-required',
  ARIA_INVALID: 'aria-invalid',
  ARIA_HIDDEN: 'aria-hidden',

  // Live region attributes
  ARIA_LIVE: 'aria-live',
  ARIA_ATOMIC: 'aria-atomic',
  ARIA_RELEVANT: 'aria-relevant',
  ARIA_BUSY: 'aria-busy',

  // Relationship attributes
  ARIA_LABELLEDBY: 'aria-labelledby',
  ARIA_DESCRIBEDBY: 'aria-describedby',
  ARIA_CONTROLS: 'aria-controls',
  ARIA_OWNS: 'aria-owns',
  ARIA_FLOWTO: 'aria-flowto',

  // Widget attributes
  ARIA_ACTIVEDESCENDANT: 'aria-activedescendant',
  ARIA_AUTOCMPLETE: 'aria-autocomplete',
  ARIA_MULTILINE: 'aria-multiline',
  ARIA_MULTISELECTABLE: 'aria-multiselectable',
  ARIA_ORIENTATION: 'aria-orientation',
  ARIA_SORT: 'aria-sort',

  // Range attributes
  ARIA_VALUE: 'aria-value',
  ARIA_VALUEMIN: 'aria-valuemin',
  ARIA_VALUEMAX: 'aria-valuemax',
  ARIA_VALUENOW: 'aria-valuenow',
  ARIA_VALUETEXT: 'aria-valuetext',

  // Drag and drop attributes
  ARIA_DROPEFFECT: 'aria-dropeffect',
  ARIA_DRAGGED: 'aria-dragged',

  // Other attributes
  ARIA_LABEL: 'aria-label',
  ARIA_DESCRIPTION: 'aria-description',
  ARIA_DETAILS: 'aria-details',
  ARIA_KEYS: 'aria-keys',
  ARIA_KEYSCHORTCUTS: 'aria-keyshortcuts',
  ARIA_MODAL: 'aria-modal',
  ARIA_PLACEHOLDER: 'aria-placeholder',
  ARIA_POSINSET: 'aria-posinset',
  ARIA_SETSIZE: 'aria-setsize',
  ARIA_CURRENT_ATTR: 'aria-current',
} as const;

// Live region politeness levels
export const ARIA_LIVE_POLITENESS = {
  OFF: 'off',
  POLITE: 'polite',
  ASSERTIVE: 'assertive',
} as const;

// ARIA orientation values
export const ARIA_ORIENTATION = {
  HORIZONTAL: 'horizontal',
  VERTICAL: 'vertical',
} as const;

// ARIA sort values
export const ARIA_SORT = {
  ASCENDING: 'ascending',
  DESCENDING: 'descending',
  NONE: 'none',
  OTHER: 'other',
} as const;

// ARIA current values
export const ARIA_CURRENT = {
  PAGE: 'page',
  STEP: 'step',
  LOCATION: 'location',
  DATE: 'date',
  TIME: 'time',
  TRUE: 'true',
  FALSE: 'false',
} as const;

/**
 * Generate unique ID for ARIA attributes
 */
export const generateAriaId = (prefix: string = 'aria'): string => {
  return `${prefix}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Create ARIA attributes object for common patterns
 */
export const createAriaAttributes = {
  /**
   * Button with proper ARIA attributes
   */
  button: (options: {
    label: string;
    pressed?: boolean;
    expanded?: boolean;
    controls?: string;
    describedBy?: string;
    disabled?: boolean;
  }) => ({
    role: ARIA_ROLES.BUTTON,
    'aria-label': options.label,
    ...(options.pressed !== undefined && { 'aria-pressed': options.pressed }),
    ...(options.expanded !== undefined && { 'aria-expanded': options.expanded }),
    ...(options.controls && { 'aria-controls': options.controls }),
    ...(options.describedBy && { 'aria-describedby': options.describedBy }),
    ...(options.disabled && { 'aria-disabled': options.disabled }),
  }),

  /**
   * Switch/toggle with proper ARIA attributes
   */
  switch: (options: {
    label: string;
    checked: boolean;
    describedBy?: string;
    disabled?: boolean;
  }) => ({
    role: ARIA_ROLES.SWITCH,
    'aria-label': options.label,
    'aria-checked': options.checked,
    ...(options.describedBy && { 'aria-describedby': options.describedBy }),
    ...(options.disabled && { 'aria-disabled': options.disabled }),
  }),

  /**
   * Tab with proper ARIA attributes
   */
  tab: (options: {
    label: string;
    selected: boolean;
    controls: string;
    describedBy?: string;
    disabled?: boolean;
  }) => ({
    role: ARIA_ROLES.TAB,
    'aria-label': options.label,
    'aria-selected': options.selected,
    'aria-controls': options.controls,
    ...(options.describedBy && { 'aria-describedby': options.describedBy }),
    ...(options.disabled && { 'aria-disabled': options.disabled }),
  }),

  /**
   * Tab panel with proper ARIA attributes
   */
  tabPanel: (options: {
    labelledBy: string;
    describedBy?: string;
    hidden?: boolean;
  }) => ({
    role: ARIA_ROLES.TABPANEL,
    'aria-labelledby': options.labelledBy,
    ...(options.describedBy && { 'aria-describedby': options.describedBy }),
    ...(options.hidden && { 'aria-hidden': options.hidden }),
  }),

  /**
   * Dialog with proper ARIA attributes
   */
  dialog: (options: {
    labelledBy: string;
    describedBy?: string;
    modal?: boolean;
  }) => ({
    role: ARIA_ROLES.DIALOG,
    'aria-labelledby': options.labelledBy,
    ...(options.describedBy && { 'aria-describedby': options.describedBy }),
    ...(options.modal && { 'aria-modal': options.modal }),
  }),

  /**
   * Live region for announcements
   */
  liveRegion: (options: {
    politeness?: keyof typeof ARIA_LIVE_POLITENESS;
    atomic?: boolean;
  } = {}) => ({
    'aria-live': options.politeness || ARIA_LIVE_POLITENESS.POLITE,
    ...(options.atomic !== undefined && { 'aria-atomic': options.atomic }),
  }),

  /**
   * Progress bar with proper ARIA attributes
   */
  progressBar: (options: {
    value: number;
    min?: number;
    max?: number;
    labelledBy?: string;
    describedBy?: string;
  }) => ({
    role: ARIA_ROLES.PROGRESSBAR,
    'aria-valuenow': options.value,
    'aria-valuemin': options.min || 0,
    'aria-valuemax': options.max || 100,
    ...(options.labelledBy && { 'aria-labelledby': options.labelledBy }),
    ...(options.describedBy && { 'aria-describedby': options.describedBy }),
  }),

  /**
   * Slider with proper ARIA attributes
   */
  slider: (options: {
    value: number;
    min: number;
    max: number;
    step?: number;
    labelledBy?: string;
    describedBy?: string;
    orientation?: keyof typeof ARIA_ORIENTATION;
  }) => ({
    role: ARIA_ROLES.SLIDER,
    'aria-valuenow': options.value,
    'aria-valuemin': options.min,
    'aria-valuemax': options.max,
    ...(options.step && { 'aria-valuetext': options.step.toString() }),
    ...(options.labelledBy && { 'aria-labelledby': options.labelledBy }),
    ...(options.describedBy && { 'aria-describedby': options.describedBy }),
    ...(options.orientation && { 'aria-orientation': options.orientation }),
  }),

  /**
   * Grid with proper ARIA attributes
   */
  grid: (options: {
    labelledBy?: string;
    describedBy?: string;
    rowCount?: number;
    colCount?: number;
  }) => ({
    role: ARIA_ROLES.GRID,
    ...(options.labelledBy && { 'aria-labelledby': options.labelledBy }),
    ...(options.describedBy && { 'aria-describedby': options.describedBy }),
    ...(options.rowCount && { 'aria-rowcount': options.rowCount }),
    ...(options.colCount && { 'aria-colcount': options.colCount }),
  }),

  /**
   * Grid cell with proper ARIA attributes
   */
  gridCell: (options: {
    rowIndex: number;
    colIndex: number;
    selected?: boolean;
    expanded?: boolean;
  }) => ({
    role: ARIA_ROLES.GRIDCELL,
    'aria-rowindex': options.rowIndex,
    'aria-colindex': options.colIndex,
    ...(options.selected !== undefined && { 'aria-selected': options.selected }),
    ...(options.expanded !== undefined && { 'aria-expanded': options.expanded }),
  }),
};

/**
 * Screen reader only text utility
 */
export const srOnly = (text: string): React.ReactNode => 
  React.createElement('span', { 
    className: 'sr-only', 
    'aria-hidden': false 
  }, text);

/**
 * Visually hidden but accessible text
 */
export const visuallyHidden = (text: string): React.ReactNode => 
  React.createElement('span', { className: 'sr-only' }, text);

/**
 * Create accessible button text with screen reader support
 */
export const createAccessibleButtonText = (
  visibleText: string,
  screenReaderText?: string
): React.ReactNode => 
  React.createElement(React.Fragment, null, 
    visibleText,
    screenReaderText ? srOnly(screenReaderText) : null
  );

/**
 * Create accessible icon button
 */
export const createAccessibleIconButton = (
  icon: React.ReactNode,
  label: string,
  additionalProps?: Record<string, any>
) => ({
  'aria-label': label,
  'aria-hidden': false,
  ...additionalProps,
  children: React.createElement(React.Fragment, null, 
    icon,
    srOnly(label)
  ),
});

/**
 * Validate ARIA attributes
 */
export const validateAriaAttributes = (element: HTMLElement): string[] => {
  const issues: string[] = [];

  // Check for required ARIA attributes based on role
  const role = element.getAttribute('role');
  
  if (role === ARIA_ROLES.BUTTON) {
    if (!element.getAttribute('aria-label') && !element.textContent?.trim()) {
      issues.push('Button missing accessible name (aria-label or text content)');
    }
  }

  if (role === ARIA_ROLES.SWITCH) {
    if (element.getAttribute('aria-checked') === null) {
      issues.push('Switch missing aria-checked attribute');
    }
  }

  if (role === ARIA_ROLES.TAB) {
    if (!element.getAttribute('aria-controls')) {
      issues.push('Tab missing aria-controls attribute');
    }
    if (element.getAttribute('aria-selected') === null) {
      issues.push('Tab missing aria-selected attribute');
    }
  }

  if (role === ARIA_ROLES.DIALOG) {
    if (!element.getAttribute('aria-labelledby') && !element.getAttribute('aria-label')) {
      issues.push('Dialog missing accessible name (aria-labelledby or aria-label)');
    }
  }

  return issues;
};

/**
 * Get ARIA attributes for common component patterns
 */
export const getAriaAttributes = {
  /**
   * Get attributes for collapsible sections (accordion pattern)
   */
  collapsibleSection: (id: string, expanded: boolean, controls: string) => ({
    'aria-expanded': expanded,
    'aria-controls': controls,
    id,
  }),

  /**
   * Get attributes for collapsible content
   */
  collapsibleContent: (id: string, labelledBy: string, hidden?: boolean) => ({
    id,
    'aria-labelledby': labelledBy,
    ...(hidden && { 'aria-hidden': hidden }),
  }),

  /**
   * Get attributes for image carousel
   */
  imageCarousel: (currentIndex: number, totalImages: number) => ({
    role: ARIA_ROLES.REGION,
    'aria-label': `Image carousel, ${currentIndex + 1} of ${totalImages}`,
    'aria-live': ARIA_LIVE_POLITENESS.POLITE,
  }),

  /**
   * Get attributes for image carousel navigation
   */
  imageCarouselNav: (direction: 'previous' | 'next', disabled?: boolean) => ({
    'aria-label': `${direction} image`,
    ...(disabled && { 'aria-disabled': disabled }),
  }),

  /**
   * Get attributes for image carousel indicators
   */
  imageCarouselIndicator: (index: number, currentIndex: number, totalImages: number) => ({
    role: ARIA_ROLES.BUTTON,
    'aria-label': `Go to image ${index + 1} of ${totalImages}`,
    'aria-current': index === currentIndex ? ARIA_CURRENT.TRUE : ARIA_CURRENT.FALSE,
  }),
};
