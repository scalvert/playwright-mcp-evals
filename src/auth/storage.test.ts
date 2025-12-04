import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { homedir } from 'node:os';
import * as path from 'node:path';

// Mock fs/promises before importing the module under test
const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  rename: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  readFile: mocks.readFile,
  writeFile: mocks.writeFile,
  mkdir: mocks.mkdir,
  rename: mocks.rename,
}));

import {
  generateServerKey,
  getStateDir,
  loadTokensFromEnv,
  injectTokens,
  createFileOAuthStorage,
  ENV_VAR_NAMES,
} from './storage.js';

describe('storage', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    process.env = { ...originalEnv };
    // Default mock implementations
    mocks.mkdir.mockResolvedValue(undefined);
    mocks.writeFile.mockResolvedValue(undefined);
    mocks.rename.mockResolvedValue(undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('generateServerKey', () => {
    it('generates key from simple hostname', () => {
      const key = generateServerKey('https://api.example.com');
      expect(key).toBe('api.example.com');
    });

    it('includes port when specified', () => {
      const key = generateServerKey('https://api.example.com:8080');
      expect(key).toBe('api.example.com_8080');
    });

    it('includes path with underscores', () => {
      const key = generateServerKey('https://api.example.com/mcp/default');
      expect(key).toBe('api.example.com_mcp_default');
    });

    it('includes port and path', () => {
      const key = generateServerKey('https://api.example.com:8080/mcp/v2');
      expect(key).toBe('api.example.com_8080_mcp_v2');
    });

    it('handles trailing slashes', () => {
      const key = generateServerKey('https://api.example.com/mcp/');
      expect(key).toBe('api.example.com_mcp');
    });

    it('handles root path', () => {
      const key = generateServerKey('https://api.example.com/');
      expect(key).toBe('api.example.com');
    });

    it('replaces problematic characters', () => {
      const key = generateServerKey('https://api.example.com/path%20with%20spaces');
      // %20 characters should be replaced with underscores
      expect(key).toMatch(/^api\.example\.com_path/);
      expect(key).not.toMatch(/%/);
    });
  });

  describe('getStateDir', () => {
    it('uses custom directory when provided', () => {
      const dir = getStateDir('https://api.example.com', '/custom/dir');
      expect(dir).toBe(path.join('/custom/dir', 'api.example.com'));
    });

    it('uses XDG_STATE_HOME on Linux when set', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'linux' });
      process.env.XDG_STATE_HOME = '/home/user/.state';

      const dir = getStateDir('https://api.example.com');

      expect(dir).toBe('/home/user/.state/mcp-tests/api.example.com');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('uses LOCALAPPDATA on Windows', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });
      process.env.LOCALAPPDATA = 'C:\\Users\\Test\\AppData\\Local';

      const dir = getStateDir('https://api.example.com');

      expect(dir).toBe(
        path.join('C:\\Users\\Test\\AppData\\Local', 'mcp-tests', 'api.example.com')
      );

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('uses default directory on macOS', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const dir = getStateDir('https://api.example.com');

      expect(dir).toBe(
        path.join(homedir(), '.local', 'state', 'mcp-tests', 'api.example.com')
      );

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('loadTokensFromEnv', () => {
    it('returns null when MCP_ACCESS_TOKEN is not set', () => {
      delete process.env[ENV_VAR_NAMES.accessToken];

      const tokens = loadTokensFromEnv();

      expect(tokens).toBeNull();
    });

    it('returns tokens with access token only', () => {
      process.env[ENV_VAR_NAMES.accessToken] = 'test-access-token';

      const tokens = loadTokensFromEnv();

      expect(tokens).toEqual({
        accessToken: 'test-access-token',
        refreshToken: undefined,
        tokenType: 'Bearer',
        expiresAt: undefined,
      });
    });

    it('returns tokens with all fields', () => {
      process.env[ENV_VAR_NAMES.accessToken] = 'test-access-token';
      process.env[ENV_VAR_NAMES.refreshToken] = 'test-refresh-token';
      process.env[ENV_VAR_NAMES.tokenType] = 'CustomType';
      process.env[ENV_VAR_NAMES.expiresAt] = '1700000000000';

      const tokens = loadTokensFromEnv();

      expect(tokens).toEqual({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        tokenType: 'CustomType',
        expiresAt: 1700000000000,
      });
    });

    it('handles invalid expiresAt gracefully', () => {
      process.env[ENV_VAR_NAMES.accessToken] = 'test-access-token';
      process.env[ENV_VAR_NAMES.expiresAt] = 'not-a-number';

      const tokens = loadTokensFromEnv();

      expect(tokens).toEqual({
        accessToken: 'test-access-token',
        refreshToken: undefined,
        tokenType: 'Bearer',
        expiresAt: undefined,
      });
    });
  });

  describe('injectTokens', () => {
    it('writes tokens to correct location', async () => {
      const tokens = {
        accessToken: 'injected-token',
        tokenType: 'Bearer',
      };

      await injectTokens('https://api.example.com', tokens);

      // Should create directory
      expect(mocks.mkdir).toHaveBeenCalled();

      // Should write to temp file with secure permissions
      expect(mocks.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('tokens.json.tmp'),
        expect.stringContaining('injected-token'),
        { encoding: 'utf-8', mode: 0o600 }
      );

      // Should rename to final path
      expect(mocks.rename).toHaveBeenCalled();
    });

    it('uses custom state directory', async () => {
      const tokens = {
        accessToken: 'injected-token',
        tokenType: 'Bearer',
      };

      await injectTokens('https://api.example.com', tokens, '/custom/state');

      expect(mocks.mkdir).toHaveBeenCalledWith(
        expect.stringContaining('/custom/state'),
        { recursive: true, mode: 0o700 }
      );
    });
  });

  describe('FileOAuthStorage', () => {
    const serverUrl = 'https://api.example.com/mcp';
    let storage: ReturnType<typeof createFileOAuthStorage>;

    beforeEach(() => {
      storage = createFileOAuthStorage({ serverUrl });
    });

    describe('loadTokens', () => {
      it('returns tokens when file exists', async () => {
        const storedTokens = {
          accessToken: 'stored-token',
          tokenType: 'Bearer',
          expiresAt: Date.now() + 3600000,
        };
        mocks.readFile.mockResolvedValue(JSON.stringify(storedTokens));

        const tokens = await storage.loadTokens();

        expect(tokens).toEqual(storedTokens);
      });

      it('returns null when file does not exist', async () => {
        const error = new Error('ENOENT') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        mocks.readFile.mockRejectedValue(error);

        const tokens = await storage.loadTokens();

        expect(tokens).toBeNull();
      });

      it('throws on other file errors', async () => {
        const error = new Error('Permission denied') as NodeJS.ErrnoException;
        error.code = 'EACCES';
        mocks.readFile.mockRejectedValue(error);

        await expect(storage.loadTokens()).rejects.toThrow('Permission denied');
      });
    });

    describe('saveTokens', () => {
      it('writes tokens atomically', async () => {
        const tokens = {
          accessToken: 'new-token',
          tokenType: 'Bearer',
        };

        await storage.saveTokens(tokens);

        // Should create directory with secure permissions
        expect(mocks.mkdir).toHaveBeenCalledWith(expect.any(String), {
          recursive: true,
          mode: 0o700,
        });

        // Should write to .tmp file first
        const writeCall = mocks.writeFile.mock.calls[0];
        expect(writeCall).toBeDefined();
        expect(writeCall![0]).toMatch(/tokens\.json\.tmp$/);
        expect(JSON.parse(writeCall![1] as string)).toEqual(tokens);

        // Should rename to final path
        const renameCall = mocks.rename.mock.calls[0];
        expect(renameCall).toBeDefined();
        expect(renameCall![0]).toMatch(/tokens\.json\.tmp$/);
        expect(renameCall![1]).toMatch(/tokens\.json$/);
      });
    });

    describe('hasValidToken', () => {
      it('returns false when no tokens exist', async () => {
        const error = new Error('ENOENT') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        mocks.readFile.mockRejectedValue(error);

        const valid = await storage.hasValidToken();

        expect(valid).toBe(false);
      });

      it('returns false when token has no accessToken', async () => {
        mocks.readFile.mockResolvedValue(
          JSON.stringify({ tokenType: 'Bearer' })
        );

        const valid = await storage.hasValidToken();

        expect(valid).toBe(false);
      });

      it('returns true when token has no expiration', async () => {
        mocks.readFile.mockResolvedValue(
          JSON.stringify({
            accessToken: 'valid-token',
            tokenType: 'Bearer',
          })
        );

        const valid = await storage.hasValidToken();

        expect(valid).toBe(true);
      });

      it('returns true when token is not expired', async () => {
        const futureExpiry = Date.now() + 3600000; // 1 hour from now
        mocks.readFile.mockResolvedValue(
          JSON.stringify({
            accessToken: 'valid-token',
            tokenType: 'Bearer',
            expiresAt: futureExpiry,
          })
        );

        const valid = await storage.hasValidToken();

        expect(valid).toBe(true);
      });

      it('returns false when token is expired', async () => {
        const pastExpiry = Date.now() - 3600000; // 1 hour ago
        mocks.readFile.mockResolvedValue(
          JSON.stringify({
            accessToken: 'expired-token',
            tokenType: 'Bearer',
            expiresAt: pastExpiry,
          })
        );

        const valid = await storage.hasValidToken();

        expect(valid).toBe(false);
      });

      it('returns false when token expires within buffer', async () => {
        const soonExpiry = Date.now() + 30000; // 30 seconds from now
        mocks.readFile.mockResolvedValue(
          JSON.stringify({
            accessToken: 'soon-expired-token',
            tokenType: 'Bearer',
            expiresAt: soonExpiry,
          })
        );

        // Default buffer is 60 seconds
        const valid = await storage.hasValidToken();

        expect(valid).toBe(false);
      });

      it('uses custom buffer time', async () => {
        const soonExpiry = Date.now() + 30000; // 30 seconds from now
        mocks.readFile.mockResolvedValue(
          JSON.stringify({
            accessToken: 'valid-token',
            tokenType: 'Bearer',
            expiresAt: soonExpiry,
          })
        );

        // With 10 second buffer, token should be valid
        const valid = await storage.hasValidToken(10000);

        expect(valid).toBe(true);
      });
    });

    describe('loadClient / saveClient', () => {
      it('saves and loads client info', async () => {
        const clientInfo = {
          clientId: 'test-client-id',
          clientSecret: 'test-secret',
        };

        await storage.saveClient(clientInfo);

        mocks.readFile.mockResolvedValue(JSON.stringify(clientInfo));
        const loaded = await storage.loadClient();

        expect(loaded).toEqual(clientInfo);
      });

      it('returns null when client file does not exist', async () => {
        const error = new Error('ENOENT') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        mocks.readFile.mockRejectedValue(error);

        const client = await storage.loadClient();

        expect(client).toBeNull();
      });
    });

    describe('loadServerMetadata / saveServerMetadata', () => {
      it('saves and loads server metadata', async () => {
        const metadata = {
          authServer: {
            server: { issuer: 'https://auth.example.com' },
            issuer: 'https://auth.example.com',
          },
          protectedResource: {
            resource: 'https://api.example.com',
            authorization_servers: ['https://auth.example.com'],
          },
          discoveredAt: Date.now(),
        };

        await storage.saveServerMetadata(metadata);

        mocks.readFile.mockResolvedValue(JSON.stringify(metadata));
        const loaded = await storage.loadServerMetadata();

        expect(loaded).toEqual(metadata);
      });

      it('returns null when server metadata file does not exist', async () => {
        const error = new Error('ENOENT') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        mocks.readFile.mockRejectedValue(error);

        const metadata = await storage.loadServerMetadata();

        expect(metadata).toBeNull();
      });
    });
  });
});
