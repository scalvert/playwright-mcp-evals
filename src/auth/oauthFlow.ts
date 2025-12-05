/**
 * OAuth flow utilities using oauth4webapi
 *
 * Implements OAuth 2.1 with PKCE as required by MCP specification
 */

import * as oauth from 'oauth4webapi';
import type { TokenResult } from './types.js';

/**
 * Discovered OAuth authorization server metadata
 */
export interface AuthServerMetadata {
  /**
   * The oauth4webapi AuthorizationServer object
   */
  server: oauth.AuthorizationServer;

  /**
   * Issuer URL
   */
  issuer: string;
}

/**
 * PKCE code verifier and challenge pair
 */
export interface PKCEPair {
  /**
   * Random code verifier string
   */
  codeVerifier: string;

  /**
   * S256 hashed code challenge
   */
  codeChallenge: string;
}

/**
 * Configuration for building authorization URL
 */
export interface AuthorizationUrlConfig {
  /**
   * Authorization server metadata
   */
  authServer: AuthServerMetadata;

  /**
   * Client ID
   */
  clientId: string;

  /**
   * Redirect URI for callback
   */
  redirectUri: string;

  /**
   * Requested scopes
   */
  scopes: Array<string>;

  /**
   * PKCE code challenge
   */
  codeChallenge: string;

  /**
   * OAuth state parameter for CSRF protection
   */
  state: string;

  /**
   * Resource indicator (RFC 8707)
   */
  resource?: string;
}

/**
 * Configuration for token exchange
 */
export interface TokenExchangeConfig {
  /**
   * Authorization server metadata
   */
  authServer: AuthServerMetadata;

  /**
   * Client ID
   */
  clientId: string;

  /**
   * Client secret (for confidential clients)
   */
  clientSecret?: string;

  /**
   * Authorization code from callback
   */
  code: string;

  /**
   * OAuth state parameter for CSRF validation
   */
  state: string;

  /**
   * PKCE code verifier
   */
  codeVerifier: string;

  /**
   * Redirect URI used in authorization request
   */
  redirectUri: string;
}

/**
 * Configuration for token refresh
 */
export interface TokenRefreshConfig {
  /**
   * Authorization server metadata
   */
  authServer: AuthServerMetadata;

  /**
   * Client ID
   */
  clientId: string;

  /**
   * Client secret (for confidential clients)
   */
  clientSecret?: string;

  /**
   * Refresh token
   */
  refreshToken: string;
}

/**
 * Discovers OAuth authorization server metadata from a well-known URL
 *
 * @param issuerUrl - The authorization server URL (will append /.well-known/oauth-authorization-server)
 * @returns Authorization server metadata
 */
export async function discoverAuthServer(
  issuerUrl: string
): Promise<AuthServerMetadata> {
  const issuer = new URL(issuerUrl);
  const response = await oauth.discoveryRequest(issuer, {
    algorithm: 'oauth2',
  });

  const metadata = await oauth.processDiscoveryResponse(issuer, response);

  return {
    server: metadata,
    issuer: issuerUrl,
  };
}

/**
 * Generates a PKCE code verifier and challenge pair
 *
 * Uses S256 challenge method as required by OAuth 2.1 and MCP specification
 *
 * @returns PKCE code verifier and challenge
 */
export async function generatePKCE(): Promise<PKCEPair> {
  const codeVerifier = oauth.generateRandomCodeVerifier();
  const codeChallenge = await oauth.calculatePKCECodeChallenge(codeVerifier);

  return {
    codeVerifier,
    codeChallenge,
  };
}

/**
 * Generates a random state parameter for CSRF protection
 *
 * @returns Random state string
 */
export function generateState(): string {
  return oauth.generateRandomState();
}

/**
 * Builds the OAuth authorization URL for browser redirect
 *
 * @param config - Authorization URL configuration
 * @returns Authorization URL to redirect the user to
 */
export function buildAuthorizationUrl(config: AuthorizationUrlConfig): URL {
  const authorizationEndpoint = config.authServer.server.authorization_endpoint;
  if (!authorizationEndpoint) {
    throw new Error('Authorization server does not have an authorization_endpoint');
  }

  const authorizationUrl = new URL(authorizationEndpoint);

  authorizationUrl.searchParams.set('client_id', config.clientId);
  authorizationUrl.searchParams.set('redirect_uri', config.redirectUri);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('scope', config.scopes.join(' '));
  authorizationUrl.searchParams.set('code_challenge', config.codeChallenge);
  authorizationUrl.searchParams.set('code_challenge_method', 'S256');
  authorizationUrl.searchParams.set('state', config.state);

  if (config.resource) {
    authorizationUrl.searchParams.set('resource', config.resource);
  }

  return authorizationUrl;
}

/**
 * Exchanges an authorization code for tokens
 *
 * @param config - Token exchange configuration
 * @returns Token result
 */
export async function exchangeCodeForTokens(
  config: TokenExchangeConfig
): Promise<TokenResult> {
  const client: oauth.Client = {
    client_id: config.clientId,
    token_endpoint_auth_method: config.clientSecret
      ? 'client_secret_basic'
      : 'none',
  };

  const clientAuth = config.clientSecret
    ? oauth.ClientSecretBasic(config.clientSecret)
    : oauth.None();

  // Build callback URL with code and state for validation
  const callbackUrl = new URL(config.redirectUri);
  callbackUrl.searchParams.set('code', config.code);
  callbackUrl.searchParams.set('state', config.state);

  // Validate the auth response - oauth4webapi requires this before token exchange
  // This throws on error, returns URLSearchParams on success
  const validatedParams = oauth.validateAuthResponse(
    config.authServer.server,
    client,
    callbackUrl,
    config.state
  );

  const response = await oauth.authorizationCodeGrantRequest(
    config.authServer.server,
    client,
    clientAuth,
    validatedParams,
    config.redirectUri,
    config.codeVerifier
  );

  const result = await oauth.processAuthorizationCodeResponse(
    config.authServer.server,
    client,
    response
  );

  return {
    accessToken: result.access_token,
    tokenType: result.token_type,
    expiresIn: result.expires_in,
    refreshToken: result.refresh_token,
    scope: result.scope,
  };
}

/**
 * Refreshes an access token using a refresh token
 *
 * @param config - Token refresh configuration
 * @returns New token result
 */
export async function refreshAccessToken(
  config: TokenRefreshConfig
): Promise<TokenResult> {
  const client: oauth.Client = {
    client_id: config.clientId,
    token_endpoint_auth_method: config.clientSecret
      ? 'client_secret_basic'
      : 'none',
  };

  const clientAuth = config.clientSecret
    ? oauth.ClientSecretBasic(config.clientSecret)
    : oauth.None();

  const response = await oauth.refreshTokenGrantRequest(
    config.authServer.server,
    client,
    clientAuth,
    config.refreshToken
  );

  const result = await oauth.processRefreshTokenResponse(
    config.authServer.server,
    client,
    response
  );

  return {
    accessToken: result.access_token,
    tokenType: result.token_type,
    expiresIn: result.expires_in,
    refreshToken: result.refresh_token,
    scope: result.scope,
  };
}

/**
 * Validates the callback URL from OAuth redirect
 *
 * @param callbackUrl - The full callback URL with query parameters
 * @param expectedState - The state parameter sent in the authorization request
 * @returns The authorization code
 * @throws Error if validation fails
 */
export function validateCallback(
  callbackUrl: URL,
  expectedState: string
): string {
  const error = callbackUrl.searchParams.get('error');
  if (error) {
    const errorDescription = callbackUrl.searchParams.get('error_description');
    throw new Error(
      `OAuth error: ${error}${errorDescription ? ` - ${errorDescription}` : ''}`
    );
  }

  const state = callbackUrl.searchParams.get('state');
  if (state !== expectedState) {
    throw new Error('OAuth state mismatch - possible CSRF attack');
  }

  const code = callbackUrl.searchParams.get('code');
  if (!code) {
    throw new Error('No authorization code in callback URL');
  }

  return code;
}
