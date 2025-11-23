/**
 * CLI entry point for playwright-mcp-evals
 */

import { Command } from 'commander';
import { init } from './commands/init.js';
import { generate } from './commands/generate.js';

const program = new Command();

program
  .name('playwright-mcp-evals')
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
  .action(generate);

program.parse();
