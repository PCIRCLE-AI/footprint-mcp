import * as z from "zod";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import { createToolResponse } from "../lib/tool-response.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";

export const deleteFootprintsSchema = {
  inputSchema: {
    evidenceIds: z
      .array(z.string())
      .min(1)
      .describe("Array of footprint IDs to delete"),
  },
  outputSchema: {
    deletedCount: z.number(),
    success: z.boolean(),
  },
};

export const deleteFootprintsMetadata = {
  title: "Delete Footprints",
  description: "Permanently delete one or more footprint records",
};

export function createDeleteFootprintsHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "delete-footprints",
    "Verify the footprint IDs exist.",
    async (params: { evidenceIds: string[] }) => {
      if (!params.evidenceIds || params.evidenceIds.length === 0) {
        throw new Error("At least one evidence ID is required");
      }

      const deletedCount = db.deleteMany(params.evidenceIds);
      const success = deletedCount > 0;

      const resultText = success
        ? `🗑️ Successfully deleted ${deletedCount} footprint record${deletedCount > 1 ? "s" : ""}`
        : `⚠️ No footprint records found with the provided IDs`;

      return createToolResponse(resultText, { deletedCount, success });
    },
  );
}
