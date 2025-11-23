import { describe, it, expect } from 'vitest';
import { createSchemaExpectation } from './schemaExpectation.js';
import type { EvalCase, EvalDataset } from '../datasetTypes.js';
import type { EvalExpectationContext } from '../evalRunner.js';
import { z } from 'zod';

describe('schemaExpectation', () => {
  const mockContext: EvalExpectationContext = {
    mcp: {} as any,
    judgeClient: null,
  };

  describe('createSchemaExpectation', () => {
    it('should pass when response conforms to schema', async () => {
      const WeatherSchema = z.object({
        city: z.string(),
        temperature: z.number(),
      });

      const dataset: EvalDataset = {
        name: 'test',
        cases: [],
        schemas: {
          'weather-response': WeatherSchema,
        },
      };

      const expectation = createSchemaExpectation(dataset);
      const evalCase: EvalCase = {
        id: 'test-1',
        toolName: 'get_weather',
        args: {},
        expectedSchemaName: 'weather-response',
      };

      const result = await expectation(mockContext, evalCase, {
        city: 'London',
        temperature: 20,
      });

      expect(result.pass).toBe(true);
      expect(result.details).toContain('conforms to schema');
    });

    it('should fail when response does not conform to schema', async () => {
      const WeatherSchema = z.object({
        city: z.string(),
        temperature: z.number(),
      });

      const dataset: EvalDataset = {
        name: 'test',
        cases: [],
        schemas: {
          'weather-response': WeatherSchema,
        },
      };

      const expectation = createSchemaExpectation(dataset);
      const evalCase: EvalCase = {
        id: 'test-1',
        toolName: 'get_weather',
        args: {},
        expectedSchemaName: 'weather-response',
      };

      const result = await expectation(mockContext, evalCase, {
        city: 'London',
        // missing temperature
      });

      expect(result.pass).toBe(false);
      expect(result.details).toContain('Schema validation failed');
      expect(result.details).toContain('temperature');
    });

    it('should skip when expectedSchemaName is not set', async () => {
      const dataset: EvalDataset = {
        name: 'test',
        cases: [],
      };

      const expectation = createSchemaExpectation(dataset);
      const evalCase: EvalCase = {
        id: 'test-1',
        toolName: 'test',
        args: {},
      };

      const result = await expectation(mockContext, evalCase, {
        anything: 'goes',
      });

      expect(result.pass).toBe(true);
      expect(result.details).toContain('skipping');
    });

    it('should fail when schema is not found', async () => {
      const dataset: EvalDataset = {
        name: 'test',
        cases: [],
        schemas: {},
      };

      const expectation = createSchemaExpectation(dataset);
      const evalCase: EvalCase = {
        id: 'test-1',
        toolName: 'test',
        args: {},
        expectedSchemaName: 'nonexistent-schema',
      };

      const result = await expectation(mockContext, evalCase, {});

      expect(result.pass).toBe(false);
      expect(result.details).toContain('not found');
    });

    it('should validate nested objects', async () => {
      const UserSchema = z.object({
        name: z.string(),
        profile: z.object({
          age: z.number(),
          email: z.string().email(),
        }),
      });

      const dataset: EvalDataset = {
        name: 'test',
        cases: [],
        schemas: {
          'user-schema': UserSchema,
        },
      };

      const expectation = createSchemaExpectation(dataset);
      const evalCase: EvalCase = {
        id: 'test-1',
        toolName: 'get_user',
        args: {},
        expectedSchemaName: 'user-schema',
      };

      const result = await expectation(mockContext, evalCase, {
        name: 'John',
        profile: {
          age: 30,
          email: 'john@example.com',
        },
      });

      expect(result.pass).toBe(true);
    });

    it('should fail with detailed error for nested schema violations', async () => {
      const UserSchema = z.object({
        name: z.string(),
        profile: z.object({
          age: z.number(),
          email: z.string().email(),
        }),
      });

      const dataset: EvalDataset = {
        name: 'test',
        cases: [],
        schemas: {
          'user-schema': UserSchema,
        },
      };

      const expectation = createSchemaExpectation(dataset);
      const evalCase: EvalCase = {
        id: 'test-1',
        toolName: 'get_user',
        args: {},
        expectedSchemaName: 'user-schema',
      };

      const result = await expectation(mockContext, evalCase, {
        name: 'John',
        profile: {
          age: 'thirty', // wrong type
          email: 'not-an-email',
        },
      });

      expect(result.pass).toBe(false);
      expect(result.details).toContain('profile.age');
      expect(result.details).toContain('profile.email');
    });

    it('should validate arrays', async () => {
      const ResultSchema = z.object({
        items: z.array(z.string()),
      });

      const dataset: EvalDataset = {
        name: 'test',
        cases: [],
        schemas: {
          'result-schema': ResultSchema,
        },
      };

      const expectation = createSchemaExpectation(dataset);
      const evalCase: EvalCase = {
        id: 'test-1',
        toolName: 'search',
        args: {},
        expectedSchemaName: 'result-schema',
      };

      const result = await expectation(mockContext, evalCase, {
        items: ['one', 'two', 'three'],
      });

      expect(result.pass).toBe(true);
    });

    it('should validate optional fields', async () => {
      const ConfigSchema = z.object({
        required: z.string(),
        optional: z.string().optional(),
      });

      const dataset: EvalDataset = {
        name: 'test',
        cases: [],
        schemas: {
          'config-schema': ConfigSchema,
        },
      };

      const expectation = createSchemaExpectation(dataset);
      const evalCase: EvalCase = {
        id: 'test-1',
        toolName: 'get_config',
        args: {},
        expectedSchemaName: 'config-schema',
      };

      // With optional field
      const result1 = await expectation(mockContext, evalCase, {
        required: 'value',
        optional: 'optional value',
      });
      expect(result1.pass).toBe(true);

      // Without optional field
      const result2 = await expectation(mockContext, evalCase, {
        required: 'value',
      });
      expect(result2.pass).toBe(true);
    });

    it('should handle union types', async () => {
      const UnionSchema = z.object({
        value: z.union([z.string(), z.number()]),
      });

      const dataset: EvalDataset = {
        name: 'test',
        cases: [],
        schemas: {
          'union-schema': UnionSchema,
        },
      };

      const expectation = createSchemaExpectation(dataset);
      const evalCase: EvalCase = {
        id: 'test-1',
        toolName: 'test',
        args: {},
        expectedSchemaName: 'union-schema',
      };

      const result1 = await expectation(mockContext, evalCase, {
        value: 'string value',
      });
      expect(result1.pass).toBe(true);

      const result2 = await expectation(mockContext, evalCase, {
        value: 42,
      });
      expect(result2.pass).toBe(true);

      const result3 = await expectation(mockContext, evalCase, {
        value: true, // not in union
      });
      expect(result3.pass).toBe(false);
    });
  });
});
