import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to ensure mock is available when module loads
const mocks = vi.hoisted(() => {
  const mockCreate = vi.fn();
  return {
    mockCreate,
    MockAnthropic: vi.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    })),
  };
});

// Mock the anthropic module using the hoisted mocks
vi.mock('@anthropic-ai/sdk', () => ({
  default: mocks.MockAnthropic,
}));

// Now import after mocks are set
import { createAnthropicJudge } from './anthropicJudge.js';

describe('anthropicJudge', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup the mock implementation after clear
    mocks.MockAnthropic.mockImplementation(() => ({
      messages: {
        create: mocks.mockCreate,
      },
    }));
    process.env = { ...originalEnv };
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('createAnthropicJudge', () => {
    it('throws error when API key is not found', () => {
      delete process.env.ANTHROPIC_API_KEY;

      expect(() => {
        createAnthropicJudge({ provider: 'anthropic' });
      }).toThrow('Anthropic API key not found in environment variable: ANTHROPIC_API_KEY');
    });

    it('throws error for custom API key env var when not found', () => {
      delete process.env.ANTHROPIC_API_KEY;

      expect(() => {
        createAnthropicJudge({
          provider: 'anthropic',
          apiKeyEnvVar: 'CUSTOM_ANTHROPIC_KEY',
        });
      }).toThrow('Anthropic API key not found in environment variable: CUSTOM_ANTHROPIC_KEY');
    });

    it('uses custom API key env var when provided', () => {
      process.env.CUSTOM_ANTHROPIC_KEY = 'custom-key';

      const judge = createAnthropicJudge({
        provider: 'anthropic',
        apiKeyEnvVar: 'CUSTOM_ANTHROPIC_KEY',
      });

      expect(judge).toBeDefined();
      expect(typeof judge.evaluate).toBe('function');
    });

    it('creates judge with default configuration', () => {
      const judge = createAnthropicJudge({ provider: 'anthropic' });

      expect(judge).toBeDefined();
      expect(typeof judge.evaluate).toBe('function');
    });
  });

  describe('evaluate', () => {
    let judge: ReturnType<typeof createAnthropicJudge>;

    beforeEach(() => {
      judge = createAnthropicJudge({ provider: 'anthropic' });
    });

    it('evaluates candidate against rubric successfully', async () => {
      mocks.mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              pass: true,
              score: 0.85,
              reasoning: 'Good semantic match',
            }),
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
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              pass: true,
              score: 0.9,
              reasoning: 'Meets criteria',
            }),
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

    it('handles markdown code block wrapped JSON', async () => {
      mocks.mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '```json\n{"pass": true, "score": 0.8, "reasoning": "Good"}\n```',
          },
        ],
      });

      const result = await judge.evaluate('candidate', null, 'rubric');

      expect(result.pass).toBe(true);
      expect(result.score).toBe(0.8);
    });

    it('handles plain code block wrapped JSON', async () => {
      mocks.mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: '```\n{"pass": true, "score": 0.75}\n```',
          },
        ],
      });

      const result = await judge.evaluate('candidate', null, 'rubric');

      expect(result.pass).toBe(true);
      expect(result.score).toBe(0.75);
    });

    it('handles object candidate values', async () => {
      mocks.mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              pass: true,
              score: 0.75,
              reasoning: 'Correct structure',
            }),
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
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              score: 0.5,
              reasoning: 'Partial match',
            }),
          },
        ],
      });

      const result = await judge.evaluate('candidate', 'reference', 'rubric');

      expect(result.pass).toBe(false);
    });

    it('throws error when response has no text content', async () => {
      mocks.mockCreate.mockResolvedValue({
        content: [
          {
            type: 'image',
            source: {},
          },
        ],
      });

      await expect(
        judge.evaluate('candidate', 'reference', 'rubric')
      ).rejects.toThrow('Anthropic judge evaluation failed: No text content in Anthropic response');
    });

    it('throws error when API call fails', async () => {
      mocks.mockCreate.mockRejectedValue(new Error('Rate limit exceeded'));

      await expect(
        judge.evaluate('candidate', 'reference', 'rubric')
      ).rejects.toThrow('Anthropic judge evaluation failed: Rate limit exceeded');
    });

    it('throws error when JSON parsing fails', async () => {
      mocks.mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'not valid json',
          },
        ],
      });

      await expect(
        judge.evaluate('candidate', 'reference', 'rubric')
      ).rejects.toThrow('Anthropic judge evaluation failed:');
    });

    it('uses configured model', async () => {
      const customJudge = createAnthropicJudge({
        provider: 'anthropic',
        model: 'claude-3-opus-20240229',
      });

      mocks.mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ pass: true, score: 0.9 }),
          },
        ],
      });

      await customJudge.evaluate('candidate', null, 'rubric');

      expect(mocks.mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-opus-20240229',
        })
      );
    });

    it('uses configured temperature', async () => {
      const customJudge = createAnthropicJudge({
        provider: 'anthropic',
        temperature: 0.3,
      });

      mocks.mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ pass: true, score: 0.9 }),
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
      const customJudge = createAnthropicJudge({
        provider: 'anthropic',
        maxTokens: 2000,
      });

      mocks.mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ pass: true, score: 0.9 }),
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

    it('includes system prompt with evaluation instructions', async () => {
      mocks.mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ pass: true, score: 0.9 }),
          },
        ],
      });

      await judge.evaluate('candidate', null, 'rubric');

      expect(mocks.mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('expert evaluator'),
        })
      );
      expect(mocks.mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          system: expect.stringContaining('JSON format'),
        })
      );
    });

    it('uses default model when not specified', async () => {
      mocks.mockCreate.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({ pass: true, score: 0.9 }),
          },
        ],
      });

      await judge.evaluate('candidate', null, 'rubric');

      expect(mocks.mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-3-5-sonnet-20241022',
        })
      );
    });
  });
});
