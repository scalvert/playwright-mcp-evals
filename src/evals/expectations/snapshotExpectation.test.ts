import { describe, it, expect, vi } from 'vitest';
import {
  createSnapshotExpectation,
  applySanitizers,
  BUILT_IN_PATTERNS,
} from './snapshotExpectation.js';
import type { EvalCase } from '../datasetTypes.js';
import type { EvalExpectationContext } from '../evalRunner.js';
import type { MCPFixtureApi } from '../../mcp/fixtures/mcpFixture.js';

function createMockMCP(): MCPFixtureApi {
  return {
    client: {} as MCPFixtureApi['client'],
    getServerInfo: vi.fn(),
    listTools: vi.fn(),
    callTool: vi.fn(),
  };
}

function createContext(options: {
  expectFn?: (value: unknown) => { toMatchSnapshot: (name: string) => Promise<void> };
}): EvalExpectationContext {
  return {
    mcp: createMockMCP(),
    expect: options.expectFn as unknown as EvalExpectationContext['expect'],
  };
}

function createEvalCase(overrides: Partial<EvalCase> = {}): EvalCase {
  return {
    id: 'test-case',
    toolName: 'test-tool',
    args: {},
    ...overrides,
  };
}

describe('createSnapshotExpectation', () => {
  describe('when no expectedSnapshot defined', () => {
    it('should skip and return pass true', async () => {
      const expectation = createSnapshotExpectation();
      const context = createContext({});
      const evalCase = createEvalCase({ expectedSnapshot: undefined });

      const result = await expectation(context, evalCase, 'response');

      expect(result.pass).toBe(true);
      expect(result.details).toContain('No expectedSnapshot defined');
    });
  });

  describe('when expect function is missing', () => {
    it('should fail with helpful message', async () => {
      const expectation = createSnapshotExpectation();
      const context = createContext({ expectFn: undefined });
      const evalCase = createEvalCase({ expectedSnapshot: 'my-snapshot' });

      const result = await expectation(context, evalCase, 'response');

      expect(result.pass).toBe(false);
      expect(result.details).toContain('expect function in context');
    });
  });

  describe('snapshot matching', () => {
    it('should pass when snapshot matches', async () => {
      const mockToMatchSnapshot = vi.fn().mockResolvedValue(undefined);
      const mockExpect = vi.fn().mockReturnValue({
        toMatchSnapshot: mockToMatchSnapshot,
      });

      const expectation = createSnapshotExpectation();
      const context = createContext({ expectFn: mockExpect });
      const evalCase = createEvalCase({ expectedSnapshot: 'my-snapshot' });

      const result = await expectation(context, evalCase, 'response data');

      expect(result.pass).toBe(true);
      expect(result.details).toContain('matches snapshot');
      expect(result.details).toContain('my-snapshot');
      expect(mockExpect).toHaveBeenCalledWith('response data');
      expect(mockToMatchSnapshot).toHaveBeenCalledWith('my-snapshot');
    });

    it('should fail when snapshot mismatches', async () => {
      const mockToMatchSnapshot = vi.fn().mockRejectedValue(
        new Error('Snapshot mismatch: expected "abc" but got "xyz"')
      );
      const mockExpect = vi.fn().mockReturnValue({
        toMatchSnapshot: mockToMatchSnapshot,
      });

      const expectation = createSnapshotExpectation();
      const context = createContext({ expectFn: mockExpect });
      const evalCase = createEvalCase({ expectedSnapshot: 'my-snapshot' });

      const result = await expectation(context, evalCase, 'response');

      expect(result.pass).toBe(false);
      expect(result.details).toContain('Snapshot mismatch');
    });

    it('should handle non-Error throws', async () => {
      const mockToMatchSnapshot = vi.fn().mockRejectedValue('string error');
      const mockExpect = vi.fn().mockReturnValue({
        toMatchSnapshot: mockToMatchSnapshot,
      });

      const expectation = createSnapshotExpectation();
      const context = createContext({ expectFn: mockExpect });
      const evalCase = createEvalCase({ expectedSnapshot: 'my-snapshot' });

      const result = await expectation(context, evalCase, 'response');

      expect(result.pass).toBe(false);
      expect(result.details).toContain('Snapshot expectation failed');
    });
  });

  describe('response normalization', () => {
    it('should extract content from structuredContent format', async () => {
      const mockToMatchSnapshot = vi.fn().mockResolvedValue(undefined);
      const mockExpect = vi.fn().mockReturnValue({
        toMatchSnapshot: mockToMatchSnapshot,
      });

      const expectation = createSnapshotExpectation();
      const context = createContext({ expectFn: mockExpect });
      const evalCase = createEvalCase({ expectedSnapshot: 'test-snapshot' });

      const response = { content: 'extracted text content' };
      await expectation(context, evalCase, response);

      expect(mockExpect).toHaveBeenCalledWith('extracted text content');
    });

    it('should extract text from MCP array format', async () => {
      const mockToMatchSnapshot = vi.fn().mockResolvedValue(undefined);
      const mockExpect = vi.fn().mockReturnValue({
        toMatchSnapshot: mockToMatchSnapshot,
      });

      const expectation = createSnapshotExpectation();
      const context = createContext({ expectFn: mockExpect });
      const evalCase = createEvalCase({ expectedSnapshot: 'test-snapshot' });

      const response = [
        { type: 'text', text: 'First line' },
        { type: 'text', text: 'Second line' },
      ];
      await expectation(context, evalCase, response);

      expect(mockExpect).toHaveBeenCalledWith('First line\nSecond line');
    });

    it('should filter out non-text content blocks', async () => {
      const mockToMatchSnapshot = vi.fn().mockResolvedValue(undefined);
      const mockExpect = vi.fn().mockReturnValue({
        toMatchSnapshot: mockToMatchSnapshot,
      });

      const expectation = createSnapshotExpectation();
      const context = createContext({ expectFn: mockExpect });
      const evalCase = createEvalCase({ expectedSnapshot: 'test-snapshot' });

      const response = [
        { type: 'text', text: 'Hello' },
        { type: 'image', data: 'base64...' },
        { type: 'text', text: 'World' },
      ];
      await expectation(context, evalCase, response);

      expect(mockExpect).toHaveBeenCalledWith('Hello\nWorld');
    });

    it('should pass through raw response when no text extracted from array', async () => {
      const mockToMatchSnapshot = vi.fn().mockResolvedValue(undefined);
      const mockExpect = vi.fn().mockReturnValue({
        toMatchSnapshot: mockToMatchSnapshot,
      });

      const expectation = createSnapshotExpectation();
      const context = createContext({ expectFn: mockExpect });
      const evalCase = createEvalCase({ expectedSnapshot: 'test-snapshot' });

      const response = [{ type: 'image', data: 'base64...' }];
      await expectation(context, evalCase, response);

      // Original array is passed through since no text content found
      expect(mockExpect).toHaveBeenCalledWith(response);
    });

    it('should handle empty array', async () => {
      const mockToMatchSnapshot = vi.fn().mockResolvedValue(undefined);
      const mockExpect = vi.fn().mockReturnValue({
        toMatchSnapshot: mockToMatchSnapshot,
      });

      const expectation = createSnapshotExpectation();
      const context = createContext({ expectFn: mockExpect });
      const evalCase = createEvalCase({ expectedSnapshot: 'test-snapshot' });

      const response: unknown[] = [];
      await expectation(context, evalCase, response);

      expect(mockExpect).toHaveBeenCalledWith(response);
    });

    it('should pass primitives through unchanged', async () => {
      const mockToMatchSnapshot = vi.fn().mockResolvedValue(undefined);
      const mockExpect = vi.fn().mockReturnValue({
        toMatchSnapshot: mockToMatchSnapshot,
      });

      const expectation = createSnapshotExpectation();
      const context = createContext({ expectFn: mockExpect });
      const evalCase = createEvalCase({ expectedSnapshot: 'test-snapshot' });

      await expectation(context, evalCase, 'plain string');
      expect(mockExpect).toHaveBeenCalledWith('plain string');

      await expectation(context, evalCase, 42);
      expect(mockExpect).toHaveBeenCalledWith(42);

      await expectation(context, evalCase, null);
      expect(mockExpect).toHaveBeenCalledWith(null);
    });
  });

  describe('sanitizers', () => {
    it('should apply sanitizers before snapshot comparison', async () => {
      const mockToMatchSnapshot = vi.fn().mockResolvedValue(undefined);
      const mockExpect = vi.fn().mockReturnValue({
        toMatchSnapshot: mockToMatchSnapshot,
      });

      const expectation = createSnapshotExpectation();
      const context = createContext({ expectFn: mockExpect });
      const evalCase = createEvalCase({
        expectedSnapshot: 'test-snapshot',
        snapshotSanitizers: ['uuid'],
      });

      const response = 'User ID: 550e8400-e29b-41d4-a716-446655440000';
      await expectation(context, evalCase, response);

      expect(mockExpect).toHaveBeenCalledWith('User ID: [UUID]');
    });

    it('should apply multiple sanitizers in order', async () => {
      const mockToMatchSnapshot = vi.fn().mockResolvedValue(undefined);
      const mockExpect = vi.fn().mockReturnValue({
        toMatchSnapshot: mockToMatchSnapshot,
      });

      const expectation = createSnapshotExpectation();
      const context = createContext({ expectFn: mockExpect });
      const evalCase = createEvalCase({
        expectedSnapshot: 'test-snapshot',
        snapshotSanitizers: ['uuid', 'iso-date'],
      });

      const response =
        'ID: 550e8400-e29b-41d4-a716-446655440000, Date: 2025-01-15T10:30:00Z';
      await expectation(context, evalCase, response);

      expect(mockExpect).toHaveBeenCalledWith('ID: [UUID], Date: [ISO_DATE]');
    });

    it('should apply custom regex sanitizers', async () => {
      const mockToMatchSnapshot = vi.fn().mockResolvedValue(undefined);
      const mockExpect = vi.fn().mockReturnValue({
        toMatchSnapshot: mockToMatchSnapshot,
      });

      const expectation = createSnapshotExpectation();
      const context = createContext({ expectFn: mockExpect });
      const evalCase = createEvalCase({
        expectedSnapshot: 'test-snapshot',
        snapshotSanitizers: [{ pattern: 'token_[a-zA-Z0-9]+', replacement: '[TOKEN]' }],
      });

      const response = 'Session: token_abc123XYZ';
      await expectation(context, evalCase, response);

      expect(mockExpect).toHaveBeenCalledWith('Session: [TOKEN]');
    });

    it('should use default replacement for custom regex without replacement', async () => {
      const mockToMatchSnapshot = vi.fn().mockResolvedValue(undefined);
      const mockExpect = vi.fn().mockReturnValue({
        toMatchSnapshot: mockToMatchSnapshot,
      });

      const expectation = createSnapshotExpectation();
      const context = createContext({ expectFn: mockExpect });
      const evalCase = createEvalCase({
        expectedSnapshot: 'test-snapshot',
        snapshotSanitizers: [{ pattern: 'secret_\\d+' }],
      });

      const response = 'Code: secret_12345';
      await expectation(context, evalCase, response);

      expect(mockExpect).toHaveBeenCalledWith('Code: [SANITIZED]');
    });

    it('should apply field removal sanitizers to objects', async () => {
      const mockToMatchSnapshot = vi.fn().mockResolvedValue(undefined);
      const mockExpect = vi.fn().mockReturnValue({
        toMatchSnapshot: mockToMatchSnapshot,
      });

      const expectation = createSnapshotExpectation();
      const context = createContext({ expectFn: mockExpect });
      const evalCase = createEvalCase({
        expectedSnapshot: 'test-snapshot',
        snapshotSanitizers: [{ remove: ['timestamp', 'requestId'] }],
      });

      const response = {
        name: 'Alice',
        timestamp: 1704067200000,
        requestId: 'req-123',
        data: { value: 42 },
      };
      await expectation(context, evalCase, response);

      expect(mockExpect).toHaveBeenCalledWith({
        name: 'Alice',
        data: { value: 42 },
      });
    });

    it('should apply field removal with dot notation for nested fields', async () => {
      const mockToMatchSnapshot = vi.fn().mockResolvedValue(undefined);
      const mockExpect = vi.fn().mockReturnValue({
        toMatchSnapshot: mockToMatchSnapshot,
      });

      const expectation = createSnapshotExpectation();
      const context = createContext({ expectFn: mockExpect });
      const evalCase = createEvalCase({
        expectedSnapshot: 'test-snapshot',
        snapshotSanitizers: [{ remove: ['meta.createdAt', 'meta.sessionId'] }],
      });

      const response = {
        name: 'Test',
        meta: {
          createdAt: '2025-01-15',
          sessionId: 'sess-abc',
          version: 1,
        },
      };
      await expectation(context, evalCase, response);

      expect(mockExpect).toHaveBeenCalledWith({
        name: 'Test',
        meta: {
          version: 1,
        },
      });
    });

    it('should sanitize strings within objects recursively', async () => {
      const mockToMatchSnapshot = vi.fn().mockResolvedValue(undefined);
      const mockExpect = vi.fn().mockReturnValue({
        toMatchSnapshot: mockToMatchSnapshot,
      });

      const expectation = createSnapshotExpectation();
      const context = createContext({ expectFn: mockExpect });
      const evalCase = createEvalCase({
        expectedSnapshot: 'test-snapshot',
        snapshotSanitizers: ['uuid'],
      });

      const response = {
        user: {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'Alice',
        },
      };
      await expectation(context, evalCase, response);

      expect(mockExpect).toHaveBeenCalledWith({
        user: {
          id: '[UUID]',
          name: 'Alice',
        },
      });
    });

    it('should sanitize strings within arrays', async () => {
      const mockToMatchSnapshot = vi.fn().mockResolvedValue(undefined);
      const mockExpect = vi.fn().mockReturnValue({
        toMatchSnapshot: mockToMatchSnapshot,
      });

      const expectation = createSnapshotExpectation();
      const context = createContext({ expectFn: mockExpect });
      const evalCase = createEvalCase({
        expectedSnapshot: 'test-snapshot',
        snapshotSanitizers: ['timestamp'],
      });

      const response = ['Created at 1704067200000', 'Updated at 1704153600000'];
      await expectation(context, evalCase, response);

      expect(mockExpect).toHaveBeenCalledWith([
        'Created at [TIMESTAMP]',
        'Updated at [TIMESTAMP]',
      ]);
    });
  });
});

describe('applySanitizers', () => {
  describe('built-in sanitizers', () => {
    it('should sanitize timestamps', () => {
      const result = applySanitizers('Time: 1704067200000 and 1704067200', [
        'timestamp',
      ]);
      expect(result).toBe('Time: [TIMESTAMP] and [TIMESTAMP]');
    });

    it('should sanitize UUIDs', () => {
      const result = applySanitizers(
        'ID: 550e8400-e29b-41d4-a716-446655440000',
        ['uuid']
      );
      expect(result).toBe('ID: [UUID]');
    });

    it('should sanitize UUIDs case-insensitively', () => {
      const result = applySanitizers(
        'ID: 550E8400-E29B-41D4-A716-446655440000',
        ['uuid']
      );
      expect(result).toBe('ID: [UUID]');
    });

    it('should sanitize ISO dates', () => {
      const result = applySanitizers('Date: 2025-01-15T10:30:00Z', ['iso-date']);
      expect(result).toBe('Date: [ISO_DATE]');
    });

    it('should sanitize ISO dates without time', () => {
      const result = applySanitizers('Date: 2025-01-15', ['iso-date']);
      expect(result).toBe('Date: [ISO_DATE]');
    });

    it('should sanitize ISO dates with timezone offset', () => {
      const result = applySanitizers('Date: 2025-01-15T10:30:00+05:30', [
        'iso-date',
      ]);
      expect(result).toBe('Date: [ISO_DATE]');
    });

    it('should sanitize MongoDB ObjectIds', () => {
      const result = applySanitizers('ID: 507f1f77bcf86cd799439011', [
        'objectId',
      ]);
      expect(result).toBe('ID: [OBJECT_ID]');
    });

    it('should sanitize JWT tokens', () => {
      const jwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      const result = applySanitizers(`Token: ${jwt}`, ['jwt']);
      expect(result).toBe('Token: [JWT]');
    });
  });

  describe('custom regex sanitizers', () => {
    it('should apply custom pattern with replacement', () => {
      const result = applySanitizers('Version: v1.2.3', [
        { pattern: 'v\\d+\\.\\d+\\.\\d+', replacement: '[VERSION]' },
      ]);
      expect(result).toBe('Version: [VERSION]');
    });

    it('should use default replacement when not specified', () => {
      const result = applySanitizers('API key: sk_live_abc123', [
        { pattern: 'sk_live_[a-zA-Z0-9]+' },
      ]);
      expect(result).toBe('API key: [SANITIZED]');
    });

    it('should apply pattern globally', () => {
      const result = applySanitizers('IDs: abc123, def456, ghi789', [
        { pattern: '[a-z]{3}\\d{3}', replacement: '[ID]' },
      ]);
      expect(result).toBe('IDs: [ID], [ID], [ID]');
    });
  });

  describe('field removal sanitizers', () => {
    it('should remove top-level fields', () => {
      const result = applySanitizers(
        { name: 'Alice', secret: 'password123' },
        [{ remove: ['secret'] }]
      );
      expect(result).toEqual({ name: 'Alice' });
    });

    it('should remove nested fields with dot notation', () => {
      const result = applySanitizers(
        { user: { name: 'Alice', token: 'abc123' } },
        [{ remove: ['user.token'] }]
      );
      expect(result).toEqual({ user: { name: 'Alice' } });
    });

    it('should handle non-existent fields gracefully', () => {
      const result = applySanitizers({ name: 'Alice' }, [
        { remove: ['nonexistent', 'also.missing'] },
      ]);
      expect(result).toEqual({ name: 'Alice' });
    });

    it('should not mutate original object', () => {
      const original = { name: 'Alice', secret: 'password' };
      applySanitizers(original, [{ remove: ['secret'] }]);
      expect(original).toEqual({ name: 'Alice', secret: 'password' });
    });
  });

  describe('combined sanitizers', () => {
    it('should apply multiple sanitizer types together', () => {
      const response = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        createdAt: '2025-01-15T10:30:00Z',
        token: 'session_abc123',
        secretKey: 'should-be-removed',
      };

      const result = applySanitizers(response, [
        'uuid',
        'iso-date',
        { pattern: 'session_[a-z0-9]+', replacement: '[SESSION]' },
        { remove: ['secretKey'] },
      ]);

      expect(result).toEqual({
        id: '[UUID]',
        createdAt: '[ISO_DATE]',
        token: '[SESSION]',
      });
    });
  });

  describe('edge cases', () => {
    it('should return primitives unchanged (except strings)', () => {
      expect(applySanitizers(42, ['uuid'])).toBe(42);
      expect(applySanitizers(true, ['uuid'])).toBe(true);
      expect(applySanitizers(null, ['uuid'])).toBe(null);
      expect(applySanitizers(undefined, ['uuid'])).toBe(undefined);
    });

    it('should handle empty sanitizers array', () => {
      const result = applySanitizers('unchanged', []);
      expect(result).toBe('unchanged');
    });

    it('should handle deeply nested objects', () => {
      const result = applySanitizers(
        {
          level1: {
            level2: {
              level3: {
                id: '550e8400-e29b-41d4-a716-446655440000',
              },
            },
          },
        },
        ['uuid']
      );
      expect(result).toEqual({
        level1: {
          level2: {
            level3: {
              id: '[UUID]',
            },
          },
        },
      });
    });

    it('should handle arrays of objects', () => {
      const result = applySanitizers(
        [
          { id: '550e8400-e29b-41d4-a716-446655440000' },
          { id: '6ba7b810-9dad-11d1-80b4-00c04fd430c8' },
        ],
        ['uuid']
      );
      expect(result).toEqual([{ id: '[UUID]' }, { id: '[UUID]' }]);
    });
  });
});

describe('BUILT_IN_PATTERNS', () => {
  it('should expose all documented built-in patterns', () => {
    expect(BUILT_IN_PATTERNS).toHaveProperty('timestamp');
    expect(BUILT_IN_PATTERNS).toHaveProperty('uuid');
    expect(BUILT_IN_PATTERNS).toHaveProperty('iso-date');
    expect(BUILT_IN_PATTERNS).toHaveProperty('objectId');
    expect(BUILT_IN_PATTERNS).toHaveProperty('jwt');
  });
});
