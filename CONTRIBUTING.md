# Contributing to playwright-mcp-server-test

Thank you for your interest in contributing! This project is experimental and community input is essential to its evolution. We welcome all types of contributions.

## Ways to Contribute

- 🐛 **Report bugs** - Found an issue? Let us know!
- 💡 **Suggest features** - Have ideas for improvements?
- 📝 **Improve documentation** - Help make things clearer
- 🔧 **Submit code** - Bug fixes, features, tests, examples
- 🤔 **Ask questions** - Discussions help everyone learn

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/playwright-mcp-server-test.git
   cd playwright-mcp-server-test
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Build the project:
   ```bash
   npm run build
   ```

## Development Workflow

### Running Tests

```bash
# Unit tests (Vitest)
npm test
npm run test:watch

# Integration tests (Playwright)
npm run test:playwright

# All tests
npm test && npm run test:playwright
```

### Code Quality

Before submitting a PR, ensure:

```bash
npm run typecheck  # TypeScript validation
npm run lint       # ESLint checks
npm run format     # Prettier formatting
npm test          # All tests pass
npm run build     # Build succeeds
```

### Making Changes

1. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following our [code style](#code-style)

3. Add tests for new functionality

4. Update documentation as needed

5. Commit with conventional commit messages:
   ```bash
   git commit -m "feat: add new expectation type"
   git commit -m "fix: resolve transport timeout issue"
   git commit -m "docs: improve API reference"
   ```

   Commit types:
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation changes
   - `test:` - Test changes
   - `refactor:` - Code refactoring
   - `chore:` - Build/tooling changes

6. Push and create a pull request

## Code Style

This project enforces specific code conventions:

### 1. Function Declarations
```typescript
// ✓ Good
export function createClient() { }

// ✗ Avoid
export const createClient = () => { }
```

### 2. Explicit null
```typescript
// ✓ Good
condition ? 'value' : null

// ✗ Avoid
condition && 'value'
```

### 3. Descriptive Type Names
```typescript
// ✓ Good
EvalDataset, MCPFixtureApi, LLMJudgeClient

// ✗ Avoid
Data, Api, Client
```

### 4. TypeScript Strict Mode
- No `any` types
- Prefer type safety
- Use proper null checks

### 5. Async Function Style
- Keep `async` keyword for consistency
- Even if no `await` currently used

## Project Structure

```
playwright-mcp-server-test/
├── src/
│   ├── config/       # MCPConfig types + validation
│   ├── mcp/          # Client factory, fixtures
│   ├── evals/        # Dataset types, runner, expectations
│   ├── judge/        # LLM-as-a-judge implementations
│   ├── spec/         # Protocol conformance checks
│   └── index.ts      # Public API exports
├── tests/
│   ├── fixtures/     # Playwright fixtures
│   ├── mocks/        # Mock MCP server
│   └── *.spec.ts     # Integration tests
├── docs/             # Documentation
└── examples/         # Example projects
```

## Adding Features

### New Expectation Type

1. Create `src/evals/expectations/myExpectation.ts`
2. Export function returning `EvalExpectation`
3. Add to `src/index.ts` exports
4. Add unit tests
5. Update `docs/expectations.md`

Example:
```typescript
// src/evals/expectations/myExpectation.ts
import type { EvalExpectation } from '../evalTypes';

export function createMyExpectation(): EvalExpectation {
  return async (context, evalCase, response) => {
    // Implementation
    return { pass: true, details: 'Success' };
  };
}
```

### New LLM Judge Provider

1. Add provider to `LLMProviderKind` in `src/judge/judgeTypes.ts`
2. Create `src/judge/myProviderJudge.ts` implementing `LLMJudgeClient`
3. Add to `createLLMJudgeClient()` switch in `src/judge/index.ts`
4. Use environment variables for API keys
5. Add tests
6. Update `docs/expectations.md`

### New Transport Type

1. Add to `MCPConfig` discriminated union in `src/config/mcpConfig.ts`
2. Update `createMCPClientForConfig()` in `src/mcp/createClient.ts`
3. Add Zod schema in `src/config/mcpConfigSchema.ts`
4. Add tests
5. Update `docs/transports.md`

## Testing Guidelines

- **Unit tests**: Mock MCP interactions, test logic in isolation
- **Integration tests**: Use mock server with real MCP SDK
- **Conformance tests**: Validate against MCP protocol spec
- Never skip tests without marking explicitly (`test.skip()`)

## Documentation

When adding features:

1. Update relevant docs in `docs/`
2. Add JSDoc comments to public APIs
3. Include code examples
4. Update README if it affects quick start

## Pull Request Process

1. Update documentation for any changed functionality
2. Add tests for new features
3. Ensure all tests pass
4. Update CHANGELOG.md (if maintaining one)
5. Request review from maintainers

### PR Title Format

Use conventional commit format:
- `feat: add HTTP SSE support`
- `fix: resolve connection timeout issue`
- `docs: improve expectations guide`

### PR Description

Include:
- What changed and why
- Related issue (if any)
- How to test the changes
- Screenshots (if UI changes)

## Questions or Issues?

- **Documentation**: Check [`docs/`](./docs) directory
- **Examples**: See [`examples/`](./examples) directory
- **Bugs**: [Open an issue](https://github.com/scalvert/playwright-mcp-server-test/issues)
- **Discussions**: [GitHub Discussions](https://github.com/scalvert/playwright-mcp-server-test/discussions)

## Code of Conduct

Be respectful, inclusive, and collaborative. We're all here to build something useful together.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

**Thank you for contributing!** Your help makes this project better for everyone.
