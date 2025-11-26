/**
 * LLM Host Simulation - Main entry point
 *
 * Provides the public API for simulating LLM hosts interacting
 * with MCP servers through actual LLM providers.
 */

import type { MCPFixtureApi } from '../../mcp/fixtures/mcpFixture.js';
import type {
  LLMHostConfig,
  LLMHostSimulationResult,
  LLMProvider,
} from './llmHostTypes.js';
import { registerAdapter, getAdapter, hasAdapter } from './adapter.js';
import { runSimulation } from './orchestrator.js';
import { createOpenAIAdapter } from './adapters/openai.js';
import { createAnthropicAdapter } from './adapters/anthropic.js';

// Register built-in adapters
registerAdapter('openai', createOpenAIAdapter);
registerAdapter('anthropic', createAnthropicAdapter);

/**
 * Simulates an LLM host interacting with an MCP server
 *
 * This function uses actual LLM providers (OpenAI or Anthropic) to test
 * MCP servers through natural language scenarios. The LLM chooses which
 * tools to call based on their descriptions, testing discoverability and
 * parameter clarity.
 *
 * @param mcp - MCP fixture API
 * @param scenario - Natural language prompt describing what to do
 * @param config - LLM host configuration
 * @returns Simulation result with tool calls and final response
 *
 * @example
 * ```typescript
 * const result = await simulateLLMHost(mcp,
 *   "Get the weather for London",
 *   {
 *     provider: 'openai',
 *     model: 'gpt-4o'
 *   }
 * );
 *
 * expect(result.success).toBe(true);
 * expect(result.toolCalls).toContainEqual({
 *   name: 'get_weather',
 *   arguments: { city: 'London' }
 * });
 * ```
 */
export async function simulateLLMHost(
  mcp: MCPFixtureApi,
  scenario: string,
  config: LLMHostConfig
): Promise<LLMHostSimulationResult> {
  const adapter = getAdapter(config.provider);

  return runSimulation(adapter, mcp, scenario, config, {
    retry: {
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
    },
  });
}

/**
 * Checks if the required SDK is available for a given provider
 *
 * This performs a quick check without actually loading the SDK.
 * The actual SDK loading happens in the adapter when simulation runs.
 *
 * @param provider - LLM provider to check
 * @returns true if an adapter is registered for the provider
 */
export function isProviderAvailable(provider: LLMProvider): boolean {
  return hasAdapter(provider);
}

/**
 * Gets a helpful error message for missing dependencies
 *
 * @param provider - LLM provider
 * @returns Error message with installation instructions
 */
export function getMissingDependencyMessage(provider: LLMProvider): string {
  switch (provider) {
    case 'openai':
      return 'OpenAI SDK is not installed. Install it with: npm install openai';
    case 'anthropic':
      return 'Anthropic SDK is not installed. Install it with: npm install @anthropic-ai/sdk';
    default:
      return `Unknown provider: ${provider}`;
  }
}

// Re-export adapter utilities for advanced usage
export { registerAdapter, getAdapter, hasAdapter } from './adapter.js';
export { runSimulation } from './orchestrator.js';
export { withRetry, isRetryableError, type RetryOptions } from './retry.js';
export type { LLMAdapter, LLMChatResult } from './adapter.js';
