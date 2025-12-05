import type { EvalCase, SnapshotSanitizer } from '../datasetTypes.js';
import type {
  EvalExpectation,
  EvalExpectationResult,
  EvalExpectationContext,
} from '../evalRunner.js';

/**
 * Built-in regex patterns for common variable data
 */
const BUILT_IN_PATTERNS: Record<string, { pattern: RegExp; replacement: string }> = {
  // Unix timestamps (milliseconds: 13 digits, seconds: 10 digits)
  timestamp: {
    pattern: /\b\d{10,13}\b/g,
    replacement: '[TIMESTAMP]',
  },
  // UUIDs (v1-v5, any case)
  uuid: {
    pattern: /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
    replacement: '[UUID]',
  },
  // ISO 8601 date strings (with optional time and timezone)
  'iso-date': {
    pattern: /\b\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:?\d{2})?)?\b/g,
    replacement: '[ISO_DATE]',
  },
  // MongoDB ObjectIds (24 hex characters)
  objectId: {
    pattern: /\b[0-9a-f]{24}\b/gi,
    replacement: '[OBJECT_ID]',
  },
  // JWT tokens (three base64url parts separated by dots)
  jwt: {
    pattern: /\beyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\b/g,
    replacement: '[JWT]',
  },
};

/**
 * Type guard for regex sanitizer
 */
function isRegexSanitizer(
  sanitizer: SnapshotSanitizer
): sanitizer is { pattern: string; replacement?: string } {
  return typeof sanitizer === 'object' && 'pattern' in sanitizer;
}

/**
 * Type guard for field removal sanitizer
 */
function isFieldRemovalSanitizer(
  sanitizer: SnapshotSanitizer
): sanitizer is { remove: string[] } {
  return typeof sanitizer === 'object' && 'remove' in sanitizer;
}

/**
 * Removes a field from an object using dot notation path
 */
function removeField(obj: Record<string, unknown>, path: string): void {
  const parts = path.split('.');
  if (parts.length === 0) {
    return;
  }

  let current: unknown = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (part === undefined || current === null || typeof current !== 'object') {
      return;
    }
    current = (current as Record<string, unknown>)[part];
  }

  const lastPart = parts[parts.length - 1];
  if (lastPart !== undefined && current !== null && typeof current === 'object') {
    delete (current as Record<string, unknown>)[lastPart];
  }
}

/**
 * Deep clone an object for safe mutation
 */
function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) => deepClone(item)) as T;
  }
  const cloned: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>)) {
    cloned[key] = deepClone((value as Record<string, unknown>)[key]);
  }
  return cloned as T;
}

/**
 * Apply sanitizers to a string value
 */
function sanitizeString(value: string, sanitizers: SnapshotSanitizer[]): string {
  let result = value;

  for (const sanitizer of sanitizers) {
    if (typeof sanitizer === 'string') {
      // Built-in sanitizer
      const builtin = BUILT_IN_PATTERNS[sanitizer];
      if (builtin) {
        result = result.replace(builtin.pattern, builtin.replacement);
      }
    } else if (isRegexSanitizer(sanitizer)) {
      // Custom regex sanitizer
      const pattern = new RegExp(sanitizer.pattern, 'g');
      result = result.replace(pattern, sanitizer.replacement ?? '[SANITIZED]');
    }
    // Field removal doesn't apply to strings
  }

  return result;
}

/**
 * Apply sanitizers to any value (recursively for objects/arrays)
 */
function applySanitizers(value: unknown, sanitizers: SnapshotSanitizer[]): unknown {
  if (sanitizers.length === 0) {
    return value;
  }

  // Handle strings
  if (typeof value === 'string') {
    return sanitizeString(value, sanitizers);
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map((item) => applySanitizers(item, sanitizers));
  }

  // Handle objects
  if (value !== null && typeof value === 'object') {
    // Clone to avoid mutating original
    const cloned = deepClone(value as Record<string, unknown>);

    // Apply field removal sanitizers
    for (const sanitizer of sanitizers) {
      if (isFieldRemovalSanitizer(sanitizer)) {
        for (const field of sanitizer.remove) {
          removeField(cloned, field);
        }
      }
    }

    // Recursively sanitize remaining values
    for (const key of Object.keys(cloned)) {
      cloned[key] = applySanitizers(cloned[key], sanitizers);
    }

    return cloned;
  }

  // Primitives (numbers, booleans, null, undefined)
  return value;
}

/**
 * Creates a snapshot expectation using Playwright's snapshot testing
 *
 * Validates that the tool response matches a stored snapshot.
 * Uses Playwright's expect().toMatchSnapshot() functionality.
 *
 * **When to use snapshot testing:**
 * - Deterministic tool responses (help text, configuration, schema discovery)
 * - Mocked/stubbed servers in CI environments
 * - Regression testing when you control the server data
 * - "Golden master" testing to detect any changes
 *
 * **When NOT to use snapshot testing:**
 * - Live data that changes (weather, stock prices, timestamps)
 * - Responses with random IDs, session tokens, or timestamps
 * - Non-deterministic ordering (use schema validation instead)
 *
 * **Sanitizers:** Use `snapshotSanitizers` to normalize variable content:
 * - Built-in: 'timestamp', 'uuid', 'iso-date', 'objectId', 'jwt'
 * - Custom regex: `{ pattern: "token_\\w+", replacement: "[TOKEN]" }`
 * - Field removal: `{ remove: ["createdAt", "session.id"] }`
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
 *   { mcp, testInfo, expect }  // testInfo and expect are required
 * );
 * ```
 *
 * @example
 * ```json
 * // In eval-dataset.json - deterministic response
 * {
 *   "id": "help-command",
 *   "toolName": "help",
 *   "args": {},
 *   "expectedSnapshot": "help-output"
 * }
 * ```
 *
 * @example
 * ```json
 * // In eval-dataset.json - with sanitizers for variable data
 * {
 *   "id": "get-user",
 *   "toolName": "get_user",
 *   "args": { "id": "123" },
 *   "expectedSnapshot": "user-profile",
 *   "snapshotSanitizers": [
 *     "uuid",
 *     "iso-date",
 *     { "remove": ["lastLoginAt"] }
 *   ]
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
        typeof (response as { content: unknown }).content === 'string'
      ) {
        normalizedResponse = (response as { content: string }).content;
      }
      // If response is an array with text content, extract the text
      else if (Array.isArray(response) && response.length > 0) {
        // MCP format: [{ type: "text", text: "content" }]
        const textContent = (response as Array<{ type?: string; text?: string }>)
          .filter((item) => item?.type === 'text')
          .map((item) => item.text ?? '')
          .join('\n');

        if (textContent) {
          normalizedResponse = textContent;
        }
      }

      // Apply sanitizers if configured
      if (evalCase.snapshotSanitizers && evalCase.snapshotSanitizers.length > 0) {
        normalizedResponse = applySanitizers(
          normalizedResponse,
          evalCase.snapshotSanitizers
        );
      }

      // Use Playwright's native snapshot testing
      // eslint-disable-next-line @typescript-eslint/await-thenable
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

/**
 * Export sanitizer utilities for advanced use cases
 */
export { applySanitizers, BUILT_IN_PATTERNS };
