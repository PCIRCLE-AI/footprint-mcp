import * as z from "zod";
import { moveSessionContext } from "../lib/context-memory.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";
import { contextMutationSchema } from "./context-schemas.js";

export const moveSessionContextSchema = {
  inputSchema: {
    sessionId: z.string().min(1, "sessionId is required"),
    contextId: z.string().optional(),
    label: z.string().optional(),
    setPreferred: z.boolean().optional(),
  },
  outputSchema: contextMutationSchema.shape,
};

export const moveSessionContextMetadata = {
  title: "Move Session Context",
  description:
    "Move an already-linked session into another or new canonical context.",
};

export function createMoveSessionContextHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "move-session-context",
    "Move a linked session into an existing context or create a new one.",
    async (params: {
      sessionId: string;
      contextId?: string;
      label?: string;
      setPreferred?: boolean;
    }) => {
      const result = moveSessionContext(db, {
        sessionId: params.sessionId.trim(),
        contextId: params.contextId?.trim() || undefined,
        label: params.label?.trim() || undefined,
        setPreferred: params.setPreferred,
      });

      return formatSuccessResponse(
        "Session moved to context successfully",
        {
          Session: result.affectedSessionIds[0] ?? "unknown",
          Context: result.context?.label ?? result.contextId ?? "unknown",
        },
        result,
      );
    },
  );
}
