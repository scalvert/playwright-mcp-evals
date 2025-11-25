import { describe, it, expect } from 'vitest';
import {
  validateEvalCase,
  validateEvalDataset,
  type EvalCase,
  type SerializedEvalDataset,
} from './datasetTypes.js';
import { ZodError } from 'zod';

describe('datasetTypes', () => {
  describe('validateEvalCase', () => {
    it('should validate minimal eval case', () => {
      const evalCase = {
        id: 'test-1',
        toolName: 'get_weather',
        args: { city: 'London' },
      };

      const result = validateEvalCase(evalCase);

      expect(result).toEqual(evalCase);
    });

    it('should validate eval case with all fields', () => {
      const evalCase: EvalCase = {
        id: 'test-1',
        description: 'Get weather for London',
        toolName: 'get_weather',
        args: { city: 'London' },
        expectedExact: { temperature: 20 },
        expectedSchemaName: 'weather-response',
        judgeConfigId: 'weather-judge',
        metadata: { priority: 'high' },
      };

      const result = validateEvalCase(evalCase);

      expect(result).toEqual(evalCase);
    });

    it('should reject eval case without id', () => {
      const evalCase = {
        toolName: 'get_weather',
        args: {},
      };

      expect(() => validateEvalCase(evalCase)).toThrow(ZodError);
    });

    it('should reject eval case with empty id', () => {
      const evalCase = {
        id: '',
        toolName: 'get_weather',
        args: {},
      };

      expect(() => validateEvalCase(evalCase)).toThrow(ZodError);
    });

    it('should accept eval case without toolName (for llm_host mode)', () => {
      const evalCase = {
        id: 'test-1',
        mode: 'llm_host' as const,
        scenario: 'Get the weather for London',
      };

      expect(() => validateEvalCase(evalCase)).not.toThrow();
    });

    it('should reject eval case with empty toolName', () => {
      const evalCase = {
        id: 'test-1',
        toolName: '',
        args: {},
      };

      expect(() => validateEvalCase(evalCase)).toThrow(ZodError);
    });

    it('should accept eval case without args (for llm_host mode)', () => {
      const evalCase = {
        id: 'test-1',
        mode: 'llm_host' as const,
        scenario: 'Get the weather for London',
      };

      expect(() => validateEvalCase(evalCase)).not.toThrow();
    });

    it('should accept eval case with complex args', () => {
      const evalCase = {
        id: 'test-1',
        toolName: 'search',
        args: {
          query: 'test',
          filters: { type: 'document', date: '2024-01-01' },
          limit: 10,
        },
      };

      const result = validateEvalCase(evalCase);

      expect(result.args).toEqual(evalCase.args);
    });
  });

  describe('validateEvalDataset', () => {
    it('should validate minimal dataset', () => {
      const dataset: SerializedEvalDataset = {
        name: 'test-dataset',
        cases: [
          {
            id: 'case-1',
            toolName: 'get_weather',
            args: {},
          },
        ],
      };

      const result = validateEvalDataset(dataset);

      expect(result).toEqual(dataset);
    });

    it('should validate dataset with all fields', () => {
      const dataset: SerializedEvalDataset = {
        name: 'test-dataset',
        description: 'Test dataset for weather tools',
        cases: [
          {
            id: 'case-1',
            toolName: 'get_weather',
            args: { city: 'London' },
          },
          {
            id: 'case-2',
            toolName: 'get_forecast',
            args: { city: 'Paris', days: 7 },
          },
        ],
        metadata: {
          version: '1.0',
          author: 'test',
        },
      };

      const result = validateEvalDataset(dataset);

      expect(result).toEqual(dataset);
    });

    it('should reject dataset without name', () => {
      const dataset = {
        cases: [
          {
            id: 'case-1',
            toolName: 'test',
            args: {},
          },
        ],
      };

      expect(() => validateEvalDataset(dataset)).toThrow(ZodError);
    });

    it('should reject dataset with empty name', () => {
      const dataset = {
        name: '',
        cases: [
          {
            id: 'case-1',
            toolName: 'test',
            args: {},
          },
        ],
      };

      expect(() => validateEvalDataset(dataset)).toThrow(ZodError);
    });

    it('should reject dataset without cases', () => {
      const dataset = {
        name: 'test-dataset',
      };

      expect(() => validateEvalDataset(dataset)).toThrow(ZodError);
    });

    it('should reject dataset with empty cases array', () => {
      const dataset = {
        name: 'test-dataset',
        cases: [],
      };

      expect(() => validateEvalDataset(dataset)).toThrow(ZodError);
    });

    it('should reject dataset with invalid case', () => {
      const dataset = {
        name: 'test-dataset',
        cases: [
          {
            // missing id - this is always required
            toolName: 'get_weather',
            args: {},
          },
        ],
      };

      expect(() => validateEvalDataset(dataset)).toThrow(ZodError);
    });

    it('should validate dataset with multiple cases', () => {
      const dataset: SerializedEvalDataset = {
        name: 'test-dataset',
        cases: Array.from({ length: 10 }, (_, i) => ({
          id: `case-${i}`,
          toolName: 'test',
          args: { index: i },
        })),
      };

      const result = validateEvalDataset(dataset);

      expect(result.cases).toHaveLength(10);
    });
  });
});
