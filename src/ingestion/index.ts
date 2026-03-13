import type { EvidenceDatabase } from "../lib/storage/index.js";
import { traceSyncOperation } from "../lib/observability.js";
import { runDeterministicIngestion } from "./deterministic.js";
import { runSemanticIngestion } from "./semantic.js";
import type { IngestionSummary } from "./types.js";

export type { SourceRef, IngestionSummary } from "./types.js";

function assertSessionCanBeReingested(
  db: EvidenceDatabase,
  sessionId: string,
): void {
  const session = db.findSessionById(sessionId);
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  if (session.status === "running") {
    throw new Error(
      `Session is still running and cannot be reingested yet: ${sessionId}`,
    );
  }
}

export function reingestSessionHistory(
  db: EvidenceDatabase,
  sessionId: string,
): IngestionSummary {
  return traceSyncOperation(
    "reingest-session-history",
    {
      sessionId,
    },
    () => {
      assertSessionCanBeReingested(db, sessionId);
      const artifacts = runDeterministicIngestion(db, sessionId);
      const semantic = runSemanticIngestion(db, sessionId);

      return {
        artifactsCreated: artifacts.length,
        narrativesCreated: semantic.narratives.length,
        decisionsCreated: semantic.decisions.length,
      };
    },
  );
}
