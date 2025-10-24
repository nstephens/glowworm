// Cross-Browser Testing Utilities
// Provides utilities for automated cross-browser testing and compatibility validation

interface TestResult {
  testName: string;
  passed: boolean;
  error?: string;
  details?: any;
  browser: string;
  version: string;
  timestamp: string;
}

interface TestSuite {
  name: string;
  tests: TestCase[];
  results: TestResult[];
  summary: TestSummary;
}

interface TestCase {
  name: string;
  description: string;
  test: () => Promise<boolean> | boolean;
  critical: boolean;
  category: 'layout' | 'functionality' | 'performance' | 'accessibility';
}

interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  critical: number;
  criticalPassed: number;
  criticalFailed: number;
  score: number;
}

class CrossBrowserTester {
  private static instance: CrossBrowserTester;
  private testSuites: Map<string, TestSuite> = new Map();
  private currentBrowser: string = '';
  private currentVersion: string = '';

  static getInstance(): CrossBrowserTester {
    if (!CrossBrowserTester.instance) {
      CrossBrowserTester.instance = new CrossBrowserTester();
    }
    return CrossBrowserTester.instance;
  }

  // Initialize testing for current browser
  initialize(browser: string, version: string): void {
    this.currentBrowser = browser;
    this.currentVersion = version;
  }

  // Create a new test suite
  createTestSuite(name: string): TestSuite {
    const testSuite: TestSuite = {
      name,
      tests: [],
      results: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        critical: 0,
        criticalPassed: 0,
        criticalFailed: 0,
        score: 0,
      },
    };

    this.testSuites.set(name, testSuite);
    return testSuite;
  }

  // Add a test case to a suite
  addTestCase(suiteName: string, testCase: TestCase): void {
    const suite = this.testSuites.get(suiteName);
    if (suite) {
      suite.tests.push(testCase);
    }
  }

  // Run a specific test suite
  async runTestSuite(suiteName: string): Promise<TestResult[]> {
    const suite = this.testSuites.get(suiteName);
    if (!suite) {
      throw new Error(`Test suite '${suiteName}' not found`);
    }

    const results: TestResult[] = [];

    for (const testCase of suite.tests) {
      try {
        const startTime = performance.now();
        const passed = await testCase.test();
        const endTime = performance.now();

        const result: TestResult = {
          testName: testCase.name,
          passed,
          browser: this.currentBrowser,
          version: this.currentVersion,
          timestamp: new Date().toISOString(),
          details: {
            duration: endTime - startTime,
            category: testCase.category,
            critical: testCase.critical,
          },
        };

        results.push(result);
      } catch (error) {
        const result: TestResult = {
          testName: testCase.name,
          passed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          browser: this.currentBrowser,
          version: this.currentVersion,
          timestamp: new Date().toISOString(),
          details: {
            category: testCase.category,
            critical: testCase.critical,
          },
        };

        results.push(result);
      }
    }

    suite.results = results;
    suite.summary = this.calculateSummary(results);
    return results;
  }

  // Run all test suites
  async runAllTests(): Promise<Map<string, TestResult[]>> {
    const allResults = new Map<string, TestResult[]>();

    for (const [suiteName, suite] of this.testSuites) {
      const results = await this.runTestSuite(suiteName);
      allResults.set(suiteName, results);
    }

    return allResults;
  }

  // Calculate test summary
  private calculateSummary(results: TestResult[]): TestSummary {
    const total = results.length;
    const passed = results.filter(r => r.passed).length;
    const failed = total - passed;
    const critical = results.filter(r => r.details?.critical).length;
    const criticalPassed = results.filter(r => r.passed && r.details?.critical).length;
    const criticalFailed = critical - criticalPassed;
    const score = total > 0 ? (passed / total) * 100 : 0;

    return {
      total,
      passed,
      failed,
      critical,
      criticalPassed,
      criticalFailed,
      score,
    };
  }

  // Get test results for a suite
  getResults(suiteName: string): TestResult[] | null {
    const suite = this.testSuites.get(suiteName);
    return suite?.results || null;
  }

  // Get test summary for a suite
  getSummary(suiteName: string): TestSummary | null {
    const suite = this.testSuites.get(suiteName);
    return suite?.summary || null;
  }

  // Get all test suites
  getAllSuites(): Map<string, TestSuite> {
    return this.testSuites;
  }

  // Clear all test suites
  clearAll(): void {
    this.testSuites.clear();
  }
}

// Predefined test cases
export const layoutTests: TestCase[] = [
  {
    name: 'CSS Grid Support',
    description: 'Test CSS Grid layout support',
    test: () => CSS.supports('display', 'grid'),
    critical: true,
    category: 'layout',
  },
  {
    name: 'Flexbox Support',
    description: 'Test CSS Flexbox layout support',
    test: () => CSS.supports('display', 'flex'),
    critical: true,
    category: 'layout',
  },
  {
    name: 'CSS Variables Support',
    description: 'Test CSS custom properties support',
    test: () => CSS.supports('color', 'var(--test)'),
    critical: true,
    category: 'layout',
  },
  {
    name: 'CSS Transforms Support',
    description: 'Test CSS transforms support',
    test: () => CSS.supports('transform', 'translateX(10px)'),
    critical: false,
    category: 'layout',
  },
  {
    name: 'CSS Animations Support',
    description: 'Test CSS animations support',
    test: () => CSS.supports('animation', 'test 1s'),
    critical: false,
    category: 'layout',
  },
];

export const functionalityTests: TestCase[] = [
  {
    name: 'ES6 Modules Support',
    description: 'Test ES6 modules support',
    test: () => 'noModule' in HTMLScriptElement.prototype,
    critical: true,
    category: 'functionality',
  },
  {
    name: 'Async/Await Support',
    description: 'Test async/await support',
    test: () => {
      try {
        new Function('async () => {}');
        return true;
      } catch (e) {
        return false;
      }
    },
    critical: true,
    category: 'functionality',
  },
  {
    name: 'Fetch API Support',
    description: 'Test Fetch API support',
    test: () => 'fetch' in window,
    critical: true,
    category: 'functionality',
  },
  {
    name: 'Local Storage Support',
    description: 'Test localStorage support',
    test: () => {
      try {
        const test = 'test';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
      } catch (e) {
        return false;
      }
    },
    critical: true,
    category: 'functionality',
  },
  {
    name: 'Service Worker Support',
    description: 'Test Service Worker support',
    test: () => 'serviceWorker' in navigator,
    critical: false,
    category: 'functionality',
  },
  {
    name: 'Intersection Observer Support',
    description: 'Test Intersection Observer support',
    test: () => 'IntersectionObserver' in window,
    critical: false,
    category: 'functionality',
  },
];

export const performanceTests: TestCase[] = [
  {
    name: 'Request Animation Frame Support',
    description: 'Test requestAnimationFrame support',
    test: () => 'requestAnimationFrame' in window,
    critical: true,
    category: 'performance',
  },
  {
    name: 'Performance Observer Support',
    description: 'Test Performance Observer support',
    test: () => 'PerformanceObserver' in window,
    critical: false,
    category: 'performance',
  },
  {
    name: 'Web Workers Support',
    description: 'Test Web Workers support',
    test: () => typeof Worker !== 'undefined',
    critical: false,
    category: 'performance',
  },
  {
    name: 'Request Idle Callback Support',
    description: 'Test requestIdleCallback support',
    test: () => 'requestIdleCallback' in window,
    critical: false,
    category: 'performance',
  },
];

export const accessibilityTests: TestCase[] = [
  {
    name: 'ARIA Support',
    description: 'Test ARIA attributes support',
    test: () => {
      const element = document.createElement('div');
      element.setAttribute('aria-label', 'test');
      return element.getAttribute('aria-label') === 'test';
    },
    critical: true,
    category: 'accessibility',
  },
  {
    name: 'Focus Management Support',
    description: 'Test focus management support',
    test: () => {
      const element = document.createElement('button');
      element.focus();
      return document.activeElement === element;
    },
    critical: true,
    category: 'accessibility',
  },
  {
    name: 'Screen Reader Support',
    description: 'Test screen reader support',
    test: () => {
      const element = document.createElement('div');
      element.setAttribute('role', 'button');
      element.setAttribute('aria-label', 'test');
      return element.getAttribute('role') === 'button';
    },
    critical: true,
    category: 'accessibility',
  },
  {
    name: 'Keyboard Navigation Support',
    description: 'Test keyboard navigation support',
    test: () => {
      const element = document.createElement('button');
      element.tabIndex = 0;
      return element.tabIndex === 0;
    },
    critical: true,
    category: 'accessibility',
  },
];

// Create default test suites
export function createDefaultTestSuites(): CrossBrowserTester {
  const tester = CrossBrowserTester.getInstance();

  // Layout tests
  const layoutSuite = tester.createTestSuite('Layout Tests');
  layoutTests.forEach(test => tester.addTestCase('Layout Tests', test));

  // Functionality tests
  const functionalitySuite = tester.createTestSuite('Functionality Tests');
  functionalityTests.forEach(test => tester.addTestCase('Functionality Tests', test));

  // Performance tests
  const performanceSuite = tester.createTestSuite('Performance Tests');
  performanceTests.forEach(test => tester.addTestCase('Performance Tests', test));

  // Accessibility tests
  const accessibilitySuite = tester.createTestSuite('Accessibility Tests');
  accessibilityTests.forEach(test => tester.addTestCase('Accessibility Tests', test));

  return tester;
}

// Export utilities
export { CrossBrowserTester };
export type { TestResult, TestSuite, TestCase, TestSummary };

// Hook for cross-browser testing
export function useCrossBrowserTesting() {
  const [tester] = useState(() => createDefaultTestSuites());
  const [results, setResults] = useState<Map<string, TestResult[]>>(new Map());
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runTests = useCallback(async () => {
    setIsRunning(true);
    setError(null);

    try {
      const testResults = await tester.runAllTests();
      setResults(testResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test execution failed');
    } finally {
      setIsRunning(false);
    }
  }, [tester]);

  const getSuiteResults = useCallback((suiteName: string) => {
    return results.get(suiteName) || [];
  }, [results]);

  const getSuiteSummary = useCallback((suiteName: string) => {
    return tester.getSummary(suiteName);
  }, [tester]);

  const getAllSummaries = useCallback(() => {
    const summaries = new Map<string, TestSummary>();
    for (const [suiteName, suite] of tester.getAllSuites()) {
      const summary = tester.getSummary(suiteName);
      if (summary) {
        summaries.set(suiteName, summary);
      }
    }
    return summaries;
  }, [tester]);

  return {
    tester,
    results,
    isRunning,
    error,
    runTests,
    getSuiteResults,
    getSuiteSummary,
    getAllSummaries,
  };
}
