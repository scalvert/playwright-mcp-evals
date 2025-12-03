/**
 * OAuth authentication module for MCP testing
 *
 * Provides OAuth 2.1 support for MCP server testing with both
 * static token authentication and full OAuth flow with PKCE.
 */

// Types
export type {
  StoredTokens,
  StoredClientInfo,
  StoredOAuthState,
  OAuthSetupConfig,
  TokenResult,
} from './types.js';

// OAuth client provider
export {
  PlaywrightOAuthClientProvider,
  loadOAuthState,
  saveOAuthState,
  type PlaywrightOAuthClientProviderConfig,
} from './oauthClientProvider.js';

// Static token auth
export {
  createTokenAuthHeaders,
  validateAccessToken,
  isTokenExpired,
  isTokenExpiringSoon,
} from './tokenAuth.js';

// OAuth flow utilities
export {
  discoverAuthServer,
  generatePKCE,
  generateState,
  buildAuthorizationUrl,
  exchangeCodeForTokens,
  refreshAccessToken,
  validateCallback,
  type AuthServerMetadata,
  type PKCEPair,
  type AuthorizationUrlConfig,
  type TokenExchangeConfig,
  type TokenRefreshConfig,
} from './oauthFlow.js';

// Playwright setup utilities
export {
  performOAuthSetup,
  performOAuthSetupIfNeeded,
  hasValidOAuthState,
} from './setupOAuth.js';

// Discovery (RFC 9728)
export {
  discoverProtectedResource,
  discoverAuthorizationServer,
  DiscoveryError,
  MCP_PROTOCOL_VERSION,
  type ProtectedResourceMetadata,
  type ProtectedResourceDiscoveryResult,
} from './discovery.js';

// Storage
export {
  createFileOAuthStorage,
  generateServerKey,
  getStateDir,
  loadTokensFromEnv,
  injectTokens,
  ENV_VAR_NAMES,
  type OAuthStorage,
  type FileOAuthStorageConfig,
  type StoredServerMetadata,
} from './storage.js';

// CLI OAuth
export {
  CLIOAuthClient,
  type CLIOAuthClientConfig,
  type CLIOAuthResult,
} from './cli.js';
