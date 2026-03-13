/* global Buffer, crypto */
import Database from "better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  getArtifactSearchableText,
  parseArtifactMetadata,
} from "../session-artifacts.js";
import { traceSyncOperation } from "../observability.js";
import { createSchema } from "./schema.js";
import type {
  ArtifactRecord,
  ArtifactType,
  ContextLinkRejectionRecord,
  ContextLinkSource,
  ContextRecord,
  ContextSessionLinkRecord,
  ContextStatus,
  ContextWorkspacePreferenceRecord,
  DecisionRecord,
  DecisionStatus,
  Evidence,
  IngestionRunRecord,
  IngestionStage,
  IngestionStatus,
  NarrativeKind,
  NarrativeRecord,
  SessionDetail,
  SessionHost,
  SessionMessageRecord,
  SessionMessageRole,
  SessionRecord,
  SessionStatus,
  TimelineEventRecord,
} from "./types.js";

function escapeLikePattern(pattern: string): string {
  return pattern.replace(/[%_\\]/g, "\\$&");
}

function normalizeWorkspaceKeyForMatching(value: string): string {
  const resolved = path.resolve(value);
  try {
    return fs.realpathSync.native(resolved);
  } catch {
    return resolved;
  }
}

function matchesWorkspaceKey(
  session: Pick<SessionRecord, "projectRoot" | "cwd">,
  workspaceKey: string,
): boolean {
  const normalizedWorkspaceKey = normalizeWorkspaceKeyForMatching(workspaceKey);
  return (
    normalizeWorkspaceKeyForMatching(session.projectRoot) ===
      normalizedWorkspaceKey ||
    normalizeWorkspaceKeyForMatching(session.cwd) === normalizedWorkspaceKey
  );
}

/**
 * Append LIMIT/OFFSET clause to SQL query string.
 * Mutates the params array by pushing limit/offset values.
 * @returns The query string with pagination appended.
 */
function appendPaginationClause(
  query: string,
  params: (string | number)[],
  limit?: number,
  offset?: number,
): string {
  const off = offset ?? 0;
  if (limit !== undefined) {
    query += " LIMIT ?";
    params.push(limit);
    if (off > 0) {
      query += " OFFSET ?";
      params.push(off);
    }
  } else if (off > 0) {
    query += " LIMIT -1 OFFSET ?";
    params.push(off);
  }
  return query;
}

function formatDbError(action: string, error: unknown): Error {
  return new Error(
    `Failed to ${action}: ${error instanceof Error ? error.message : String(error)}`,
    { cause: error },
  );
}

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

interface SessionRow {
  id: string;
  host: SessionRecord["host"];
  projectRoot: string;
  cwd: string;
  title: string | null;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ContextRow {
  id: string;
  label: string;
  workspaceKey: string;
  status: ContextStatus;
  mergedIntoContextId: string | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ContextSessionLinkRow {
  sessionId: string;
  contextId: string;
  linkSource: ContextLinkSource;
  createdAt: string;
  updatedAt: string;
}

interface ContextLinkRejectionRow {
  sessionId: string;
  contextId: string;
  createdAt: string;
}

interface ContextWorkspacePreferenceRow {
  workspaceKey: string;
  contextId: string;
  createdAt: string;
  updatedAt: string;
}

interface MessageRow {
  id: string;
  sessionId: string;
  seq: number;
  role: SessionMessageRole;
  source: string;
  content: string;
  capturedAt: string;
  metadata: string | null;
}

interface TimelineEventRow {
  id: string;
  sessionId: string;
  seq: number;
  eventType: string;
  eventSubType: string | null;
  source: string;
  summary: string | null;
  payload: string | null;
  startedAt: string;
  endedAt: string | null;
  status: string | null;
  relatedMessageId: string | null;
}

interface ArtifactRow {
  id: string;
  sessionId: string;
  eventId: string | null;
  artifactType: ArtifactType;
  path: string | null;
  metadata: string | null;
  createdAt: string;
}

interface DecisionRow {
  id: string;
  sessionId: string;
  title: string;
  summary: string;
  rationale: string | null;
  status: DecisionStatus;
  sourceRefs: string;
  createdAt: string;
}

interface NarrativeRow {
  id: string;
  sessionId: string;
  kind: NarrativeKind;
  content: string;
  sourceRefs: string;
  createdAt: string;
  updatedAt: string;
}

interface IngestionRunRow {
  id: string;
  sessionId: string;
  stage: IngestionStage;
  status: IngestionStatus;
  error: string | null;
  startedAt: string;
  endedAt: string | null;
}

interface SessionHistoryCacheRow {
  sessionId: string;
  titleText: string;
  metadataText: string;
  messagesText: string;
  artifactsText: string;
  narrativesText: string;
  decisionsText: string;
  updatedAt: string;
}

interface SessionHistoryQueryOptions {
  host?: SessionHost;
  status?: SessionStatus;
  query?: string;
  issueKey?: string;
  sessionIds?: string[];
  limit?: number;
  offset?: number;
}

interface SessionTrendAttemptRow {
  artifactId: string;
  sessionId: string;
  issueKey: string;
  issueLabel: string;
  kind: string | null;
  issueFamilyKey: string | null;
  issueFamilyLabel: string | null;
  outcome: string;
  outcomeCategory: "failed" | "succeeded" | "other";
  seenAt: string;
  createdAt: string;
}

interface TrendAttemptQueryOptions {
  host?: SessionHost;
  status?: SessionStatus;
  sessionIds?: string[];
}

interface FollowUpMessageRow {
  id: string;
  sessionId: string;
  content: string;
  capturedAt: string;
  seq: number;
}

type SessionTrendAttemptQueryRow = SessionTrendAttemptRow & {
  host: SessionHost;
  status: SessionStatus;
  cwd: string;
  startedAt: string;
  endedAt: string | null;
  title: string | null;
};

const TREND_FAILED_OUTCOME_PATTERN =
  /\b(?:fail|failed|error|timeout|timed-out|interrupted|non-zero)\b/i;
const TREND_SUCCEEDED_OUTCOME_PATTERN =
  /\b(?:success|succeeded|passed|completed|captured|ok)\b/i;
const SESSION_HISTORY_CACHE_VERSION_KEY = "session_history_cache_version";
const SESSION_TREND_CACHE_VERSION_KEY = "session_trend_cache_version";
const CURRENT_SESSION_HISTORY_CACHE_VERSION = 1;
const CURRENT_SESSION_TREND_CACHE_VERSION = 1;

/**
 * Evidence database with CRUD operations
 * Manages encrypted evidence storage with SQLite backend
 */
export class EvidenceDatabase {
  private db: Database.Database;
  private sessionHistoryCacheBackfilled = false;
  private sessionTrendAttemptsBackfilled = false;

  /**
   * Creates or opens an evidence database
   * @param dbPath - Path to SQLite database file
   * @throws Error if database initialization fails
   */
  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    try {
      createSchema(this.db);
      this.initializeMaterializedCaches();
    } catch (error) {
      // Clean up database connection on any initialization failure
      this.db.close();
      throw formatDbError("initialize database", error);
    }
  }

  private getMetadataValue(key: string): string | null {
    const row = this.db
      .prepare(
        `
          SELECT value
          FROM metadata
          WHERE key = ?
        `,
      )
      .get(key) as { value: string } | undefined;

    return row?.value ?? null;
  }

  private getMetadataVersion(key: string): number {
    const value = this.getMetadataValue(key);
    const parsed = Number.parseInt(value ?? "", 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private setMetadataValue(key: string, value: string): void {
    this.db
      .prepare(
        `
          INSERT INTO metadata (key, value)
          VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `,
      )
      .run(key, value);
  }

  private getAllSessionIds(): string[] {
    return (
      this.db
        .prepare(
          `
            SELECT id
            FROM sessions
            ORDER BY startedAt ASC, id ASC
          `,
        )
        .all() as Array<{ id: string }>
    ).map((row) => row.id);
  }

  private initializeMaterializedCaches(): void {
    if (
      this.getMetadataVersion(SESSION_HISTORY_CACHE_VERSION_KEY) <
      CURRENT_SESSION_HISTORY_CACHE_VERSION
    ) {
      this.rebuildAllSessionHistoryCaches();
      this.setMetadataValue(
        SESSION_HISTORY_CACHE_VERSION_KEY,
        String(CURRENT_SESSION_HISTORY_CACHE_VERSION),
      );
      this.sessionHistoryCacheBackfilled = true;
    } else {
      this.sessionHistoryCacheBackfilled = false;
      this.ensureSessionHistoryCacheBackfilled();
    }

    if (
      this.getMetadataVersion(SESSION_TREND_CACHE_VERSION_KEY) <
      CURRENT_SESSION_TREND_CACHE_VERSION
    ) {
      this.rebuildAllSessionTrendAttempts();
      this.setMetadataValue(
        SESSION_TREND_CACHE_VERSION_KEY,
        String(CURRENT_SESSION_TREND_CACHE_VERSION),
      );
      this.sessionTrendAttemptsBackfilled = true;
    } else {
      this.sessionTrendAttemptsBackfilled = false;
      this.ensureSessionTrendAttemptsBackfilled();
    }
  }

  private dbOp<T>(action: string, fn: () => T): T {
    try {
      return fn();
    } catch (error) {
      throw formatDbError(action, error);
    }
  }

  private resolveActiveContextIdOrThrow(contextId: string): string {
    let currentId = contextId.trim();
    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) {
        throw new Error(`Context merge loop detected for ${contextId}`);
      }
      visited.add(currentId);

      const row = this.db
        .prepare(
          `
            SELECT id, status, mergedIntoContextId
            FROM contexts
            WHERE id = ?
          `,
        )
        .get(currentId) as
        | Pick<ContextRow, "id" | "status" | "mergedIntoContextId">
        | undefined;

      if (!row) {
        throw new Error(`Context not found: ${contextId}`);
      }

      if (row.status !== "merged" || !row.mergedIntoContextId) {
        return row.id;
      }

      currentId = row.mergedIntoContextId;
    }

    throw new Error(`Context not found: ${contextId}`);
  }

  /**
   * Creates a new evidence record
   * @param evidence - Evidence data without id, createdAt, updatedAt
   * @returns UUID of created evidence
   */
  create(evidence: Omit<Evidence, "id" | "createdAt" | "updatedAt">): string {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    return this.dbOp("create evidence", () => {
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
        now,
      );

      return id;
    });
  }

  /**
   * Finds evidence by ID
   * @param id - Evidence UUID
   * @returns Evidence or null if not found
   */
  findById(id: string): Evidence | null {
    return this.dbOp("find evidence by ID", () => {
      const stmt = this.db.prepare(`
        SELECT * FROM evidences WHERE id = ?
      `);

      const row = stmt.get(id) as EvidenceRow | undefined;
      if (!row) {
        return null;
      }

      return this.rowToEvidence(row);
    });
  }

  /**
   * Finds all evidences for a conversation
   * @param conversationId - Conversation identifier
   * @returns Array of evidences (empty if none found)
   */
  findByConversationId(conversationId: string): Evidence[] {
    return this.dbOp("find evidences by conversationId", () => {
      const stmt = this.db.prepare(`
        SELECT * FROM evidences
        WHERE conversationId = ?
        ORDER BY timestamp ASC
      `);

      const rows = stmt.all(conversationId) as EvidenceRow[];
      return rows.map((row) => this.rowToEvidence(row));
    });
  }

  /**
   * Lists evidences with pagination
   * @param options - Pagination options (limit, offset)
   * @returns Array of evidences
   */
  list(options?: { limit?: number; offset?: number }): Evidence[] {
    return this.dbOp("list evidences", () => {
      const params: (string | number)[] = [];
      const query = appendPaginationClause(
        "SELECT * FROM evidences ORDER BY timestamp DESC",
        params,
        options?.limit,
        options?.offset,
      );

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params) as EvidenceRow[];
      return rows.map((row) => this.rowToEvidence(row));
    });
  }

  private static joinSearchParts(parts: string[]): string {
    return parts
      .map((part) => part.trim())
      .filter(Boolean)
      .join("\n");
  }

  private static appendSearchPart(existing: string, addition: string): string {
    const normalizedAddition = addition.trim();
    if (!normalizedAddition) {
      return existing;
    }

    return existing.trim()
      ? `${existing}\n${normalizedAddition}`
      : normalizedAddition;
  }

  private static normalizeTrendOutcome(
    value: string | null,
  ): "failed" | "succeeded" | "other" {
    if (!value) {
      return "other";
    }

    if (TREND_FAILED_OUTCOME_PATTERN.test(value)) {
      return "failed";
    }

    if (TREND_SUCCEEDED_OUTCOME_PATTERN.test(value)) {
      return "succeeded";
    }

    return "other";
  }

  private buildArtifactHistoryCache(
    artifacts: Array<
      Pick<ArtifactRecord, "artifactType" | "path" | "metadata">
    >,
  ): { text: string; issueKeys: string[] } {
    const issueKeys = new Set<string>();
    const text = EvidenceDatabase.joinSearchParts(
      artifacts.flatMap((artifact) => {
        const metadata = parseArtifactMetadata(artifact.metadata);
        if (metadata.issueKey) {
          issueKeys.add(metadata.issueKey);
        }

        return getArtifactSearchableText(artifact);
      }),
    );

    return {
      text,
      issueKeys: Array.from(issueKeys).sort(),
    };
  }

  private buildNarrativeHistoryCache(
    narratives: Array<Pick<NarrativeRecord, "content">>,
  ): string {
    return EvidenceDatabase.joinSearchParts(
      narratives.map((narrative) => narrative.content),
    );
  }

  private buildDecisionHistoryCache(
    decisions: Array<Pick<DecisionRecord, "summary">>,
  ): string {
    return EvidenceDatabase.joinSearchParts(
      decisions.map((decision) => decision.summary),
    );
  }

  private ensureSessionHistoryCacheRow(sessionId: string): void {
    this.db
      .prepare(
        `
          INSERT INTO session_history_cache (
            sessionId, titleText, metadataText, messagesText,
            artifactsText, narrativesText, decisionsText, updatedAt
          )
          SELECT
            id,
            COALESCE(title, ''),
            COALESCE(metadata, ''),
            '',
            '',
            '',
            '',
            ?
          FROM sessions
          WHERE id = ?
          ON CONFLICT(sessionId) DO NOTHING
        `,
      )
      .run(new Date().toISOString(), sessionId);
  }

  private updateSessionHistoryCache(
    sessionId: string,
    updates: Partial<Omit<SessionHistoryCacheRow, "sessionId" | "updatedAt">>,
  ): void {
    this.ensureSessionHistoryCacheRow(sessionId);

    const current = this.db
      .prepare(
        `
          SELECT * FROM session_history_cache
          WHERE sessionId = ?
        `,
      )
      .get(sessionId) as SessionHistoryCacheRow | undefined;

    if (!current) {
      return;
    }

    const next: SessionHistoryCacheRow = {
      ...current,
      ...updates,
      sessionId,
      updatedAt: new Date().toISOString(),
    };

    this.db
      .prepare(
        `
          UPDATE session_history_cache
          SET titleText = ?,
              metadataText = ?,
              messagesText = ?,
              artifactsText = ?,
              narrativesText = ?,
              decisionsText = ?,
              updatedAt = ?
          WHERE sessionId = ?
        `,
      )
      .run(
        next.titleText,
        next.metadataText,
        next.messagesText,
        next.artifactsText,
        next.narrativesText,
        next.decisionsText,
        next.updatedAt,
        sessionId,
      );
  }

  private replaceSessionIssueKeys(
    sessionId: string,
    issueKeys: string[],
  ): void {
    this.db
      .prepare(`DELETE FROM session_issue_keys WHERE sessionId = ?`)
      .run(sessionId);

    const insertIssueKey = this.db.prepare(
      `
        INSERT INTO session_issue_keys (sessionId, issueKey)
        VALUES (?, ?)
      `,
    );

    for (const issueKey of issueKeys) {
      insertIssueKey.run(sessionId, issueKey);
    }
  }

  private rebuildSessionHistoryCache(sessionId: string): void {
    const session = this.findSessionById(sessionId);
    if (!session) {
      return;
    }

    const messagesText = EvidenceDatabase.joinSearchParts(
      this.getSessionMessages(sessionId).map((message) => message.content),
    );
    const artifacts = this.getSessionArtifacts(sessionId);
    const artifactCache = this.buildArtifactHistoryCache(artifacts);
    const narrativesText = this.buildNarrativeHistoryCache(
      this.getSessionNarratives(sessionId),
    );
    const decisionsText = this.buildDecisionHistoryCache(
      this.getSessionDecisions(sessionId),
    );

    this.updateSessionHistoryCache(sessionId, {
      titleText: session.title ?? "",
      metadataText: session.metadata ?? "",
      messagesText,
      artifactsText: artifactCache.text,
      narrativesText,
      decisionsText,
    });
    this.replaceSessionIssueKeys(sessionId, artifactCache.issueKeys);
  }

  private ensureSessionHistoryCacheBackfilled(): void {
    if (this.sessionHistoryCacheBackfilled) {
      return;
    }

    const missingRows = this.db
      .prepare(
        `
          SELECT s.id
          FROM sessions s
          LEFT JOIN session_history_cache cache ON cache.sessionId = s.id
          WHERE cache.sessionId IS NULL
          ORDER BY s.startedAt ASC, s.id ASC
        `,
      )
      .all() as Array<{ id: string }>;

    for (const row of missingRows) {
      this.rebuildSessionHistoryCache(row.id);
    }

    this.sessionHistoryCacheBackfilled = true;
  }

  private rebuildAllSessionHistoryCaches(): void {
    for (const sessionId of this.getAllSessionIds()) {
      this.rebuildSessionHistoryCache(sessionId);
    }
  }

  private fetchTrendSeenAtByEventIds(
    sessionId: string,
    eventIds: string[],
  ): Map<string, string> {
    if (eventIds.length === 0) {
      return new Map();
    }

    const placeholders = eventIds.map(() => "?").join(", ");
    const rows = this.db
      .prepare(
        `
          SELECT id, COALESCE(endedAt, startedAt) as seenAt
          FROM timeline_events
          WHERE sessionId = ? AND id IN (${placeholders})
        `,
      )
      .all(sessionId, ...eventIds) as Array<{ id: string; seenAt: string }>;

    return new Map(rows.map((row) => [row.id, row.seenAt]));
  }

  private buildSessionTrendAttempts(
    sessionId: string,
    artifacts: ArtifactRecord[],
  ): SessionTrendAttemptRow[] {
    const eventIds = [
      ...new Set(
        artifacts
          .map((artifact) => artifact.eventId)
          .filter((eventId): eventId is string => Boolean(eventId)),
      ),
    ];
    const seenAtByEventId = this.fetchTrendSeenAtByEventIds(
      sessionId,
      eventIds,
    );

    return artifacts.flatMap((artifact) => {
      const metadata = parseArtifactMetadata(artifact.metadata);
      const eventType =
        typeof metadata.details.eventType === "string"
          ? metadata.details.eventType
          : null;
      const outcome = metadata.outcome ?? metadata.status ?? "captured";
      const outcomeCategory = EvidenceDatabase.normalizeTrendOutcome(outcome);

      if (!artifact.eventId || !metadata.issueKey) {
        return [];
      }
      if (
        !eventType ||
        (!eventType.startsWith("command.") && !eventType.startsWith("test."))
      ) {
        return [];
      }
      if (outcomeCategory === "other") {
        return [];
      }

      return [
        {
          artifactId: artifact.id,
          sessionId,
          issueKey: metadata.issueKey,
          issueLabel: metadata.issueLabel ?? metadata.issueKey,
          kind: metadata.intent ?? metadata.category,
          issueFamilyKey: metadata.issueFamilyKey,
          issueFamilyLabel:
            metadata.issueFamilyLabel ??
            metadata.issueFamilyKey ??
            metadata.issueLabel,
          outcome,
          outcomeCategory,
          seenAt: seenAtByEventId.get(artifact.eventId) ?? artifact.createdAt,
          createdAt: artifact.createdAt,
        },
      ];
    });
  }

  private markSessionTrendAttemptsFresh(sessionId: string): void {
    this.db
      .prepare(
        `
          INSERT INTO session_trend_cache_state (sessionId, updatedAt)
          VALUES (?, ?)
          ON CONFLICT(sessionId) DO UPDATE SET updatedAt = excluded.updatedAt
        `,
      )
      .run(sessionId, new Date().toISOString());
  }

  private replaceSessionTrendAttempts(
    sessionId: string,
    artifacts: ArtifactRecord[],
  ): void {
    this.db
      .prepare(`DELETE FROM session_trend_attempts WHERE sessionId = ?`)
      .run(sessionId);

    const attempts = this.buildSessionTrendAttempts(sessionId, artifacts);
    if (attempts.length === 0) {
      this.markSessionTrendAttemptsFresh(sessionId);
      return;
    }

    const insertAttempt = this.db.prepare(
      `
        INSERT INTO session_trend_attempts (
          artifactId, sessionId, issueKey, issueLabel, kind,
          issueFamilyKey, issueFamilyLabel, outcome, outcomeCategory,
          seenAt, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    );

    for (const attempt of attempts) {
      insertAttempt.run(
        attempt.artifactId,
        attempt.sessionId,
        attempt.issueKey,
        attempt.issueLabel,
        attempt.kind,
        attempt.issueFamilyKey,
        attempt.issueFamilyLabel,
        attempt.outcome,
        attempt.outcomeCategory,
        attempt.seenAt,
        attempt.createdAt,
      );
    }

    this.markSessionTrendAttemptsFresh(sessionId);
  }

  private insertSessionTrendAttempts(
    sessionId: string,
    artifacts: ArtifactRecord[],
  ): void {
    const attempts = this.buildSessionTrendAttempts(sessionId, artifacts);
    if (attempts.length === 0) {
      this.markSessionTrendAttemptsFresh(sessionId);
      return;
    }

    const insertAttempt = this.db.prepare(
      `
        INSERT INTO session_trend_attempts (
          artifactId, sessionId, issueKey, issueLabel, kind,
          issueFamilyKey, issueFamilyLabel, outcome, outcomeCategory,
          seenAt, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(artifactId) DO UPDATE SET
          sessionId = excluded.sessionId,
          issueKey = excluded.issueKey,
          issueLabel = excluded.issueLabel,
          kind = excluded.kind,
          issueFamilyKey = excluded.issueFamilyKey,
          issueFamilyLabel = excluded.issueFamilyLabel,
          outcome = excluded.outcome,
          outcomeCategory = excluded.outcomeCategory,
          seenAt = excluded.seenAt,
          createdAt = excluded.createdAt
      `,
    );

    for (const attempt of attempts) {
      insertAttempt.run(
        attempt.artifactId,
        attempt.sessionId,
        attempt.issueKey,
        attempt.issueLabel,
        attempt.kind,
        attempt.issueFamilyKey,
        attempt.issueFamilyLabel,
        attempt.outcome,
        attempt.outcomeCategory,
        attempt.seenAt,
        attempt.createdAt,
      );
    }

    this.markSessionTrendAttemptsFresh(sessionId);
  }

  private rebuildSessionTrendAttempts(sessionId: string): void {
    const session = this.findSessionById(sessionId);
    if (!session) {
      return;
    }

    this.replaceSessionTrendAttempts(
      sessionId,
      this.getSessionArtifacts(sessionId),
    );
  }

  private ensureSessionTrendAttemptsBackfilled(): void {
    if (this.sessionTrendAttemptsBackfilled) {
      return;
    }

    const missingRows = this.db
      .prepare(
        `
          SELECT s.id
          FROM sessions s
          LEFT JOIN session_trend_cache_state state ON state.sessionId = s.id
          WHERE state.sessionId IS NULL
          ORDER BY s.startedAt ASC, s.id ASC
        `,
      )
      .all() as Array<{ id: string }>;

    for (const row of missingRows) {
      this.rebuildSessionTrendAttempts(row.id);
    }

    this.sessionTrendAttemptsBackfilled = true;
  }

  private rebuildAllSessionTrendAttempts(): void {
    for (const sessionId of this.getAllSessionIds()) {
      this.rebuildSessionTrendAttempts(sessionId);
    }
  }

  querySessionsByHistory(options: SessionHistoryQueryOptions): {
    sessions: SessionRecord[];
    total: number;
  } {
    return traceSyncOperation(
      "db.query-sessions-by-history",
      {
        host: options.host,
        status: options.status,
        hasQuery: Boolean(options.query?.trim()),
        issueKey: options.issueKey?.trim() || undefined,
        sessionIds: options.sessionIds?.length ?? 0,
        limit: options.limit,
        offset: options.offset,
      },
      () =>
        this.dbOp("query sessions by history", () => {
          this.ensureSessionHistoryCacheBackfilled();

          const conditions: string[] = [];
          const params: Array<string | number> = [];

          if (options.host) {
            conditions.push(`s.host = ?`);
            params.push(options.host);
          }

          if (options.status) {
            conditions.push(`s.status = ?`);
            params.push(options.status);
          }

          if (options.query && options.query.trim()) {
            const pattern = `%${escapeLikePattern(options.query.trim())}%`;
            conditions.push(`
              (
                cache.titleText LIKE ? ESCAPE '\\'
                OR cache.metadataText LIKE ? ESCAPE '\\'
                OR cache.messagesText LIKE ? ESCAPE '\\'
                OR cache.artifactsText LIKE ? ESCAPE '\\'
                OR cache.narrativesText LIKE ? ESCAPE '\\'
                OR cache.decisionsText LIKE ? ESCAPE '\\'
              )
            `);
            params.push(pattern, pattern, pattern, pattern, pattern, pattern);
          }

          if (options.issueKey && options.issueKey.trim()) {
            conditions.push(`
              EXISTS (
                SELECT 1
                FROM session_issue_keys issue_keys
                WHERE issue_keys.sessionId = s.id
                  AND issue_keys.issueKey = ?
              )
            `);
            params.push(options.issueKey.trim());
          }

          if (options.sessionIds && options.sessionIds.length > 0) {
            const normalizedIds = options.sessionIds
              .map((sessionId) => sessionId.trim())
              .filter(Boolean);
            if (normalizedIds.length === 0) {
              return {
                sessions: [],
                total: 0,
              };
            }
            conditions.push(
              `s.id IN (${normalizedIds.map(() => "?").join(", ")})`,
            );
            params.push(...normalizedIds);
          }

          const whereSql = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";
          const fromSql = `
            FROM sessions s
            LEFT JOIN session_history_cache cache ON cache.sessionId = s.id
            ${whereSql}
          `;

          const total =
            (
              this.db
                .prepare(`SELECT COUNT(*) as total ${fromSql}`)
                .get(...params) as { total: number } | undefined
            )?.total ?? 0;

          let query = `
            SELECT s.*
            ${fromSql}
            ORDER BY s.startedAt DESC, s.id DESC
          `;
          const pageParams = [...params];
          query = appendPaginationClause(
            query,
            pageParams,
            options.limit,
            options.offset,
          );

          const rows = this.db
            .prepare(query)
            .all(...pageParams) as SessionRow[];
          return {
            sessions: rows.map((row) => this.rowToSession(row)),
            total,
          };
        }),
    );
  }

  querySessionTrendAttempts(
    options?: TrendAttemptQueryOptions,
  ): SessionTrendAttemptQueryRow[] {
    return traceSyncOperation(
      "db.query-session-trend-attempts",
      {
        host: options?.host,
        status: options?.status,
        sessionIds: options?.sessionIds?.length ?? 0,
      },
      () =>
        this.dbOp("query session trend attempts", () => {
          this.ensureSessionTrendAttemptsBackfilled();

          const conditions: string[] = [];
          const params: Array<string | number> = [];

          if (options?.host) {
            conditions.push(`s.host = ?`);
            params.push(options.host);
          }

          if (options?.status) {
            conditions.push(`s.status = ?`);
            params.push(options.status);
          }

          if (options?.sessionIds && options.sessionIds.length > 0) {
            const normalizedIds = options.sessionIds
              .map((sessionId) => sessionId.trim())
              .filter(Boolean);
            if (normalizedIds.length === 0) {
              return [];
            }
            conditions.push(
              `ta.sessionId IN (${normalizedIds.map(() => "?").join(", ")})`,
            );
            params.push(...normalizedIds);
          }

          const whereSql = conditions.length
            ? `WHERE ${conditions.join(" AND ")}`
            : "";

          return this.db
            .prepare(
              `
                SELECT
                  ta.*,
                  s.host,
                  s.status,
                  s.cwd,
                  s.startedAt,
                  s.endedAt,
                  s.title
                FROM session_trend_attempts ta
                INNER JOIN sessions s ON s.id = ta.sessionId
                ${whereSql}
                ORDER BY ta.seenAt DESC, ta.artifactId DESC
              `,
            )
            .all(...params) as SessionTrendAttemptQueryRow[];
        }),
    );
  }

  querySessionTrendContextAttempts(
    sessionId: string,
  ): SessionTrendAttemptQueryRow[] {
    return this.dbOp("query session trend context attempts", () => {
      const normalizedSessionId = sessionId.trim();
      if (!normalizedSessionId) {
        return [];
      }

      this.ensureSessionTrendAttemptsBackfilled();

      return this.db
        .prepare(
          `
            WITH target_issue_keys AS (
              SELECT DISTINCT issueKey
              FROM session_trend_attempts
              WHERE sessionId = ?
            )
            SELECT
              ta.*,
              s.host,
              s.status,
              s.cwd,
              s.startedAt,
              s.endedAt,
              s.title
            FROM session_trend_attempts ta
            INNER JOIN target_issue_keys tik ON tik.issueKey = ta.issueKey
            INNER JOIN sessions s ON s.id = ta.sessionId
            ORDER BY ta.issueKey ASC, ta.seenAt DESC, ta.artifactId DESC
          `,
        )
        .all(normalizedSessionId) as SessionTrendAttemptQueryRow[];
    });
  }

  getSessionFollowUpMessages(
    sessionIds: string[],
    options?: { limit?: number; offset?: number },
  ): Array<{ sessionId: string; content: string; capturedAt: string }> {
    return traceSyncOperation(
      "db.get-session-follow-up-messages",
      {
        sessionIds: sessionIds.length,
        limit: options?.limit,
        offset: options?.offset,
      },
      () =>
        this.dbOp("get session follow-up messages", () => {
          const normalizedIds = sessionIds
            .map((sessionId) => sessionId.trim())
            .filter(Boolean);
          if (normalizedIds.length === 0) {
            return [];
          }

          const params: Array<string | number> = [...normalizedIds];
          let query = `
            SELECT id, sessionId, content, capturedAt, seq
            FROM messages
            WHERE sessionId IN (${normalizedIds.map(() => "?").join(", ")})
              AND (
                content LIKE '%?%'
                OR lower(content) LIKE 'next:%'
              )
            ORDER BY capturedAt DESC, sessionId DESC, seq DESC, id DESC
          `;

          query = appendPaginationClause(
            query,
            params,
            options?.limit,
            options?.offset,
          );

          const rows = this.db
            .prepare(query)
            .all(...params) as FollowUpMessageRow[];
          return rows.map((row) => ({
            sessionId: row.sessionId,
            content: row.content,
            capturedAt: row.capturedAt,
          }));
        }),
    );
  }

  createSession(
    session: Omit<SessionRecord, "id" | "createdAt" | "updatedAt">,
  ): string {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    return this.dbOp("create session", () => {
      const stmt = this.db.prepare(`
        INSERT INTO sessions (
          id, host, projectRoot, cwd, title, status,
          startedAt, endedAt, metadata, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        session.host,
        session.projectRoot,
        session.cwd,
        session.title,
        session.status,
        session.startedAt,
        session.endedAt,
        session.metadata,
        now,
        now,
      );

      this.db
        .prepare(
          `
            INSERT INTO session_history_cache (
              sessionId, titleText, metadataText, messagesText,
              artifactsText, narrativesText, decisionsText, updatedAt
            ) VALUES (?, ?, ?, '', '', '', '', ?)
          `,
        )
        .run(id, session.title ?? "", session.metadata ?? "", now);
      this.markSessionTrendAttemptsFresh(id);

      return id;
    });
  }

  appendMessage(message: Omit<SessionMessageRecord, "id">): string {
    const id = crypto.randomUUID();

    return this.dbOp("append message", () => {
      const stmt = this.db.prepare(`
        INSERT INTO messages (
          id, sessionId, seq, role, source, content, capturedAt, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        message.sessionId,
        message.seq,
        message.role,
        message.source,
        message.content,
        message.capturedAt,
        message.metadata,
      );

      const currentCache = this.db
        .prepare(
          `
            SELECT messagesText FROM session_history_cache
            WHERE sessionId = ?
          `,
        )
        .get(message.sessionId) as
        | Pick<SessionHistoryCacheRow, "messagesText">
        | undefined;
      this.updateSessionHistoryCache(message.sessionId, {
        messagesText: EvidenceDatabase.appendSearchPart(
          currentCache?.messagesText ?? "",
          message.content,
        ),
      });

      return id;
    });
  }

  appendTimelineEvent(event: Omit<TimelineEventRecord, "id">): string {
    const id = crypto.randomUUID();

    return this.dbOp("append timeline event", () => {
      const stmt = this.db.prepare(`
        INSERT INTO timeline_events (
          id, sessionId, seq, eventType, eventSubType, source,
          summary, payload, startedAt, endedAt, status, relatedMessageId
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        event.sessionId,
        event.seq,
        event.eventType,
        event.eventSubType,
        event.source,
        event.summary,
        event.payload,
        event.startedAt,
        event.endedAt,
        event.status,
        event.relatedMessageId,
      );

      return id;
    });
  }

  updateSessionTitle(id: string, title: string): void {
    this.dbOp("update session title", () => {
      const stmt = this.db.prepare(`
        UPDATE sessions
        SET title = ?,
            updatedAt = ?
        WHERE id = ?
      `);

      const result = stmt.run(title, new Date().toISOString(), id);
      if (result.changes === 0) {
        throw new Error(`Session with id ${id} not found`);
      }

      this.updateSessionHistoryCache(id, {
        titleText: title,
      });
    });
  }

  finalizeSession(
    id: string,
    updates: { status: SessionStatus; endedAt: string; title?: string | null },
  ): void {
    this.dbOp("finalize session", () => {
      const stmt = this.db.prepare(`
        UPDATE sessions
        SET status = ?,
            endedAt = ?,
            title = COALESCE(?, title),
            updatedAt = ?
        WHERE id = ?
      `);

      const result = stmt.run(
        updates.status,
        updates.endedAt,
        updates.title,
        new Date().toISOString(),
        id,
      );

      if (result.changes === 0) {
        throw new Error(`Session with id ${id} not found`);
      }
    });
  }

  findSessionById(id: string): SessionRecord | null {
    return this.dbOp("find session by ID", () => {
      const row = this.db
        .prepare(`SELECT * FROM sessions WHERE id = ?`)
        .get(id) as SessionRow | undefined;

      return row ? this.rowToSession(row) : null;
    });
  }

  listSessions(options?: { limit?: number; offset?: number }): SessionRecord[] {
    return this.dbOp("list sessions", () => {
      const params: (string | number)[] = [];
      const query = appendPaginationClause(
        "SELECT * FROM sessions ORDER BY startedAt DESC",
        params,
        options?.limit,
        options?.offset,
      );

      const rows = this.db.prepare(query).all(...params) as SessionRow[];
      return rows.map((row) => this.rowToSession(row));
    });
  }

  createContext(context: {
    label: string;
    workspaceKey: string;
    metadata?: string | null;
  }): ContextRecord {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    return this.dbOp("create context", () => {
      this.db
        .prepare(
          `
            INSERT INTO contexts (
              id, label, workspaceKey, status, mergedIntoContextId,
              metadata, createdAt, updatedAt
            ) VALUES (?, ?, ?, 'active', NULL, ?, ?, ?)
          `,
        )
        .run(
          id,
          context.label,
          context.workspaceKey,
          context.metadata ?? null,
          now,
          now,
        );

      return {
        id,
        label: context.label,
        workspaceKey: context.workspaceKey,
        status: "active",
        mergedIntoContextId: null,
        metadata: context.metadata ?? null,
        createdAt: now,
        updatedAt: now,
      };
    });
  }

  findContextById(id: string): ContextRecord | null {
    return this.dbOp("find context by ID", () => {
      const row = this.db
        .prepare(`SELECT * FROM contexts WHERE id = ?`)
        .get(id) as ContextRow | undefined;

      return row ? this.rowToContext(row) : null;
    });
  }

  resolveContextById(id: string): ContextRecord | null {
    try {
      const activeId = this.resolveActiveContextIdOrThrow(id);
      return this.findContextById(activeId);
    } catch {
      return null;
    }
  }

  listContexts(options?: {
    workspaceKey?: string;
    status?: ContextStatus;
    includeMerged?: boolean;
    limit?: number;
    offset?: number;
  }): ContextRecord[] {
    return this.dbOp("list contexts", () => {
      const conditions: string[] = [];
      const params: Array<string | number> = [];

      if (options?.workspaceKey) {
        conditions.push("workspaceKey = ?");
        params.push(options.workspaceKey);
      }

      if (options?.status) {
        conditions.push("status = ?");
        params.push(options.status);
      } else if (!options?.includeMerged) {
        conditions.push("status = 'active'");
      }

      const whereSql = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";
      const query = appendPaginationClause(
        `
        SELECT *
        FROM contexts
        ${whereSql}
        ORDER BY updatedAt DESC, createdAt DESC, id DESC
      `,
        params,
        options?.limit,
        options?.offset,
      );

      const rows = this.db.prepare(query).all(...params) as ContextRow[];
      return rows.map((row) => this.rowToContext(row));
    });
  }

  getContextCount(options?: {
    workspaceKey?: string;
    status?: ContextStatus;
    includeMerged?: boolean;
  }): number {
    return this.dbOp("count contexts", () => {
      const conditions: string[] = [];
      const params: string[] = [];

      if (options?.workspaceKey) {
        conditions.push("workspaceKey = ?");
        params.push(options.workspaceKey);
      }

      if (options?.status) {
        conditions.push("status = ?");
        params.push(options.status);
      } else if (!options?.includeMerged) {
        conditions.push("status = 'active'");
      }

      const whereSql = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";
      const row = this.db
        .prepare(`SELECT COUNT(*) as count FROM contexts ${whereSql}`)
        .get(...params) as { count: number } | undefined;

      return row?.count ?? 0;
    });
  }

  listSessionsForContext(contextId: string): SessionRecord[] {
    return this.dbOp("list sessions for context", () => {
      const activeId = this.resolveActiveContextIdOrThrow(contextId);
      const rows = this.db
        .prepare(
          `
            SELECT s.*
            FROM context_session_links links
            INNER JOIN sessions s ON s.id = links.sessionId
            WHERE links.contextId = ?
            ORDER BY s.startedAt ASC, s.id ASC
          `,
        )
        .all(activeId) as SessionRow[];
      return rows.map((row) => this.rowToSession(row));
    });
  }

  listUnlinkedSessions(options?: {
    workspaceKey?: string;
    limit?: number;
    offset?: number;
  }): SessionRecord[] {
    return this.dbOp("list unlinked sessions", () => {
      const conditions = [
        "NOT EXISTS (SELECT 1 FROM context_session_links links WHERE links.sessionId = s.id)",
      ];
      const params: Array<string | number> = [];

      let query = `
        SELECT s.*
        FROM sessions s
        WHERE ${conditions.join(" AND ")}
        ORDER BY s.startedAt ASC, s.id ASC
      `;
      if (!options?.workspaceKey) {
        query = appendPaginationClause(
          query,
          params,
          options?.limit,
          options?.offset,
        );
      }

      const rows = this.db.prepare(query).all(...params) as SessionRow[];
      let sessions = rows.map((row) => this.rowToSession(row));
      if (options?.workspaceKey) {
        sessions = sessions.filter((session) =>
          matchesWorkspaceKey(session, options.workspaceKey!),
        );
        const off = options.offset ?? 0;
        if (off > 0) {
          sessions = sessions.slice(off);
        }
        if (options.limit !== undefined) {
          sessions = sessions.slice(0, options.limit);
        }
      }
      return sessions;
    });
  }

  findContextLinkForSession(
    sessionId: string,
  ): ContextSessionLinkRecord | null {
    return this.dbOp("find context link for session", () => {
      const row = this.db
        .prepare(
          `
            SELECT *
            FROM context_session_links
            WHERE sessionId = ?
          `,
        )
        .get(sessionId) as ContextSessionLinkRow | undefined;

      return row ? this.rowToContextSessionLink(row) : null;
    });
  }

  listContextSessionLinks(contextId: string): ContextSessionLinkRecord[] {
    return this.dbOp("list context session links", () => {
      const activeId = this.resolveActiveContextIdOrThrow(contextId);
      const rows = this.db
        .prepare(
          `
            SELECT *
            FROM context_session_links
            WHERE contextId = ?
            ORDER BY updatedAt DESC, sessionId DESC
          `,
        )
        .all(activeId) as ContextSessionLinkRow[];

      return rows.map((row) => this.rowToContextSessionLink(row));
    });
  }

  assignSessionToContext(input: {
    sessionId: string;
    contextId: string;
    linkSource: ContextLinkSource;
  }): ContextSessionLinkRecord {
    const now = new Date().toISOString();

    return this.dbOp("assign session to context", () => {
      const session = this.findSessionById(input.sessionId);
      if (!session) {
        throw new Error(`Session not found: ${input.sessionId}`);
      }

      const activeContextId = this.resolveActiveContextIdOrThrow(
        input.contextId,
      );
      this.db
        .prepare(
          `
            INSERT INTO context_session_links (
              sessionId, contextId, linkSource, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(sessionId) DO UPDATE SET
              contextId = excluded.contextId,
              linkSource = excluded.linkSource,
              updatedAt = excluded.updatedAt
          `,
        )
        .run(input.sessionId, activeContextId, input.linkSource, now, now);

      this.db
        .prepare(
          `
            DELETE FROM context_link_rejections
            WHERE sessionId = ? AND contextId = ?
          `,
        )
        .run(input.sessionId, activeContextId);

      this.db
        .prepare(
          `
            UPDATE contexts
            SET updatedAt = ?
            WHERE id = ?
          `,
        )
        .run(now, activeContextId);

      return {
        sessionId: input.sessionId,
        contextId: activeContextId,
        linkSource: input.linkSource,
        createdAt: now,
        updatedAt: now,
      };
    });
  }

  rejectContextForSession(
    sessionId: string,
    contextId: string,
  ): ContextLinkRejectionRecord {
    const now = new Date().toISOString();

    return this.dbOp("reject context for session", () => {
      if (!this.findSessionById(sessionId)) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const activeContextId = this.resolveActiveContextIdOrThrow(contextId);
      this.db
        .prepare(
          `
            INSERT INTO context_link_rejections (sessionId, contextId, createdAt)
            VALUES (?, ?, ?)
            ON CONFLICT(sessionId, contextId) DO NOTHING
          `,
        )
        .run(sessionId, activeContextId, now);

      return {
        sessionId,
        contextId: activeContextId,
        createdAt: now,
      };
    });
  }

  listContextRejectionsForSession(
    sessionId: string,
  ): ContextLinkRejectionRecord[] {
    return this.dbOp("list context rejections", () => {
      const rows = this.db
        .prepare(
          `
            SELECT *
            FROM context_link_rejections
            WHERE sessionId = ?
            ORDER BY createdAt DESC, contextId DESC
          `,
        )
        .all(sessionId) as ContextLinkRejectionRow[];

      return rows.map((row) => this.rowToContextLinkRejection(row));
    });
  }

  setWorkspacePreferredContext(
    workspaceKey: string,
    contextId: string,
  ): ContextWorkspacePreferenceRecord {
    const now = new Date().toISOString();

    return this.dbOp("set preferred context", () => {
      const activeContextId = this.resolveActiveContextIdOrThrow(contextId);
      this.db
        .prepare(
          `
            INSERT INTO context_workspace_preferences (
              workspaceKey, contextId, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?)
            ON CONFLICT(workspaceKey) DO UPDATE SET
              contextId = excluded.contextId,
              updatedAt = excluded.updatedAt
          `,
        )
        .run(workspaceKey, activeContextId, now, now);

      return {
        workspaceKey,
        contextId: activeContextId,
        createdAt: now,
        updatedAt: now,
      };
    });
  }

  getWorkspacePreferredContext(
    workspaceKey: string,
  ): ContextWorkspacePreferenceRecord | null {
    return this.dbOp("get preferred context", () => {
      const row = this.db
        .prepare(
          `
            SELECT *
            FROM context_workspace_preferences
            WHERE workspaceKey = ?
          `,
        )
        .get(workspaceKey) as ContextWorkspacePreferenceRow | undefined;

      if (!row) {
        return null;
      }

      try {
        const activeContextId = this.resolveActiveContextIdOrThrow(
          row.contextId,
        );
        if (activeContextId !== row.contextId) {
          const now = new Date().toISOString();
          this.db
            .prepare(
              `
                UPDATE context_workspace_preferences
                SET contextId = ?, updatedAt = ?
                WHERE workspaceKey = ?
              `,
            )
            .run(activeContextId, now, workspaceKey);

          return this.rowToContextWorkspacePreference({
            ...row,
            contextId: activeContextId,
            updatedAt: now,
          });
        }
      } catch {
        return this.rowToContextWorkspacePreference(row);
      }

      return this.rowToContextWorkspacePreference(row);
    });
  }

  mergeContexts(sourceContextId: string, targetContextId: string): void {
    this.dbOp("merge contexts", () => {
      const sourceId = this.resolveActiveContextIdOrThrow(sourceContextId);
      const targetId = this.resolveActiveContextIdOrThrow(targetContextId);

      if (sourceId === targetId) {
        throw new Error("Cannot merge a context into itself");
      }

      const now = new Date().toISOString();
      const transaction = this.db.transaction(() => {
        this.db
          .prepare(
            `
              UPDATE context_session_links
              SET contextId = ?, linkSource = 'merge', updatedAt = ?
              WHERE contextId = ?
            `,
          )
          .run(targetId, now, sourceId);

        this.db
          .prepare(
            `
              UPDATE context_workspace_preferences
              SET contextId = ?, updatedAt = ?
              WHERE contextId = ?
            `,
          )
          .run(targetId, now, sourceId);

        this.db
          .prepare(
            `
              UPDATE contexts
              SET status = 'merged',
                  mergedIntoContextId = ?,
                  updatedAt = ?
              WHERE id = ?
            `,
          )
          .run(targetId, now, sourceId);

        this.db
          .prepare(
            `
              UPDATE contexts
              SET updatedAt = ?
              WHERE id = ?
            `,
          )
          .run(now, targetId);
      });

      transaction();
    });
  }

  countSessionMessages(sessionId: string): number {
    return this.dbOp("count session messages", () => {
      const row = this.db
        .prepare(`SELECT COUNT(*) as total FROM messages WHERE sessionId = ?`)
        .get(sessionId) as { total: number } | undefined;

      return row?.total ?? 0;
    });
  }

  getSessionMessageStats(sessionId: string): {
    total: number;
    byRole: {
      user: number;
      assistant: number;
      system: number;
    };
    firstCapturedAt: string | null;
    lastCapturedAt: string | null;
    previewContent: string | null;
  } {
    return this.dbOp("summarize session messages", () => {
      const summaryRow = this.db
        .prepare(
          `
            SELECT
              COUNT(*) as total,
              COALESCE(SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END), 0) as userCount,
              COALESCE(SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END), 0) as assistantCount,
              COALESCE(SUM(CASE WHEN role = 'system' THEN 1 ELSE 0 END), 0) as systemCount,
              MIN(capturedAt) as firstCapturedAt,
              MAX(capturedAt) as lastCapturedAt
            FROM messages
            WHERE sessionId = ?
          `,
        )
        .get(sessionId) as
        | {
            total: number;
            userCount: number;
            assistantCount: number;
            systemCount: number;
            firstCapturedAt: string | null;
            lastCapturedAt: string | null;
          }
        | undefined;
      const previewRow = this.db
        .prepare(
          `
            SELECT content FROM messages
            WHERE sessionId = ?
            ORDER BY seq ASC, capturedAt ASC
            LIMIT 1
          `,
        )
        .get(sessionId) as { content: string } | undefined;

      return {
        total: summaryRow?.total ?? 0,
        byRole: {
          user: summaryRow?.userCount ?? 0,
          assistant: summaryRow?.assistantCount ?? 0,
          system: summaryRow?.systemCount ?? 0,
        },
        firstCapturedAt: summaryRow?.firstCapturedAt ?? null,
        lastCapturedAt: summaryRow?.lastCapturedAt ?? null,
        previewContent: previewRow?.content ?? null,
      };
    });
  }

  getSessionMessages(
    sessionId: string,
    options?: { limit?: number; offset?: number },
  ): SessionMessageRecord[] {
    return this.dbOp("get session messages", () => {
      const params: Array<string | number> = [sessionId];
      const query = appendPaginationClause(
        "SELECT * FROM messages WHERE sessionId = ? ORDER BY seq ASC, capturedAt ASC",
        params,
        options?.limit,
        options?.offset,
      );

      const rows = this.db.prepare(query).all(...params) as MessageRow[];

      return rows.map((row) => this.rowToMessage(row));
    });
  }

  countSessionTimeline(sessionId: string): number {
    return this.dbOp("count session timeline", () => {
      const row = this.db
        .prepare(
          `SELECT COUNT(*) as total FROM timeline_events WHERE sessionId = ?`,
        )
        .get(sessionId) as { total: number } | undefined;

      return row?.total ?? 0;
    });
  }

  getSessionTimelineStats(sessionId: string): {
    total: number;
    eventTypes: string[];
    statuses: string[];
    firstStartedAt: string | null;
    lastEndedAt: string | null;
  } {
    return this.dbOp("summarize session timeline", () => {
      const summaryRow = this.db
        .prepare(
          `
            SELECT
              COUNT(*) as total,
              MIN(startedAt) as firstStartedAt,
              MAX(COALESCE(endedAt, startedAt)) as lastEndedAt
            FROM timeline_events
            WHERE sessionId = ?
          `,
        )
        .get(sessionId) as
        | {
            total: number;
            firstStartedAt: string | null;
            lastEndedAt: string | null;
          }
        | undefined;
      const eventTypeRows = this.db
        .prepare(
          `
            SELECT eventType FROM timeline_events
            WHERE sessionId = ?
            GROUP BY eventType
            ORDER BY MIN(seq) ASC, MIN(startedAt) ASC
          `,
        )
        .all(sessionId) as Array<{ eventType: string }>;
      const statusRows = this.db
        .prepare(
          `
            SELECT status FROM timeline_events
            WHERE sessionId = ? AND status IS NOT NULL
            GROUP BY status
            ORDER BY MIN(seq) ASC, MIN(startedAt) ASC
          `,
        )
        .all(sessionId) as Array<{ status: string }>;

      return {
        total: summaryRow?.total ?? 0,
        eventTypes: eventTypeRows.map((row) => row.eventType),
        statuses: statusRows.map((row) => row.status),
        firstStartedAt: summaryRow?.firstStartedAt ?? null,
        lastEndedAt: summaryRow?.lastEndedAt ?? null,
      };
    });
  }

  getSessionTimeline(
    sessionId: string,
    options?: { limit?: number; offset?: number },
  ): TimelineEventRecord[] {
    return this.dbOp("get session timeline", () => {
      const params: Array<string | number> = [sessionId];
      const query = appendPaginationClause(
        `
        SELECT * FROM timeline_events
        WHERE sessionId = ?
        ORDER BY seq ASC, startedAt ASC
      `,
        params,
        options?.limit,
        options?.offset,
      );

      const rows = this.db.prepare(query).all(...params) as TimelineEventRow[];

      return rows.map((row) => this.rowToTimelineEvent(row));
    });
  }

  createArtifact(
    artifact: Omit<ArtifactRecord, "id" | "createdAt">,
  ): ArtifactRecord {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    return this.dbOp("create artifact", () => {
      this.db
        .prepare(
          `
            INSERT INTO artifacts (
              id, sessionId, eventId, artifactType, path, metadata, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          id,
          artifact.sessionId,
          artifact.eventId,
          artifact.artifactType,
          artifact.path,
          artifact.metadata,
          createdAt,
        );

      const artifactRecord: ArtifactRecord = {
        id,
        sessionId: artifact.sessionId,
        eventId: artifact.eventId,
        artifactType: artifact.artifactType,
        path: artifact.path,
        metadata: artifact.metadata,
        createdAt,
      };
      const artifactCache = this.buildArtifactHistoryCache([artifactRecord]);
      const currentCache = this.db
        .prepare(
          `
            SELECT artifactsText FROM session_history_cache
            WHERE sessionId = ?
          `,
        )
        .get(artifact.sessionId) as
        | Pick<SessionHistoryCacheRow, "artifactsText">
        | undefined;

      this.updateSessionHistoryCache(artifact.sessionId, {
        artifactsText: EvidenceDatabase.appendSearchPart(
          currentCache?.artifactsText ?? "",
          artifactCache.text,
        ),
      });

      for (const issueKey of artifactCache.issueKeys) {
        this.db
          .prepare(
            `
              INSERT INTO session_issue_keys (sessionId, issueKey)
              VALUES (?, ?)
              ON CONFLICT(sessionId, issueKey) DO NOTHING
            `,
          )
          .run(artifact.sessionId, issueKey);
      }

      this.insertSessionTrendAttempts(artifact.sessionId, [artifactRecord]);

      return artifactRecord;
    });
  }

  replaceArtifactsForSession(
    sessionId: string,
    artifacts: Array<Omit<ArtifactRecord, "id" | "createdAt">>,
  ): ArtifactRecord[] {
    return this.dbOp("replace artifacts", () => {
      const transaction = this.db.transaction(() => {
        this.db
          .prepare(`DELETE FROM artifacts WHERE sessionId = ?`)
          .run(sessionId);

        const insertArtifact = this.db.prepare(
          `
            INSERT INTO artifacts (
              id, sessionId, eventId, artifactType, path, metadata, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
        );
        const createdArtifacts = artifacts.map((artifact) => {
          const id = crypto.randomUUID();
          const createdAt = new Date().toISOString();
          insertArtifact.run(
            id,
            sessionId,
            artifact.eventId,
            artifact.artifactType,
            artifact.path,
            artifact.metadata,
            createdAt,
          );

          return {
            id,
            sessionId,
            eventId: artifact.eventId,
            artifactType: artifact.artifactType,
            path: artifact.path,
            metadata: artifact.metadata,
            createdAt,
          } satisfies ArtifactRecord;
        });
        const artifactCache = this.buildArtifactHistoryCache(createdArtifacts);

        this.updateSessionHistoryCache(sessionId, {
          artifactsText: artifactCache.text,
        });
        this.replaceSessionIssueKeys(sessionId, artifactCache.issueKeys);
        this.replaceSessionTrendAttempts(sessionId, createdArtifacts);

        return createdArtifacts;
      });

      return transaction();
    });
  }

  countSessionArtifacts(
    sessionId: string,
    options?: { artifactType?: ArtifactType },
  ): number {
    return this.dbOp("count session artifacts", () => {
      const row = (
        options?.artifactType
          ? this.db
              .prepare(
                `SELECT COUNT(*) as count FROM artifacts WHERE sessionId = ? AND artifactType = ?`,
              )
              .get(sessionId, options.artifactType)
          : this.db
              .prepare(
                `SELECT COUNT(*) as count FROM artifacts WHERE sessionId = ?`,
              )
              .get(sessionId)
      ) as { count: number } | undefined;

      return row?.count ?? 0;
    });
  }

  getSessionArtifactSummary(sessionId: string): {
    total: number;
    byType: {
      fileChange: number;
      commandOutput: number;
      testResult: number;
      gitCommit: number;
    };
  } {
    return this.dbOp("summarize session artifacts", () => {
      const row = this.db
        .prepare(
          `
            SELECT
              COUNT(*) as total,
              COALESCE(SUM(CASE WHEN artifactType = 'file-change' THEN 1 ELSE 0 END), 0) as fileChange,
              COALESCE(SUM(CASE WHEN artifactType = 'command-output' THEN 1 ELSE 0 END), 0) as commandOutput,
              COALESCE(SUM(CASE WHEN artifactType = 'test-result' THEN 1 ELSE 0 END), 0) as testResult,
              COALESCE(SUM(CASE WHEN artifactType = 'git-commit' THEN 1 ELSE 0 END), 0) as gitCommit
            FROM artifacts
            WHERE sessionId = ?
          `,
        )
        .get(sessionId) as
        | {
            total: number;
            fileChange: number;
            commandOutput: number;
            testResult: number;
            gitCommit: number;
          }
        | undefined;

      return {
        total: row?.total ?? 0,
        byType: {
          fileChange: row?.fileChange ?? 0,
          commandOutput: row?.commandOutput ?? 0,
          testResult: row?.testResult ?? 0,
          gitCommit: row?.gitCommit ?? 0,
        },
      };
    });
  }

  getSessionArtifacts(
    sessionId: string,
    options?: {
      artifactType?: ArtifactType;
      limit?: number;
      offset?: number;
    },
  ): ArtifactRecord[] {
    return this.dbOp("get session artifacts", () => {
      const conditions = ["sessionId = ?"];
      const parameters: Array<string | number> = [sessionId];

      if (options?.artifactType) {
        conditions.push("artifactType = ?");
        parameters.push(options.artifactType);
      }

      const query = appendPaginationClause(
        `SELECT * FROM artifacts WHERE ${conditions.join(" AND ")} ORDER BY createdAt ASC, id ASC`,
        parameters,
        options?.limit,
        options?.offset,
      );

      const rows = this.db.prepare(query).all(...parameters) as ArtifactRow[];
      return rows.map((row) => this.rowToArtifact(row));
    });
  }

  replaceDecisionsForSession(
    sessionId: string,
    decisions: Array<Omit<DecisionRecord, "id" | "createdAt">>,
  ): DecisionRecord[] {
    return this.dbOp("replace decisions", () => {
      const transaction = this.db.transaction(() => {
        this.db
          .prepare(`DELETE FROM decisions WHERE sessionId = ?`)
          .run(sessionId);

        const createdDecisions = decisions.map((decision) => {
          const id = crypto.randomUUID();
          const createdAt = new Date().toISOString();
          this.db
            .prepare(
              `
                INSERT INTO decisions (
                  id, sessionId, title, summary, rationale, status, sourceRefs, createdAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
              `,
            )
            .run(
              id,
              sessionId,
              decision.title,
              decision.summary,
              decision.rationale,
              decision.status,
              decision.sourceRefs,
              createdAt,
            );

          return {
            id,
            sessionId,
            title: decision.title,
            summary: decision.summary,
            rationale: decision.rationale,
            status: decision.status,
            sourceRefs: decision.sourceRefs,
            createdAt,
          };
        });

        this.updateSessionHistoryCache(sessionId, {
          decisionsText: this.buildDecisionHistoryCache(createdDecisions),
        });

        return createdDecisions;
      });

      return transaction();
    });
  }

  countSessionDecisions(sessionId: string): number {
    return this.dbOp("count session decisions", () => {
      const row = this.db
        .prepare(`SELECT COUNT(*) as count FROM decisions WHERE sessionId = ?`)
        .get(sessionId) as { count: number } | undefined;

      return row?.count ?? 0;
    });
  }

  getSessionDecisions(
    sessionId: string,
    options?: { limit?: number; offset?: number },
  ): DecisionRecord[] {
    return this.dbOp("get session decisions", () => {
      const params: Array<string | number> = [sessionId];
      const query = appendPaginationClause(
        `
        SELECT * FROM decisions
        WHERE sessionId = ?
        ORDER BY createdAt ASC, id ASC
      `,
        params,
        options?.limit,
        options?.offset,
      );

      const rows = this.db.prepare(query).all(...params) as DecisionRow[];
      return rows.map((row) => this.rowToDecision(row));
    });
  }

  replaceNarrativesForSession(
    sessionId: string,
    narratives: Array<Omit<NarrativeRecord, "id" | "createdAt" | "updatedAt">>,
  ): NarrativeRecord[] {
    return this.dbOp("replace narratives", () => {
      const transaction = this.db.transaction(() => {
        this.db
          .prepare(`DELETE FROM narratives WHERE sessionId = ?`)
          .run(sessionId);

        const createdNarratives = narratives.map((narrative) => {
          const id = crypto.randomUUID();
          const now = new Date().toISOString();

          this.db
            .prepare(
              `
                INSERT INTO narratives (
                  id, sessionId, kind, content, sourceRefs, createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
              `,
            )
            .run(
              id,
              sessionId,
              narrative.kind,
              narrative.content,
              narrative.sourceRefs,
              now,
              now,
            );

          return {
            id,
            sessionId,
            kind: narrative.kind,
            content: narrative.content,
            sourceRefs: narrative.sourceRefs,
            createdAt: now,
            updatedAt: now,
          };
        });

        this.updateSessionHistoryCache(sessionId, {
          narrativesText: this.buildNarrativeHistoryCache(createdNarratives),
        });

        return createdNarratives;
      });

      return transaction();
    });
  }

  countSessionNarratives(
    sessionId: string,
    options?: { kind?: NarrativeKind },
  ): number {
    return this.dbOp("count session narratives", () => {
      const row = (
        options?.kind
          ? this.db
              .prepare(
                `SELECT COUNT(*) as count FROM narratives WHERE sessionId = ? AND kind = ?`,
              )
              .get(sessionId, options.kind)
          : this.db
              .prepare(
                `SELECT COUNT(*) as count FROM narratives WHERE sessionId = ?`,
              )
              .get(sessionId)
      ) as { count: number } | undefined;

      return row?.count ?? 0;
    });
  }

  getSessionNarratives(
    sessionId: string,
    options?: { kind?: NarrativeKind; limit?: number; offset?: number },
  ): NarrativeRecord[] {
    return this.dbOp("get session narratives", () => {
      const conditions = ["sessionId = ?"];
      const params: Array<string | number> = [sessionId];

      if (options?.kind) {
        conditions.push("kind = ?");
        params.push(options.kind);
      }

      let query = `
            SELECT * FROM narratives
            WHERE ${conditions.join(" AND ")}
            ORDER BY CASE kind
              WHEN 'journal' THEN 1
              WHEN 'project-summary' THEN 2
              WHEN 'handoff' THEN 3
              ELSE 99
            END, createdAt ASC, id ASC
          `;

      query = appendPaginationClause(
        query,
        params,
        options?.limit,
        options?.offset,
      );

      const rows = this.db.prepare(query).all(...params) as NarrativeRow[];
      return rows.map((row) => this.rowToNarrative(row));
    });
  }

  hasNarrativesForSession(sessionId: string): boolean {
    return this.dbOp("check session narratives", () => {
      const row = this.db
        .prepare(
          `SELECT EXISTS(SELECT 1 FROM narratives WHERE sessionId = ?) as present`,
        )
        .get(sessionId) as { present: number } | undefined;

      return Boolean(row?.present);
    });
  }

  createIngestionRun(
    run: Omit<IngestionRunRecord, "id" | "startedAt" | "endedAt" | "error"> & {
      error?: string | null;
    },
  ): IngestionRunRecord {
    const id = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    return this.dbOp("create ingestion run", () => {
      this.db
        .prepare(
          `
            INSERT INTO ingestion_runs (
              id, sessionId, stage, status, error, startedAt, endedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
        )
        .run(
          id,
          run.sessionId,
          run.stage,
          run.status,
          run.error ?? null,
          startedAt,
          null,
        );

      return {
        id,
        sessionId: run.sessionId,
        stage: run.stage,
        status: run.status,
        error: run.error ?? null,
        startedAt,
        endedAt: null,
      };
    });
  }

  completeIngestionRun(
    id: string,
    status: IngestionStatus,
    error: string | null = null,
  ): void {
    try {
      const endedAt = new Date().toISOString();
      const result = this.db
        .prepare(
          `
            UPDATE ingestion_runs
            SET status = ?, error = ?, endedAt = ?
            WHERE id = ?
          `,
        )
        .run(status, error, endedAt, id);

      if (result.changes === 0) {
        throw new Error(`Ingestion run with id ${id} not found`);
      }
    } catch (cause) {
      throw new Error(
        `Failed to complete ingestion run: ${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  }

  getSessionIngestionRuns(sessionId: string): IngestionRunRecord[] {
    return this.dbOp("get ingestion runs", () => {
      const rows = this.db
        .prepare(
          `
            SELECT * FROM ingestion_runs
            WHERE sessionId = ?
            ORDER BY startedAt ASC
          `,
        )
        .all(sessionId) as IngestionRunRow[];
      return rows.map((row) => this.rowToIngestionRun(row));
    });
  }

  getSessionDetail(sessionId: string): SessionDetail | null {
    // Wrap all reads in a single transaction for atomic snapshot
    const readAll = this.db.transaction(() => {
      const session = this.findSessionById(sessionId);
      if (!session) {
        return null;
      }

      const messages = this.getSessionMessages(sessionId);
      const timeline = this.getSessionTimeline(sessionId);
      const artifacts = this.getSessionArtifacts(sessionId);
      const narratives = this.getSessionNarratives(sessionId);
      const decisions = this.getSessionDecisions(sessionId);
      const ingestionRuns = this.getSessionIngestionRuns(sessionId);

      return {
        session,
        messages,
        timeline,
        artifacts,
        narratives,
        decisions,
        ingestionRuns,
        hasNarratives: narratives.length > 0,
      } satisfies SessionDetail;
    });

    return readAll();
  }

  /**
   * Updates git commit information for an evidence
   * @param id - Evidence UUID
   * @param gitCommitHash - Git commit hash
   * @param gitTimestamp - Git commit timestamp (ISO 8601)
   */
  updateGitInfo(id: string, gitCommitHash: string, gitTimestamp: string): void {
    this.dbOp("update git info", () => {
      const stmt = this.db.prepare(`
        UPDATE evidences
        SET gitCommitHash = ?,
            gitTimestamp = ?,
            updatedAt = ?
        WHERE id = ?
      `);

      const result = stmt.run(
        gitCommitHash,
        gitTimestamp,
        new Date().toISOString(),
        id,
      );

      if (result.changes === 0) {
        throw new Error(`Evidence with id ${id} not found`);
      }
    });
  }

  /**
   * Adds tags to an evidence (appends to existing tags)
   * @param id - Evidence UUID
   * @param tags - Array of tags to add
   * @throws Error if tags array is empty or all tags are whitespace
   */
  addTags(id: string, tags: string[]): void {
    this.dbOp("add tags", () => {
      if (tags.length === 0) {
        throw new Error("Tags array cannot be empty");
      }

      // Filter out empty/whitespace-only tags
      const validTags = tags.map((t) => t.trim()).filter((t) => t.length > 0);
      if (validTags.length === 0) {
        throw new Error("All provided tags are empty or whitespace");
      }

      // Wrap in transaction to prevent read-modify-write race condition
      const transaction = this.db.transaction(() => {
        const evidence = this.findById(id);
        if (!evidence) {
          throw new Error(`Evidence with id ${id} not found`);
        }

        // Parse existing tags (comma-separated) or create empty array
        const existingTags = evidence.tags
          ? evidence.tags
              .split(",")
              .map((t) => t.trim())
              .filter((t) => t)
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

        stmt.run(mergedTags.join(","), new Date().toISOString(), id);
      });

      transaction();
    });
  }

  /**
   * Builds a WHERE clause from search/filter options
   * @param options - Filter criteria
   * @returns SQL WHERE clause string and parameter values
   */
  private buildWhereClause(options: {
    query?: string;
    tags?: string[];
    dateFrom?: string;
    dateTo?: string;
  }): { sql: string; params: (string | number)[] } {
    const conditions: string[] = [];
    const params: (string | number)[] = [];

    if (options.query && options.query.trim()) {
      conditions.push(
        `(conversationId LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\')`,
      );
      const searchPattern = `%${escapeLikePattern(options.query.trim())}%`;
      params.push(searchPattern, searchPattern);
    }

    if (options.tags && options.tags.length > 0) {
      for (const tag of options.tags) {
        conditions.push(
          `(tags LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\' OR tags = ?)`,
        );
        const trimmedTag = escapeLikePattern(tag.trim());
        params.push(
          `${trimmedTag},%`,
          `%,${trimmedTag},%`,
          `%,${trimmedTag}`,
          tag.trim(),
        );
      }
    }

    if (options.dateFrom) {
      conditions.push(`timestamp >= ?`);
      params.push(options.dateFrom);
    }
    if (options.dateTo) {
      conditions.push(`timestamp <= ?`);
      params.push(options.dateTo);
    }

    const sql =
      conditions.length > 0 ? " WHERE " + conditions.join(" AND ") : "";
    return { sql, params };
  }

  /**
   * Gets count of evidences matching filter criteria
   * @param options - Filter criteria (query, tags, date range)
   * @returns Number of matching evidences
   */
  getFilteredCount(options: {
    query?: string;
    tags?: string[];
    dateFrom?: string;
    dateTo?: string;
  }): number {
    return this.dbOp("get filtered count", () => {
      const { sql: whereClause, params } = this.buildWhereClause(options);
      const row = this.db
        .prepare(`SELECT COUNT(*) as count FROM evidences${whereClause}`)
        .get(...params) as { count: number };
      return row.count;
    });
  }

  /**
   * Search evidences and return both paginated results and total matching count
   * in a single pass (builds WHERE clause once instead of twice)
   */
  searchWithCount(options: {
    query?: string;
    tags?: string[];
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): { evidences: Evidence[]; total: number } {
    return this.dbOp("search evidences", () => {
      const { limit, offset = 0 } = options;
      const { sql: whereClause, params: baseParams } =
        this.buildWhereClause(options);

      // Wrap both queries in a transaction for consistent snapshot
      const query = this.db.transaction(() => {
        // Get total count with same WHERE clause
        const countRow = this.db
          .prepare(`SELECT COUNT(*) as count FROM evidences${whereClause}`)
          .get(...baseParams) as { count: number };

        // Build paginated query (clone params since we append to it)
        const searchParams = [...baseParams];
        const sql = appendPaginationClause(
          `SELECT * FROM evidences${whereClause} ORDER BY timestamp DESC`,
          searchParams,
          limit,
          offset,
        );

        const rows = this.db.prepare(sql).all(...searchParams) as EvidenceRow[];

        return {
          evidences: rows.map((row) => this.rowToEvidence(row)),
          total: countRow.count,
        };
      });

      return query();
    });
  }

  /**
   * Search and filter evidences by various criteria
   * @param options - Search and filter options
   * @returns Array of matching evidences
   */
  search(options: {
    query?: string; // Search in conversationId, tags
    tags?: string[]; // Filter by tags (AND logic)
    dateFrom?: string; // ISO date string
    dateTo?: string; // ISO date string
    limit?: number;
    offset?: number;
  }): Evidence[] {
    return this.dbOp("search evidences", () => {
      const { limit, offset = 0 } = options;

      const { sql: whereClause, params } = this.buildWhereClause(options);

      // Build final query
      let sql = `SELECT * FROM evidences${whereClause} ORDER BY timestamp DESC`;

      // Add pagination
      sql = appendPaginationClause(sql, params, limit, offset);

      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params) as EvidenceRow[];
      return rows.map((row) => this.rowToEvidence(row));
    });
  }

  /**
   * Deletes evidence by ID
   * @param id - Evidence UUID
   * @returns true if deleted, false if not found
   */
  delete(id: string): boolean {
    return this.dbOp("delete evidence", () => {
      const stmt = this.db.prepare(`DELETE FROM evidences WHERE id = ?`);
      const result = stmt.run(id);
      return result.changes > 0;
    });
  }

  /**
   * Deletes multiple evidences by IDs
   * @param ids - Array of evidence UUIDs
   * @returns Number of evidences deleted
   */
  deleteMany(ids: string[]): number {
    if (ids.length === 0) return 0;

    return this.dbOp("delete evidences", () => {
      // Batch deletions to stay under SQLite's 999 parameter limit
      const BATCH_SIZE = 999;
      let totalDeleted = 0;

      for (let i = 0; i < ids.length; i += BATCH_SIZE) {
        const batch = ids.slice(i, i + BATCH_SIZE);
        const placeholders = batch.map(() => "?").join(",");
        const stmt = this.db.prepare(
          `DELETE FROM evidences WHERE id IN (${placeholders})`,
        );
        const result = stmt.run(...batch);
        totalDeleted += result.changes;
      }

      return totalDeleted;
    });
  }

  /**
   * Updates tags for an evidence (replaces existing tags)
   * @param id - Evidence UUID
   * @param tags - New tags (comma-separated string or null)
   * @returns true if updated, false if not found
   */
  updateTags(id: string, tags: string | null): boolean {
    return this.dbOp("update tags", () => {
      const stmt = this.db.prepare(`
        UPDATE evidences
        SET tags = ?,
            updatedAt = ?
        WHERE id = ?
      `);
      const result = stmt.run(tags, new Date().toISOString(), id);
      return result.changes > 0;
    });
  }

  /**
   * Renames a tag across all evidences atomically using transaction
   * @param oldTag - Tag to rename
   * @param newTag - New tag name
   * @returns Number of evidences updated
   * @throws Error if transaction fails (no partial updates)
   */
  renameTag(oldTag: string, newTag: string): number {
    return this.dbOp("rename tag", () => {
      // Wrap in transaction for atomic updates
      const transaction = this.db.transaction(() => {
        // Get all evidences with this tag
        const evidences = this.search({ tags: [oldTag] });
        let updatedCount = 0;

        for (const evidence of evidences) {
          if (!evidence.tags) continue;

          const tags = evidence.tags.split(",").map((t) => t.trim());
          const newTags = tags.map((t) => (t === oldTag ? newTag : t));

          if (this.updateTags(evidence.id, newTags.join(","))) {
            updatedCount++;
          }
        }

        return updatedCount;
      });

      return transaction();
    });
  }

  /**
   * Removes a tag from all evidences atomically using transaction
   * @param tag - Tag to remove
   * @returns Number of evidences updated
   * @throws Error if transaction fails (no partial updates)
   */
  removeTag(tag: string): number {
    return this.dbOp("remove tag", () => {
      // Wrap in transaction for atomic updates
      const transaction = this.db.transaction(() => {
        // Get all evidences with this tag
        const evidences = this.search({ tags: [tag] });
        let updatedCount = 0;

        for (const evidence of evidences) {
          if (!evidence.tags) continue;

          const tags = evidence.tags
            .split(",")
            .map((t) => t.trim())
            .filter((t) => t !== tag);
          const newTags = tags.length > 0 ? tags.join(",") : null;

          if (this.updateTags(evidence.id, newTags)) {
            updatedCount++;
          }
        }

        return updatedCount;
      });

      return transaction();
    });
  }

  /**
   * Gets all unique tags with their counts
   * @returns Map of tag to count
   */
  getTagCounts(): Map<string, number> {
    return this.dbOp("get tag counts", () => {
      const stmt = this.db.prepare(
        `SELECT tags FROM evidences WHERE tags IS NOT NULL AND tags != ''`,
      );
      const rows = stmt.all() as { tags: string }[];

      const tagCounts = new Map<string, number>();
      for (const row of rows) {
        const tags = row.tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t);
        for (const tag of tags) {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
      }

      return tagCounts;
    });
  }

  /**
   * Gets total count of all evidence records
   * @returns Total number of evidences in the database
   */
  getTotalCount(): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM evidences")
      .get() as { count: number };
    return row.count;
  }

  getSessionCount(): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM sessions")
      .get() as { count: number };
    return row.count;
  }

  /**
   * Gets count of evidence records matching a search query
   * @param query - Search text to match against conversationId and tags
   * @returns Number of matching evidences
   */
  getSearchCount(query: string): number {
    return this.getFilteredCount({ query });
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
      updatedAt: row.updatedAt,
    };
  }

  private rowToSession(row: SessionRow): SessionRecord {
    return {
      id: row.id,
      host: row.host,
      projectRoot: row.projectRoot,
      cwd: row.cwd,
      title: row.title,
      status: row.status,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      metadata: row.metadata,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private rowToContext(row: ContextRow): ContextRecord {
    return {
      id: row.id,
      label: row.label,
      workspaceKey: row.workspaceKey,
      status: row.status,
      mergedIntoContextId: row.mergedIntoContextId,
      metadata: row.metadata,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private rowToContextSessionLink(
    row: ContextSessionLinkRow,
  ): ContextSessionLinkRecord {
    return {
      sessionId: row.sessionId,
      contextId: row.contextId,
      linkSource: row.linkSource,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private rowToContextLinkRejection(
    row: ContextLinkRejectionRow,
  ): ContextLinkRejectionRecord {
    return {
      sessionId: row.sessionId,
      contextId: row.contextId,
      createdAt: row.createdAt,
    };
  }

  private rowToContextWorkspacePreference(
    row: ContextWorkspacePreferenceRow,
  ): ContextWorkspacePreferenceRecord {
    return {
      workspaceKey: row.workspaceKey,
      contextId: row.contextId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private rowToMessage(row: MessageRow): SessionMessageRecord {
    return {
      id: row.id,
      sessionId: row.sessionId,
      seq: row.seq,
      role: row.role,
      source: row.source,
      content: row.content,
      capturedAt: row.capturedAt,
      metadata: row.metadata,
    };
  }

  private rowToTimelineEvent(row: TimelineEventRow): TimelineEventRecord {
    return {
      id: row.id,
      sessionId: row.sessionId,
      seq: row.seq,
      eventType: row.eventType,
      eventSubType: row.eventSubType,
      source: row.source,
      summary: row.summary,
      payload: row.payload,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      status: row.status,
      relatedMessageId: row.relatedMessageId,
    };
  }

  private rowToArtifact(row: ArtifactRow): ArtifactRecord {
    return {
      id: row.id,
      sessionId: row.sessionId,
      eventId: row.eventId,
      artifactType: row.artifactType,
      path: row.path,
      metadata: row.metadata,
      createdAt: row.createdAt,
    };
  }

  private rowToDecision(row: DecisionRow): DecisionRecord {
    return {
      id: row.id,
      sessionId: row.sessionId,
      title: row.title,
      summary: row.summary,
      rationale: row.rationale,
      status: row.status,
      sourceRefs: row.sourceRefs,
      createdAt: row.createdAt,
    };
  }

  private rowToNarrative(row: NarrativeRow): NarrativeRecord {
    return {
      id: row.id,
      sessionId: row.sessionId,
      kind: row.kind,
      content: row.content,
      sourceRefs: row.sourceRefs,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private rowToIngestionRun(row: IngestionRunRow): IngestionRunRecord {
    return {
      id: row.id,
      sessionId: row.sessionId,
      stage: row.stage,
      status: row.status,
      error: row.error,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
    };
  }
}
