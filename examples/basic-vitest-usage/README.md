# Basic Vitest Usage Example

This example demonstrates how to use `@mcp-testing/server-tester` programmatically with Vitest for unit testing eval components.

## Setup

```bash
npm install
```

## Example Test

```typescript
import { describe, it, expect } from 'vitest';
import {
  createMCPClientForConfig,
  createMCPFixture,
  loadEvalDataset,
  runEvalDataset,
  createExactExpectation,
} from '@mcp-testing/server-tester';

describe('MCP Eval Tests', () => {
  it('should run evals programmatically', async () => {
    // Create client
    const client = await createMCPClientForConfig({
      transport: 'stdio',
      command: 'node',
      args: ['path/to/server.js'],
    });

    // Load dataset
    const dataset = await loadEvalDataset('./evals.json');

    // Run evals
    const result = await runEvalDataset(
      {
        dataset,
        expectations: {
          exact: createExactExpectation(),
        },
      },
      { mcp: createMCPFixture(client) }
    );

    expect(result.passed).toBe(result.total);

    await client.close();
  });
});
```

## Use Cases

- Unit testing eval expectations
- Testing dataset loaders
- Programmatic eval execution
- CI/CD integration without Playwright
