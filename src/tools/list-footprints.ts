import * as z from "zod";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";

export const listFootprintsSchema = {
  inputSchema: {
    limit: z.number().int().positive().optional().describe("Maximum results"),
    offset: z.number().int().min(0).optional().describe("Pagination offset"),
  },
  outputSchema: {
    footprints: z.array(
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
  description: "List all captured footprint with pagination",
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

      const footprints = db.list({
        limit: params.limit,
        offset: params.offset,
      });
      const mappedFootprints = footprints.map((fp) => ({
        id: fp.id,
        timestamp: fp.timestamp,
        conversationId: fp.conversationId,
        llmProvider: fp.llmProvider,
        messageCount: fp.messageCount,
        tags: fp.tags,
      }));

      return formatSuccessResponse(
        "Footprint list retrieved successfully",
        {
          Count: `${footprints.length} footprint(s)`,
          Limit: params.limit || "No limit",
          Offset: params.offset || 0,
        },
        { footprints: mappedFootprints, total: footprints.length },
      );
    },
  );
}
