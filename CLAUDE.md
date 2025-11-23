# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`playwright-mcp-evals` is a Playwright-based testing and evaluation framework for MCP (Model Context Protocol) servers. It provides:

- **Playwright fixtures** for MCP client integration
- **Data-driven eval harness** with JSON datasets
- **LLM-as-a-judge** semantic evaluation (OpenAI, Anthropic)
- **Protocol conformance checks** for MCP spec compliance

## Core Architecture

### MCP SDK Integration Pattern

**Critical**: This library uses types directly from `@modelcontextprotocol/sdk` - **never redefine SDK types**.

- Import `Client`, `Tool`, `CallToolResult`, etc. from the SDK
- Only define custom types for library-specific abstractions (config, evals, judge)
- The `MCPConfig` type is our thin wrapper over SDK transports

### Playwright Fixture Pattern

The library follows **idiomatic Playwright patterns**:

```typescript
// playwright.config.ts: Custom config via project.use
projects: [{
  use: {
    mcpConfig: {  // Custom field
      transport: 'stdio',
      command: 'node',
      args: ['server.js']
    }
  }
}]

// Fixtures read config via testInfo.project.use
mcpClient: async ({}, use, testInfo) => {
  const config = testInfo.project.use.mcpConfig;
  const client = await createMCPClientForConfig(config);
  await use(client);
  await client.close();
}
```

### Eval Pipeline Architecture

```
loadEvalDataset()
  → runEvalDataset()
    → for each case:
        → mcp.callTool()
        → apply expectations (exact, schema, judge)
        → collect results
```

**Key types**:
- `EvalCase`: Single test case (toolName, args, expected values)
- `EvalDataset`: Collection of cases + optional Zod schemas
- `EvalExpectation`: `(context, case, response) => Promise<{pass, details}>`

### Transport Abstraction

`createMCPClientForConfig()` handles both:
- **stdio**: `StdioClientTransport` (local servers via child process)
- **HTTP**: `StreamableHTTPClientTransport` (remote servers)

Config is validated with Zod discriminated unions based on `transport` field.

## Development Commands

### Testing

```bash
# Unit tests (64 tests with Vitest)
npm test
npm run test:watch

# Integration tests (5 tests with Playwright + mock MCP server)
npm run test:playwright

# All tests
npm test && npm run test:playwright
```

**Mock MCP Server**: `tests/mocks/simpleMCPServer.ts` provides test tools (`echo`, `calculate`, `get_weather`). Requires Zod schemas for MCP SDK compatibility.

### Building

```bash
npm run build        # ESM + CJS + .d.ts
npm run dev          # Watch mode
npm run typecheck    # TypeScript validation
```

### Code Quality

```bash
npm run lint         # ESLint
npm run lint:fix     # Auto-fix
npm run format       # Prettier
npm run format:check # Check only
```

## Code Style Conventions

These are **enforced** in this codebase:

1. **Function declarations** over expressions:
   ```typescript
   export function createClient() { }  // ✓
   export const createClient = () => { }  // ✗
   ```

2. **Explicit null** over short-circuit:
   ```typescript
   condition ? 'value' : null  // ✓
   condition && 'value'        // ✗
   ```

3. **Descriptive type names**: `EvalDataset`, `MCPFixtureApi`, `LLMJudgeClient`

4. **TypeScript strict mode**: No `any`, prefer type safety

5. **Async function style**: Keep `async` keyword even if no `await` (for expectation consistency)

## Important Implementation Details

### MCP Error Handling

The MCP SDK **returns errors** instead of throwing:

```typescript
const result = await mcp.callTool('invalid', {});
if (result.isError) {
  // Handle error in result.content
}
```

Don't use `try/catch` for tool call errors - check `result.isError`.

### Zod Schema Usage

1. **MCP Server tools**: Use Zod schemas (SDK requirement)
   ```typescript
   server.registerTool('name', {
     inputSchema: z.object({ field: z.string() })
   }, handler);
   ```

2. **Eval datasets**: Schemas are optional, attached via loader
   ```typescript
   loadEvalDataset(path, {
     schemas: { 'schema-name': MyZodSchema }
   });
   ```

### Fixture Dependencies

Playwright fixtures follow dependency order:
1. `mcpClient` fixture (connects, provides raw `Client`)
2. `mcp` fixture (wraps `mcpClient` with `MCPFixtureApi`)

Tests use `mcp` fixture which includes the client + helper methods.

## File Structure

```
src/
  config/       - MCPConfig types + Zod validation
  mcp/          - Client factory, fixtures, MCPFixtureApi
  evals/        - Dataset types, loader, runner, expectations
  judge/        - LLM-as-a-judge (OpenAI, Anthropic)
  spec/         - Protocol conformance checks
  index.ts      - Public API exports

tests/
  fixtures/mcp.ts        - Playwright fixture entrypoint
  mocks/simpleMCPServer.ts  - Mock server for integration tests
  mcp-evals.spec.ts      - Integration test suite
```

## Adding New Features

### New Expectation Type

1. Create `src/evals/expectations/myExpectation.ts`
2. Export function returning `EvalExpectation`
3. Add to `src/index.ts` exports
4. Add unit tests in `*.test.ts`

### New LLM Judge Provider

1. Add provider to `LLMProviderKind` union in `judgeTypes.ts`
2. Create `src/judge/myProviderJudge.ts` implementing `LLMJudgeClient`
3. Add case to `createLLMJudgeClient()` switch
4. Use environment variables for API keys

### New Transport Type

1. Add to MCPConfig discriminated union
2. Update `createMCPClientForConfig()` with SDK transport class
3. Add Zod schema for validation
4. Update type guards if needed

## Testing Guidelines

- Unit tests: Mock MCP interactions, test logic in isolation
- Integration tests: Use `simpleMCPServer.ts` mock with real MCP SDK
- Conformance tests: Validate against MCP protocol spec
- Never skip tests without marking them explicitly

## Build Artifacts

- `dist/index.js` - ESM build
- `dist/index.cjs` - CommonJS build
- `dist/index.d.ts` - TypeScript declarations

Package exports both ESM and CJS for maximum compatibility.
