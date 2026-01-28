/**
 * Tool handler error wrapper for consistent error handling
 * Provides standardized error messages across all MCP tools
 */

/**
 * Get error message from unknown error type
 * Handles Error objects, strings, and other types safely
 *
 * @param error - Unknown error value
 * @returns Error message string
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}

/**
 * Wrap a tool handler with standardized error handling
 * Catches errors and formats them with tool name and suggested action
 *
 * @param toolName - Name of the tool (e.g., 'capture-footprint')
 * @param suggestedAction - Action to suggest when error occurs
 * @param handler - The actual tool handler function
 * @returns Wrapped handler with error handling
 *
 * @example
 * ```typescript
 * const handler = wrapToolHandler(
 *   'capture-footprint',
 *   'Check content is not empty and messageCount is positive.',
 *   async (params) => {
 *     // Handler implementation
 *     return { ... };
 *   }
 * );
 * ```
 */
export function wrapToolHandler<TParams, TResult>(
  toolName: string,
  suggestedAction: string,
  handler: (params: TParams) => Promise<TResult>
): (params: TParams) => Promise<TResult> {
  return async (params: TParams) => {
    try {
      return await handler(params);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      throw new Error(
        `[Tool: ${toolName}] ${errorMessage}. Suggested action: ${suggestedAction}`
      );
    }
  };
}

/**
 * Wrap a synchronous tool handler with error handling
 * Same as wrapToolHandler but for sync functions
 *
 * @param toolName - Name of the tool
 * @param suggestedAction - Action to suggest when error occurs
 * @param handler - The actual tool handler function (synchronous)
 * @returns Wrapped handler with error handling
 */
export function wrapSyncToolHandler<TParams, TResult>(
  toolName: string,
  suggestedAction: string,
  handler: (params: TParams) => TResult
): (params: TParams) => TResult {
  return (params: TParams) => {
    try {
      return handler(params);
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      throw new Error(
        `[Tool: ${toolName}] ${errorMessage}. Suggested action: ${suggestedAction}`
      );
    }
  };
}
