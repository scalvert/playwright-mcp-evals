import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMJudgeClient,
  LLMJudgeResult,
  LLMJudgeConfig,
} from './judgeTypes.js';

/**
 * Creates an Anthropic-based LLM judge client
 *
 * @param config - Judge configuration
 * @returns Anthropic judge client
 */
export function createAnthropicJudge(config: LLMJudgeConfig): LLMJudgeClient {
  // Get API key from environment
  const apiKeyEnvVar = config.apiKeyEnvVar ?? 'ANTHROPIC_API_KEY';
  const apiKey = process.env[apiKeyEnvVar];

  if (!apiKey) {
    throw new Error(
      `Anthropic API key not found in environment variable: ${apiKeyEnvVar}`
    );
  }

  const client = new Anthropic({ apiKey });
  const model = config.model ?? 'claude-3-5-sonnet-20241022';
  const temperature = config.temperature ?? 0.0;
  const maxTokens = config.maxTokens ?? 1000;

  return {
    async evaluate(
      candidate: unknown,
      reference: unknown,
      rubric: string
    ): Promise<LLMJudgeResult> {
      // Build prompt
      const prompt = buildJudgePrompt(candidate, reference, rubric);

      try {
        const response = await client.messages.create({
          model,
          max_tokens: maxTokens,
          temperature,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
          system:
            'You are an expert evaluator. Evaluate the candidate response based on the rubric provided. ' +
            'Respond in JSON format with: {"pass": boolean, "score": number (0-1), "reasoning": string}',
        });

        // Extract text content
        const textContent = response.content.find((c) => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
          throw new Error('No text content in Anthropic response');
        }

        // Parse JSON response (may be wrapped in markdown code blocks)
        let jsonText = textContent.text.trim();
        if (jsonText.startsWith('```json')) {
          jsonText = jsonText.slice(7);
        }
        if (jsonText.startsWith('```')) {
          jsonText = jsonText.slice(3);
        }
        if (jsonText.endsWith('```')) {
          jsonText = jsonText.slice(0, -3);
        }
        jsonText = jsonText.trim();

        const result = JSON.parse(jsonText) as {
          pass?: boolean;
          score?: number;
          reasoning?: string;
        };

        return {
          pass: result.pass ?? false,
          score: result.score,
          reasoning: result.reasoning,
        };
      } catch (error) {
        throw new Error(
          `Anthropic judge evaluation failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
  };
}

/**
 * Builds the judge prompt
 */
function buildJudgePrompt(
  candidate: unknown,
  reference: unknown,
  rubric: string
): string {
  const parts: Array<string> = [];

  parts.push('# Evaluation Task\n');
  parts.push(rubric);
  parts.push('\n\n# Candidate Response\n');
  parts.push(
    typeof candidate === 'string'
      ? candidate
      : JSON.stringify(candidate, null, 2)
  );

  if (reference !== null && reference !== undefined) {
    parts.push('\n\n# Reference Response\n');
    parts.push(
      typeof reference === 'string'
        ? reference
        : JSON.stringify(reference, null, 2)
    );
  }

  parts.push(
    '\n\n# Instructions\n' +
      'Evaluate the candidate response based on the rubric. ' +
      (reference !== null && reference !== undefined
        ? 'Compare it against the reference response if helpful. '
        : '') +
      'Respond with JSON containing "pass" (boolean), "score" (0-1), and "reasoning" (string).'
  );

  return parts.join('');
}
