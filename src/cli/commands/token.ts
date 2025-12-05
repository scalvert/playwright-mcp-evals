/**
 * CLI token command for extracting stored OAuth tokens
 *
 * Outputs tokens in formats suitable for CI/CD environments like GitHub Actions.
 */

import { createFileOAuthStorage, ENV_VAR_NAMES, getStateDir } from '../../auth/storage.js';

export type TokenFormat = 'env' | 'json' | 'gh';

export interface TokenOptions {
  format?: TokenFormat;
  stateDir?: string;
}

/**
 * Token command action handler
 *
 * @param serverUrl - MCP server URL to get tokens for
 * @param options - Command options
 */
export async function token(
  serverUrl: string,
  options: TokenOptions
): Promise<void> {
  try {
    // Validate URL
    new URL(serverUrl);
  } catch {
    console.error(`Error: Invalid URL: ${serverUrl}`);
    process.exit(1);
  }

  const storage = createFileOAuthStorage({
    serverUrl,
    stateDir: options.stateDir,
  });

  const tokens = await storage.loadTokens();

  if (!tokens) {
    const stateDir = getStateDir(serverUrl, options.stateDir);
    console.error(`No tokens found for ${serverUrl}`);
    console.error(`\nExpected location: ${stateDir}/tokens.json`);
    console.error(`\nRun 'mcp-test login ${serverUrl}' to authenticate first.`);
    process.exit(1);
  }

  const format = options.format ?? 'env';

  switch (format) {
    case 'env':
      outputEnvFormat(tokens);
      break;
    case 'json':
      outputJsonFormat(tokens);
      break;
    case 'gh':
      outputGitHubFormat(tokens);
      break;
    default:
      console.error(`Unknown format: ${format}`);
      process.exit(1);
  }
}

/**
 * Output tokens as KEY=value pairs (shell-compatible)
 */
function outputEnvFormat(tokens: {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt?: number;
}): void {
  console.log(`${ENV_VAR_NAMES.accessToken}=${tokens.accessToken}`);

  if (tokens.refreshToken) {
    console.log(`${ENV_VAR_NAMES.refreshToken}=${tokens.refreshToken}`);
  }

  console.log(`${ENV_VAR_NAMES.tokenType}=${tokens.tokenType}`);

  if (tokens.expiresAt) {
    console.log(`${ENV_VAR_NAMES.expiresAt}=${tokens.expiresAt}`);
  }
}

/**
 * Output tokens as JSON
 */
function outputJsonFormat(tokens: {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt?: number;
}): void {
  const output: Record<string, string | number> = {
    [ENV_VAR_NAMES.accessToken]: tokens.accessToken,
    [ENV_VAR_NAMES.tokenType]: tokens.tokenType,
  };

  if (tokens.refreshToken) {
    output[ENV_VAR_NAMES.refreshToken] = tokens.refreshToken;
  }

  if (tokens.expiresAt) {
    output[ENV_VAR_NAMES.expiresAt] = tokens.expiresAt;
  }

  console.log(JSON.stringify(output, null, 2));
}

/**
 * Output tokens as gh secret set commands
 */
function outputGitHubFormat(tokens: {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt?: number;
}): void {
  console.log('# Run these commands to set GitHub Actions secrets:');
  console.log(`gh secret set ${ENV_VAR_NAMES.accessToken} --body "${tokens.accessToken}"`);

  if (tokens.refreshToken) {
    console.log(`gh secret set ${ENV_VAR_NAMES.refreshToken} --body "${tokens.refreshToken}"`);
  }

  console.log(`gh secret set ${ENV_VAR_NAMES.tokenType} --body "${tokens.tokenType}"`);

  if (tokens.expiresAt) {
    console.log(`gh secret set ${ENV_VAR_NAMES.expiresAt} --body "${tokens.expiresAt}"`);
  }
}
