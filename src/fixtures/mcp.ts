import { test as base, expect } from '@playwright/test';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import {
  createMCPClientForConfig,
  closeMCPClient,
} from '../mcp/clientFactory.js';
import {
  createMCPFixture,
  type MCPFixtureApi,
  type AuthType,
} from '../mcp/fixtures/mcpFixture.js';
import { PlaywrightOAuthClientProvider } from '../auth/oauthClientProvider.js';
import type { MCPConfig } from '../config/mcpConfig.js';

/**
 * Determines the authentication type from an MCP config
 */
function getAuthTypeFromConfig(mcpConfig?: MCPConfig): AuthType {
  if (!mcpConfig?.auth) return 'none';
  // OAuth is configured via authStatePath or oauth object
  if (mcpConfig.auth.oauth?.authStatePath) return 'oauth';
  // Static token auth
  if (mcpConfig.auth.accessToken) return 'bearer-token';
  return 'none';
}

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
 * import { test, expect } from '@mcp-testing/server-tester';
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
   *
   * Supports both static token auth (via config.auth.accessToken) and
   * OAuth (via config.auth.oauth with authStatePath).
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

    // Create auth provider if OAuth is configured
    let authProvider: OAuthClientProvider | undefined;
    if (mcpConfig.auth?.oauth?.authStatePath) {
      authProvider = new PlaywrightOAuthClientProvider({
        storagePath: mcpConfig.auth.oauth.authStatePath,
        redirectUri:
          mcpConfig.auth.oauth.redirectUri ??
          'http://localhost:3000/oauth/callback',
        clientId: mcpConfig.auth.oauth.clientId,
        clientSecret: mcpConfig.auth.oauth.clientSecret,
      });
    }

    // Create and connect client
    const client = await createMCPClientForConfig(mcpConfig, {
      clientInfo: {
        name: '@mcp-testing/server-tester',
        version: '0.1.0',
      },
      authProvider,
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
    // Determine auth type from project config
    const useConfig = testInfo.project.use as { mcpConfig?: MCPConfig };
    const authType = getAuthTypeFromConfig(useConfig.mcpConfig);

    const api = createMCPFixture(mcpClient, testInfo, { authType });
    await use(api);
  },
});

/**
 * Re-export expect from Playwright for convenience
 */
export { expect };
