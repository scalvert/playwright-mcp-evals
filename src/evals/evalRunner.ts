import type { MCPFixtureApi } from '../mcp/fixtures/mcpFixture.js';
import type { LLMJudgeClient } from '../judge/judgeTypes.js';
import type { EvalDataset, EvalCase } from './datasetTypes.js';
import type { TestInfo, Expect } from '@playwright/test';
import { simulateLLMHost } from './llmHost/llmHostSimulation.js';

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

  /**
   * Optional Playwright TestInfo for reporter integration
   * When provided, eval results will be attached to the test for the MCP reporter
   */
  testInfo?: TestInfo;

  /**
   * Optional Playwright expect function for snapshot testing
   * Required for snapshot expectations to work properly
   */
  expect?: Expect;
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
 * Map of expectation names to expectation functions
 */
export type ExpectationMap = {
  exact?: EvalExpectation;
  schema?: EvalExpectation;
  textContains?: EvalExpectation;
  regex?: EvalExpectation;
  snapshot?: EvalExpectation;
  judge?: EvalExpectation;
  error?: EvalExpectation;
};

/**
 * Result of a single eval case
 */
export interface EvalCaseResult {
  /**
   * Case ID
   */
  id: string;

  /**
   * Dataset name this case belongs to
   */
  datasetName: string;

  /**
   * MCP tool name that was called
   */
  toolName: string;

  /**
   * Evaluation mode (direct or llm_host)
   */
  mode: 'direct' | 'llm_host';

  /**
   * Source of this result
   * - 'eval': From runEvalDataset() using JSON eval datasets
   * - 'test': From direct API test tracking (MCP fixture calls)
   */
  source: 'eval' | 'test';

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
    textContains?: EvalExpectationResult;
    regex?: EvalExpectationResult;
    snapshot?: EvalExpectationResult;
    judge?: EvalExpectationResult;
    error?: EvalExpectationResult;
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
  expectations: ExpectationMap;

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
 * Options for running a single eval case
 */
export interface EvalCaseOptions {
  /**
   * Dataset name for the result (defaults to 'single-case')
   */
  datasetName?: string;
}

async function executeToolCall(
  evalCase: EvalCase,
  mcp: MCPFixtureApi
): Promise<{ response: unknown; error?: string }> {
  const mode = evalCase.mode || 'direct';

  try {
    if (mode === 'llm_host') {
      // LLM host simulation mode
      if (!evalCase.scenario) {
        throw new Error(
          `Eval case ${evalCase.id}: scenario is required for llm_host mode`
        );
      }

      if (!evalCase.llmHostConfig) {
        throw new Error(
          `Eval case ${evalCase.id}: llmHostConfig is required for llm_host mode`
        );
      }

      const simulationResult = await simulateLLMHost(
        mcp,
        evalCase.scenario,
        evalCase.llmHostConfig
      );

      if (!simulationResult.success) {
        throw new Error(simulationResult.error || 'LLM host simulation failed');
      }

      return { response: simulationResult };
    } else {
      // Direct mode - call tool directly
      if (!evalCase.toolName) {
        throw new Error(
          `Eval case ${evalCase.id}: toolName is required for direct mode`
        );
      }
      if (!evalCase.args) {
        throw new Error(
          `Eval case ${evalCase.id}: args is required for direct mode`
        );
      }

      const result = await mcp.callTool(evalCase.toolName, evalCase.args);

      // For error expectations, return the full result so isError can be checked
      // For other expectations, return the content (backwards compatible)
      if (evalCase.expectedError !== undefined) {
        return { response: result };
      }
      return { response: result.structuredContent ?? result.content };
    }
  } catch (err) {
    return {
      response: undefined,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Runs all expectations against a response
 */
async function runExpectations(
  expectations: ExpectationMap,
  context: EvalExpectationContext,
  evalCase: EvalCase,
  response: unknown
): Promise<EvalCaseResult['expectations']> {
  const results: EvalCaseResult['expectations'] = {};

  type ExpectationKey = keyof EvalCaseResult['expectations'];
  for (const [name, expectation] of Object.entries(expectations)) {
    if (expectation) {
      const key = name as ExpectationKey;
      try {
        results[key] = await expectation(context, evalCase, response);
      } catch (err) {
        results[key] = {
          pass: false,
          details: `${name} expectation threw error: ${String(err)}`,
        };
      }
    }
  }

  return results;
}

/**
 * Determines if a case passed based on error and expectation results
 */
function didCasePass(
  error: string | undefined,
  expectations: EvalCaseResult['expectations']
): boolean {
  return (
    !error &&
    Object.values(expectations).every(
      (result) => result === undefined || result.pass
    )
  );
}

/**
 * Runs a single eval case and returns the result
 *
 * @param evalCase - The eval case to run
 * @param expectations - Map of expectation name to expectation function
 * @param context - Context containing mcp, testInfo, expect
 * @param options - Optional configuration (datasetName, etc.)
 * @returns The result of running the eval case
 *
 * @example
 * ```typescript
 * const result = await runEvalCase(
 *   evalCase,
 *   {
 *     textContains: createTextContainsExpectation(),
 *     exact: createExactExpectation(),
 *   },
 *   { mcp, testInfo, expect }
 * );
 *
 * expect(result.pass).toBe(true);
 * ```
 */
export async function runEvalCase(
  evalCase: EvalCase,
  expectations: ExpectationMap,
  context: EvalExpectationContext,
  options: EvalCaseOptions = {}
): Promise<EvalCaseResult> {
  const startTime = Date.now();
  const mode = evalCase.mode || 'direct';

  // Execute tool call
  const { response, error } = await executeToolCall(evalCase, context.mcp);

  // Run expectations if no error
  const expectationResults = error
    ? {}
    : await runExpectations(expectations, context, evalCase, response);

  // Build result
  return {
    id: evalCase.id,
    datasetName: options.datasetName ?? 'single-case',
    toolName: evalCase.toolName ?? evalCase.scenario ?? 'unknown',
    mode,
    source: 'eval',
    pass: didCasePass(error, expectationResults),
    response,
    error,
    expectations: expectationResults,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Runs an eval dataset against an MCP server
 *
 * This function composes runEvalCase() for each case in the dataset,
 * adding dataset-level features like stopOnFailure and callbacks.
 *
 * @param options - Eval runner options
 * @param context - Eval context (mcp fixture, optional judge client, optional testInfo)
 * @returns Eval results
 *
 * @example
 * // Basic usage
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
 *
 * @example
 * // With MCP reporter integration
 * test('eval dataset', async ({ mcp }, testInfo) => {
 *   const result = await runEvalDataset(
 *     { dataset, expectations },
 *     { mcp, testInfo }  // testInfo enables MCP reporter
 *   );
 * });
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

  const startTime = Date.now();
  const caseResults: EvalCaseResult[] = [];

  // Enrich context with judge client
  const enrichedContext: EvalExpectationContext = {
    ...context,
    judgeClient: judgeClient ?? context.judgeClient ?? null,
  };

  // Run each case
  for (const evalCase of dataset.cases) {
    const result = await runEvalCase(evalCase, expectations, enrichedContext, {
      datasetName: dataset.name,
    });

    caseResults.push(result);

    // Call onCaseComplete callback
    if (onCaseComplete) {
      await onCaseComplete(result);
    }

    // Stop on failure if requested
    if (stopOnFailure && !result.pass) {
      break;
    }
  }

  const total = caseResults.length;
  const passed = caseResults.filter((r) => r.pass).length;

  const result: EvalRunnerResult = {
    total,
    passed,
    failed: total - passed,
    caseResults,
    durationMs: Date.now() - startTime,
  };

  // Attach results for MCP reporter if testInfo is provided
  if (context.testInfo) {
    await context.testInfo.attach('mcp-test-results', {
      contentType: 'application/json',
      body: Buffer.from(JSON.stringify({ caseResults })),
    });
  }

  return result;
}
