/**
 * LLM Adapter Interface
 *
 * Defines the contract for LLM provider adapters, enabling
 * the orchestrator to work with any LLM provider through
 * a unified interface.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { LLMProvider, LLMToolCall, LLMHostConfig } from './llmHostTypes.js';

/**
 * Result from an LLM chat call
 */
export interface LLMChatResult {
  /**
   * Whether the LLM wants to call tools
   */
  wantsToolCalls: boolean;

  /**
   * Tool calls requested by the LLM (if any)
   */
  toolCalls: LLMToolCall[];

  /**
   * Text content from the response (final answer if no tool calls)
   */
  textContent: string | null;

  /**
   * Raw response from the LLM (for debugging)
   */
  rawResponse: unknown;
}

/**
 * LLM Adapter interface
 *
 * Each provider (OpenAI, Anthropic) implements this interface
 * to normalize their specific APIs into a common format.
 */
export interface LLMAdapter {
  /**
   * Provider identifier
   */
  readonly provider: LLMProvider;

  /**
   * Loads the SDK and creates a client
   *
   * @param config - LLM host configuration
   * @returns Configured client instance
   * @throws Error if SDK not installed or API key missing
   */
  createClient(config: LLMHostConfig): Promise<unknown>;

  /**
   * Converts MCP tools to the provider's tool format
   *
   * @param tools - MCP tool definitions
   * @returns Tools in provider-specific format
   */
  formatTools(tools: Tool[]): unknown[];

  /**
   * Makes a chat completion request with tool support
   *
   * @param client - Client from createClient()
   * @param messages - Conversation history in provider format
   * @param tools - Formatted tools from formatTools()
   * @param config - LLM configuration (model, temperature, etc.)
   * @returns Chat result with parsed tool calls or text response
   */
  chat(
    client: unknown,
    messages: unknown[],
    tools: unknown[],
    config: LLMHostConfig
  ): Promise<LLMChatResult>;

  /**
   * Creates the initial message for a scenario
   *
   * @param scenario - User's natural language prompt
   * @returns Initial message in provider format
   */
  createUserMessage(scenario: string): unknown;

  /**
   * Creates an assistant message with tool calls
   *
   * @param chatResult - Result from chat() that had tool calls
   * @returns Assistant message in provider format
   */
  createAssistantMessage(chatResult: LLMChatResult): unknown;

  /**
   * Creates tool result messages
   *
   * @param toolCall - The tool call that was executed
   * @param result - Text result from MCP tool execution
   * @returns Tool result message(s) in provider format
   */
  createToolResultMessage(toolCall: LLMToolCall, result: string): unknown;
}

/**
 * Registry of available adapters
 */
export type AdapterFactory = () => LLMAdapter;

const adapters = new Map<LLMProvider, AdapterFactory>();

/**
 * Registers an adapter factory for a provider
 */
export function registerAdapter(provider: LLMProvider, factory: AdapterFactory): void {
  adapters.set(provider, factory);
}

/**
 * Gets an adapter for a provider
 *
 * @param provider - LLM provider
 * @returns Adapter instance
 * @throws Error if provider not registered
 */
export function getAdapter(provider: LLMProvider): LLMAdapter {
  const factory = adapters.get(provider);
  if (!factory) {
    throw new Error(
      `No adapter registered for provider: ${provider}. Available: ${Array.from(adapters.keys()).join(', ')}`
    );
  }
  return factory();
}

/**
 * Checks if an adapter is registered for a provider
 */
export function hasAdapter(provider: LLMProvider): boolean {
  return adapters.has(provider);
}
