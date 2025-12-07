import { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { Select, TextInput, ConfirmInput } from '@inkjs/ui';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Spinner, StatusMessage, JsonPreview } from '../../components/index.js';
import {
  createMCPClientForConfig,
  closeMCPClient,
} from '../../../mcp/clientFactory.js';
import { type MCPConfig, validateMCPConfig } from '../../../config/mcpConfig.js';
import type {
  EvalDataset,
  EvalCase,
  SerializedEvalDataset,
} from '../../../evals/datasetTypes.js';
import { suggestExpectations } from '../../utils/expectationSuggester.js';
import { writeFile, readFile, stat } from 'fs/promises';
import { resolve } from 'path';

type Step =
  | 'configTransport'
  | 'configStdio'
  | 'configHttp'
  | 'connecting'
  | 'datasetName'
  | 'appendPrompt'
  | 'selectTool'
  | 'enterArgs'
  | 'callingTool'
  | 'reviewResponse'
  | 'caseId'
  | 'caseDescription'
  | 'useTextContains'
  | 'useRegex'
  | 'useExact'
  | 'useSnapshot'
  | 'askContinue'
  | 'saving'
  | 'done'
  | 'error';

export interface GenerateOptions {
  config?: string;
  output?: string;
  snapshot?: boolean;
}

interface GenerateAppProps {
  options: GenerateOptions;
}

export function GenerateApp({ options }: GenerateAppProps) {
  const { exit } = useApp();

  // State machine
  const [step, setStep] = useState<Step>(options.config ? 'connecting' : 'configTransport');

  // Configuration state
  const [mcpConfig, setMcpConfig] = useState<MCPConfig | null>(null);

  // MCP state
  const [client, setClient] = useState<Client | null>(null);
  const [tools, setTools] = useState<Tool[]>([]);
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const [args, setArgs] = useState<string>('{}');
  const [response, setResponse] = useState<unknown>(null);
  const [callError, setCallError] = useState<string | null>(null);

  // Dataset state
  const [dataset, setDataset] = useState<EvalDataset>({
    name: 'my-mcp-evals',
    description: 'Generated eval dataset',
    cases: [],
  });
  const [outputPath] = useState(resolve(options.output || 'data/dataset.json'));

  // Current case state
  const [currentCase, setCurrentCase] = useState<Partial<EvalCase>>({});
  const [suggestions, setSuggestions] = useState<{
    textContains: string[];
    regex: string[];
  }>({ textContains: [], regex: [] });

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Track mounted state for async cleanup
  const isMountedRef = useRef(true);

  // Load config if provided
  useEffect(() => {
    if (options.config) {
      loadConfig(options.config);
    }
  }, [options.config]);

  async function loadConfig(configPath: string) {
    try {
      const content = await readFile(resolve(configPath), 'utf-8');
      const config = JSON.parse(content);
      setMcpConfig(validateMCPConfig(config));
      setStep('connecting');
    } catch (err) {
      setError(`Failed to load config: ${err instanceof Error ? err.message : String(err)}`);
      setStep('error');
    }
  }

  // Connect when we have config
  useEffect(() => {
    if (step === 'connecting' && mcpConfig) {
      connectToServer();
    }

    async function connectToServer() {
      if (!mcpConfig) return;

      try {
        const c = await createMCPClientForConfig(mcpConfig);

        // Check if still mounted before updating state
        if (!isMountedRef.current) {
          await closeMCPClient(c);
          return;
        }

        const result = await c.listTools();

        if (!isMountedRef.current) {
          await closeMCPClient(c);
          return;
        }

        setClient(c);
        setTools(result.tools || []);

        // Check if output file exists
        let fileExists = false;
        try {
          await stat(outputPath);
          fileExists = true;
        } catch {
          // File doesn't exist
        }

        if (fileExists) {
          setStep('appendPrompt');
        } else {
          setStep('datasetName');
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(`Failed to connect: ${err instanceof Error ? err.message : String(err)}`);
          setStep('error');
        }
      }
    }
  }, [step, mcpConfig, outputPath]);

  async function callTool() {
    if (!client || !selectedTool) return;

    try {
      const parsedArgs = JSON.parse(args);
      const result = await client.callTool({
        name: selectedTool.name,
        arguments: parsedArgs,
      });
      const responseData = result.structuredContent ?? result.content;
      setResponse(responseData);
      setCallError(null);

      // Get suggestions
      const sugg = suggestExpectations(responseData, selectedTool);
      setSuggestions(sugg);

      // Initialize current case
      setCurrentCase({
        toolName: selectedTool.name,
        args: parsedArgs,
      });

      setStep('reviewResponse');
    } catch (err) {
      setCallError(err instanceof Error ? err.message : String(err));
      setStep('reviewResponse');
    }
  }

  async function saveDataset() {
    try {
      const serialized: SerializedEvalDataset = {
        name: dataset.name,
        description: dataset.description,
        cases: dataset.cases,
        metadata: {
          version: '1.0',
          created: new Date().toISOString().split('T')[0],
        },
      };

      await writeFile(outputPath, JSON.stringify(serialized, null, 2));
      setStep('done');
    } catch (err) {
      setError(`Failed to save: ${err instanceof Error ? err.message : String(err)}`);
      setStep('error');
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (client) {
        closeMCPClient(client).catch(() => {});
      }
    };
  }, [client]);

  const handleExit = useCallback(() => {
    if (client) {
      closeMCPClient(client).then(() => exit()).catch(() => exit());
    } else {
      exit();
    }
  }, [client, exit]);

  // Handle Ctrl+C
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      handleExit();
    }
  });

  // Handle step transitions when suggestions are empty (instead of setState in render)
  useEffect(() => {
    if (step === 'useTextContains' && suggestions.textContains.length === 0) {
      setStep('useRegex');
    }
  }, [step, suggestions.textContains.length]);

  useEffect(() => {
    if (step === 'useRegex' && suggestions.regex.length === 0) {
      setStep('useExact');
    }
  }, [step, suggestions.regex.length]);

  // Render based on step
  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        {'\uD83E\uDD16'} MCP Dataset Generator
      </Text>
      <Text> </Text>

      {/* Transport Selection */}
      {step === 'configTransport' && (
        <Box flexDirection="column">
          <Text>Select MCP transport type:</Text>
          <Select
            options={[
              { label: 'stdio (local server process)', value: 'stdio' },
              { label: 'http (remote server)', value: 'http' },
            ]}
            onChange={(value) => {
              setStep(value === 'stdio' ? 'configStdio' : 'configHttp');
            }}
          />
        </Box>
      )}

      {/* Stdio config */}
      {step === 'configStdio' && (
        <Box flexDirection="column">
          <Text>Server command (e.g., node server.js):</Text>
          <TextInput
            defaultValue="node server.js"
            onSubmit={(value) => {
              const [command, ...cmdArgs] = value.split(' ');
              setMcpConfig(
                validateMCPConfig({
                  transport: 'stdio',
                  command,
                  args: cmdArgs,
                  capabilities: { roots: { listChanged: true } },
                })
              );
              setStep('connecting');
            }}
          />
        </Box>
      )}

      {/* HTTP config */}
      {step === 'configHttp' && (
        <Box flexDirection="column">
          <Text>Server URL:</Text>
          <TextInput
            defaultValue="http://localhost:3000/mcp"
            onSubmit={(value) => {
              setMcpConfig(
                validateMCPConfig({
                  transport: 'http',
                  serverUrl: value,
                  capabilities: { roots: { listChanged: true } },
                })
              );
              setStep('connecting');
            }}
          />
        </Box>
      )}

      {/* Connecting */}
      {step === 'connecting' && <Spinner label="Connecting to MCP server..." />}

      {/* Append prompt */}
      {step === 'appendPrompt' && (
        <Box flexDirection="column">
          <StatusMessage status="success">Connected! Found {tools.length} tools</StatusMessage>
          <Text> </Text>
          <Text>Dataset file exists at {outputPath}. Append to it?</Text>
          <ConfirmInput
            onConfirm={async () => {
              try {
                const content = await readFile(outputPath, 'utf-8');
                const existing = JSON.parse(content) as SerializedEvalDataset;
                setDataset({
                  name: existing.name,
                  description: existing.description,
                  cases: existing.cases,
                  metadata: existing.metadata,
                });
                setStep('selectTool');
              } catch {
                setStep('datasetName');
              }
            }}
            onCancel={() => setStep('datasetName')}
          />
        </Box>
      )}

      {/* Dataset name */}
      {step === 'datasetName' && (
        <Box flexDirection="column">
          {client && (
            <StatusMessage status="success">Connected! Found {tools.length} tools</StatusMessage>
          )}
          <Text> </Text>
          <Text>Dataset name:</Text>
          <TextInput
            defaultValue="my-mcp-evals"
            onSubmit={(value) => {
              setDataset((d) => ({ ...d, name: value }));
              setStep('selectTool');
            }}
          />
        </Box>
      )}

      {/* Tool selection */}
      {step === 'selectTool' && (
        <Box flexDirection="column">
          <Text dimColor>--- New Test Case ---</Text>
          <Text> </Text>
          <Text>Select tool to test:</Text>
          <Select
            options={tools.map((t) => ({
              label: `${t.name} - ${t.description ?? '(no description)'}`,
              value: t.name,
            }))}
            onChange={(value) => {
              const tool = tools.find((t) => t.name === value);
              setSelectedTool(tool || null);
              setStep('enterArgs');
            }}
          />
        </Box>
      )}

      {/* Arguments */}
      {step === 'enterArgs' && (
        <Box flexDirection="column">
          <Text>Tool arguments (JSON):</Text>
          <TextInput
            defaultValue="{}"
            onSubmit={(value) => {
              try {
                JSON.parse(value);
                setArgs(value);
                setStep('callingTool');
                // Start tool call after state update
                setTimeout(() => callTool(), 0);
              } catch {
                // Invalid JSON, stay on this step
              }
            }}
          />
        </Box>
      )}

      {/* Calling tool */}
      {step === 'callingTool' && (
        <Spinner label={`Calling ${selectedTool?.name}...`} />
      )}

      {/* Review response */}
      {step === 'reviewResponse' && (
        <Box flexDirection="column">
          {callError ? (
            <StatusMessage status="error">Tool call failed: {callError}</StatusMessage>
          ) : (
            <>
              <StatusMessage status="success">Tool called successfully</StatusMessage>
              <Text> </Text>
              <Text dimColor>Response preview:</Text>
              <JsonPreview data={response} maxLines={10} />
              {suggestions.textContains.length > 0 && (
                <Box flexDirection="column" marginTop={1}>
                  <Text color="cyan">Suggested expectations:</Text>
                  <Text dimColor>
                    Text contains: {suggestions.textContains.map((t) => `"${t}"`).join(', ')}
                  </Text>
                </Box>
              )}
            </>
          )}
          <Text> </Text>
          <Text>Press Enter to continue...</Text>
          <TextInput
            defaultValue=""
            onSubmit={() => {
              if (callError) {
                setStep('askContinue');
              } else {
                setStep('caseId');
              }
            }}
          />
        </Box>
      )}

      {/* Case ID */}
      {step === 'caseId' && (
        <Box flexDirection="column">
          <Text>Test case ID:</Text>
          <TextInput
            defaultValue={`${selectedTool?.name}-${dataset.cases.length + 1}`}
            onSubmit={(value) => {
              setCurrentCase((c) => ({ ...c, id: value }));
              setStep('caseDescription');
            }}
          />
        </Box>
      )}

      {/* Case description */}
      {step === 'caseDescription' && (
        <Box flexDirection="column">
          <Text>Description (optional, press Enter to skip):</Text>
          <TextInput
            defaultValue=""
            onSubmit={(value) => {
              setCurrentCase((c) => ({
                ...c,
                description: value || undefined,
              }));
              if (options.snapshot) {
                // Skip to adding case with snapshot
                const newCase: EvalCase = {
                  id: currentCase.id!,
                  description: value || undefined,
                  toolName: currentCase.toolName!,
                  args: currentCase.args!,
                  expectedSnapshot: currentCase.id!,
                };
                setDataset((d) => ({ ...d, cases: [...d.cases, newCase] }));
                setStep('askContinue');
              } else {
                setStep('useTextContains');
              }
            }}
          />
        </Box>
      )}

      {/* Use text contains */}
      {step === 'useTextContains' && suggestions.textContains.length > 0 && (
        <Box flexDirection="column">
          <Text>Add text contains expectations?</Text>
          <Text dimColor>
            ({suggestions.textContains.map((t) => `"${t}"`).join(', ')})
          </Text>
          <ConfirmInput
            onConfirm={() => {
              setCurrentCase((c) => ({
                ...c,
                expectedTextContains: suggestions.textContains,
              }));
              setStep('useRegex');
            }}
            onCancel={() => setStep('useRegex')}
          />
        </Box>
      )}

      {/* Use regex */}
      {step === 'useRegex' && suggestions.regex.length > 0 && (
        <Box flexDirection="column">
          <Text>Add regex expectations?</Text>
          <Text dimColor>
            ({suggestions.regex.map((r) => `/${r}/`).join(', ')})
          </Text>
          <ConfirmInput
            onConfirm={() => {
              setCurrentCase((c) => ({
                ...c,
                expectedRegex: suggestions.regex,
              }));
              setStep('useExact');
            }}
            onCancel={() => setStep('useExact')}
          />
        </Box>
      )}

      {/* Use exact match */}
      {step === 'useExact' && (
        <Box flexDirection="column">
          <Text>Add exact match expectation?</Text>
          <ConfirmInput
            onConfirm={() => {
              setCurrentCase((c) => ({ ...c, expectedExact: response }));
              setStep('useSnapshot');
            }}
            onCancel={() => setStep('useSnapshot')}
          />
        </Box>
      )}

      {/* Use snapshot */}
      {step === 'useSnapshot' && (
        <Box flexDirection="column">
          <Text>Use Playwright snapshot testing?</Text>
          <ConfirmInput
            onConfirm={() => {
              const newCase: EvalCase = {
                id: currentCase.id!,
                description: currentCase.description,
                toolName: currentCase.toolName!,
                args: currentCase.args!,
                expectedTextContains: currentCase.expectedTextContains,
                expectedRegex: currentCase.expectedRegex,
                expectedExact: currentCase.expectedExact,
                expectedSnapshot: currentCase.id!,
              };
              setDataset((d) => ({ ...d, cases: [...d.cases, newCase] }));
              setStep('askContinue');
            }}
            onCancel={() => {
              const newCase: EvalCase = {
                id: currentCase.id!,
                description: currentCase.description,
                toolName: currentCase.toolName!,
                args: currentCase.args!,
                expectedTextContains: currentCase.expectedTextContains,
                expectedRegex: currentCase.expectedRegex,
                expectedExact: currentCase.expectedExact,
              };
              setDataset((d) => ({ ...d, cases: [...d.cases, newCase] }));
              setStep('askContinue');
            }}
          />
        </Box>
      )}

      {/* Ask continue */}
      {step === 'askContinue' && (
        <Box flexDirection="column">
          <StatusMessage status="success">
            Added test case "{currentCase.id}"
          </StatusMessage>
          <Text>Total cases: {dataset.cases.length}</Text>
          <Text> </Text>
          <Text>Add another test case?</Text>
          <ConfirmInput
            onConfirm={() => {
              setCurrentCase({});
              setSelectedTool(null);
              setArgs('{}');
              setResponse(null);
              setCallError(null);
              setSuggestions({ textContains: [], regex: [] });
              setStep('selectTool');
            }}
            onCancel={() => {
              setStep('saving');
              setTimeout(() => saveDataset(), 0);
            }}
          />
        </Box>
      )}

      {/* Saving */}
      {step === 'saving' && <Spinner label="Saving dataset..." />}

      {/* Done */}
      {step === 'done' && (
        <Box flexDirection="column">
          <StatusMessage status="success">Dataset generation complete!</StatusMessage>
          <Text> </Text>
          <Text color="cyan">Total test cases: {dataset.cases.length}</Text>
          <Text dimColor>Output: {outputPath}</Text>
          <Text> </Text>
          <Text color="cyan">Next steps:</Text>
          <Text dimColor>  npx playwright test</Text>
          {dataset.cases.some((c) => c.expectedSnapshot) && (
            <>
              <Text> </Text>
              <Text color="cyan">Snapshot testing:</Text>
              <Text dimColor>  First run will capture snapshots</Text>
              <Text dimColor>  Update: npx playwright test --update-snapshots</Text>
            </>
          )}
        </Box>
      )}

      {/* Error */}
      {step === 'error' && error && (
        <Box flexDirection="column">
          <StatusMessage status="error">{error}</StatusMessage>
          <Text dimColor>Press Ctrl+C to exit</Text>
        </Box>
      )}
    </Box>
  );
}
