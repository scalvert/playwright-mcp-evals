import { test, expect } from '@mcp-testing/server-tester/fixtures/mcp';
import {
  loadEvalDataset,
  runEvalDataset,
  createTextContainsExpectation,
  createRegexExpectation,
  runConformanceChecks,
  extractTextFromResponse,
} from '@mcp-testing/server-tester';

/**
 * Glean MCP Server Test Suite
 *
 * This test suite demonstrates testing a production HTTP MCP server (Glean)
 * using a layered approach that should be standard for all MCP server testing:
 *
 * Layer 1: MCP Protocol Conformance (baseline for ALL servers)
 *   - Server info, tools list, error handling, resources, prompts
 *
 * Layer 2: Direct Tool Testing (domain-specific functionality)
 *   - Glean-specific tools: search, code_search, employee_search, etc.
 *   - Text-based validation with extractTextFromResponse
 *
 * Layer 3: Advanced Features (testing patterns)
 *   - Text extraction, filtering, pagination, AI synthesis
 *
 * Layer 4: Server-Specific Conformance (Glean requirements)
 *   - Verify all expected Glean tools are present
 *
 * Layer 5: Eval Datasets (comprehensive validation)
 *   - JSON-based test cases with text expectations
 *   - LLM host mode scenarios (optional, requires API keys)
 */

// ============================================================================
// MCP Protocol Conformance (Standard baseline tests for all MCP servers)
// ============================================================================

test.describe('MCP Protocol Conformance', () => {
  test('should return valid server info', async ({ mcp }) => {
    const info = mcp.getServerInfo();

    // Server info should exist
    expect(info).toBeTruthy();
    expect(info?.name).toBeTruthy();
    expect(info?.version).toBeTruthy();
  });

  test('should list available tools', async ({ mcp }) => {
    const tools = await mcp.listTools();

    // Should return array of tools
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);

    // Each tool should have required fields
    tools.forEach(tool => {
      expect(tool.name).toBeTruthy();
      expect(typeof tool.name).toBe('string');
      // Description is optional but common
      if (tool.description) {
        expect(typeof tool.description).toBe('string');
      }
    });
  });

  test('should return error for invalid tool', async ({ mcp }) => {
    // Invalid tool calls may throw McpError
    try {
      const result = await mcp.callTool('nonexistent_tool_xyz', {});
      // If it doesn't throw, it should return an error
      expect(result.isError).toBe(true);
    } catch (error) {
      // Throwing is also acceptable MCP behavior
      expect(error).toBeTruthy();
    }
  });

  test('should handle tool calls with empty args', async ({ mcp }) => {
    // Some tools may work with empty args, others may error
    // Just verify the protocol works correctly
    const result = await mcp.callTool('search', {});

    expect(result).toBeTruthy();
    // Either success or error is fine, just no crashes
    expect(typeof result.isError).toBe('boolean');
  });

  test('should list resources if supported', async ({ mcp }) => {
    try {
      const resources = await mcp.listResources();
      // If supported, should return array
      expect(Array.isArray(resources)).toBe(true);
    } catch (error) {
      // Resources may not be supported - that's ok
      expect(error).toBeTruthy();
    }
  });

  test('should list prompts if supported', async ({ mcp }) => {
    try {
      const prompts = await mcp.listPrompts();
      // If supported, should return array
      expect(Array.isArray(prompts)).toBe(true);
    } catch (error) {
      // Prompts may not be supported - that's ok
      expect(error).toBeTruthy();
    }
  });
});

// ============================================================================
// Direct Tool Tests (Glean-specific functionality)
// ============================================================================

test.describe('Direct Tool Testing', () => {
  test('should search for documents', async ({ mcp }) => {
    const result = await mcp.callTool('search', {
      query: 'API documentation',
    });

    expect(result).toBeTruthy();
    expect(result.isError).toBeFalsy();

    // Extract text from response
    const text = extractTextFromResponse(result);
    expect(text).toContain('API');
  });

  test('should search for employees', async ({ mcp }) => {
    const result = await mcp.callTool('employee_search', {
      query: 'engineer',
    });

    expect(result).toBeTruthy();
    expect(result.isError).toBeFalsy();

    const text = extractTextFromResponse(result);
    expect(text.length).toBeGreaterThan(0);
  });

  test('should search code repositories', async ({ mcp }) => {
    const result = await mcp.callTool('code_search', {
      query: 'function',
    });

    expect(result).toBeTruthy();
    expect(result.isError).toBeFalsy();

    const text = extractTextFromResponse(result);
    expect(text).toBeTruthy();
  });

  test('should handle search with filters', async ({ mcp }) => {
    const result = await mcp.callTool('search', {
      query: 'updated:past_week',
    });

    expect(result).toBeTruthy();
    expect(result.isError).toBeFalsy();
  });
});

// ============================================================================
// Eval Dataset Tests
// ============================================================================

test.describe('Glean MCP Server Evaluation', () => {
  test('should pass all evaluation cases', async ({ mcp }, testInfo) => {
    // Load eval dataset (no schemas needed - Glean returns markdown)
    const dataset = await loadEvalDataset('./eval-dataset.json');

    // Run eval dataset with text-based expectations
    const result = await runEvalDataset(
      {
        dataset,
        expectations: {
          textContains: createTextContainsExpectation(),
          regex: createRegexExpectation(),
        },
      },
      { mcp, testInfo }
    );

    // Expect at least 75% pass rate (12/16 with LLM host mode tests disabled)
    const passRate = result.passed / result.total;
    expect(passRate).toBeGreaterThanOrEqual(0.75);

    // Expect all direct mode tests to pass
    const directModeResults = result.caseResults.filter(r => r.mode === 'direct');
    const directModePassed = directModeResults.filter(r => r.pass).length;
    expect(directModePassed).toBe(directModeResults.length);
  });
});

// ============================================================================
// Advanced Features
// ============================================================================

test.describe('Advanced Testing Features', () => {
  test('should extract and validate text from search results', async ({ mcp }) => {
    const result = await mcp.callTool('search', {
      query: 'documentation',
    });

    const text = extractTextFromResponse(result);

    // Validate text extraction worked
    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(0);

    // Validate content makes sense
    expect(text.toLowerCase()).toContain('doc');
  });

  test('should handle pagination with num_results parameter', async ({ mcp }) => {
    const result = await mcp.callTool('search', {
      query: 'num_results:5 API',
    });

    expect(result).toBeTruthy();
    expect(result.isError).toBeFalsy();
  });

  test('should search with date filters', async ({ mcp }) => {
    const result = await mcp.callTool('search', {
      query: 'updated:past_month engineering',
    });

    expect(result).toBeTruthy();
    expect(result.isError).toBeFalsy();
  });

  test('should search meetings', async ({ mcp }) => {
    const result = await mcp.callTool('meeting_lookup', {
      query: 'after:now-1w standup',
    });

    expect(result).toBeTruthy();
    // Meeting searches may return no results, which is okay
    expect(result.isError).toBeFalsy();
  });

  test('should use AI chat for synthesis', async ({ mcp }) => {
    const result = await mcp.callTool('chat', {
      message: 'What are the latest API updates?',
    });

    expect(result).toBeTruthy();
    expect(result.isError).toBeFalsy();

    const text = extractTextFromResponse(result);
    expect(text.length).toBeGreaterThan(10);
  });
});

// ============================================================================
// Glean-Specific Conformance Tests
// ============================================================================

test.describe('Glean Tool Availability', () => {
  test('should provide all expected Glean tools', async ({ mcp }) => {
    const tools = await mcp.listTools();
    const toolNames = tools.map(t => t.name);

    // Verify expected Glean tools are present
    expect(toolNames).toContain('search');
    expect(toolNames).toContain('employee_search');
    expect(toolNames).toContain('code_search');
    expect(toolNames).toContain('chat');
    expect(toolNames).toContain('meeting_lookup');
    expect(toolNames).toContain('gmail_search');
    expect(toolNames).toContain('read_document');
  });

  test('should pass Glean-specific conformance checks', async ({ mcp }) => {
    const result = await runConformanceChecks(mcp, {
      requiredTools: [
        'search',
        'employee_search',
        'code_search',
        'chat',
      ],
      validateSchemas: true,
    });

    // All checks should pass for Glean
    const passedChecks = result.checks.filter(c => c.pass).length;
    const passRate = passedChecks / result.checks.length;
    expect(passRate).toBeGreaterThanOrEqual(0.8);
  });
});
