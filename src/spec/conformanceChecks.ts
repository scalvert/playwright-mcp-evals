import type { MCPFixtureApi } from '../mcp/fixtures/mcpFixture.js';

/**
 * Options for conformance checks
 */
export interface MCPConformanceOptions {
  /**
   * List of tools that must be present
   */
  requiredTools?: Array<string>;

  /**
   * Whether to validate tool schemas
   * @default true
   */
  validateSchemas?: boolean;

  /**
   * Whether to check server info is present
   * @default true
   */
  checkServerInfo?: boolean;
}

/**
 * Result of conformance checks
 */
export interface MCPConformanceResult {
  /**
   * Whether all checks passed
   */
  pass: boolean;

  /**
   * List of check results
   */
  checks: Array<{
    name: string;
    pass: boolean;
    message: string;
  }>;
}

/**
 * Runs MCP protocol conformance checks
 *
 * Validates that the MCP server conforms to expected protocol behavior
 *
 * @param mcp - MCP fixture API
 * @param options - Conformance check options
 * @returns Conformance check results
 *
 * @example
 * const result = await runConformanceChecks(mcp, {
 *   requiredTools: ['get_weather', 'search_docs'],
 *   validateSchemas: true,
 * });
 *
 * expect(result.pass).toBe(true);
 */
export async function runConformanceChecks(
  mcp: MCPFixtureApi,
  options: MCPConformanceOptions = {}
): Promise<MCPConformanceResult> {
  const {
    requiredTools = [],
    validateSchemas = true,
    checkServerInfo = true,
  } = options;

  const checks: MCPConformanceResult['checks'] = [];

  // Check 1: Server info is present
  if (checkServerInfo) {
    const serverInfo = mcp.getServerInfo();
    checks.push({
      name: 'server_info_present',
      pass: serverInfo !== null,
      message: serverInfo
        ? `Server info: ${serverInfo.name ?? 'unknown'} v${serverInfo.version ?? 'unknown'}`
        : 'Server info is missing',
    });
  }

  // Check 2: List tools returns valid response
  let tools;
  try {
    tools = await mcp.listTools();
    checks.push({
      name: 'list_tools_succeeds',
      pass: true,
      message: `listTools returned ${tools.length} tools`,
    });
  } catch (error) {
    checks.push({
      name: 'list_tools_succeeds',
      pass: false,
      message: `listTools failed: ${error instanceof Error ? error.message : String(error)}`,
    });
    return { pass: false, checks };
  }

  // Check 3: Required tools are present
  if (requiredTools.length > 0) {
    const toolNames = new Set(tools.map((t) => t.name));
    const missingTools = requiredTools.filter((name) => !toolNames.has(name));

    checks.push({
      name: 'required_tools_present',
      pass: missingTools.length === 0,
      message:
        missingTools.length === 0
          ? `All ${requiredTools.length} required tools are present`
          : `Missing required tools: ${missingTools.join(', ')}`,
    });
  }

  // Check 4: Tool schemas are valid
  if (validateSchemas && tools.length > 0) {
    const invalidTools: Array<string> = [];

    for (const tool of tools) {
      // Check that tool has required fields
      if (!tool.name) {
        invalidTools.push(`(unnamed tool): missing name`);
        continue;
      }

      if (!tool.inputSchema) {
        invalidTools.push(`${tool.name}: missing inputSchema`);
        continue;
      }

      // Check that inputSchema is an object schema
      if (tool.inputSchema.type !== 'object') {
        invalidTools.push(
          `${tool.name}: inputSchema.type must be "object", got "${String(tool.inputSchema.type)}"`
        );
      }
    }

    checks.push({
      name: 'tool_schemas_valid',
      pass: invalidTools.length === 0,
      message:
        invalidTools.length === 0
          ? `All ${tools.length} tools have valid schemas`
          : `Invalid tool schemas:\n  ${invalidTools.join('\n  ')}`,
    });
  }

  // Check 5: Calling invalid tool returns error
  try {
    const result = await mcp.callTool('__nonexistent_tool__', {});
    // MCP SDK may return isError: true instead of throwing
    const hasError = result.isError === true;
    checks.push({
      name: 'invalid_tool_returns_error',
      pass: hasError,
      message: hasError
        ? 'Nonexistent tool correctly returned an error'
        : 'Calling nonexistent tool should have returned an error',
    });
  } catch {
    // Or it may throw - both are acceptable
    checks.push({
      name: 'invalid_tool_returns_error',
      pass: true,
      message: 'Nonexistent tool correctly threw an error',
    });
  }

  const pass = checks.every((check) => check.pass);

  return { pass, checks };
}

/**
 * Formats conformance check results as a readable string
 *
 * @param result - Conformance check result
 * @returns Formatted string
 */
export function formatConformanceResult(result: MCPConformanceResult): string {
  const lines: Array<string> = [];

  lines.push(`Conformance Checks: ${result.pass ? 'PASS ✓' : 'FAIL ✗'}\n`);

  for (const check of result.checks) {
    const status = check.pass ? '✓' : '✗';
    lines.push(`  ${status} ${check.name}`);
    lines.push(`    ${check.message}`);
  }

  return lines.join('\n');
}
