/**
 * CLI OAuth client for command-line authentication flows
 *
 * Provides browser-based OAuth authentication for CLI environments,
 * with support for environment variable token injection for CI/CD.
 */

import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import Debug from 'debug';
import {
  generatePKCE,
  generateState,
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  type AuthServerMetadata,
} from './oauthFlow.js';
import {
  discoverProtectedResource,
  discoverAuthorizationServer,
  MCP_PROTOCOL_VERSION,
  type ProtectedResourceMetadata,
} from './discovery.js';
import {
  createFileOAuthStorage,
  loadTokensFromEnv,
  type OAuthStorage,
  type StoredServerMetadata,
} from './storage.js';
import type { StoredTokens, StoredClientInfo, TokenResult } from './types.js';

const debug = Debug('mcp-testing:cli-oauth');

/**
 * Configuration for CLI OAuth client
 */
export interface CLIOAuthClientConfig {
  /**
   * MCP server URL (for protected resource discovery)
   */
  mcpServerUrl: string;

  /**
   * Scopes to request (optional, uses discovered scopes if not provided)
   */
  scopes?: Array<string>;

  /**
   * Custom storage directory
   */
  stateDir?: string;

  /**
   * Pre-registered client ID (skips DCR if provided)
   */
  clientId?: string;

  /**
   * Pre-registered client secret
   */
  clientSecret?: string;

  /**
   * Preferred callback port (default: random available port)
   */
  callbackPort?: number;

  /**
   * Timeout for OAuth flow in milliseconds (default: 300000 = 5 min)
   */
  timeoutMs?: number;

  /**
   * Client name for DCR registration
   */
  clientName?: string;
}

/**
 * Result of CLI OAuth authentication
 */
export interface CLIOAuthResult {
  /**
   * Access token
   */
  accessToken: string;

  /**
   * Token type (typically "Bearer")
   */
  tokenType: string;

  /**
   * Expiration timestamp (Unix ms)
   */
  expiresAt?: number;

  /**
   * Whether token was refreshed vs newly acquired
   */
  refreshed: boolean;

  /**
   * Whether token came from environment variables
   */
  fromEnv: boolean;
}

/**
 * Default timeout for OAuth flow (5 minutes)
 */
const DEFAULT_TIMEOUT_MS = 300_000;

/**
 * Default client name for DCR
 */
const DEFAULT_CLIENT_NAME = '@mcp-testing/server-tester';

/**
 * CLI OAuth client for command-line authentication flows
 */
export class CLIOAuthClient {
  private readonly config: CLIOAuthClientConfig;
  private readonly storage: OAuthStorage;

  constructor(config: CLIOAuthClientConfig) {
    this.config = config;
    this.storage = createFileOAuthStorage({
      serverUrl: config.mcpServerUrl,
      stateDir: config.stateDir,
    });
  }

  /**
   * Get a valid access token, authenticating if necessary
   *
   * Token resolution priority:
   * 1. Check environment variables (for CI/CD)
   * 2. Check file storage for cached tokens
   * 3. Try to refresh if expired but refresh token exists
   * 4. Run full OAuth flow if needed
   */
  async getAccessToken(): Promise<CLIOAuthResult> {
    // 1. Check environment variables first (CI/CD support)
    const envTokens = loadTokensFromEnv();
    if (envTokens) {
      debug('Using tokens from environment variables');
      return {
        accessToken: envTokens.accessToken,
        tokenType: envTokens.tokenType,
        expiresAt: envTokens.expiresAt,
        refreshed: false,
        fromEnv: true,
      };
    }

    // 2. Check file storage for cached tokens
    const storedTokens = await this.storage.loadTokens();

    if (storedTokens?.accessToken) {
      // Check if token is still valid
      const isValid = await this.storage.hasValidToken();

      if (isValid) {
        debug('Using cached tokens from storage');
        return {
          accessToken: storedTokens.accessToken,
          tokenType: storedTokens.tokenType,
          expiresAt: storedTokens.expiresAt,
          refreshed: false,
          fromEnv: false,
        };
      }

      // 3. Try to refresh if we have a refresh token
      if (storedTokens.refreshToken) {
        debug('Token expired, attempting refresh');
        try {
          const refreshedTokens = await this.refreshStoredToken(storedTokens);
          return {
            accessToken: refreshedTokens.accessToken,
            tokenType: refreshedTokens.tokenType,
            expiresAt: refreshedTokens.expiresAt,
            refreshed: true,
            fromEnv: false,
          };
        } catch (error) {
          debug('Token refresh failed, will re-authenticate:', error);
          // Fall through to full authentication
        }
      }
    }

    // 4. Run full OAuth flow
    debug('Performing full OAuth authentication');
    return this.authenticate();
  }

  /**
   * Force a new authentication flow
   */
  async authenticate(): Promise<CLIOAuthResult> {
    // Discover servers
    const { protectedResource, authServer } = await this.discoverServers();

    // Get or register client
    const client = await this.getOrRegisterClient(authServer);

    // Perform OAuth flow
    const tokens = await this.performOAuthFlow(authServer, client, protectedResource);

    return {
      accessToken: tokens.accessToken,
      tokenType: tokens.tokenType,
      expiresAt: tokens.expiresAt,
      refreshed: false,
      fromEnv: false,
    };
  }

  /**
   * Check if stored credentials exist (may be expired)
   */
  async hasStoredCredentials(): Promise<boolean> {
    const tokens = await this.storage.loadTokens();
    return tokens?.accessToken !== undefined;
  }

  /**
   * Clear stored credentials
   */
  async clearCredentials(): Promise<void> {
    // Save empty tokens to clear the file
    await this.storage.saveTokens({
      accessToken: '',
      tokenType: 'Bearer',
    });
    debug('Cleared stored credentials');
  }

  /**
   * Discover protected resource and authorization server
   */
  private async discoverServers(): Promise<{
    protectedResource: ProtectedResourceMetadata;
    authServer: AuthServerMetadata;
  }> {
    // Check cached server metadata
    const cachedMetadata = await this.storage.loadServerMetadata();
    if (cachedMetadata) {
      debug('Using cached server metadata');
      return {
        protectedResource: cachedMetadata.protectedResource,
        authServer: cachedMetadata.authServer,
      };
    }

    // Discover protected resource
    debug('Discovering protected resource:', this.config.mcpServerUrl);
    const prResult = await discoverProtectedResource(this.config.mcpServerUrl);
    debug('Found protected resource:', prResult.metadata.resource);

    // Get authorization server URL
    const authServerUrl = prResult.metadata.authorization_servers?.[0];
    if (!authServerUrl) {
      throw new Error(
        'No authorization servers found in protected resource metadata'
      );
    }

    // Discover authorization server
    debug('Discovering authorization server:', authServerUrl);
    const authServer = await discoverAuthorizationServer(authServerUrl);
    debug('Found authorization server:', authServer.issuer);

    // Cache metadata
    const metadata: StoredServerMetadata = {
      authServer,
      protectedResource: prResult.metadata,
      discoveredAt: Date.now(),
    };
    await this.storage.saveServerMetadata(metadata);

    return {
      protectedResource: prResult.metadata,
      authServer,
    };
  }

  /**
   * Get existing client or register new one via DCR
   */
  private async getOrRegisterClient(
    authServer: AuthServerMetadata
  ): Promise<StoredClientInfo> {
    // Use pre-configured client if provided
    if (this.config.clientId) {
      debug('Using pre-configured client ID');
      return {
        clientId: this.config.clientId,
        clientSecret: this.config.clientSecret,
      };
    }

    // Check cached client
    const cachedClient = await this.storage.loadClient();
    if (cachedClient?.clientId) {
      debug('Using cached client registration');
      return cachedClient;
    }

    // Register new client via DCR
    debug('Registering new client via DCR');
    const client = await this.registerClient(authServer);
    await this.storage.saveClient(client);

    return client;
  }

  /**
   * Register a new client via Dynamic Client Registration
   */
  private async registerClient(
    authServer: AuthServerMetadata
  ): Promise<StoredClientInfo> {
    const registrationEndpoint = authServer.server.registration_endpoint;
    if (!registrationEndpoint) {
      throw new Error(
        'Authorization server does not support Dynamic Client Registration. ' +
          'Please provide a clientId in the configuration.'
      );
    }

    // We'll use a placeholder redirect URI for now
    // The actual port will be determined when we start the callback server
    const redirectUri = 'http://127.0.0.1:0/callback';

    const response = await fetch(registrationEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': MCP_PROTOCOL_VERSION,
      },
      body: JSON.stringify({
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        client_name: this.config.clientName ?? DEFAULT_CLIENT_NAME,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Dynamic Client Registration failed: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    const data = (await response.json()) as {
      client_id: string;
      client_secret?: string;
      client_id_issued_at?: number;
      client_secret_expires_at?: number;
    };

    debug('Client registered:', data.client_id);

    return {
      clientId: data.client_id,
      clientSecret: data.client_secret,
      clientIdIssuedAt: data.client_id_issued_at,
      clientSecretExpiresAt: data.client_secret_expires_at,
    };
  }

  /**
   * Perform the full OAuth authorization flow
   */
  private async performOAuthFlow(
    authServer: AuthServerMetadata,
    client: StoredClientInfo,
    protectedResource: ProtectedResourceMetadata
  ): Promise<StoredTokens> {
    // Generate PKCE and state
    const pkce = await generatePKCE();
    const state = generateState();

    // Start callback server
    const { server, port, codePromise } = await this.startCallbackServer(state);
    const redirectUri = `http://127.0.0.1:${port}/callback`;

    try {
      // Build authorization URL
      const scopes = this.config.scopes ??
        protectedResource.scopes_supported ?? ['openid'];

      const authUrl = buildAuthorizationUrl({
        authServer,
        clientId: client.clientId,
        redirectUri,
        scopes,
        codeChallenge: pkce.codeChallenge,
        state,
        resource: protectedResource.resource,
      });

      // Open browser or print URL
      await this.openBrowserOrPrintUrl(authUrl);

      // Wait for callback
      debug('Waiting for OAuth callback...');
      const code = await codePromise;
      debug('Received authorization code');

      // Exchange code for tokens
      const tokenResult = await exchangeCodeForTokens({
        authServer,
        clientId: client.clientId,
        clientSecret: client.clientSecret,
        code,
        codeVerifier: pkce.codeVerifier,
        redirectUri,
      });

      // Store tokens
      const tokens = this.tokenResultToStoredTokens(tokenResult);
      await this.storage.saveTokens(tokens);

      return tokens;
    } finally {
      // Clean up callback server
      server.close();
    }
  }

  /**
   * Refresh an expired token
   */
  private async refreshStoredToken(
    storedTokens: StoredTokens
  ): Promise<StoredTokens> {
    if (!storedTokens.refreshToken) {
      throw new Error('No refresh token available');
    }

    // Get cached server metadata
    const metadata = await this.storage.loadServerMetadata();
    if (!metadata) {
      throw new Error('No cached server metadata for refresh');
    }

    // Get client info
    const client = await this.getOrRegisterClient(metadata.authServer);

    // Refresh token
    const tokenResult = await refreshAccessToken({
      authServer: metadata.authServer,
      clientId: client.clientId,
      clientSecret: client.clientSecret,
      refreshToken: storedTokens.refreshToken,
    });

    // Store new tokens
    const tokens = this.tokenResultToStoredTokens(tokenResult);
    await this.storage.saveTokens(tokens);

    return tokens;
  }

  /**
   * Start local callback server
   */
  private async startCallbackServer(
    expectedState: string
  ): Promise<{
    server: http.Server;
    port: number;
    codePromise: Promise<string>;
  }> {
    const timeoutMs = this.config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    return new Promise((resolve, reject) => {
      const server = http.createServer();

      let codeResolve: (code: string) => void;
      let codeReject: (error: Error) => void;

      const codePromise = new Promise<string>((res, rej) => {
        codeResolve = res;
        codeReject = rej;
      });

      // Set up timeout
      const timeout = setTimeout(() => {
        server.close();
        codeReject(new Error(`OAuth flow timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      // Handle incoming requests
      server.on('request', (req, res) => {
        const url = new URL(
          req.url ?? '/',
          `http://127.0.0.1:${(server.address() as AddressInfo).port}`
        );

        if (url.pathname !== '/callback') {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }

        // Check for errors
        const error = url.searchParams.get('error');
        if (error) {
          const errorDescription = url.searchParams.get('error_description');
          clearTimeout(timeout);
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(this.errorHtml(error, errorDescription ?? undefined));
          codeReject(
            new Error(`OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`)
          );
          return;
        }

        // Validate state
        const state = url.searchParams.get('state');
        if (state !== expectedState) {
          clearTimeout(timeout);
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(this.errorHtml('invalid_state', 'State parameter mismatch'));
          codeReject(new Error('OAuth state mismatch - possible CSRF attack'));
          return;
        }

        // Get authorization code
        const code = url.searchParams.get('code');
        if (!code) {
          clearTimeout(timeout);
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(this.errorHtml('missing_code', 'No authorization code received'));
          codeReject(new Error('No authorization code in callback'));
          return;
        }

        // Success!
        clearTimeout(timeout);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(this.successHtml());
        codeResolve(code);
      });

      // Listen on preferred port or random port
      const preferredPort = this.config.callbackPort ?? 0;

      server.listen(preferredPort, '127.0.0.1', () => {
        const address = server.address() as AddressInfo;
        debug('Callback server listening on port', address.port);
        resolve({ server, port: address.port, codePromise });
      });

      server.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Open browser or print URL for headless environments
   */
  private async openBrowserOrPrintUrl(url: URL): Promise<void> {
    if (isHeadless()) {
      console.log('\n' + '='.repeat(60));
      console.log('Please open the following URL in your browser to authenticate:');
      console.log('\n' + url.toString() + '\n');
      console.log('='.repeat(60) + '\n');
      return;
    }

    try {
      // Dynamic import of 'open' package
      const open = await import('open');
      await open.default(url.toString());
      debug('Opened browser for authentication');
    } catch (error) {
      // If browser opening fails, fall back to printing URL
      debug('Failed to open browser:', error);
      console.log('\nFailed to open browser automatically.');
      console.log('Please open the following URL manually:\n');
      console.log(url.toString() + '\n');
    }
  }

  /**
   * Convert TokenResult to StoredTokens
   */
  private tokenResultToStoredTokens(result: TokenResult): StoredTokens {
    return {
      accessToken: result.accessToken,
      tokenType: result.tokenType,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresIn
        ? Date.now() + result.expiresIn * 1000
        : undefined,
    };
  }

  /**
   * HTML page for successful authentication
   */
  private successHtml(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Authentication Successful</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;
           background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .container { text-align: center; background: white; padding: 40px 60px; border-radius: 16px;
                 box-shadow: 0 10px 40px rgba(0,0,0,0.2); }
    .checkmark { font-size: 64px; margin-bottom: 20px; }
    h1 { color: #1a202c; margin: 0 0 10px 0; }
    p { color: #718096; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="checkmark">✓</div>
    <h1>Authentication Successful</h1>
    <p>You can close this window and return to the terminal.</p>
  </div>
</body>
</html>`;
  }

  /**
   * HTML page for authentication error
   */
  private errorHtml(error: string, description?: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <title>Authentication Failed</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;
           background: linear-gradient(135deg, #f56565 0%, #c53030 100%); }
    .container { text-align: center; background: white; padding: 40px 60px; border-radius: 16px;
                 box-shadow: 0 10px 40px rgba(0,0,0,0.2); }
    .icon { font-size: 64px; margin-bottom: 20px; }
    h1 { color: #1a202c; margin: 0 0 10px 0; }
    p { color: #718096; margin: 0; }
    code { background: #f7fafc; padding: 2px 8px; border-radius: 4px; color: #e53e3e; }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">✕</div>
    <h1>Authentication Failed</h1>
    <p>Error: <code>${escapeHtml(error)}</code></p>
    ${description ? `<p>${escapeHtml(description)}</p>` : ''}
  </div>
</body>
</html>`;
  }
}

/**
 * Detect if running in a headless environment
 */
function isHeadless(): boolean {
  // CI environment
  if (process.env.CI) {
    return true;
  }

  // No TTY (piped input)
  if (!process.stdin.isTTY) {
    return true;
  }

  // Linux without DISPLAY (no X server)
  if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    return true;
  }

  return false;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
