import type Database from 'better-sqlite3';

/**
 * Store the master salt in database (one-time operation)
 * This salt is used for all key derivations to ensure consistency
 *
 * @param db - SQLite database instance
 * @param salt - 16-byte salt from initial key derivation
 * @throws Error if salt already exists or storage fails
 */
export function storeSalt(db: Database.Database, salt: Uint8Array): void {
  if (salt.length !== 16) {
    throw new Error('Salt must be 16 bytes');
  }

  try {
    // Check if salt already exists (should only be set once)
    const existing = db.prepare('SELECT id FROM crypto_keys WHERE id = 1').get();
    if (existing) {
      throw new Error('Salt already exists in database');
    }

    // Store salt (id=1 ensures singleton via PRIMARY KEY constraint)
    const stmt = db.prepare(`
      INSERT INTO crypto_keys (id, salt)
      VALUES (1, ?)
    `);
    stmt.run(Buffer.from(salt));
  } catch (error) {
    if (error instanceof Error && error.message === 'Salt already exists in database') {
      throw error;
    }
    throw new Error(`Failed to store salt: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieve the master salt from database
 *
 * @param db - SQLite database instance
 * @returns 16-byte salt, or null if not found
 */
export function retrieveSalt(db: Database.Database): Uint8Array | null {
  try {
    const row = db.prepare('SELECT salt FROM crypto_keys WHERE id = 1').get() as { salt: Buffer } | undefined;
    if (!row) {
      return null;
    }
    return new Uint8Array(row.salt);
  } catch (error) {
    throw new Error(`Failed to retrieve salt: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Check if master salt exists in database
 *
 * @param db - SQLite database instance
 * @returns true if salt is stored, false otherwise
 */
export function hasSalt(db: Database.Database): boolean {
  try {
    const row = db.prepare('SELECT id FROM crypto_keys WHERE id = 1').get();
    return row !== undefined;
  } catch (error) {
    return false;
  }
}
