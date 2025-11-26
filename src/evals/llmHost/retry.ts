/**
 * Retry utility with exponential backoff for LLM API calls
 */

/**
 * Options for retry behavior
 */
export interface RetryOptions {
  /**
   * Maximum number of attempts (including the first)
   * @default 3
   */
  maxAttempts?: number;

  /**
   * Base delay in milliseconds before first retry
   * @default 1000
   */
  baseDelayMs?: number;

  /**
   * Maximum delay in milliseconds
   * @default 30000
   */
  maxDelayMs?: number;

  /**
   * Function to determine if an error is retryable
   * @default Retries on 429, 500, 502, 503, 504 HTTP errors
   */
  isRetryable?: (error: unknown) => boolean;

  /**
   * Callback invoked before each retry
   */
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

/**
 * Default retry options
 */
const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> & { onRetry?: RetryOptions['onRetry'] } = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  isRetryable: isRetryableError,
};

/**
 * Executes a function with retry logic and exponential backoff
 *
 * @param fn - Async function to execute
 * @param options - Retry options
 * @returns Result of the function
 * @throws Last error if all retries fail
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => openai.chat.completions.create({ ... }),
 *   { maxAttempts: 3, baseDelayMs: 1000 }
 * );
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = DEFAULT_OPTIONS.maxAttempts,
    baseDelayMs = DEFAULT_OPTIONS.baseDelayMs,
    maxDelayMs = DEFAULT_OPTIONS.maxDelayMs,
    isRetryable = DEFAULT_OPTIONS.isRetryable,
    onRetry,
  } = options;

  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if it's the last attempt or error isn't retryable
      if (attempt >= maxAttempts || !isRetryable(error)) {
        throw error;
      }

      // Calculate delay with exponential backoff and jitter
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
      const delayMs = Math.min(exponentialDelay + jitter, maxDelayMs);

      // Notify before retry
      if (onRetry) {
        onRetry(error, attempt, delayMs);
      }

      // Wait before retrying
      await sleep(delayMs);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw lastError;
}

/**
 * Determines if an error is retryable based on HTTP status codes
 *
 * Retries on:
 * - 429 Too Many Requests (rate limit)
 * - 500 Internal Server Error
 * - 502 Bad Gateway
 * - 503 Service Unavailable
 * - 504 Gateway Timeout
 */
export function isRetryableError(error: unknown): boolean {
  // Check for HTTP status code in various error formats
  const statusCode = extractStatusCode(error);

  if (statusCode !== null) {
    return [429, 500, 502, 503, 504].includes(statusCode);
  }

  // Check error message for common retryable patterns
  const message = extractErrorMessage(error).toLowerCase();
  return (
    message.includes('rate limit') ||
    message.includes('429') ||
    message.includes('too many requests') ||
    message.includes('timeout') ||
    message.includes('temporarily unavailable') ||
    message.includes('service unavailable') ||
    message.includes('internal server error')
  );
}

/**
 * Extracts HTTP status code from various error formats
 */
function extractStatusCode(error: unknown): number | null {
  if (error == null || typeof error !== 'object') {
    return null;
  }

  const e = error as Record<string, unknown>;

  // Direct status property
  if (typeof e.status === 'number') {
    return e.status;
  }

  // statusCode property
  if (typeof e.statusCode === 'number') {
    return e.statusCode;
  }

  // response.status (Axios-style)
  if (e.response && typeof e.response === 'object') {
    const response = e.response as Record<string, unknown>;
    if (typeof response.status === 'number') {
      return response.status;
    }
  }

  // code property (some SDKs use this)
  if (typeof e.code === 'number') {
    return e.code;
  }

  return null;
}

/**
 * Extracts error message from various error formats
 */
function extractErrorMessage(error: unknown): string {
  if (error == null) {
    return '';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if (typeof e.message === 'string') {
      return e.message;
    }
    if (typeof e.error === 'string') {
      return e.error;
    }
  }

  return String(error);
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
