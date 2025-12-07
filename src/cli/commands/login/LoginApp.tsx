import { useState, useEffect, useCallback } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Spinner, StatusMessage } from '../../components/index.js';
import { CLIOAuthClient } from '../../../auth/cli.js';
import { getStateDir } from '../../../auth/storage.js';

type Step =
  | 'validating'
  | 'clearing'
  | 'authenticating'
  | 'done'
  | 'error';

export interface LoginOptions {
  force?: boolean;
  stateDir?: string;
  scopes?: string;
}

interface LoginAppProps {
  serverUrl: string;
  options: LoginOptions;
}

interface AuthResult {
  fromEnv: boolean;
  refreshed: boolean;
  requestedScopes?: string[];
  expiresAt?: number;
}

export function LoginApp({ serverUrl, options }: LoginAppProps) {
  const { exit } = useApp();

  // State machine
  const [step, setStep] = useState<Step>('validating');

  // Result state
  const [result, setResult] = useState<AuthResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stateDir, setStateDir] = useState<string>('');

  // Handle Ctrl+C
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }
  });

  const authenticate = useCallback(async () => {
    try {
      // Validate URL
      new URL(serverUrl);
    } catch {
      setError(`Invalid URL: ${serverUrl}`);
      setStep('error');
      return;
    }

    // Parse scopes
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
        setStep('clearing');
        await client.clearCredentials();
      }

      setStep('authenticating');
      const authResult = await client.getAccessToken();

      setResult({
        fromEnv: authResult.fromEnv,
        refreshed: authResult.refreshed,
        requestedScopes: authResult.requestedScopes,
        expiresAt: authResult.expiresAt,
      });

      setStateDir(getStateDir(serverUrl, options.stateDir));
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep('error');
    }
  }, [serverUrl, options]);

  // Start authentication on mount
  useEffect(() => {
    authenticate();
  }, [authenticate]);

  // Exit after rendering done/error
  useEffect(() => {
    if (step === 'done' || step === 'error') {
      // Small delay to ensure output is flushed
      const timer = setTimeout(() => exit(), 50);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [step, exit]);

  // Render based on step
  return (
    <Box flexDirection="column" padding={1}>
      {/* Validating */}
      {step === 'validating' && (
        <Spinner label="Validating server URL..." />
      )}

      {/* Clearing */}
      {step === 'clearing' && (
        <Spinner label="Clearing existing credentials..." />
      )}

      {/* Authenticating */}
      {step === 'authenticating' && (
        <Box flexDirection="column">
          <Spinner label={`Authenticating with ${serverUrl}...`} />
          <Text dimColor>A browser window may open for OAuth login</Text>
        </Box>
      )}

      {/* Done */}
      {step === 'done' && result && (
        <Box flexDirection="column">
          {result.fromEnv ? (
            <StatusMessage status="info">
              Using token from environment variables.
            </StatusMessage>
          ) : result.refreshed ? (
            <StatusMessage status="success">
              Token refreshed successfully.
            </StatusMessage>
          ) : (
            <StatusMessage status="success">
              Authentication successful!
            </StatusMessage>
          )}

          {result.requestedScopes && result.requestedScopes.length > 0 && (
            <Text dimColor>Scopes: {result.requestedScopes.join(', ')}</Text>
          )}

          {result.expiresAt ? (
            <Text dimColor>
              Token expires: {new Date(result.expiresAt).toLocaleString()}
            </Text>
          ) : (
            <Text dimColor>Token has no expiration.</Text>
          )}

          {!result.fromEnv && stateDir && (
            <>
              <Text> </Text>
              <Text dimColor>Tokens stored in: {stateDir}</Text>
            </>
          )}
        </Box>
      )}

      {/* Error */}
      {step === 'error' && error && (
        <Box flexDirection="column">
          <StatusMessage status="error">
            Authentication failed: {error}
          </StatusMessage>
        </Box>
      )}
    </Box>
  );
}
