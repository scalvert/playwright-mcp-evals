import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MCPFixtureApi } from '../../mcp/fixtures/mcpFixture.js';
import type { LLMAdapter } from './adapter.js';

// We need to mock the orchestrator since it does the actual work
vi.mock('./orchestrator.js', () => ({
  runSimulation: vi.fn(),
}));

// Import after mocks
import {
  simulateLLMHost,
  isProviderAvailable,
  getMissingDependencyMessage,
  registerAdapter,
  getAdapter,
  hasAdapter,
} from './llmHostSimulation.js';
import { runSimulation } from './orchestrator.js';

// Create mock MCP fixture
function createMockMCP(): MCPFixtureApi {
  return {
    client: {} as MCPFixtureApi['client'],
    authType: 'none',
    project: 'test-project',
    listTools: vi.fn().mockResolvedValue([]),
    callTool: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Tool result' }],
    }),
    getServerInfo: vi.fn().mockReturnValue({ name: 'test', version: '1.0.0' }),
  };
}

// Create mock adapter
function createMockAdapter(): LLMAdapter {
  return {
    provider: 'openai',
    createClient: vi.fn().mockResolvedValue({}),
    formatTools: vi.fn().mockReturnValue([]),
    chat: vi.fn().mockResolvedValue({
      wantsToolCalls: false,
      toolCalls: [],
      textContent: 'Response',
      rawResponse: {},
    }),
    createUserMessage: vi.fn().mockReturnValue({}),
    createAssistantMessage: vi.fn().mockReturnValue({}),
    createToolResultMessage: vi.fn().mockReturnValue({}),
  };
}

describe('llmHostSimulation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('simulateLLMHost', () => {
    it('calls runSimulation with correct parameters', async () => {
      const mockMCP = createMockMCP();
      const mockResult = {
        success: true,
        toolCalls: [{ name: 'test_tool', arguments: {}, id: '1' }],
        finalResponse: 'Done',
        turns: [],
      };
      vi.mocked(runSimulation).mockResolvedValue(mockResult);

      const result = await simulateLLMHost(mockMCP, 'Test scenario', {
        provider: 'openai',
        model: 'gpt-4o',
      });

      expect(runSimulation).toHaveBeenCalled();
      expect(result).toBe(mockResult);
    });

    it('uses default retry configuration', async () => {
      const mockMCP = createMockMCP();
      vi.mocked(runSimulation).mockResolvedValue({
        success: true,
        toolCalls: [],
        response: 'Done',
      });

      await simulateLLMHost(mockMCP, 'Test scenario', {
        provider: 'openai',
        model: 'gpt-4o',
      });

      expect(runSimulation).toHaveBeenCalledWith(
        expect.anything(),
        mockMCP,
        'Test scenario',
        { provider: 'openai', model: 'gpt-4o' },
        {
          retry: {
            maxAttempts: 3,
            baseDelayMs: 1000,
            maxDelayMs: 30000,
          },
        }
      );
    });
  });

  describe('isProviderAvailable', () => {
    it('returns true for registered providers', () => {
      // openai and anthropic are registered by default
      expect(isProviderAvailable('openai')).toBe(true);
      expect(isProviderAvailable('anthropic')).toBe(true);
    });

    it('returns false for unknown providers', () => {
      // @ts-expect-error - testing invalid provider
      expect(isProviderAvailable('unknown')).toBe(false);
    });
  });

  describe('getMissingDependencyMessage', () => {
    it('returns correct message for openai', () => {
      const message = getMissingDependencyMessage('openai');
      expect(message).toBe(
        'OpenAI SDK is not installed. Install it with: npm install openai'
      );
    });

    it('returns correct message for anthropic', () => {
      const message = getMissingDependencyMessage('anthropic');
      expect(message).toBe(
        'Anthropic SDK is not installed. Install it with: npm install @anthropic-ai/sdk'
      );
    });

    it('returns generic message for unknown providers', () => {
      // @ts-expect-error - testing invalid provider
      const message = getMissingDependencyMessage('unknown');
      expect(message).toBe('Unknown provider: unknown');
    });
  });

  describe('adapter registry', () => {
    it('allows registering custom adapters', () => {
      const customAdapter = createMockAdapter();
      // @ts-expect-error - registering with custom provider name
      registerAdapter('custom', () => customAdapter);

      // @ts-expect-error - checking custom provider
      expect(hasAdapter('custom')).toBe(true);
    });

    it('getAdapter returns registered adapter', () => {
      const adapter = getAdapter('openai');
      expect(adapter.provider).toBe('openai');
    });

    it('getAdapter throws for unregistered provider', () => {
      expect(() => {
        // @ts-expect-error - testing invalid provider
        getAdapter('nonexistent');
      }).toThrow('No adapter registered for provider: nonexistent');
    });

    it('hasAdapter returns false for unregistered provider', () => {
      // @ts-expect-error - testing invalid provider
      expect(hasAdapter('nonexistent')).toBe(false);
    });
  });
});

describe('adapter interface contract', () => {
  it('openai adapter implements required methods', () => {
    const adapter = getAdapter('openai');

    expect(typeof adapter.createClient).toBe('function');
    expect(typeof adapter.formatTools).toBe('function');
    expect(typeof adapter.chat).toBe('function');
    expect(typeof adapter.createUserMessage).toBe('function');
    expect(typeof adapter.createAssistantMessage).toBe('function');
    expect(typeof adapter.createToolResultMessage).toBe('function');
  });

  it('anthropic adapter implements required methods', () => {
    const adapter = getAdapter('anthropic');

    expect(typeof adapter.createClient).toBe('function');
    expect(typeof adapter.formatTools).toBe('function');
    expect(typeof adapter.chat).toBe('function');
    expect(typeof adapter.createUserMessage).toBe('function');
    expect(typeof adapter.createAssistantMessage).toBe('function');
    expect(typeof adapter.createToolResultMessage).toBe('function');
  });

  it('adapters format tools correctly', () => {
    const openaiAdapter = getAdapter('openai');
    const anthropicAdapter = getAdapter('anthropic');

    const mcpTools = [
      {
        name: 'test_tool',
        description: 'A test tool',
        inputSchema: {
          type: 'object' as const,
          properties: { arg: { type: 'string' } },
        },
      },
    ];

    const openaiFormatted = openaiAdapter.formatTools(mcpTools);
    const anthropicFormatted = anthropicAdapter.formatTools(mcpTools);

    expect(Array.isArray(openaiFormatted)).toBe(true);
    expect(Array.isArray(anthropicFormatted)).toBe(true);
    expect(openaiFormatted.length).toBe(1);
    expect(anthropicFormatted.length).toBe(1);
  });
});
