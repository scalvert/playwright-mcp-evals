# Basic Playwright Usage Example

This example demonstrates how to use `@mcp-testing/server-tester` in Playwright tests.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure your MCP server in `playwright.config.ts`

3. Run tests:

```bash
npx playwright test
```

## Example Test

```typescript
import { test, expect } from '@mcp-testing/server-tester/fixtures/mcp';

test('basic MCP test', async ({ mcp }) => {
  // List available tools
  const tools = await mcp.listTools();
  expect(tools.length).toBeGreaterThan(0);

  // Call a tool
  const result = await mcp.callTool('your_tool_name', {
    arg1: 'value1',
  });

  expect(result).toBeTruthy();
});
```

## Configuration

In `playwright.config.ts`:

```typescript
export default defineConfig({
  projects: [
    {
      name: 'my-mcp-server',
      use: {
        mcpConfig: {
          transport: 'stdio',
          command: 'node',
          args: ['path/to/server.js'],
        },
      },
    },
  ],
});
```
