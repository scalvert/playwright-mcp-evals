/**
 * CLI login command for OAuth authentication
 */

import { CLIOAuthClient } from '../../auth/cli.js';
import { getStateDir } from '../../auth/storage.js';

export interface LoginOptions {
  force?: boolean;
  stateDir?: string;
  scopes?: string;
}

/**
 * Login command action handler
 *
 * @param serverUrl - MCP server URL to authenticate with
 * @param options - Command options
 */
export async function login(
  serverUrl: string,
  options: LoginOptions
): Promise<void> {
  try {
    // Validate URL
    new URL(serverUrl);
  } catch {
    console.error(`Error: Invalid URL: ${serverUrl}`);
    process.exit(1);
  }

  // Parse scopes from comma-separated string
  const scopes = options.scopes
    ? options.scopes.split(',').map((s) => s.trim())
    : undefined;

  const client = new CLIOAuthClient({
    mcpServerUrl: serverUrl,
    stateDir: options.stateDir,
    scopes,
  });

  try {
    if (options.force) {
      console.log('Clearing existing credentials...');
      await client.clearCredentials();
    }

    console.log(`Authenticating with ${serverUrl}...`);
    const result = await client.getAccessToken();

    if (result.fromEnv) {
      console.log('Using token from environment variables.');
    } else if (result.refreshed) {
      console.log('Token refreshed successfully.');
    } else {
      console.log('Authentication successful!');
    }

    // Show requested scopes for new authentications
    if (result.requestedScopes && result.requestedScopes.length > 0) {
      console.log(`Scopes: ${result.requestedScopes.join(', ')}`);
    }

    // Show expiration info
    if (result.expiresAt) {
      const expiresDate = new Date(result.expiresAt);
      console.log(`Token expires: ${expiresDate.toLocaleString()}`);
    } else {
      console.log('Token has no expiration.');
    }

    // Show storage location
    if (!result.fromEnv) {
      const stateDir = getStateDir(serverUrl, options.stateDir);
      console.log(`\nTokens stored in: ${stateDir}`);
    }
  } catch (error) {
    console.error(
      `\nAuthentication failed: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exit(1);
  }
}
