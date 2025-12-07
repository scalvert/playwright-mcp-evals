import { mkdir, writeFile, stat } from 'fs/promises';
import { join, resolve } from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import {
  getPlaywrightConfigTemplate,
  getTestFileTemplate,
  getDatasetTemplate,
  getGitignoreTemplate,
  getPackageJsonTemplate,
  getTsconfigTemplate,
} from '../templates/index.js';

interface InitOptions {
  name?: string;
  dir?: string;
}

export async function init(options: InitOptions): Promise<void> {
  console.log(
    chalk.cyan.bold('\n🎭 Playwright MCP Evals - Project Initializer\n')
  );

  // Prompt for configuration - done sequentially to avoid complex type inference
  const basicAnswers = await inquirer.prompt<{
    projectName: string;
    transport: 'stdio' | 'http';
    installDeps: boolean;
  }>([
    {
      type: 'input',
      name: 'projectName',
      message: 'Project name:',
      default: options.name || 'my-mcp-tests',
      validate: (input: string) =>
        input.length > 0 || 'Project name cannot be empty',
    },
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
    {
      type: 'confirm',
      name: 'installDeps',
      message: 'Install dependencies now?',
      default: true,
    },
  ]);

  // Get transport-specific config
  let serverCommand: string | undefined;
  let serverUrl: string | undefined;

  if (basicAnswers.transport === 'stdio') {
    const { command } = await inquirer.prompt<{ command: string }>([
      {
        type: 'input',
        name: 'command',
        message: 'Server command (for stdio):',
        default: 'node server.js',
      },
    ]);
    serverCommand = command;
  } else {
    const { url } = await inquirer.prompt<{ url: string }>([
      {
        type: 'input',
        name: 'url',
        message: 'Server URL (for http):',
        default: 'http://localhost:3000/mcp',
      },
    ]);
    serverUrl = url;
  }

  const answers = {
    ...basicAnswers,
    serverCommand,
    serverUrl,
  };

  const targetDir = resolve(options.dir || '.');
  const projectPath = join(targetDir, answers.projectName);

  let dirExists = false;
  try {
    await stat(projectPath);
    dirExists = true;
  } catch {
    // Directory doesn't exist
  }

  if (dirExists) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `Directory ${answers.projectName} already exists. Overwrite?`,
        default: false,
      },
    ]);

    if (!overwrite) {
      console.log(chalk.yellow('\n✖ Initialization cancelled'));
      process.exit(0);
    }
  }

  const spinner = ora('Creating project structure...').start();

  try {
    // Create directories
    await mkdir(projectPath, { recursive: true });
    await mkdir(join(projectPath, 'tests'), { recursive: true });
    await mkdir(join(projectPath, 'data'), { recursive: true });

    // Generate files
    const files = [
      {
        path: 'playwright.config.ts',
        content: getPlaywrightConfigTemplate(answers),
      },
      {
        path: 'tests/mcp.spec.ts',
        content: getTestFileTemplate(answers),
      },
      {
        path: 'data/example-dataset.json',
        content: getDatasetTemplate(answers),
      },
      {
        path: '.gitignore',
        content: getGitignoreTemplate(),
      },
      {
        path: 'package.json',
        content: getPackageJsonTemplate(answers.projectName),
      },
      {
        path: 'tsconfig.json',
        content: getTsconfigTemplate(),
      },
    ];

    for (const file of files) {
      await writeFile(join(projectPath, file.path), file.content);
    }

    spinner.succeed('Project structure created');

    // Install dependencies
    if (answers.installDeps) {
      const installSpinner = ora('Installing dependencies...').start();

      const { spawn } = await import('child_process');
      const npm = spawn('npm', ['install'], {
        cwd: projectPath,
        stdio: 'pipe',
      });

      await new Promise<void>((resolve, reject) => {
        npm.on('close', (code) => {
          if (code === 0) {
            installSpinner.succeed('Dependencies installed');
            resolve();
          } else {
            installSpinner.fail('Failed to install dependencies');
            reject(new Error(`npm install exited with code ${code}`));
          }
        });
      });
    }

    // Success message
    console.log(chalk.green.bold('\n✓ Project initialized successfully!\n'));
    console.log(chalk.cyan('Next steps:'));
    console.log(chalk.gray(`  cd ${answers.projectName}`));
    if (!answers.installDeps) {
      console.log(chalk.gray('  npm install'));
    }
    console.log(chalk.gray('  npm test'));
    console.log();
    console.log(chalk.cyan('To generate a dataset:'));
    console.log(chalk.gray('  npx mcp-test generate'));
    console.log();
  } catch (error) {
    spinner.fail('Failed to create project');
    console.error(
      chalk.red(error instanceof Error ? error.message : String(error))
    );
    process.exit(1);
  }
}
