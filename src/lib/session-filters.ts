import { getArtifactSearchableText } from "./session-artifacts.js";
import type {
  EvidenceDatabase,
  SessionHost,
  SessionRecord,
  SessionStatus,
} from "./storage/index.js";

export interface SessionHistoryFilters {
  host?: SessionHost;
  status?: SessionStatus;
  query?: string;
  issueKey?: string;
  sessionIds?: string[];
}

export function collectSessionSearchableText(
  db: EvidenceDatabase,
  session: SessionRecord,
): string[] {
  const detail = db.getSessionDetail(session.id);
  return [
    session.title ?? "",
    session.metadata ?? "",
    ...(detail?.messages.map((message) => message.content) ?? []),
    ...(detail?.artifacts.flatMap((artifact) =>
      getArtifactSearchableText(artifact),
    ) ?? []),
    ...(detail?.narratives.map((narrative) => narrative.content) ?? []),
    ...(detail?.decisions.map((decision) => decision.summary) ?? []),
  ];
}

export function filterSessionsByHistory(
  db: EvidenceDatabase,
  filters: SessionHistoryFilters,
): SessionRecord[] {
  return db.querySessionsByHistory(filters).sessions;
}
