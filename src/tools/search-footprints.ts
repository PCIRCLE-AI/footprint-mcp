import * as z from "zod";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";

export const searchFootprintsSchema = {
  inputSchema: {
    query: z
      .string()
      .optional()
      .describe("Search text (matches conversationId, tags)"),
    tags: z.array(z.string()).optional().describe("Filter by tags"),
    dateFrom: z.string().optional().describe("Start date (ISO format)"),
    dateTo: z.string().optional().describe("End date (ISO format)"),
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
  description: "Search and filter footprints by query, tags, or date range",
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

      const footprints = db.search({
        query: params.query,
        tags: params.tags,
        dateFrom: params.dateFrom,
        dateTo: params.dateTo,
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
        "Search completed successfully",
        {
          Results: `${footprints.length} footprint(s) found`,
          Query: params.query || "None",
          Tags: params.tags?.join(", ") || "None",
          "Date Range": `${params.dateFrom || "Start"} to ${params.dateTo || "End"}`,
        },
        { footprints: mappedFootprints, total: footprints.length },
      );
    },
  );
}
