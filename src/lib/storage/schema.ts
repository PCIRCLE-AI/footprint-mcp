import type Database from "better-sqlite3";

/**
 * Current schema version
 */
const SCHEMA_VERSION = "9";

export interface SchemaInitResult {
  previousVersion: number;
  currentVersion: number;
  upgraded: boolean;
}

function tableExists(db: Database.Database, tableName: string): boolean {
  const row = db
    .prepare(
      `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = ?
      `,
    )
    .get(tableName) as { name: string } | undefined;

  return Boolean(row?.name);
}

function readSchemaVersion(db: Database.Database): number {
  if (!tableExists(db, "metadata")) {
    return 0;
  }

  const row = db
    .prepare(
      `
        SELECT value
        FROM metadata
        WHERE key = 'schema_version'
      `,
    )
    .get() as { value: string } | undefined;

  const parsed = Number.parseInt(row?.value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Creates the database schema (tables and indexes)
 * This function is idempotent - safe to run multiple times
 *
 * @param db - SQLite database instance
 */
export function createSchema(db: Database.Database): SchemaInitResult {
  // Note: No try/catch here — on failure, the caller (EvidenceDatabase constructor)
  // owns the db lifecycle and handles cleanup. Previously this function closed the db
  // on error, causing a double-close when the constructor's catch also called db.close().
  const previousVersion = readSchemaVersion(db);
  const currentVersion = Number.parseInt(SCHEMA_VERSION, 10);

  // Pragmas must be set outside transactions
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");

  // Wrap DDL + DML in transaction for atomicity (prevents partial schema on failure)
  const initSchema = db.transaction(() => {
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

    db.exec(`
      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS crypto_keys (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        salt BLOB NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        host TEXT NOT NULL,
        projectRoot TEXT NOT NULL,
        cwd TEXT NOT NULL,
        title TEXT,
        status TEXT NOT NULL,
        startedAt TEXT NOT NULL,
        endedAt TEXT,
        metadata TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        seq INTEGER NOT NULL,
        role TEXT NOT NULL,
        source TEXT NOT NULL,
        content TEXT NOT NULL,
        capturedAt TEXT NOT NULL,
        metadata TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE,
        UNIQUE (sessionId, seq)
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS timeline_events (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        seq INTEGER NOT NULL,
        eventType TEXT NOT NULL,
        eventSubType TEXT,
        source TEXT NOT NULL,
        summary TEXT,
        payload TEXT,
        startedAt TEXT NOT NULL,
        endedAt TEXT,
        status TEXT,
        relatedMessageId TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (relatedMessageId) REFERENCES messages(id) ON DELETE SET NULL,
        UNIQUE (sessionId, seq)
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS artifacts (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        eventId TEXT,
        artifactType TEXT NOT NULL,
        path TEXT,
        metadata TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (eventId) REFERENCES timeline_events(id) ON DELETE SET NULL
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        rationale TEXT,
        status TEXT NOT NULL,
        sourceRefs TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS narratives (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        kind TEXT NOT NULL,
        content TEXT NOT NULL,
        sourceRefs TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS ingestion_runs (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        stage TEXT NOT NULL,
        status TEXT NOT NULL,
        error TEXT,
        startedAt TEXT NOT NULL,
        endedAt TEXT,
        FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS session_history_cache (
        sessionId TEXT PRIMARY KEY,
        titleText TEXT NOT NULL DEFAULT '',
        metadataText TEXT NOT NULL DEFAULT '',
        messagesText TEXT NOT NULL DEFAULT '',
        artifactsText TEXT NOT NULL DEFAULT '',
        narrativesText TEXT NOT NULL DEFAULT '',
        decisionsText TEXT NOT NULL DEFAULT '',
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS session_issue_keys (
        sessionId TEXT NOT NULL,
        issueKey TEXT NOT NULL,
        PRIMARY KEY (sessionId, issueKey),
        FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS session_trend_attempts (
        artifactId TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        issueKey TEXT NOT NULL,
        issueLabel TEXT NOT NULL,
        kind TEXT,
        issueFamilyKey TEXT,
        issueFamilyLabel TEXT,
        outcome TEXT NOT NULL,
        outcomeCategory TEXT NOT NULL,
        seenAt TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (artifactId) REFERENCES artifacts(id) ON DELETE CASCADE,
        FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS session_trend_cache_state (
        sessionId TEXT PRIMARY KEY,
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS contexts (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        workspaceKey TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        mergedIntoContextId TEXT,
        metadata TEXT,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (mergedIntoContextId) REFERENCES contexts(id) ON DELETE SET NULL
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS context_session_links (
        sessionId TEXT PRIMARY KEY,
        contextId TEXT NOT NULL,
        linkSource TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (contextId) REFERENCES contexts(id) ON DELETE CASCADE
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS context_link_rejections (
        sessionId TEXT NOT NULL,
        contextId TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (sessionId, contextId),
        FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (contextId) REFERENCES contexts(id) ON DELETE CASCADE
      );
    `);

    db.exec(`
      CREATE TABLE IF NOT EXISTS context_workspace_preferences (
        workspaceKey TEXT PRIMARY KEY,
        contextId TEXT NOT NULL,
        createdAt TEXT NOT NULL DEFAULT (datetime('now')),
        updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (contextId) REFERENCES contexts(id) ON DELETE CASCADE
      );
    `);

    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_timestamp ON evidences(timestamp);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_conversation_id ON evidences(conversationId);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_content_hash ON evidences(contentHash);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_evidences_tags ON evidences(tags);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(startedAt DESC);`,
    );
    db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_host ON sessions(host);`);
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_sessions_status_started_at ON sessions(status, startedAt DESC);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_sessions_host_status_started_at ON sessions(host, status, startedAt DESC);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_messages_session_seq ON messages(sessionId, seq);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_messages_session_captured_at_seq ON messages(sessionId, capturedAt DESC, seq DESC, id DESC);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_timeline_session_seq ON timeline_events(sessionId, seq);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_artifacts_session ON artifacts(sessionId, artifactType);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_decisions_session ON decisions(sessionId, createdAt DESC);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_narratives_session ON narratives(sessionId, kind);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_ingestion_runs_session ON ingestion_runs(sessionId, startedAt DESC);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_session_history_cache_updated_at ON session_history_cache(updatedAt DESC);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_session_issue_keys_issue_key ON session_issue_keys(issueKey, sessionId);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_session_issue_keys_session_issue ON session_issue_keys(sessionId, issueKey);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_session_trend_attempts_session_seen_at ON session_trend_attempts(sessionId, seenAt DESC);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_session_trend_attempts_session_issue_key ON session_trend_attempts(sessionId, issueKey, seenAt DESC);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_session_trend_attempts_issue_key ON session_trend_attempts(issueKey, seenAt DESC);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_session_trend_attempts_issue_family_key ON session_trend_attempts(issueFamilyKey, seenAt DESC);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_session_trend_cache_state_updated_at ON session_trend_cache_state(updatedAt DESC);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_contexts_workspace_key_updated_at ON contexts(workspaceKey, updatedAt DESC);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_contexts_status_updated_at ON contexts(status, updatedAt DESC);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_context_session_links_context_id_updated_at ON context_session_links(contextId, updatedAt DESC);`,
    );
    db.exec(
      `CREATE INDEX IF NOT EXISTS idx_context_link_rejections_context_id ON context_link_rejections(contextId, sessionId);`,
    );

    db.prepare(
      `
        INSERT INTO metadata (key, value)
        VALUES ('schema_version', ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `,
    ).run(SCHEMA_VERSION);
  });

  initSchema();

  return {
    previousVersion,
    currentVersion,
    upgraded: previousVersion > 0 && previousVersion < currentVersion,
  };
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
    const evidencesTableInfo = db.pragma("table_info(evidences)") as Array<{
      name: string;
      type: string;
    }>;
    if (!evidencesTableInfo || evidencesTableInfo.length === 0) {
      return false;
    }

    // Check if metadata table exists
    const metadataTableInfo = db.pragma("table_info(metadata)") as Array<{
      name: string;
      type: string;
    }>;
    if (!metadataTableInfo || metadataTableInfo.length === 0) {
      return false;
    }

    // Check if crypto_keys table exists
    const cryptoKeysTableInfo = db.pragma("table_info(crypto_keys)") as Array<{
      name: string;
      type: string;
    }>;
    if (!cryptoKeysTableInfo || cryptoKeysTableInfo.length === 0) {
      return false;
    }

    const sessionsTableInfo = db.pragma("table_info(sessions)") as Array<{
      name: string;
      type: string;
    }>;
    if (!sessionsTableInfo || sessionsTableInfo.length === 0) {
      return false;
    }

    const messagesTableInfo = db.pragma("table_info(messages)") as Array<{
      name: string;
      type: string;
    }>;
    if (!messagesTableInfo || messagesTableInfo.length === 0) {
      return false;
    }

    const timelineTableInfo = db.pragma(
      "table_info(timeline_events)",
    ) as Array<{
      name: string;
      type: string;
    }>;
    if (!timelineTableInfo || timelineTableInfo.length === 0) {
      return false;
    }

    const artifactsTableInfo = db.pragma("table_info(artifacts)") as Array<{
      name: string;
      type: string;
    }>;
    if (!artifactsTableInfo || artifactsTableInfo.length === 0) {
      return false;
    }

    const decisionsTableInfo = db.pragma("table_info(decisions)") as Array<{
      name: string;
      type: string;
    }>;
    if (!decisionsTableInfo || decisionsTableInfo.length === 0) {
      return false;
    }

    const narrativesTableInfo = db.pragma("table_info(narratives)") as Array<{
      name: string;
      type: string;
    }>;
    if (!narrativesTableInfo || narrativesTableInfo.length === 0) {
      return false;
    }

    const ingestionRunsTableInfo = db.pragma(
      "table_info(ingestion_runs)",
    ) as Array<{
      name: string;
      type: string;
    }>;
    if (!ingestionRunsTableInfo || ingestionRunsTableInfo.length === 0) {
      return false;
    }

    // Verify required columns exist in evidences table
    const evidencesColumns = evidencesTableInfo.map((col) => col.name);
    const requiredColumns = [
      "id",
      "timestamp",
      "encryptedContent",
      "nonce",
      "contentHash",
      "messageCount",
      "createdAt",
      "updatedAt",
    ];

    for (const col of requiredColumns) {
      if (!evidencesColumns.includes(col)) {
        return false;
      }
    }

    const sessionColumns = sessionsTableInfo.map((col) => col.name);
    for (const col of ["id", "host", "status", "startedAt"]) {
      if (!sessionColumns.includes(col)) {
        return false;
      }
    }

    const messageColumns = messagesTableInfo.map((col) => col.name);
    for (const col of ["id", "sessionId", "seq", "role", "content"]) {
      if (!messageColumns.includes(col)) {
        return false;
      }
    }

    const timelineColumns = timelineTableInfo.map((col) => col.name);
    for (const col of ["id", "sessionId", "seq", "eventType", "startedAt"]) {
      if (!timelineColumns.includes(col)) {
        return false;
      }
    }

    const artifactColumns = artifactsTableInfo.map((col) => col.name);
    for (const col of ["id", "sessionId", "artifactType", "createdAt"]) {
      if (!artifactColumns.includes(col)) {
        return false;
      }
    }

    const decisionColumns = decisionsTableInfo.map((col) => col.name);
    for (const col of ["id", "sessionId", "title", "summary", "sourceRefs"]) {
      if (!decisionColumns.includes(col)) {
        return false;
      }
    }

    const narrativeColumns = narrativesTableInfo.map((col) => col.name);
    for (const col of ["id", "sessionId", "kind", "content", "sourceRefs"]) {
      if (!narrativeColumns.includes(col)) {
        return false;
      }
    }

    const ingestionRunColumns = ingestionRunsTableInfo.map((col) => col.name);
    for (const col of ["id", "sessionId", "stage", "status", "startedAt"]) {
      if (!ingestionRunColumns.includes(col)) {
        return false;
      }
    }

    const contextsTableInfo = db.pragma("table_info(contexts)") as Array<{
      name: string;
      type: string;
    }>;
    if (!contextsTableInfo || contextsTableInfo.length === 0) {
      return false;
    }

    const contextLinksTableInfo = db.pragma(
      "table_info(context_session_links)",
    ) as Array<{
      name: string;
      type: string;
    }>;
    if (!contextLinksTableInfo || contextLinksTableInfo.length === 0) {
      return false;
    }

    const contextRejectionsTableInfo = db.pragma(
      "table_info(context_link_rejections)",
    ) as Array<{
      name: string;
      type: string;
    }>;
    if (
      !contextRejectionsTableInfo ||
      contextRejectionsTableInfo.length === 0
    ) {
      return false;
    }

    const contextPreferencesTableInfo = db.pragma(
      "table_info(context_workspace_preferences)",
    ) as Array<{
      name: string;
      type: string;
    }>;
    if (
      !contextPreferencesTableInfo ||
      contextPreferencesTableInfo.length === 0
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
