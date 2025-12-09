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
  const [step, setStep] = useState<Step>('validating');
  const [result, setResult] = useState<AuthResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stateDir, setStateDir] = useState<string>('');

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
    }
  });

  const authenticate = useCallback(async () => {
    try {
      new URL(serverUrl);
    } catch {
      setError(`Invalid URL: ${serverUrl}`);
      setStep('error');
      return;
    }

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

  useEffect(() => {
    authenticate();
  }, [authenticate]);

  useEffect(() => {
    if (step === 'done' || step === 'error') {
      exit();
    }
  }, [step, exit]);

  return (
    <Box flexDirection="column" padding={1}>
      {step === 'validating' && (
        <Spinner label="Validating server URL..." />
      )}

      {step === 'clearing' && (
        <Spinner label="Clearing existing credentials..." />
      )}

      {step === 'authenticating' && (
        <Box flexDirection="column">
          <Spinner label={`Authenticating with ${serverUrl}...`} />
          <Text dimColor>A browser window may open for OAuth login</Text>
        </Box>
      )}

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
