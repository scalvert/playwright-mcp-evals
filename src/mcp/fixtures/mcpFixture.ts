import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type {
  Tool,
  CallToolResult,
  ListToolsResult,
} from '@modelcontextprotocol/sdk/types.js';

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
 * Creates an MCPFixtureApi wrapper around a Client
 *
 * @param client - The MCP client to wrap
 * @returns MCPFixtureApi instance
 */
export function createMCPFixtureApi(client: Client): MCPFixtureApi {
  return {
    client,

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
