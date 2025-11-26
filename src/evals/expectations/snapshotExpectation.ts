import type { EvalCase } from '../datasetTypes.js';
import type {
  EvalExpectation,
  EvalExpectationResult,
  EvalExpectationContext,
} from '../evalRunner.js';

/**
 * Creates a snapshot expectation using Playwright's snapshot testing
 *
 * Validates that the tool response matches a stored snapshot
 * Uses Playwright's expect().toMatchSnapshot() functionality
 *
 * **Requirements:**
 * - Must be used within a Playwright test context
 * - Requires testInfo to be passed in context
 * - Use --update-snapshots flag to update snapshots
 *
 * @returns Expectation function
 *
 * @example
 * ```typescript
 * // In test file
 * await runEvalDataset(
 *   {
 *     dataset,
 *     expectations: {
 *       snapshot: createSnapshotExpectation(),
 *     },
 *   },
 *   { mcp, testInfo }  // testInfo is required for snapshots
 * );
 * ```
 *
 * @example
 * ```json
 * // In eval-dataset.json
 * {
 *   "id": "snapshot-readme-content",
 *   "toolName": "read_file",
 *   "args": { "path": "readme.txt" },
 *   "expectedSnapshot": "readme-content"
 * }
 * ```
 */
export function createSnapshotExpectation(): EvalExpectation {
  return async (
    context: EvalExpectationContext,
    evalCase: EvalCase,
    response: unknown
  ): Promise<EvalExpectationResult> => {
    // Skip if no snapshot name is defined
    if (!evalCase.expectedSnapshot) {
      return {
        pass: true,
        details: 'No expectedSnapshot defined, skipping',
      };
    }

    // Verify context has required dependencies
    if (!context.expect) {
      return {
        pass: false,
        details:
          'Snapshot testing requires expect function in context. Pass expect when calling runEvalDataset(): { mcp, testInfo, expect }',
      };
    }

    try {
      // Normalize the response for snapshot comparison
      // Handle MCP response format (array of content objects or structured content)
      let normalizedResponse: unknown = response;

      // Handle structuredContent format: { content: "text" }
      if (
        typeof response === 'object' &&
        response !== null &&
        'content' in response &&
        typeof (response as any).content === 'string'
      ) {
        normalizedResponse = (response as { content: string }).content;
      }
      // If response is an array with text content, extract the text
      else if (Array.isArray(response) && response.length > 0) {
        // MCP format: [{ type: "text", text: "content" }]
        const textContent = response
          .filter((item: any) => item?.type === 'text')
          .map((item: any) => item.text)
          .join('\n');

        if (textContent) {
          normalizedResponse = textContent;
        }
      }

      // Use Playwright's native snapshot testing
      await context.expect(normalizedResponse).toMatchSnapshot(
        evalCase.expectedSnapshot
      );

      return {
        pass: true,
        details: `Response matches snapshot "${evalCase.expectedSnapshot}"`,
      };
    } catch (error) {
      // Snapshot mismatch or other error
      if (error instanceof Error) {
        return {
          pass: false,
          details: error.message,
        };
      }

      return {
        pass: false,
        details: `Snapshot expectation failed: ${String(error)}`,
      };
    }
  };
}
