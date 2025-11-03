/**
 * Touch interaction audit and enhancement utilities
 * Helps identify and fix touch target issues across the application
 */

export interface TouchTargetAuditResult {
  element: HTMLElement;
  selector: string;
  currentSize: { width: number; height: number };
  meetsMinimum: boolean;
  recommendations: string[];
  priority: 'high' | 'medium' | 'low';
}

export interface TouchTargetOptions {
  minimumSize?: number; // Default 44px
  includeHidden?: boolean;
  includeDisabled?: boolean;
  customSelectors?: string[];
}

class TouchTargetAuditor {
  private minimumSize: number;
  private includeHidden: boolean;
  private includeDisabled: boolean;
  private customSelectors: string[];

  constructor(options: TouchTargetOptions = {}) {
    this.minimumSize = options.minimumSize || 44;
    this.includeHidden = options.includeHidden || false;
    this.includeDisabled = options.includeDisabled || true;
    this.customSelectors = options.customSelectors || [];
  }

  /**
   * Audit all interactive elements for touch target compliance
   */
  audit(): TouchTargetAuditResult[] {
    const results: TouchTargetAuditResult[] = [];
    const selectors = this.getInteractiveSelectors();

    selectors.forEach(selector => {
      const elements = document.querySelectorAll(selector) as NodeListOf<HTMLElement>;
      elements.forEach(element => {
        if (this.shouldAuditElement(element)) {
          const result = this.auditElement(element, selector);
          if (result) {
            results.push(result);
          }
        }
      });
    });

    return results.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Get all interactive element selectors
   */
  private getInteractiveSelectors(): string[] {
    const baseSelectors = [
      'button',
      'a[href]',
      'input[type="button"]',
      'input[type="submit"]',
      'input[type="reset"]',
      'input[type="checkbox"]',
      'input[type="radio"]',
      'select',
      'textarea',
      '[role="button"]',
      '[role="link"]',
      '[role="menuitem"]',
      '[role="tab"]',
      '[role="option"]',
      '[tabindex]:not([tabindex="-1"])',
      '.clickable',
      '.interactive',
      '.touch-target',
      '.btn',
      '.button'
    ];

    return [...baseSelectors, ...this.customSelectors];
  }

  /**
   * Check if element should be audited
   */
  private shouldAuditElement(element: HTMLElement): boolean {
    // Skip hidden elements unless explicitly included
    if (!this.includeHidden && this.isHidden(element)) {
      return false;
    }

    // Skip disabled elements unless explicitly included
    if (!this.includeDisabled && this.isDisabled(element)) {
      return false;
    }

    // Skip elements that are not visible
    if (!this.isVisible(element)) {
      return false;
    }

    return true;
  }

  /**
   * Audit a single element
   */
  private auditElement(element: HTMLElement, selector: string): TouchTargetAuditResult | null {
    const rect = element.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(element);
    
    // Get actual touchable size (accounting for padding)
    const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
    const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
    const paddingTop = parseFloat(computedStyle.paddingTop) || 0;
    const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
    
    const touchableWidth = rect.width + paddingLeft + paddingRight;
    const touchableHeight = rect.height + paddingTop + paddingBottom;

    const currentSize = {
      width: Math.round(touchableWidth),
      height: Math.round(touchableHeight)
    };

    const meetsMinimum = currentSize.width >= this.minimumSize && currentSize.height >= this.minimumSize;
    
    if (meetsMinimum) {
      return null; // No issues found
    }

    const recommendations = this.generateRecommendations(element, currentSize);
    const priority = this.calculatePriority(element, currentSize);

    return {
      element,
      selector,
      currentSize,
      meetsMinimum,
      recommendations,
      priority
    };
  }

  /**
   * Generate recommendations for fixing touch target issues
   */
  private generateRecommendations(element: HTMLElement, currentSize: { width: number; height: number }): string[] {
    const recommendations: string[] = [];
    const widthDeficit = this.minimumSize - currentSize.width;
    const heightDeficit = this.minimumSize - currentSize.height;

    if (widthDeficit > 0) {
      recommendations.push(`Increase width by ${Math.ceil(widthDeficit)}px (add padding or min-width)`);
    }

    if (heightDeficit > 0) {
      recommendations.push(`Increase height by ${Math.ceil(heightDeficit)}px (add padding or min-height)`);
    }

    // Check if element is too small for both dimensions
    if (widthDeficit > 0 && heightDeficit > 0) {
      recommendations.push('Consider using .touch-target-wrapper for visual elements that need larger touch areas');
    }

    // Check for specific element types
    if (element.tagName === 'BUTTON' || element.getAttribute('role') === 'button') {
      recommendations.push('Add .touch-target class or min-h-[44px] min-w-[44px]');
    }

    if (element.tagName === 'A') {
      recommendations.push('Ensure link has adequate padding or use .touch-target class');
    }

    if (element.tagName === 'INPUT' && element.getAttribute('type') === 'checkbox') {
      recommendations.push('Consider using a custom checkbox with larger touch area');
    }

    return recommendations;
  }

  /**
   * Calculate priority based on element importance and size deficit
   */
  private calculatePriority(element: HTMLElement, currentSize: { width: number; height: number }): 'high' | 'medium' | 'low' {
    const widthDeficit = this.minimumSize - currentSize.width;
    const heightDeficit = this.minimumSize - currentSize.height;
    const totalDeficit = widthDeficit + heightDeficit;

    // High priority for critical interactive elements
    if (element.tagName === 'BUTTON' || 
        element.getAttribute('role') === 'button' ||
        element.classList.contains('btn') ||
        element.classList.contains('button')) {
      return 'high';
    }

    // High priority for severely undersized elements
    if (totalDeficit > 20) {
      return 'high';
    }

    // Medium priority for moderately undersized elements
    if (totalDeficit > 10) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Check if element is hidden
   */
  private isHidden(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    return style.display === 'none' || 
           style.visibility === 'hidden' || 
           style.opacity === '0' ||
           element.hidden;
  }

  /**
   * Check if element is disabled
   */
  private isDisabled(element: HTMLElement): boolean {
    return element.hasAttribute('disabled') || 
           element.getAttribute('aria-disabled') === 'true' ||
           element.classList.contains('disabled');
  }

  /**
   * Check if element is visible
   */
  private isVisible(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  /**
   * Generate a report of audit results
   */
  generateReport(results: TouchTargetAuditResult[]): string {
    const total = results.length;
    const high = results.filter(r => r.priority === 'high').length;
    const medium = results.filter(r => r.priority === 'medium').length;
    const low = results.filter(r => r.priority === 'low').length;

    let report = `# Touch Target Audit Report\n\n`;
    report += `**Summary:**\n`;
    report += `- Total issues found: ${total}\n`;
    report += `- High priority: ${high}\n`;
    report += `- Medium priority: ${medium}\n`;
    report += `- Low priority: ${low}\n\n`;

    if (total === 0) {
      report += `✅ All interactive elements meet the minimum ${this.minimumSize}px touch target requirement!\n`;
      return report;
    }

    report += `## Issues by Priority\n\n`;

    ['high', 'medium', 'low'].forEach(priority => {
      const priorityResults = results.filter(r => r.priority === priority);
      if (priorityResults.length === 0) return;

      report += `### ${priority.toUpperCase()} Priority (${priorityResults.length} issues)\n\n`;
      
      priorityResults.forEach((result, index) => {
        report += `${index + 1}. **${result.selector}**\n`;
        report += `   - Current size: ${result.currentSize.width}px × ${result.currentSize.height}px\n`;
        report += `   - Recommendations:\n`;
        result.recommendations.forEach(rec => {
          report += `     - ${rec}\n`;
        });
        report += `\n`;
      });
    });

    return report;
  }

  /**
   * Apply automatic fixes where possible
   */
  applyFixes(results: TouchTargetAuditResult[]): number {
    let fixedCount = 0;

    results.forEach(result => {
      if (this.canAutoFix(result)) {
        this.autoFix(result);
        fixedCount++;
      }
    });

    return fixedCount;
  }

  /**
   * Check if result can be automatically fixed
   */
  private canAutoFix(result: TouchTargetAuditResult): boolean {
    const element = result.element;
    
    // Can fix buttons and elements with role="button"
    if (element.tagName === 'BUTTON' || element.getAttribute('role') === 'button') {
      return true;
    }

    // Can fix elements that just need touch-target class
    if (result.recommendations.some(rec => rec.includes('.touch-target'))) {
      return true;
    }

    return false;
  }

  /**
   * Apply automatic fix to element
   */
  private autoFix(result: TouchTargetAuditResult): void {
    const element = result.element;

    // Add touch-target class
    if (!element.classList.contains('touch-target')) {
      element.classList.add('touch-target');
    }

    // Add minimum size classes if needed
    const widthDeficit = this.minimumSize - result.currentSize.width;
    const heightDeficit = this.minimumSize - result.currentSize.height;

    if (widthDeficit > 0) {
      element.style.minWidth = `${this.minimumSize}px`;
    }

    if (heightDeficit > 0) {
      element.style.minHeight = `${this.minimumSize}px`;
    }
  }
}

export default TouchTargetAuditor;




