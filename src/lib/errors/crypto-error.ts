import { FootprintError } from './base-error.js';

/**
 * Cryptography error for encryption, decryption, and key operations
 * HTTP status code: 500 (Internal Server Error)
 */
export class CryptoError extends FootprintError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CRYPTO_ERROR', 500, context);
  }

  /**
   * Create a crypto error for encryption failures
   */
  static encryptionFailed(originalError: Error): CryptoError {
    return new CryptoError(
      `Encryption failed: ${originalError.message}`,
      { originalError: originalError.message }
    );
  }

  /**
   * Create a crypto error for decryption failures
   */
  static decryptionFailed(reason?: string): CryptoError {
    return new CryptoError(
      reason
        ? `Decryption failed: ${reason}`
        : 'Decryption failed: invalid key or tampered data',
      { reason }
    );
  }

  /**
   * Create a crypto error for key derivation failures
   */
  static keyDerivationFailed(originalError: Error): CryptoError {
    return new CryptoError(
      `Key derivation failed: ${originalError.message}`,
      { originalError: originalError.message }
    );
  }

  /**
   * Create a crypto error for invalid key
   */
  static invalidKey(reason: string): CryptoError {
    return new CryptoError(`Invalid key: ${reason}`, { reason });
  }

  /**
   * Create a crypto error for invalid nonce
   */
  static invalidNonce(reason: string): CryptoError {
    return new CryptoError(`Invalid nonce: ${reason}`, { reason });
  }
}
