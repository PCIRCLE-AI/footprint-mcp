import * as z from "zod";
import { listContexts } from "../lib/context-memory.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";
import { contextListItemSchema } from "./context-schemas.js";
import { sessionDashboardUiMetadata } from "./session-ui-metadata.js";

export const listContextsSchema = {
  inputSchema: {},
  outputSchema: {
    contexts: z.array(contextListItemSchema),
    total: z.number(),
  },
};

export const listContextsMetadata = {
  title: "List Contexts",
  description:
    "List canonical Footprint contexts that users have confirmed or corrected. These are safe context buckets, not heuristic auto-links.",
  ...sessionDashboardUiMetadata,
};

export function createListContextsHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "list-contexts",
    "Return confirmed Footprint contexts in reverse-recency order.",
    async () => {
      const result = listContexts(db);
      return formatSuccessResponse(
        "Contexts retrieved successfully",
        {
          Count: result.contexts.length,
          Total: result.total,
        },
        result,
      );
    },
  );
}
