import { z } from 'zod';
import type { EvalCase, EvalDataset } from '../datasetTypes.js';
import type {
  EvalExpectation,
  EvalExpectationResult,
  EvalExpectationContext,
} from '../evalRunner.js';

/**
 * Creates a schema-based expectation
 *
 * Validates that the tool response conforms to the specified Zod schema
 *
 * @param dataset - The dataset containing schema definitions
 * @returns Expectation function
 */
export function createSchemaExpectation(dataset: EvalDataset): EvalExpectation {
  return async (
    _context: EvalExpectationContext,
    evalCase: EvalCase,
    response: unknown
  ): Promise<EvalExpectationResult> => {
    // Skip if no schema is specified
    if (!evalCase.expectedSchemaName) {
      return {
        pass: true,
        details: 'No expectedSchemaName defined, skipping',
      };
    }

    // Get schema from dataset
    const schema = dataset.schemas?.[evalCase.expectedSchemaName];

    if (!schema) {
      return {
        pass: false,
        details: `Schema "${evalCase.expectedSchemaName}" not found in dataset.schemas`,
      };
    }

    // Validate response against schema
    try {
      schema.parse(response);
      return {
        pass: true,
        details: `Response conforms to schema "${evalCase.expectedSchemaName}"`,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues
          .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
          .join('\n');

        return {
          pass: false,
          details: `Schema validation failed for "${evalCase.expectedSchemaName}":\n${issues}`,
        };
      }

      return {
        pass: false,
        details: `Unexpected error during schema validation: ${String(error)}`,
      };
    }
  };
}
