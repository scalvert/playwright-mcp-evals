/**
 * OpenAI Agents SDK integration for LLM host simulation
 *
 * Uses @openai/agents with native MCP support to test servers through
 * actual LLM-driven tool selection and invocation.
 */

import type { MCPFixtureApi } from '../../mcp/fixtures/mcpFixture.js';
import type {
  LLMHostConfig,
  LLMHostSimulationResult,
  LLMToolCall,
} from './llmHostTypes.js';

// Note: We don't pre-check for SDK availability anymore
// Instead, we let the dynamic import fail with a clear error message

/**
 * Simulates an LLM host using OpenAI Agents SDK with MCP support
 *
 * @param mcp - MCP fixture API (contains the client we're testing)
 * @param scenario - Natural language prompt
 * @param config - LLM host configuration
 * @returns Simulation result
 */
export async function simulateOpenAIHost(
  mcp: MCPFixtureApi,
  scenario: string,
  config: LLMHostConfig
): Promise<LLMHostSimulationResult> {
  try {
    // Dynamic imports for optional dependencies
    let Agent, OpenAI;

    try {
      const agentsModule = await import('@openai/agents');
      Agent = agentsModule.Agent;
    } catch (error) {
      throw new Error(
        'OpenAI Agents SDK is not installed. Install it with: npm install @openai/agents'
      );
    }

    try {
      const openaiModule = await import('openai');
      OpenAI = openaiModule.OpenAI;
    } catch (error) {
      throw new Error(
        'OpenAI SDK is not installed. Install it with: npm install openai'
      );
    }

    // Get API key from environment
    const apiKeyEnvVar = config.apiKeyEnvVar || 'OPENAI_API_KEY';
    const apiKey = process.env[apiKeyEnvVar];

    if (!apiKey) {
      throw new Error(
        `OpenAI API key not found in environment variable ${apiKeyEnvVar}`
      );
    }

    // Create OpenAI client
    const openai = new OpenAI({ apiKey });

    // Get MCP client configuration from the fixture
    // The MCP client is already connected by the Playwright fixture
    const client = mcp.client;

    // Get server info to create MCP server configuration
    const serverInfo = mcp.getServerInfo();

    // Note: The OpenAI Agents SDK expects an MCP server configuration
    // We need to extract the connection details from our existing client
    // This is a bit tricky because the SDK wants to create its own connection

    // For now, we'll use a workaround: list the tools and convert them
    // to OpenAI function calling format, then track which tools were called
    const tools = await mcp.listTools();

    // Convert MCP tools to OpenAI function calling format
    const openaiTools = tools.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description || '',
        parameters: tool.inputSchema || {},
      },
    }));

    // Track tool calls
    const toolCalls: LLMToolCall[] = [];

    // Create a simple agentic loop
    const model = config.model || 'gpt-4o';
    const maxIterations = config.maxToolCalls || 10;

    // Conversation history in OpenAI's exact format
    // Using any[] to allow the full flexibility of OpenAI message types
    const conversationHistory: any[] = [
      {
        role: 'user',
        content: scenario,
      },
    ];

    let finalResponse = '';

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Call OpenAI with tools
      const response = await openai.chat.completions.create({
        model,
        messages: conversationHistory,
        tools: openaiTools,
        temperature: config.temperature ?? 0.0,
        max_tokens: config.maxTokens,
      });

      const message = response.choices[0]?.message;

      if (!message) {
        throw new Error('No response from OpenAI');
      }

      // Check if the assistant wants to call tools
      if (message.tool_calls && message.tool_calls.length > 0) {
        // Add assistant message WITH tool_calls to history
        // This is required by OpenAI's API
        conversationHistory.push({
          role: 'assistant',
          content: message.content || null,
          tool_calls: message.tool_calls,
        });

        // Execute each tool call through MCP
        for (const toolCall of message.tool_calls) {
          const functionName = toolCall.function.name;
          const functionArgs = JSON.parse(toolCall.function.arguments);

          // Track the tool call
          toolCalls.push({
            name: functionName,
            arguments: functionArgs,
            id: toolCall.id,
          });

          // Call the tool through MCP
          const result = await mcp.callTool(functionName, functionArgs);

          // Extract text from MCP result
          let resultText = '';
          if (result.structuredContent) {
            // New format: { content: "text" }
            if (typeof result.structuredContent === 'object' && 'content' in result.structuredContent) {
              resultText = String(result.structuredContent.content);
            } else {
              resultText = JSON.stringify(result.structuredContent);
            }
          } else if (result.content && Array.isArray(result.content)) {
            // Old format: [{ type: "text", text: "..." }]
            resultText = result.content
              .map((item: any) =>
                item.type === 'text' ? item.text : JSON.stringify(item)
              )
              .join('\n');
          } else {
            resultText = JSON.stringify(result);
          }

          // Add tool result to conversation with tool_call_id
          // This is REQUIRED by OpenAI's API to match the tool call
          conversationHistory.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: resultText,
          });
        }
      } else {
        // No more tool calls, we have the final response
        finalResponse = message.content || '';
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
