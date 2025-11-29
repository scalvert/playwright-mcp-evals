import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to ensure mock is available when module loads
const mocks = vi.hoisted(() => {
  const mockCreate = vi.fn();
  return {
    mockCreate,
    MockOpenAI: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  };
});

// Mock the openai module using the hoisted mocks
vi.mock('openai', () => ({
  default: mocks.MockOpenAI,
}));

// Now import after mocks are set
import { createOpenAIJudge } from './openaiJudge.js';

describe('openaiJudge', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup the mock implementation after clear
    mocks.MockOpenAI.mockImplementation(() => ({
      chat: {
        completions: {
          create: mocks.mockCreate,
        },
      },
    }));
    process.env = { ...originalEnv };
    process.env.OPENAI_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('createOpenAIJudge', () => {
    it('throws error when API key is not found', () => {
      delete process.env.OPENAI_API_KEY;

      expect(() => {
        createOpenAIJudge({ provider: 'openai' });
      }).toThrow('OpenAI API key not found in environment variable: OPENAI_API_KEY');
    });

    it('throws error for custom API key env var when not found', () => {
      delete process.env.OPENAI_API_KEY;

      expect(() => {
        createOpenAIJudge({
          provider: 'openai',
          apiKeyEnvVar: 'CUSTOM_OPENAI_KEY',
        });
      }).toThrow('OpenAI API key not found in environment variable: CUSTOM_OPENAI_KEY');
    });

    it('uses custom API key env var when provided', () => {
      process.env.CUSTOM_OPENAI_KEY = 'custom-key';

      const judge = createOpenAIJudge({
        provider: 'openai',
        apiKeyEnvVar: 'CUSTOM_OPENAI_KEY',
      });

      expect(judge).toBeDefined();
      expect(typeof judge.evaluate).toBe('function');
    });

    it('creates judge with default configuration', () => {
      const judge = createOpenAIJudge({ provider: 'openai' });

      expect(judge).toBeDefined();
      expect(typeof judge.evaluate).toBe('function');
    });
  });

  describe('evaluate', () => {
    let judge: ReturnType<typeof createOpenAIJudge>;

    beforeEach(() => {
      judge = createOpenAIJudge({ provider: 'openai' });
    });

    it('evaluates candidate against rubric successfully', async () => {
      mocks.mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                pass: true,
                score: 0.85,
                reasoning: 'Good semantic match',
              }),
            },
          },
        ],
      });

      const result = await judge.evaluate(
        'Candidate response',
        'Reference response',
        'Check if responses match semantically'
      );

      expect(result.pass).toBe(true);
      expect(result.score).toBe(0.85);
      expect(result.reasoning).toBe('Good semantic match');
    });

    it('evaluates without reference when null', async () => {
      mocks.mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                pass: true,
                score: 0.9,
                reasoning: 'Meets criteria',
              }),
            },
          },
        ],
      });

      const result = await judge.evaluate(
        'Candidate response',
        null,
        'Evaluate the response quality'
      );

      expect(result.pass).toBe(true);
      expect(result.score).toBe(0.9);

      // Check that the prompt doesn't include reference section
      const callArgs = mocks.mockCreate.mock.calls[0]![0];
      const userMessage = callArgs.messages.find(
        (m: { role: string }) => m.role === 'user'
      );
      expect(userMessage.content).not.toContain('# Reference Response');
    });

    it('handles object candidate values', async () => {
      mocks.mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                pass: true,
                score: 0.75,
                reasoning: 'Correct structure',
              }),
            },
          },
        ],
      });

      const candidate = { weather: 'sunny', temperature: 20 };
      await judge.evaluate(candidate, null, 'Evaluate weather data');

      const callArgs = mocks.mockCreate.mock.calls[0]![0];
      const userMessage = callArgs.messages.find(
        (m: { role: string }) => m.role === 'user'
      );
      expect(userMessage.content).toContain('"weather": "sunny"');
    });

    it('handles missing pass field with default false', async () => {
      mocks.mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({
                score: 0.5,
                reasoning: 'Partial match',
              }),
            },
          },
        ],
      });

      const result = await judge.evaluate('candidate', 'reference', 'rubric');

      expect(result.pass).toBe(false);
    });

    it('throws error when response has no content', async () => {
      mocks.mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      });

      await expect(
        judge.evaluate('candidate', 'reference', 'rubric')
      ).rejects.toThrow('OpenAI judge evaluation failed: No content in OpenAI response');
    });

    it('throws error when API call fails', async () => {
      mocks.mockCreate.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(
        judge.evaluate('candidate', 'reference', 'rubric')
      ).rejects.toThrow('OpenAI judge evaluation failed: Rate limit exceeded');
    });

    it('throws error when JSON parsing fails', async () => {
      mocks.mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: 'not valid json',
            },
          },
        ],
      });

      await expect(
        judge.evaluate('candidate', 'reference', 'rubric')
      ).rejects.toThrow('OpenAI judge evaluation failed:');
    });

    it('uses configured model', async () => {
      const customJudge = createOpenAIJudge({
        provider: 'openai',
        model: 'gpt-4-turbo',
      });

      mocks.mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({ pass: true, score: 0.9 }),
            },
          },
        ],
      });

      await customJudge.evaluate('candidate', null, 'rubric');

      expect(mocks.mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4-turbo',
        })
      );
    });

    it('uses configured temperature', async () => {
      const customJudge = createOpenAIJudge({
        provider: 'openai',
        temperature: 0.3,
      });

      mocks.mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({ pass: true, score: 0.9 }),
            },
          },
        ],
      });

      await customJudge.evaluate('candidate', null, 'rubric');

      expect(mocks.mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.3,
        })
      );
    });

    it('uses configured maxTokens', async () => {
      const customJudge = createOpenAIJudge({
        provider: 'openai',
        maxTokens: 2000,
      });

      mocks.mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({ pass: true, score: 0.9 }),
            },
          },
        ],
      });

      await customJudge.evaluate('candidate', null, 'rubric');

      expect(mocks.mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 2000,
        })
      );
    });

    it('uses json_object response format', async () => {
      mocks.mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({ pass: true, score: 0.9 }),
            },
          },
        ],
      });

      await judge.evaluate('candidate', null, 'rubric');

      expect(mocks.mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          response_format: { type: 'json_object' },
        })
      );
    });

    it('includes system message with evaluation instructions', async () => {
      mocks.mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify({ pass: true, score: 0.9 }),
            },
          },
        ],
      });

      await judge.evaluate('candidate', null, 'rubric');

      const callArgs = mocks.mockCreate.mock.calls[0]![0];
      const systemMessage = callArgs.messages.find(
        (m: { role: string }) => m.role === 'system'
      );
      expect(systemMessage.content).toContain('expert evaluator');
      expect(systemMessage.content).toContain('JSON format');
    });
  });
});
