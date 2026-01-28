import { xchacha20poly1305 } from '@noble/ciphers/chacha';

/**
 * Decrypt ciphertext using XChaCha20-Poly1305 AEAD
 *
 * @param ciphertext - Encrypted data
 * @param nonce - 24-byte nonce used during encryption
 * @param key - 32-byte encryption key
 * @returns Decrypted plaintext
 * @throws Error if authentication fails or key is wrong
 */
export function decrypt(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  key: Uint8Array
): string {
  if (key.length !== 32) {
    throw new Error('Key must be 32 bytes');
  }

  if (nonce.length !== 24) {
    throw new Error('Nonce must be 24 bytes');
  }

  // Create cipher instance
  const cipher = xchacha20poly1305(key, nonce);

  try {
    // Decrypt and verify authentication tag
    const plaintextBytes = cipher.decrypt(ciphertext);

    // Convert bytes back to string
    return new TextDecoder().decode(plaintextBytes);
  } catch (error) {
    // Log detailed error for debugging (server-side only, never exposed to client)
    const originalError = error instanceof Error ? error.message : String(error);
    console.error('[Decrypt] Decryption failed:', originalError);

    // User-facing error remains generic (security best practice)
    throw new Error('Decryption failed: invalid key or tampered data');
  }
}
