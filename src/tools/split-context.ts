import * as z from "zod";
import { splitContext } from "../lib/context-memory.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";
import { contextMutationSchema } from "./context-schemas.js";

export const splitContextSchema = {
  inputSchema: {
    contextId: z.string().min(1, "contextId is required"),
    sessionIds: z
      .array(z.string().min(1))
      .min(1, "At least one sessionId is required"),
    label: z.string().optional(),
    setPreferred: z.boolean().optional(),
  },
  outputSchema: contextMutationSchema.shape,
};

export const splitContextMetadata = {
  title: "Split Context",
  description:
    "Split selected sessions from an existing context into a new canonical context.",
};

export function createSplitContextHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "split-context",
    "Create a new context from selected sessions in an existing context.",
    async (params: {
      contextId: string;
      sessionIds: string[];
      label?: string;
      setPreferred?: boolean;
    }) => {
      const result = splitContext(db, {
        contextId: params.contextId.trim(),
        sessionIds: params.sessionIds,
        label: params.label?.trim() || undefined,
        setPreferred: params.setPreferred,
      });

      return formatSuccessResponse(
        "Context split successfully",
        {
          NewContext: result.context?.label ?? result.contextId ?? "unknown",
          Sessions: result.affectedSessionIds.length,
          SourceContext: result.mergedFromContextId ?? "unknown",
        },
        result,
      );
    },
  );
}
