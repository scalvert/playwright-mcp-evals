/**
 * Types for MCP Test Reporter UI
 *
 * These types align exactly with src/types/reporter.ts to ensure consistency
 * between the backend reporter and the React UI.
 *
 * @packageDocumentation
 */

/**
 * Authentication type for MCP connections
 */
export type AuthType = 'oauth' | 'api-token' | 'none';

/**
 * Source of test results
 */
export type ResultSource = 'eval' | 'test';

/**
 * Known expectation types
 */
export type ExpectationType =
  | 'exact'
  | 'schema'
  | 'textContains'
  | 'regex'
  | 'snapshot'
  | 'judge'
  | 'error';

/**
 * Result of an expectation check
 */
export interface MCPEvalExpectationResult {
  pass: boolean;
  details?: string;
}

/**
 * Individual conformance check result
 */
export interface MCPConformanceCheck {
  name: string;
  pass: boolean;
  message: string;
}

/**
 * Conformance check result as stored in reporter data
 */
export interface MCPConformanceResultData {
  testTitle: string;
  pass: boolean;
  checks: MCPConformanceCheck[];
  serverInfo?: {
    name?: string;
    version?: string;
  };
  toolCount: number;
  authType?: AuthType;
  project?: string;
}

/**
 * Server capabilities data from mcp-list-tools attachment
 */
export interface MCPServerCapabilitiesData {
  testTitle: string;
  tools: Array<{
    name: string;
    description?: string;
  }>;
  toolCount: number;
  authType?: AuthType;
  project?: string;
}

/**
 * Result of a single eval case
 */
export interface EvalCaseResult {
  id: string;
  datasetName: string;
  toolName: string;
  source: ResultSource;
  pass: boolean;
  response?: unknown;
  error?: string;
  expectations: Partial<Record<ExpectationType, MCPEvalExpectationResult>>;
  authType?: AuthType;
  project?: string;
  durationMs: number;
  /** @deprecated Mode is inferred from test context */
  mode?: 'direct' | 'llm_host';
}

/**
 * Breakdown of expectation types used
 */
export type ExpectationBreakdown = Record<ExpectationType, number>;

/**
 * Aggregated MCP eval run data
 */
export interface MCPEvalRunData {
  timestamp: string;
  durationMs: number;
  environment: {
    ci: boolean;
    node: string;
    platform: string;
  };
  metrics: {
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    datasetBreakdown: Record<string, number>;
    expectationBreakdown: ExpectationBreakdown;
  };
  results: EvalCaseResult[];
  conformanceChecks?: MCPConformanceResultData[];
  serverCapabilities?: MCPServerCapabilitiesData[];
}

/**
 * Historical summary for trend charts
 */
export interface MCPEvalHistoricalSummary {
  timestamp: string;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  durationMs: number;
}

/**
 * Complete data structure passed to UI
 */
export interface MCPEvalData {
  runData: MCPEvalRunData;
  historical: MCPEvalHistoricalSummary[];
}

// Window interface for global data injection
declare global {
  interface Window {
    MCP_EVAL_DATA: MCPEvalData;
  }
}
