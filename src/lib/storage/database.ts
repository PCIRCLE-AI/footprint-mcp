import Database from 'better-sqlite3';
import { createSchema } from './schema.js';
import type { Evidence } from './types.js';

/**
 * Database row structure (matches SQLite table schema)
 */
interface EvidenceRow {
  id: string;
  timestamp: string;
  conversationId: string;
  llmProvider: string;
  encryptedContent: Buffer;
  nonce: Buffer;
  contentHash: string;
  messageCount: number;
  gitCommitHash: string | null;
  gitTimestamp: string | null;
  tags: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Evidence database with CRUD operations
 * Manages encrypted evidence storage with SQLite backend
 */
export class EvidenceDatabase {
  private db: Database.Database;

  /**
   * Creates or opens an evidence database
   * @param dbPath - Path to SQLite database file
   * @throws Error if database initialization fails
   */
  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    try {
      createSchema(this.db);
    } catch (error) {
      // Clean up database connection on any initialization failure
      this.db.close();
      throw new Error(`Failed to initialize database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Creates a new evidence record
   * @param evidence - Evidence data without id, createdAt, updatedAt
   * @returns UUID of created evidence
   */
  create(evidence: Omit<Evidence, 'id' | 'createdAt' | 'updatedAt'>): string {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    try {
      const stmt = this.db.prepare(`
        INSERT INTO evidences (
          id, timestamp, conversationId, llmProvider,
          encryptedContent, nonce, contentHash, messageCount,
          gitCommitHash, gitTimestamp, tags, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        evidence.timestamp,
        evidence.conversationId,
        evidence.llmProvider,
        Buffer.from(evidence.encryptedContent),
        Buffer.from(evidence.nonce),
        evidence.contentHash,
        evidence.messageCount,
        evidence.gitCommitHash,
        evidence.gitTimestamp,
        evidence.tags,
        now,
        now
      );

      return id;
    } catch (error) {
      throw new Error(`Failed to create evidence: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Finds evidence by ID
   * @param id - Evidence UUID
   * @returns Evidence or null if not found
   */
  findById(id: string): Evidence | null {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM evidences WHERE id = ?
      `);

      const row = stmt.get(id) as EvidenceRow | undefined;
      if (!row) {
        return null;
      }

      return this.rowToEvidence(row);
    } catch (error) {
      // Don't swallow database errors - re-throw with context
      throw new Error(`Failed to find evidence by ID: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Finds all evidences for a conversation
   * @param conversationId - Conversation identifier
   * @returns Array of evidences (empty if none found)
   */
  findByConversationId(conversationId: string): Evidence[] {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM evidences
        WHERE conversationId = ?
        ORDER BY timestamp ASC
      `);

      const rows = stmt.all(conversationId) as EvidenceRow[];
      return rows.map((row) => this.rowToEvidence(row));
    } catch (error) {
      throw new Error(
        `Failed to find evidences by conversationId: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Lists evidences with pagination
   * @param options - Pagination options (limit, offset)
   * @returns Array of evidences
   */
  list(options?: { limit?: number; offset?: number }): Evidence[] {
    try {
      const limit = options?.limit;
      const offset = options?.offset ?? 0;

      let query = 'SELECT * FROM evidences ORDER BY timestamp DESC';
      const params: number[] = [];

      if (limit !== undefined) {
        query += ' LIMIT ?';
        params.push(limit);
        if (offset > 0) {
          query += ' OFFSET ?';
          params.push(offset);
        }
      } else if (offset > 0) {
        query += ' LIMIT -1 OFFSET ?';
        params.push(offset);
      }

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params) as EvidenceRow[];
      return rows.map((row) => this.rowToEvidence(row));
    } catch (error) {
      throw new Error(`Failed to list evidences: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Updates git commit information for an evidence
   * @param id - Evidence UUID
   * @param gitCommitHash - Git commit hash
   * @param gitTimestamp - Git commit timestamp (ISO 8601)
   */
  updateGitInfo(id: string, gitCommitHash: string, gitTimestamp: string): void {
    try {
      const stmt = this.db.prepare(`
        UPDATE evidences
        SET gitCommitHash = ?,
            gitTimestamp = ?,
            updatedAt = ?
        WHERE id = ?
      `);

      const result = stmt.run(gitCommitHash, gitTimestamp, new Date().toISOString(), id);

      if (result.changes === 0) {
        throw new Error(`Evidence with id ${id} not found`);
      }
    } catch (error) {
      throw new Error(`Failed to update git info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Adds tags to an evidence (appends to existing tags)
   * @param id - Evidence UUID
   * @param tags - Array of tags to add
   * @throws Error if tags array is empty or all tags are whitespace
   */
  addTags(id: string, tags: string[]): void {
    try {
      if (tags.length === 0) {
        throw new Error('Tags array cannot be empty');
      }

      // Filter out empty/whitespace-only tags
      const validTags = tags.map(t => t.trim()).filter(t => t.length > 0);
      if (validTags.length === 0) {
        throw new Error('All provided tags are empty or whitespace');
      }

      // First, get existing tags
      const evidence = this.findById(id);
      if (!evidence) {
        throw new Error(`Evidence with id ${id} not found`);
      }

      // Parse existing tags (comma-separated) or create empty array
      const existingTags = evidence.tags
        ? evidence.tags.split(',').map(t => t.trim()).filter(t => t)
        : [];

      // Merge tags (deduplicate) using validTags instead of raw tags
      const mergedTags = [...new Set([...existingTags, ...validTags])];

      // Update database with comma-separated format
      const stmt = this.db.prepare(`
        UPDATE evidences
        SET tags = ?,
            updatedAt = ?
        WHERE id = ?
      `);

      stmt.run(mergedTags.join(','), new Date().toISOString(), id);
    } catch (error) {
      throw new Error(`Failed to add tags: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Search and filter evidences by various criteria
   * @param options - Search and filter options
   * @returns Array of matching evidences
   */
  search(options: {
    query?: string;      // Search in conversationId, tags
    tags?: string[];     // Filter by tags (AND logic)
    dateFrom?: string;   // ISO date string
    dateTo?: string;     // ISO date string
    limit?: number;
    offset?: number;
  }): Evidence[] {
    try {
      const { query, tags, dateFrom, dateTo, limit, offset = 0 } = options;
      
      // Build WHERE conditions
      const conditions: string[] = [];
      const params: (string | number)[] = [];

      // Text search in conversationId and tags
      if (query && query.trim()) {
        conditions.push(`(conversationId LIKE ? OR tags LIKE ?)`);
        const searchPattern = `%${query.trim()}%`;
        params.push(searchPattern, searchPattern);
      }

      // Tag filtering (AND logic - all specified tags must be present)
      // Tags are stored as comma-separated strings: "tag1,tag2,tag3"
      if (tags && tags.length > 0) {
        for (const tag of tags) {
          // Match tag at start, middle, or end of comma-separated list
          conditions.push(`(tags LIKE ? OR tags LIKE ? OR tags LIKE ? OR tags = ?)`);
          const trimmedTag = tag.trim();
          params.push(
            `${trimmedTag},%`,      // tag at start: "tag1,..."
            `%,${trimmedTag},%`,    // tag in middle: "...,tag1,..."
            `%,${trimmedTag}`,      // tag at end: "...,tag1"
            trimmedTag              // exact match (single tag)
          );
        }
      }

      // Date range filtering
      if (dateFrom) {
        conditions.push(`timestamp >= ?`);
        params.push(dateFrom);
      }
      if (dateTo) {
        conditions.push(`timestamp <= ?`);
        params.push(dateTo);
      }

      // Build final query
      let sql = 'SELECT * FROM evidences';
      if (conditions.length > 0) {
        sql += ' WHERE ' + conditions.join(' AND ');
      }
      sql += ' ORDER BY timestamp DESC';

      // Add pagination
      if (limit !== undefined) {
        sql += ' LIMIT ?';
        params.push(limit);
        if (offset > 0) {
          sql += ' OFFSET ?';
          params.push(offset);
        }
      } else if (offset > 0) {
        sql += ' LIMIT -1 OFFSET ?';
        params.push(offset);
      }

      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params) as EvidenceRow[];
      return rows.map((row) => this.rowToEvidence(row));
    } catch (error) {
      throw new Error(`Failed to search evidences: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Deletes evidence by ID
   * @param id - Evidence UUID
   * @returns true if deleted, false if not found
   */
  delete(id: string): boolean {
    try {
      const stmt = this.db.prepare(`DELETE FROM evidences WHERE id = ?`);
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to delete evidence: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Deletes multiple evidences by IDs
   * @param ids - Array of evidence UUIDs
   * @returns Number of evidences deleted
   */
  deleteMany(ids: string[]): number {
    if (ids.length === 0) return 0;
    
    try {
      const placeholders = ids.map(() => '?').join(',');
      const stmt = this.db.prepare(`DELETE FROM evidences WHERE id IN (${placeholders})`);
      const result = stmt.run(...ids);
      return result.changes;
    } catch (error) {
      throw new Error(`Failed to delete evidences: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Updates tags for an evidence (replaces existing tags)
   * @param id - Evidence UUID
   * @param tags - New tags (comma-separated string or null)
   * @returns true if updated, false if not found
   */
  updateTags(id: string, tags: string | null): boolean {
    try {
      const stmt = this.db.prepare(`
        UPDATE evidences
        SET tags = ?,
            updatedAt = ?
        WHERE id = ?
      `);
      const result = stmt.run(tags, new Date().toISOString(), id);
      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to update tags: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Renames a tag across all evidences atomically using transaction
   * @param oldTag - Tag to rename
   * @param newTag - New tag name
   * @returns Number of evidences updated
   * @throws Error if transaction fails (no partial updates)
   */
  renameTag(oldTag: string, newTag: string): number {
    try {
      // Wrap in transaction for atomic updates
      const transaction = this.db.transaction(() => {
        // Get all evidences with this tag
        const evidences = this.search({ tags: [oldTag] });
        let updatedCount = 0;

        for (const evidence of evidences) {
          if (!evidence.tags) continue;

          const tags = evidence.tags.split(',').map(t => t.trim());
          const newTags = tags.map(t => t === oldTag ? newTag : t);

          if (this.updateTags(evidence.id, newTags.join(','))) {
            updatedCount++;
          }
        }

        return updatedCount;
      });

      return transaction();
    } catch (error) {
      throw new Error(`Failed to rename tag: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Removes a tag from all evidences atomically using transaction
   * @param tag - Tag to remove
   * @returns Number of evidences updated
   * @throws Error if transaction fails (no partial updates)
   */
  removeTag(tag: string): number {
    try {
      // Wrap in transaction for atomic updates
      const transaction = this.db.transaction(() => {
        // Get all evidences with this tag
        const evidences = this.search({ tags: [tag] });
        let updatedCount = 0;

        for (const evidence of evidences) {
          if (!evidence.tags) continue;

          const tags = evidence.tags.split(',').map(t => t.trim()).filter(t => t !== tag);
          const newTags = tags.length > 0 ? tags.join(',') : null;

          if (this.updateTags(evidence.id, newTags)) {
            updatedCount++;
          }
        }

        return updatedCount;
      });

      return transaction();
    } catch (error) {
      throw new Error(`Failed to remove tag: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets all unique tags with their counts
   * @returns Map of tag to count
   */
  getTagCounts(): Map<string, number> {
    try {
      const stmt = this.db.prepare(`SELECT tags FROM evidences WHERE tags IS NOT NULL AND tags != ''`);
      const rows = stmt.all() as { tags: string }[];
      
      const tagCounts = new Map<string, number>();
      for (const row of rows) {
        const tags = row.tags.split(',').map(t => t.trim()).filter(t => t);
        for (const tag of tags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }
      
      return tagCounts;
    } catch (error) {
      throw new Error(`Failed to get tag counts: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the underlying database instance
   * Used for salt storage and other low-level operations
   *
   * @returns SQLite database instance
   */
  getDb(): Database.Database {
    return this.db;
  }

  /**
   * Closes the database connection
   * Should be called when done with the database
   */
  close(): void {
    this.db.close();
  }

  /**
   * Converts database row to Evidence object
   * Handles BLOB to Uint8Array conversion
   * @param row - Raw database row
   * @returns Evidence object
   */
  private rowToEvidence(row: EvidenceRow): Evidence {
    return {
      id: row.id,
      timestamp: row.timestamp,
      conversationId: row.conversationId,
      llmProvider: row.llmProvider,
      encryptedContent: new Uint8Array(row.encryptedContent),
      nonce: new Uint8Array(row.nonce),
      contentHash: row.contentHash,
      messageCount: row.messageCount,
      gitCommitHash: row.gitCommitHash,
      gitTimestamp: row.gitTimestamp,
      tags: row.tags,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }
}
