/* global TextDecoder */
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";

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
  key: Uint8Array,
): string {
  if (key.length !== 32) {
    throw new Error("Key must be 32 bytes");
  }

  if (nonce.length !== 24) {
    throw new Error("Nonce must be 24 bytes");
  }

  // Create cipher instance
  const cipher = xchacha20poly1305(key, nonce);

  try {
    // Decrypt and verify authentication tag
    const plaintextBytes = cipher.decrypt(ciphertext);

    // Convert bytes back to string
    const result = new TextDecoder().decode(plaintextBytes);

    // Zero decrypted bytes from memory (defense-in-depth)
    plaintextBytes.fill(0);

    return result;
  } catch (error) {
    // User-facing error remains generic (security best practice)
    // Original error preserved in cause chain for debugging
    throw new Error("Decryption failed: invalid key or tampered data", {
      cause: error,
    });
  }
}
