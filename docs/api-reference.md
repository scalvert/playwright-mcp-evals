# API Reference

Complete API documentation for `@mcp-testing/server-tester`.

## Table of Contents

- [Fixtures](#fixtures)
- [Eval Functions](#eval-functions)
- [Expectation Functions](#expectation-functions)
- [Text Utilities](#text-utilities)
- [Judge Functions](#judge-functions)
- [Conformance Functions](#conformance-functions)

## Fixtures

### `mcpClient: Client`

Raw MCP SDK client from `@modelcontextprotocol/sdk`.

```typescript
test('use raw client', async ({ mcpClient }) => {
  const tools = await mcpClient.listTools();
  const result = await mcpClient.callTool({ name: 'tool_name', arguments: { ... } });
});
```

### `mcp: MCPFixtureApi`

High-level test API with helper methods.

```typescript
interface MCPFixtureApi {
  client: Client;
  listTools(): Promise<Array<Tool>>;
  callTool<TArgs>(name: string, args: TArgs): Promise<CallToolResult>;
  getServerInfo(): { name?: string; version?: string } | null;
}
```

#### Methods

##### `listTools()`

List all tools available from the MCP server.

**Returns:** `Promise<Array<Tool>>`

```typescript
const tools = await mcp.listTools();
console.log(tools.map(t => t.name));
```

##### `callTool<TArgs>(name, args)`

Call a tool by name with arguments.

**Parameters:**
- `name: string` - Tool name
- `args: TArgs` - Tool arguments

**Returns:** `Promise<CallToolResult>`

```typescript
const result = await mcp.callTool('get_weather', { city: 'London' });
```

##### `getServerInfo()`

Get server information (name, version).

**Returns:** `{ name?: string; version?: string } | null`

```typescript
const info = mcp.getServerInfo();
console.log(info?.name, info?.version);
```

## Eval Functions

### `loadEvalDataset(path, options?)`

Load an eval dataset from a JSON file.

**Parameters:**
- `path: string` - Path to dataset JSON file
- `options?: object`
  - `schemas?: Record<string, ZodSchema>` - Zod schemas for validation

**Returns:** `Promise<EvalDataset>`

```typescript
const dataset = await loadEvalDataset('./data/evals.json', {
  schemas: {
    'weather-response': z.object({
      city: z.string(),
      temperature: z.number(),
    }),
  },
});
```

### `runEvalDataset(options, context)`

Run an eval dataset with expectations.

**Parameters:**
- `options: object`
  - `dataset: EvalDataset` - Dataset to run
  - `expectations: Record<string, EvalExpectation>` - Expectations to apply
  - `judgeClient?: LLMJudgeClient` - Optional LLM judge client
- `context: object`
  - `mcp: MCPFixtureApi` - MCP fixture API

**Returns:** `Promise<EvalResult>`

```typescript
const result = await runEvalDataset(
  {
    dataset,
    expectations: {
      schema: createSchemaExpectation(dataset),
      exact: createExactExpectation(),
    },
    judgeClient,
  },
  { mcp }
);

console.log(`Passed: ${result.passed}/${result.total}`);
```

**Result Structure:**

```typescript
interface EvalResult {
  total: number;
  passed: number;
  failed: number;
  results: Array<{
    caseId: string;
    passed: boolean;
    expectations: Record<string, { pass: boolean; details: string }>;
  }>;
}
```

## Expectation Functions

### `createExactExpectation()`

Create exact match expectation for structured JSON data.

**Returns:** `EvalExpectation`

```typescript
const expectations = {
  exact: createExactExpectation(),
};
```

### `createTextContainsExpectation(options?)`

Create text contains expectation for substring matching.

**Parameters:**
- `options?: object`
  - `caseSensitive?: boolean` - Case-sensitive matching (default: `true`)

**Returns:** `EvalExpectation`

```typescript
const expectations = {
  textContains: createTextContainsExpectation(),
  // Case-insensitive
  textContainsCI: createTextContainsExpectation({ caseSensitive: false }),
};
```

### `createRegexExpectation()`

Create regex pattern expectation for format validation.

**Returns:** `EvalExpectation`

```typescript
const expectations = {
  regex: createRegexExpectation(),
};
```

### `createSchemaExpectation(dataset)`

Create schema validation expectation using Zod schemas.

**Parameters:**
- `dataset: EvalDataset` - Dataset with schemas attached

**Returns:** `EvalExpectation`

```typescript
const dataset = await loadEvalDataset('./evals.json', {
  schemas: { 'user': UserSchema },
});

const expectations = {
  schema: createSchemaExpectation(dataset),
};
```

### `createJudgeExpectation(configs)`

Create LLM-as-a-judge expectation for semantic evaluation.

**Parameters:**
- `configs: Record<string, JudgeConfig>` - Judge configurations by ID
  - `rubric: string` - Evaluation criteria
  - `passingThreshold: number` - Minimum score (0-1) to pass

**Returns:** `EvalExpectation`

```typescript
const expectations = {
  judge: createJudgeExpectation({
    'search-relevance': {
      rubric: 'Evaluate if search results are relevant to the query. Score 0-1.',
      passingThreshold: 0.7,
    },
  }),
};
```

## Text Utilities

### `extractTextFromResponse(response)`

Extract text content from various MCP response formats.

**Parameters:**
- `response: CallToolResult` - MCP tool call result

**Returns:** `string`

```typescript
const result = await mcp.callTool('get_info', {});
const text = extractTextFromResponse(result);
```

### `normalizeWhitespace(text)`

Normalize whitespace for consistent comparison.

**Parameters:**
- `text: string` - Text to normalize

**Returns:** `string`

```typescript
const normalized = normalizeWhitespace('  hello\n\n  world  ');
// Returns: "hello world"
```

### `findMissingSubstrings(text, substrings, caseSensitive?)`

Check which expected substrings are missing from text.

**Parameters:**
- `text: string` - Text to search
- `substrings: string[]` - Expected substrings
- `caseSensitive?: boolean` - Case-sensitive search (default: `true`)

**Returns:** `string[]` - Missing substrings

```typescript
const missing = findMissingSubstrings(
  'Hello world',
  ['Hello', 'World', 'foo'],
  false
);
// Returns: ['foo']
```

### `findFailedPatterns(text, patterns)`

Check which regex patterns failed to match.

**Parameters:**
- `text: string` - Text to test
- `patterns: string[]` - Regex patterns

**Returns:** `string[]` - Failed patterns

```typescript
const failed = findFailedPatterns(
  'Temperature: 20°C',
  ['Temperature: \\d+°C', 'Humidity: \\d+%']
);
// Returns: ['Humidity: \\d+%']
```

## Judge Functions

### `createLLMJudgeClient(config)`

Create an LLM judge client for semantic evaluation.

**Parameters:**
- `config: object`
  - `provider: 'openai' | 'anthropic' | 'custom-http'` - LLM provider
  - `model: string` - Model name
  - `temperature: number` - Temperature (0.0-1.0)
  - For `custom-http`: additional HTTP config

**Returns:** `LLMJudgeClient`

**OpenAI:**

```typescript
const judgeClient = createLLMJudgeClient({
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.0,
});
// Requires: OPENAI_API_KEY environment variable
```

**Anthropic:**

```typescript
const judgeClient = createLLMJudgeClient({
  provider: 'anthropic',
  model: 'claude-3-opus-20240229',
  temperature: 0.0,
});
// Requires: ANTHROPIC_API_KEY environment variable
```

## Conformance Functions

### `runConformanceChecks(mcp, options?)`

Run MCP protocol conformance checks.

**Parameters:**
- `mcp: MCPFixtureApi` - MCP fixture API
- `options?: object`
  - `requiredTools?: string[]` - Tools that must be present
  - `validateSchemas?: boolean` - Validate tool input schemas (default: `false`)

**Returns:** `Promise<ConformanceResult>`

```typescript
const result = await runConformanceChecks(mcp, {
  requiredTools: ['get_weather', 'search_docs'],
  validateSchemas: true,
});

expect(result.pass).toBe(true);
```

**Result Structure:**

```typescript
interface ConformanceResult {
  pass: boolean;
  checks: Array<{
    name: string;
    pass: boolean;
    message: string;
  }>;
}
```

### `formatConformanceResult(result)`

Format conformance check results for display.

**Parameters:**
- `result: ConformanceResult` - Conformance check result

**Returns:** `string`

```typescript
const formatted = formatConformanceResult(result);
console.log(formatted);
```

## Type Definitions

### `EvalCase`

```typescript
interface EvalCase {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  expectedExact?: unknown;
  expectedSchemaName?: string;
  expectedTextContains?: string[];
  expectedRegex?: string[];
  judgeConfigId?: string;
}
```

### `EvalDataset`

```typescript
interface EvalDataset {
  name: string;
  cases: EvalCase[];
  schemas?: Record<string, ZodSchema>;
}
```

### `EvalExpectation`

```typescript
type EvalExpectation = (
  context: { mcp: MCPFixtureApi },
  evalCase: EvalCase,
  response: CallToolResult
) => Promise<{ pass: boolean; details: string }>;
```

## Next Steps

- See the [Expectations Guide](./expectations.md) for detailed expectation usage
- Check out the [Quick Start Guide](./quickstart.md) for getting started
- Explore [Examples](../examples) for real-world usage patterns
