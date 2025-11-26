/**
 * OpenAI Adapter for LLM Host Simulation
 *
 * Implements the LLMAdapter interface for OpenAI's Chat Completions API.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { LLMAdapter, LLMChatResult } from '../adapter.js';
import type { LLMHostConfig, LLMToolCall } from '../llmHostTypes.js';

/**
 * OpenAI-specific types (minimal to avoid full SDK dependency at compile time)
 */
interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

interface OpenAIMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
}

/**
 * Creates an OpenAI adapter
 */
export function createOpenAIAdapter(): LLMAdapter {
  return {
    provider: 'openai',

    async createClient(config: LLMHostConfig): Promise<unknown> {
      // Dynamic import for optional dependency
      let OpenAI;
      try {
        const module = await import('openai');
        OpenAI = module.OpenAI;
      } catch {
        throw new Error(
          'OpenAI SDK is not installed. Install it with: npm install openai'
        );
      }

      // Get API key
      const apiKeyEnvVar = config.apiKeyEnvVar || 'OPENAI_API_KEY';
      const apiKey = process.env[apiKeyEnvVar];

      if (!apiKey) {
        throw new Error(
          `OpenAI API key not found in environment variable ${apiKeyEnvVar}`
        );
      }

      return new OpenAI({ apiKey });
    },

    formatTools(tools: Tool[]): OpenAITool[] {
      return tools.map((tool) => ({
        type: 'function' as const,
        function: {
          name: tool.name,
          description: tool.description || '',
          parameters: (tool.inputSchema as Record<string, unknown>) || {},
        },
      }));
    },

    async chat(
      client: unknown,
      messages: unknown[],
      tools: unknown[],
      config: LLMHostConfig
    ): Promise<LLMChatResult> {
      const openai = client as { chat: { completions: { create: (opts: unknown) => Promise<unknown> } } };

      const response = await openai.chat.completions.create({
        model: config.model || 'gpt-4o',
        messages: messages as OpenAIMessage[],
        tools: tools as OpenAITool[],
        temperature: config.temperature ?? 0.0,
        max_tokens: config.maxTokens,
      });

      // Parse response
      const resp = response as {
        choices: Array<{
          message: {
            content: string | null;
            tool_calls?: Array<{
              id: string;
              type: string;
              function: {
                name: string;
                arguments: string;
              };
            }>;
          };
        }>;
      };

      const message = resp.choices[0]?.message;
      if (!message) {
        throw new Error('No response from OpenAI');
      }

      // Check for tool calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        const toolCalls: LLMToolCall[] = message.tool_calls.map((tc) => ({
          name: tc.function.name,
          arguments: JSON.parse(tc.function.arguments),
          id: tc.id,
        }));

        return {
          wantsToolCalls: true,
          toolCalls,
          textContent: message.content,
          rawResponse: response,
        };
      }

      // No tool calls - final response
      return {
        wantsToolCalls: false,
        toolCalls: [],
        textContent: message.content,
        rawResponse: response,
      };
    },

    createUserMessage(scenario: string): OpenAIMessage {
      return {
        role: 'user',
        content: scenario,
      };
    },

    createAssistantMessage(chatResult: LLMChatResult): OpenAIMessage {
      const rawResponse = chatResult.rawResponse as {
        choices: Array<{ message: { tool_calls?: unknown[] } }>;
      };

      return {
        role: 'assistant',
        content: chatResult.textContent,
        tool_calls: rawResponse.choices[0]?.message?.tool_calls as OpenAIMessage['tool_calls'],
      };
    },

    createToolResultMessage(toolCall: LLMToolCall, result: string): OpenAIMessage {
      return {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result,
      };
    },
  };
}
