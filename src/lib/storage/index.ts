export { createSchema, verifySchema } from "./schema.js";
export { EvidenceDatabase } from "./database.js";
export type {
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
  Metadata,
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
export { getCurrentCommit, type GitInfo } from "./git.js";
export {
  exportEvidences,
  type ExportOptions,
  type ExportResult,
} from "./export.js";
export {
  exportSessions,
  type SessionExportOptions,
  type SessionExportResult,
} from "./export-sessions.js";
export { storeSalt, retrieveSalt, hasSalt } from "./salt-storage.js";
