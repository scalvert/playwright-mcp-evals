/**
 * Regex Expectation
 *
 * Validates that the response text matches all expected regex patterns.
 */

import { createTextExpectation, type ValidationResult } from './createExpectation.js';
import { findFailedPatterns } from './textUtils.js';

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
export const createRegexExpectation = createTextExpectation<string | string[]>({
  name: 'regex',

  getExpected: (evalCase) => evalCase.expectedRegex,

  validate: (text, expected): ValidationResult => {
    // Normalize to array
    const patterns = Array.isArray(expected) ? expected : [expected];

    // Find failed patterns
    const failed = findFailedPatterns(text, patterns);

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
  },
});
