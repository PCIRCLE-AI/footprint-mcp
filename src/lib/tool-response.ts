/**
 * Standardized tool response builder for MCP tools
 * Provides consistent formatting across all tool handlers
 */

/**
 * MCP tool response structure
 * Includes index signature to match MCP SDK requirements
 */
export interface ToolResponse<T = unknown> {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: T;
  [key: string]: unknown;
}

/**
 * Create a standardized tool response
 *
 * @param message - Human-readable message (can include newlines and formatting)
 * @param structuredContent - Machine-readable structured data
 * @returns Formatted tool response
 *
 * @example
 * ```typescript
 * return createToolResponse(
 *   '✅ Evidence captured successfully\n- ID: abc123\n- Timestamp: 2024-01-01',
 *   { id: 'abc123', timestamp: '2024-01-01', success: true }
 * );
 * ```
 */
export function createToolResponse<T>(
  message: string,
  structuredContent: T
): ToolResponse<T> {
  return {
    content: [{ type: 'text', text: message }],
    structuredContent
  };
}

/**
 * Format a key-value object as a bulleted list
 *
 * @param items - Key-value pairs to format
 * @param indent - Indentation string (default: '- ')
 * @returns Formatted bullet list string
 *
 * @example
 * ```typescript
 * formatBulletList({ id: '123', count: 5, tag: null })
 * // Returns: "- id: 123\n- count: 5"
 * ```
 */
export function formatBulletList(
  items: Record<string, string | number | boolean | null | undefined>,
  indent = '- '
): string {
  return Object.entries(items)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${indent}${key}: ${value}`)
    .join('\n');
}

/**
 * Format a success response with standardized emoji and structure
 *
 * @param title - Success message title
 * @param details - Key-value details to display
 * @param structuredContent - Machine-readable data
 * @returns Formatted success response
 *
 * @example
 * ```typescript
 * return formatSuccessResponse(
 *   'Evidence captured successfully',
 *   { id: 'abc123', timestamp: '2024-01-01' },
 *   { id: 'abc123', success: true }
 * );
 * // Returns: "✅ Evidence captured successfully\n- id: abc123\n- timestamp: 2024-01-01"
 * ```
 */
export function formatSuccessResponse<T>(
  title: string,
  details: Record<string, string | number | boolean | null | undefined>,
  structuredContent: T
): ToolResponse<T> {
  const message = `✅ ${title}\n${formatBulletList(details)}`;
  return createToolResponse(message, structuredContent);
}

/**
 * Format an error response with standardized emoji
 *
 * @param title - Error message title
 * @param reason - Error reason or details
 * @param structuredContent - Machine-readable error data
 * @returns Formatted error response
 */
export function formatErrorResponse<T>(
  title: string,
  reason: string,
  structuredContent: T
): ToolResponse<T> {
  const message = `❌ ${title}\n${reason}`;
  return createToolResponse(message, structuredContent);
}

/**
 * Format a warning response with standardized emoji
 *
 * @param title - Warning message title
 * @param details - Warning details
 * @param structuredContent - Machine-readable data
 * @returns Formatted warning response
 */
export function formatWarningResponse<T>(
  title: string,
  details: string,
  structuredContent: T
): ToolResponse<T> {
  const message = `⚠️ ${title}\n${details}`;
  return createToolResponse(message, structuredContent);
}
