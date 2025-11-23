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

### 1. Configure Playwright

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

### 3. Run Data-Driven Evals

Create an eval dataset (`data/evals.json`):

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

### Exact Match

Validates exact equality:

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
- `createExactExpectation()` - Create exact match expectation
- `createSchemaExpectation(dataset)` - Create schema validation expectation
- `createJudgeExpectation(configs)` - Create LLM judge expectation

### Judge Functions

- `createLLMJudgeClient(config)` - Create LLM judge client
- Providers: `openai`, `anthropic`, `custom-http`

### Conformance

- `runConformanceChecks(mcp, options)` - Run protocol conformance checks
- `formatConformanceResult(result)` - Format check results

## Examples

See the `examples/` directory for complete examples:

- `basic-playwright-usage/` - Simple Playwright test examples
- `basic-vitest-usage/` - Vitest integration examples

## Development

### Running Tests

This package includes a comprehensive test suite:

**Unit Tests** (Vitest - 64 tests)
```bash
npm test              # Run unit tests
npm run test:watch    # Run in watch mode
```

Tests cover:
- Configuration validation (18 tests)
- Dataset types and loading (24 tests)
- Expectations (exact, schema) (22 tests)

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

## Architecture

Built on official MCP SDK types:

- Uses `@modelcontextprotocol/sdk` for all MCP interactions
- No shadow types - direct SDK type usage
- Idiomatic Playwright patterns (`test.extend`, project config)
- Zod for runtime validation

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

## Credits

Built with:

- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk)
- [@playwright/test](https://playwright.dev)
- [Zod](https://zod.dev)
