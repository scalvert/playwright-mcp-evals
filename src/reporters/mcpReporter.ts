import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
} from '@playwright/test/reporter';
import { mkdir, writeFile, readdir, readFile, unlink, cp } from 'fs/promises';
import { join, resolve, dirname } from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import type {
  MCPEvalReporterConfig,
  MCPEvalRunData,
  MCPEvalHistoricalSummary,
} from './types.js';
import type { EvalCaseResult } from '../evals/evalRunner.js';

/**
 * Custom Playwright reporter for MCP eval results
 *
 * Generates HTML reports with historical tracking and auto-opens in browser
 *
 * @example
 * ```typescript
 * // playwright.config.ts
 * export default defineConfig({
 *   reporter: [
 *     ['@mcp-testing/server-tester/reporters/mcpReporter', {
 *       outputDir: '.mcp-test-results',
 *       autoOpen: true,
 *       historyLimit: 10
 *     }]
 *   ]
 * });
 * ```
 */
export default class MCPReporter implements Reporter {
  private config: Required<MCPEvalReporterConfig>;
  private startTime: number = 0;
  private allResults: Array<EvalCaseResult> = [];

  constructor(options: MCPEvalReporterConfig = {}) {
    this.config = {
      outputDir: options.outputDir ?? '.mcp-test-results',
      autoOpen: options.autoOpen ?? true,
      historyLimit: options.historyLimit ?? 10,
    };
  }

  async onBegin(_config: FullConfig, _suite: Suite): Promise<void> {
    this.startTime = Date.now();
    this.allResults = [];

    // Ensure output directory exists
    await mkdir(this.config.outputDir, { recursive: true });
  }

  async onTestEnd(test: TestCase, result: TestResult): Promise<void> {
    // Strategy 1: Extract MCP eval results from runEvalDataset() attachments
    const evalAttachment = result.attachments.find(
      (a) => a.name === 'mcp-test-results' && a.contentType === 'application/json'
    );

    let hasEvalDataset = false;

    if (evalAttachment && evalAttachment.body) {
      try {
        const evalResults = JSON.parse(
          evalAttachment.body.toString('utf-8')
        ) as {
          caseResults: Array<EvalCaseResult>;
        };

        this.allResults.push(...evalResults.caseResults);
        hasEvalDataset = true;
      } catch (error) {
        console.error(
          `[MCP Reporter] Failed to parse eval results from test "${test.title}":`,
          error
        );
      }
    }

    // Strategy 2: Extract MCP tool calls from auto-tracking attachments
    // These are created by createMCPFixture()
    // Skip if this test already has eval dataset results to avoid duplicates
    if (hasEvalDataset) {
      return;
    }

    const mcpCallAttachments = result.attachments.filter(
      (a) => a.name && a.name.startsWith('mcp-call-') && a.contentType === 'application/json'
    );

    for (const attachment of mcpCallAttachments) {
      if (!attachment.body) continue;

      try {
        const callData = JSON.parse(attachment.body.toString('utf-8')) as {
          operation: string;
          toolName: string;
          args: Record<string, unknown>;
          result: unknown;
          durationMs: number;
          isError: boolean;
        };

        // Create a synthetic EvalCaseResult from the MCP call data
        // For test results, use the describe block name as the suite identifier
        const suiteName = test.parent?.title || 'Uncategorized Tests';

        const syntheticResult: EvalCaseResult = {
          id: `${test.title}-${callData.toolName}`,
          datasetName: suiteName,
          toolName: callData.toolName,
          mode: 'direct',
          source: 'test',
          pass: !callData.isError,
          response: callData.result,
          error: callData.isError ? 'Tool call returned error' : undefined,
          expectations: {}, // No expectations for direct API calls
          durationMs: callData.durationMs,
        };

        this.allResults.push(syntheticResult);
      } catch (error) {
        console.error(
          `[MCP Reporter] Failed to parse MCP call attachment "${attachment.name}":`,
          error
        );
      }
    }
  }

  async onEnd(_result: FullResult): Promise<void> {
    const endTime = Date.now();
    const durationMs = endTime - this.startTime;

    // Skip if no eval results collected
    if (this.allResults.length === 0) {
      console.log('[MCP Reporter] No MCP eval results found in test run');
      return;
    }

    // Build run data
    const runData = this.buildRunData(durationMs);

    // Load historical data
    const historical = await this.loadHistoricalData();

    // Add current run to historical
    historical.push({
      timestamp: runData.timestamp,
      total: runData.metrics.total,
      passed: runData.metrics.passed,
      failed: runData.metrics.failed,
      passRate: runData.metrics.passRate,
      durationMs: runData.durationMs,
    });

    // Save current run data
    await this.saveRunData(runData);

    // Clean up old runs
    await this.cleanupOldRuns();

    // Generate report using copy + inject pattern
    const reportDir = join(this.config.outputDir, 'latest');
    await this.generateReport(runData, historical, reportDir);

    const reportPath = join(reportDir, 'index.html');
    console.log(`\n[MCP Reporter] Report generated: ${reportPath}`);
    console.log(
      `[MCP Reporter] Results: ${runData.metrics.passed}/${runData.metrics.total} passed (${(runData.metrics.passRate * 100).toFixed(1)}%)`
    );

    // Auto-open browser if configured and not in CI
    if (this.config.autoOpen && !process.env.CI) {
      await this.openReport(reportPath);
    }
  }

  private async generateReport(
    runData: MCPEvalRunData,
    historical: Array<MCPEvalHistoricalSummary>,
    outputDir: string
  ): Promise<void> {
    // Get the UI dist path (relative to this file)
    // In ESM, we need to use import.meta.url
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const uiDistPath = join(__dirname, 'ui-dist');

    // Step 1: Copy pre-built UI template
    await mkdir(outputDir, { recursive: true });
    await cp(uiDistPath, outputDir, { recursive: true, force: true });

    // Step 2: Inject test data as JavaScript
    const dataScript = `window.MCP_EVAL_DATA = ${JSON.stringify(
      {
        runData,
        historical,
      },
      null,
      2
    )};`;

    await writeFile(join(outputDir, 'data.js'), dataScript, 'utf-8');
  }

  private buildRunData(durationMs: number): MCPEvalRunData {
    const passed = this.allResults.filter((r) => r.pass).length;
    const failed = this.allResults.filter((r) => !r.pass).length;

    // Group by dataset name
    const datasetBreakdown: Record<string, number> = {};
    this.allResults.forEach((r) => {
      const datasetName = r.datasetName || 'Unknown Dataset';
      datasetBreakdown[datasetName] = (datasetBreakdown[datasetName] || 0) + 1;
    });

    // Count expectation types used
    const expectationBreakdown = {
      exact: 0,
      schema: 0,
      textContains: 0,
      regex: 0,
      snapshot: 0,
      judge: 0,
    };

    this.allResults.forEach((r) => {
      if (r.expectations.exact) expectationBreakdown.exact++;
      if (r.expectations.schema) expectationBreakdown.schema++;
      if (r.expectations.textContains) expectationBreakdown.textContains++;
      if (r.expectations.regex) expectationBreakdown.regex++;
      if (r.expectations.snapshot) expectationBreakdown.snapshot++;
      if (r.expectations.judge) expectationBreakdown.judge++;
    });

    return {
      timestamp: new Date().toISOString(),
      durationMs,
      environment: {
        ci: !!process.env.CI,
        node: process.version,
        platform: process.platform,
      },
      metrics: {
        total: this.allResults.length,
        passed,
        failed,
        passRate: passed / this.allResults.length,
        datasetBreakdown,
        expectationBreakdown,
      },
      results: this.allResults,
    };
  }

  private async loadHistoricalData(): Promise<
    Array<MCPEvalHistoricalSummary>
  > {
    try {
      if (!existsSync(this.config.outputDir)) {
        return [];
      }

      const files = await readdir(this.config.outputDir);
      const runFiles = files
        .filter((f) => f.startsWith('run-') && f.endsWith('.json'))
        .sort()
        .reverse()
        .slice(0, this.config.historyLimit - 1); // -1 to make room for current run

      const historical: Array<MCPEvalHistoricalSummary> = [];

      for (const file of runFiles) {
        try {
          const content = await readFile(
            join(this.config.outputDir, file),
            'utf-8'
          );
          const runData = JSON.parse(content) as MCPEvalRunData;

          historical.push({
            timestamp: runData.timestamp,
            total: runData.metrics.total,
            passed: runData.metrics.passed,
            failed: runData.metrics.failed,
            passRate: runData.metrics.passRate,
            durationMs: runData.durationMs,
          });
        } catch (error) {
          console.error(`[MCP Reporter] Failed to load ${file}:`, error);
        }
      }

      return historical.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    } catch (error) {
      console.error('[MCP Reporter] Failed to load historical data:', error);
      return [];
    }
  }

  private async saveRunData(runData: MCPEvalRunData): Promise<void> {
    const filename = `run-${runData.timestamp.replace(/:/g, '-')}.json`;
    const filepath = join(this.config.outputDir, filename);

    await writeFile(filepath, JSON.stringify(runData, null, 2), 'utf-8');
  }

  private async cleanupOldRuns(): Promise<void> {
    try {
      const files = await readdir(this.config.outputDir);
      const runFiles = files
        .filter((f) => f.startsWith('run-') && f.endsWith('.json'))
        .sort()
        .reverse();

      // Keep only historyLimit most recent runs
      const toDelete = runFiles.slice(this.config.historyLimit);

      for (const file of toDelete) {
        await unlink(join(this.config.outputDir, file));
      }
    } catch (error) {
      console.error('[MCP Reporter] Failed to cleanup old runs:', error);
    }
  }

  private async openReport(reportPath: string): Promise<void> {
    try {
      // Dynamic import to avoid bundling issues
      const { default: open } = await import('open');
      const absolutePath = resolve(reportPath);

      await open(absolutePath);
      console.log('[MCP Reporter] Opened report in browser');
    } catch (error) {
      console.error('[MCP Reporter] Failed to open report:', error);
      console.log(`[MCP Reporter] Open manually: file://${resolve(reportPath)}`);
    }
  }
}
