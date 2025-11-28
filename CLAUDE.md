# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`@mcp-testing/server-tester` is a Playwright-based testing and evaluation framework for Model Context Protocol (MCP) servers. It provides Playwright fixtures for automated testing and data-driven eval datasets with optional LLM-as-a-judge scoring.

## Common Commands

```bash
# Build (includes UI reporter build)
npm run build

# Unit tests (Vitest)
npm test                    # Run all unit tests
npm run test:watch          # Watch mode

# Integration tests (Playwright)
npm run test:playwright

# Code quality
npm run typecheck           # TypeScript validation
npm run lint                # ESLint
npm run lint:fix            # Auto-fix lint issues
npm run format              # Prettier formatting
npm run format:check        # Check formatting
```

## Architecture

### Core Modules (`src/`)

- **`config/`** - `MCPConfig` types and Zod validation for stdio/HTTP transports
- **`mcp/`** - Client factory (`createMCPClientForConfig`), fixtures (`MCPFixtureApi`), and response normalization
- **`evals/`** - Dataset types, loader, runner, and expectations (exact, schema, textContains, regex, snapshot, judge)
- **`judge/`** - LLM-as-a-judge implementations (OpenAI, Anthropic)
- **`spec/`** - MCP protocol conformance checks
- **`reporters/`** - Custom Playwright reporter with React-based UI
- **`cli/`** - `mcp-test init` and `mcp-test generate` commands

### Playwright Fixtures (`tests/fixtures/mcp.ts`)

The main test fixture provides:
- `mcpClient: Client` - Raw MCP SDK client
- `mcp: MCPFixtureApi` - High-level test API with `listTools()`, `callTool()`, etc.

Configuration is read from `project.use.mcpConfig` in playwright.config.ts.

### Exports

Public API is defined in `src/index.ts`. The package has multiple export paths:
- `.` - Main library exports
- `./fixtures/mcp` - Playwright test fixtures
- `./reporters/mcpReporter` - Custom reporter

## Code Style

- Use function declarations, not arrow function expressions for exports
- Use explicit `null` in ternaries instead of short-circuit (`condition ? 'value' : null`)
- Descriptive type names (e.g., `EvalDataset`, `MCPFixtureApi`, `LLMJudgeClient`)
- No `any` types - TypeScript strict mode is enabled
- Keep `async` keyword even if no `await` currently used

## Commit Messages

Use conventional commits: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`

## Adding New Features

### New Expectation Type
1. Create `src/evals/expectations/myExpectation.ts` returning `EvalExpectation`
2. Export from `src/index.ts`
3. Add unit tests (`*.test.ts`)

### New LLM Judge Provider
1. Add to `LLMProviderKind` in `src/judge/judgeTypes.ts`
2. Implement `LLMJudgeClient` interface in `src/judge/myProviderJudge.ts`
3. Add to switch in `src/judge/judgeClient.ts`

### New Transport Type
1. Add to `MCPConfig` union in `src/config/mcpConfig.ts`
2. Update `createMCPClientForConfig()` in `src/mcp/clientFactory.ts`
