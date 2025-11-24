# MCP Eval Examples

This directory contains complete working examples demonstrating how to use `playwright-mcp-server-test` for testing real MCP servers.

## Available Examples

### 🗂️ filesystem-server

Test suite for the official Anthropic Filesystem MCP Server (`@modelcontextprotocol/server-filesystem`).

**Features:**
- Creates isolated test fixtures with `fixturify-project`
- Tests file operations (read, list, directory tree)
- Demonstrates Zod schema validation for JSON files
- 5 Playwright tests, 11 eval dataset cases (6 direct, 5 LLM)

**Location:** `examples/filesystem-server/`

### 🗄️ sqlite-server

Test suite for the official Anthropic SQLite MCP Server (`mcp-server-sqlite-npx`).

**Features:**
- Creates temporary databases with `better-sqlite3`
- Seeds test data (users and posts tables)
- Tests SQL queries, JOINs, aggregations, and schema operations
- Custom expectations for record count validation
- 11 Playwright tests, 14 eval dataset cases (8 direct, 6 LLM)

**Location:** `examples/sqlite-server/`

## Evaluation Modes

### Direct Mode (Default)

Direct mode makes specific API calls to MCP tools with known inputs. This is useful for:

- Testing tool implementation correctness
- Validating response formats and schemas
- Fast, deterministic testing without LLM costs

```json
{
  "id": "direct-weather-test",
  "mode": "direct",
  "toolName": "get_weather",
  "args": {
    "city": "London"
  },
  "expectedTextContains": ["London", "temperature"]
}
```

### LLM Host Mode

LLM host mode uses actual LLM providers (OpenAI or Anthropic) to test MCP servers through natural language scenarios. This is useful for:

- Testing tool discoverability (can the LLM find the right tool?)
- Validating tool descriptions (are they clear enough?)
- Testing parameter extraction from natural language
- End-to-end realistic usage testing

```json
{
  "id": "llm-weather-test",
  "mode": "llm_host",
  "toolName": "placeholder",
  "args": {},
  "scenario": "What's the weather in Paris?",
  "llmHostConfig": {
    "provider": "openai",
    "model": "gpt-4",
    "temperature": 0.0
  },
  "metadata": {
    "expectedToolCalls": [
      {
        "name": "get_weather",
        "arguments": {
          "city": "Paris"
        },
        "required": true
      }
    ]
  }
}
```

## Quick Start

Navigate to an example directory and run the tests:

```bash
cd examples/filesystem-server
npm install
npm test
```

or

```bash
cd examples/sqlite-server
npm install
npm test
```

### Test Scripts

Each example includes the following npm scripts:

- `npm test` - Run all tests in headless mode
- `npm run test:ui` - Launch Playwright's interactive UI mode
- `npm run test:debug` - Run tests with debugging enabled
- `npx playwright show-report` - View the HTML report from the last test run

### UI Reporter

Playwright provides a rich UI for running and debugging tests:

```bash
npm run test:ui
```

This opens an interactive interface where you can:
- See all test cases and their status
- Run individual tests or test suites
- Watch tests execute in real-time
- Inspect test results and errors
- View traces and screenshots

After running tests, view the HTML report:

```bash
npx playwright show-report
```

### LLM Host Mode Requirements

For LLM host mode tests, install the required SDKs and set API keys:

```bash
# OpenAI (required for OpenAI provider tests)
npm install openai @openai/agents
export OPENAI_API_KEY="your-key-here"

# Anthropic (required for Anthropic provider tests)
npm install @anthropic-ai/sdk
export ANTHROPIC_API_KEY="your-key-here"
```

You only need to install the providers you plan to use. **All direct mode tests work without any LLM dependencies.**

## Example Structure

Each example follows a consistent structure:

```
examples/[example-name]/
├── tests/
│   └── [example]-eval.spec.ts    # Playwright test file
├── schemas/
│   └── [schemas].ts               # Zod validation schemas
├── eval-dataset.json              # Eval test cases
├── package.json                   # Dependencies and scripts
├── playwright.config.ts           # Playwright configuration
└── README.md                      # Example-specific documentation
```

### filesystem-server Dataset

Demonstrates filesystem operations:

- **Direct mode**: Read files, list directories, get directory tree
- **LLM host mode**: Natural language file discovery and content extraction
- **Schema validation**: JSON file content validation with Zod
- **Error handling**: Non-existent file and directory tests

### sqlite-server Dataset

Demonstrates database operations:

- **Direct mode**: SQL queries, JOINs, aggregations, schema introspection
- **LLM host mode**: Natural language database querying
- **Custom expectations**: Record count validation
- **Complex scenarios**: Multi-table queries with sorting and grouping

## Test Patterns

Both examples demonstrate key testing patterns:

### Fixture Management with fixturify-project

```typescript
fileProject: async ({}, use) => {
  const project = new Project('test-name', '1.0.0', {
    files: {
      'readme.txt': 'Hello World',
      'data.json': JSON.stringify({ key: 'value' })
    }
  });

  await project.write();  // Create files on disk
  await use(project);
  project.dispose();      // Cleanup
}
```

### Database Setup with better-sqlite3

```typescript
dbProject: async ({}, use) => {
  const project = new Project('db-test', '1.0.0');
  await project.write();

  const db = new Database(path.join(project.baseDir, 'app.db'));
  db.exec(`CREATE TABLE users (...)`);
  db.close();

  await use(project);
  project.dispose();
}
```

### Custom Expectations

```typescript
const result = await runEvalDataset(
  {
    dataset,
    expectations: {
      textContains: createTextContainsExpectation(),
      toolCalls: createToolCallExpectation(),

      // Custom expectation
      recordCount: async (context, evalCase, response) => {
        if (evalCase.metadata?.expectedRecordCount !== undefined) {
          return validateRecordCount(response, evalCase.metadata.expectedRecordCount);
        }
        return { pass: true, details: 'N/A' };
      },
    },
  },
  { mcp }
);
```

### Response Extraction Utilities

```typescript
export function extractQueryData(response: unknown): any[] {
  // Handle both full MCP response and content array
  let contentArray: Array<{ type: string; text: string }>;

  if (Array.isArray(response)) {
    contentArray = response;
  } else {
    const validated = QueryResultSchema.parse(response);
    contentArray = validated.content;
  }

  const textContent = contentArray[0]?.text;
  return JSON.parse(textContent);
}
```

## Best Practices

1. **Start with direct mode** to validate basic functionality
2. **Use LLM host mode** to test discoverability and real-world usage
3. **Set temperature to 0.0** for deterministic LLM behavior in tests
4. **Use `expectedToolCalls`** to validate which tools the LLM chose
5. **Combine multiple validation strategies** (text contains, regex, schema, tool calls)

## Cost Considerations

LLM host mode incurs API costs:

- OpenAI GPT-4: ~$0.03 per 1K input tokens, ~$0.06 per 1K output tokens
- Anthropic Claude 3.5 Sonnet: ~$0.003 per 1K input tokens, ~$0.015 per 1K output tokens

For cost-effective testing:
- Use direct mode for most tests
- Reserve LLM host mode for critical user journeys
- Consider using cheaper models for development (gpt-3.5-turbo, claude-3-haiku)

## Troubleshooting

### "OpenAI SDK is not installed"

Install the required dependencies:
```bash
npm install openai @openai/agents
```

### "API key not found"

Set the appropriate environment variable:
```bash
export OPENAI_API_KEY="your-key-here"
# or
export ANTHROPIC_API_KEY="your-key-here"
```

### Tests timing out

Increase the test timeout for LLM host mode tests:
```typescript
test.setTimeout(60000); // 60 seconds
```

## Contributing

Have an interesting eval dataset example? PRs welcome!
