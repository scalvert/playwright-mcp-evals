# Glean MCP Server Example

This example demonstrates testing a production HTTP MCP server (Glean) using `@mcp-testing/server-tester`.

## What This Example Demonstrates

- ✅ Testing a **production HTTP MCP server** (not local/stdio)
- ✅ Using **real production data** from Glean
- ✅ All **three testing modes**: direct tests, eval datasets, and LLM host mode
- ✅ **HTTP transport configuration** with authentication
- ✅ **Text-based validation** for markdown responses (no Zod schemas needed)
- ✅ Testing multiple Glean tools: search, code search, employee search, meetings, email, and AI chat

## Prerequisites

Before running these tests, you need:

1. **Glean account** with MCP server access
2. **API credentials** (server URL and auth token)
3. **Node.js 18+** installed
4. **Optional**: OpenAI and/or Anthropic API keys (for LLM host mode tests)

## Installation

```bash
npm install
```

This installs:
- `@mcp-testing/server-tester` - Evaluation framework (includes Playwright)
- `dotenv` - Environment variable management
- `typescript` - TypeScript support

## Configuration

### 1. Create `.env` file

Copy the example environment file and fill in your credentials:

```bash
cp .env.example .env
```

### 2. Set required environment variables

Edit `.env` and add:

```bash
# Required
GLEAN_MCP_SERVER_URL=https://your-company.glean.com/mcp
GLEAN_API_TOKEN=your-api-token-here

# Optional (for LLM host mode tests)
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
```

### 3. Get Glean credentials

- **Server URL**: Contact your Glean admin or check Glean documentation
- **API Token**: Generate from your Glean admin console

## Running Tests

### Run all tests

```bash
npm test
```

### Run with UI mode

```bash
npm run test:ui
```

### Run in debug mode

```bash
npm run test:debug
```

### Enable debug logging

For detailed MCP protocol logging:

```bash
DEBUG=true npm test
```

## Test Structure

The test suite follows a layered approach:

### 1. MCP Protocol Conformance (6 baseline tests)

**These tests should be standard for ALL MCP servers** - they validate basic protocol compliance:

- ✅ Server info validation
- ✅ Tools list validation
- ✅ Invalid tool error handling
- ✅ Empty args handling
- ✅ Resources support (if available)
- ✅ Prompts support (if available)

```typescript
test('should return valid server info', async ({ mcp }) => {
  const info = mcp.getServerInfo();
  expect(info).toBeTruthy();
  expect(info?.name).toBeTruthy();
  expect(info?.version).toBeTruthy();
});
```

### 2. Direct Tool Tests (8 Glean-specific tests)

Domain-specific functionality tests for Glean's tools:

```typescript
test('should search for documents', async ({ mcp }) => {
  const result = await mcp.callTool('mcp__glean_default__search', {
    query: 'API documentation',
  });
  expect(result.isError).toBeFalsy();

  // Glean returns markdown - use text extraction
  const text = extractTextFromResponse(result);
  expect(text).toContain('API');
});
```

**Glean tools tested:**
- `search` - Document search
- `code_search` - Code repository search
- `employee_search` - People directory
- `meeting_lookup` - Calendar/meetings
- `gmail_search` - Email search
- `chat` - AI synthesis

### 3. Advanced Features (5 tests)

Tests demonstrating advanced testing patterns:
- Text extraction and validation
- Date filtering
- Pagination (num_results)
- Meeting search
- AI chat synthesis

### 4. Glean Tool Availability (2 tests)

Glean-specific conformance checks:
- Verify all 7 expected Glean tools are present
- Run conformance suite with Glean requirements

### 5. Eval Dataset (16 cases)

JSON-based test cases with expectations validation:

```json
{
  "id": "search-api-docs",
  "mode": "direct",
  "toolName": "search",
  "args": { "query": "API documentation" },
  "expectedTextContains": ["API"]
}
```

**See** `eval-dataset.json` for all test cases.

### 6. LLM Host Mode (4 cases)

Natural language scenarios using AI agents:

```json
{
  "id": "llm-find-documentation",
  "mode": "llm_host",
  "scenario": "Find documentation about authentication",
  "llmHostConfig": {
    "provider": "openai",
    "model": "gpt-4",
    "temperature": 0.0
  },
  "metadata": {
    "expectedToolCalls": [{ "name": "search", "required": true }]
  }
}
```

**Note**: Requires `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`.

## Response Validation

Glean MCP server returns **structured markdown** responses, not JSON. Use text-based validation:

### Text Extraction

```typescript
import { extractTextFromResponse } from '@mcp-testing/server-tester';

const result = await mcp.callTool('search', {
  query: 'API documentation'
});

const text = extractTextFromResponse(result);
expect(text).toContain('API');
expect(text.length).toBeGreaterThan(0);
```

### Text Expectations in Eval Datasets

```json
{
  "id": "search-api-docs",
  "expectedTextContains": ["API", "documentation"],
  "expectedRegex": "API.*documentation"
}
```

## Test Results

After running tests, view the interactive UI report:

```bash
# Report auto-opens at:
.mcp-test-results/latest/index.html
```

The UI shows:
- 📊 Test pass/fail rates
- 🔍 Detailed tool call logs
- ✅ Expectation validation results
- ⏱️ Performance metrics

## Expected Results

### MCP Protocol Conformance
- **Expected**: 100% pass rate
- Standard baseline tests that all MCP servers should pass
- Validates basic protocol compliance

### Direct Mode Tests
- **Expected**: 100% pass rate for Glean-specific tests
- Tests are deterministic and should always pass with valid credentials

### Eval Dataset
- **Expected**: 75-100% pass rate
- Direct mode cases: 100%
- LLM host mode cases: Variable (requires API keys)

### LLM Host Mode
- **Expected**: Variable pass rate
- Non-deterministic due to AI variability
- Requires `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`

## Troubleshooting

### Connection Errors

```
Error: Failed to connect to MCP server
```

**Solutions:**
- Verify `GLEAN_MCP_SERVER_URL` is correct
- Check network connectivity
- Ensure firewall allows outbound HTTPS

### Authentication Errors

```
Error: 401 Unauthorized
```

**Solutions:**
- Verify `GLEAN_API_TOKEN` is valid
- Check token hasn't expired
- Ensure token has required permissions

### No Results Found

Some searches may return no results depending on your Glean data:

```typescript
// This is okay - not an error
expect(result.isError).toBeFalsy();
```

### LLM Tests Failing

```
Error: OpenAI Agents SDK is not installed
```

**Solution:**
```bash
npm install @openai/agents openai @anthropic-ai/sdk
```

## Customizing Tests

### Add New Test Cases

Edit `eval-dataset.json`:

```json
{
  "id": "my-custom-test",
  "mode": "direct",
  "toolName": "search",
  "args": { "query": "my specific query" },
  "expectedTextContains": ["expected term"]
}
```

### Add Custom Text Validation

Use regex patterns for complex validation:

```json
{
  "id": "my-custom-test",
  "mode": "direct",
  "toolName": "search",
  "args": { "query": "my specific query" },
  "expectedTextContains": ["expected term"],
  "expectedRegex": "pattern.*match"
}
```

## Learn More

- [Glean MCP Server Documentation](https://docs.glean.com/mcp)
- [@mcp-testing/server-tester Documentation](../../README.md)
- [Playwright Test](https://playwright.dev/docs/test-intro)

## Project Structure

```
glean-server/
├── tests/
│   └── glean-eval.spec.ts     # Main test file (200+ lines)
├── eval-dataset.json          # 16 test cases
├── package.json               # Dependencies
├── playwright.config.ts       # HTTP transport config
├── .env.example              # Environment template
└── README.md                  # This file
```

## Key Differences from Other Examples

### vs. filesystem-server
- **Transport**: HTTP instead of stdio
- **Data**: Production Glean data instead of fixtures
- **Tools**: Cloud service instead of local filesystem
- **Validation**: Text-based (markdown) instead of JSON schema

### vs. sqlite-server
- **Transport**: HTTP instead of stdio
- **Data**: Real-time search instead of static database
- **Validation**: Text-based (markdown) instead of strict JSON schema

## Best Practices

1. **Use production data carefully** - Be mindful of sensitive information
2. **Set reasonable expectations** - Search results may vary
3. **Handle rate limits** - Add delays if needed
4. **Test incrementally** - Start with direct mode, add evals later
5. **Monitor costs** - LLM tests consume API credits

## Contributing

Found an issue or want to improve this example? See [CONTRIBUTING.md](../../CONTRIBUTING.md).

## License

MIT
