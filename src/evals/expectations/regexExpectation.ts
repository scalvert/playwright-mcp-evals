import type { EvalCase } from '../datasetTypes.js';
import type {
  EvalExpectation,
  EvalExpectationResult,
  EvalExpectationContext,
} from '../evalRunner.js';
import { extractTextFromResponse, findFailedPatterns } from './textUtils.js';

/**
 * Creates a regex pattern expectation
 *
 * Validates that the response text matches all expected regex patterns.
 * Supports both single patterns and arrays of patterns.
 *
 * @returns Expectation function
 *
 * @example
 * ```typescript
 * // In your eval dataset:
 * {
 *   "id": "weather-format",
 *   "toolName": "get_weather",
 *   "args": { "city": "London" },
 *   "expectedRegex": [
 *     "^## Weather",
 *     "Temperature: \\d+°[CF]",
 *     "Conditions?: (Sunny|Cloudy|Rainy|Snowy)"
 *   ]
 * }
 *
 * // In your test:
 * const expectations = {
 *   regex: createRegexExpectation()
 * };
 * ```
 */
export function createRegexExpectation(): EvalExpectation {
  return async (
    _context: EvalExpectationContext,
    evalCase: EvalCase,
    response: unknown
  ): Promise<EvalExpectationResult> => {
    // Skip if no expected patterns are defined
    if (evalCase.expectedRegex === undefined) {
      return {
        pass: true,
        details: 'No expectedRegex defined, skipping',
      };
    }

    // Extract text from response
    const text = extractTextFromResponse(response);

    // Normalize to array
    const patterns = Array.isArray(evalCase.expectedRegex)
      ? evalCase.expectedRegex
      : [evalCase.expectedRegex];

    // Find failed patterns
    const failed = findFailedPatterns(text, patterns);

    // Build result
    if (failed.length === 0) {
      return {
        pass: true,
        details:
          patterns.length === 1
            ? 'Text matches expected pattern'
            : `Text matches all ${patterns.length} expected patterns`,
      };
    }

    // Build detailed error message
    const failureDetails = failed
      .map((pattern) => {
        try {
          // Try to compile regex to check if it's valid
          new RegExp(pattern);
          return `  - Pattern: /${pattern}/`;
        } catch (error) {
          return `  - Invalid pattern: /${pattern}/ (${error instanceof Error ? error.message : 'syntax error'})`;
        }
      })
      .join('\n');

    return {
      pass: false,
      details: `Failed to match ${failed.length} pattern(s):\n${failureDetails}\n\nResponse text:\n${text.slice(0, 500)}${text.length > 500 ? '...' : ''}`,
    };
  };
}
