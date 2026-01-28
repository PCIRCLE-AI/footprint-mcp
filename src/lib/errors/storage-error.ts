import { FootprintError } from './base-error.js';

/**
 * Storage error for database and file system operations
 * HTTP status code: 500 (Internal Server Error)
 */
export class StorageError extends FootprintError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'STORAGE_ERROR', 500, context);
  }

  /**
   * Create a storage error for resource not found
   */
  static notFound(resource: string, id: string): StorageError {
    return new StorageError(`${resource} not found: ${id}`, { resource, id });
  }

  /**
   * Create a storage error for database operations
   */
  static databaseOperation(
    operation: string,
    originalError: Error
  ): StorageError {
    return new StorageError(
      `Database ${operation} failed: ${originalError.message}`,
      { operation, originalError: originalError.message }
    );
  }

  /**
   * Create a storage error for file operations
   */
  static fileOperation(
    operation: string,
    filePath: string,
    originalError: Error
  ): StorageError {
    return new StorageError(
      `File ${operation} failed for ${filePath}: ${originalError.message}`,
      { operation, filePath, originalError: originalError.message }
    );
  }

  /**
   * Create a storage error for resource already exists
   */
  static alreadyExists(resource: string, id: string): StorageError {
    return new StorageError(`${resource} already exists: ${id}`, {
      resource,
      id
    });
  }
}
