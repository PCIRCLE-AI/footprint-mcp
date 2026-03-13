import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Database from "better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { EvidenceDatabase } from "../src/lib/storage/index.js";

function createLegacyCoreSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE metadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE sessions (
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

    CREATE TABLE messages (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      seq INTEGER NOT NULL,
      role TEXT NOT NULL,
      source TEXT NOT NULL,
      content TEXT NOT NULL,
      capturedAt TEXT NOT NULL,
      metadata TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (sessionId, seq)
    );

    CREATE TABLE timeline_events (
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
      UNIQUE (sessionId, seq)
    );

    CREATE TABLE artifacts (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      eventId TEXT,
      artifactType TEXT NOT NULL,
      path TEXT,
      metadata TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE decisions (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      rationale TEXT,
      status TEXT NOT NULL,
      sourceRefs TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE narratives (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      kind TEXT NOT NULL,
      content TEXT NOT NULL,
      sourceRefs TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE ingestion_runs (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      stage TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      startedAt TEXT NOT NULL,
      endedAt TEXT
    );
  `);
}

function createLegacyHistoryTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE session_history_cache (
      sessionId TEXT PRIMARY KEY,
      titleText TEXT NOT NULL DEFAULT '',
      metadataText TEXT NOT NULL DEFAULT '',
      messagesText TEXT NOT NULL DEFAULT '',
      artifactsText TEXT NOT NULL DEFAULT '',
      narrativesText TEXT NOT NULL DEFAULT '',
      decisionsText TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE session_issue_keys (
      sessionId TEXT NOT NULL,
      issueKey TEXT NOT NULL,
      PRIMARY KEY (sessionId, issueKey)
    );
  `);
}

function createLegacyTrendTables(db: Database.Database): void {
  db.exec(`
    CREATE TABLE session_trend_attempts (
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
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE session_trend_cache_state (
      sessionId TEXT PRIMARY KEY,
      updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function seedLegacySession(
  db: Database.Database,
  sessionId: string,
  options?: {
    title?: string;
    message?: string;
    issueKey?: string;
    issueLabel?: string;
    outcome?: string;
  },
): void {
  const title = options?.title ?? "Legacy browser retry";
  const message = options?.message ?? "Next: retry browser coverage?";
  const issueKey = options?.issueKey ?? "test:pnpm-test-browser";
  const issueLabel = options?.issueLabel ?? "pnpm test:browser";
  const outcome = options?.outcome ?? "failed";

  db.prepare(
    `
      INSERT INTO metadata (key, value)
      VALUES ('schema_version', ?)
    `,
  ).run("0");

  db.prepare(
    `
      INSERT INTO sessions (
        id, host, projectRoot, cwd, title, status, startedAt, endedAt, metadata
      ) VALUES (?, 'claude', '/tmp/project', '/tmp/project', ?, 'failed', ?, ?, ?)
    `,
  ).run(
    sessionId,
    title,
    "2026-03-11T10:00:00.000Z",
    "2026-03-11T10:05:00.000Z",
    JSON.stringify({ branch: "main", transport: "pty" }),
  );

  db.prepare(
    `
      INSERT INTO messages (
        id, sessionId, seq, role, source, content, capturedAt, metadata
      ) VALUES (?, ?, 1, 'assistant', 'wrapper', ?, ?, NULL)
    `,
  ).run(
    `${sessionId}-message-1`,
    sessionId,
    message,
    "2026-03-11T10:00:10.000Z",
  );

  db.prepare(
    `
      INSERT INTO timeline_events (
        id, sessionId, seq, eventType, eventSubType, source, summary, payload,
        startedAt, endedAt, status, relatedMessageId
      ) VALUES (?, ?, 1, 'command.completed', 'pnpm', 'wrapper', ?, ?, ?, ?, ?, NULL)
    `,
  ).run(
    `${sessionId}-event-1`,
    sessionId,
    issueLabel,
    JSON.stringify({
      command: "pnpm",
      args: ["test:browser"],
      exitCode: outcome === "failed" ? 1 : 0,
    }),
    "2026-03-11T10:00:05.000Z",
    "2026-03-11T10:00:09.000Z",
    outcome,
  );

  db.prepare(
    `
      INSERT INTO artifacts (
        id, sessionId, eventId, artifactType, path, metadata, createdAt
      ) VALUES (?, ?, ?, 'command-output', NULL, ?, ?)
    `,
  ).run(
    `${sessionId}-artifact-1`,
    sessionId,
    `${sessionId}-event-1`,
    JSON.stringify({
      summary: issueLabel,
      category: "test",
      intent: "test",
      issueKey,
      issueLabel,
      issueFamilyKey: "test-family:pnpm",
      issueFamilyLabel: "pnpm tests",
      outcome,
      eventType: "command.completed",
      sourceRefs: [{ type: "event", id: `${sessionId}-event-1` }],
    }),
    "2026-03-11T10:00:09.000Z",
  );

  db.prepare(
    `
      INSERT INTO narratives (
        id, sessionId, kind, content, sourceRefs
      ) VALUES (?, ?, 'handoff', ?, '[]')
    `,
  ).run(
    `${sessionId}-narrative-1`,
    sessionId,
    "Legacy handoff: browser retry still blocked.",
  );
}

describe("Schema Migrations", () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), "footprint-schema-"));
    dbPath = path.join(tempDir, "footprint.db");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("upgrades v3 databases and eagerly backfills history and trend caches", () => {
    const legacy = new Database(dbPath);
    createLegacyCoreSchema(legacy);
    seedLegacySession(legacy, "legacy-v3");
    legacy
      .prepare(`UPDATE metadata SET value = '3' WHERE key = 'schema_version'`)
      .run();
    legacy.close();

    const migrated = new EvidenceDatabase(dbPath);
    const rawDb = (migrated as unknown as { db: Database.Database }).db;

    expect(
      rawDb
        .prepare(`SELECT value FROM metadata WHERE key = 'schema_version'`)
        .get(),
    ).toEqual({ value: "9" });
    expect(
      rawDb
        .prepare(
          `
            SELECT key, value
            FROM metadata
            WHERE key IN (
              'session_history_cache_version',
              'session_trend_cache_version'
            )
            ORDER BY key ASC
          `,
        )
        .all(),
    ).toEqual([
      { key: "session_history_cache_version", value: "1" },
      { key: "session_trend_cache_version", value: "1" },
    ]);
    expect(
      rawDb
        .prepare(
          `
            SELECT titleText, messagesText, artifactsText, narrativesText
            FROM session_history_cache
            WHERE sessionId = 'legacy-v3'
          `,
        )
        .get(),
    ).toEqual(
      expect.objectContaining({
        titleText: "Legacy browser retry",
        messagesText: expect.stringContaining("retry browser coverage"),
        artifactsText: expect.stringContaining("test:pnpm-test-browser"),
        narrativesText: expect.stringContaining("Legacy handoff"),
      }),
    );
    expect(
      rawDb.prepare(`SELECT issueKey FROM session_issue_keys`).all(),
    ).toEqual([{ issueKey: "test:pnpm-test-browser" }]);
    expect(
      rawDb.prepare(`SELECT sessionId FROM session_trend_cache_state`).all(),
    ).toEqual([{ sessionId: "legacy-v3" }]);
    expect(migrated.querySessionTrendAttempts()).toEqual([
      expect.objectContaining({
        sessionId: "legacy-v3",
        issueKey: "test:pnpm-test-browser",
        outcomeCategory: "failed",
      }),
    ]);
    expect(
      migrated.querySessionsByHistory({ query: "retry browser coverage" }),
    ).toEqual({
      total: 1,
      sessions: [expect.objectContaining({ id: "legacy-v3" })],
    });

    migrated.close();
  });

  it("upgrades v4 databases by rebuilding stale history cache rows and backfilling trends", () => {
    const legacy = new Database(dbPath);
    createLegacyCoreSchema(legacy);
    createLegacyHistoryTables(legacy);
    seedLegacySession(legacy, "legacy-v4", {
      title: "Legacy cached handoff",
      message: "Next: verify cached history survives?",
    });
    legacy
      .prepare(`UPDATE metadata SET value = '4' WHERE key = 'schema_version'`)
      .run();
    legacy
      .prepare(
        `
          INSERT INTO session_history_cache (
            sessionId, titleText, metadataText, messagesText,
            artifactsText, narrativesText, decisionsText, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        "legacy-v4",
        "Legacy cached handoff",
        "",
        "cached follow-up text",
        "cached artifact text",
        "cached narrative text",
        "",
        "2026-03-11T10:06:00.000Z",
      );
    legacy
      .prepare(
        `
          INSERT INTO session_issue_keys (sessionId, issueKey)
          VALUES ('legacy-v4', 'test:pnpm-test-browser')
        `,
      )
      .run();
    legacy.close();

    const migrated = new EvidenceDatabase(dbPath);
    const rawDb = (migrated as unknown as { db: Database.Database }).db;

    expect(
      rawDb
        .prepare(
          `
            SELECT messagesText, artifactsText, narrativesText
            FROM session_history_cache
            WHERE sessionId = 'legacy-v4'
          `,
        )
        .get(),
    ).toEqual(
      expect.objectContaining({
        messagesText: expect.stringContaining(
          "Next: verify cached history survives?",
        ),
        artifactsText: expect.stringContaining("test:pnpm-test-browser"),
        narrativesText: expect.stringContaining(
          "Legacy handoff: browser retry still blocked.",
        ),
      }),
    );
    expect(
      rawDb
        .prepare(
          `
            SELECT key, value
            FROM metadata
            WHERE key IN (
              'session_history_cache_version',
              'session_trend_cache_version'
            )
            ORDER BY key ASC
          `,
        )
        .all(),
    ).toEqual([
      { key: "session_history_cache_version", value: "1" },
      { key: "session_trend_cache_version", value: "1" },
    ]);
    expect(migrated.querySessionTrendAttempts()).toEqual([
      expect.objectContaining({
        sessionId: "legacy-v4",
        issueKey: "test:pnpm-test-browser",
      }),
    ]);
    expect(
      rawDb.prepare(`SELECT sessionId FROM session_trend_cache_state`).all(),
    ).toEqual([{ sessionId: "legacy-v4" }]);

    migrated.close();
  });

  it("upgrades v6 databases by rebuilding stale trend attempts without duplication", () => {
    const legacy = new Database(dbPath);
    createLegacyCoreSchema(legacy);
    createLegacyHistoryTables(legacy);
    createLegacyTrendTables(legacy);
    seedLegacySession(legacy, "legacy-v6");
    legacy
      .prepare(`UPDATE metadata SET value = '6' WHERE key = 'schema_version'`)
      .run();
    legacy
      .prepare(
        `
          INSERT INTO session_history_cache (
            sessionId, titleText, metadataText, messagesText,
            artifactsText, narrativesText, decisionsText, updatedAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        "legacy-v6",
        "Legacy browser retry",
        '{"branch":"main","transport":"pty"}',
        "Next: retry browser coverage?",
        "pnpm test:browser test:pnpm-test-browser",
        "Legacy handoff: browser retry still blocked.",
        "",
        "2026-03-11T10:06:00.000Z",
      );
    legacy
      .prepare(
        `
          INSERT INTO session_issue_keys (sessionId, issueKey)
          VALUES ('legacy-v6', 'test:pnpm-test-browser')
        `,
      )
      .run();
    legacy
      .prepare(
        `
          INSERT INTO session_trend_attempts (
            artifactId, sessionId, issueKey, issueLabel, kind, issueFamilyKey,
            issueFamilyLabel, outcome, outcomeCategory, seenAt, createdAt
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      )
      .run(
        "legacy-v6-artifact-1",
        "legacy-v6",
        "test:pnpm-test-browser",
        "stale issue label",
        "test",
        "test-family:pnpm",
        "stale family label",
        "failed",
        "failed",
        "2026-03-11T10:00:09.000Z",
        "2026-03-11T10:00:09.000Z",
      );
    legacy
      .prepare(
        `
          INSERT INTO session_trend_cache_state (sessionId, updatedAt)
          VALUES ('legacy-v6', ?)
        `,
      )
      .run("2026-03-11T10:06:00.000Z");
    legacy.close();

    const migrated = new EvidenceDatabase(dbPath);
    const rawDb = (migrated as unknown as { db: Database.Database }).db;

    expect(
      rawDb
        .prepare(`SELECT value FROM metadata WHERE key = 'schema_version'`)
        .get(),
    ).toEqual({ value: "9" });
    expect(
      rawDb
        .prepare(`SELECT COUNT(*) as count FROM session_trend_attempts`)
        .get(),
    ).toEqual({ count: 1 });
    expect(migrated.querySessionTrendAttempts()).toEqual([
      expect.objectContaining({
        artifactId: "legacy-v6-artifact-1",
        sessionId: "legacy-v6",
        issueKey: "test:pnpm-test-browser",
        issueLabel: "pnpm test:browser",
        issueFamilyLabel: "pnpm tests",
      }),
    ]);
    expect(
      rawDb
        .prepare(
          `
            SELECT key, value
            FROM metadata
            WHERE key IN (
              'session_history_cache_version',
              'session_trend_cache_version'
            )
            ORDER BY key ASC
          `,
        )
        .all(),
    ).toEqual([
      { key: "session_history_cache_version", value: "1" },
      { key: "session_trend_cache_version", value: "1" },
    ]);

    migrated.close();
  });
});
