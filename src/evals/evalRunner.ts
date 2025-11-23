import type { MCPFixtureApi } from '../mcp/fixtures/mcpFixture.js';
import type { LLMJudgeClient } from '../judge/judgeTypes.js';
import type { EvalDataset, EvalCase } from './datasetTypes.js';

/**
 * Context passed to expectation functions
 */
export interface EvalExpectationContext {
  /**
   * MCP fixture API for interacting with the server
   */
  mcp: MCPFixtureApi;

  /**
   * Optional LLM judge client for semantic evaluation
   */
  judgeClient?: LLMJudgeClient | null;
}

/**
 * Result of an expectation check
 */
export interface EvalExpectationResult {
  /**
   * Whether the expectation passed
   */
  pass: boolean;

  /**
   * Optional details about the result
   */
  details?: string;
}

/**
 * Expectation function type
 */
export type EvalExpectation = (
  context: EvalExpectationContext,
  evalCase: EvalCase,
  response: unknown
) => Promise<EvalExpectationResult>;

/**
 * Result of a single eval case
 */
export interface EvalCaseResult {
  /**
   * Case ID
   */
  id: string;

  /**
   * Overall pass/fail status
   */
  pass: boolean;

  /**
   * Tool response
   */
  response?: unknown;

  /**
   * Error if tool call failed
   */
  error?: string;

  /**
   * Expectation results
   */
  expectations: {
    exact?: EvalExpectationResult;
    schema?: EvalExpectationResult;
    judge?: EvalExpectationResult;
  };

  /**
   * Execution time in milliseconds
   */
  durationMs: number;
}

/**
 * Overall result of running an eval dataset
 */
export interface EvalRunnerResult {
  /**
   * Total number of cases
   */
  total: number;

  /**
   * Number of passing cases
   */
  passed: number;

  /**
   * Number of failing cases
   */
  failed: number;

  /**
   * Individual case results
   */
  caseResults: Array<EvalCaseResult>;

  /**
   * Overall execution time in milliseconds
   */
  durationMs: number;
}

/**
 * Options for running eval dataset
 */
export interface EvalRunnerOptions {
  /**
   * The dataset to run
   */
  dataset: EvalDataset;

  /**
   * Expectation functions to apply
   */
  expectations: {
    exact?: EvalExpectation;
    schema?: EvalExpectation;
    judge?: EvalExpectation;
  };

  /**
   * Optional judge client for LLM-as-a-judge evaluation
   */
  judgeClient?: LLMJudgeClient | null;

  /**
   * Whether to stop on first failure
   * @default false
   */
  stopOnFailure?: boolean;

  /**
   * Optional callback called after each case
   */
  onCaseComplete?: (result: EvalCaseResult) => void | Promise<void>;
}

/**
 * Runs an eval dataset against an MCP server
 *
 * @param options - Eval runner options
 * @param context - Eval context (mcp fixture, judge client)
 * @returns Eval results
 *
 * @example
 * const result = await runEvalDataset(
 *   {
 *     dataset,
 *     expectations: {
 *       exact: createExactExpectation(),
 *       schema: createSchemaExpectation(dataset),
 *     },
 *   },
 *   { mcp }
 * );
 */
export async function runEvalDataset(
  options: EvalRunnerOptions,
  context: EvalExpectationContext
): Promise<EvalRunnerResult> {
  const {
    dataset,
    expectations,
    judgeClient,
    stopOnFailure = false,
    onCaseComplete,
  } = options;

  const caseResults: Array<EvalCaseResult> = [];
  const startTime = Date.now();

  // Enrich context with judge client
  const enrichedContext: EvalExpectationContext = {
    ...context,
    judgeClient: judgeClient ?? context.judgeClient ?? null,
  };

  // Run each case
  for (const evalCase of dataset.cases) {
    const caseStartTime = Date.now();
    let response: unknown;
    let error: string | undefined;

    // Call the tool
    try {
      const result = await context.mcp.callTool(
        evalCase.toolName,
        evalCase.args
      );
      response = result.structuredContent ?? result.content;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    // Run expectations
    const expectationResults: EvalCaseResult['expectations'] = {};

    if (!error) {
      // Run exact expectation
      if (expectations.exact) {
        try {
          expectationResults.exact = await expectations.exact(
            enrichedContext,
            evalCase,
            response
          );
        } catch (err) {
          expectationResults.exact = {
            pass: false,
            details: `Exact expectation threw error: ${String(err)}`,
          };
        }
      }

      // Run schema expectation
      if (expectations.schema) {
        try {
          expectationResults.schema = await expectations.schema(
            enrichedContext,
            evalCase,
            response
          );
        } catch (err) {
          expectationResults.schema = {
            pass: false,
            details: `Schema expectation threw error: ${String(err)}`,
          };
        }
      }

      // Run judge expectation
      if (expectations.judge) {
        try {
          expectationResults.judge = await expectations.judge(
            enrichedContext,
            evalCase,
            response
          );
        } catch (err) {
          expectationResults.judge = {
            pass: false,
            details: `Judge expectation threw error: ${String(err)}`,
          };
        }
      }
    }

    // Determine overall pass/fail
    const pass =
      !error &&
      Object.values(expectationResults).every(
        (result) => result === undefined || result.pass
      );

    const caseResult: EvalCaseResult = {
      id: evalCase.id,
      pass,
      response,
      error,
      expectations: expectationResults,
      durationMs: Date.now() - caseStartTime,
    };

    caseResults.push(caseResult);

    // Call onCaseComplete callback
    if (onCaseComplete) {
      await onCaseComplete(caseResult);
    }

    // Stop on failure if requested
    if (stopOnFailure && !pass) {
      break;
    }
  }

  const passed = caseResults.filter((r) => r.pass).length;
  const failed = caseResults.filter((r) => !r.pass).length;

  return {
    total: caseResults.length,
    passed,
    failed,
    caseResults,
    durationMs: Date.now() - startTime,
  };
}
