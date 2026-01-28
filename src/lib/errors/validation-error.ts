import { FootprintError } from './base-error.js';

/**
 * Validation error for invalid user input
 * HTTP status code: 400 (Bad Request)
 */
export class ValidationError extends FootprintError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, context);
  }

  /**
   * Create a validation error for empty/missing required fields
   */
  static required(field: string): ValidationError {
    return new ValidationError(`${field} is required`, { field });
  }

  /**
   * Create a validation error for invalid format
   */
  static invalidFormat(field: string, expectedFormat: string): ValidationError {
    return new ValidationError(
      `${field} has invalid format, expected: ${expectedFormat}`,
      { field, expectedFormat }
    );
  }

  /**
   * Create a validation error for out of range values
   */
  static outOfRange(
    field: string,
    value: number,
    min?: number,
    max?: number
  ): ValidationError {
    return new ValidationError(
      `${field} is out of range (value: ${value}, min: ${min}, max: ${max})`,
      { field, value, min, max }
    );
  }
}
