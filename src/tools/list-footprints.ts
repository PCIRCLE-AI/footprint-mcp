import * as z from "zod";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";

export const listFootprintsSchema = {
  inputSchema: {
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Maximum number of results to return per page"),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Number of results to skip for pagination (0-based)"),
  },
  outputSchema: {
    evidences: z.array(
      z.object({
        id: z.string(),
        timestamp: z.string(),
        conversationId: z.string(),
        llmProvider: z.string(),
        messageCount: z.number(),
        tags: z.string().nullable(),
      }),
    ),
    total: z.number(),
  },
};

export const listFootprintsMetadata = {
  title: "List Footprints",
  description:
    "List all captured footprints with pagination. Returns metadata only (IDs, timestamps, tags, message counts) — use get-footprint to retrieve full decrypted content. Use search-footprints for filtered queries.",
  _meta: {
    ui: {
      resourceUri: "ui://footprint/dashboard.html",
    },
  },
};

export function createListFootprintsHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "list-footprints",
    "Ensure limit is positive and offset is non-negative.",
    async (params: { limit?: number; offset?: number }) => {
      if (params.limit !== undefined && params.limit <= 0) {
        throw new Error("Limit must be positive");
      }
      if (params.offset !== undefined && params.offset < 0) {
        throw new Error("Offset cannot be negative");
      }

      const evidences = db.list({
        limit: params.limit,
        offset: params.offset,
      });
      const mappedEvidences = evidences.map((e) => ({
        id: e.id,
        timestamp: e.timestamp,
        conversationId: e.conversationId,
        llmProvider: e.llmProvider,
        messageCount: e.messageCount,
        tags: e.tags,
      }));

      const total = db.getTotalCount();

      return formatSuccessResponse(
        "Footprint list retrieved successfully",
        {
          Count: `${evidences.length} footprint(s)`,
          Limit: params.limit ?? "No limit",
          Offset: params.offset ?? 0,
        },
        { evidences: mappedEvidences, total },
      );
    },
  );
}
