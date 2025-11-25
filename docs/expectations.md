# Expectations Guide

The framework supports multiple types of expectations to validate MCP tool responses. This guide covers all available expectation types and how to use them.

## Table of Contents

- [Exact Match](#exact-match)
- [Text Contains](#text-contains)
- [Regex Pattern Matching](#regex-pattern-matching)
- [Schema Validation](#schema-validation)
- [LLM-as-a-Judge](#llm-as-a-judge)
- [Combining Multiple Expectations](#combining-multiple-expectations)
- [Examples](#examples)

## Exact Match

Validates exact equality of structured data (JSON). Best for predictable, structured responses.

### Usage

```typescript
import { createExactExpectation } from '@mcp-testing/server-tester';

const expectations = {
  exact: createExactExpectation(),
};
```

### Dataset Format

```json
{
  "id": "calc-test",
  "toolName": "calculate",
  "args": { "a": 2, "b": 3 },
  "expectedExact": { "result": 5 }
}
```

The `expectedExact` field should contain the exact expected response structure.

## Text Contains

Validates that response text contains expected substrings. Ideal for markdown or unstructured text responses.

### Usage

```typescript
import { createTextContainsExpectation } from '@mcp-testing/server-tester';

const expectations = {
  textContains: createTextContainsExpectation(),
  // Optional: case-insensitive matching
  // textContains: createTextContainsExpectation({ caseSensitive: false }),
};
```

### Dataset Format

```json
{
  "id": "markdown-response",
  "toolName": "get_city_info",
  "args": { "city": "London" },
  "expectedTextContains": [
    "## City Information",
    "**City:** London",
    "### Features",
    "- Public Transportation"
  ]
}
```

### Options

- `caseSensitive` (default: `true`) - Whether to perform case-sensitive matching

### Best Practices

- Use for markdown responses where exact formatting may vary
- Include distinctive strings that confirm key information is present
- Order-independent (substrings can appear in any order)
- Great for validating headings, bullet points, and key phrases

## Regex Pattern Matching

Validates that response text matches regex patterns. Powerful for format validation and flexible pattern matching.

### Usage

```typescript
import { createRegexExpectation } from '@mcp-testing/server-tester';

const expectations = {
  regex: createRegexExpectation(),
};
```

### Dataset Format

```json
{
  "id": "weather-format",
  "toolName": "get_weather",
  "args": { "city": "London" },
  "expectedRegex": [
    "^## Weather",
    "Temperature: \\d+°[CF]",
    "Conditions?: (Sunny|Cloudy|Rainy|Snowy)",
    "\\d{4}-\\d{2}-\\d{2}"
  ]
}
```

### Pattern Features

- **Multiline matching** - `^` and `$` match line starts/ends
- **Escape special characters** - Use `\\` for literal characters (e.g., `\\d+` for digits)
- **Capture groups** - Use `(pattern1|pattern2)` for alternatives
- **Character classes** - Use `[a-z]`, `\\d`, `\\w`, etc.

### Best Practices

- Use `^` and `$` anchors to validate line structure
- Escape regex special characters in JSON (`\` becomes `\\`)
- Test patterns for both valid and invalid cases
- Combine with text contains for comprehensive validation

## Schema Validation

Validates response structure and types using Zod schemas. Best for structured data with specific type requirements.

### Usage

```typescript
import { createSchemaExpectation } from '@mcp-testing/server-tester';
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

### Dataset Format

```json
{
  "id": "get-user",
  "toolName": "get_user",
  "args": { "userId": "123" },
  "expectedSchemaName": "user-response"
}
```

### Schema Capabilities

Zod schemas support:
- Type validation (`string`, `number`, `boolean`, etc.)
- Format validation (`email`, `url`, `uuid`, etc.)
- Nested objects and arrays
- Optional and nullable fields
- Custom validation logic

### Example Schemas

```typescript
// Basic schema
const WeatherSchema = z.object({
  city: z.string(),
  temperature: z.number(),
  conditions: z.string(),
});

// Complex schema with nested data
const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().email(),
  age: z.number().int().min(0).optional(),
  address: z.object({
    street: z.string(),
    city: z.string(),
    zip: z.string().regex(/^\d{5}$/),
  }),
  tags: z.array(z.string()),
});
```

## LLM-as-a-Judge

Semantic evaluation using LLMs (OpenAI or Anthropic). Best for subjective criteria like relevance, quality, or tone.

### Setup

```typescript
import {
  createJudgeExpectation,
  createLLMJudgeClient,
} from '@mcp-testing/server-tester';

const judgeClient = createLLMJudgeClient({
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.0,
});

const expectations = {
  judge: createJudgeExpectation({
    'search-relevance': {
      rubric: 'Evaluate if the search results are relevant to the query. Score 0-1.',
      passingThreshold: 0.7,
    },
  }),
};

const result = await runEvalDataset(
  { dataset, expectations, judgeClient },
  { mcp }
);
```

### Dataset Format

```json
{
  "id": "search-test",
  "toolName": "search_docs",
  "args": { "query": "authentication" },
  "judgeConfigId": "search-relevance"
}
```

### Supported Providers

- **OpenAI** - Requires `OPENAI_API_KEY` environment variable
  ```typescript
  createLLMJudgeClient({
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.0,
  });
  ```

- **Anthropic** - Requires `ANTHROPIC_API_KEY` environment variable
  ```typescript
  createLLMJudgeClient({
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',
    temperature: 0.0,
  });
  ```

### Judge Configuration

- `rubric` - Evaluation criteria for the LLM judge
- `passingThreshold` - Minimum score (0-1) to pass the evaluation

### Best Practices

- Use low temperature (0.0) for consistency
- Write clear, specific rubrics
- Test rubrics with known good/bad examples
- Set appropriate passing thresholds based on your quality standards
- Consider cost implications (LLM API calls per evaluation)

## Combining Multiple Expectations

You can use multiple expectations together for comprehensive validation:

```typescript
const result = await runEvalDataset(
  {
    dataset,
    expectations: {
      exact: createExactExpectation(),
      schema: createSchemaExpectation(dataset),
      textContains: createTextContainsExpectation(),
      regex: createRegexExpectation(),
      judge: createJudgeExpectation(judgeConfigs),
    },
    judgeClient,
  },
  { mcp }
);
```

Each eval case will use the appropriate expectation based on which fields are defined:
- `expectedExact` → Exact match validation
- `expectedSchemaName` → Schema validation
- `expectedTextContains` → Text contains validation
- `expectedRegex` → Regex pattern validation
- `judgeConfigId` → LLM judge evaluation

You can also combine multiple expectations for a single test case:

```json
{
  "id": "comprehensive-test",
  "toolName": "get_city_info",
  "args": { "city": "London" },
  "expectedSchemaName": "city-info",
  "expectedTextContains": ["London", "Population"],
  "expectedRegex": ["^## City Information", "Population: [\\d.]+M"],
  "judgeConfigId": "info-quality"
}
```

## Examples

### Testing Markdown Responses

Many MCP servers return markdown-formatted responses. Here's a complete example:

```typescript
// Your MCP server returns markdown
const response = `## City Information

**City:** London
**Population:** 8.9M

### Features
- Public Transportation
- Cultural Attractions

Temperature: 15°C
Last updated: 2025-01-22`;

// Validate with text contains
{
  "id": "city-info-text",
  "toolName": "get_city_info",
  "args": { "city": "London" },
  "expectedTextContains": [
    "## City Information",
    "**City:** London",
    "### Features"
  ]
}

// Validate with regex patterns
{
  "id": "city-info-format",
  "toolName": "get_city_info",
  "args": { "city": "London" },
  "expectedRegex": [
    "^## City Information",      // Starts with heading
    "\\*\\*City:\\*\\* \\w+",    // Has city field
    "\\*\\*Population:\\*\\* [\\d.]+M",  // Population in millions
    "Temperature: \\d+°C",       // Temperature format
    "\\d{4}-\\d{2}-\\d{2}"      // Date format
  ]
}

// In your test
const result = await runEvalDataset(
  {
    dataset,
    expectations: {
      textContains: createTextContainsExpectation(),
      regex: createRegexExpectation(),
    },
  },
  { mcp }
);
```

### Choosing the Right Expectation

| Response Type | Recommended Expectation | Why |
|---------------|------------------------|-----|
| JSON with fixed structure | Exact Match | Predictable, structured data |
| JSON with variable values | Schema | Type-safe validation with flexibility |
| Markdown/formatted text | Text Contains | Order-independent content validation |
| Text with specific format | Regex | Pattern-based validation |
| Subjective quality | LLM Judge | Semantic understanding required |

### Next Steps

- Check out the [Quick Start Guide](./quickstart.md) for getting started
- See the [API Reference](./api-reference.md) for detailed function signatures
- Explore [Examples](../examples) for real-world usage patterns
