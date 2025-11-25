import { test as base, expect } from '@playwright/test';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { MCPConfig } from '../../src/config/mcpConfig.js';
import {
  createMCPClientForConfig,
  closeMCPClient,
} from '../../src/mcp/clientFactory.js';
import {
  createMCPFixture,
  type MCPFixtureApi,
} from '../../src/mcp/fixtures/mcpFixture.js';

/**
 * Extended test fixtures for MCP testing
 */
type MCPFixtures = {
  /**
   * Raw MCP client instance (automatically connected and cleaned up)
   */
  mcpClient: Client;

  /**
   * High-level MCP API for tests
   */
  mcp: MCPFixtureApi;
};

/**
 * Extended Playwright test with MCP fixtures
 *
 * @example
 * import { test, expect } from './fixtures/mcp';
 *
 * test('lists tools from MCP server', async ({ mcp }) => {
 *   const tools = await mcp.listTools();
 *   expect(tools.length).toBeGreaterThan(0);
 * });
 */
export const test = base.extend<MCPFixtures>({
  /**
   * mcpClient fixture: Creates and connects an MCP client
   *
   * The client configuration is read from the project's `use.mcpConfig`
   * setting in playwright.config.ts
   */
  // eslint-disable-next-line no-empty-pattern
  mcpClient: async ({}, use, testInfo) => {
    // Extract mcpConfig from project use settings
    const useConfig = testInfo.project.use as { mcpConfig?: MCPConfig };
    const mcpConfig = useConfig.mcpConfig;

    if (!mcpConfig) {
      throw new Error(
        `Missing mcpConfig in project.use for project "${testInfo.project.name}". ` +
          `Please add mcpConfig to your project configuration in playwright.config.ts`
      );
    }

    // Create and connect client
    const client = await createMCPClientForConfig(mcpConfig, {
      name: '@mcp-testing/server-tester',
      version: '0.1.0',
    });

    try {
      // Provide client to test
      await use(client);
    } finally {
      // Cleanup: close the client
      await closeMCPClient(client);
    }
  },

  /**
   * mcp fixture: High-level test API built on mcpClient
   *
   * Depends on mcpClient fixture
   * Automatically tracks all MCP operations for the reporter
   */
  mcp: async ({ mcpClient }, use, testInfo) => {
    const api = createMCPFixture(mcpClient, testInfo);
    await use(api);
  },
});

/**
 * Re-export expect from Playwright for convenience
 */
export { expect };
