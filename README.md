# playwright-mcp-evals

> Playwright-based eval & testing framework for MCP servers

`playwright-mcp-evals` is a comprehensive testing and evaluation framework for [Model Context Protocol (MCP)](https://modelcontextprotocol.io) servers. It provides first-class Playwright fixtures, data-driven eval harnesses, and optional LLM-as-a-judge scoring.

## Features

- 🎭 **Playwright Integration** - Use MCP servers in Playwright tests with idiomatic fixtures
- 📊 **Matrix Evals** - Run dataset-driven evaluations across multiple transports
- 🤖 **LLM-as-a-Judge** - Optional semantic evaluation using OpenAI or Anthropic
- 🔌 **Multiple Transports** - Support for both stdio (local) and HTTP (remote) connections
- ✅ **Protocol Conformance** - Built-in checks for MCP spec compliance
- 📝 **Type-Safe** - Full TypeScript support using official MCP SDK types

## Installation

```bash
npm install --save-dev playwright-mcp-evals @playwright/test @modelcontextprotocol/sdk zod
```

## Quick Start

### 0. Initialize a Project (CLI)

The fastest way to get started is using the CLI:

```bash
npx playwright-mcp-evals init

# Follow the interactive prompts:
? Project name: my-mcp-tests
? MCP transport type: stdio (local server process)
? Server command (for stdio): node server.js
? Install dependencies now? Yes

✓ Project initialized successfully!

Next steps:
  cd my-mcp-tests
  npm test
```

This creates:
- `playwright.config.ts` - Configured for your MCP server
- `tests/mcp.spec.ts` - Example tests
- `data/example-dataset.json` - Sample eval dataset
- `package.json` - With all dependencies

### 1. Configure Playwright (Manual Setup)

Add MCP configuration to your `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  projects: [
    {
      name: 'mcp-local',
      use: {
        mcpConfig: {
          transport: 'stdio',
          command: 'node',
          args: ['path/to/your/server.js'],
          capabilities: {
            roots: { listChanged: true },
          },
        },
      },
    },
    // Add more projects for different transports/servers
  ],
});
```

### 2. Use MCP Fixtures in Tests

```typescript
import { test, expect } from 'playwright-mcp-evals/fixtures/mcp';

test('lists tools from MCP server', async ({ mcp }) => {
  const tools = await mcp.listTools();
  expect(tools.length).toBeGreaterThan(0);
});

test('calls a tool', async ({ mcp }) => {
  const result = await mcp.callTool('get_weather', { city: 'London' });
  expect(result).toBeTruthy();
});
```

### 3. Generate Eval Datasets (CLI)

The easiest way to create datasets is using the interactive generator:

```bash
npx playwright-mcp-evals generate

# Interactive workflow:
? MCP transport type: stdio
? Server command: node server.js
✓ Connected to MCP server
✓ Found 3 tools

? Select tool to test: get_weather
? Tool arguments (JSON): { "city": "London" }
✓ Tool called successfully

Response preview:
{
  "city": "London",
  "temperature": 20,
  "conditions": "Sunny"
}

📋 Suggested expectations:
  Text contains:
    - "London"
    - "temperature"
  Regex patterns:
    - \d+

? Test case ID: weather-london
? Add text contains expectations? Yes
? Add regex expectations? Yes
✓ Added test case "weather-london"

? Add another test case? No
✓ Dataset saved to data/dataset.json
```

Or create datasets manually (`data/evals.json`):

```json
{
  "name": "weather-tool-evals",
  "cases": [
    {
      "id": "london-weather",
      "toolName": "get_weather",
      "args": { "city": "London" },
      "expectedSchemaName": "weather-response"
    }
  ]
}
```

Run evals in your test:

```typescript
import { test } from 'playwright-mcp-evals/fixtures/mcp';
import {
  loadEvalDataset,
  runEvalDataset,
  createSchemaExpectation,
} from 'playwright-mcp-evals';
import { z } from 'zod';

test('run weather evals', async ({ mcp }) => {
  const WeatherSchema = z.object({
    city: z.string(),
    temperature: z.number(),
    conditions: z.string(),
  });

  const dataset = await loadEvalDataset('./data/evals.json', {
    schemas: { 'weather-response': WeatherSchema },
  });

  const result = await runEvalDataset(
    {
      dataset,
      expectations: {
        schema: createSchemaExpectation(dataset),
      },
    },
    { mcp }
  );

  expect(result.passed).toBe(result.total);
});
```

## Configuration

### Transport Types

#### Stdio (Local Server)

```typescript
mcpConfig: {
  transport: 'stdio',
  command: 'node',
  args: ['server.js'],
  debugLogging: true,
}
```

#### HTTP (Remote Server)

```typescript
mcpConfig: {
  transport: 'http',
  serverUrl: 'http://localhost:3000/mcp',
  requestTimeoutMs: 5000,
}
```

## Eval Expectations

The framework supports multiple types of expectations to validate MCP tool responses:

### Exact Match

Validates exact equality of structured data (JSON):

```typescript
import { createExactExpectation } from 'playwright-mcp-evals';

const expectations = {
  exact: createExactExpectation(),
};

// In your dataset:
{
  "id": "calc-test",
  "toolName": "calculate",
  "args": { "a": 2, "b": 3 },
  "expectedExact": { "result": 5 }
}
```

### Text Contains

Validates that response text contains expected substrings (ideal for markdown/unstructured text):

```typescript
import { createTextContainsExpectation } from 'playwright-mcp-evals';

const expectations = {
  textContains: createTextContainsExpectation(),
  // Optional: case-insensitive matching
  // textContains: createTextContainsExpectation({ caseSensitive: false }),
};

// In your dataset:
{
  "id": "markdown-response",
  "toolName": "get_city_info",
  "args": { "city": "London" },
  "expectedTextContains": [
    "## City Information",
    "**City:** London",
    "### Features",
    "- Public Transportation"
  ]
}
```

### Regex Pattern Matching

Validates that response text matches regex patterns (powerful for format validation):

```typescript
import { createRegexExpectation } from 'playwright-mcp-evals';

const expectations = {
  regex: createRegexExpectation(),
};

// In your dataset:
{
  "id": "weather-format",
  "toolName": "get_weather",
  "args": { "city": "London" },
  "expectedRegex": [
    "^## Weather",
    "Temperature: \\d+°[CF]",
    "Conditions?: (Sunny|Cloudy|Rainy|Snowy)",
    "\\d{4}-\\d{2}-\\d{2}"
  ]
}
```

**Note:** Regex patterns support multiline matching (^ and $ match line starts/ends).

### Schema Validation

Validates using Zod schemas:

```typescript
import { createSchemaExpectation } from 'playwright-mcp-evals';
import { z } from 'zod';

const dataset = await loadEvalDataset('./evals.json', {
  schemas: {
    'user-response': z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
    }),
  },
});

const expectations = {
  schema: createSchemaExpectation(dataset),
};
```

### LLM-as-a-Judge

Semantic evaluation using LLMs:

```typescript
import {
  createJudgeExpectation,
  createLLMJudgeClient,
} from 'playwright-mcp-evals';

const judgeClient = createLLMJudgeClient({
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.0,
});

const expectations = {
  judge: createJudgeExpectation({
    'search-relevance': {
      rubric:
        'Evaluate if the search results are relevant to the query. Score 0-1.',
      passingThreshold: 0.7,
    },
  }),
};

const result = await runEvalDataset(
  { dataset, expectations, judgeClient },
  { mcp }
);
```

Supported providers:

- `openai` - Requires `OPENAI_API_KEY` env var
- `anthropic` - Requires `ANTHROPIC_API_KEY` env var

### Combining Multiple Expectations

You can use multiple expectations together:

```typescript
const result = await runEvalDataset(
  {
    dataset,
    expectations: {
      exact: createExactExpectation(),
      schema: createSchemaExpectation(dataset),
      textContains: createTextContainsExpectation(),
      regex: createRegexExpectation(),
      judge: createJudgeExpectation(judgeConfigs),
    },
    judgeClient,
  },
  { mcp }
);
```

Each eval case will use the appropriate expectation based on which fields are defined (`expectedExact`, `expectedSchemaName`, `expectedTextContains`, `expectedRegex`, `judgeConfigId`).

## Protocol Conformance

Check MCP spec compliance:

```typescript
import { runConformanceChecks } from 'playwright-mcp-evals';

test('MCP conformance', async ({ mcp }) => {
  const result = await runConformanceChecks(mcp, {
    requiredTools: ['get_weather', 'search_docs'],
    validateSchemas: true,
  });

  expect(result.pass).toBe(true);
});
```

## API Reference

### Fixtures

- `mcpClient: Client` - Raw MCP SDK client
- `mcp: MCPFixtureApi` - High-level test API

### MCPFixtureApi

```typescript
interface MCPFixtureApi {
  client: Client;
  listTools(): Promise<Array<Tool>>;
  callTool<TArgs>(name: string, args: TArgs): Promise<CallToolResult>;
  getServerInfo(): { name?: string; version?: string } | null;
}
```

### Eval Functions

- `loadEvalDataset(path, options)` - Load eval dataset from JSON
- `runEvalDataset(options, context)` - Run eval dataset
- `createExactExpectation()` - Create exact match expectation (for JSON)
- `createTextContainsExpectation(options?)` - Create text contains expectation (for markdown/text)
- `createRegexExpectation()` - Create regex pattern expectation (for format validation)
- `createSchemaExpectation(dataset)` - Create schema validation expectation
- `createJudgeExpectation(configs)` - Create LLM judge expectation

### Text Utilities

- `extractTextFromResponse(response)` - Extract text from various MCP response formats
- `normalizeWhitespace(text)` - Normalize whitespace for comparison
- `findMissingSubstrings(text, substrings, caseSensitive?)` - Check for missing substrings
- `findFailedPatterns(text, patterns)` - Check which regex patterns failed

### Judge Functions

- `createLLMJudgeClient(config)` - Create LLM judge client
- Providers: `openai`, `anthropic`, `custom-http`

### Conformance

- `runConformanceChecks(mcp, options)` - Run protocol conformance checks
- `formatConformanceResult(result)` - Format check results

## CLI Commands

### `init` - Initialize Project

```bash
npx playwright-mcp-evals init [options]

Options:
  -n, --name <name>      Project name
  -d, --dir <directory>  Target directory (default: ".")
  -h, --help             Display help
```

Creates a complete project structure with:
- Playwright configuration
- Example tests
- Sample eval dataset
- TypeScript setup
- Dependencies

### `generate` - Generate Eval Dataset

```bash
npx playwright-mcp-evals generate [options]

Options:
  -c, --config <path>  Path to MCP config JSON file
  -o, --output <path>  Output dataset path (default: "data/dataset.json")
  -h, --help           Display help
```

Interactive workflow:
1. Connects to your MCP server
2. Lists available tools
3. Lets you call tools with custom arguments
4. Shows response preview
5. **Auto-suggests expectations** based on response format
6. Generates test cases
7. Saves to JSON dataset

Features:
- ✅ Appends to existing datasets
- ✅ Smart expectation suggestions (text contains, regex)
- ✅ Response preview
- ✅ Validation

## Examples

### Testing Markdown Responses

Many MCP servers return markdown-formatted responses for better LLM readability. Here's a complete example:

```typescript
// Your MCP server returns markdown
const response = `## City Information

**City:** London
**Population:** 8.9M

### Features
- Public Transportation
- Cultural Attractions

Temperature: 15°C
Last updated: 2025-01-22`;

// Validate with text contains
{
  "id": "city-info-text",
  "toolName": "get_city_info",
  "args": { "city": "London" },
  "expectedTextContains": [
    "## City Information",
    "**City:** London",
    "### Features"
  ]
}

// Validate with regex patterns
{
  "id": "city-info-format",
  "toolName": "get_city_info",
  "args": { "city": "London" },
  "expectedRegex": [
    "^## City Information",      // Starts with heading
    "\\*\\*City:\\*\\* \\w+",    // Has city field
    "\\*\\*Population:\\*\\* [\\d.]+M",  // Population in millions
    "Temperature: \\d+°C",       // Temperature format
    "\\d{4}-\\d{2}-\\d{2}"      // Date format
  ]
}

// In your test
const result = await runEvalDataset(
  {
    dataset,
    expectations: {
      textContains: createTextContainsExpectation(),
      regex: createRegexExpectation(),
    },
  },
  { mcp }
);
```

### More Examples

See the `examples/` directory for complete examples:

- `basic-playwright-usage/` - Simple Playwright test examples
- `basic-vitest-usage/` - Vitest integration examples

See `data/eval_dataset.json` for examples of all expectation types.

## Development

### Running Tests

This package includes a comprehensive test suite:

**Unit Tests** (Vitest - 104 tests)

```bash
npm test              # Run unit tests
npm run test:watch    # Run in watch mode
```

Tests cover:

- Configuration validation (18 tests)
- Dataset types and loading (24 tests)
- Expectations (exact, schema, textContains, regex) (62 tests)

**Integration Tests** (Playwright - 5 tests)

```bash
npm run test:playwright
```

Integration tests use a mock MCP server and cover:

- MCP server connection and info
- Tool listing and conformance checks
- Eval dataset execution
- Error handling

### Building

```bash
# Build library (ESM + CJS + .d.ts)
npm run build

# Build in watch mode
npm run dev

# Type check
npm run typecheck
```

### Code Quality

```bash
# Lint
npm run lint
npm run lint:fix

# Format
npm run format
npm run format:check
```

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

## Credits

Built with:

- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)
- [@playwright/test](https://playwright.dev)
- [Zod](https://zod.dev)
