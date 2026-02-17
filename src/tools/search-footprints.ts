import * as z from "zod";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";

export const searchFootprintsSchema = {
  inputSchema: {
    query: z
      .string()
      .optional()
      .describe(
        "Search text (matches conversationId and tags via LIKE). Combine with tags for precise filtering.",
      ),
    tags: z
      .array(z.string())
      .optional()
      .describe(
        "Filter by tags (AND logic — all specified tags must be present)",
      ),
    dateFrom: z
      .string()
      .optional()
      .describe(
        "Start date filter (ISO 8601 format, e.g., 2026-01-01T00:00:00Z)",
      ),
    dateTo: z
      .string()
      .optional()
      .describe(
        "End date filter (ISO 8601 format, e.g., 2026-12-31T23:59:59Z)",
      ),
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

export const searchFootprintsMetadata = {
  title: "Search Footprints",
  description:
    "Search and filter footprints by query, tags, or date range. Query matches conversationId and tags (LIKE). Tags filter uses AND logic — all specified tags must be present. Query + tags combined with AND. Returns paginated results with total matching count.",
};

export function createSearchFootprintsHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "search-footprints",
    "Check date format (ISO 8601), limit > 0, and offset >= 0.",
    async (params: {
      query?: string;
      tags?: string[];
      dateFrom?: string;
      dateTo?: string;
      limit?: number;
      offset?: number;
    }) => {
      // Validate parameters
      if (params.limit !== undefined && params.limit <= 0) {
        throw new Error("Limit must be positive");
      }
      if (params.offset !== undefined && params.offset < 0) {
        throw new Error("Offset cannot be negative");
      }

      // Validate date format if provided
      if (params.dateFrom) {
        const date = new Date(params.dateFrom);
        if (isNaN(date.getTime())) {
          throw new Error("dateFrom must be a valid ISO date string");
        }
      }
      if (params.dateTo) {
        const date = new Date(params.dateTo);
        if (isNaN(date.getTime())) {
          throw new Error("dateTo must be a valid ISO date string");
        }
      }

      // Cross-validate date range using parsed dates (handles timezone offsets correctly)
      if (params.dateFrom && params.dateTo) {
        if (new Date(params.dateFrom) > new Date(params.dateTo)) {
          throw new Error("dateFrom must be before dateTo");
        }
      }

      // Single combined query for results + count (avoids duplicate WHERE clause)
      const { evidences, total } = db.searchWithCount({
        query: params.query,
        tags: params.tags,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
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

      return formatSuccessResponse(
        "Search completed successfully",
        {
          Results: `${evidences.length} footprint(s) found`,
          Query: params.query || "None",
          Tags: params.tags?.join(", ") || "None",
          "Date Range": `${params.dateFrom || "Start"} to ${params.dateTo || "End"}`,
        },
        { footprints: mappedEvidences, total },
      );
    },
  );
}
