/**
 * LLM Host Simulation Orchestrator
 *
 * Implements the shared agentic loop logic that works with any LLM adapter.
 * This is the core of the simulation - it handles tool execution, conversation
 * management, and retry logic.
 */

import type { MCPFixtureApi } from '../../mcp/fixtures/mcpFixture.js';
import { extractText } from '../../mcp/response.js';
import type { LLMAdapter } from './adapter.js';
import type {
  LLMHostConfig,
  LLMHostSimulationResult,
  LLMToolCall,
} from './llmHostTypes.js';
import { withRetry, type RetryOptions } from './retry.js';

/**
 * Options for the simulation orchestrator
 */
export interface OrchestratorOptions {
  /**
   * Retry options for LLM API calls
   */
  retry?: RetryOptions;
}

/**
 * Runs an LLM host simulation using the provided adapter
 *
 * This function implements the agentic loop:
 * 1. Send scenario to LLM with available tools
 * 2. If LLM wants to call tools, execute them via MCP
 * 3. Add tool results to conversation and repeat
 * 4. When LLM gives final response, return results
 *
 * @param adapter - LLM adapter (OpenAI, Anthropic, etc.)
 * @param mcp - MCP fixture API for tool execution
 * @param scenario - Natural language prompt
 * @param config - LLM host configuration
 * @param options - Orchestrator options (retry, etc.)
 * @returns Simulation result with tool calls and response
 */
export async function runSimulation(
  adapter: LLMAdapter,
  mcp: MCPFixtureApi,
  scenario: string,
  config: LLMHostConfig,
  options: OrchestratorOptions = {}
): Promise<LLMHostSimulationResult> {
  const maxIterations = config.maxToolCalls || 10;
  const retryOptions = options.retry || {};

  // Track all tool calls
  const allToolCalls: LLMToolCall[] = [];

  // Track conversation history for debugging
  const conversationHistory: Array<{
    role: 'user' | 'assistant' | 'tool';
    content: string;
  }> = [];

  try {
    // Create LLM client
    const client = await adapter.createClient(config);

    // Get tools from MCP server and format for LLM
    const mcpTools = await mcp.listTools();
    const formattedTools = adapter.formatTools(mcpTools);

    // Initialize conversation with user message
    const messages: unknown[] = [adapter.createUserMessage(scenario)];
    conversationHistory.push({ role: 'user', content: scenario });

    let finalResponse = '';

    // Agentic loop
    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Call LLM with retry
      const chatResult = await withRetry(
        () => adapter.chat(client, messages, formattedTools, config),
        retryOptions
      );

      // Check if LLM wants to call tools
      if (chatResult.wantsToolCalls && chatResult.toolCalls.length > 0) {
        // Add assistant message to conversation
        messages.push(adapter.createAssistantMessage(chatResult));

        // Execute each tool call through MCP
        const toolResultMessages: unknown[] = [];

        for (const toolCall of chatResult.toolCalls) {
          // Track the tool call
          allToolCalls.push(toolCall);

          // Execute via MCP
          const mcpResult = await mcp.callTool(
            toolCall.name,
            toolCall.arguments as Record<string, unknown>
          );

          // Extract text from MCP response
          const resultText = extractText(mcpResult);

          // Create tool result message
          const resultMessage = adapter.createToolResultMessage(toolCall, resultText);
          toolResultMessages.push(resultMessage);

          // Track in conversation history
          conversationHistory.push({ role: 'tool', content: resultText });
        }

        // Add tool results to conversation
        // Note: Anthropic wraps tool results in a user message, OpenAI adds them directly
        if (adapter.provider === 'anthropic') {
          messages.push({
            role: 'user',
            content: toolResultMessages,
          });
        } else {
          // OpenAI: add each tool result as a separate message
          for (const msg of toolResultMessages) {
            messages.push(msg);
          }
        }
      } else {
        // No tool calls - we have the final response
        finalResponse = chatResult.textContent || '';
        conversationHistory.push({ role: 'assistant', content: finalResponse });
        break;
      }
    }

    return {
      success: true,
      toolCalls: allToolCalls,
      response: finalResponse,
      conversationHistory,
    };
  } catch (error) {
    return {
      success: false,
      toolCalls: allToolCalls,
      error: error instanceof Error ? error.message : String(error),
      conversationHistory,
    };
  }
}
