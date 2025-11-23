import OpenAI from 'openai';
import type {
  LLMJudgeClient,
  LLMJudgeResult,
  LLMJudgeConfig,
} from './judgeTypes.js';

/**
 * Creates an OpenAI-based LLM judge client
 *
 * @param config - Judge configuration
 * @returns OpenAI judge client
 */
export function createOpenAIJudge(config: LLMJudgeConfig): LLMJudgeClient {
  // Get API key from environment
  const apiKeyEnvVar = config.apiKeyEnvVar ?? 'OPENAI_API_KEY';
  const apiKey = process.env[apiKeyEnvVar];

  if (!apiKey) {
    throw new Error(
      `OpenAI API key not found in environment variable: ${apiKeyEnvVar}`
    );
  }

  const client = new OpenAI({ apiKey });
  const model = config.model ?? 'gpt-4';
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
        const response = await client.chat.completions.create({
          model,
          temperature,
          max_tokens: maxTokens,
          messages: [
            {
              role: 'system',
              content:
                'You are an expert evaluator. Evaluate the candidate response based on the rubric provided. ' +
                'Respond in JSON format with: {"pass": boolean, "score": number (0-1), "reasoning": string}',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
          throw new Error('No content in OpenAI response');
        }

        // Parse JSON response
        const result = JSON.parse(content) as {
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
          `OpenAI judge evaluation failed: ${error instanceof Error ? error.message : String(error)}`
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
