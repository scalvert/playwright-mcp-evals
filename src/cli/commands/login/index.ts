/**
 * CLI login command for OAuth authentication
 */

import { render } from 'ink';
import React from 'react';
import { LoginApp, type LoginOptions } from './LoginApp.js';

/**
 * Login command action handler using Ink
 *
 * @param serverUrl - MCP server URL to authenticate with
 * @param options - Command options
 */
export async function login(
  serverUrl: string,
  options: LoginOptions
): Promise<void> {
  const { waitUntilExit } = render(
    React.createElement(LoginApp, { serverUrl, options })
  );
  await waitUntilExit();
}

export type { LoginOptions };
