/**
 * Auth types for MCP OAuth integration
 */

/**
 * Stored OAuth tokens
 */
export interface StoredTokens {
  /**
   * OAuth access token
   */
  accessToken: string;

  /**
   * OAuth refresh token (if provided)
   */
  refreshToken?: string;

  /**
   * Token expiration timestamp (Unix milliseconds)
   */
  expiresAt?: number;

  /**
   * Token type (typically "Bearer")
   */
  tokenType: string;

  /**
   * Client ID that was used to obtain these tokens.
   * Required for token refresh since refresh tokens are bound to the client.
   */
  clientId?: string;
}

/**
 * Stored client information from Dynamic Client Registration
 */
export interface StoredClientInfo {
  /**
   * Client ID from DCR
   */
  clientId: string;

  /**
   * Client secret from DCR (for confidential clients)
   */
  clientSecret?: string;

  /**
   * Client ID issued at timestamp
   */
  clientIdIssuedAt?: number;

  /**
   * Client secret expiration timestamp
   */
  clientSecretExpiresAt?: number;
}

/**
 * Complete OAuth state persisted to disk for Playwright auth state pattern
 */
export interface StoredOAuthState {
  /**
   * OAuth tokens
   */
  tokens?: StoredTokens;

  /**
   * DCR client information
   */
  clientInfo?: StoredClientInfo;

  /**
   * PKCE code verifier (used during authorization flow)
   */
  codeVerifier?: string;

  /**
   * OAuth state parameter (for CSRF protection)
   */
  state?: string;

  /**
   * Timestamp when this state was saved
   */
  savedAt: number;
}

/**
 * Configuration for OAuth setup flow
 */
export interface OAuthSetupConfig {
  /**
   * OAuth authorization server metadata URL
   */
  authServerUrl: string;

  /**
   * Scopes to request
   */
  scopes: Array<string>;

  /**
   * Resource indicator (RFC 8707)
   */
  resource?: string;

  /**
   * Login form selectors for automation
   */
  loginSelectors: {
    /**
     * Selector for username/email input field
     */
    usernameInput: string;

    /**
     * Selector for password input field
     */
    passwordInput: string;

    /**
     * Selector for login submit button
     */
    submitButton: string;

    /**
     * Selector for consent/authorize button (optional)
     */
    consentButton?: string;
  };

  /**
   * Test user credentials
   */
  credentials: {
    username: string;
    password: string;
  };

  /**
   * Path to save OAuth state file
   */
  outputPath: string;

  /**
   * Pre-registered client ID (optional, uses DCR if not provided)
   */
  clientId?: string;

  /**
   * Pre-registered client secret (optional)
   */
  clientSecret?: string;

  /**
   * Redirect URI for OAuth callback
   */
  redirectUri?: string;

  /**
   * Timeout for login flow in milliseconds (default: 30000)
   */
  timeoutMs?: number;
}

/**
 * Result of token exchange or refresh
 */
export interface TokenResult {
  /**
   * Access token
   */
  accessToken: string;

  /**
   * Token type (typically "Bearer")
   */
  tokenType: string;

  /**
   * Expires in seconds
   */
  expiresIn?: number;

  /**
   * Refresh token (if provided)
   */
  refreshToken?: string;

  /**
   * Granted scopes (space-separated)
   */
  scope?: string;
}
