import type Database from 'better-sqlite3';

/**
 * Current schema version
 */
const SCHEMA_VERSION = '1';

/**
 * Creates the database schema (tables and indexes)
 * This function is idempotent - safe to run multiple times
 *
 * @param db - SQLite database instance
 */
export function createSchema(db: Database.Database): void {
  try {
    // Enable WAL mode for better concurrency and crash safety
    db.pragma('journal_mode = WAL');
    // NORMAL synchronous is safe with WAL and much faster
    db.pragma('synchronous = NORMAL');
    // Wait 5 seconds before returning SQLITE_BUSY error
    db.pragma('busy_timeout = 5000');
    // Enable foreign key constraints
    db.pragma('foreign_keys = ON');

    // Create evidences table
    db.exec(`
      CREATE TABLE IF NOT EXISTS evidences (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        conversationId TEXT NOT NULL,
        llmProvider TEXT NOT NULL,
        encryptedContent BLOB NOT NULL,
        nonce BLOB NOT NULL,
        contentHash TEXT NOT NULL,
        messageCount INTEGER NOT NULL DEFAULT 0,
        gitCommitHash TEXT,
        gitTimestamp TEXT,
        tags TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Create metadata table for schema versioning and configuration
    db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    // Create crypto_keys table for master salt storage
    db.exec(`
      CREATE TABLE IF NOT EXISTS crypto_keys (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        salt BLOB NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Create indexes for common queries
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_timestamp ON evidences(timestamp);
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_conversation_id ON evidences(conversationId);
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_content_hash ON evidences(contentHash);
    `);

    // Set schema version (use INSERT OR IGNORE to make it idempotent)
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO metadata (key, value)
      VALUES ('schema_version', ?)
    `);
    stmt.run(SCHEMA_VERSION);
  } catch (error) {
    // Clean up database connection on failure to prevent resource leaks
    db.close();
    throw error;
  }
}

/**
 * Verifies that the database schema is valid
 * Checks for existence of required tables
 *
 * @param db - SQLite database instance
 * @returns true if schema is valid, false otherwise
 */
export function verifySchema(db: Database.Database): boolean {
  try {
    // Check if evidences table exists
    const evidencesTableInfo = db.pragma('table_info(evidences)') as Array<{ name: string; type: string }>;
    if (!evidencesTableInfo || evidencesTableInfo.length === 0) {
      return false;
    }

    // Check if metadata table exists
    const metadataTableInfo = db.pragma('table_info(metadata)') as Array<{ name: string; type: string }>;
    if (!metadataTableInfo || metadataTableInfo.length === 0) {
      return false;
    }

    // Check if crypto_keys table exists
    const cryptoKeysTableInfo = db.pragma('table_info(crypto_keys)') as Array<{ name: string; type: string }>;
    if (!cryptoKeysTableInfo || cryptoKeysTableInfo.length === 0) {
      return false;
    }

    // Verify required columns exist in evidences table
    const evidencesColumns = evidencesTableInfo.map((col) => col.name);
    const requiredColumns = [
      'id',
      'timestamp',
      'encryptedContent',
      'nonce',
      'contentHash',
      'messageCount',
      'createdAt',
      'updatedAt'
    ];

    for (const col of requiredColumns) {
      if (!evidencesColumns.includes(col)) {
        return false;
      }
    }

    return true;
  } catch (error) {
    return false;
  }
}
