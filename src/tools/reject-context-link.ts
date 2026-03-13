import * as z from "zod";
import { rejectContextLink } from "../lib/context-memory.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";
import { contextMutationSchema } from "./context-schemas.js";

export const rejectContextLinkSchema = {
  inputSchema: {
    sessionId: z.string().min(1, "sessionId is required"),
    contextId: z.string().min(1, "contextId is required"),
  },
  outputSchema: contextMutationSchema.shape,
};

export const rejectContextLinkMetadata = {
  title: "Reject Context Link",
  description:
    "Reject a suggested session/context pair so Footprint does not keep proposing the same incorrect link.",
};

export function createRejectContextLinkHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "reject-context-link",
    "Persist a negative correction for a suggested session/context pair.",
    async (params: { sessionId: string; contextId: string }) => {
      const result = rejectContextLink(
        db,
        params.sessionId.trim(),
        params.contextId.trim(),
      );

      return formatSuccessResponse(
        "Context link rejected successfully",
        {
          Session: result.affectedSessionIds[0] ?? "unknown",
          Context: result.contextId ?? "unknown",
        },
        result,
      );
    },
  );
}
