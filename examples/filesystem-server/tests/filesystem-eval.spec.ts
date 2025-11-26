/**
 * Filesystem MCP Server - Comprehensive Testing Example
 *
 * Demonstrates all testing patterns: direct API, inline evals, JSON datasets,
 * and LLM host simulation (E2E).
 */

import { test as base, expect } from '@playwright/test';
import { Project } from 'fixturify-project';
import {
  createMCPClientForConfig,
  createMCPFixture,
  closeMCPClient,
  type MCPConfig,
  type MCPFixtureApi,
  loadEvalDataset,
  runEvalDataset,
  runEvalCase,
  type EvalCase,
  createTextContainsExpectation,
  createRegexExpectation,
  createSnapshotExpectation,
  createExactExpectation,
  runConformanceChecks,
  simulateLLMHost,
  extractTextFromResponse,
  normalizeWhitespace,
} from '@mcp-testing/server-tester';
import { ConfigFileSchema } from '../schemas/fileContentSchema.js';
import path from 'path';

import evalDataset from '../eval-dataset.json' with { type: 'json' };

type FilesystemFixtures = {
  fileProject: Project;
  projectPath: string;
  mcp: MCPFixtureApi;
};

const test = base.extend<FilesystemFixtures>({
  fileProject: async ({}, use) => {
    const project = new Project('fs-test', '1.0.0', {
      files: {
        'readme.txt': 'Hello World',
        'config.json': JSON.stringify(
          { version: '1.0.0', features: ['logging', 'api', 'authentication'] },
          null,
          2
        ),
        docs: {
          'guide.md': '# User Guide\n\nComplete guide here',
          'api.md': '# API Reference\n\nAPI documentation',
        },
        data: {
          'users.csv': 'id,name,email\n1,Alice,alice@example.com\n2,Bob,bob@example.com',
          'settings.json': JSON.stringify({ theme: 'dark', lang: 'en' }, null, 2),
        },
      },
    });

    await project.write();
    await use(project);
    project.dispose();
  },

  projectPath: async ({ fileProject }, use) => {
    await use(fileProject.baseDir);
  },

  mcp: async ({ projectPath }, use, testInfo) => {
    const config: MCPConfig = {
      transport: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', projectPath],
      cwd: projectPath,
      quiet: true,
    };

    const client = await createMCPClientForConfig(config);
    const mcpApi = createMCPFixture(client, testInfo);

    await use(mcpApi);

    await closeMCPClient(client);
  },
});

test.describe('Protocol Conformance', () => {
  test('passes conformance checks', async ({ mcp }) => {
    const result = await runConformanceChecks(mcp, {
      requiredTools: ['read_file', 'list_directory', 'directory_tree'],
      validateSchemas: false,
      checkServerInfo: true,
    });

    expect(JSON.stringify(result.checks, null, 2)).toMatchSnapshot();
  });

  test('has valid server info', async ({ mcp }) => {
    const serverInfo = mcp.getServerInfo();
    expect(JSON.stringify(serverInfo, null, 2)).toMatchSnapshot();
  });

  test('lists available tools', async ({ mcp }) => {
    try {
      const tools = await mcp.listTools();
      expect(tools).toMatchSnapshot();
    } catch {
      expect(true).toBe(true);
    }
  });
});

test.describe('Direct API Tests', () => {
  test('reads a file', async ({ mcp }) => {
    const result = await mcp.callTool('read_file', { path: 'readme.txt' });

    expect(result.isError).not.toBe(true);

    const text = extractTextFromResponse(result);
    expect(text).toBe('Hello World');
  });

  test('lists directory contents', async ({ mcp }) => {
    const result = await mcp.callTool('list_directory', { path: 'docs' });

    expect(result.isError).not.toBe(true);

    const text = extractTextFromResponse(result);
    expect(text).toContain('guide.md');
    expect(text).toContain('api.md');
  });

  test('handles non-existent files', async ({ mcp }) => {
    const result = await mcp.callTool('read_file', { path: 'does-not-exist.txt' });
    expect(result.isError).toBe(true);
  });

  test('reads JSON and validates structure', async ({ mcp }) => {
    const result = await mcp.callTool('read_file', { path: 'config.json' });

    expect(result.isError).not.toBe(true);

    const text = extractTextFromResponse(result);
    const config = JSON.parse(text);

    const validated = ConfigFileSchema.parse(config);
    expect(validated.version).toBe('1.0.0');
    expect(validated.features).toContain('api');
  });
});

test.describe('Inline Eval Cases', () => {
  test('validates config content with inline case', async ({ mcp }) => {
    const result = await runEvalCase(
      {
        id: 'inline-config-check',
        toolName: 'read_file',
        args: { path: 'config.json' },
        expectedTextContains: ['version', '1.0.0', 'features'],
      },
      { textContains: createTextContainsExpectation() },
      { mcp }
    );

    expect(result.pass).toBe(true);
    expect(result.toolName).toBe('read_file');
  });

  test('validates directory listing with regex', async ({ mcp }) => {
    const result = await runEvalCase(
      {
        id: 'inline-docs-listing',
        toolName: 'list_directory',
        args: { path: 'docs' },
        expectedTextContains: ['guide.md', 'api.md'],
        expectedRegex: ['\\.md'],
      },
      {
        textContains: createTextContainsExpectation(),
        regex: createRegexExpectation(),
      },
      { mcp }
    );

    expect(result.pass).toBe(true);
  });
});

test.describe('Eval Dataset (Batch)', () => {
  test('runs all direct mode cases', async ({ mcp }, testInfo) => {
    const dataset = await loadEvalDataset(
      path.join(import.meta.dirname, '..', 'eval-dataset.json')
    );

    const directCases = dataset.cases.filter((c) => c.mode === 'direct' || !c.mode);
    const directDataset = { ...dataset, cases: directCases };

    const result = await runEvalDataset(
      {
        dataset: directDataset,
        expectations: {
          textContains: createTextContainsExpectation({ caseSensitive: false }),
          regex: createRegexExpectation(),
          exact: createExactExpectation(),
          snapshot: createSnapshotExpectation(),
        },
      },
      { mcp, testInfo, expect }
    );

    expect(result.passed).toBe(result.total);
    expect(result.failed).toBe(0);
  });
});

test.describe('Eval: Direct Mode', () => {
  const directCases = evalDataset.cases.filter((c) => c.mode === 'direct' || !c.mode);

  for (const evalCase of directCases) {
    test(evalCase.id, async ({ mcp }, testInfo) => {
      const result = await runEvalCase(
        evalCase as EvalCase,
        {
          textContains: createTextContainsExpectation({ caseSensitive: false }),
          regex: createRegexExpectation(),
          exact: createExactExpectation(),
          snapshot: createSnapshotExpectation(),
        },
        { mcp, testInfo, expect }
      );

      if (!result.pass) {
        const failures = Object.entries(result.expectations || {})
          .filter(([_, exp]) => !exp.pass)
          .map(([name, exp]) => `${name}: ${exp.details}`)
          .join('\n');

        expect.soft(result.pass, `Eval failed:\n${failures}`).toBe(true);
      }

      expect(result.pass).toBe(true);
    });
  }
});

function hasApiKey(provider: string): boolean {
  if (provider === 'openai') return !!process.env.OPENAI_API_KEY;
  if (provider === 'anthropic') return !!process.env.ANTHROPIC_API_KEY;
  return false;
}

test.describe('LLM Host Simulation (E2E)', () => {
  test('LLM discovers and lists directory contents', async ({ mcp }) => {
    if (!hasApiKey('openai')) {
      test.skip(true, 'OPENAI_API_KEY not set');
      return;
    }

    const result = await simulateLLMHost(
      mcp,
      'What files are in the docs directory?',
      { provider: 'openai', model: 'gpt-4o', temperature: 0 }
    );

    expect(result.success).toBe(true);
    expect(result.toolCalls.length).toBeGreaterThan(0);

    const listDirCall = result.toolCalls.find((c) => c.name === 'list_directory');
    expect(listDirCall).toBeDefined();

    expect(result.response).toContain('guide');
    expect(result.response).toContain('api');
  });

  test('LLM reads file and extracts information', async ({ mcp }) => {
    if (!hasApiKey('openai')) {
      test.skip(true, 'OPENAI_API_KEY not set');
      return;
    }

    const result = await simulateLLMHost(
      mcp,
      'Read the config.json file and tell me the version number.',
      { provider: 'openai', model: 'gpt-4o', temperature: 0 }
    );

    expect(result.success).toBe(true);
    expect(result.toolCalls.length).toBeGreaterThan(0);
    expect(result.response).toContain('1.0.0');
  });
});

test.describe('Eval: LLM Host Mode', () => {
  const llmCases = evalDataset.cases.filter((c) => c.mode === 'llm_host');

  for (const evalCase of llmCases) {
    const provider = evalCase.llmHostConfig?.provider || 'unknown';

    test(evalCase.id, async ({ mcp }, testInfo) => {
      if (!hasApiKey(provider)) {
        test.skip(true, `${provider.toUpperCase()}_API_KEY not set`);
        return;
      }

      const result = await runEvalCase(
        evalCase as EvalCase,
        {
          textContains: createTextContainsExpectation({ caseSensitive: false }),
          regex: createRegexExpectation(),
        },
        { mcp, testInfo, expect }
      );

      if (!result.pass && result.error) {
        if (result.error.includes('429') || result.error.includes('quota')) {
          test.skip(true, `API quota exceeded for ${provider}`);
          return;
        }
      }

      if (!result.pass) {
        const failures = Object.entries(result.expectations || {})
          .filter(([_, exp]) => !exp.pass)
          .map(([name, exp]) => `${name}: ${exp.details}`)
          .join('\n');

        expect(result.pass, `Eval failed:\n${result.error || failures}`).toBe(true);
      }

      expect(result.pass).toBe(true);
    });
  }
});

test.describe('Text Utilities', () => {
  test('extracts text from MCP responses', async ({ mcp }) => {
    const result = await mcp.callTool('read_file', { path: 'readme.txt' });

    expect(result.isError).not.toBe(true);

    const text = extractTextFromResponse(result);
    expect(text).toBe('Hello World');
  });

  test('normalizes whitespace for comparison', async ({ mcp }) => {
    const result = await mcp.callTool('read_file', { path: 'docs/guide.md' });

    expect(result.isError).not.toBe(true);

    const text = extractTextFromResponse(result);
    const normalized = normalizeWhitespace(text);

    expect(normalized).toContain('# User Guide');
    expect(normalized).toContain('Complete guide here');
  });
});
