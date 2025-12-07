/**
 * @mcp-testing/server-tester
 *
 * Playwright-based testing framework for MCP servers
 *
 * @packageDocumentation
 */

// Config
export type {
  MCPConfig,
  MCPHostCapabilities,
  MCPAuthConfig,
  MCPOAuthConfig,
} from './config/mcpConfig.js';
export {
  MCPConfigSchema,
  validateMCPConfig,
  isStdioConfig,
  isHttpConfig,
} from './config/mcpConfig.js';

// Auth
export type {
  StoredTokens,
  StoredClientInfo,
  StoredOAuthState,
  OAuthSetupConfig,
  TokenResult,
} from './auth/types.js';
export {
  PlaywrightOAuthClientProvider,
  type PlaywrightOAuthClientProviderConfig,
} from './auth/oauthClientProvider.js';
export {
  createTokenAuthHeaders,
  validateAccessToken,
  isTokenExpired,
  isTokenExpiringSoon,
} from './auth/tokenAuth.js';
export {
  performOAuthSetup,
  performOAuthSetupIfNeeded,
} from './auth/setupOAuth.js';

// Discovery (RFC 9728)
export {
  discoverProtectedResource,
  discoverAuthorizationServer,
  DiscoveryError,
  MCP_PROTOCOL_VERSION,
  type ProtectedResourceMetadata,
  type ProtectedResourceDiscoveryResult,
} from './auth/discovery.js';

// Token Storage
export {
  loadTokens,
  hasValidTokens,
  injectTokens,
  loadTokensFromEnv,
  ENV_VAR_NAMES,
  type StoredServerMetadata,
} from './auth/storage.js';

// CLI OAuth
export {
  CLIOAuthClient,
  type CLIOAuthClientConfig,
  type CLIOAuthResult,
} from './auth/cli.js';

// MCP Client
export {
  createMCPClientForConfig,
  closeMCPClient,
  type CreateMCPClientOptions,
} from './mcp/clientFactory.js';

// Response Normalization
export type { ContentBlock, NormalizedToolResponse } from './mcp/response.js';
export { normalizeToolResponse, extractText } from './mcp/response.js';

// Fixtures
export type { MCPFixtureApi } from './mcp/fixtures/mcpFixture.js';
export { createMCPFixture } from './mcp/fixtures/mcpFixture.js';
export { test, expect } from './fixtures/mcp.js';

// Backwards compatibility (deprecated)
/** @deprecated Use createMCPFixture instead */
export { createMCPFixture as createMCPFixtureApi } from './mcp/fixtures/mcpFixture.js';
/** @deprecated Use createMCPFixture instead */
export { createMCPFixture as createMCPFixtureApiWithTracking } from './mcp/fixtures/mcpFixture.js';

// Eval Dataset
export type {
  EvalCase,
  EvalDataset,
  SerializedEvalDataset,
  EvalMode,
  SnapshotSanitizer,
  BuiltInSanitizer,
  RegexSanitizer,
  FieldRemovalSanitizer,
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
export { runEvalDataset, runEvalCase } from './evals/evalRunner.js';

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
export {
  createSnapshotExpectation,
  applySanitizers,
  BUILT_IN_PATTERNS,
} from './evals/expectations/snapshotExpectation.js';
export { createErrorExpectation } from './evals/expectations/errorExpectation.js';
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
  MCPConformanceCheck,
  MCPConformanceRaw,
} from './spec/conformanceChecks.js';
export { runConformanceChecks } from './spec/conformanceChecks.js';

// Reporter
export type {
  MCPEvalReporterConfig,
  MCPEvalRunData,
  MCPEvalHistoricalSummary,
} from './reporters/types.js';
