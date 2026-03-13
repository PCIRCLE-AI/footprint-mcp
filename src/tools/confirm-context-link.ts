import * as z from "zod";
import { confirmContextLink } from "../lib/context-memory.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";
import { contextMutationSchema } from "./context-schemas.js";

export const confirmContextLinkSchema = {
  inputSchema: {
    sessionIds: z
      .array(z.string().min(1))
      .min(1, "At least one sessionId is required"),
    contextId: z.string().optional(),
    label: z.string().optional(),
    setPreferred: z.boolean().optional(),
  },
  outputSchema: contextMutationSchema.shape,
};

export const confirmContextLinkMetadata = {
  title: "Confirm Context Link",
  description:
    "Confirm one or more sessions into an existing or new canonical context. This is the mutation step after resolve-context suggested candidates.",
};

export function createConfirmContextLinkHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "confirm-context-link",
    "Confirm one or more sessions into an existing context or create a new context with label.",
    async (params: {
      sessionIds: string[];
      contextId?: string;
      label?: string;
      setPreferred?: boolean;
    }) => {
      const result = confirmContextLink(db, {
        sessionIds: params.sessionIds,
        contextId: params.contextId?.trim() || undefined,
        label: params.label?.trim() || undefined,
        setPreferred: params.setPreferred,
      });

      return formatSuccessResponse(
        "Context link confirmed successfully",
        {
          Action: result.action,
          Context: result.context?.label ?? result.contextId ?? "created",
          Sessions: result.affectedSessionIds.length,
        },
        result,
      );
    },
  );
}
