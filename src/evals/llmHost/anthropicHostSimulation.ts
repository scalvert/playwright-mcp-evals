/**
 * Anthropic SDK integration for LLM host simulation
 *
 * Uses @anthropic-ai/sdk with manual MCP client integration to test servers
 * through actual LLM-driven tool selection and invocation.
 */

import type { MCPFixtureApi } from '../../mcp/fixtures/mcpFixture.js';
import type {
  LLMHostConfig,
  LLMHostSimulationResult,
  LLMToolCall,
} from './llmHostTypes.js';

/**
 * Simulates an LLM host using Anthropic SDK with MCP integration
 *
 * @param mcp - MCP fixture API (contains the client we're testing)
 * @param scenario - Natural language prompt
 * @param config - LLM host configuration
 * @returns Simulation result
 */
export async function simulateAnthropicHost(
  mcp: MCPFixtureApi,
  scenario: string,
  config: LLMHostConfig
): Promise<LLMHostSimulationResult> {
  try {
    // Dynamic import for optional dependency
    let Anthropic;
    try {
      Anthropic = (await import('@anthropic-ai/sdk')).default;
    } catch (error) {
      throw new Error(
        'Anthropic SDK is not installed. Install it with: npm install @anthropic-ai/sdk'
      );
    }

    // Get API key from environment
    const apiKeyEnvVar = config.apiKeyEnvVar || 'ANTHROPIC_API_KEY';
    const apiKey = process.env[apiKeyEnvVar];

    if (!apiKey) {
      throw new Error(
        `Anthropic API key not found in environment variable ${apiKeyEnvVar}`
      );
    }

    // Create Anthropic client
    const anthropic = new Anthropic({ apiKey });

    // List tools from MCP server
    const tools = await mcp.listTools();

    // Convert MCP tools to Anthropic tool format
    const anthropicTools = tools.map((tool) => ({
      name: tool.name,
      description: tool.description || '',
      input_schema: tool.inputSchema || {},
    }));

    // Track tool calls
    const toolCalls: LLMToolCall[] = [];

    // Agentic loop
    const model = config.model || 'claude-3-5-sonnet-20241022';
    const maxIterations = config.maxToolCalls || 10;

    let conversationHistory: Array<{
      role: 'user' | 'assistant' | 'tool';
      content: string;
    }> = [
      {
        role: 'user',
        content: scenario,
      },
    ];

    const messages: Array<any> = [
      {
        role: 'user',
        content: scenario,
      },
    ];

    let finalResponse = '';

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Call Anthropic with tools
      const response = await anthropic.messages.create({
        model,
        max_tokens: config.maxTokens || 4096,
        temperature: config.temperature ?? 0.0,
        messages,
        tools: anthropicTools as any,
      });

      // Check stop reason
      if (response.stop_reason === 'end_turn') {
        // Extract final text response
        const textContent = response.content.find(
          (c) => c.type === 'text'
        );
        if (textContent && textContent.type === 'text') {
          finalResponse = textContent.text || '';
        }
        conversationHistory.push({
          role: 'assistant',
          content: finalResponse,
        });
        break;
      }

      if (response.stop_reason === 'tool_use') {
        // Extract tool uses
        const toolUses = response.content.filter(
          (c) => c.type === 'tool_use'
        );

        // Add assistant message with tool uses
        messages.push({
          role: 'assistant',
          content: response.content,
        });

        // Execute each tool call through MCP
        const toolResults: Array<any> = [];

        for (const toolUse of toolUses) {
          if (toolUse.type !== 'tool_use') continue;

          const functionName = toolUse.name;
          const functionArgs = toolUse.input;

          // Track the tool call
          toolCalls.push({
            name: functionName,
            arguments: functionArgs,
            id: toolUse.id,
          });

          // Call the tool through MCP
          const result = await mcp.callTool(functionName, functionArgs);

          // Extract text from MCP result
          let resultText = '';
          if (result.content && Array.isArray(result.content)) {
            resultText = result.content
              .map((item: any) =>
                item.type === 'text' ? item.text : JSON.stringify(item)
              )
              .join('\n');
          } else {
            resultText = JSON.stringify(result);
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: resultText,
          });

          conversationHistory.push({
            role: 'tool',
            content: resultText,
          });
        }

        // Add tool results to messages
        messages.push({
          role: 'user',
          content: toolResults,
        });
      } else if (response.stop_reason === 'max_tokens') {
        throw new Error('Response exceeded max tokens');
      } else {
        // Unknown stop reason or max_tokens
        const textContent = response.content.find(
          (c) => c.type === 'text'
        );
        if (textContent && textContent.type === 'text') {
          finalResponse = textContent.text || '';
        }
        conversationHistory.push({
          role: 'assistant',
          content: finalResponse,
        });
        break;
      }
    }

    return {
      success: true,
      toolCalls,
      response: finalResponse,
      conversationHistory,
    };
  } catch (error) {
    return {
      success: false,
      toolCalls: [],
      error:
        error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}
