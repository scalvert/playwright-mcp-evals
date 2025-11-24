/**
 * playwright-mcp-server-test
 *
 * Playwright-based testing framework for MCP servers
 *
 * @packageDocumentation
 */

// Config
export type { MCPConfig, MCPHostCapabilities } from './config/mcpConfig.js';
export {
  MCPConfigSchema,
  validateMCPConfig,
  isStdioConfig,
  isHttpConfig,
} from './config/mcpConfig.js';

// MCP Client
export {
  createMCPClientForConfig,
  closeMCPClient,
} from './mcp/clientFactory.js';

// Fixtures
export type { MCPFixtureApi } from './mcp/fixtures/mcpFixture.js';
export {
  createMCPFixtureApi,
  createMCPFixtureApiWithTracking,
} from './mcp/fixtures/mcpFixture.js';

// Eval Dataset
export type {
  EvalCase,
  EvalDataset,
  SerializedEvalDataset,
  EvalMode,
} from './evals/datasetTypes.js';
export {
  EvalCaseSchema,
  EvalDatasetSchema,
  validateEvalCase,
  validateEvalDataset,
} from './evals/datasetTypes.js';

// Eval Loader
export type { LoadDatasetOptions } from './evals/datasetLoader.js';
export {
  loadEvalDataset,
  loadEvalDatasetFromObject,
} from './evals/datasetLoader.js';

// Eval Runner
export type {
  EvalExpectationContext,
  EvalExpectationResult,
  EvalExpectation,
  EvalCaseResult,
  EvalRunnerResult,
  EvalRunnerOptions,
} from './evals/evalRunner.js';
export { runEvalDataset } from './evals/evalRunner.js';

// Expectations
export { createExactExpectation } from './evals/expectations/exactExpectation.js';
export { createSchemaExpectation } from './evals/expectations/schemaExpectation.js';
export {
  createJudgeExpectation,
  type JudgeConfigs,
} from './evals/expectations/judgeExpectation.js';
export {
  createTextContainsExpectation,
  type TextContainsExpectationOptions,
} from './evals/expectations/textContainsExpectation.js';
export { createRegexExpectation } from './evals/expectations/regexExpectation.js';
export { createSnapshotExpectation } from './evals/expectations/snapshotExpectation.js';
export {
  extractTextFromResponse,
  normalizeWhitespace,
  findMissingSubstrings,
  findFailedPatterns,
} from './evals/expectations/textUtils.js';

// LLM Host Simulation
export type {
  LLMProvider,
  LLMHostConfig,
  LLMToolCall,
  LLMHostSimulationResult,
  LLMHostSimulator,
  ExpectedToolCall,
  ToolCallValidationResult,
} from './evals/llmHost/index.js';
export {
  simulateLLMHost,
  isProviderAvailable,
  getMissingDependencyMessage,
} from './evals/llmHost/index.js';
export { createToolCallExpectation } from './evals/llmHost/index.js';

// Judge
export type {
  LLMProviderKind,
  LLMJudgeConfig,
  LLMJudgeResult,
  LLMJudgeClient,
} from './judge/judgeTypes.js';
export { createLLMJudgeClient } from './judge/judgeClient.js';
export { createOpenAIJudge } from './judge/openaiJudge.js';
export { createAnthropicJudge } from './judge/anthropicJudge.js';

// Conformance
export type {
  MCPConformanceOptions,
  MCPConformanceResult,
} from './spec/conformanceChecks.js';
export {
  runConformanceChecks,
  formatConformanceResult,
} from './spec/conformanceChecks.js';

// Reporter
export type {
  MCPEvalReporterConfig,
  MCPEvalRunData,
  MCPEvalHistoricalSummary,
} from './reporters/types.js';
