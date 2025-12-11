/**
 * Types for MCP Test Reporter UI
 * These match the types from src/reporters/types.ts
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
    datasetBreakdown?: Record<string, number>;
    expectationBreakdown?: Record<string, number>;
  };
  results: MCPEvalResult[];
}

export interface MCPEvalResult {
  id: string;
  datasetName: string;
  toolName: string;
  source: 'eval' | 'test';
  pass: boolean;
  response: unknown;
  error?: string;
  expectations: Record<string, MCPEvalExpectationResult>;
  authType?: 'oauth' | 'bearer-token' | 'none';
  project?: string;
  durationMs: number;
}

export interface MCPEvalExpectationResult {
  pass: boolean;
  details?: string;
}

export interface MCPEvalHistoricalSummary {
  timestamp: string;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  durationMs: number;
}

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
