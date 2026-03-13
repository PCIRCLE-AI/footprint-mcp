import * as z from "zod";
import { resolveContext } from "../lib/context-memory.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import type { EvidenceDatabase, SessionHost } from "../lib/storage/index.js";
import { contextResolutionSchema, sessionHostEnum } from "./context-schemas.js";

export const resolveContextSchema = {
  inputSchema: {
    sessionId: z.string().optional(),
    cwd: z.string().optional(),
    title: z.string().optional(),
    host: sessionHostEnum.optional(),
  },
  outputSchema: contextResolutionSchema.shape,
};

export const resolveContextMetadata = {
  title: "Resolve Context",
  description:
    "Resolve the most likely Footprint context for a session or workspace. Returns candidates and whether the client should ask the user to confirm.",
};

export function createResolveContextHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "resolve-context",
    "Provide sessionId or cwd. If confirmationRequired is true, the client should ask the user instead of assuming the correct context.",
    async (params: {
      sessionId?: string;
      cwd?: string;
      title?: string;
      host?: SessionHost;
    }) => {
      const result = resolveContext(db, {
        sessionId: params.sessionId?.trim() || undefined,
        cwd: params.cwd?.trim() || undefined,
        title: params.title?.trim() || undefined,
        host: params.host,
      });

      return formatSuccessResponse(
        "Context resolution completed",
        {
          Mode: result.mode,
          ConfirmationRequired: result.confirmationRequired ? "yes" : "no",
          RecommendedAction: result.recommendedAction,
          Candidates: result.candidates.length,
        },
        result,
      );
    },
  );
}
