import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock oauth4webapi before importing the module under test
const mocks = vi.hoisted(() => ({
  discoveryRequest: vi.fn(),
  processDiscoveryResponse: vi.fn(),
}));

vi.mock('oauth4webapi', () => ({
  discoveryRequest: mocks.discoveryRequest,
  processDiscoveryResponse: mocks.processDiscoveryResponse,
}));

import {
  discoverProtectedResource,
  discoverAuthorizationServer,
  DiscoveryError,
  MCP_PROTOCOL_VERSION,
} from './discovery.js';

describe('discovery', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock global fetch
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('discoverProtectedResource', () => {
    const validMetadata = {
      resource: 'https://api.example.com/mcp',
      authorization_servers: ['https://auth.example.com'],
      scopes_supported: ['read', 'write'],
    };

    it('discovers metadata with path-aware discovery', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(validMetadata),
      });

      const result = await discoverProtectedResource(
        'https://api.example.com/mcp/default'
      );

      expect(result.metadata).toEqual(validMetadata);
      expect(result.usedPathAwareDiscovery).toBe(true);
      expect(result.discoveryUrl).toBe(
        'https://api.example.com/.well-known/oauth-protected-resource/mcp/default'
      );
    });

    it('includes MCP-Protocol-Version header', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(validMetadata),
      });

      await discoverProtectedResource('https://api.example.com/mcp');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
          }),
        })
      );
    });

    it('falls back to base discovery on 404', async () => {
      // First call (path-aware) returns 404
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      // Second call (base) succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(validMetadata),
      });

      const result = await discoverProtectedResource(
        'https://api.example.com/mcp/default'
      );

      expect(result.metadata).toEqual(validMetadata);
      expect(result.usedPathAwareDiscovery).toBe(false);
      expect(result.discoveryUrl).toBe(
        'https://api.example.com/.well-known/oauth-protected-resource'
      );
    });

    it('throws DiscoveryError on non-404 error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        discoverProtectedResource('https://api.example.com/mcp')
      ).rejects.toThrow(DiscoveryError);

      await expect(
        discoverProtectedResource('https://api.example.com/mcp')
      ).rejects.toThrow(/500/);
    });

    it('throws when both path-aware and base discovery fail', async () => {
      // Both return 404
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(
        discoverProtectedResource('https://api.example.com/mcp')
      ).rejects.toThrow(DiscoveryError);
    });

    it('throws on missing resource field', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ authorization_servers: ['https://auth.example.com'] }),
      });

      await expect(
        discoverProtectedResource('https://api.example.com/mcp')
      ).rejects.toThrow('missing required "resource" field');
    });

    it('handles server at root path', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            resource: 'https://api.example.com',
            authorization_servers: ['https://auth.example.com'],
          }),
      });

      const result = await discoverProtectedResource('https://api.example.com/');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/.well-known/oauth-protected-resource/',
        expect.any(Object)
      );
      expect(result.usedPathAwareDiscovery).toBe(true);
    });
  });

  describe('discoverAuthorizationServer', () => {
    const mockAuthServer = {
      issuer: 'https://auth.example.com',
      authorization_endpoint: 'https://auth.example.com/authorize',
      token_endpoint: 'https://auth.example.com/token',
      registration_endpoint: 'https://auth.example.com/register',
    };

    beforeEach(() => {
      mocks.discoveryRequest.mockResolvedValue(new Response());
      mocks.processDiscoveryResponse.mockResolvedValue(mockAuthServer);
    });

    it('discovers authorization server metadata', async () => {
      const result = await discoverAuthorizationServer('https://auth.example.com');

      expect(result.server).toEqual(mockAuthServer);
      expect(result.issuer).toBe('https://auth.example.com');
    });

    it('includes MCP-Protocol-Version header in request', async () => {
      await discoverAuthorizationServer('https://auth.example.com');

      expect(mocks.discoveryRequest).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({
          algorithm: 'oauth2',
          headers: expect.any(Headers),
        })
      );

      // Verify the headers contain MCP-Protocol-Version
      const callArgs = mocks.discoveryRequest.mock.calls[0];
      expect(callArgs).toBeDefined();
      const options = callArgs![1];
      expect(options.headers.get('MCP-Protocol-Version')).toBe(MCP_PROTOCOL_VERSION);
    });

    it('passes correct issuer URL', async () => {
      await discoverAuthorizationServer('https://auth.example.com/oauth');

      expect(mocks.discoveryRequest).toHaveBeenCalledWith(
        new URL('https://auth.example.com/oauth'),
        expect.any(Object)
      );
    });

    it('throws on discovery failure', async () => {
      mocks.discoveryRequest.mockRejectedValue(new Error('Network error'));

      await expect(
        discoverAuthorizationServer('https://auth.example.com')
      ).rejects.toThrow('Network error');
    });

    it('throws on invalid response', async () => {
      mocks.processDiscoveryResponse.mockRejectedValue(
        new Error('Invalid discovery response')
      );

      await expect(
        discoverAuthorizationServer('https://auth.example.com')
      ).rejects.toThrow('Invalid discovery response');
    });
  });

  describe('DiscoveryError', () => {
    it('creates error with message, status, and url', () => {
      const error = new DiscoveryError(
        'Discovery failed',
        404,
        'https://example.com/.well-known/oauth-protected-resource'
      );

      expect(error.message).toBe('Discovery failed');
      expect(error.status).toBe(404);
      expect(error.url).toBe('https://example.com/.well-known/oauth-protected-resource');
      expect(error.name).toBe('DiscoveryError');
    });

    it('is instanceof Error', () => {
      const error = new DiscoveryError('Test');
      expect(error).toBeInstanceOf(Error);
    });
  });
});
