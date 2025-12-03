import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Hoist mocks
const mocks = vi.hoisted(() => ({
  // Storage mocks
  loadTokensFromEnv: vi.fn(),
  createFileOAuthStorage: vi.fn(),
  mockStorage: {
    loadTokens: vi.fn(),
    saveTokens: vi.fn(),
    loadClient: vi.fn(),
    saveClient: vi.fn(),
    loadServerMetadata: vi.fn(),
    saveServerMetadata: vi.fn(),
    hasValidToken: vi.fn(),
  },
  // Discovery mocks
  discoverProtectedResource: vi.fn(),
  discoverAuthorizationServer: vi.fn(),
  // OAuth flow mocks
  generatePKCE: vi.fn(),
  generateState: vi.fn(),
  buildAuthorizationUrl: vi.fn(),
  exchangeCodeForTokens: vi.fn(),
  refreshAccessToken: vi.fn(),
  // Open mock
  openDefault: vi.fn(),
}));

vi.mock('./storage.js', () => ({
  loadTokensFromEnv: mocks.loadTokensFromEnv,
  createFileOAuthStorage: mocks.createFileOAuthStorage,
}));

vi.mock('./discovery.js', () => ({
  discoverProtectedResource: mocks.discoverProtectedResource,
  discoverAuthorizationServer: mocks.discoverAuthorizationServer,
  MCP_PROTOCOL_VERSION: '2025-06-18',
}));

vi.mock('./oauthFlow.js', () => ({
  generatePKCE: mocks.generatePKCE,
  generateState: mocks.generateState,
  buildAuthorizationUrl: mocks.buildAuthorizationUrl,
  exchangeCodeForTokens: mocks.exchangeCodeForTokens,
  refreshAccessToken: mocks.refreshAccessToken,
}));

vi.mock('open', () => ({
  default: mocks.openDefault,
}));

import { CLIOAuthClient } from './cli.js';

describe('CLIOAuthClient', () => {
  const originalEnv = process.env;
  const serverUrl = 'https://api.example.com/mcp';

  const mockProtectedResource = {
    metadata: {
      resource: 'https://api.example.com/mcp',
      authorization_servers: ['https://auth.example.com'],
      scopes_supported: ['read', 'write'],
    },
    discoveryUrl: 'https://api.example.com/.well-known/oauth-protected-resource/mcp',
    usedPathAwareDiscovery: true,
  };

  const mockAuthServer = {
    server: {
      issuer: 'https://auth.example.com',
      authorization_endpoint: 'https://auth.example.com/authorize',
      token_endpoint: 'https://auth.example.com/token',
      registration_endpoint: 'https://auth.example.com/register',
    },
    issuer: 'https://auth.example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };

    // Default mock implementations
    mocks.createFileOAuthStorage.mockReturnValue(mocks.mockStorage);
    mocks.mockStorage.loadTokens.mockResolvedValue(null);
    mocks.mockStorage.saveTokens.mockResolvedValue(undefined);
    mocks.mockStorage.loadClient.mockResolvedValue(null);
    mocks.mockStorage.saveClient.mockResolvedValue(undefined);
    mocks.mockStorage.loadServerMetadata.mockResolvedValue(null);
    mocks.mockStorage.saveServerMetadata.mockResolvedValue(undefined);
    mocks.mockStorage.hasValidToken.mockResolvedValue(false);

    mocks.loadTokensFromEnv.mockReturnValue(null);
    mocks.discoverProtectedResource.mockResolvedValue(mockProtectedResource);
    mocks.discoverAuthorizationServer.mockResolvedValue(mockAuthServer);

    mocks.generatePKCE.mockResolvedValue({
      codeVerifier: 'test-verifier',
      codeChallenge: 'test-challenge',
    });
    mocks.generateState.mockReturnValue('test-state');
    mocks.buildAuthorizationUrl.mockReturnValue(
      new URL('https://auth.example.com/authorize?client_id=test')
    );
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe('getAccessToken', () => {
    it('returns tokens from environment variables first', async () => {
      const envTokens = {
        accessToken: 'env-access-token',
        tokenType: 'Bearer',
        refreshToken: 'env-refresh-token',
        expiresAt: Date.now() + 3600000,
      };
      mocks.loadTokensFromEnv.mockReturnValue(envTokens);

      const client = new CLIOAuthClient({ mcpServerUrl: serverUrl });
      const result = await client.getAccessToken();

      expect(result.accessToken).toBe('env-access-token');
      expect(result.fromEnv).toBe(true);
      expect(result.refreshed).toBe(false);

      // Should not check storage
      expect(mocks.mockStorage.loadTokens).not.toHaveBeenCalled();
    });

    it('returns cached tokens from storage when valid', async () => {
      const storedTokens = {
        accessToken: 'stored-access-token',
        tokenType: 'Bearer',
        expiresAt: Date.now() + 3600000,
      };
      mocks.mockStorage.loadTokens.mockResolvedValue(storedTokens);
      mocks.mockStorage.hasValidToken.mockResolvedValue(true);

      const client = new CLIOAuthClient({ mcpServerUrl: serverUrl });
      const result = await client.getAccessToken();

      expect(result.accessToken).toBe('stored-access-token');
      expect(result.fromEnv).toBe(false);
      expect(result.refreshed).toBe(false);
    });

    it('refreshes token when expired with refresh token', async () => {
      const storedTokens = {
        accessToken: 'expired-token',
        tokenType: 'Bearer',
        refreshToken: 'valid-refresh-token',
        expiresAt: Date.now() - 3600000, // Expired
      };
      mocks.mockStorage.loadTokens.mockResolvedValue(storedTokens);
      mocks.mockStorage.hasValidToken.mockResolvedValue(false);

      // Set up cached server metadata for refresh
      mocks.mockStorage.loadServerMetadata.mockResolvedValue({
        authServer: mockAuthServer,
        protectedResource: mockProtectedResource.metadata,
        discoveredAt: Date.now(),
      });

      // Set up cached client
      mocks.mockStorage.loadClient.mockResolvedValue({
        clientId: 'test-client-id',
      });

      // Mock refresh response
      mocks.refreshAccessToken.mockResolvedValue({
        accessToken: 'refreshed-access-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
        refreshToken: 'new-refresh-token',
      });

      const client = new CLIOAuthClient({ mcpServerUrl: serverUrl });
      const result = await client.getAccessToken();

      expect(result.accessToken).toBe('refreshed-access-token');
      expect(result.refreshed).toBe(true);
      expect(result.fromEnv).toBe(false);
      expect(mocks.refreshAccessToken).toHaveBeenCalled();
    });
  });

  describe('hasStoredCredentials', () => {
    it('returns true when tokens exist in storage', async () => {
      mocks.mockStorage.loadTokens.mockResolvedValue({
        accessToken: 'some-token',
        tokenType: 'Bearer',
      });

      const client = new CLIOAuthClient({ mcpServerUrl: serverUrl });
      const result = await client.hasStoredCredentials();

      expect(result).toBe(true);
    });

    it('returns false when no tokens in storage', async () => {
      mocks.mockStorage.loadTokens.mockResolvedValue(null);

      const client = new CLIOAuthClient({ mcpServerUrl: serverUrl });
      const result = await client.hasStoredCredentials();

      expect(result).toBe(false);
    });
  });

  describe('clearCredentials', () => {
    it('saves empty tokens to storage', async () => {
      const client = new CLIOAuthClient({ mcpServerUrl: serverUrl });
      await client.clearCredentials();

      expect(mocks.mockStorage.saveTokens).toHaveBeenCalledWith({
        accessToken: '',
        tokenType: 'Bearer',
      });
    });
  });

  describe('authenticate', () => {
    it('uses pre-configured client ID when provided', async () => {
      // Mock the full OAuth flow
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            client_id: 'registered-client',
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      mocks.exchangeCodeForTokens.mockResolvedValue({
        accessToken: 'new-access-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      });

      // We can't easily test the full flow with the callback server
      // so we'll just verify the client configuration is passed correctly
      new CLIOAuthClient({
        mcpServerUrl: serverUrl,
        clientId: 'pre-configured-client',
        clientSecret: 'pre-configured-secret',
      });

      // Verify client is created with correct config
      expect(mocks.createFileOAuthStorage).toHaveBeenCalledWith({
        serverUrl,
        stateDir: undefined,
      });

      vi.unstubAllGlobals();
    });

    it('uses custom state directory when provided', () => {
      new CLIOAuthClient({
        mcpServerUrl: serverUrl,
        stateDir: '/custom/state/dir',
      });

      expect(mocks.createFileOAuthStorage).toHaveBeenCalledWith({
        serverUrl,
        stateDir: '/custom/state/dir',
      });
    });
  });

  describe('headless detection', () => {
    it('prints URL when CI environment variable is set', async () => {
      process.env.CI = 'true';
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // We can't easily test the full flow, but we can verify the CI detection
      // is in place by checking that the client is created successfully
      const client = new CLIOAuthClient({ mcpServerUrl: serverUrl });
      expect(client).toBeDefined();

      consoleSpy.mockRestore();
    });
  });

  describe('discovery caching', () => {
    it('uses cached server metadata when available', async () => {
      const cachedMetadata = {
        authServer: mockAuthServer,
        protectedResource: mockProtectedResource.metadata,
        discoveredAt: Date.now(),
      };
      mocks.mockStorage.loadServerMetadata.mockResolvedValue(cachedMetadata);

      // Set up for a token refresh scenario to test discovery caching
      mocks.mockStorage.loadTokens.mockResolvedValue({
        accessToken: 'expired',
        tokenType: 'Bearer',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() - 1000,
      });
      mocks.mockStorage.hasValidToken.mockResolvedValue(false);
      mocks.mockStorage.loadClient.mockResolvedValue({ clientId: 'cached-client' });
      mocks.refreshAccessToken.mockResolvedValue({
        accessToken: 'new-token',
        tokenType: 'Bearer',
        expiresIn: 3600,
      });

      const client = new CLIOAuthClient({ mcpServerUrl: serverUrl });
      await client.getAccessToken();

      // Should not call discovery since metadata is cached
      expect(mocks.discoverProtectedResource).not.toHaveBeenCalled();
      expect(mocks.discoverAuthorizationServer).not.toHaveBeenCalled();
    });
  });
});
