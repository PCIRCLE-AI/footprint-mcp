import * as z from "zod";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import { createToolResponse } from "../lib/tool-response.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";

export const getTagStatsSchema = {
  inputSchema: {},
  outputSchema: {
    tags: z.array(
      z.object({
        tag: z.string(),
        count: z.number(),
      }),
    ),
    totalTags: z.number(),
  },
};

export const getTagStatsMetadata = {
  title: "Get Tag Statistics",
  description: "Get all unique tags with their usage counts",
};

export function createGetTagStatsHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "get-tag-stats",
    "Check database connectivity.",
    async () => {
      const tagCounts = db.getTagCounts();
      const tags = Array.from(tagCounts.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);

      const resultText =
        tags.length > 0
          ? `📊 Tag Statistics:\n${tags.map((t) => `  • ${t.tag}: ${t.count}`).join("\n")}`
          : `📊 No tags found in any footprint records`;

      return createToolResponse(resultText, {
        tags,
        totalTags: tags.length,
      });
    },
  );
}
