/**
 * Evidence record stored in the database
 */
export interface Evidence {
  id: string;
  timestamp: string; // ISO 8601 format
  conversationId: string | null;
  llmProvider: string | null;
  encryptedContent: Uint8Array;
  nonce: Uint8Array;
  contentHash: string; // SHA-256 hex string
  messageCount: number;
  gitCommitHash: string | null;
  gitTimestamp: string | null; // ISO 8601 format
  tags: string | null; // JSON array stored as string
  createdAt: string; // ISO 8601 format
  updatedAt: string; // ISO 8601 format
}

/**
 * Metadata key-value pairs for schema versioning and other system data
 */
export interface Metadata {
  key: string;
  value: string;
}

export type SessionHost = "claude" | "gemini" | "codex";

export type SessionStatus = "running" | "completed" | "failed" | "interrupted";

export type SessionMessageRole = "user" | "assistant" | "system";

export interface SessionRecord {
  id: string;
  host: SessionHost;
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

export interface SessionMessageRecord {
  id: string;
  sessionId: string;
  seq: number;
  role: SessionMessageRole;
  source: string;
  content: string;
  capturedAt: string;
  metadata: string | null;
}

export interface TimelineEventRecord {
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

export type ArtifactType =
  | "file-change"
  | "command-output"
  | "test-result"
  | "git-commit";

export interface ArtifactRecord {
  id: string;
  sessionId: string;
  eventId: string | null;
  artifactType: ArtifactType;
  path: string | null;
  metadata: string | null;
  createdAt: string;
}

export type DecisionStatus = "proposed" | "accepted" | "rejected" | "open";

export interface DecisionRecord {
  id: string;
  sessionId: string;
  title: string;
  summary: string;
  rationale: string | null;
  status: DecisionStatus;
  sourceRefs: string;
  createdAt: string;
}

export type NarrativeKind = "journal" | "project-summary" | "handoff";

export interface NarrativeRecord {
  id: string;
  sessionId: string;
  kind: NarrativeKind;
  content: string;
  sourceRefs: string;
  createdAt: string;
  updatedAt: string;
}

export type IngestionStage = "deterministic" | "semantic";

export type IngestionStatus = "running" | "completed" | "failed";

export interface IngestionRunRecord {
  id: string;
  sessionId: string;
  stage: IngestionStage;
  status: IngestionStatus;
  error: string | null;
  startedAt: string;
  endedAt: string | null;
}

export interface SessionDetail {
  session: SessionRecord;
  messages: SessionMessageRecord[];
  timeline: TimelineEventRecord[];
  artifacts: ArtifactRecord[];
  narratives: NarrativeRecord[];
  decisions: DecisionRecord[];
  ingestionRuns: IngestionRunRecord[];
  hasNarratives: boolean;
}

export type ContextStatus = "active" | "merged";

export type ContextLinkSource =
  | "confirmed"
  | "moved"
  | "split"
  | "merge"
  | "bootstrap";

export interface ContextRecord {
  id: string;
  label: string;
  workspaceKey: string;
  status: ContextStatus;
  mergedIntoContextId: string | null;
  metadata: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContextSessionLinkRecord {
  sessionId: string;
  contextId: string;
  linkSource: ContextLinkSource;
  createdAt: string;
  updatedAt: string;
}

export interface ContextLinkRejectionRecord {
  sessionId: string;
  contextId: string;
  createdAt: string;
}

export interface ContextWorkspacePreferenceRecord {
  workspaceKey: string;
  contextId: string;
  createdAt: string;
  updatedAt: string;
}
