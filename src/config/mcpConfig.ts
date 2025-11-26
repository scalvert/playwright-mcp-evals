import { z } from 'zod';

/**
 * MCP host capabilities that can be registered with the server
 */
export interface MCPHostCapabilities {
  /**
   * Sampling capabilities (for LLM sampling)
   */
  sampling?: Record<string, unknown>;

  /**
   * Roots capabilities (for file system roots)
   */
  roots?: {
    /**
     * Whether the client can notify the server when roots change
     */
    listChanged: boolean;
  };
}

/**
 * Configuration for MCP client connection
 *
 * Supports both stdio (local) and HTTP (remote) transports
 */
export interface MCPConfig {
  /**
   * Transport type
   */
  transport: 'http' | 'stdio';

  /**
   * Server URL (required when transport === 'http')
   */
  serverUrl?: string;

  /**
   * HTTP headers (optional for http transport, e.g., Authorization)
   */
  headers?: Record<string, string>;

  /**
   * Command to execute (required when transport === 'stdio')
   */
  command?: string;

  /**
   * Command arguments (optional for stdio)
   */
  args?: Array<string>;

  /**
   * Working directory for the command (optional for stdio)
   */
  cwd?: string;

  /**
   * Host capabilities to register with the server
   */
  capabilities?: MCPHostCapabilities;

  /**
   * Connection timeout in milliseconds
   */
  connectTimeoutMs?: number;

  /**
   * Request timeout in milliseconds
   */
  requestTimeoutMs?: number;

  /**
   * Enable debug logging
   */
  debugLogging?: boolean;

  /**
   * Suppress stderr output from the server process (stdio only)
   * When true, server stderr is ignored instead of inherited
   */
  quiet?: boolean;
}

/**
 * Zod schema for MCPHostCapabilities
 */
const MCPHostCapabilitiesSchema = z.object({
  sampling: z.record(z.unknown()).optional(),
  roots: z
    .object({
      listChanged: z.boolean(),
    })
    .optional(),
});

/**
 * Zod schema for stdio transport config
 */
const StdioConfigSchema = z.object({
  transport: z.literal('stdio'),
  command: z.string().min(1, 'command is required for stdio transport'),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  capabilities: MCPHostCapabilitiesSchema.optional(),
  connectTimeoutMs: z.number().positive().optional(),
  requestTimeoutMs: z.number().positive().optional(),
  debugLogging: z.boolean().optional(),
  quiet: z.boolean().optional(),
});

/**
 * Zod schema for HTTP transport config
 */
const HttpConfigSchema = z.object({
  transport: z.literal('http'),
  serverUrl: z.string().url('serverUrl must be a valid URL'),
  headers: z.record(z.string()).optional(),
  capabilities: MCPHostCapabilitiesSchema.optional(),
  connectTimeoutMs: z.number().positive().optional(),
  requestTimeoutMs: z.number().positive().optional(),
  debugLogging: z.boolean().optional(),
});

/**
 * Union schema for MCPConfig (validates based on transport type)
 */
export const MCPConfigSchema = z.discriminatedUnion('transport', [
  StdioConfigSchema,
  HttpConfigSchema,
]);

/**
 * Validates an MCPConfig object
 *
 * @param config - The config to validate
 * @returns The validated config
 * @throws {z.ZodError} If validation fails
 */
export function validateMCPConfig(config: unknown): MCPConfig {
  return MCPConfigSchema.parse(config);
}

/**
 * Type guard to check if a config is for stdio transport
 */
export function isStdioConfig(
  config: MCPConfig
): config is MCPConfig & { transport: 'stdio'; command: string } {
  return config.transport === 'stdio' && typeof config.command === 'string';
}

/**
 * Type guard to check if a config is for HTTP transport
 */
export function isHttpConfig(
  config: MCPConfig
): config is MCPConfig & { transport: 'http'; serverUrl: string } {
  return config.transport === 'http' && typeof config.serverUrl === 'string';
}
