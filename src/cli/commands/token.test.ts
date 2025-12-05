import { describe, it, expect, vi, beforeEach } from 'vitest';

// Hoist mocks
const mocks = vi.hoisted(() => ({
  createFileOAuthStorage: vi.fn(),
  getStateDir: vi.fn(),
  mockStorage: {
    loadTokens: vi.fn(),
  },
}));

vi.mock('../../auth/storage.js', () => ({
  createFileOAuthStorage: mocks.createFileOAuthStorage,
  getStateDir: mocks.getStateDir,
  ENV_VAR_NAMES: {
    accessToken: 'MCP_ACCESS_TOKEN',
    refreshToken: 'MCP_REFRESH_TOKEN',
    tokenType: 'MCP_TOKEN_TYPE',
    expiresAt: 'MCP_TOKEN_EXPIRES_AT',
  },
}));

// Mock process.exit to prevent test from exiting
vi.spyOn(process, 'exit').mockImplementation((code) => {
  throw new Error(`process.exit called with code ${code}`);
});

// Capture console output - these mocks persist for all tests
const consoleOutput: string[] = [];
const consoleErrorOutput: string[] = [];

vi.spyOn(console, 'log').mockImplementation((...args) => {
  consoleOutput.push(args.join(' '));
});
vi.spyOn(console, 'error').mockImplementation((...args) => {
  consoleErrorOutput.push(args.join(' '));
});

import { token } from './token.js';

describe('token command', () => {
  const serverUrl = 'https://api.example.com/mcp';

  const mockTokens = {
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    tokenType: 'Bearer',
    expiresAt: 1234567890000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear output arrays instead of restoring mocks
    consoleOutput.length = 0;
    consoleErrorOutput.length = 0;

    mocks.createFileOAuthStorage.mockReturnValue(mocks.mockStorage);
    mocks.getStateDir.mockReturnValue('/mock/state/dir');
  });

  describe('env format (default)', () => {
    it('outputs tokens as KEY=value pairs', async () => {
      mocks.mockStorage.loadTokens.mockResolvedValue(mockTokens);

      await token(serverUrl, {});

      expect(consoleOutput).toContain('MCP_ACCESS_TOKEN=test-access-token');
      expect(consoleOutput).toContain('MCP_REFRESH_TOKEN=test-refresh-token');
      expect(consoleOutput).toContain('MCP_TOKEN_TYPE=Bearer');
      expect(consoleOutput).toContain('MCP_TOKEN_EXPIRES_AT=1234567890000');
    });

    it('omits refresh token when not present', async () => {
      mocks.mockStorage.loadTokens.mockResolvedValue({
        accessToken: 'test-token',
        tokenType: 'Bearer',
      });

      await token(serverUrl, { format: 'env' });

      expect(consoleOutput).toContain('MCP_ACCESS_TOKEN=test-token');
      expect(consoleOutput).toContain('MCP_TOKEN_TYPE=Bearer');
      expect(consoleOutput.join('\n')).not.toContain('MCP_REFRESH_TOKEN');
      expect(consoleOutput.join('\n')).not.toContain('MCP_TOKEN_EXPIRES_AT');
    });
  });

  describe('json format', () => {
    it('outputs tokens as JSON object', async () => {
      mocks.mockStorage.loadTokens.mockResolvedValue(mockTokens);

      await token(serverUrl, { format: 'json' });

      const output = JSON.parse(consoleOutput.join(''));
      expect(output.MCP_ACCESS_TOKEN).toBe('test-access-token');
      expect(output.MCP_REFRESH_TOKEN).toBe('test-refresh-token');
      expect(output.MCP_TOKEN_TYPE).toBe('Bearer');
      expect(output.MCP_TOKEN_EXPIRES_AT).toBe(1234567890000);
    });

    it('omits optional fields when not present', async () => {
      mocks.mockStorage.loadTokens.mockResolvedValue({
        accessToken: 'test-token',
        tokenType: 'Bearer',
      });

      await token(serverUrl, { format: 'json' });

      const output = JSON.parse(consoleOutput.join(''));
      expect(output.MCP_ACCESS_TOKEN).toBe('test-token');
      expect(output.MCP_TOKEN_TYPE).toBe('Bearer');
      expect(output.MCP_REFRESH_TOKEN).toBeUndefined();
      expect(output.MCP_TOKEN_EXPIRES_AT).toBeUndefined();
    });
  });

  describe('gh format', () => {
    it('outputs gh secret set commands', async () => {
      mocks.mockStorage.loadTokens.mockResolvedValue(mockTokens);

      await token(serverUrl, { format: 'gh' });

      expect(consoleOutput[0]).toContain('# Run these commands');
      expect(consoleOutput).toContainEqual(
        expect.stringContaining('gh secret set MCP_ACCESS_TOKEN --body "test-access-token"')
      );
      expect(consoleOutput).toContainEqual(
        expect.stringContaining('gh secret set MCP_REFRESH_TOKEN --body "test-refresh-token"')
      );
      expect(consoleOutput).toContainEqual(
        expect.stringContaining('gh secret set MCP_TOKEN_TYPE --body "Bearer"')
      );
      expect(consoleOutput).toContainEqual(
        expect.stringContaining('gh secret set MCP_TOKEN_EXPIRES_AT --body "1234567890000"')
      );
    });
  });

  describe('error handling', () => {
    it('exits with error for invalid URL', async () => {
      await expect(token('not-a-url', {})).rejects.toThrow(
        'process.exit called with code 1'
      );

      expect(consoleErrorOutput[0]).toContain('Invalid URL');
    });

    it('exits with error when no tokens found', async () => {
      mocks.mockStorage.loadTokens.mockResolvedValue(null);

      await expect(token(serverUrl, {})).rejects.toThrow(
        'process.exit called with code 1'
      );

      expect(consoleErrorOutput[0]).toContain('No tokens found');
      expect(consoleErrorOutput.join('\n')).toContain('mcp-test login');
    });

    it('shows expected storage location when tokens not found', async () => {
      mocks.mockStorage.loadTokens.mockResolvedValue(null);
      mocks.getStateDir.mockReturnValue('/custom/path/mcp-tests');

      await expect(token(serverUrl, {})).rejects.toThrow(
        'process.exit called with code 1'
      );

      expect(consoleErrorOutput.join('\n')).toContain('/custom/path/mcp-tests');
    });
  });

  describe('custom state directory', () => {
    it('passes stateDir to storage', async () => {
      mocks.mockStorage.loadTokens.mockResolvedValue(mockTokens);

      await token(serverUrl, { stateDir: '/custom/dir' });

      expect(mocks.createFileOAuthStorage).toHaveBeenCalledWith({
        serverUrl,
        stateDir: '/custom/dir',
      });
    });
  });
});
