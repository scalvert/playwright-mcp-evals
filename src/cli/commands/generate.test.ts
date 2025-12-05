import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { vol } from 'memfs';

// Hoist mocks
const mocks = vi.hoisted(() => ({
  // MCP client mocks
  createMCPClientForConfig: vi.fn(),
  closeMCPClient: vi.fn(),
  mockClient: {
    listTools: vi.fn(),
    callTool: vi.fn(),
  },
  // Inquirer mock
  prompt: vi.fn(),
  // Ora mock
  ora: vi.fn(),
  mockSpinner: {
    start: vi.fn(),
    succeed: vi.fn(),
    fail: vi.fn(),
  },
  // Suggestion mock
  suggestExpectations: vi.fn(),
  // validateMCPConfig mock
  validateMCPConfig: vi.fn(),
}));

// Mock fs with memfs
vi.mock('fs/promises', async () => {
  const memfs = await import('memfs');
  return memfs.fs.promises;
});

vi.mock('fs', async () => {
  const memfs = await import('memfs');
  return memfs.fs;
});

vi.mock('../../mcp/clientFactory.js', () => ({
  createMCPClientForConfig: mocks.createMCPClientForConfig,
  closeMCPClient: mocks.closeMCPClient,
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: mocks.prompt,
  },
}));

vi.mock('ora', () => ({
  default: () => {
    mocks.ora();
    mocks.mockSpinner.start.mockReturnValue(mocks.mockSpinner);
    return mocks.mockSpinner;
  },
}));

vi.mock('../utils/expectationSuggester.js', () => ({
  suggestExpectations: mocks.suggestExpectations,
}));

vi.mock('../../config/mcpConfig.js', () => ({
  validateMCPConfig: mocks.validateMCPConfig,
}));

// Mock process.exit to prevent test from exiting
const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit called');
});

// Mock console to suppress output during tests
vi.spyOn(console, 'log').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

import { generate } from './generate.js';

// Valid config to return from validateMCPConfig
const validConfig = {
  transport: 'stdio' as const,
  command: 'node',
  args: ['server.js'],
};

describe('generate command', () => {
  const configPath = '/test-output/mcp-config.json';

  beforeEach(() => {
    vi.clearAllMocks();
    vol.reset();

    // Default mock implementations
    mocks.createMCPClientForConfig.mockResolvedValue(mocks.mockClient);
    mocks.closeMCPClient.mockResolvedValue(undefined);
    mocks.validateMCPConfig.mockReturnValue(validConfig);
    mocks.mockClient.listTools.mockResolvedValue({
      tools: [
        { name: 'test_tool', description: 'A test tool' },
        { name: 'another_tool', description: 'Another tool' },
      ],
    });
    mocks.mockClient.callTool.mockResolvedValue({
      content: [{ type: 'text', text: 'Tool response' }],
    });
    mocks.suggestExpectations.mockReturnValue({
      textContains: ['response'],
      regex: ['\\w+'],
    });

    // Create output directory and config file
    vol.mkdirSync('/test-output', { recursive: true });
    vol.writeFileSync(configPath, JSON.stringify(validConfig));
  });

  afterEach(() => {
    vol.reset();
  });

  describe('--snapshot flag', () => {
    it('should set expectedSnapshot on all generated cases when --snapshot is used', async () => {
      // Set up prompts for a single test case
      mocks.prompt
        .mockResolvedValueOnce({ datasetName: 'snapshot-tests' }) // Dataset name
        .mockResolvedValueOnce({ toolName: 'test_tool' }) // Select tool
        .mockResolvedValueOnce({ argsJson: '{"input": "test"}' }) // Tool args
        .mockResolvedValueOnce({ caseId: 'my-test-case', description: 'Test' }) // Case details (no expectation prompts in snapshot mode)
        .mockResolvedValueOnce({ continueAdding: false }); // Stop adding

      await generate({
        config: configPath,
        snapshot: true,
        output: '/test-output/snapshot-dataset.json',
      });

      // Read the generated file
      const content = vol.readFileSync(
        '/test-output/snapshot-dataset.json',
        'utf-8'
      ) as string;
      const dataset = JSON.parse(content);

      expect(dataset.cases).toHaveLength(1);
      expect(dataset.cases[0].expectedSnapshot).toBe('my-test-case');
      expect(dataset.cases[0].expectedTextContains).toBeUndefined();
      expect(dataset.cases[0].expectedRegex).toBeUndefined();
    });

    it('should skip expectation prompts when --snapshot is used', async () => {
      mocks.prompt
        .mockResolvedValueOnce({ datasetName: 'snapshot-tests' })
        .mockResolvedValueOnce({ toolName: 'test_tool' })
        .mockResolvedValueOnce({ argsJson: '{}' })
        .mockResolvedValueOnce({ caseId: 'case-1', description: '' })
        .mockResolvedValueOnce({ continueAdding: false });

      await generate({
        config: configPath,
        snapshot: true,
        output: '/test-output/dataset.json',
      });

      // Verify that expectation prompts were not asked
      const promptCalls = mocks.prompt.mock.calls;
      const allPromptNames = promptCalls.flatMap((call) =>
        (call[0] as Array<{ name: string }>).map((p) => p.name)
      );

      expect(allPromptNames).not.toContain('useTextContains');
      expect(allPromptNames).not.toContain('useRegex');
      expect(allPromptNames).not.toContain('useExact');
      expect(allPromptNames).not.toContain('useSnapshot');
    });

    it('should generate multiple cases with snapshots', async () => {
      mocks.prompt
        .mockResolvedValueOnce({ datasetName: 'multi-snapshot' })
        // First case
        .mockResolvedValueOnce({ toolName: 'test_tool' })
        .mockResolvedValueOnce({ argsJson: '{"a": 1}' })
        .mockResolvedValueOnce({ caseId: 'case-1', description: 'First' })
        .mockResolvedValueOnce({ continueAdding: true })
        // Second case
        .mockResolvedValueOnce({ toolName: 'another_tool' })
        .mockResolvedValueOnce({ argsJson: '{"b": 2}' })
        .mockResolvedValueOnce({ caseId: 'case-2', description: 'Second' })
        .mockResolvedValueOnce({ continueAdding: false });

      await generate({
        config: configPath,
        snapshot: true,
        output: '/test-output/multi.json',
      });

      const content = vol.readFileSync('/test-output/multi.json', 'utf-8') as string;
      const dataset = JSON.parse(content);

      expect(dataset.cases).toHaveLength(2);
      expect(dataset.cases[0].expectedSnapshot).toBe('case-1');
      expect(dataset.cases[1].expectedSnapshot).toBe('case-2');
    });
  });

  describe('without --snapshot flag', () => {
    it('should prompt for expectation types', async () => {
      mocks.prompt
        .mockResolvedValueOnce({ datasetName: 'normal-tests' })
        .mockResolvedValueOnce({ toolName: 'test_tool' })
        .mockResolvedValueOnce({ argsJson: '{}' })
        .mockResolvedValueOnce({
          caseId: 'case-1',
          description: '',
          useTextContains: true,
          useRegex: false,
          useExact: false,
          useSnapshot: false,
        })
        .mockResolvedValueOnce({ continueAdding: false });

      await generate({
        config: configPath,
        output: '/test-output/normal.json',
      });

      const content = vol.readFileSync('/test-output/normal.json', 'utf-8') as string;
      const dataset = JSON.parse(content);

      expect(dataset.cases[0].expectedTextContains).toEqual(['response']);
      expect(dataset.cases[0].expectedSnapshot).toBeUndefined();
    });

    it('should set expectedSnapshot when user selects snapshot in interactive mode', async () => {
      mocks.prompt
        .mockResolvedValueOnce({ datasetName: 'interactive-snapshot' })
        .mockResolvedValueOnce({ toolName: 'test_tool' })
        .mockResolvedValueOnce({ argsJson: '{}' })
        .mockResolvedValueOnce({
          caseId: 'interactive-case',
          description: '',
          useTextContains: false,
          useRegex: false,
          useExact: false,
          useSnapshot: true, // User chooses snapshot
        })
        .mockResolvedValueOnce({ continueAdding: false });

      await generate({
        config: configPath,
        output: '/test-output/interactive.json',
      });

      const content = vol.readFileSync(
        '/test-output/interactive.json',
        'utf-8'
      ) as string;
      const dataset = JSON.parse(content);

      expect(dataset.cases[0].expectedSnapshot).toBe('interactive-case');
    });
  });

  describe('config file loading', () => {
    it('should load MCP config from file when --config is provided', async () => {
      mocks.prompt
        .mockResolvedValueOnce({ datasetName: 'config-test' })
        .mockResolvedValueOnce({ toolName: 'test_tool' })
        .mockResolvedValueOnce({ argsJson: '{}' })
        .mockResolvedValueOnce({ caseId: 'case-1', description: '' })
        .mockResolvedValueOnce({ continueAdding: false });

      await generate({
        config: configPath,
        snapshot: true,
        output: '/test-output/result.json',
      });

      // Verify config was validated
      expect(mocks.validateMCPConfig).toHaveBeenCalled();
      // Verify client was created with the validated config
      expect(mocks.createMCPClientForConfig).toHaveBeenCalledWith(validConfig);
    });
  });

  describe('appending to existing dataset', () => {
    it('should append to existing dataset when user confirms', async () => {
      // Create existing dataset
      vol.writeFileSync(
        '/test-output/existing.json',
        JSON.stringify({
          name: 'existing-dataset',
          description: 'Existing',
          cases: [
            { id: 'existing-case', toolName: 'old_tool', args: {} },
          ],
          metadata: { version: '1.0', created: '2024-01-01' },
        })
      );

      mocks.prompt
        .mockResolvedValueOnce({ append: true }) // Append to existing
        .mockResolvedValueOnce({ toolName: 'test_tool' })
        .mockResolvedValueOnce({ argsJson: '{}' })
        .mockResolvedValueOnce({ caseId: 'new-case', description: '' })
        .mockResolvedValueOnce({ continueAdding: false });

      await generate({
        config: configPath,
        snapshot: true,
        output: '/test-output/existing.json',
      });

      const content = vol.readFileSync(
        '/test-output/existing.json',
        'utf-8'
      ) as string;
      const dataset = JSON.parse(content);

      expect(dataset.name).toBe('existing-dataset');
      expect(dataset.cases).toHaveLength(2);
      expect(dataset.cases[0].id).toBe('existing-case');
      expect(dataset.cases[1].id).toBe('new-case');
    });
  });

  describe('error handling', () => {
    it('should exit when MCP connection fails', async () => {
      mocks.createMCPClientForConfig.mockRejectedValue(
        new Error('Connection failed')
      );

      await expect(
        generate({ config: configPath, output: '/test-output/fail.json' })
      ).rejects.toThrow('process.exit called');

      expect(mockExit).toHaveBeenCalledWith(1);
    });

    it('should handle tool call failures gracefully', async () => {
      mocks.mockClient.callTool.mockRejectedValue(new Error('Tool error'));

      mocks.prompt
        .mockResolvedValueOnce({ datasetName: 'error-test' })
        .mockResolvedValueOnce({ toolName: 'test_tool' })
        .mockResolvedValueOnce({ argsJson: '{}' })
        // No case details prompt since tool call failed
        .mockResolvedValueOnce({ continueAdding: false });

      await generate({
        config: configPath,
        snapshot: true,
        output: '/test-output/error.json',
      });

      // Should not create file since no cases were added
      expect(vol.existsSync('/test-output/error.json')).toBe(false);
    });
  });

  describe('client cleanup', () => {
    it('should close MCP client after generation', async () => {
      mocks.prompt
        .mockResolvedValueOnce({ datasetName: 'cleanup-test' })
        .mockResolvedValueOnce({ toolName: 'test_tool' })
        .mockResolvedValueOnce({ argsJson: '{}' })
        .mockResolvedValueOnce({ caseId: 'case-1', description: '' })
        .mockResolvedValueOnce({ continueAdding: false });

      await generate({
        config: configPath,
        snapshot: true,
        output: '/test-output/cleanup.json',
      });

      expect(mocks.closeMCPClient).toHaveBeenCalledWith(mocks.mockClient);
    });

    it('should close MCP client even when error occurs during tool listing', async () => {
      mocks.mockClient.listTools.mockRejectedValue(new Error('List failed'));

      try {
        await generate({ config: configPath, output: '/test-output/fail.json' });
      } catch {
        // Expected to throw due to error propagation
      }

      expect(mocks.closeMCPClient).toHaveBeenCalledWith(mocks.mockClient);
    });
  });
});
