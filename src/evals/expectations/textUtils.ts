/**
 * Utilities for extracting and working with text from MCP responses
 */

import { extractText } from '../../mcp/response.js';

/**
 * Extracts text content from an MCP response
 *
 * Supports multiple response formats:
 * - Plain strings
 * - MCP CallToolResult with content array
 * - NormalizedToolResponse from normalizeToolResponse()
 * - Objects with text field
 * - Structured content (JSON)
 *
 * @param response - The response to extract text from
 * @returns Extracted text content
 *
 * @remarks
 * This function delegates to the centralized `extractText` function
 * from `src/mcp/response.ts`. It is maintained for backwards compatibility.
 */
export function extractTextFromResponse(response: unknown): string {
  return extractText(response);
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
