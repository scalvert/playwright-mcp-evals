import type { EvalCase } from '../datasetTypes.js';
import type {
  EvalExpectation,
  EvalExpectationResult,
  EvalExpectationContext,
} from '../evalRunner.js';

/**
 * Creates an exact match expectation
 *
 * Validates that the tool response exactly matches the expected value
 * Uses deep equality comparison
 *
 * @returns Expectation function
 */
export function createExactExpectation(): EvalExpectation {
  return async (
    _context: EvalExpectationContext,
    evalCase: EvalCase,
    response: unknown
  ): Promise<EvalExpectationResult> => {
    // Skip if no expected value is defined
    if (evalCase.expectedExact === undefined) {
      return {
        pass: true,
        details: 'No expectedExact defined, skipping',
      };
    }

    const expected = evalCase.expectedExact;

    // Deep equality check
    const isEqual = deepEqual(response, expected);

    return {
      pass: isEqual,
      details: isEqual
        ? 'Response matches expected value'
        : `Expected: ${JSON.stringify(expected, null, 2)}\nReceived: ${JSON.stringify(response, null, 2)}`,
    };
  };
}

/**
 * Deep equality comparison
 *
 * @param a - First value
 * @param b - Second value
 * @returns true if values are deeply equal
 */
function deepEqual(a: unknown, b: unknown): boolean {
  // Handle primitives and null/undefined
  if (a === b) {
    return true;
  }

  // Handle null/undefined
  if (a == null || b == null) {
    return a === b;
  }

  // Handle different types
  if (typeof a !== typeof b) {
    return false;
  }

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  // Handle objects
  if (typeof a === 'object' && typeof b === 'object') {
    const aKeys = Object.keys(a as Record<string, unknown>);
    const bKeys = Object.keys(b as Record<string, unknown>);

    if (aKeys.length !== bKeys.length) {
      return false;
    }

    return aKeys.every((key) =>
      deepEqual(
        (a as Record<string, unknown>)[key],
        (b as Record<string, unknown>)[key]
      )
    );
  }

  // All other cases
  return false;
}
