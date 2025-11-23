import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { MCPConfig } from '../config/mcpConfig.js';
import {
  validateMCPConfig,
  isStdioConfig,
  isHttpConfig,
} from '../config/mcpConfig.js';

/**
 * Creates and connects an MCP client based on the provided configuration
 *
 * @param config - MCP configuration (will be validated)
 * @param clientInfo - Optional client information (defaults to playwright-mcp-evals)
 * @returns Connected MCP Client instance
 * @throws {Error} If config is invalid or connection fails
 *
 * @example
 * // Stdio transport
 * const client = await createMCPClientForConfig({
 *   transport: 'stdio',
 *   command: 'node',
 *   args: ['server.js']
 * });
 *
 * @example
 * // HTTP transport
 * const client = await createMCPClientForConfig({
 *   transport: 'http',
 *   serverUrl: 'http://localhost:3000/mcp'
 * });
 */
export async function createMCPClientForConfig(
  config: MCPConfig,
  clientInfo?: {
    name?: string;
    version?: string;
  }
): Promise<Client> {
  // Validate config
  const validatedConfig = validateMCPConfig(config);

  // Create client with info
  const client = new Client(
    {
      name: clientInfo?.name ?? 'playwright-mcp-evals',
      version: clientInfo?.version ?? '0.1.0',
    },
    {
      capabilities: validatedConfig.capabilities ?? {},
    }
  );

  // Create appropriate transport and connect
  if (isStdioConfig(validatedConfig)) {
    const transport = new StdioClientTransport({
      command: validatedConfig.command,
      args: validatedConfig.args ?? [],
    });

    if (validatedConfig.debugLogging) {
      console.log('[MCP] Connecting via stdio:', {
        command: validatedConfig.command,
        args: validatedConfig.args,
      });
    }

    await client.connect(transport);
  } else if (isHttpConfig(validatedConfig)) {
    const transport = new StreamableHTTPClientTransport(
      new URL(validatedConfig.serverUrl)
    );

    if (validatedConfig.debugLogging) {
      console.log('[MCP] Connecting via HTTP:', {
        serverUrl: validatedConfig.serverUrl,
      });
    }

    await client.connect(transport);
  }

  if (validatedConfig.debugLogging) {
    console.log('[MCP] Connected successfully');
    const serverInfo = client.getServerVersion();
    if (serverInfo) {
      console.log('[MCP] Server info:', serverInfo);
    }
  }

  return client;
}

/**
 * Safely closes an MCP client connection
 *
 * @param client - The client to close
 */
export async function closeMCPClient(client: Client): Promise<void> {
  try {
    await client.close();
  } catch (error) {
    console.error('[MCP] Error closing client:', error);
    throw error;
  }
}
