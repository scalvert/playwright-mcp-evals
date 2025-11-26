/**
 * Expectation Base Factory
 *
 * Provides a higher-order function for creating expectations with
 * consistent handling of common concerns (skipping undefined, extracting text, etc.)
 */

import type { EvalCase } from '../datasetTypes.js';
import type {
  EvalExpectation,
  EvalExpectationResult,
  EvalExpectationContext,
} from '../evalRunner.js';
import { extractTextFromResponse } from './textUtils.js';

/**
 * Result of validating an expectation
 */
export interface ValidationResult {
  pass: boolean;
  details?: string;
}

/**
 * Definition for a text-based expectation
 *
 * Use this for expectations that validate text content (textContains, regex, etc.)
 */
export interface TextExpectationDefinition<TExpected, TOptions = void> {
  /**
   * Expectation name (for skip messages)
   */
  name: string;

  /**
   * Extracts the expected value from an eval case
   * Return undefined to skip this expectation
   */
  getExpected: (evalCase: EvalCase) => TExpected | undefined;

  /**
   * Validates the response text against the expected value
   *
   * @param text - Extracted text from response
   * @param expected - Expected value from eval case
   * @param options - Options passed to the factory
   * @returns Validation result
   */
  validate: (text: string, expected: TExpected, options: TOptions) => ValidationResult;
}

/**
 * Definition for a raw response expectation
 *
 * Use this for expectations that validate the full response (exact match, schema, etc.)
 */
export interface RawExpectationDefinition<TExpected, TOptions = void> {
  /**
   * Expectation name (for skip messages)
   */
  name: string;

  /**
   * Extracts the expected value from an eval case
   * Return undefined to skip this expectation
   */
  getExpected: (evalCase: EvalCase) => TExpected | undefined;

  /**
   * Validates the raw response against the expected value
   *
   * @param response - Raw response from MCP tool call
   * @param expected - Expected value from eval case
   * @param options - Options passed to the factory
   * @param context - Full eval context (for accessing mcp, testInfo, etc.)
   * @param evalCase - The eval case being validated
   * @returns Validation result (or promise)
   */
  validate: (
    response: unknown,
    expected: TExpected,
    options: TOptions,
    context: EvalExpectationContext,
    evalCase: EvalCase
  ) => ValidationResult | Promise<ValidationResult>;
}

/**
 * Creates a text-based expectation
 *
 * Handles common concerns:
 * - Skipping when expected value is undefined
 * - Extracting text from response
 * - Wrapping result in EvalExpectationResult format
 *
 * @param definition - Expectation definition
 * @returns Factory function that creates the expectation
 *
 * @example
 * ```typescript
 * export const createTextContainsExpectation = createTextExpectation({
 *   name: 'textContains',
 *   getExpected: (evalCase) => evalCase.expectedTextContains,
 *   validate: (text, expected, options) => {
 *     const substrings = Array.isArray(expected) ? expected : [expected];
 *     const missing = findMissingSubstrings(text, substrings, options.caseSensitive);
 *     return {
 *       pass: missing.length === 0,
 *       details: missing.length === 0
 *         ? 'Text contains all expected substrings'
 *         : `Missing: ${missing.join(', ')}`,
 *     };
 *   },
 * });
 * ```
 */
export function createTextExpectation<TExpected, TOptions = void>(
  definition: TextExpectationDefinition<TExpected, TOptions>
): (options?: TOptions) => EvalExpectation {
  return (options?: TOptions): EvalExpectation => {
    return async (
      _context: EvalExpectationContext,
      evalCase: EvalCase,
      response: unknown
    ): Promise<EvalExpectationResult> => {
      // Get expected value
      const expected = definition.getExpected(evalCase);

      // Skip if no expected value
      if (expected === undefined) {
        return {
          pass: true,
          details: `No ${definition.name} expectation defined, skipping`,
        };
      }

      // Extract text from response
      const text = extractTextFromResponse(response);

      // Run validation
      const result = definition.validate(text, expected, options as TOptions);

      return {
        pass: result.pass,
        details: result.details,
      };
    };
  };
}

/**
 * Creates a raw response expectation
 *
 * Handles common concerns:
 * - Skipping when expected value is undefined
 * - Wrapping result in EvalExpectationResult format
 *
 * Use this for expectations that need the full response object.
 *
 * @param definition - Expectation definition
 * @returns Factory function that creates the expectation
 *
 * @example
 * ```typescript
 * export const createExactExpectation = createRawExpectation({
 *   name: 'exact',
 *   getExpected: (evalCase) => evalCase.expectedExact,
 *   validate: (response, expected) => ({
 *     pass: deepEqual(response, expected),
 *     details: 'Expected values to match',
 *   }),
 * });
 * ```
 */
export function createRawExpectation<TExpected, TOptions = void>(
  definition: RawExpectationDefinition<TExpected, TOptions>
): (options?: TOptions) => EvalExpectation {
  return (options?: TOptions): EvalExpectation => {
    return async (
      context: EvalExpectationContext,
      evalCase: EvalCase,
      response: unknown
    ): Promise<EvalExpectationResult> => {
      // Get expected value
      const expected = definition.getExpected(evalCase);

      // Skip if no expected value
      if (expected === undefined) {
        return {
          pass: true,
          details: `No ${definition.name} expectation defined, skipping`,
        };
      }

      // Run validation (may be async)
      const result = await definition.validate(
        response,
        expected,
        options as TOptions,
        context,
        evalCase
      );

      return {
        pass: result.pass,
        details: result.details,
      };
    };
  };
}
