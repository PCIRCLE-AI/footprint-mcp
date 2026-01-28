/**
 * Encryption key derived from user password
 */
export interface DerivedKey {
  key: Uint8Array;      // 32 bytes for ChaCha20
  salt: Uint8Array;     // 16 bytes
}

/**
 * Parameters for Argon2 key derivation
 */
export interface KeyDerivationParams {
  memory: number;       // Memory cost in KiB (default: 65536 = 64MB)
  iterations: number;   // Time cost (default: 3)
  parallelism: number;  // Parallelism factor (default: 4)
  keyLength: number;    // Output key length in bytes (default: 32)
}

/**
 * Default Argon2id parameters (OWASP recommended)
 */
export const DEFAULT_KDF_PARAMS: KeyDerivationParams = {
  memory: 65536,      // 64 MB
  iterations: 3,
  parallelism: 4,
  keyLength: 32,
};

export type { EncryptedData } from './encrypt.js';
