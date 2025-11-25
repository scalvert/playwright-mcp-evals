import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['@mcp-testing/server-tester/reporters/mcpReporter', {
      outputDir: '.mcp-test-results',
      autoOpen: !process.env.CI,
      historyLimit: 10
    }]
  ],

  // Shared settings for all the projects below
  use: {
    // Collect trace when retrying the failed test
    trace: 'on-first-retry',
  },

  // Configure projects for MCP server testing
  projects: [
    {
      name: 'glean-mcp-direct',
      testMatch: '**/glean-eval.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        mcpConfig: {
          transport: 'http',
          serverUrl: process.env.GLEAN_MCP_SERVER_URL || 'http://localhost:3000/mcp',
          // Add authentication headers if needed
          headers: process.env.GLEAN_API_TOKEN ? {
            'Authorization': `Bearer ${process.env.GLEAN_API_TOKEN}`,
          } : undefined,
          requestTimeoutMs: 60000, // 60 seconds for search operations
          debugLogging: process.env.DEBUG === 'true',
        }
      }
    },
  ],
});
