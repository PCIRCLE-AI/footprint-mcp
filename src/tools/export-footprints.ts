import * as z from "zod";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";

export const exportFootprintsSchema = {
  inputSchema: {
    evidenceIds: z
      .array(z.string())
      .optional()
      .describe("Specific IDs (empty = all)"),
    includeGitInfo: z.boolean().optional().describe("Include Git timestamps"),
  },
  outputSchema: {
    filename: z.string(),
    checksum: z.string(),
    evidenceCount: z.number(),
    success: z.boolean(),
  },
};

export const exportFootprintsMetadata = {
  title: "Export Footprints",
  description: "Export footprints to encrypted ZIP archive",
  _meta: {
    ui: {
      resourceUri: "ui://footprint/export.html",
    },
  },
};

export function createExportFootprintsHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "export-footprints",
    "Check evidenceIds exist and filesystem has write permissions.",
    async (params: { evidenceIds?: string[]; includeGitInfo?: boolean }) => {
      const { exportEvidences } = await import("../lib/storage/index.js");
      const fs = await import("fs");

      const result = await exportEvidences(db, {
        evidenceIds: params.evidenceIds,
        includeGitInfo: params.includeGitInfo ?? false,
      });

      fs.writeFileSync(result.filename, result.zipData);

      return formatSuccessResponse(
        "Export completed successfully",
        {
          "Footprint Count": result.evidenceCount,
          Filename: result.filename,
          Checksum: result.checksum,
          "Git Info": params.includeGitInfo ? "Included" : "Excluded",
        },
        {
          filename: result.filename,
          checksum: result.checksum,
          evidenceCount: result.evidenceCount,
          success: true,
        },
      );
    },
  );
}
