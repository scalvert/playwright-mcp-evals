import { test, expect } from '@mcp-testing/server-tester/fixtures/mcp';
import {
  loadEvalDataset,
  runEvalDataset,
  createTextContainsExpectation,
  createRegexExpectation,
  runConformanceChecks,
  extractTextFromResponse,
} from '@mcp-testing/server-tester';

test.describe('MCP Protocol Conformance', () => {
  test('should return valid server info', async ({ mcp }) => {
    const info = mcp.getServerInfo();

    expect(info).toBeTruthy();
    expect(info?.name).toBeTruthy();
    expect(info?.version).toBeTruthy();
  });

  test('should list available tools', async ({ mcp }) => {
    const tools = await mcp.listTools();

    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);

    tools.forEach((tool) => {
      expect(tool.name).toBeTruthy();
      expect(typeof tool.name).toBe('string');
      if (tool.description) {
        expect(typeof tool.description).toBe('string');
      }
    });
  });

  test('should return error for invalid tool', async ({ mcp }) => {
    try {
      const result = await mcp.callTool('nonexistent_tool_xyz', {});
      expect(result.isError).toBe(true);
    } catch (error) {
      expect(error).toBeTruthy();
    }
  });

  test('should handle tool calls with empty args', async ({ mcp }) => {
    const result = await mcp.callTool('search', {});

    expect(result).toBeTruthy();
    expect(typeof result.isError).toBe('boolean');
  });

  test('should list resources if supported', async ({ mcp }) => {
    try {
      const resources = await mcp.listResources();
      expect(Array.isArray(resources)).toBe(true);
    } catch (error) {
      expect(error).toBeTruthy();
    }
  });

  test('should list prompts if supported', async ({ mcp }) => {
    try {
      const prompts = await mcp.listPrompts();
      expect(Array.isArray(prompts)).toBe(true);
    } catch (error) {
      expect(error).toBeTruthy();
    }
  });
});

test.describe('Direct Tool Testing', () => {
  test('should search for documents', async ({ mcp }) => {
    const result = await mcp.callTool('search', {
      query: 'API documentation',
    });

    expect(result).toBeTruthy();
    expect(result.isError).toBeFalsy();

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

test.describe('Glean MCP Server Evaluation', () => {
  test('should pass all evaluation cases', async ({ mcp }, testInfo) => {
    const dataset = await loadEvalDataset('./eval-dataset.json');

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

    const passRate = result.passed / result.total;
    expect(passRate).toBeGreaterThanOrEqual(0.75);

    const directModeResults = result.caseResults.filter((r) => r.mode === 'direct');
    const directModePassed = directModeResults.filter((r) => r.pass).length;
    expect(directModePassed).toBe(directModeResults.length);
  });
});

test.describe('Advanced Testing Features', () => {
  test('should extract and validate text from search results', async ({ mcp }) => {
    const result = await mcp.callTool('search', {
      query: 'documentation',
    });

    const text = extractTextFromResponse(result);

    expect(text).toBeTruthy();
    expect(text.length).toBeGreaterThan(0);
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

test.describe('Glean Tool Availability', () => {
  test('should provide all expected Glean tools', async ({ mcp }) => {
    const tools = await mcp.listTools();
    const toolNames = tools.map((t) => t.name);

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
      requiredTools: ['search', 'employee_search', 'code_search', 'chat'],
      validateSchemas: true,
    });

    const passedChecks = result.checks.filter((c) => c.pass).length;
    const passRate = passedChecks / result.checks.length;
    expect(passRate).toBeGreaterThanOrEqual(0.8);
  });
});
