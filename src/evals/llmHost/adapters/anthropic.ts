/**
 * Anthropic Adapter for LLM Host Simulation
 *
 * Implements the LLMAdapter interface for Anthropic's Messages API.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { LLMAdapter, LLMChatResult } from '../adapter.js';
import type { LLMHostConfig, LLMToolCall } from '../llmHostTypes.js';

/**
 * Anthropic-specific types (minimal to avoid full SDK dependency at compile time)
 */
interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicContentBlock[];
}

interface AnthropicContentBlock {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string;
}

/**
 * Creates an Anthropic adapter
 */
export function createAnthropicAdapter(): LLMAdapter {
  return {
    provider: 'anthropic',

    async createClient(config: LLMHostConfig): Promise<unknown> {
      // Dynamic import for optional dependency
      let Anthropic;
      try {
        const module = await import('@anthropic-ai/sdk');
        Anthropic = module.default;
      } catch {
        throw new Error(
          'Anthropic SDK is not installed. Install it with: npm install @anthropic-ai/sdk'
        );
      }

      // Get API key
      const apiKeyEnvVar = config.apiKeyEnvVar || 'ANTHROPIC_API_KEY';
      const apiKey = process.env[apiKeyEnvVar];

      if (!apiKey) {
        throw new Error(
          `Anthropic API key not found in environment variable ${apiKeyEnvVar}`
        );
      }

      return new Anthropic({ apiKey });
    },

    formatTools(tools: Tool[]): AnthropicTool[] {
      return tools.map((tool) => ({
        name: tool.name,
        description: tool.description || '',
        input_schema: (tool.inputSchema as Record<string, unknown>) || {},
      }));
    },

    async chat(
      client: unknown,
      messages: unknown[],
      tools: unknown[],
      config: LLMHostConfig
    ): Promise<LLMChatResult> {
      const anthropic = client as { messages: { create: (opts: unknown) => Promise<unknown> } };

      const response = await anthropic.messages.create({
        model: config.model || 'claude-3-5-sonnet-20241022',
        max_tokens: config.maxTokens || 4096,
        temperature: config.temperature ?? 0.0,
        messages: messages as AnthropicMessage[],
        tools: tools as AnthropicTool[],
      });

      // Parse response
      const resp = response as {
        stop_reason: 'end_turn' | 'tool_use' | 'max_tokens' | string;
        content: AnthropicContentBlock[];
      };

      // Extract text content
      const textBlock = resp.content.find((c) => c.type === 'text');
      const textContent = textBlock?.text || null;

      // Check stop reason
      if (resp.stop_reason === 'tool_use') {
        // Extract tool uses
        const toolUses = resp.content.filter((c) => c.type === 'tool_use');
        const toolCalls: LLMToolCall[] = toolUses.map((tu) => ({
          name: tu.name!,
          arguments: tu.input as Record<string, unknown>,
          id: tu.id,
        }));

        return {
          wantsToolCalls: true,
          toolCalls,
          textContent,
          rawResponse: response,
        };
      }

      if (resp.stop_reason === 'max_tokens') {
        throw new Error('Response exceeded max tokens');
      }

      // No tool calls - final response (end_turn or other)
      return {
        wantsToolCalls: false,
        toolCalls: [],
        textContent,
        rawResponse: response,
      };
    },

    createUserMessage(scenario: string): AnthropicMessage {
      return {
        role: 'user',
        content: scenario,
      };
    },

    createAssistantMessage(chatResult: LLMChatResult): AnthropicMessage {
      const rawResponse = chatResult.rawResponse as { content: AnthropicContentBlock[] };

      return {
        role: 'assistant',
        content: rawResponse.content,
      };
    },

    createToolResultMessage(toolCall: LLMToolCall, result: string): AnthropicContentBlock {
      return {
        type: 'tool_result',
        tool_use_id: toolCall.id,
        content: result,
      };
    },
  };
}
