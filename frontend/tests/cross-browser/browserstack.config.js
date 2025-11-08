/**
 * BrowserStack configuration for cross-browser and device testing
 * Tests mobile experience across iOS Safari, Chrome Mobile, Samsung Internet, and Firefox Mobile
 */

const { config } = require('@wdio/conf');

// BrowserStack credentials
const BROWSERSTACK_USERNAME = process.env.BROWSERSTACK_USERNAME;
const BROWSERSTACK_ACCESS_KEY = process.env.BROWSERSTACK_ACCESS_KEY;

if (!BROWSERSTACK_USERNAME || !BROWSERSTACK_ACCESS_KEY) {
  throw new Error('BrowserStack credentials not found. Please set BROWSERSTACK_USERNAME and BROWSERSTACK_ACCESS_KEY environment variables.');
}

// Test capabilities for different browsers and devices
const capabilities = [
  // iOS Safari 14+ - iPhone 12
  {
    browserName: 'Safari',
    'bstack:options': {
      os: 'iOS',
      osVersion: '14.0',
      deviceName: 'iPhone 12',
      realMobile: true,
      projectName: 'Glowworm Mobile Redesign',
      buildName: 'Cross-Browser Testing',
      sessionName: 'iOS Safari 14 - iPhone 12'
    }
  },
  
  // iOS Safari 15+ - iPhone 13
  {
    browserName: 'Safari',
    'bstack:options': {
      os: 'iOS',
      osVersion: '15.0',
      deviceName: 'iPhone 13',
      realMobile: true,
      projectName: 'Glowworm Mobile Redesign',
      buildName: 'Cross-Browser Testing',
      sessionName: 'iOS Safari 15 - iPhone 13'
    }
  },
  
  // iOS Safari 16+ - iPhone 14
  {
    browserName: 'Safari',
    'bstack:options': {
      os: 'iOS',
      osVersion: '16.0',
      deviceName: 'iPhone 14',
      realMobile: true,
      projectName: 'Glowworm Mobile Redesign',
      buildName: 'Cross-Browser Testing',
      sessionName: 'iOS Safari 16 - iPhone 14'
    }
  },
  
  // Chrome Mobile 90+ - Samsung Galaxy S21
  {
    browserName: 'Chrome',
    'bstack:options': {
      os: 'Android',
      osVersion: '11.0',
      deviceName: 'Samsung Galaxy S21',
      realMobile: true,
      projectName: 'Glowworm Mobile Redesign',
      buildName: 'Cross-Browser Testing',
      sessionName: 'Chrome Mobile 90+ - Galaxy S21'
    }
  },
  
  // Chrome Mobile 90+ - Google Pixel 6
  {
    browserName: 'Chrome',
    'bstack:options': {
      os: 'Android',
      osVersion: '12.0',
      deviceName: 'Google Pixel 6',
      realMobile: true,
      projectName: 'Glowworm Mobile Redesign',
      buildName: 'Cross-Browser Testing',
      sessionName: 'Chrome Mobile 90+ - Pixel 6'
    }
  },
  
  // Samsung Internet 13+ - Samsung Galaxy S20
  {
    browserName: 'Samsung Internet',
    'bstack:options': {
      os: 'Android',
      osVersion: '10.0',
      deviceName: 'Samsung Galaxy S20',
      realMobile: true,
      projectName: 'Glowworm Mobile Redesign',
      buildName: 'Cross-Browser Testing',
      sessionName: 'Samsung Internet 13+ - Galaxy S20'
    }
  },
  
  // Samsung Internet 13+ - Samsung Galaxy S22
  {
    browserName: 'Samsung Internet',
    'bstack:options': {
      os: 'Android',
      osVersion: '12.0',
      deviceName: 'Samsung Galaxy S22',
      realMobile: true,
      projectName: 'Glowworm Mobile Redesign',
      buildName: 'Cross-Browser Testing',
      sessionName: 'Samsung Internet 13+ - Galaxy S22'
    }
  },
  
  // Firefox Mobile 88+ - Google Pixel 4
  {
    browserName: 'Firefox',
    'bstack:options': {
      os: 'Android',
      osVersion: '10.0',
      deviceName: 'Google Pixel 4',
      realMobile: true,
      projectName: 'Glowworm Mobile Redesign',
      buildName: 'Cross-Browser Testing',
      sessionName: 'Firefox Mobile 88+ - Pixel 4'
    }
  },
  
  // Firefox Mobile 88+ - Samsung Galaxy Note 20
  {
    browserName: 'Firefox',
    'bstack:options': {
      os: 'Android',
      osVersion: '11.0',
      deviceName: 'Samsung Galaxy Note 20',
      realMobile: true,
      projectName: 'Glowworm Mobile Redesign',
      buildName: 'Cross-Browser Testing',
      sessionName: 'Firefox Mobile 88+ - Note 20'
    }
  },
  
  // Additional test devices for comprehensive coverage
  {
    browserName: 'Chrome',
    'bstack:options': {
      os: 'Android',
      osVersion: '10.0',
      deviceName: 'Samsung Galaxy A51',
      realMobile: true,
      projectName: 'Glowworm Mobile Redesign',
      buildName: 'Cross-Browser Testing',
      sessionName: 'Chrome Mobile - Galaxy A51 (Mid-range)'
    }
  },
  
  {
    browserName: 'Safari',
    'bstack:options': {
      os: 'iOS',
      osVersion: '14.0',
      deviceName: 'iPhone SE (2nd generation)',
      realMobile: true,
      projectName: 'Glowworm Mobile Redesign',
      buildName: 'Cross-Browser Testing',
      sessionName: 'iOS Safari - iPhone SE (Small screen)'
    }
  },
  
  {
    browserName: 'Safari',
    'bstack:options': {
      os: 'iOS',
      osVersion: '15.0',
      deviceName: 'iPad Air (4th generation)',
      realMobile: true,
      projectName: 'Glowworm Mobile Redesign',
      buildName: 'Cross-Browser Testing',
      sessionName: 'iOS Safari - iPad Air (Tablet)'
    }
  }
];

// Test configuration
const testConfig = {
  ...config,
  
  // BrowserStack configuration
  user: BROWSERSTACK_USERNAME,
  key: BROWSERSTACK_ACCESS_KEY,
  hostname: 'hub.browserstack.com',
  port: 443,
  protocol: 'https',
  path: '/wd/hub',
  
  // Test capabilities
  capabilities,
  
  // Test configuration
  maxInstances: 5,
  maxInstancesPerCapability: 1,
  
  // Test specs
  specs: [
    './tests/cross-browser/specs/**/*.test.js'
  ],
  
  // Test suites
  suites: {
    mobile: [
      './tests/cross-browser/specs/mobile-navigation.test.js',
      './tests/cross-browser/specs/mobile-gallery.test.js',
      './tests/cross-browser/specs/mobile-forms.test.js',
      './tests/cross-browser/specs/mobile-settings.test.js'
    ],
    touch: [
      './tests/cross-browser/specs/touch-interactions.test.js',
      './tests/cross-browser/specs/gesture-support.test.js'
    ],
    performance: [
      './tests/cross-browser/specs/performance.test.js',
      './tests/cross-browser/specs/network-conditions.test.js'
    ],
    accessibility: [
      './tests/cross-browser/specs/accessibility.test.js',
      './tests/cross-browser/specs/screen-reader.test.js'
    ],
    visual: [
      './tests/cross-browser/specs/visual-regression.test.js'
    ]
  },
  
  // Test execution configuration
  logLevel: 'info',
  bail: 0,
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  
  // Test framework configuration
  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
    retries: 2
  },
  
  // Hooks
  beforeSession: function (config, capabilities, specs, browser) {
    console.log('Starting test session for:', capabilities['bstack:options']?.sessionName);
  },
  
  before: function (capabilities, specs) {
    // Set viewport for mobile testing
    browser.setWindowSize(375, 667); // iPhone 6/7/8 size
    
    // Set mobile user agent if needed
    if (capabilities['bstack:options']?.os === 'iOS') {
      browser.execute(() => {
        Object.defineProperty(navigator, 'userAgent', {
          get: function () {
            return 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1';
          }
        });
      });
    }
  },
  
  afterTest: function (test, context, { error, result, duration, passed, retries }) {
    if (error) {
      console.log('Test failed:', test.title);
      console.log('Error:', error.message);
      
      // Take screenshot on failure
      browser.saveScreenshot(`./test-results/screenshots/failed-${test.title.replace(/\s+/g, '-')}-${Date.now()}.png`);
    }
  },
  
  after: function (result, capabilities, specs) {
    console.log('Test completed for:', capabilities['bstack:options']?.sessionName);
  },
  
  // Reporter configuration
  reporters: [
    'spec',
    ['junit', {
      outputDir: './test-results/junit',
      outputFileFormat: function(options) {
        return `results-${options.capabilities['bstack:options']?.sessionName.replace(/\s+/g, '-')}.xml`;
      }
    }],
    ['allure', {
      outputDir: './test-results/allure-results',
      disableWebdriverStepsReporting: true,
      disableWebdriverScreenshotsReporting: false
    }]
  ],
  
  // Screenshot configuration
  screenshotPath: './test-results/screenshots',
  
  // Video recording
  video: true,
  videoPath: './test-results/videos',
  
  // Network conditions for performance testing
  networkConditions: {
    '3G': {
      offline: false,
      downloadThroughput: 500 * 1024 / 8, // 500 kbps
      uploadThroughput: 500 * 1024 / 8,   // 500 kbps
      latency: 400
    },
    '4G': {
      offline: false,
      downloadThroughput: 10 * 1024 * 1024 / 8, // 10 Mbps
      uploadThroughput: 5 * 1024 * 1024 / 8,    // 5 Mbps
      latency: 20
    },
    'WiFi': {
      offline: false,
      downloadThroughput: 30 * 1024 * 1024 / 8, // 30 Mbps
      uploadThroughput: 15 * 1024 * 1024 / 8,   // 15 Mbps
      latency: 2
    }
  }
};

module.exports = { testConfig, capabilities };







