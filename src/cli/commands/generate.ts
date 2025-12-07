import { writeFile, readFile, stat } from 'fs/promises';
import { resolve } from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import {
  createMCPClientForConfig,
  closeMCPClient,
} from '../../mcp/clientFactory.js';
import { type MCPConfig, validateMCPConfig } from '../../config/mcpConfig.js';
import type {
  EvalDataset,
  EvalCase,
  SerializedEvalDataset,
} from '../../evals/datasetTypes.js';
import { suggestExpectations } from '../utils/expectationSuggester.js';

interface GenerateOptions {
  config?: string;
  output?: string;
  snapshot?: boolean;
}

export async function generate(options: GenerateOptions): Promise<void> {
  console.log(chalk.cyan.bold('\n🤖 MCP Dataset Generator\n'));

  // Get MCP configuration
  const mcpConfig = await getMCPConfig(options.config);

  // Connect to MCP server
  const spinner = ora('Connecting to MCP server...').start();
  let client;

  try {
    client = await createMCPClientForConfig(mcpConfig);
    spinner.succeed('Connected to MCP server');
  } catch (error) {
    spinner.fail('Failed to connect to MCP server');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
    process.exit(1);
  }

  try {
    // List available tools
    const toolsResult = await client.listTools();
    const tools = toolsResult.tools || [];
    console.log(chalk.green(`\n✓ Found ${tools.length} tools:\n`));
    tools.forEach((tool, i) => {
      console.log(
        `  ${i + 1}. ${chalk.cyan(tool.name)} - ${tool.description ?? '(no description)'}`
      );
    });

    // Load or create dataset
    const outputPath = resolve(options.output || 'data/dataset.json');
    let dataset: EvalDataset;
    let existingCases: EvalCase[] = [];

    let fileExists = false;
    try {
      await stat(outputPath);
      fileExists = true;
    } catch {
      // File doesn't exist
    }

    if (fileExists) {
      const { append } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'append',
          message: `Dataset file exists at ${outputPath}. Append to it?`,
          default: true,
        },
      ]);

      if (append) {
        const content = await readFile(outputPath, 'utf-8');
        const existing = JSON.parse(content) as SerializedEvalDataset;
        existingCases = existing.cases;
        dataset = {
          name: existing.name,
          description: existing.description,
          cases: existingCases,
          metadata: existing.metadata,
        };
        console.log(
          chalk.gray(
            `\nLoaded existing dataset with ${existingCases.length} cases`
          )
        );
      } else {
        const { datasetName } = await inquirer.prompt([
          {
            type: 'input',
            name: 'datasetName',
            message: 'Dataset name:',
            default: 'my-mcp-tests',
          },
        ]);
        dataset = {
          name: datasetName,
          description: 'Generated eval dataset',
          cases: [],
        };
      }
    } else {
      const { datasetName } = await inquirer.prompt([
        {
          type: 'input',
          name: 'datasetName',
          message: 'Dataset name:',
          default: 'my-mcp-evals',
        },
      ]);
      dataset = {
        name: datasetName,
        description: 'Generated eval dataset',
        cases: [],
      };
    }

    // Generate test cases
    let addMore = true;
    while (addMore) {
      console.log(chalk.cyan('\n--- New Test Case ---\n'));

      // Select tool
      const { toolName } = await inquirer.prompt([
        {
          type: 'list',
          name: 'toolName',
          message: 'Select tool to test:',
          choices: tools.map((t) => ({
            name: `${t.name} - ${t.description}`,
            value: t.name,
          })),
        },
      ]);

      const selectedTool = tools.find((t) => t.name === toolName)!;

      // Get arguments
      const { argsJson } = await inquirer.prompt([
        {
          type: 'input',
          name: 'argsJson',
          message: 'Tool arguments (JSON):',
          default: '{}',
          validate: (input: string) => {
            try {
              JSON.parse(input);
              return true;
            } catch {
              return 'Invalid JSON';
            }
          },
        },
      ]);

      const args = JSON.parse(argsJson);

      // Call the tool
      const callSpinner = ora('Calling tool...').start();
      let response: unknown;
      let error: string | undefined;

      try {
        const result = await client.callTool(toolName, args);
        response = result.structuredContent ?? result.content;
        callSpinner.succeed('Tool called successfully');
        console.log(chalk.gray('\nResponse preview:'));
        console.log(
          chalk.gray(JSON.stringify(response, null, 2).substring(0, 500))
        );
        if (JSON.stringify(response).length > 500) {
          console.log(chalk.gray('... (truncated)'));
        }
      } catch (err) {
        error = err instanceof Error ? err.message : String(err);
        callSpinner.fail('Tool call failed');
        console.error(chalk.red(error));
      }

      if (!error) {
        // Suggest expectations
        const suggestions = suggestExpectations(response, selectedTool);

        console.log(chalk.cyan('\n📋 Suggested expectations:'));
        if (suggestions.textContains.length > 0) {
          console.log(chalk.gray('  Text contains:'));
          suggestions.textContains.forEach((text) => {
            console.log(chalk.gray(`    - "${text}"`));
          });
        }
        if (suggestions.regex.length > 0) {
          console.log(chalk.gray('  Regex patterns:'));
          suggestions.regex.forEach((pattern) => {
            console.log(chalk.gray(`    - /${pattern}/`));
          });
        }

        // Build test case
        const prompts: Array<{
          type: string;
          name: string;
          message: string;
          default?: string | boolean;
        }> = [
          {
            type: 'input',
            name: 'caseId',
            message: 'Test case ID:',
            default: `${toolName}-${dataset.cases.length + 1}`,
          },
          {
            type: 'input',
            name: 'description',
            message: 'Description (optional):',
          },
        ];

        // Only ask about expectations if not using --snapshot mode
        if (!options.snapshot) {
          prompts.push(
            {
              type: 'confirm',
              name: 'useTextContains',
              message: 'Add text contains expectations?',
              default: suggestions.textContains.length > 0,
            },
            {
              type: 'confirm',
              name: 'useRegex',
              message: 'Add regex expectations?',
              default: suggestions.regex.length > 0,
            },
            {
              type: 'confirm',
              name: 'useExact',
              message: 'Add exact match expectation?',
              default: false,
            },
            {
              type: 'confirm',
              name: 'useSnapshot',
              message: 'Use Playwright snapshot testing?',
              default: false,
            }
          );
        }

        const answers = await inquirer.prompt(prompts);
        const {
          caseId,
          description,
          useTextContains,
          useRegex,
          useExact,
          useSnapshot,
        } = answers as {
          caseId: string;
          description: string;
          useTextContains?: boolean;
          useRegex?: boolean;
          useExact?: boolean;
          useSnapshot?: boolean;
        };

        const testCase: EvalCase = {
          id: caseId,
          description: description || undefined,
          toolName,
          args,
        };

        // --snapshot flag or user chose snapshot
        if (options.snapshot || useSnapshot) {
          testCase.expectedSnapshot = caseId;
        }

        if (useTextContains && suggestions.textContains.length > 0) {
          testCase.expectedTextContains = suggestions.textContains;
        }

        if (useRegex && suggestions.regex.length > 0) {
          testCase.expectedRegex = suggestions.regex;
        }

        if (useExact) {
          testCase.expectedExact = response;
        }

        dataset.cases.push(testCase);

        console.log(chalk.green(`\n✓ Added test case "${caseId}"`));
        if (options.snapshot || useSnapshot) {
          console.log(chalk.gray(`  Using Playwright snapshot: "${caseId}"`));
        }
      }

      // Ask to add more
      const { continueAdding } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'continueAdding',
          message: 'Add another test case?',
          default: true,
        },
      ]);

      addMore = continueAdding;
    }

    // Save dataset
    if (dataset.cases.length > 0) {
      const saveSpinner = ora(`Saving dataset to ${outputPath}...`).start();

      const serialized: SerializedEvalDataset = {
        name: dataset.name,
        description: dataset.description,
        cases: dataset.cases,
        metadata: dataset.metadata || {
          version: '1.0',
          created: new Date().toISOString().split('T')[0],
        },
      };

      await writeFile(outputPath, JSON.stringify(serialized, null, 2));
      saveSpinner.succeed('Dataset saved');

      console.log(chalk.green.bold('\n✓ Dataset generation complete!\n'));
      console.log(chalk.cyan(`Total test cases: ${dataset.cases.length}`));
      console.log(chalk.gray(`Output: ${outputPath}`));
      console.log();
      console.log(chalk.cyan('Next steps:'));
      console.log(chalk.gray('  npx playwright test'));

      // Check if any cases use snapshots
      const hasSnapshots = dataset.cases.some((c) => c.expectedSnapshot);
      if (hasSnapshots) {
        console.log();
        console.log(chalk.cyan('Snapshot testing:'));
        console.log(chalk.gray('  First run will capture snapshots'));
        console.log(
          chalk.gray(
            '  Update snapshots: npx playwright test --update-snapshots'
          )
        );
      }
    } else {
      console.log(chalk.yellow('\nNo test cases added.'));
    }
  } finally {
    await closeMCPClient(client);
  }
}

async function getMCPConfig(configPath?: string): Promise<MCPConfig> {
  // If config path provided, load it
  if (configPath) {
    const content = await readFile(resolve(configPath), 'utf-8');
    const config = JSON.parse(content);
    return validateMCPConfig(config);
  }

  // Otherwise, prompt for configuration
  const { transport } = await inquirer.prompt<{ transport: 'stdio' | 'http' }>([
    {
      type: 'list',
      name: 'transport',
      message: 'MCP transport type:',
      choices: [
        { name: 'stdio (local server process)', value: 'stdio' },
        { name: 'http (remote server)', value: 'http' },
      ],
      default: 'stdio',
    },
  ]);

  if (transport === 'stdio') {
    const { serverCommand } = await inquirer.prompt<{ serverCommand: string }>([
      {
        type: 'input',
        name: 'serverCommand',
        message: 'Server command (e.g., node server.js):',
        default: 'node server.js',
      },
    ]);

    const [command, ...args] = serverCommand.split(' ');
    return validateMCPConfig({
      transport: 'stdio',
      command,
      args,
      capabilities: { roots: { listChanged: true } },
    });
  } else {
    const { serverUrl } = await inquirer.prompt<{ serverUrl: string }>([
      {
        type: 'input',
        name: 'serverUrl',
        message: 'Server URL:',
        default: 'http://localhost:3000/mcp',
      },
    ]);

    return validateMCPConfig({
      transport: 'http',
      serverUrl,
      capabilities: { roots: { listChanged: true } },
    });
  }
}
