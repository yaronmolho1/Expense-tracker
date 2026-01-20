import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 * 
 * Tests critical user flows to catch breaking changes before production.
 * 
 * Uses separate test database (expense_tracker_test) that is reset before each test run.
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  // Global setup - runs once before all tests
  globalSetup: require.resolve('./tests/setup/global-setup.ts'),
  
  // Maximum time one test can run for
  timeout: 30 * 1000,
  
  // Run tests in files in parallel
  fullyParallel: true,
  
  // Run auth setup before all tests
  testMatch: /.*\.spec\.ts/,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 0,
  
  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,
  
  // Reporter to use
  reporter: process.env.CI ? 'github' : 'html',
  
  // Shared settings for all the projects below
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    // Use IPv4 explicitly to avoid IPv6 connection issues
    baseURL: 'http://127.0.0.1:3000',

    // Set consistent viewport size for local and CI environments
    viewport: { width: 1280, height: 720 },

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'retain-on-failure',

    // Increase navigation timeout to handle slow server responses
    navigationTimeout: 30 * 1000,

    // Increase action timeout for slow operations (especially in CI)
    actionTimeout: process.env.CI ? 20 * 1000 : 15 * 1000,
  },

  // Configure projects for major browsers
  projects: [
    // Setup project - runs first to create auth state
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // Main tests - depend on setup and use stored auth state
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Use stored auth state (comment out to disable optimization)
        // storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'npm run dev',
    // Use IPv4 explicitly (127.0.0.1) to avoid IPv6 connection issues
    // Use /login page as health check - it's simple, doesn't require DB, and is public
    url: 'http://127.0.0.1:3000/login',
    reuseExistingServer: !process.env.CI,
    timeout: 180 * 1000, // Increased timeout for slow startup
    stdout: 'pipe',
    stderr: 'pipe',
    // Playwright will wait until /login returns a 200 status
    // This ensures the Next.js server is ready (even if DB isn't connected yet)
    env: {
      ...process.env,
      // Database connection - USE TEST DATABASE
      DATABASE_URL: process.env.DATABASE_URL || process.env.TEST_DATABASE_URL || 'postgresql://expenseuser:expensepass@localhost:5432/expense_tracker_test',
      // JWT secret for authentication
      JWT_SECRET: process.env.JWT_SECRET || 'test-secret-key-for-e2e-testing-only-change-in-production',
      JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
      // Auth credentials (from docker-compose or .env)
      AUTH_USERNAME: process.env.AUTH_USERNAME || 'gili',
      AUTH_PASSWORD_HASH_BASE64: process.env.AUTH_PASSWORD_HASH_BASE64 || 'JDJiJDEyJGRxREtvMVUvOTVGVWRCVi5qLjdSZi5JOVltMzhGTDdzRVdYVHZDazlYUm5EcFhvNEdRbFRh',
      // Optional: Anthropic API key
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
      NODE_ENV: 'test',
      PORT: '3000',
    },
  },
});
