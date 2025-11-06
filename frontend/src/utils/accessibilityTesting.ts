/**
 * Comprehensive Accessibility Testing Utilities
 * Provides automated testing functions for WCAG 2.1 AA compliance
 */

export interface AccessibilityTestResult {
  id: string;
  type: 'error' | 'warning' | 'info';
  message: string;
  element?: HTMLElement;
  fix?: string;
  wcagLevel?: 'A' | 'AA' | 'AAA';
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface AccessibilityTestSuite {
  name: string;
  description: string;
  tests: AccessibilityTestResult[];
  passed: number;
  failed: number;
  warnings: number;
  score: number;
}

/**
 * Color contrast testing utility
 */
export const testColorContrast = (element: HTMLElement): AccessibilityTestResult[] => {
  const results: AccessibilityTestResult[] = [];
  const computedStyle = window.getComputedStyle(element);
  const textColor = computedStyle.color;
  const backgroundColor = computedStyle.backgroundColor;
  
  // This is a simplified check - in production, use a proper contrast checker
  if (textColor === backgroundColor) {
    results.push({
      id: 'contrast-same-colors',
      type: 'error',
      message: 'Text and background colors are identical',
      element,
      fix: 'Ensure sufficient color contrast (4.5:1 for normal text, 3:1 for large text)',
      wcagLevel: 'AA',
      severity: 'high'
    });
  }
  
  return results;
};

/**
 * Test for missing alt text on images
 */
export const testImageAltText = (): AccessibilityTestResult[] => {
  const results: AccessibilityTestResult[] = [];
  const images = document.querySelectorAll('img');
  
  images.forEach((img, index) => {
    if (!img.alt && !img.getAttribute('aria-label')) {
      results.push({
        id: `missing-alt-${index}`,
        type: 'error',
        message: `Image ${index + 1} is missing alt text`,
        element: img as HTMLElement,
        fix: 'Add descriptive alt text or aria-label to the image element',
        wcagLevel: 'A',
        severity: 'high'
      });
    }
  });
  
  return results;
};

/**
 * Test for missing form labels
 */
export const testFormLabels = (): AccessibilityTestResult[] => {
  const results: AccessibilityTestResult[] = [];
  const inputs = document.querySelectorAll('input, select, textarea');
  
  inputs.forEach((input, index) => {
    const id = input.getAttribute('id');
    const ariaLabel = input.getAttribute('aria-label');
    const ariaLabelledBy = input.getAttribute('aria-labelledby');
    const placeholder = input.getAttribute('placeholder');
    
    if (!id && !ariaLabel && !ariaLabelledBy && !placeholder) {
      results.push({
        id: `missing-label-${index}`,
        type: 'error',
        message: `Form control ${index + 1} is missing accessible name`,
        element: input as HTMLElement,
        fix: 'Add id attribute and associate with a label element, or add aria-label',
        wcagLevel: 'A',
        severity: 'high'
      });
    }
  });
  
  return results;
};

/**
 * Test for proper heading hierarchy
 */
export const testHeadingHierarchy = (): AccessibilityTestResult[] => {
  const results: AccessibilityTestResult[] = [];
  const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
  let previousLevel = 0;
  
  headings.forEach((heading, index) => {
    const level = parseInt(heading.tagName.charAt(1));
    
    if (index === 0 && level !== 1) {
      results.push({
        id: 'missing-h1',
        type: 'warning',
        message: 'Page should start with an h1 heading',
        element: heading as HTMLElement,
        fix: 'Add an h1 heading at the beginning of the page content',
        wcagLevel: 'A',
        severity: 'medium'
      });
    }
    
    if (level > previousLevel + 1) {
      results.push({
        id: `heading-skip-${index}`,
        type: 'warning',
        message: `Heading level skipped from h${previousLevel} to h${level}`,
        element: heading as HTMLElement,
        fix: 'Use heading levels in sequence (h1, h2, h3, etc.)',
        wcagLevel: 'A',
        severity: 'medium'
      });
    }
    
    previousLevel = level;
  });
  
  return results;
};

/**
 * Test for missing ARIA labels on interactive elements
 */
export const testAriaLabels = (): AccessibilityTestResult[] => {
  const results: AccessibilityTestResult[] = [];
  const interactiveElements = document.querySelectorAll(
    'button, [role="button"], input, select, textarea, [role="link"], [role="tab"]'
  );
  
  interactiveElements.forEach((element, index) => {
    const hasAriaLabel = element.getAttribute('aria-label');
    const hasAriaLabelledBy = element.getAttribute('aria-labelledby');
    const hasTextContent = element.textContent?.trim();
    const hasTitle = element.getAttribute('title');
    const hasAlt = element.getAttribute('alt');
    
    if (!hasAriaLabel && !hasAriaLabelledBy && !hasTextContent && !hasTitle && !hasAlt) {
      results.push({
        id: `missing-aria-${index}`,
        type: 'warning',
        message: `Interactive element ${index + 1} is missing accessible name`,
        element: element as HTMLElement,
        fix: 'Add aria-label, aria-labelledby, or visible text content',
        wcagLevel: 'A',
        severity: 'medium'
      });
    }
  });
  
  return results;
};

/**
 * Test for proper focus management
 */
export const testFocusManagement = (): AccessibilityTestResult[] => {
  const results: AccessibilityTestResult[] = [];
  const focusableElements = document.querySelectorAll(
    'button, [role="button"], input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
  );
  
  // Check for focusable elements with tabindex > 0
  focusableElements.forEach((element, index) => {
    const tabIndex = element.getAttribute('tabindex');
    if (tabIndex && parseInt(tabIndex) > 0) {
      results.push({
        id: `tabindex-positive-${index}`,
        type: 'warning',
        message: `Element ${index + 1} has positive tabindex`,
        element: element as HTMLElement,
        fix: 'Avoid positive tabindex values as they can disrupt natural tab order',
        wcagLevel: 'A',
        severity: 'medium'
      });
    }
  });
  
  return results;
};

/**
 * Test for proper ARIA roles
 */
export const testAriaRoles = (): AccessibilityTestResult[] => {
  const results: AccessibilityTestResult[] = [];
  const elementsWithRoles = document.querySelectorAll('[role]');
  
  elementsWithRoles.forEach((element, index) => {
    const role = element.getAttribute('role');
    const validRoles = [
      'button', 'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
      'option', 'tab', 'tabpanel', 'textbox', 'checkbox', 'radio',
      'switch', 'slider', 'progressbar', 'status', 'alert', 'log',
      'marquee', 'timer', 'dialog', 'alertdialog', 'tooltip',
      'tree', 'treeitem', 'grid', 'gridcell', 'columnheader',
      'rowheader', 'row', 'rowgroup', 'separator', 'img',
      'presentation', 'none', 'banner', 'complementary',
      'contentinfo', 'form', 'main', 'navigation', 'region',
      'search', 'article', 'aside', 'cell', 'definition',
      'directory', 'document', 'feed', 'figure', 'group',
      'heading', 'list', 'listitem', 'math', 'note'
    ];
    
    if (role && !validRoles.includes(role)) {
      results.push({
        id: `invalid-role-${index}`,
        type: 'error',
        message: `Element ${index + 1} has invalid ARIA role: ${role}`,
        element: element as HTMLElement,
        fix: `Use a valid ARIA role from the list: ${validRoles.join(', ')}`,
        wcagLevel: 'A',
        severity: 'high'
      });
    }
  });
  
  return results;
};

/**
 * Test for keyboard accessibility
 */
export const testKeyboardAccessibility = (): AccessibilityTestResult[] => {
  const results: AccessibilityTestResult[] = [];
  const interactiveElements = document.querySelectorAll(
    'button, [role="button"], input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
  );
  
  interactiveElements.forEach((element, index) => {
    const htmlElement = element as HTMLElement;
    
    // Check if element is focusable
    if (htmlElement.offsetParent === null && htmlElement.style.display !== 'none') {
      results.push({
        id: `not-focusable-${index}`,
        type: 'warning',
        message: `Interactive element ${index + 1} may not be focusable`,
        element: htmlElement,
        fix: 'Ensure element is visible and focusable via keyboard',
        wcagLevel: 'A',
        severity: 'medium'
      });
    }
  });
  
  return results;
};

/**
 * Test for proper landmark roles
 */
export const testLandmarkRoles = (): AccessibilityTestResult[] => {
  const results: AccessibilityTestResult[] = [];
  const landmarkRoles = ['banner', 'complementary', 'contentinfo', 'form', 'main', 'navigation', 'region', 'search'];
  
  landmarkRoles.forEach(role => {
    const elements = document.querySelectorAll(`[role="${role}"]`);
    if (elements.length === 0 && role === 'main') {
      results.push({
        id: 'missing-main-landmark',
        type: 'error',
        message: 'Page is missing main landmark role',
        fix: 'Add role="main" to the main content area',
        wcagLevel: 'A',
        severity: 'high'
      });
    }
  });
  
  return results;
};

/**
 * Test for proper live regions
 */
export const testLiveRegions = (): AccessibilityTestResult[] => {
  const results: AccessibilityTestResult[] = [];
  const liveRegions = document.querySelectorAll('[aria-live]');
  
  liveRegions.forEach((element, index) => {
    const ariaLive = element.getAttribute('aria-live');
    const validValues = ['off', 'polite', 'assertive'];
    
    if (ariaLive && !validValues.includes(ariaLive)) {
      results.push({
        id: `invalid-aria-live-${index}`,
        type: 'error',
        message: `Element ${index + 1} has invalid aria-live value: ${ariaLive}`,
        element: element as HTMLElement,
        fix: 'Use valid aria-live values: off, polite, or assertive',
        wcagLevel: 'A',
        severity: 'high'
      });
    }
  });
  
  return results;
};

/**
 * Run comprehensive accessibility test suite
 */
export const runAccessibilityTests = (): AccessibilityTestSuite => {
  const allTests = [
    testImageAltText(),
    testFormLabels(),
    testHeadingHierarchy(),
    testAriaLabels(),
    testFocusManagement(),
    testAriaRoles(),
    testKeyboardAccessibility(),
    testLandmarkRoles(),
    testLiveRegions(),
  ];
  
  const allResults = allTests.flat();
  const errors = allResults.filter(r => r.type === 'error');
  const warnings = allResults.filter(r => r.type === 'warning');
  const passed = allResults.filter(r => r.type === 'info');
  
  const totalTests = allResults.length;
  const failedTests = errors.length + warnings.length;
  const score = totalTests > 0 ? Math.round(((totalTests - failedTests) / totalTests) * 100) : 100;
  
  return {
    name: 'Comprehensive Accessibility Test Suite',
    description: 'WCAG 2.1 AA compliance testing for mobile application',
    tests: allResults,
    passed: passed.length,
    failed: errors.length,
    warnings: warnings.length,
    score
  };
};

/**
 * Generate accessibility report
 */
export const generateAccessibilityReport = (testSuite: AccessibilityTestSuite): string => {
  const { name, description, tests, passed, failed, warnings, score } = testSuite;
  
  let report = `# ${name}\n\n`;
  report += `${description}\n\n`;
  report += `## Summary\n\n`;
  report += `- **Score**: ${score}%\n`;
  report += `- **Passed**: ${passed}\n`;
  report += `- **Failed**: ${failed}\n`;
  report += `- **Warnings**: ${warnings}\n`;
  report += `- **Total Tests**: ${tests.length}\n\n`;
  
  if (failed > 0) {
    report += `## Errors (${failed})\n\n`;
    tests.filter(t => t.type === 'error').forEach(test => {
      report += `### ${test.message}\n`;
      report += `- **Element**: ${test.element?.tagName || 'Unknown'}\n`;
      report += `- **WCAG Level**: ${test.wcagLevel}\n`;
      report += `- **Severity**: ${test.severity}\n`;
      if (test.fix) {
        report += `- **Fix**: ${test.fix}\n`;
      }
      report += `\n`;
    });
  }
  
  if (warnings > 0) {
    report += `## Warnings (${warnings})\n\n`;
    tests.filter(t => t.type === 'warning').forEach(test => {
      report += `### ${test.message}\n`;
      report += `- **Element**: ${test.element?.tagName || 'Unknown'}\n`;
      report += `- **WCAG Level**: ${test.wcagLevel}\n`;
      report += `- **Severity**: ${test.severity}\n`;
      if (test.fix) {
        report += `- **Fix**: ${test.fix}\n`;
      }
      report += `\n`;
    });
  }
  
  return report;
};

/**
 * Export test results to JSON
 */
export const exportTestResults = (testSuite: AccessibilityTestSuite): string => {
  return JSON.stringify(testSuite, null, 2);
};






