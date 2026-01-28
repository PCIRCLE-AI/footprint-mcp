import * as z from "zod";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import { createToolResponse } from "../lib/tool-response.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";

export const renameTagSchema = {
  inputSchema: {
    oldTag: z.string().min(1).describe("Current tag name to rename"),
    newTag: z.string().min(1).describe("New tag name"),
  },
  outputSchema: {
    updatedCount: z.number(),
    success: z.boolean(),
  },
};

export const renameTagMetadata = {
  title: "Rename Tag",
  description: "Rename a tag across all footprint records",
};

export function createRenameTagHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "rename-tag",
    "Ensure tag names are valid and different.",
    async (params: { oldTag: string; newTag: string }) => {
      if (!params.oldTag || !params.newTag) {
        throw new Error("Both old and new tag names are required");
      }

      if (params.oldTag.trim() === params.newTag.trim()) {
        throw new Error("New tag must be different from old tag");
      }

      const updatedCount = db.renameTag(
        params.oldTag.trim(),
        params.newTag.trim(),
      );
      const success = updatedCount > 0;

      const resultText = success
        ? `🏷️ Renamed tag "${params.oldTag}" to "${params.newTag}" in ${updatedCount} footprint record${updatedCount > 1 ? "s" : ""}`
        : `⚠️ No footprint records found with tag "${params.oldTag}"`;

      return createToolResponse(resultText, { updatedCount, success });
    },
  );
}
