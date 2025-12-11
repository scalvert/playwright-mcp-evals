import type { TestInfo } from '@playwright/test';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type {
  Tool,
  CallToolResult,
  ListToolsResult,
} from '@modelcontextprotocol/sdk/types.js';

// Dynamic import of test for conditional step tracking
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let testStep:
  | ((name: string, fn: () => Promise<unknown>) => Promise<unknown>)
  | null = null;

// Try to load test.step() dynamically
try {
  /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
  const playwright = require('@playwright/test');
  if (playwright && playwright.test && playwright.test.step) {
    testStep = playwright.test.step.bind(playwright.test) as typeof testStep;
  }
  /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
} catch {
  // Not in a test context, that's fine
}

/**
 * Authentication type for test categorization
 */
export type AuthType = 'oauth' | 'bearer-token' | 'none';

/**
 * Options for creating an MCP fixture
 */
export interface MCPFixtureOptions {
  /**
   * Authentication type used for this test
   * - 'oauth': OAuth 2.1 with PKCE
   * - 'bearer-token': Static bearer token
   * - 'none': No authentication
   */
  authType?: AuthType;

  /**
   * Playwright project name for this test
   * Used for filtering and grouping in the reporter
   */
  project?: string;
}

/**
 * High-level API for interacting with MCP servers in tests
 *
 * This interface wraps the raw MCP Client with test-friendly methods
 */
export interface MCPFixtureApi {
  /**
   * The underlying MCP client (for advanced usage)
   */
  client: Client;

  /**
   * Authentication type used for this test session
   */
  authType: AuthType;

  /**
   * Playwright project name for this test session
   */
  project?: string;

  /**
   * Lists all available tools from the MCP server
   *
   * @returns Array of tool definitions
   */
  listTools(): Promise<Array<Tool>>;

  /**
   * Calls a tool on the MCP server
   *
   * @param name - Tool name
   * @param args - Tool arguments
   * @returns Tool call result
   */
  callTool<TArgs extends Record<string, unknown> = Record<string, unknown>>(
    name: string,
    args: TArgs
  ): Promise<CallToolResult>;

  /**
   * Gets information about the connected server
   */
  getServerInfo(): {
    name?: string;
    version?: string;
  } | null;
}

/**
 * Creates an MCP fixture wrapper around a Client
 *
 * When testInfo is provided, automatically tracks all MCP operations with test.step()
 * and creates attachments for the MCP Test Reporter.
 *
 * @param client - The MCP client to wrap
 * @param testInfo - Optional Playwright TestInfo for auto-tracking
 * @returns MCPFixtureApi instance
 *
 * @example
 * ```typescript
 * // With tracking (recommended)
 * const test = base.extend<{ mcp: MCPFixtureApi }>({
 *   mcp: async ({}, use, testInfo) => {
 *     const client = await createMCPClientForConfig(config);
 *     const api = createMCPFixture(client, testInfo);
 *     await use(api);
 *     await closeMCPClient(client);
 *   }
 * });
 *
 * // Without tracking
 * const api = createMCPFixture(client);
 * ```
 */
export function createMCPFixture(
  client: Client,
  testInfo?: TestInfo,
  options?: MCPFixtureOptions
): MCPFixtureApi {
  const authType = options?.authType ?? 'none';
  const project = options?.project;
  // If no testInfo, return basic API without tracking
  if (!testInfo) {
    return {
      client,
      authType,
      project,

      async listTools(): Promise<Array<Tool>> {
        const result = (await client.listTools()) as ListToolsResult;
        return result.tools;
      },

      async callTool<TArgs extends Record<string, unknown>>(
        name: string,
        args: TArgs
      ): Promise<CallToolResult> {
        const result = (await client.callTool({
          name,
          arguments: args,
        })) as CallToolResult;
        return result;
      },

      getServerInfo() {
        const serverVersion = client.getServerVersion();
        if (!serverVersion) {
          return null;
        }
        return {
          name: serverVersion.name,
          version: serverVersion.version,
        };
      },
    };
  }

  // With testInfo, return tracked API
  return {
    client,
    authType,
    project,

    async listTools(): Promise<Array<Tool>> {
      const execute = async () => {
        const result = (await client.listTools()) as ListToolsResult;
        const tools = result.tools;

        // Auto-attach for reporter
        await testInfo.attach('mcp-list-tools', {
          contentType: 'application/json',
          body: JSON.stringify(
            {
              operation: 'listTools',
              toolCount: tools.length,
              tools: tools.map((t) => ({
                name: t.name,
                description: t.description,
              })),
            },
            null,
            2
          ),
        });

        return tools;
      };

      // Wrap in test.step if available
      return (
        testStep ? testStep('MCP: listTools()', execute) : execute()
      ) as Promise<Array<Tool>>;
    },

    async callTool<TArgs extends Record<string, unknown>>(
      name: string,
      args: TArgs
    ): Promise<CallToolResult> {
      const execute = async () => {
        const startTime = Date.now();
        const result = (await client.callTool({
          name,
          arguments: args,
        })) as CallToolResult;
        const durationMs = Date.now() - startTime;

        // Auto-attach for reporter
        await testInfo.attach(`mcp-call-${name}`, {
          contentType: 'application/json',
          body: JSON.stringify(
            {
              operation: 'callTool',
              toolName: name,
              args,
              result,
              durationMs,
              isError: result.isError || false,
              authType,
              project,
            },
            null,
            2
          ),
        });

        return result;
      };

      // Wrap in test.step if available
      return (
        testStep ? testStep(`MCP: callTool("${name}")`, execute) : execute()
      ) as Promise<CallToolResult>;
    },

    getServerInfo() {
      const serverVersion = client.getServerVersion();
      const result = serverVersion
        ? {
            name: serverVersion.name,
            version: serverVersion.version,
          }
        : null;

      // Fire-and-forget attachment (don't block synchronous call)
      testInfo
        .attach('mcp-server-info', {
          contentType: 'application/json',
          body: JSON.stringify(
            {
              operation: 'getServerInfo',
              serverInfo: result,
            },
            null,
            2
          ),
        })
        .catch(() => {
          // Ignore attachment errors for sync methods
        });

      return result;
    },
  };
}
