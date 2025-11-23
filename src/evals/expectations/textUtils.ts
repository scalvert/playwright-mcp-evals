/**
 * Utilities for extracting and working with text from MCP responses
 */

/**
 * Extracts text content from an MCP response
 *
 * Supports multiple response formats:
 * - Plain strings
 * - MCP CallToolResult with content array
 * - Objects with text field
 * - Structured content (JSON)
 *
 * @param response - The response to extract text from
 * @returns Extracted text content
 */
export function extractTextFromResponse(response: unknown): string {
  // Handle null/undefined
  if (response == null) {
    return '';
  }

  // Plain string response
  if (typeof response === 'string') {
    return response;
  }

  // Array response (direct content array)
  if (Array.isArray(response)) {
    const textParts = response
      .filter((c: unknown) => {
        return (
          c != null &&
          typeof c === 'object' &&
          'type' in c &&
          c.type === 'text' &&
          'text' in c
        );
      })
      .map((c: Record<string, unknown>) => c.text as string);

    if (textParts.length > 0) {
      return textParts.join('\n');
    }
    // If no text parts found, stringify the array
    return JSON.stringify(response);
  }

  // Object responses
  if (typeof response === 'object') {
    const r = response as Record<string, unknown>;

    // MCP CallToolResult format: { content: [{ type: 'text', text: '...' }] }
    if (Array.isArray(r.content)) {
      const textParts = r.content
        .filter((c: unknown) => {
          return (
            c != null &&
            typeof c === 'object' &&
            'type' in c &&
            c.type === 'text' &&
            'text' in c
          );
        })
        .map((c: Record<string, unknown>) => c.text as string);

      if (textParts.length > 0) {
        return textParts.join('\n');
      }
    }

    // Check for structuredContent field (common MCP pattern)
    if (r.structuredContent != null) {
      // If structuredContent is a string, return it
      if (typeof r.structuredContent === 'string') {
        return r.structuredContent;
      }
      // Otherwise JSON stringify it
      return JSON.stringify(r.structuredContent);
    }

    // Direct text field
    if (r.text != null && typeof r.text === 'string') {
      return r.text;
    }

    // Fallback: JSON stringify the object
    return JSON.stringify(r);
  }

  // Fallback for primitives (numbers, booleans, etc.)
  return String(response);
}

/**
 * Normalizes whitespace in text for comparison
 *
 * @param text - Text to normalize
 * @returns Text with normalized whitespace
 */
export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Checks if text contains all required substrings
 *
 * @param text - Text to search in
 * @param substrings - Substrings to find
 * @param caseSensitive - Whether to do case-sensitive matching (default: true)
 * @returns Array of missing substrings (empty if all found)
 */
export function findMissingSubstrings(
  text: string,
  substrings: string[],
  caseSensitive = true
): string[] {
  const searchText = caseSensitive ? text : text.toLowerCase();

  return substrings.filter((substring) => {
    const searchSubstring = caseSensitive
      ? substring
      : substring.toLowerCase();
    return !searchText.includes(searchSubstring);
  });
}

/**
 * Checks if text matches all required regex patterns
 *
 * @param text - Text to match against
 * @param patterns - Regex patterns (as strings)
 * @returns Array of failed patterns (empty if all matched)
 */
export function findFailedPatterns(
  text: string,
  patterns: string[]
): string[] {
  return patterns.filter((pattern) => {
    try {
      // Use multiline flag to allow ^ and $ to match line starts/ends
      const regex = new RegExp(pattern, 'm');
      return !regex.test(text);
    } catch (error) {
      // Invalid regex is treated as failed match
      return true;
    }
  });
}
