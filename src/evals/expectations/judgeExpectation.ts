import type { EvalCase } from '../datasetTypes.js';
import type {
  EvalExpectation,
  EvalExpectationResult,
  EvalExpectationContext,
} from '../evalRunner.js';

/**
 * Judge configurations mapped by ID
 */
export interface JudgeConfigs {
  [configId: string]: {
    /**
     * The rubric/prompt to use for judging
     */
    rubric: string;

    /**
     * Reference/expected value to compare against
     */
    reference?: unknown;

    /**
     * Minimum score threshold for passing (0-1)
     * @default 0.7
     */
    passingThreshold?: number;
  };
}

/**
 * Creates an LLM-as-a-judge expectation
 *
 * Uses an LLM to semantically evaluate the tool response
 *
 * @param judgeConfigs - Judge configuration by ID
 * @returns Expectation function
 */
export function createJudgeExpectation(
  judgeConfigs: JudgeConfigs
): EvalExpectation {
  return async (
    context: EvalExpectationContext,
    evalCase: EvalCase,
    response: unknown
  ): Promise<EvalExpectationResult> => {
    // Skip if no judge config is specified
    if (!evalCase.judgeConfigId) {
      return {
        pass: true,
        details: 'No judgeConfigId defined, skipping',
      };
    }

    // Skip if no judge client is available
    if (!context.judgeClient) {
      return {
        pass: false,
        details: 'No judgeClient available in context',
      };
    }

    // Get judge config
    const config = judgeConfigs[evalCase.judgeConfigId];
    if (!config) {
      return {
        pass: false,
        details: `Judge config "${evalCase.judgeConfigId}" not found`,
      };
    }

    // Use expected exact as reference if available, otherwise use config reference
    const reference =
      evalCase.expectedExact !== undefined
        ? evalCase.expectedExact
        : config.reference;

    // Evaluate using judge
    try {
      const result = await context.judgeClient.evaluate(
        response,
        reference ?? null,
        config.rubric
      );

      const threshold = config.passingThreshold ?? 0.7;
      const score = result.score ?? (result.pass ? 1.0 : 0.0);
      const pass = score >= threshold;

      return {
        pass,
        details: [
          `Judge: ${pass ? 'PASS' : 'FAIL'}`,
          `Score: ${score.toFixed(2)} (threshold: ${threshold})`,
          result.reasoning ? `Reasoning: ${result.reasoning}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      };
    } catch (error) {
      return {
        pass: false,
        details: `Judge evaluation failed: ${String(error)}`,
      };
    }
  };
}
