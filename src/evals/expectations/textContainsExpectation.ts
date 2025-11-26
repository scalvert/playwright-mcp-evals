/**
 * Text Contains Expectation
 *
 * Validates that the response text contains all expected substrings.
 */

import { createTextExpectation, type ValidationResult } from './createExpectation.js';
import { findMissingSubstrings } from './textUtils.js';

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
export const createTextContainsExpectation = createTextExpectation<
  string | string[],
  TextContainsExpectationOptions
>({
  name: 'textContains',

  getExpected: (evalCase) => evalCase.expectedTextContains,

  validate: (text, expected, options): ValidationResult => {
    const caseSensitive = options?.caseSensitive ?? true;

    // Normalize to array
    const substrings = Array.isArray(expected) ? expected : [expected];

    // Find missing substrings
    const missing = findMissingSubstrings(text, substrings, caseSensitive);

    if (missing.length === 0) {
      return {
        pass: true,
        details:
          substrings.length === 1
            ? 'Text contains expected substring'
            : `Text contains all ${substrings.length} expected substrings`,
      };
    }

    return {
      pass: false,
      details: `Missing ${missing.length} substring(s): ${missing.map((s) => `"${s}"`).join(', ')}\n\nResponse text:\n${text.slice(0, 500)}${text.length > 500 ? '...' : ''}`,
    };
  },
});
