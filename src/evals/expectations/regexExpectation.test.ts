import { describe, it, expect } from 'vitest';
import { createRegexExpectation } from './regexExpectation.js';
import type { EvalCase } from '../datasetTypes.js';

describe('createRegexExpectation', () => {
  const mockContext = {
    mcp: {} as any,
  };

  describe('basic functionality', () => {
    it('should skip when expectedRegex is not defined', async () => {
      const expectation = createRegexExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
      };

      const result = await expectation(mockContext, evalCase, 'any response');

      expect(result.pass).toBe(true);
      expect(result.details).toContain('skipping');
    });

    it('should pass when single pattern matches', async () => {
      const expectation = createRegexExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedRegex: 'hello',
      };

      const result = await expectation(
        mockContext,
        evalCase,
        'hello world'
      );

      expect(result.pass).toBe(true);
      expect(result.details).toContain('matches expected pattern');
    });

    it('should fail when single pattern does not match', async () => {
      const expectation = createRegexExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedRegex: 'goodbye',
      };

      const result = await expectation(
        mockContext,
        evalCase,
        'hello world'
      );

      expect(result.pass).toBe(false);
      expect(result.details).toContain('Failed to match');
      expect(result.details).toContain('goodbye');
    });

    it('should pass when all patterns in array match', async () => {
      const expectation = createRegexExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedRegex: ['hello', 'world', '\\d+'],
      };

      const result = await expectation(
        mockContext,
        evalCase,
        'hello world 123'
      );

      expect(result.pass).toBe(true);
      expect(result.details).toContain('all 3 expected patterns');
    });

    it('should fail when some patterns do not match', async () => {
      const expectation = createRegexExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedRegex: ['hello', 'missing', '\\d+'],
      };

      const result = await expectation(
        mockContext,
        evalCase,
        'hello world 123'
      );

      expect(result.pass).toBe(false);
      expect(result.details).toContain('Failed to match 1 pattern');
      expect(result.details).toContain('missing');
    });
  });

  describe('regex patterns', () => {
    it('should support anchors', async () => {
      const expectation = createRegexExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedRegex: ['^## Header', 'end$'],
      };

      const result = await expectation(
        mockContext,
        evalCase,
        '## Header content at the end'
      );

      expect(result.pass).toBe(true);
    });

    it('should support character classes', async () => {
      const expectation = createRegexExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedRegex: '\\d{3}-\\d{4}',
      };

      const result = await expectation(
        mockContext,
        evalCase,
        'Call 555-1234 for info'
      );

      expect(result.pass).toBe(true);
    });

    it('should support quantifiers', async () => {
      const expectation = createRegexExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedRegex: 'a{2,4}',
      };

      const result = await expectation(mockContext, evalCase, 'aaa');

      expect(result.pass).toBe(true);
    });

    it('should support alternation', async () => {
      const expectation = createRegexExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedRegex: '(cat|dog|bird)',
      };

      const result = await expectation(
        mockContext,
        evalCase,
        'I have a dog'
      );

      expect(result.pass).toBe(true);
    });

    it('should support word boundaries', async () => {
      const expectation = createRegexExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedRegex: '\\btest\\b',
      };

      const result = await expectation(
        mockContext,
        evalCase,
        'this is a test case'
      );

      expect(result.pass).toBe(true);
    });

    it('should handle escaped special characters', async () => {
      const expectation = createRegexExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedRegex: '\\$\\d+\\.\\d{2}',
      };

      const result = await expectation(
        mockContext,
        evalCase,
        'Price: $19.99'
      );

      expect(result.pass).toBe(true);
    });
  });

  describe('markdown use cases', () => {
    it('should validate markdown headers', async () => {
      const expectation = createRegexExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'get_weather',
        args: {},
        expectedRegex: ['^## \\w+', '^### \\w+'],
      };

      const response = `## Weather Report

### Temperature
20°C`;

      const result = await expectation(mockContext, evalCase, response);

      expect(result.pass).toBe(true);
    });

    it('should validate temperature format', async () => {
      const expectation = createRegexExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'get_weather',
        args: {},
        expectedRegex: 'Temperature: \\d+°[CF]',
      };

      const response = 'Temperature: 20°C';

      const result = await expectation(mockContext, evalCase, response);

      expect(result.pass).toBe(true);
    });

    it('should validate list items', async () => {
      const expectation = createRegexExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'get_info',
        args: {},
        expectedRegex: '^- \\w+',
      };

      const response = `Features:
- Transportation
- Culture`;

      const result = await expectation(mockContext, evalCase, response);

      expect(result.pass).toBe(true);
    });

    it('should validate date formats', async () => {
      const expectation = createRegexExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'get_date',
        args: {},
        expectedRegex: '\\d{4}-\\d{2}-\\d{2}',
      };

      const response = 'Date: 2025-01-22';

      const result = await expectation(mockContext, evalCase, response);

      expect(result.pass).toBe(true);
    });

    it('should validate URL patterns', async () => {
      const expectation = createRegexExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'get_links',
        args: {},
        expectedRegex: 'https?://[\\w.-]+\\.[a-z]{2,}',
      };

      const response = 'Visit https://example.com for more info';

      const result = await expectation(mockContext, evalCase, response);

      expect(result.pass).toBe(true);
    });
  });

  describe('response formats', () => {
    it('should handle plain string responses', async () => {
      const expectation = createRegexExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedRegex: 'test',
      };

      const result = await expectation(
        mockContext,
        evalCase,
        'this is a test'
      );

      expect(result.pass).toBe(true);
    });

    it('should extract text from MCP CallToolResult format', async () => {
      const expectation = createRegexExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedRegex: 'weather',
      };

      const response = {
        content: [
          { type: 'text', text: 'The weather is sunny' },
        ],
      };

      const result = await expectation(mockContext, evalCase, response);

      expect(result.pass).toBe(true);
    });

    it('should handle multiple content blocks', async () => {
      const expectation = createRegexExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedRegex: ['first', 'second'],
      };

      const response = {
        content: [
          { type: 'text', text: 'first block' },
          { type: 'text', text: 'second block' },
        ],
      };

      const result = await expectation(mockContext, evalCase, response);

      expect(result.pass).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle invalid regex patterns gracefully', async () => {
      const expectation = createRegexExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedRegex: '[invalid(',
      };

      const result = await expectation(
        mockContext,
        evalCase,
        'any text'
      );

      expect(result.pass).toBe(false);
      expect(result.details).toContain('Invalid pattern');
    });

    it('should include response text in error details', async () => {
      const expectation = createRegexExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedRegex: 'missing',
      };

      const result = await expectation(
        mockContext,
        evalCase,
        'actual response text'
      );

      expect(result.pass).toBe(false);
      expect(result.details).toContain('Response text:');
      expect(result.details).toContain('actual response text');
    });

    it('should truncate long response text', async () => {
      const expectation = createRegexExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedRegex: 'missing',
      };

      const longText = 'x'.repeat(600);
      const result = await expectation(mockContext, evalCase, longText);

      expect(result.pass).toBe(false);
      expect(result.details).toBeDefined();
      expect(result.details).toContain('...');
      expect(result.details!.length).toBeLessThan(700);
    });
  });

  describe('complex patterns', () => {
    it('should validate structured markdown document', async () => {
      const expectation = createRegexExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'generate_report',
        args: {},
        expectedRegex: [
          '^# \\w+',           // Title
          '^## Summary',      // Summary section
          '^### \\w+',        // Subsection
          '\\*\\*\\w+:\\*\\*', // Bold key-value
          '^- \\w+',          // List item
        ],
      };

      const response = `# Report

## Summary
Overview of findings

### Details
**City:** London
**Population:** 8.9M

Features:
- Transportation
- Culture`;

      const result = await expectation(mockContext, evalCase, response);

      expect(result.pass).toBe(true);
    });
  });
});
