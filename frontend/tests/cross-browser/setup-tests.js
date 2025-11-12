#!/usr/bin/env node

/**
 * Cross-Browser Test Setup Script
 * Sets up the testing environment and validates configuration
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
  requiredEnvVars: [
    'BROWSERSTACK_USERNAME',
    'BROWSERSTACK_ACCESS_KEY'
  ],
  requiredFiles: [
    './browserstack.config.js',
    './run-tests.js',
    './package.json'
  ],
  testDirectories: [
    './specs',
    './test-results',
    './test-results/screenshots',
    './test-results/videos',
    './test-results/junit',
    './test-results/allure-results'
  ]
};

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Logging functions
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

// Check if environment variables are set
function checkEnvironmentVariables() {
  logInfo('Checking environment variables...');
  
  const missing = CONFIG.requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missing.length > 0) {
    logError(`Missing required environment variables: ${missing.join(', ')}`);
    logWarning('Please set the following environment variables:');
    missing.forEach(envVar => {
      console.log(`  export ${envVar}=your_value_here`);
    });
    return false;
  }
  
  logSuccess('All required environment variables are set');
  return true;
}

// Check if required files exist
function checkRequiredFiles() {
  logInfo('Checking required files...');
  
  const missing = CONFIG.requiredFiles.filter(file => !fs.existsSync(file));
  
  if (missing.length > 0) {
    logError(`Missing required files: ${missing.join(', ')}`);
    return false;
  }
  
  logSuccess('All required files are present');
  return true;
}

// Create test directories
function createTestDirectories() {
  logInfo('Creating test directories...');
  
  CONFIG.testDirectories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logSuccess(`Created directory: ${dir}`);
    } else {
      logInfo(`Directory already exists: ${dir}`);
    }
  });
}

// Install dependencies
function installDependencies() {
  logInfo('Installing dependencies...');
  
  try {
    execSync('npm install', { stdio: 'inherit', cwd: __dirname });
    logSuccess('Dependencies installed successfully');
    return true;
  } catch (error) {
    logError(`Failed to install dependencies: ${error.message}`);
    return false;
  }
}

// Validate BrowserStack credentials
async function validateBrowserStackCredentials() {
  logInfo('Validating BrowserStack credentials...');
  
  try {
    const response = await fetch('https://api.browserstack.com/automate/plan.json', {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${process.env.BROWSERSTACK_USERNAME}:${process.env.BROWSERSTACK_ACCESS_KEY}`).toString('base64')}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      logSuccess(`BrowserStack credentials valid. Plan: ${data.automate_plan || 'Unknown'}`);
      return true;
    } else {
      logError(`BrowserStack credentials invalid. Status: ${response.status}`);
      return false;
    }
  } catch (error) {
    logError(`Failed to validate BrowserStack credentials: ${error.message}`);
    return false;
  }
}

// Create test data
function createTestData() {
  logInfo('Creating test data...');
  
  const testData = {
    users: [
      { id: 'user1', name: 'Test User 1', email: 'user1@example.com' },
      { id: 'user2', name: 'Test User 2', email: 'user2@example.com' },
      { id: 'user3', name: 'Test User 3', email: 'user3@example.com' }
    ],
    images: [
      { id: 'img1', url: '/test-images/image1.jpg', title: 'Test Image 1' },
      { id: 'img2', url: '/test-images/image2.jpg', title: 'Test Image 2' },
      { id: 'img3', url: '/test-images/image3.jpg', title: 'Test Image 3' }
    ],
    playlists: [
      { id: 'playlist1', name: 'Test Playlist 1', images: ['img1', 'img2'] },
      { id: 'playlist2', name: 'Test Playlist 2', images: ['img2', 'img3'] }
    ]
  };
  
  const testDataPath = path.join(__dirname, 'test-data.json');
  fs.writeFileSync(testDataPath, JSON.stringify(testData, null, 2));
  logSuccess('Test data created');
}

// Create test configuration
function createTestConfiguration() {
  logInfo('Creating test configuration...');
  
  const config = {
    baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
    timeout: 30000,
    retries: 2,
    parallel: true,
    maxInstances: 5,
    capabilities: [
      {
        browserName: 'Chrome',
        'bstack:options': {
          os: 'Android',
          osVersion: '11.0',
          deviceName: 'Samsung Galaxy S21',
          realMobile: true
        }
      }
    ],
    reporters: [
      'spec',
      ['junit', { outputDir: './test-results/junit' }],
      ['allure', { outputDir: './test-results/allure-results' }]
    ]
  };
  
  const configPath = path.join(__dirname, 'test-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  logSuccess('Test configuration created');
}

// Create sample test
function createSampleTest() {
  logInfo('Creating sample test...');
  
  const sampleTest = `describe('Sample Test', () => {
  it('should load the main page', async () => {
    await browser.url('/');
    
    const title = await browser.getTitle();
    expect(title).toContain('Glowworm');
  });
  
  it('should display navigation', async () => {
    await browser.url('/');
    
    const nav = await $('[data-testid="mobile-bottom-nav"]');
    await expect(nav).toBeDisplayed();
  });
});`;

  const sampleTestPath = path.join(__dirname, 'specs', 'sample.test.js');
  fs.writeFileSync(sampleTestPath, sampleTest);
  logSuccess('Sample test created');
}

// Create README
function createReadme() {
  logInfo('Creating README...');
  
  const readme = `# Cross-Browser Testing Suite

This directory contains the cross-browser testing suite for the Glowworm mobile application.

## Setup

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Set environment variables:
   \`\`\`bash
   export BROWSERSTACK_USERNAME=your_username
   export BROWSERSTACK_ACCESS_KEY=your_access_key
   \`\`\`

3. Run setup:
   \`\`\`bash
   npm run test:setup
   \`\`\`

## Running Tests

### Run all tests
\`\`\`bash
npm test
\`\`\`

### Run specific test suite
\`\`\`bash
npm run test:mobile
npm run test:touch
npm run test:performance
npm run test:accessibility
npm run test:visual
\`\`\`

### Run tests for specific browser
\`\`\`bash
npm run test:safari
npm run test:chrome
npm run test:samsung
npm run test:firefox
\`\`\`

## Test Suites

- **mobile**: Mobile navigation and layout tests
- **touch**: Touch interactions and gestures
- **performance**: Performance and load time tests
- **accessibility**: Accessibility and screen reader tests
- **visual**: Visual regression tests

## Browsers Tested

- Safari on iOS 14, 15, 16
- Chrome on Android 11, 12
- Samsung Internet on Android 10, 12
- Firefox on Android 10, 11

## Test Results

Test results are saved in the \`test-results\` directory:
- Screenshots: \`test-results/screenshots/\`
- Videos: \`test-results/videos/\`
- JUnit reports: \`test-results/junit/\`
- Allure reports: \`test-results/allure-results/\`

## Viewing Reports

To view the Allure report:
\`\`\`bash
npm run test:report
\`\`\`

## Configuration

Test configuration can be modified in:
- \`browserstack.config.js\`: BrowserStack and WebDriver configuration
- \`test-config.json\`: General test configuration
- \`package.json\`: Scripts and dependencies

## Troubleshooting

### Common Issues

1. **BrowserStack credentials invalid**: Check your username and access key
2. **Tests timing out**: Increase timeout values in configuration
3. **Visual regression failures**: Check if UI changes are intentional
4. **Network issues**: Verify internet connection and BrowserStack status

### Debug Mode

Run tests in debug mode:
\`\`\`bash
DEBUG=true npm test
\`\`\`

### Local Testing

For local testing without BrowserStack:
\`\`\`bash
npx wdio run browserstack.config.js --local
\`\`\`
`;

  const readmePath = path.join(__dirname, 'README.md');
  fs.writeFileSync(readmePath, readme);
  logSuccess('README created');
}

// Main setup function
async function setup() {
  log('🚀 Setting up Cross-Browser Testing Suite', 'bright');
  log('==========================================', 'bright');
  
  let allChecksPassed = true;
  
  // Check environment variables
  if (!checkEnvironmentVariables()) {
    allChecksPassed = false;
  }
  
  // Check required files
  if (!checkRequiredFiles()) {
    allChecksPassed = false;
  }
  
  // Create directories
  createTestDirectories();
  
  // Install dependencies
  if (!installDependencies()) {
    allChecksPassed = false;
  }
  
  // Validate BrowserStack credentials
  if (process.env.BROWSERSTACK_USERNAME && process.env.BROWSERSTACK_ACCESS_KEY) {
    if (!(await validateBrowserStackCredentials())) {
      allChecksPassed = false;
    }
  } else {
    logWarning('Skipping BrowserStack validation (credentials not set)');
  }
  
  // Create test data and configuration
  createTestData();
  createTestConfiguration();
  createSampleTest();
  createReadme();
  
  // Final status
  if (allChecksPassed) {
    logSuccess('Setup completed successfully!');
    logInfo('You can now run tests with: npm test');
  } else {
    logError('Setup completed with errors. Please fix the issues above.');
    process.exit(1);
  }
}

// Run setup
setup().catch(error => {
  logError(`Setup failed: ${error.message}`);
  process.exit(1);
});








