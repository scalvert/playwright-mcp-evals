/**
 * Error Expectation
 *
 * Validates that a tool call returned an error (isError: true).
 * This is useful for testing error handling, e.g., missing required params.
 */

import type { EvalExpectation, EvalExpectationResult } from '../evalRunner.js';
import type { EvalCase } from '../datasetTypes.js';
import { extractTextFromResponse, findMissingSubstrings } from './textUtils.js';

/**
 * MCP tool response shape (subset for error checking)
 */
interface MCPToolResponse {
  isError?: boolean;
  content?: unknown;
}

/**
 * Creates an error expectation
 *
 * Validates that the tool call returned `isError: true` and optionally
 * checks that the error message contains expected substrings.
 *
 * @returns Expectation function
 *
 * @example
 * ```typescript
 * // In your eval dataset:
 * {
 *   "id": "search-missing-query",
 *   "toolName": "search",
 *   "args": {},
 *   "expectedError": true
 * }
 *
 * // Or with error message validation:
 * {
 *   "id": "search-validates-query",
 *   "toolName": "search",
 *   "args": { "query": "" },
 *   "expectedError": "query is required"
 * }
 *
 * // In your test:
 * const expectations = {
 *   error: createErrorExpectation()
 * };
 * ```
 */
export const createErrorExpectation = (): EvalExpectation => {
  return async (
    _context,
    evalCase: EvalCase,
    response: unknown
  ): Promise<EvalExpectationResult> => {
    const result = response as MCPToolResponse;
    const hasError = result?.isError === true;
    const expectedError = evalCase.expectedError;

    // If no expectedError is set in the case, skip this expectation
    if (expectedError === undefined) {
      return {
        pass: true,
        details: 'No error expectation defined, skipping',
      };
    }

    // Check if tool returned an error
    if (!hasError) {
      return {
        pass: false,
        details:
          'Expected tool to return isError: true, but it returned success',
      };
    }

    // If expectedError is just `true`, any error passes
    if (expectedError === true) {
      return {
        pass: true,
        details: 'Tool correctly returned an error as expected',
      };
    }

    // If expectedError is a string or array, validate error message contains expected text
    if (typeof expectedError === 'string' || Array.isArray(expectedError)) {
      const errorText = extractTextFromResponse(response);
      const patterns = Array.isArray(expectedError)
        ? expectedError
        : [expectedError];

      const missing = findMissingSubstrings(errorText, patterns, false);

      if (missing.length > 0) {
        return {
          pass: false,
          details: `Error message missing expected content: ${missing.map((s) => `"${s}"`).join(', ')}\n\nActual error:\n${errorText.slice(0, 500)}${errorText.length > 500 ? '...' : ''}`,
        };
      }

      return {
        pass: true,
        details: 'Tool returned expected error with matching message',
      };
    }

    // Fallback for any other truthy expectedError value
    return {
      pass: true,
      details: 'Tool correctly returned an error as expected',
    };
  };
};
