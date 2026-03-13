import * as z from "zod";
import { reingestSessionHistory } from "../ingestion/index.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";
import { sessionDetailUiMetadata } from "./session-ui-metadata.js";

export const reingestSessionSchema = {
  inputSchema: {
    id: z.string().describe("ID of the recorded session to reingest"),
  },
  outputSchema: {
    sessionId: z.string(),
    artifactsCreated: z.number(),
    narrativesCreated: z.number(),
    decisionsCreated: z.number(),
  },
};

export const reingestSessionMetadata = {
  title: "Reingest Session",
  description:
    "Regenerate deterministic artifacts, narratives, and decisions from preserved raw session history.",
  ...sessionDetailUiMetadata,
};

export function createReingestSessionHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "reingest-session",
    "Verify the session exists, is no longer running, and that raw session history is available.",
    async (params: { id: string }) => {
      const session = db.findSessionById(params.id);
      if (!session) {
        throw new Error(`Session not found: ${params.id}`);
      }

      if (session.status === "running") {
        throw new Error(
          `Session is still running and cannot be reingested yet: ${params.id}`,
        );
      }

      const summary = reingestSessionHistory(db, params.id);
      return formatSuccessResponse(
        "Session reingested successfully",
        {
          Session: params.id,
          Artifacts: summary.artifactsCreated,
          Narratives: summary.narrativesCreated,
          Decisions: summary.decisionsCreated,
        },
        {
          sessionId: params.id,
          ...summary,
        },
      );
    },
  );
}
