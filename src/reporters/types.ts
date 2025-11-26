import type { EvalCaseResult } from '../evals/evalRunner.js';

/**
 * Configuration options for MCP Eval Reporter
 */
export interface MCPEvalReporterConfig {
  /**
   * Output directory for reports and historical data
   * @default '.mcp-test-results'
   */
  outputDir?: string;

  /**
   * Auto-open report in browser after test run
   * @default true (disabled in CI)
   */
  autoOpen?: boolean;

  /**
   * Number of historical runs to keep
   * @default 10
   */
  historyLimit?: number;

  /**
   * Suppress console output (report still generated)
   * @default false
   */
  quiet?: boolean;
}

/**
 * Aggregated MCP eval run data
 */
export interface MCPEvalRunData {
  /**
   * Run timestamp (ISO 8601)
   */
  timestamp: string;

  /**
   * Total duration in milliseconds
   */
  durationMs: number;

  /**
   * Environment info
   */
  environment: {
    ci: boolean;
    node: string;
    platform: string;
  };

  /**
   * Aggregate metrics
   */
  metrics: {
    /**
     * Total number of eval cases
     */
    total: number;

    /**
     * Number of passed cases
     */
    passed: number;

    /**
     * Number of failed cases
     */
    failed: number;

    /**
     * Pass rate (0-1)
     */
    passRate: number;

    /**
     * Dataset breakdown: dataset name -> count
     */
    datasetBreakdown: Record<string, number>;

    /**
     * Expectation type breakdown: type -> count
     */
    expectationBreakdown: {
      exact: number;
      schema: number;
      textContains: number;
      regex: number;
      snapshot: number;
      judge: number;
    };
  };

  /**
   * All eval results from this run
   */
  results: Array<EvalCaseResult>;
}

/**
 * Historical summary (for trend charts)
 */
export interface MCPEvalHistoricalSummary {
  timestamp: string;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  durationMs: number;
}
