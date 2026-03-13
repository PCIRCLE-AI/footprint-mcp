import * as z from "zod";
import { setActiveContext } from "../lib/context-memory.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";
import { contextMutationSchema } from "./context-schemas.js";

export const setActiveContextSchema = {
  inputSchema: {
    contextId: z.string().min(1, "contextId is required"),
    cwd: z.string().optional(),
  },
  outputSchema: contextMutationSchema.shape,
};

export const setActiveContextMetadata = {
  title: "Set Active Context",
  description:
    "Set the preferred context for a workspace so future context resolution can start from the latest known truth.",
};

export function createSetActiveContextHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "set-active-context",
    "Set a preferred context for a workspace path or the context's own workspace.",
    async (params: { contextId: string; cwd?: string }) => {
      const result = setActiveContext(
        db,
        params.contextId.trim(),
        params.cwd?.trim() || undefined,
      );

      return formatSuccessResponse(
        "Preferred context updated successfully",
        {
          Context: result.context?.label ?? result.contextId ?? "unknown",
          Workspace:
            params.cwd?.trim() || result.context?.workspaceKey || "default",
        },
        result,
      );
    },
  );
}
