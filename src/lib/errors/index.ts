/**
 * Structured error hierarchy for Footprint MCP server
 *
 * Usage:
 * ```typescript
 * import { ValidationError, StorageError, CryptoError } from './lib/errors/index.js';
 *
 * // Validation errors (HTTP 400)
 * throw ValidationError.required('conversationId');
 * throw ValidationError.invalidFormat('tags', 'comma-separated string');
 * throw new ValidationError('Content cannot be empty', { field: 'content' });
 *
 * // Storage errors (HTTP 500)
 * throw StorageError.notFound('Evidence', id);
 * throw StorageError.databaseOperation('insert', error);
 *
 * // Crypto errors (HTTP 500)
 * throw CryptoError.decryptionFailed();
 * throw CryptoError.invalidKey('Key must be 32 bytes');
 * ```
 */

export { FootprintError } from './base-error.js';
export { ValidationError } from './validation-error.js';
export { StorageError } from './storage-error.js';
export { CryptoError } from './crypto-error.js';
