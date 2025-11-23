import { z } from 'zod';

/**
 * A single eval test case
 */
export interface EvalCase {
  /**
   * Unique identifier for this test case
   */
  id: string;

  /**
   * Human-readable description of what this test case validates
   */
  description?: string;

  /**
   * Name of the MCP tool to call
   */
  toolName: string;

  /**
   * Arguments to pass to the tool
   */
  args: Record<string, unknown>;

  /**
   * Expected exact response (for strict equality checks)
   */
  expectedExact?: unknown;

  /**
   * Name of the schema to validate against (for schema-based validation)
   */
  expectedSchemaName?: string;

  /**
   * ID of the judge configuration to use (for LLM-as-a-judge evaluation)
   */
  judgeConfigId?: string;

  /**
   * Expected text content (substring match)
   * Can be a string or array of strings that must all be present in the response
   */
  expectedTextContains?: string | string[];

  /**
   * Expected regex pattern(s) that must match the response text
   * Can be a string pattern or array of patterns
   */
  expectedRegex?: string | string[];

  /**
   * Additional metadata for this test case
   */
  metadata?: Record<string, unknown>;
}

/**
 * A complete eval dataset containing multiple test cases
 */
export interface EvalDataset {
  /**
   * Dataset name
   */
  name: string;

  /**
   * Dataset description
   */
  description?: string;

  /**
   * Test cases in this dataset
   */
  cases: Array<EvalCase>;

  /**
   * Optional schema definitions referenced by test cases
   */
  schemas?: Record<string, z.ZodSchema>;

  /**
   * Additional dataset metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Zod schema for EvalCase
 */
export const EvalCaseSchema = z.object({
  id: z.string().min(1, 'id must not be empty'),
  description: z.string().optional(),
  toolName: z.string().min(1, 'toolName must not be empty'),
  args: z.record(z.unknown()),
  expectedExact: z.unknown().optional(),
  expectedSchemaName: z.string().optional(),
  judgeConfigId: z.string().optional(),
  expectedTextContains: z.union([z.string(), z.array(z.string())]).optional(),
  expectedRegex: z.union([z.string(), z.array(z.string())]).optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Zod schema for EvalDataset (without schemas field, as schemas aren't serializable)
 */
export const EvalDatasetSchema = z.object({
  name: z.string().min(1, 'name must not be empty'),
  description: z.string().optional(),
  cases: z.array(EvalCaseSchema).min(1, 'dataset must have at least one case'),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Type for serialized eval dataset (without Zod schemas)
 */
export type SerializedEvalDataset = z.infer<typeof EvalDatasetSchema>;

/**
 * Validates an eval case
 *
 * @param evalCase - The eval case to validate
 * @returns The validated eval case
 * @throws {z.ZodError} If validation fails
 */
export function validateEvalCase(evalCase: unknown): EvalCase {
  return EvalCaseSchema.parse(evalCase);
}

/**
 * Validates a serialized eval dataset
 *
 * @param dataset - The dataset to validate
 * @returns The validated dataset
 * @throws {z.ZodError} If validation fails
 */
export function validateEvalDataset(dataset: unknown): SerializedEvalDataset {
  return EvalDatasetSchema.parse(dataset);
}
