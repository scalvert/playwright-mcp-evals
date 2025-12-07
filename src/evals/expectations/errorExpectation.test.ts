import { describe, it, expect } from 'vitest';
import { createErrorExpectation } from './errorExpectation.js';
import type { EvalCase } from '../datasetTypes.js';
import type { EvalExpectationContext } from '../evalRunner.js';
import type { MCPFixtureApi } from '../../mcp/fixtures/mcpFixture.js';

describe('createErrorExpectation', () => {
  const mockContext: EvalExpectationContext = {
    mcp: {} as unknown as MCPFixtureApi,
  };

  describe('basic functionality', () => {
    it('should skip when expectedError is not defined', async () => {
      const expectation = createErrorExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
      };

      const result = await expectation(mockContext, evalCase, {
        isError: false,
        content: [{ type: 'text', text: 'success' }],
      });

      expect(result.pass).toBe(true);
      expect(result.details).toContain('skipping');
    });

    it('should pass when expectedError is true and isError is true', async () => {
      const expectation = createErrorExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedError: true,
      };

      const result = await expectation(mockContext, evalCase, {
        isError: true,
        content: [{ type: 'text', text: 'Error: missing required parameter' }],
      });

      expect(result.pass).toBe(true);
      expect(result.details).toContain('correctly returned an error');
    });

    it('should fail when expectedError is true but isError is false', async () => {
      const expectation = createErrorExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedError: true,
      };

      const result = await expectation(mockContext, evalCase, {
        isError: false,
        content: [{ type: 'text', text: 'success' }],
      });

      expect(result.pass).toBe(false);
      expect(result.details).toContain('Expected tool to return isError: true');
    });

    it('should handle undefined isError as false', async () => {
      const expectation = createErrorExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedError: true,
      };

      const result = await expectation(mockContext, evalCase, {
        content: [{ type: 'text', text: 'success' }],
      });

      expect(result.pass).toBe(false);
    });
  });

  describe('error message validation', () => {
    it('should pass when error message contains expected string', async () => {
      const expectation = createErrorExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedError: 'missing required',
      };

      const result = await expectation(mockContext, evalCase, {
        isError: true,
        content: [
          { type: 'text', text: 'Error: missing required parameter "query"' },
        ],
      });

      expect(result.pass).toBe(true);
      expect(result.details).toContain('matching message');
    });

    it('should fail when error message does not contain expected string', async () => {
      const expectation = createErrorExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedError: 'authentication failed',
      };

      const result = await expectation(mockContext, evalCase, {
        isError: true,
        content: [{ type: 'text', text: 'Error: missing required parameter' }],
      });

      expect(result.pass).toBe(false);
      expect(result.details).toContain('missing expected content');
      expect(result.details).toContain('authentication failed');
    });

    it('should pass when error message contains all expected strings', async () => {
      const expectation = createErrorExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedError: ['missing', 'query', 'required'],
      };

      const result = await expectation(mockContext, evalCase, {
        isError: true,
        content: [
          { type: 'text', text: 'Error: missing required parameter "query"' },
        ],
      });

      expect(result.pass).toBe(true);
    });

    it('should fail when error message is missing some expected strings', async () => {
      const expectation = createErrorExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedError: ['missing', 'query', 'authentication'],
      };

      const result = await expectation(mockContext, evalCase, {
        isError: true,
        content: [
          { type: 'text', text: 'Error: missing required parameter "query"' },
        ],
      });

      expect(result.pass).toBe(false);
      expect(result.details).toContain('authentication');
    });

    it('should be case-insensitive when matching error messages', async () => {
      const expectation = createErrorExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedError: 'MISSING REQUIRED',
      };

      const result = await expectation(mockContext, evalCase, {
        isError: true,
        content: [{ type: 'text', text: 'Error: missing required parameter' }],
      });

      expect(result.pass).toBe(true);
    });
  });

  describe('response formats', () => {
    it('should extract text from MCP CallToolResult format', async () => {
      const expectation = createErrorExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedError: 'validation failed',
      };

      const response = {
        isError: true,
        content: [{ type: 'text', text: 'validation failed: invalid input' }],
      };

      const result = await expectation(mockContext, evalCase, response);

      expect(result.pass).toBe(true);
    });

    it('should handle structuredContent in error response', async () => {
      const expectation = createErrorExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedError: 'error',
      };

      const response = {
        isError: true,
        structuredContent: { error: 'Something went wrong', code: 500 },
      };

      const result = await expectation(mockContext, evalCase, response);

      expect(result.pass).toBe(true);
    });

    it('should handle error with multiple content blocks', async () => {
      const expectation = createErrorExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedError: ['not found', 'resource'],
      };

      // Error response with multiple content blocks
      const response = {
        isError: true,
        content: [
          { type: 'text', text: 'Error: Resource' },
          { type: 'text', text: 'not found in database' },
        ],
      };

      const result = await expectation(mockContext, evalCase, response);

      expect(result.pass).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle null response', async () => {
      const expectation = createErrorExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedError: true,
      };

      const result = await expectation(mockContext, evalCase, null);

      expect(result.pass).toBe(false);
    });

    it('should handle undefined response', async () => {
      const expectation = createErrorExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedError: true,
      };

      const result = await expectation(mockContext, evalCase, undefined);

      expect(result.pass).toBe(false);
    });

    it('should handle empty content array with isError true', async () => {
      const expectation = createErrorExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedError: true,
      };

      const response = {
        isError: true,
        content: [],
      };

      const result = await expectation(mockContext, evalCase, response);

      expect(result.pass).toBe(true);
    });

    it('should fail string matching when error content is empty', async () => {
      const expectation = createErrorExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedError: 'specific error',
      };

      const response = {
        isError: true,
        content: [],
      };

      const result = await expectation(mockContext, evalCase, response);

      expect(result.pass).toBe(false);
      expect(result.details).toContain('missing expected content');
    });
  });

  describe('error message truncation', () => {
    it('should truncate long error messages in details', async () => {
      const expectation = createErrorExpectation();
      const evalCase: EvalCase = {
        id: 'test',
        toolName: 'test_tool',
        args: {},
        expectedError: 'nonexistent pattern',
      };

      const longError = 'x'.repeat(600);
      const response = {
        isError: true,
        content: [{ type: 'text', text: longError }],
      };

      const result = await expectation(mockContext, evalCase, response);

      expect(result.pass).toBe(false);
      expect(result.details).toContain('...');
      expect(result.details!.length).toBeLessThan(700);
    });
  });
});
