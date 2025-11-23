import type { EvalCase } from '../datasetTypes.js';
import type {
  EvalExpectation,
  EvalExpectationResult,
  EvalExpectationContext,
} from '../evalRunner.js';
import { extractTextFromResponse, findMissingSubstrings } from './textUtils.js';

/**
 * Options for text contains expectation
 */
export interface TextContainsExpectationOptions {
  /**
   * Whether to do case-sensitive matching
   * @default true
   */
  caseSensitive?: boolean;
}

/**
 * Creates a text contains expectation
 *
 * Validates that the response text contains all expected substrings.
 * Supports both single strings and arrays of strings.
 *
 * @param options - Options for text matching
 * @returns Expectation function
 *
 * @example
 * ```typescript
 * // In your eval dataset:
 * {
 *   "id": "markdown-response",
 *   "toolName": "get_weather",
 *   "args": { "city": "London" },
 *   "expectedTextContains": ["## Weather Report", "Temperature:", "London"]
 * }
 *
 * // In your test:
 * const expectations = {
 *   textContains: createTextContainsExpectation({ caseSensitive: false })
 * };
 * ```
 */
export function createTextContainsExpectation(
  options: TextContainsExpectationOptions = {}
): EvalExpectation {
  const { caseSensitive = true } = options;

  return async (
    _context: EvalExpectationContext,
    evalCase: EvalCase,
    response: unknown
  ): Promise<EvalExpectationResult> => {
    // Skip if no expected value is defined
    if (evalCase.expectedTextContains === undefined) {
      return {
        pass: true,
        details: 'No expectedTextContains defined, skipping',
      };
    }

    // Extract text from response
    const text = extractTextFromResponse(response);

    // Normalize to array
    const expectedSubstrings = Array.isArray(evalCase.expectedTextContains)
      ? evalCase.expectedTextContains
      : [evalCase.expectedTextContains];

    // Find missing substrings
    const missing = findMissingSubstrings(
      text,
      expectedSubstrings,
      caseSensitive
    );

    // Build result
    if (missing.length === 0) {
      return {
        pass: true,
        details:
          expectedSubstrings.length === 1
            ? 'Text contains expected substring'
            : `Text contains all ${expectedSubstrings.length} expected substrings`,
      };
    }

    return {
      pass: false,
      details: `Missing ${missing.length} substring(s): ${missing.map((s) => `"${s}"`).join(', ')}\n\nResponse text:\n${text.slice(0, 500)}${text.length > 500 ? '...' : ''}`,
    };
  };
}
