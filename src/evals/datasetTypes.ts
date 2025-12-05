import { z } from 'zod';
import type { LLMHostConfig } from './llmHost/llmHostTypes.js';

/**
 * Evaluation mode
 */
export type EvalMode = 'direct' | 'llm_host';

/**
 * Built-in sanitizer names for common variable patterns
 */
export type BuiltInSanitizer =
  | 'timestamp' // Unix timestamps (milliseconds and seconds)
  | 'uuid' // UUIDs v1-v5
  | 'iso-date' // ISO 8601 date strings
  | 'objectId' // MongoDB ObjectIds
  | 'jwt'; // JWT tokens

/**
 * Custom regex-based sanitizer
 */
export interface RegexSanitizer {
  /** Regex pattern to match */
  pattern: string;
  /** Replacement string (default: "[SANITIZED]") */
  replacement?: string;
}

/**
 * Field removal sanitizer - removes specified fields from objects
 */
export interface FieldRemovalSanitizer {
  /** Field paths to remove (supports dot notation for nested fields) */
  remove: string[];
}

/**
 * Snapshot sanitizer configuration
 *
 * Sanitizers transform response data before snapshot comparison,
 * allowing variable content (timestamps, IDs, etc.) to be normalized.
 */
export type SnapshotSanitizer =
  | BuiltInSanitizer
  | RegexSanitizer
  | FieldRemovalSanitizer;

/**
 * A single eval test case
 *
 * Note: toolName and args are required for backward compatibility
 * and for 'direct' mode. For 'llm_host' mode, use scenario instead.
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
   * Evaluation mode
   * - 'direct': Direct API calls to MCP tools (default)
   * - 'llm_host': LLM-driven tool selection via natural language
   *
   * @default 'direct'
   */
  mode?: EvalMode;

  /**
   * Name of the MCP tool to call (required for 'direct' mode, optional for 'llm_host' mode)
   */
  toolName?: string;

  /**
   * Arguments to pass to the tool (required for 'direct' mode, optional for 'llm_host' mode)
   */
  args?: Record<string, unknown>;

  /**
   * Natural language scenario for LLM to execute (optional, required for 'llm_host' mode)
   *
   * @example "Get the weather for London and tell me if I need an umbrella"
   */
  scenario?: string;

  /**
   * LLM host configuration (optional for 'llm_host' mode)
   *
   * If not specified, uses default configuration from test environment
   */
  llmHostConfig?: LLMHostConfig;

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
   * Snapshot name for Playwright snapshot testing
   * When specified, uses expect(response).toMatchSnapshot(snapshotName)
   * Use --update-snapshots flag to update snapshots
   */
  expectedSnapshot?: string;

  /**
   * Sanitizers to apply before snapshot comparison
   *
   * Sanitizers normalize variable content (timestamps, IDs, tokens) so that
   * snapshots remain stable across test runs. Use when responses contain
   * dynamic data that would otherwise cause snapshot mismatches.
   *
   * Built-in sanitizers: 'timestamp', 'uuid', 'iso-date', 'objectId', 'jwt'
   *
   * @example
   * ```json
   * {
   *   "snapshotSanitizers": [
   *     "uuid",
   *     "iso-date",
   *     { "pattern": "token_[a-zA-Z0-9]+", "replacement": "[TOKEN]" },
   *     { "remove": ["lastLoginAt", "sessionId"] }
   *   ]
   * }
   * ```
   */
  snapshotSanitizers?: SnapshotSanitizer[];

  /**
   * Additional metadata for this test case
   *
   * For 'llm_host' mode, can include 'expectedToolCalls' for validation
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
 * Zod schema for LLMHostConfig (simplified for serialization)
 */
const LLMHostConfigSchema = z.object({
  provider: z.enum(['openai', 'anthropic']),
  apiKeyEnvVar: z.string().optional(),
  model: z.string().optional(),
  maxTokens: z.number().optional(),
  temperature: z.number().optional(),
  maxToolCalls: z.number().optional(),
});

/**
 * Zod schema for SnapshotSanitizer
 */
const SnapshotSanitizerSchema = z.union([
  // Built-in sanitizers
  z.enum(['timestamp', 'uuid', 'iso-date', 'objectId', 'jwt']),
  // Custom regex sanitizer
  z.object({
    pattern: z.string(),
    replacement: z.string().optional(),
  }),
  // Field removal sanitizer
  z.object({
    remove: z.array(z.string()),
  }),
]);

/**
 * Zod schema for EvalCase
 *
 * toolName and args are optional for llm_host mode (which uses scenario instead)
 */
export const EvalCaseSchema = z.object({
  id: z.string().min(1, 'id must not be empty'),
  description: z.string().optional(),
  mode: z.enum(['direct', 'llm_host']).optional(),
  toolName: z.string().min(1, 'toolName must not be empty').optional(),
  args: z.record(z.unknown()).optional(),
  scenario: z.string().optional(),
  llmHostConfig: LLMHostConfigSchema.optional(),
  expectedExact: z.unknown().optional(),
  expectedSchemaName: z.string().optional(),
  judgeConfigId: z.string().optional(),
  expectedTextContains: z.union([z.string(), z.array(z.string())]).optional(),
  expectedRegex: z.union([z.string(), z.array(z.string())]).optional(),
  expectedSnapshot: z.string().optional(),
  snapshotSanitizers: z.array(SnapshotSanitizerSchema).optional(),
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
