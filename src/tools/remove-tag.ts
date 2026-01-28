import * as z from "zod";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import { createToolResponse } from "../lib/tool-response.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";

export const removeTagSchema = {
  inputSchema: {
    tag: z.string().min(1).describe("Tag name to remove"),
  },
  outputSchema: {
    updatedCount: z.number(),
    success: z.boolean(),
  },
};

export const removeTagMetadata = {
  title: "Remove Tag",
  description: "Remove a tag from all footprint records",
};

export function createRemoveTagHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "remove-tag",
    "Ensure tag name is valid.",
    async (params: { tag: string }) => {
      if (!params.tag) {
        throw new Error("Tag name is required");
      }

      const updatedCount = db.removeTag(params.tag.trim());
      const success = updatedCount > 0;

      const resultText = success
        ? `🗑️ Removed tag "${params.tag}" from ${updatedCount} footprint record${updatedCount > 1 ? "s" : ""}`
        : `⚠️ No footprint records found with tag "${params.tag}"`;

      return createToolResponse(resultText, { updatedCount, success });
    },
  );
}
