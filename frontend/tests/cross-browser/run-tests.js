#!/usr/bin/env node

/**
 * Cross-Browser Test Runner
 * Executes tests across different browsers and devices using BrowserStack
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test configuration
const TEST_CONFIG = {
  // Test suites to run
  suites: [
    'mobile',
    'touch',
    'performance',
    'accessibility',
    'visual'
  ],
  
  // Browsers to test
  browsers: [
    'safari-ios-14',
    'safari-ios-15',
    'safari-ios-16',
    'chrome-android-11',
    'chrome-android-12',
    'samsung-internet-android-10',
    'samsung-internet-android-12',
    'firefox-android-10',
    'firefox-android-11'
  ],
  
  // Test environments
  environments: [
    '3g',
    '4g',
    'wifi'
  ],
  
  // Test results directory
  resultsDir: './test-results',
  
  // Screenshots directory
  screenshotsDir: './test-results/screenshots',
  
  // Videos directory
  videosDir: './test-results/videos'
};

// Create results directories
function createDirectories() {
  const dirs = [
    TEST_CONFIG.resultsDir,
    TEST_CONFIG.screenshotsDir,
    TEST_CONFIG.videosDir,
    './test-results/junit',
    './test-results/allure-results'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Run tests for a specific browser and environment
function runTests(browser, environment, suite) {
  return new Promise((resolve, reject) => {
    console.log(`\n🧪 Running ${suite} tests on ${browser} (${environment})...`);
    
    const testCommand = [
      'npx',
      'wdio',
      'run',
      './tests/cross-browser/browserstack.config.js',
      '--suite',
      suite,
      '--capabilities',
      JSON.stringify({
        browserName: getBrowserName(browser),
        'bstack:options': {
          ...getBrowserStackOptions(browser),
          sessionName: `${suite}-${browser}-${environment}`,
          buildName: `Cross-Browser Testing ${new Date().toISOString().split('T')[0]}`
        }
      })
    ];
    
    // Set environment variables
    const env = {
      ...process.env,
      TEST_ENVIRONMENT: environment,
      TEST_BROWSER: browser,
      TEST_SUITE: suite
    };
    
    const child = spawn(testCommand[0], testCommand.slice(1), {
      env,
      stdio: 'inherit',
      cwd: process.cwd()
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${suite} tests on ${browser} (${environment}) completed successfully`);
        resolve();
      } else {
        console.log(`❌ ${suite} tests on ${browser} (${environment}) failed with code ${code}`);
        reject(new Error(`Test failed with code ${code}`));
      }
    });
    
    child.on('error', (error) => {
      console.error(`❌ Error running tests: ${error.message}`);
      reject(error);
    });
  });
}

// Get browser name from browser identifier
function getBrowserName(browser) {
  const browserMap = {
    'safari-ios-14': 'Safari',
    'safari-ios-15': 'Safari',
    'safari-ios-16': 'Safari',
    'chrome-android-11': 'Chrome',
    'chrome-android-12': 'Chrome',
    'samsung-internet-android-10': 'Samsung Internet',
    'samsung-internet-android-12': 'Samsung Internet',
    'firefox-android-10': 'Firefox',
    'firefox-android-11': 'Firefox'
  };
  
  return browserMap[browser] || 'Chrome';
}

// Get BrowserStack options for browser
function getBrowserStackOptions(browser) {
  const optionsMap = {
    'safari-ios-14': {
      os: 'iOS',
      osVersion: '14.0',
      deviceName: 'iPhone 12',
      realMobile: true
    },
    'safari-ios-15': {
      os: 'iOS',
      osVersion: '15.0',
      deviceName: 'iPhone 13',
      realMobile: true
    },
    'safari-ios-16': {
      os: 'iOS',
      osVersion: '16.0',
      deviceName: 'iPhone 14',
      realMobile: true
    },
    'chrome-android-11': {
      os: 'Android',
      osVersion: '11.0',
      deviceName: 'Samsung Galaxy S21',
      realMobile: true
    },
    'chrome-android-12': {
      os: 'Android',
      osVersion: '12.0',
      deviceName: 'Google Pixel 6',
      realMobile: true
    },
    'samsung-internet-android-10': {
      os: 'Android',
      osVersion: '10.0',
      deviceName: 'Samsung Galaxy S20',
      realMobile: true
    },
    'samsung-internet-android-12': {
      os: 'Android',
      osVersion: '12.0',
      deviceName: 'Samsung Galaxy S22',
      realMobile: true
    },
    'firefox-android-10': {
      os: 'Android',
      osVersion: '10.0',
      deviceName: 'Google Pixel 4',
      realMobile: true
    },
    'firefox-android-11': {
      os: 'Android',
      osVersion: '11.0',
      deviceName: 'Samsung Galaxy Note 20',
      realMobile: true
    }
  };
  
  return optionsMap[browser] || optionsMap['chrome-android-11'];
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Cross-Browser Test Suite');
  console.log('=====================================');
  
  createDirectories();
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    details: []
  };
  
  for (const suite of TEST_CONFIG.suites) {
    console.log(`\n📋 Running ${suite} test suite...`);
    
    for (const browser of TEST_CONFIG.browsers) {
      for (const environment of TEST_CONFIG.environments) {
        results.total++;
        
        try {
          await runTests(browser, environment, suite);
          results.passed++;
          results.details.push({
            suite,
            browser,
            environment,
            status: 'passed'
          });
        } catch (error) {
          results.failed++;
          results.details.push({
            suite,
            browser,
            environment,
            status: 'failed',
            error: error.message
          });
        }
      }
    }
  }
  
  // Generate test report
  generateTestReport(results);
  
  console.log('\n📊 Test Results Summary');
  console.log('======================');
  console.log(`Total Tests: ${results.total}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Skipped: ${results.skipped}`);
  console.log(`Success Rate: ${((results.passed / results.total) * 100).toFixed(2)}%`);
  
  if (results.failed > 0) {
    console.log('\n❌ Failed Tests:');
    results.details
      .filter(test => test.status === 'failed')
      .forEach(test => {
        console.log(`  - ${test.suite} on ${test.browser} (${test.environment}): ${test.error}`);
      });
  }
  
  return results;
}

// Generate test report
function generateTestReport(results) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.total,
      passed: results.passed,
      failed: results.failed,
      skipped: results.skipped,
      successRate: (results.passed / results.total) * 100
    },
    details: results.details,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    }
  };
  
  const reportPath = path.join(TEST_CONFIG.resultsDir, 'test-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  console.log(`\n📄 Test report saved to: ${reportPath}`);
}

// Run specific test suite
async function runSuite(suite) {
  console.log(`🧪 Running ${suite} test suite only...`);
  
  createDirectories();
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    details: []
  };
  
  for (const browser of TEST_CONFIG.browsers) {
    for (const environment of TEST_CONFIG.environments) {
      results.total++;
      
      try {
        await runTests(browser, environment, suite);
        results.passed++;
        results.details.push({
          suite,
          browser,
          environment,
          status: 'passed'
        });
      } catch (error) {
        results.failed++;
        results.details.push({
          suite,
          browser,
          environment,
          status: 'failed',
          error: error.message
        });
      }
    }
  }
  
  generateTestReport(results);
  return results;
}

// Run tests for specific browser
async function runBrowser(browser) {
  console.log(`🧪 Running tests for ${browser} only...`);
  
  createDirectories();
  
  const results = {
    total: 0,
    passed: 0,
    failed: 0,
    details: []
  };
  
  for (const suite of TEST_CONFIG.suites) {
    for (const environment of TEST_CONFIG.environments) {
      results.total++;
      
      try {
        await runTests(browser, environment, suite);
        results.passed++;
        results.details.push({
          suite,
          browser,
          environment,
          status: 'passed'
        });
      } catch (error) {
        results.failed++;
        results.details.push({
          suite,
          browser,
          environment,
          status: 'failed',
          error: error.message
        });
      }
    }
  }
  
  generateTestReport(results);
  return results;
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const target = args[1];
  
  try {
    switch (command) {
      case 'suite':
        if (!target) {
          console.error('❌ Please specify a test suite');
          process.exit(1);
        }
        await runSuite(target);
        break;
        
      case 'browser':
        if (!target) {
          console.error('❌ Please specify a browser');
          process.exit(1);
        }
        await runBrowser(target);
        break;
        
      case 'all':
      default:
        await runAllTests();
        break;
    }
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

// Show help
function showHelp() {
  console.log(`
🧪 Cross-Browser Test Runner

Usage:
  node run-tests.js [command] [target]

Commands:
  all                    Run all test suites (default)
  suite <suite-name>     Run specific test suite
  browser <browser-name> Run tests for specific browser
  help                   Show this help message

Test Suites:
  mobile                 Mobile navigation and layout tests
  touch                  Touch interactions and gestures
  performance            Performance and load time tests
  accessibility          Accessibility and screen reader tests
  visual                 Visual regression tests

Browsers:
  safari-ios-14          Safari on iOS 14
  safari-ios-15          Safari on iOS 15
  safari-ios-16          Safari on iOS 16
  chrome-android-11      Chrome on Android 11
  chrome-android-12      Chrome on Android 12
  samsung-internet-android-10  Samsung Internet on Android 10
  samsung-internet-android-12  Samsung Internet on Android 12
  firefox-android-10     Firefox on Android 10
  firefox-android-11     Firefox on Android 11

Examples:
  node run-tests.js
  node run-tests.js suite mobile
  node run-tests.js browser safari-ios-15
  `);
}

// Handle command line arguments
if (process.argv.includes('help') || process.argv.includes('--help') || process.argv.includes('-h')) {
  showHelp();
  process.exit(0);
}

// Run the main function
main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});




