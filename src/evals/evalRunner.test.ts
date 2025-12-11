import { describe, it, expect, vi } from 'vitest';
import {
  runEvalCase,
  runEvalDataset,
  type EvalExpectation,
  type EvalExpectationContext,
} from './evalRunner.js';
import type { EvalCase, EvalDataset } from './datasetTypes.js';
import type { MCPFixtureApi } from '../mcp/fixtures/mcpFixture.js';

function createMockMCP(callToolResponse?: {
  content?: unknown;
  structuredContent?: unknown;
  isError?: boolean;
}): MCPFixtureApi {
  return {
    client: {} as MCPFixtureApi['client'],
    authType: 'none',
    project: 'test-project',
    getServerInfo: vi.fn().mockReturnValue({ name: 'test', version: '1.0.0' }),
    listTools: vi.fn().mockResolvedValue([]),
    callTool: vi.fn().mockResolvedValue({
      content: callToolResponse?.content ?? [
        { type: 'text', text: 'response' },
      ],
      structuredContent: callToolResponse?.structuredContent,
      isError: callToolResponse?.isError ?? false,
    }),
  };
}

function createContext(mcp?: MCPFixtureApi): EvalExpectationContext {
  return {
    mcp: mcp ?? createMockMCP(),
  };
}

function createEvalCase(overrides: Partial<EvalCase> = {}): EvalCase {
  return {
    id: 'test-case',
    toolName: 'test-tool',
    args: { input: 'test' },
    ...overrides,
  };
}

function createPassingExpectation(): EvalExpectation {
  return vi.fn().mockResolvedValue({ pass: true, details: 'Passed' });
}

function createFailingExpectation(details?: string): EvalExpectation {
  return vi
    .fn()
    .mockResolvedValue({ pass: false, details: details ?? 'Failed' });
}

describe('runEvalCase', () => {
  describe('direct mode', () => {
    it('should call tool and return result', async () => {
      const mcp = createMockMCP({ content: [{ type: 'text', text: 'hello' }] });
      const context = createContext(mcp);
      const evalCase = createEvalCase();

      const result = await runEvalCase(evalCase, {}, context);

      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mcp.callTool).toHaveBeenCalledWith('test-tool', { input: 'test' });
      expect(result.id).toBe('test-case');
      expect(result.toolName).toBe('test-tool');
      expect(result.mode).toBe('direct');
      expect(result.source).toBe('eval');
      expect(result.response).toBeDefined();
    });

    it('should use structuredContent when available', async () => {
      const mcp = createMockMCP({
        content: [{ type: 'text', text: 'fallback' }],
        structuredContent: { data: 'structured' },
      });
      const context = createContext(mcp);
      const evalCase = createEvalCase();

      const result = await runEvalCase(evalCase, {}, context);

      expect(result.response).toEqual({ data: 'structured' });
    });

    it('should pass when no expectations are provided', async () => {
      const context = createContext();
      const evalCase = createEvalCase();

      const result = await runEvalCase(evalCase, {}, context);

      expect(result.pass).toBe(true);
    });

    it('should pass when all expectations pass', async () => {
      const context = createContext();
      const evalCase = createEvalCase();

      const result = await runEvalCase(
        evalCase,
        {
          exact: createPassingExpectation(),
          schema: createPassingExpectation(),
        },
        context
      );

      expect(result.pass).toBe(true);
      expect(result.expectations.exact?.pass).toBe(true);
      expect(result.expectations.schema?.pass).toBe(true);
    });

    it('should fail when any expectation fails', async () => {
      const context = createContext();
      const evalCase = createEvalCase();

      const result = await runEvalCase(
        evalCase,
        {
          exact: createPassingExpectation(),
          schema: createFailingExpectation('Schema mismatch'),
        },
        context
      );

      expect(result.pass).toBe(false);
      expect(result.expectations.exact?.pass).toBe(true);
      expect(result.expectations.schema?.pass).toBe(false);
      expect(result.expectations.schema?.details).toBe('Schema mismatch');
    });

    it('should handle expectation errors', async () => {
      const context = createContext();
      const evalCase = createEvalCase();
      const throwingExpectation = vi.fn().mockRejectedValue(new Error('Boom'));

      const result = await runEvalCase(
        evalCase,
        { exact: throwingExpectation },
        context
      );

      expect(result.pass).toBe(false);
      expect(result.expectations.exact?.pass).toBe(false);
      expect(result.expectations.exact?.details).toContain('threw error');
      expect(result.expectations.exact?.details).toContain('Boom');
    });

    it('should fail when toolName is missing', async () => {
      const context = createContext();
      const evalCase = createEvalCase({ toolName: undefined });

      const result = await runEvalCase(evalCase, {}, context);

      expect(result.pass).toBe(false);
      expect(result.error).toContain('toolName is required');
    });

    it('should fail when args are missing', async () => {
      const context = createContext();
      const evalCase = createEvalCase({ args: undefined });

      const result = await runEvalCase(evalCase, {}, context);

      expect(result.pass).toBe(false);
      expect(result.error).toContain('args is required');
    });

    it('should track duration', async () => {
      const context = createContext();
      const evalCase = createEvalCase();

      const result = await runEvalCase(evalCase, {}, context);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should use provided datasetName', async () => {
      const context = createContext();
      const evalCase = createEvalCase();

      const result = await runEvalCase(evalCase, {}, context, {
        datasetName: 'my-dataset',
      });

      expect(result.datasetName).toBe('my-dataset');
    });

    it('should default datasetName to single-case', async () => {
      const context = createContext();
      const evalCase = createEvalCase();

      const result = await runEvalCase(evalCase, {}, context);

      expect(result.datasetName).toBe('single-case');
    });
  });

  describe('llm_host mode', () => {
    it('should fail when scenario is missing', async () => {
      const context = createContext();
      const evalCase = createEvalCase({
        mode: 'llm_host',
        scenario: undefined,
        llmHostConfig: { provider: 'openai', model: 'gpt-4' },
      });

      const result = await runEvalCase(evalCase, {}, context);

      expect(result.pass).toBe(false);
      expect(result.error).toContain('scenario is required');
    });

    it('should fail when llmHostConfig is missing', async () => {
      const context = createContext();
      const evalCase = createEvalCase({
        mode: 'llm_host',
        scenario: 'test scenario',
        llmHostConfig: undefined,
      });

      const result = await runEvalCase(evalCase, {}, context);

      expect(result.pass).toBe(false);
      expect(result.error).toContain('llmHostConfig is required');
    });
  });
});

describe('runEvalDataset', () => {
  function createDataset(cases: EvalCase[]): EvalDataset {
    return {
      name: 'test-dataset',
      cases,
    };
  }

  it('should run all cases in dataset', async () => {
    const context = createContext();
    const dataset = createDataset([
      createEvalCase({ id: 'case-1' }),
      createEvalCase({ id: 'case-2' }),
      createEvalCase({ id: 'case-3' }),
    ]);

    const result = await runEvalDataset({ dataset, expectations: {} }, context);

    expect(result.total).toBe(3);
    expect(result.caseResults).toHaveLength(3);
    expect(result.caseResults[0]!.id).toBe('case-1');
    expect(result.caseResults[1]!.id).toBe('case-2');
    expect(result.caseResults[2]!.id).toBe('case-3');
  });

  it('should count passed and failed cases', async () => {
    const context = createContext();
    const dataset = createDataset([
      createEvalCase({ id: 'case-1' }),
      createEvalCase({ id: 'case-2' }),
      createEvalCase({ id: 'case-3' }),
    ]);

    // First two pass, third fails
    const failOnThird: EvalExpectation = vi
      .fn()
      .mockImplementation((_: EvalExpectationContext, evalCase: EvalCase) =>
        Promise.resolve({
          pass: evalCase.id !== 'case-3',
          details: evalCase.id === 'case-3' ? 'Failed' : 'Passed',
        })
      );

    const result = await runEvalDataset(
      { dataset, expectations: { exact: failOnThird } },
      context
    );

    expect(result.passed).toBe(2);
    expect(result.failed).toBe(1);
  });

  it('should set datasetName on all results', async () => {
    const context = createContext();
    const dataset = createDataset([
      createEvalCase({ id: 'case-1' }),
      createEvalCase({ id: 'case-2' }),
    ]);
    dataset.name = 'my-dataset';

    const result = await runEvalDataset({ dataset, expectations: {} }, context);

    expect(result.caseResults[0]!.datasetName).toBe('my-dataset');
    expect(result.caseResults[1]!.datasetName).toBe('my-dataset');
  });

  it('should call onCaseComplete callback', async () => {
    const context = createContext();
    const dataset = createDataset([
      createEvalCase({ id: 'case-1' }),
      createEvalCase({ id: 'case-2' }),
    ]);
    const onCaseComplete = vi.fn();

    await runEvalDataset(
      { dataset, expectations: {}, onCaseComplete },
      context
    );

    expect(onCaseComplete).toHaveBeenCalledTimes(2);
    expect((onCaseComplete.mock.calls[0]![0] as EvalCase).id).toBe('case-1');
    expect((onCaseComplete.mock.calls[1]![0] as EvalCase).id).toBe('case-2');
  });

  it('should stop on failure when stopOnFailure is true', async () => {
    const context = createContext();
    const dataset = createDataset([
      createEvalCase({ id: 'case-1' }),
      createEvalCase({ id: 'case-2' }),
      createEvalCase({ id: 'case-3' }),
    ]);

    // Fail on case-2
    const failOnSecond: EvalExpectation = vi
      .fn()
      .mockImplementation((_: EvalExpectationContext, evalCase: EvalCase) =>
        Promise.resolve({
          pass: evalCase.id !== 'case-2',
          details: evalCase.id === 'case-2' ? 'Failed' : 'Passed',
        })
      );

    const result = await runEvalDataset(
      { dataset, expectations: { exact: failOnSecond }, stopOnFailure: true },
      context
    );

    expect(result.total).toBe(2); // Only ran 2 cases
    expect(result.caseResults).toHaveLength(2);
    expect(result.caseResults[0]!.id).toBe('case-1');
    expect(result.caseResults[1]!.id).toBe('case-2');
  });

  it('should continue on failure when stopOnFailure is false', async () => {
    const context = createContext();
    const dataset = createDataset([
      createEvalCase({ id: 'case-1' }),
      createEvalCase({ id: 'case-2' }),
      createEvalCase({ id: 'case-3' }),
    ]);

    // Fail on case-2
    const failOnSecond: EvalExpectation = vi
      .fn()
      .mockImplementation((_: EvalExpectationContext, evalCase: EvalCase) =>
        Promise.resolve({
          pass: evalCase.id !== 'case-2',
          details: evalCase.id === 'case-2' ? 'Failed' : 'Passed',
        })
      );

    const result = await runEvalDataset(
      { dataset, expectations: { exact: failOnSecond }, stopOnFailure: false },
      context
    );

    expect(result.total).toBe(3); // Ran all 3 cases
    expect(result.caseResults).toHaveLength(3);
  });

  it('should track total duration', async () => {
    const context = createContext();
    const dataset = createDataset([createEvalCase()]);

    const result = await runEvalDataset({ dataset, expectations: {} }, context);

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should attach results when testInfo is provided', async () => {
    const mockTestInfo = {
      attach: vi.fn().mockResolvedValue(undefined),
    };
    const context = createContext();
    context.testInfo =
      mockTestInfo as unknown as EvalExpectationContext['testInfo'];

    const dataset = createDataset([createEvalCase()]);

    await runEvalDataset({ dataset, expectations: {} }, context);

    expect(mockTestInfo.attach).toHaveBeenCalledWith('mcp-test-results', {
      contentType: 'application/json',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      body: expect.any(Buffer),
    });
  });

  it('should enrich context with judgeClient from options', async () => {
    const mockJudgeClient = { evaluate: vi.fn() };
    const judgeExpectation = vi
      .fn()
      .mockImplementation((ctx: EvalExpectationContext) => {
        // Verify context has the judge client
        return Promise.resolve({
          pass: ctx.judgeClient === mockJudgeClient,
          details: ctx.judgeClient ? 'Has judge' : 'No judge',
        });
      });

    const context = createContext();
    const dataset = createDataset([createEvalCase()]);

    const result = await runEvalDataset(
      {
        dataset,
        expectations: { judge: judgeExpectation },
        judgeClient:
          mockJudgeClient as unknown as EvalExpectationContext['judgeClient'],
      },
      context
    );

    expect(result.caseResults[0]!.expectations.judge?.pass).toBe(true);
  });
});

describe('expectation integration', () => {
  it('should pass context to expectations', async () => {
    const mcp = createMockMCP();
    const context = createContext(mcp);
    const expectation = vi.fn().mockResolvedValue({ pass: true });

    await runEvalCase(createEvalCase(), { exact: expectation }, context);

    expect(expectation).toHaveBeenCalledWith(
      expect.objectContaining({ mcp }),
      expect.any(Object),
      expect.anything()
    );
  });

  it('should pass evalCase to expectations', async () => {
    const context = createContext();
    const evalCase = createEvalCase({ id: 'my-case' });
    const expectation = vi.fn().mockResolvedValue({ pass: true });

    await runEvalCase(evalCase, { exact: expectation }, context);

    expect(expectation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: 'my-case' }),
      expect.anything()
    );
  });

  it('should pass response to expectations', async () => {
    const mcp = createMockMCP({ structuredContent: { key: 'value' } });
    const context = createContext(mcp);
    const expectation = vi.fn().mockResolvedValue({ pass: true });

    await runEvalCase(createEvalCase(), { exact: expectation }, context);

    expect(expectation).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { key: 'value' }
    );
  });

  it('should not run expectations when tool call errors', async () => {
    const mcp = createMockMCP();
    (mcp.callTool as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Tool failed')
    );

    const context = createContext(mcp);
    const expectation = vi.fn().mockResolvedValue({ pass: true });

    const result = await runEvalCase(
      createEvalCase(),
      { exact: expectation },
      context
    );

    expect(expectation).not.toHaveBeenCalled();
    expect(result.error).toContain('Tool failed');
    expect(result.pass).toBe(false);
  });
});
