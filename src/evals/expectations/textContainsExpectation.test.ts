import { describe, it, expect } from 'vitest';
import { createTextContainsExpectation } from './textContainsExpectation.js';
import type { EvalCase } from '../datasetTypes.js';

describe('createTextContainsExpectation', () => {
  const mockContext = {
    mcp: {} as any,
  };

  describe('basic functionality', () => {
    it('should skip when expectedTextContains is not defined', async () => {
      const expectation = createTextContainsExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
      };

      const result = await expectation(mockContext, evalCase, 'any response');

      expect(result.pass).toBe(true);
      expect(result.details).toContain('skipping');
    });

    it('should pass when single substring is found', async () => {
      const expectation = createTextContainsExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedTextContains: 'hello',
      };

      const result = await expectation(
        mockContext,
        evalCase,
        'hello world'
      );

      expect(result.pass).toBe(true);
      expect(result.details).toContain('contains expected substring');
    });

    it('should fail when single substring is not found', async () => {
      const expectation = createTextContainsExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedTextContains: 'goodbye',
      };

      const result = await expectation(
        mockContext,
        evalCase,
        'hello world'
      );

      expect(result.pass).toBe(false);
      expect(result.details).toContain('Missing');
      expect(result.details).toContain('goodbye');
    });

    it('should pass when all substrings in array are found', async () => {
      const expectation = createTextContainsExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedTextContains: ['hello', 'world', 'test'],
      };

      const result = await expectation(
        mockContext,
        evalCase,
        'hello world this is a test'
      );

      expect(result.pass).toBe(true);
      expect(result.details).toContain('all 3 expected substrings');
    });

    it('should fail when some substrings are missing', async () => {
      const expectation = createTextContainsExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedTextContains: ['hello', 'world', 'missing'],
      };

      const result = await expectation(
        mockContext,
        evalCase,
        'hello world'
      );

      expect(result.pass).toBe(false);
      expect(result.details).toContain('Missing 1 substring');
      expect(result.details).toContain('missing');
    });
  });

  describe('case sensitivity', () => {
    it('should be case-sensitive by default', async () => {
      const expectation = createTextContainsExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedTextContains: 'Hello',
      };

      const result = await expectation(
        mockContext,
        evalCase,
        'hello world'
      );

      expect(result.pass).toBe(false);
    });

    it('should support case-insensitive matching', async () => {
      const expectation = createTextContainsExpectation({ caseSensitive: false });
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedTextContains: 'HELLO',
      };

      const result = await expectation(
        mockContext,
        evalCase,
        'hello world'
      );

      expect(result.pass).toBe(true);
    });

    it('should handle mixed case with case-insensitive option', async () => {
      const expectation = createTextContainsExpectation({ caseSensitive: false });
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedTextContains: ['HeLLo', 'WoRLd'],
      };

      const result = await expectation(
        mockContext,
        evalCase,
        'hello WORLD'
      );

      expect(result.pass).toBe(true);
    });
  });

  describe('response formats', () => {
    it('should handle plain string responses', async () => {
      const expectation = createTextContainsExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedTextContains: 'test',
      };

      const result = await expectation(
        mockContext,
        evalCase,
        'this is a test'
      );

      expect(result.pass).toBe(true);
    });

    it('should extract text from MCP CallToolResult format', async () => {
      const expectation = createTextContainsExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedTextContains: 'weather',
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
      const expectation = createTextContainsExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedTextContains: ['first', 'second'],
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

    it('should extract from structuredContent field', async () => {
      const expectation = createTextContainsExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedTextContains: 'result',
      };

      const response = {
        structuredContent: { result: 42 },
      };

      const result = await expectation(mockContext, evalCase, response);

      expect(result.pass).toBe(true);
    });

    it('should handle object with text field', async () => {
      const expectation = createTextContainsExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedTextContains: 'message',
      };

      const response = {
        text: 'This is a message',
      };

      const result = await expectation(mockContext, evalCase, response);

      expect(result.pass).toBe(true);
    });
  });

  describe('markdown use cases', () => {
    it('should validate markdown headers', async () => {
      const expectation = createTextContainsExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'get_weather',
        args: {},
        expectedTextContains: ['## Weather Report', '### Temperature'],
      };

      const response = `## Weather Report

### Temperature
20°C

### Conditions
Sunny`;

      const result = await expectation(mockContext, evalCase, response);

      expect(result.pass).toBe(true);
    });

    it('should validate markdown content', async () => {
      const expectation = createTextContainsExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'get_info',
        args: {},
        expectedTextContains: [
          '**City:**',
          '**Population:**',
          '- Transportation',
        ],
      };

      const response = `## City Information

**City:** London
**Population:** 8.9M

### Features
- Transportation
- Culture
- History`;

      const result = await expectation(mockContext, evalCase, response);

      expect(result.pass).toBe(true);
    });
  });

  describe('error messages', () => {
    it('should include response text in error details', async () => {
      const expectation = createTextContainsExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedTextContains: 'missing',
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
      const expectation = createTextContainsExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedTextContains: 'missing',
      };

      const longText = 'x'.repeat(600);
      const result = await expectation(mockContext, evalCase, longText);

      expect(result.pass).toBe(false);
      expect(result.details).toBeDefined();
      expect(result.details).toContain('...');
      expect(result.details!.length).toBeLessThan(700);
    });
  });
});
