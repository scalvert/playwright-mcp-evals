#!/usr/bin/env tsx
/**
 * Preview script for MCP Eval Reporter
 *
 * Generates a preview HTML report with mock data
 *
 * Usage:
 *   npm run preview-reporter
 *   # or
 *   tsx scripts/preview-reporter.ts
 */

import { writeFile, mkdir, cp } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type {
  MCPEvalRunData,
  MCPEvalHistoricalSummary,
} from '../src/reporters/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Generate mock eval run data
const mockRunData: MCPEvalRunData = {
  timestamp: new Date().toISOString(),
  durationMs: 5432,
  environment: {
    ci: false,
    node: process.version,
    platform: process.platform,
  },
  metrics: {
    total: 15,
    passed: 12,
    failed: 3,
    passRate: 0.8,
    toolBreakdown: {
      get_weather: 6,
      search_docs: 5,
      calculate: 3,
      get_city_info: 1,
    },
    expectationBreakdown: {
      exact: 3,
      schema: 2,
      textContains: 8,
      regex: 5,
      judge: 2,
    },
  },
  results: [
    {
      id: 'weather-london',
      pass: true,
      response: {
        content: [
          {
            type: 'text',
            text: '## Weather Report\n\n**City:** London\n**Temperature:** 15°C\n**Conditions:** Partly cloudy\n**Humidity:** 65%',
          },
        ],
      },
      expectations: {
        textContains: {
          pass: true,
          details:
            'Text contains all 3 expected substrings: "## Weather Report", "London", "Temperature"',
        },
        regex: {
          pass: true,
          details:
            'Text matches all 2 expected patterns: "^## Weather", "Temperature: \\d+°C"',
        },
      },
      durationMs: 234,
    },
    {
      id: 'weather-paris',
      pass: true,
      response: {
        content: [
          {
            type: 'text',
            text: '## Weather Report\n\n**City:** Paris\n**Temperature:** 18°C\n**Conditions:** Sunny\n**Humidity:** 55%',
          },
        ],
      },
      expectations: {
        textContains: {
          pass: true,
          details: 'Text contains expected substring "Paris"',
        },
      },
      durationMs: 198,
    },
    {
      id: 'weather-invalid-city',
      pass: false,
      response: null,
      error: 'City not found: InvalidCity123',
      expectations: {},
      durationMs: 123,
    },
    {
      id: 'search-docs-playwright',
      pass: true,
      response: {
        content: [
          {
            type: 'text',
            text: 'Found 42 documents matching "playwright":\n- Getting Started with Playwright\n- Playwright Best Practices\n- Advanced Playwright Patterns',
          },
        ],
      },
      expectations: {
        textContains: {
          pass: true,
          details: 'Text contains all expected substrings',
        },
        regex: {
          pass: true,
          details: 'Text matches pattern "Found \\d+ documents"',
        },
      },
      durationMs: 456,
    },
    {
      id: 'search-docs-empty-query',
      pass: false,
      response: {
        content: [
          {
            type: 'text',
            text: 'No results found',
          },
        ],
      },
      expectations: {
        textContains: {
          pass: false,
          details:
            'Missing 1 substring(s): "Found"\n\nResponse text:\nNo results found',
        },
      },
      durationMs: 89,
    },
    {
      id: 'calculate-addition',
      pass: true,
      response: {
        result: 42,
        operation: 'add',
        operands: [20, 22],
      },
      expectations: {
        exact: {
          pass: true,
          details: 'Response matches expected value',
        },
        schema: {
          pass: true,
          details: 'Response conforms to schema "calculation-result"',
        },
      },
      durationMs: 12,
    },
    {
      id: 'calculate-division-by-zero',
      pass: false,
      response: null,
      error: 'Cannot divide by zero',
      expectations: {},
      durationMs: 8,
    },
    {
      id: 'city-info-london',
      pass: true,
      response: {
        content: [
          {
            type: 'text',
            text: '## City Information\n\n**City:** London\n**Country:** United Kingdom\n**Population:** 9,000,000\n**Area:** 1,572 km²\n**Founded:** 43 AD',
          },
        ],
      },
      expectations: {
        textContains: {
          pass: true,
          details: 'Text contains all expected city information markers',
        },
        regex: {
          pass: true,
          details:
            'Text matches patterns for city data format (population, area)',
        },
      },
      durationMs: 334,
    },
    {
      id: 'search-docs-mcp-protocol',
      pass: true,
      response: {
        content: [
          {
            type: 'text',
            text: 'Found 15 documents about MCP protocol:\n- Model Context Protocol Specification\n- Building MCP Servers\n- MCP Client Libraries',
          },
        ],
      },
      expectations: {
        textContains: {
          pass: true,
          details: 'Contains "MCP protocol"',
        },
      },
      durationMs: 278,
    },
    {
      id: 'calculate-multiplication',
      pass: true,
      response: {
        result: 144,
        operation: 'multiply',
        operands: [12, 12],
      },
      expectations: {
        exact: {
          pass: true,
          details: 'Response matches expected value',
        },
      },
      durationMs: 10,
    },
    {
      id: 'weather-tokyo-judge',
      pass: true,
      response: {
        content: [
          {
            type: 'text',
            text: '## Weather Report\n\n**City:** Tokyo\n**Temperature:** 22°C\n**Conditions:** Clear\n**Humidity:** 60%\n**Wind:** 10 km/h NE',
          },
        ],
      },
      expectations: {
        judge: {
          pass: true,
          details:
            'Judge: PASS\nScore: 0.95 (threshold: 0.70)\nReasoning: Response provides comprehensive weather information with proper formatting',
        },
        textContains: {
          pass: true,
          details: 'Contains expected weather data fields',
        },
      },
      durationMs: 1234,
    },
    {
      id: 'search-docs-schema-validation',
      pass: true,
      response: {
        results: [
          { id: 1, title: 'Schema Validation Basics', score: 0.95 },
          { id: 2, title: 'Advanced Schema Patterns', score: 0.87 },
        ],
        total: 2,
      },
      expectations: {
        schema: {
          pass: true,
          details: 'Response conforms to schema "search-results"',
        },
      },
      durationMs: 445,
    },
    {
      id: 'calculate-complex-expression',
      pass: true,
      response: {
        result: 156,
        operation: 'expression',
        expression: '(12 + 8) * 7 + 16',
      },
      expectations: {
        exact: {
          pass: true,
          details: 'Response matches expected calculation',
        },
      },
      durationMs: 34,
    },
    {
      id: 'weather-schema-fail',
      pass: false,
      response: {
        content: [
          {
            type: 'text',
            text: 'Invalid temperature data',
          },
        ],
      },
      expectations: {
        schema: {
          pass: false,
          details:
            'Schema validation failed for "weather-response":\n  - temperature: Required field missing\n  - conditions: Required field missing',
        },
      },
      durationMs: 145,
    },
    {
      id: 'search-docs-llm-judge',
      pass: true,
      response: {
        content: [
          {
            type: 'text',
            text: 'Comprehensive search results for LLM evaluation:\n\n1. **LLM-as-a-Judge Patterns** - Covers semantic evaluation techniques\n2. **Automated Testing with LLMs** - Best practices for eval harnesses\n3. **Prompt Engineering for Evals** - Crafting effective rubrics',
          },
        ],
      },
      expectations: {
        judge: {
          pass: true,
          details:
            'Judge: PASS\nScore: 0.92 (threshold: 0.70)\nReasoning: Results are relevant, well-formatted, and provide substantive information about the query topic',
        },
      },
      durationMs: 1567,
    },
  ],
};

// Generate historical data (last 10 runs)
const mockHistorical: MCPEvalHistoricalSummary[] = [];
const now = new Date();

for (let i = 9; i >= 0; i--) {
  const timestamp = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
  const total = 12 + Math.floor(Math.random() * 6);
  const passed = Math.floor(total * (0.7 + Math.random() * 0.25));

  mockHistorical.push({
    timestamp: timestamp.toISOString(),
    total,
    passed,
    failed: total - passed,
    passRate: passed / total,
    durationMs: 3000 + Math.floor(Math.random() * 4000),
  });
}

async function main() {
  console.log('🎭 Generating MCP Eval Reporter preview...\n');

  const outputDir = '.preview-output';

  // Step 1: Copy pre-built UI template
  console.log('📦 Copying UI template...');
  const uiDistPath = join(__dirname, '../src/reporters/ui-dist');
  await mkdir(outputDir, { recursive: true });
  await cp(uiDistPath, outputDir, { recursive: true, force: true });
  console.log('✅ UI template copied\n');

  // Step 2: Inject test data as JavaScript
  console.log('💉 Injecting mock data...');
  const dataScript = `window.MCP_EVAL_DATA = ${JSON.stringify(
    {
      runData: mockRunData,
      historical: mockHistorical,
    },
    null,
    2
  )};`;
  await writeFile(join(outputDir, 'data.js'), dataScript, 'utf-8');
  console.log('✅ Mock data injected\n');

  console.log('✅ Preview report generated!');
  console.log(`📄 Location: ${outputDir}/index.html`);
  console.log('\n📊 Mock Data Summary:');
  console.log(`   • Total Cases: ${mockRunData.metrics.total}`);
  console.log(`   • Passed: ${mockRunData.metrics.passed}`);
  console.log(`   • Failed: ${mockRunData.metrics.failed}`);
  console.log(
    `   • Pass Rate: ${(mockRunData.metrics.passRate * 100).toFixed(1)}%`
  );
  console.log(`   • Duration: ${mockRunData.durationMs}ms`);
  console.log(
    `   • Historical Runs: ${mockHistorical.length} (with trend data)`
  );

  // Try to open in browser
  try {
    const { default: open } = await import('open');
    await open(join(outputDir, 'index.html'));
    console.log('\n🌐 Opened report in browser!');
  } catch (error) {
    console.log('\n💡 Open manually:');
    console.log(`   file://${process.cwd()}/${outputDir}/index.html`);
  }
}

main().catch((error) => {
  console.error('Error generating preview:', error);
  process.exit(1);
});
