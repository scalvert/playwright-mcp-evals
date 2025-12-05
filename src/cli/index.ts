/**
 * CLI entry point for @mcp-testing/server-tester
 */

import { Command } from 'commander';
import { init } from './commands/init.js';
import { generate } from './commands/generate.js';
import { login } from './commands/login.js';
import { token } from './commands/token.js';

const program = new Command();

program
  .name('mcp-test')
  .description('CLI tools for MCP server evaluation and testing')
  .version('0.1.0');

// Init command
program
  .command('init')
  .description('Initialize a new MCP evaluation project')
  .option('-n, --name <name>', 'Project name')
  .option('-d, --dir <directory>', 'Target directory', '.')
  .action(init);

// Generate command
program
  .command('generate')
  .alias('gen')
  .description('Generate eval dataset by interacting with MCP server')
  .option('-c, --config <path>', 'Path to MCP config')
  .option('-o, --output <path>', 'Output dataset path', 'data/dataset.json')
  .option('-s, --snapshot', 'Use Playwright snapshot testing for all cases')
  .action(generate);

// Login command
program
  .command('login')
  .description('Authenticate with an MCP server via OAuth')
  .argument('<server-url>', 'MCP server URL to authenticate with')
  .option('--force', 'Force re-authentication even if valid token exists')
  .option('--state-dir <dir>', 'Custom directory for token storage')
  .option('--scopes <scopes>', 'Comma-separated list of scopes to request (default: all from server)')
  .action(login);

// Token command
program
  .command('token')
  .description('Output stored OAuth tokens for CI/CD use')
  .argument('<server-url>', 'MCP server URL to get tokens for')
  .option('-f, --format <format>', 'Output format: env, json, or gh (default: env)', 'env')
  .option('--state-dir <dir>', 'Custom directory for token storage')
  .action(token);

program.parse();
