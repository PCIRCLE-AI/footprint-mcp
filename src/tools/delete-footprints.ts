import * as z from "zod";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import { createToolResponse } from "../lib/tool-response.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";

export const deleteFootprintsSchema = {
  inputSchema: {
    evidenceIds: z
      .array(z.string())
      .min(1)
      .max(100, "Maximum 100 IDs per delete operation")
      .describe(
        "Array of footprint IDs to delete. Always verify IDs first with search-footprints or list-footprints.",
      ),
    confirmDelete: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Set to true to confirm deletion. Without this, returns a preview of records to be deleted without actually deleting them. Two-step pattern: first call without confirmDelete to preview, then call with confirmDelete: true to execute.",
      ),
  },
  outputSchema: {
    deletedCount: z.number(),
    previewed: z
      .array(
        z.object({
          id: z.string(),
          conversationId: z.string(),
          timestamp: z.string(),
        }),
      )
      .optional(),
    notFoundIds: z.array(z.string()).optional(),
    success: z.boolean(),
  },
};

export const deleteFootprintsMetadata = {
  title: "Delete Footprints",
  description:
    "Permanently delete one or more footprint records. WARNING: Irreversible operation. Uses two-step confirmation: first call previews records, second call with confirmDelete: true performs deletion.",
};

export function createDeleteFootprintsHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "delete-footprints",
    "Verify the footprint IDs exist.",
    async (params: { evidenceIds: string[]; confirmDelete?: boolean }) => {
      if (!params.evidenceIds || params.evidenceIds.length === 0) {
        throw new Error("At least one footprint ID is required");
      }
      if (params.evidenceIds.length > 100) {
        throw new Error(
          `Too many IDs (${params.evidenceIds.length}). Maximum 100 per delete operation.`,
        );
      }

      // Preview mode: show what would be deleted without actually deleting
      if (!params.confirmDelete) {
        const previewed = params.evidenceIds
          .map((id) => db.findById(id))
          .filter((e): e is NonNullable<typeof e> => e !== null)
          .map((e) => ({
            id: e.id,
            conversationId: e.conversationId,
            timestamp: e.timestamp,
          }));

        const resultText =
          previewed.length > 0
            ? `⚠️ Preview: ${previewed.length} record(s) would be deleted:\n${previewed.map((p) => `  - ${p.id} (${p.conversationId})`).join("\n")}\n\nTo confirm, call again with confirmDelete: true`
            : `⚠️ No records found with the provided IDs`;

        return createToolResponse(resultText, {
          deletedCount: 0,
          previewed,
          success: false,
        });
      }

      // Check which IDs exist before deletion (Set for O(1) lookup)
      const existingIds = params.evidenceIds.filter((id) => db.findById(id));
      const existingSet = new Set(existingIds);
      const notFoundIds = params.evidenceIds.filter(
        (id) => !existingSet.has(id),
      );

      // Actual deletion
      const deletedCount = db.deleteMany(existingIds);
      const success = deletedCount > 0;

      let resultText = success
        ? `🗑️ Successfully deleted ${deletedCount} footprint record${deletedCount > 1 ? "s" : ""}`
        : `⚠️ No footprint records found with the provided IDs`;

      if (notFoundIds.length > 0) {
        resultText += `\n⚠️ IDs not found: ${notFoundIds.join(", ")}`;
      }

      return createToolResponse(resultText, {
        deletedCount,
        notFoundIds,
        success,
      });
    },
  );
}
