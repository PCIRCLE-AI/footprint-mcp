import { argon2id } from '@noble/hashes/argon2';
import { randomBytes } from '@noble/hashes/utils';
import { timingSafeEqual } from 'node:crypto';
import type { DerivedKey, KeyDerivationParams } from './types.js';
import { DEFAULT_KDF_PARAMS } from './types.js';

/**
 * Derive encryption key from password using Argon2id
 *
 * @param password - User password (must not be empty)
 * @param params - Optional KDF parameters (uses OWASP defaults)
 * @returns Derived key and salt
 *
 * @security When comparing derived keys for authentication,
 * use constant-time comparison to prevent timing attacks:
 * @example
 * ```typescript
 * import { timingSafeEqual } from 'node:crypto';
 *
 * const derived = await deriveKey('password');
 * // SECURE - constant-time comparison
 * const match = timingSafeEqual(derived.key, storedKey);
 * ```
 */
export async function deriveKey(
  password: string,
  params: Partial<KeyDerivationParams> = {}
): Promise<DerivedKey> {
  if (!password || password.length === 0) {
    throw new Error('Password cannot be empty');
  }

  const kdfParams = { ...DEFAULT_KDF_PARAMS, ...params };

  // Generate random salt (16 bytes)
  const salt = randomBytes(16);

  // Derive key using Argon2id
  const key = argon2id(
    password,
    salt,
    {
      m: kdfParams.memory,
      t: kdfParams.iterations,
      p: kdfParams.parallelism,
      dkLen: kdfParams.keyLength,
    }
  );

  return { key, salt };
}

/**
 * Re-derive key from password and existing salt
 * Use this for subsequent encryptions/decryptions with stored salt
 *
 * @param password - User password
 * @param salt - Existing salt (from database)
 * @param params - Optional KDF parameters
 * @returns Derived key with same salt
 */
export async function rederiveKey(
  password: string,
  salt: Uint8Array,
  params: Partial<KeyDerivationParams> = {}
): Promise<DerivedKey> {
  if (!password || password.length === 0) {
    throw new Error('Password cannot be empty');
  }

  const kdfParams = { ...DEFAULT_KDF_PARAMS, ...params };

  if (salt.length !== 16) {
    throw new Error('Salt must be 16 bytes');
  }

  // Re-derive key using same salt
  const key = argon2id(
    password,
    salt,
    {
      m: kdfParams.memory,
      t: kdfParams.iterations,
      p: kdfParams.parallelism,
      dkLen: kdfParams.keyLength,
    }
  );

  return { key, salt };
}

/**
 * Verify password by comparing derived key with expected key
 * Uses constant-time comparison to prevent timing attacks
 *
 * @param password - User password to verify
 * @param salt - Existing salt (from database)
 * @param expectedKey - Expected key (from previous derivation)
 * @param params - Optional KDF parameters
 * @returns true if password is correct, false otherwise
 *
 * @security Uses timingSafeEqual to prevent timing attacks
 */
export async function verifyKey(
  password: string,
  salt: Uint8Array,
  expectedKey: Uint8Array,
  params: Partial<KeyDerivationParams> = {}
): Promise<boolean> {
  if (!password || password.length === 0) {
    throw new Error('Password cannot be empty');
  }

  if (salt.length !== 16) {
    throw new Error('Salt must be 16 bytes');
  }

  if (expectedKey.length !== 32) {
    throw new Error('Expected key must be 32 bytes');
  }

  const kdfParams = { ...DEFAULT_KDF_PARAMS, ...params };

  // Re-derive key using same salt
  const derivedKey = argon2id(
    password,
    salt,
    {
      m: kdfParams.memory,
      t: kdfParams.iterations,
      p: kdfParams.parallelism,
      dkLen: kdfParams.keyLength,
    }
  );

  // Constant-time comparison to prevent timing attacks
  try {
    return timingSafeEqual(Buffer.from(derivedKey), Buffer.from(expectedKey));
  } catch {
    // timingSafeEqual throws if lengths don't match
    return false;
  }
}
