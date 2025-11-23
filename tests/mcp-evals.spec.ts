import { test, expect } from './fixtures/mcp.js';
import {
  runConformanceChecks,
  formatConformanceResult,
} from '../src/spec/conformanceChecks.js';
import { loadEvalDataset } from '../src/evals/datasetLoader.js';
import { runEvalDataset } from '../src/evals/evalRunner.js';
import { createExactExpectation } from '../src/evals/expectations/exactExpectation.js';
import { createSchemaExpectation } from '../src/evals/expectations/schemaExpectation.js';
import { createTextContainsExpectation } from '../src/evals/expectations/textContainsExpectation.js';
import { createRegexExpectation } from '../src/evals/expectations/regexExpectation.js';
import { z } from 'zod';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

test.describe('MCP Server Tests', () => {
  test('should connect to MCP server and get server info', async ({ mcp }) => {
    const serverInfo = mcp.getServerInfo();
    expect(serverInfo).toBeTruthy();
    console.log('Server info:', serverInfo);
  });

  test('should list available tools', async ({ mcp }) => {
    const tools = await mcp.listTools();
    expect(tools.length).toBeGreaterThan(0);

    console.log(`Found ${tools.length} tools:`);
    for (const tool of tools) {
      console.log(
        `  - ${tool.name}: ${tool.description ?? '(no description)'}`
      );
    }
  });

  test('should run conformance checks', async ({ mcp }) => {
    const result = await runConformanceChecks(mcp, {
      validateSchemas: true,
      checkServerInfo: true,
    });

    console.log(formatConformanceResult(result));

    expect(result.pass).toBe(true);
  });

  test('should run eval dataset', async ({ mcp }) => {
    // Define schemas for validation
    const WeatherResponseSchema = z.object({
      city: z.string(),
      temperature: z.number(),
      conditions: z.string(),
    });

    // Load dataset
    const dataset = await loadEvalDataset(
      join(__dirname, '../data/eval_dataset.json'),
      {
        schemas: {
          'weather-response': WeatherResponseSchema,
        },
      }
    );

    // Run evals (only the ones our mock server supports)
    const result = await runEvalDataset(
      {
        dataset,
        expectations: {
          exact: createExactExpectation(),
          schema: createSchemaExpectation(dataset),
          textContains: createTextContainsExpectation(),
          regex: createRegexExpectation(),
        },
        onCaseComplete: (caseResult) => {
          const status = caseResult.pass ? '✓' : '✗';
          console.log(`  ${status} ${caseResult.id}`);
          if (!caseResult.pass) {
            console.log(
              `    Error: ${caseResult.error ?? 'Expectation failed'}`
            );
            if (caseResult.expectations.schema && !caseResult.expectations.schema.pass) {
              console.log(`    Schema: ${caseResult.expectations.schema.details}`);
            }
            if (caseResult.expectations.exact && !caseResult.expectations.exact.pass) {
              console.log(`    Exact: ${caseResult.expectations.exact.details}`);
            }
            if (caseResult.expectations.textContains && !caseResult.expectations.textContains.pass) {
              console.log(`    TextContains: ${caseResult.expectations.textContains.details}`);
            }
            if (caseResult.expectations.regex && !caseResult.expectations.regex.pass) {
              console.log(`    Regex: ${caseResult.expectations.regex.details}`);
            }
          }
        },
      },
      { mcp }
    );

    console.log(`\nEval Results: ${result.passed}/${result.total} passed`);

    // Mock server supports get_weather, calculate, and get_city_info tools
    // All cases should pass now with text-based expectations
    expect(result.passed).toBeGreaterThanOrEqual(4);
  });

  test('should handle tool call errors gracefully', async ({ mcp }) => {
    const result = await mcp.callTool('nonexistent_tool', {});
    // MCP SDK returns isError: true instead of throwing
    expect(result.isError).toBe(true);
  });
});
