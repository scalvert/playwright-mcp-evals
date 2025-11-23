import type { LLMJudgeClient, LLMJudgeConfig } from './judgeTypes.js';
import { createOpenAIJudge } from './openaiJudge.js';
import { createAnthropicJudge } from './anthropicJudge.js';

/**
 * Creates an LLM judge client based on configuration
 *
 * @param config - Judge configuration
 * @returns Judge client instance
 * @throws {Error} If provider is unsupported or configuration is invalid
 *
 * @example
 * // OpenAI judge
 * const judge = createLLMJudgeClient({
 *   provider: 'openai',
 *   model: 'gpt-4',
 * });
 *
 * @example
 * // Anthropic judge
 * const judge = createLLMJudgeClient({
 *   provider: 'anthropic',
 *   model: 'claude-3-5-sonnet-20241022',
 * });
 */
export function createLLMJudgeClient(config: LLMJudgeConfig): LLMJudgeClient {
  switch (config.provider) {
    case 'openai':
      return createOpenAIJudge(config);

    case 'anthropic':
      return createAnthropicJudge(config);

    case 'custom-http':
      throw new Error(
        'custom-http provider is not yet implemented. ' +
          'Please use "openai" or "anthropic" providers.'
      );

    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }
}
