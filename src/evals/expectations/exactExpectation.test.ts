import { describe, it, expect } from 'vitest';
import { createExactExpectation } from './exactExpectation.js';
import type { EvalCase } from '../datasetTypes.js';
import type { EvalExpectationContext } from '../evalRunner.js';

describe('exactExpectation', () => {
  const mockContext: EvalExpectationContext = {
    mcp: {} as any,
    judgeClient: null,
  };

  describe('createExactExpectation', () => {
    it('should pass when response matches expectedExact', async () => {
      const expectation = createExactExpectation();
      const evalCase: EvalCase = {
        id: 'test-1',
        toolName: 'calculate',
        args: { a: 2, b: 3 },
        expectedExact: { result: 5 },
      };

      const result = await expectation(
        mockContext,
        evalCase,
        { result: 5 }
      );

      expect(result.pass).toBe(true);
      expect(result.details).toContain('matches expected');
    });

    it('should fail when response does not match expectedExact', async () => {
      const expectation = createExactExpectation();
      const evalCase: EvalCase = {
        id: 'test-1',
        toolName: 'calculate',
        args: {},
        expectedExact: { result: 5 },
      };

      const result = await expectation(
        mockContext,
        evalCase,
        { result: 10 }
      );

      expect(result.pass).toBe(false);
      expect(result.details).toContain('Expected');
      expect(result.details).toContain('Received');
    });

    it('should skip when expectedExact is undefined', async () => {
      const expectation = createExactExpectation();
      const evalCase: EvalCase = {
        id: 'test-1',
        toolName: 'test',
        args: {},
      };

      const result = await expectation(
        mockContext,
        evalCase,
        { anything: 'goes' }
      );

      expect(result.pass).toBe(true);
      expect(result.details).toContain('skipping');
    });

    it('should handle primitive values', async () => {
      const expectation = createExactExpectation();
      const evalCase: EvalCase = {
        id: 'test-1',
        toolName: 'test',
        args: {},
        expectedExact: 42,
      };

      const result = await expectation(mockContext, evalCase, 42);

      expect(result.pass).toBe(true);
    });

    it('should handle string values', async () => {
      const expectation = createExactExpectation();
      const evalCase: EvalCase = {
        id: 'test-1',
        toolName: 'test',
        args: {},
        expectedExact: 'hello',
      };

      const result = await expectation(mockContext, evalCase, 'hello');

      expect(result.pass).toBe(true);
    });

    it('should handle array values', async () => {
      const expectation = createExactExpectation();
      const evalCase: EvalCase = {
        id: 'test-1',
        toolName: 'test',
        args: {},
        expectedExact: [1, 2, 3],
      };

      const result = await expectation(mockContext, evalCase, [1, 2, 3]);

      expect(result.pass).toBe(true);
    });

    it('should fail when array order differs', async () => {
      const expectation = createExactExpectation();
      const evalCase: EvalCase = {
        id: 'test-1',
        toolName: 'test',
        args: {},
        expectedExact: [1, 2, 3],
      };

      const result = await expectation(mockContext, evalCase, [3, 2, 1]);

      expect(result.pass).toBe(false);
    });

    it('should handle nested objects', async () => {
      const expectation = createExactExpectation();
      const evalCase: EvalCase = {
        id: 'test-1',
        toolName: 'test',
        args: {},
        expectedExact: {
          user: {
            name: 'John',
            age: 30,
            tags: ['developer', 'tester'],
          },
        },
      };

      const result = await expectation(mockContext, evalCase, {
        user: {
          name: 'John',
          age: 30,
          tags: ['developer', 'tester'],
        },
      });

      expect(result.pass).toBe(true);
    });

    it('should fail when nested object differs', async () => {
      const expectation = createExactExpectation();
      const evalCase: EvalCase = {
        id: 'test-1',
        toolName: 'test',
        args: {},
        expectedExact: {
          user: {
            name: 'John',
            age: 30,
          },
        },
      };

      const result = await expectation(mockContext, evalCase, {
        user: {
          name: 'Jane',
          age: 30,
        },
      });

      expect(result.pass).toBe(false);
    });

    it('should handle null values', async () => {
      const expectation = createExactExpectation();
      const evalCase: EvalCase = {
        id: 'test-1',
        toolName: 'test',
        args: {},
        expectedExact: null,
      };

      const result = await expectation(mockContext, evalCase, null);

      expect(result.pass).toBe(true);
    });

    it('should distinguish between null and undefined', async () => {
      const expectation = createExactExpectation();
      const evalCase: EvalCase = {
        id: 'test-1',
        toolName: 'test',
        args: {},
        expectedExact: null,
      };

      const result = await expectation(mockContext, evalCase, undefined);

      expect(result.pass).toBe(false);
    });

    it('should handle boolean values', async () => {
      const expectation = createExactExpectation();
      const evalCase: EvalCase = {
        id: 'test-1',
        toolName: 'test',
        args: {},
        expectedExact: true,
      };

      const result = await expectation(mockContext, evalCase, true);

      expect(result.pass).toBe(true);
    });

    it('should fail when types differ', async () => {
      const expectation = createExactExpectation();
      const evalCase: EvalCase = {
        id: 'test-1',
        toolName: 'test',
        args: {},
        expectedExact: 42,
      };

      const result = await expectation(mockContext, evalCase, '42');

      expect(result.pass).toBe(false);
    });
  });
});
