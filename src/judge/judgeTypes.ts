/**
 * Supported LLM provider types
 */
export type LLMProviderKind = 'openai' | 'anthropic' | 'custom-http';

/**
 * Configuration for an LLM judge
 */
export interface LLMJudgeConfig {
  /**
   * LLM provider to use
   */
  provider: LLMProviderKind;

  /**
   * Environment variable name containing the API key
   * @default 'OPENAI_API_KEY' for openai, 'ANTHROPIC_API_KEY' for anthropic
   */
  apiKeyEnvVar?: string;

  /**
   * Model to use for judging
   * @default 'gpt-4' for openai, 'claude-3-5-sonnet-20241022' for anthropic
   */
  model?: string;

  /**
   * Custom endpoint URL (for custom-http provider)
   */
  endpointUrl?: string;

  /**
   * Maximum tokens for response
   */
  maxTokens?: number;

  /**
   * Temperature (0-1, lower is more deterministic)
   * @default 0.0
   */
  temperature?: number;
}

/**
 * Result from LLM judge evaluation
 */
export interface LLMJudgeResult {
  /**
   * Whether the evaluation passed
   */
  pass: boolean;

  /**
   * Numeric score (0-1, where 1 is best)
   */
  score?: number;

  /**
   * Reasoning/explanation from the judge
   */
  reasoning?: string;
}

/**
 * LLM judge client interface
 */
export interface LLMJudgeClient {
  /**
   * Evaluates a candidate response against a reference
   *
   * @param candidate - The actual response to evaluate
   * @param reference - The expected/reference response (or null if not applicable)
   * @param rubric - The evaluation rubric/criteria
   * @returns Evaluation result
   */
  evaluate(
    candidate: unknown,
    reference: unknown,
    rubric: string
  ): Promise<LLMJudgeResult>;
}
