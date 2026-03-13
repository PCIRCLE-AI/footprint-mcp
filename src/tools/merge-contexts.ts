import * as z from "zod";
import { mergeContexts } from "../lib/context-memory.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";
import { contextMutationSchema } from "./context-schemas.js";

export const mergeContextsSchema = {
  inputSchema: {
    sourceContextId: z.string().min(1, "sourceContextId is required"),
    targetContextId: z.string().min(1, "targetContextId is required"),
  },
  outputSchema: contextMutationSchema.shape,
};

export const mergeContextsMetadata = {
  title: "Merge Contexts",
  description:
    "Merge one canonical context into another and preserve the target as the active context.",
};

export function createMergeContextsHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "merge-contexts",
    "Merge a source context into a target context.",
    async (params: { sourceContextId: string; targetContextId: string }) => {
      const result = mergeContexts(
        db,
        params.sourceContextId.trim(),
        params.targetContextId.trim(),
      );

      return formatSuccessResponse(
        "Contexts merged successfully",
        {
          TargetContext: result.context?.label ?? result.contextId ?? "unknown",
          MergedFrom: result.mergedFromContextId ?? "unknown",
          Sessions: result.affectedSessionIds.length,
        },
        result,
      );
    },
  );
}
