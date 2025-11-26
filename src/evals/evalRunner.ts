import type { MCPFixtureApi } from '../mcp/fixtures/mcpFixture.js';
import type { LLMJudgeClient } from '../judge/judgeTypes.js';
import type { EvalDataset, EvalCase } from './datasetTypes.js';
import type { TestInfo } from '@playwright/test';
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
  expect?: typeof import('@playwright/test').expect;
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
    textContains?: EvalExpectation;
    regex?: EvalExpectation;
    snapshot?: EvalExpectation;
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

    // Determine eval mode
    const mode = evalCase.mode || 'direct';

    // Execute based on mode
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
          context.mcp,
          evalCase.scenario,
          evalCase.llmHostConfig
        );

        if (!simulationResult.success) {
          throw new Error(
            simulationResult.error || 'LLM host simulation failed'
          );
        }

        // Response contains the full simulation result
        response = simulationResult;
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

        const result = await context.mcp.callTool(
          evalCase.toolName,
          evalCase.args
        );
        response = result.structuredContent ?? result.content;
      }
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

      // Run textContains expectation
      if (expectations.textContains) {
        try {
          expectationResults.textContains = await expectations.textContains(
            enrichedContext,
            evalCase,
            response
          );
        } catch (err) {
          expectationResults.textContains = {
            pass: false,
            details: `TextContains expectation threw error: ${String(err)}`,
          };
        }
      }

      // Run regex expectation
      if (expectations.regex) {
        try {
          expectationResults.regex = await expectations.regex(
            enrichedContext,
            evalCase,
            response
          );
        } catch (err) {
          expectationResults.regex = {
            pass: false,
            details: `Regex expectation threw error: ${String(err)}`,
          };
        }
      }

      // Run snapshot expectation
      if (expectations.snapshot) {
        try {
          expectationResults.snapshot = await expectations.snapshot(
            enrichedContext,
            evalCase,
            response
          );
        } catch (err) {
          expectationResults.snapshot = {
            pass: false,
            details: `Snapshot expectation threw error: ${String(err)}`,
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
      datasetName: dataset.name,
      toolName: evalCase.toolName || evalCase.scenario || 'llm_host',
      mode,
      source: 'eval',
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

  const result: EvalRunnerResult = {
    total: caseResults.length,
    passed,
    failed,
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

/**
 * Runs a single eval case and returns the result
 *
 * @param evalCase - The eval case to run
 * @param expectations - Map of expectation name to expectation function
 * @param context - Context containing mcp, testInfo, expect
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
  expectations: EvalRunnerOptions['expectations'],
  context: EvalExpectationContext
): Promise<EvalCaseResult> {
  const caseStartTime = Date.now();
  let response: unknown;
  let error: string | undefined;

  // Determine eval mode
  const mode = evalCase.mode || 'direct';

  // Execute based on mode
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
        context.mcp,
        evalCase.scenario,
        evalCase.llmHostConfig
      );

      if (!simulationResult.success) {
        throw new Error(
          simulationResult.error || 'LLM host simulation failed'
        );
      }

      // Response contains the full simulation result
      response = simulationResult;
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

      const result = await context.mcp.callTool(
        evalCase.toolName,
        evalCase.args
      );
      response = result.structuredContent ?? result.content;
    }
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  // Run expectations
  const expectationResults: EvalCaseResult['expectations'] = {};

  if (!error) {
    type ExpectationKey = keyof EvalCaseResult['expectations'];
    for (const [name, expectation] of Object.entries(expectations)) {
      if (expectation) {
        const key = name as ExpectationKey;
        try {
          expectationResults[key] = await expectation(
            context,
            evalCase,
            response
          );
        } catch (err) {
          expectationResults[key] = {
            pass: false,
            details: `${name} expectation threw error: ${String(err)}`,
          };
        }
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
    datasetName: 'single-case',
    toolName: evalCase.toolName || evalCase.scenario || 'llm_host',
    mode,
    source: 'eval',
    pass,
    response,
    error,
    expectations: expectationResults,
    durationMs: Date.now() - caseStartTime,
  };

  return caseResult;
}
