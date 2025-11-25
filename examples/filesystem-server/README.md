# Filesystem MCP Server Example

This example demonstrates testing the official [Filesystem MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem) from Anthropic using `@mcp-testing/server-tester`.

## What This Example Demonstrates

- ✅ Testing a real, official MCP server (not a mock)
- ✅ Using `fixturify-project` for isolated test fixtures
- ✅ Both **direct mode** (specific tool calls) and **LLM host mode** (natural language)
- ✅ File system operations: read, write, list, search
- ✅ Schema validation with Zod
- ✅ Text and regex pattern matching
- ✅ Automatic test fixture cleanup

## Prerequisites

- Node.js 18+
- npm or pnpm

## Installation

```bash
npm install
```

This will install:
- `@playwright/test` - Test framework
- `@mcp-testing/server-tester` - Evaluation framework
- `@modelcontextprotocol/server-filesystem` - Official MCP server
- `fixturify-project` - Test fixture management
- `zod` - Schema validation

## Running Tests

### Run all tests (direct mode only)
```bash
npm test
```

### Run with LLM host mode tests (requires API keys)
```bash
# OpenAI
OPENAI_API_KEY=your-key-here npm test

# Anthropic
ANTHROPIC_API_KEY=your-key-here npm test

# Both
OPENAI_API_KEY=key1 ANTHROPIC_API_KEY=key2 npm test
```

### Run in UI mode
```bash
npm run test:ui
```

### Debug mode
```bash
npm run test:debug
```

## How It Works

### Test Fixture Setup

The test uses `fixturify-project` to create a temporary directory with test files:

```typescript
import { Project } from 'fixturify-project';

const project = new Project('fs-test', '1.0.0', {
  files: {
    'readme.txt': 'Hello World',
    'config.json': JSON.stringify({ version: '1.0.0' }),
    'docs': {
      'guide.md': '# User Guide\n\nContent',
      'api.md': '# API Reference'
    }
  }
});

// Write files to disk
await project.write();

// project.baseDir contains the absolute path to the temp directory
```

### MCP Server Configuration

The Filesystem MCP server is configured to operate on the temporary directory:

```typescript
test.use({
  mcpConfig: ({ projectPath }) => ({
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', projectPath]
  })
});
```

### Automatic Cleanup

Fixtures handle cleanup automatically - no temp files left behind:

```typescript
test.extend({
  fileProject: async ({}, use) => {
    const project = new Project('fs-test', '1.0.0', {
      files: { /* your files */ }
    });
    await project.write();
    await use(project);
    project.dispose(); // Automatic cleanup after test
  }
});
```

## Test Cases

### Direct Mode Tests

Direct API calls to specific tools:

```json
{
  "id": "read-readme",
  "mode": "direct",
  "toolName": "read_file",
  "args": { "path": "readme.txt" },
  "expectedTextContains": "Hello World"
}
```

### LLM Host Mode Tests

Natural language scenarios where the LLM chooses which tool to use:

```json
{
  "id": "llm-list-docs",
  "mode": "llm_host",
  "scenario": "What files are in the docs directory?",
  "llmHostConfig": {
    "provider": "openai",
    "model": "gpt-4"
  },
  "metadata": {
    "expectedToolCalls": [
      {
        "name": "list_directory",
        "arguments": { "path": "docs" }
      }
    ]
  }
}
```

## Available MCP Tools

The Filesystem server provides these tools:

- `read_file` - Read file contents
- `write_file` - Write content to a file
- `list_directory` - List directory contents
- `search_files` - Search for files by pattern
- `get_file_info` - Get file metadata
- `create_directory` - Create a directory
- `move_file` - Move/rename files

## File Structure

```
filesystem-server/
├── README.md           # This file
├── package.json        # Dependencies and scripts
├── playwright.config.ts # Playwright configuration
├── eval-dataset.json   # Test cases (direct + LLM host)
├── schemas/
│   └── fileContentSchema.ts # Zod schemas for validation
└── tests/
    └── filesystem-eval.spec.ts # Test implementation
```

## Learn More

- [MCP Filesystem Server](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem)
- [@mcp-testing/server-tester Documentation](../../README.md)
- [fixturify-project](https://www.npmjs.com/package/fixturify-project)
- [Playwright Test](https://playwright.dev/docs/test-intro)

## Troubleshooting

### "Server not found" error

Make sure dependencies are installed:
```bash
npm install
```

### LLM tests skipped

LLM host mode tests require API keys. Set the appropriate environment variable:
```bash
export OPENAI_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
```

### Temp directory not cleaned up

This shouldn't happen with `fixturify-project`, but if it does, manually clean:
```bash
# macOS/Linux
rm -rf /tmp/fs-test-*
```

## Cost Considerations

- **Direct mode**: Free, no API costs
- **LLM host mode**: Incurs API costs per test run
  - OpenAI GPT-4: ~$0.03 per 1K tokens
  - Anthropic Claude: ~$0.003 per 1K tokens

For cost-effective testing, use direct mode for most tests and LLM host mode for critical user journeys only.
