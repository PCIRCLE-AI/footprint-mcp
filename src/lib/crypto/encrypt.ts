import { xchacha20poly1305 } from '@noble/ciphers/chacha';
import { randomBytes } from '@noble/hashes/utils';

export interface EncryptedData {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
}

/**
 * Encrypt plaintext using XChaCha20-Poly1305 AEAD
 *
 * @param plaintext - Text to encrypt
 * @param key - 32-byte encryption key
 * @returns Encrypted data with nonce
 */
export function encrypt(plaintext: string, key: Uint8Array): EncryptedData {
  if (key.length !== 32) {
    throw new Error('Key must be 32 bytes');
  }

  // Generate random 24-byte nonce (XChaCha20 extended nonce)
  const nonce = randomBytes(24);

  // Convert plaintext to bytes
  const plaintextBytes = new TextEncoder().encode(plaintext);

  // Create cipher instance
  const cipher = xchacha20poly1305(key, nonce);

  // Encrypt with authentication
  const ciphertext = cipher.encrypt(plaintextBytes);

  return { ciphertext, nonce };
}
