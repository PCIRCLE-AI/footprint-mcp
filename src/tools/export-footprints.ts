/* global Buffer, process */
import * as z from "zod";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";

export const exportFootprintsSchema = {
  inputSchema: {
    evidenceIds: z
      .array(z.string())
      .optional()
      .describe(
        "Specific footprint IDs to export. If omitted, exports all footprints.",
      ),
    includeGitInfo: z
      .boolean()
      .optional()
      .describe("Include Git commit hash and timestamp in export metadata"),
    outputMode: z
      .enum(["file", "base64", "both"])
      .default("both")
      .describe(
        "Output mode: 'file' writes ZIP to disk, 'base64' returns ZIP as base64 string (for Claude Desktop/MCP clients), 'both' does both (default, backward compatible).",
      ),
  },
  outputSchema: {
    filename: z.string().optional(),
    base64Data: z.string().optional(),
    checksum: z.string(),
    footprintCount: z.number(),
    success: z.boolean(),
  },
};

export const exportFootprintsMetadata = {
  title: "Export Footprints",
  description:
    "Export footprints to encrypted ZIP archive. Supports file output (write to disk), base64 output (for MCP clients like Claude Desktop), or both. Default is 'both' for backward compatibility.",
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
    async (params: {
      evidenceIds?: string[];
      includeGitInfo?: boolean;
      outputMode?: "file" | "base64" | "both";
    }) => {
      const { exportEvidences } = await import("../lib/storage/index.js");
      const fs = await import("fs");

      const outputMode = params.outputMode || "both";

      const result = await exportEvidences(db, {
        evidenceIds: params.evidenceIds,
        includeGitInfo: params.includeGitInfo ?? false,
      });

      // Enforce size limit for base64 mode (base64 adds ~33% overhead)
      const MAX_BASE64_SIZE = 75 * 1024 * 1024; // 75MB
      if (
        (outputMode === "base64" || outputMode === "both") &&
        result.zipData.length > MAX_BASE64_SIZE
      ) {
        throw new Error(
          `Export too large for base64 mode (${(result.zipData.length / (1024 * 1024)).toFixed(1)}MB). ` +
            `Use outputMode="file" or export fewer records.`,
        );
      }

      let filename: string | undefined;
      let base64Data: string | undefined;

      // Write to disk if file or both mode
      if (outputMode === "file" || outputMode === "both") {
        const os = await import("os");
        const path = await import("path");
        const outputDir =
          process.env.FOOTPRINT_DATA_DIR ||
          process.env.FOOTPRINT_EXPORT_DIR ||
          os.tmpdir();
        const outputPath = path.join(outputDir, result.filename);
        fs.writeFileSync(outputPath, result.zipData);
        filename = outputPath;
      }

      // Generate base64 if base64 or both mode
      if (outputMode === "base64" || outputMode === "both") {
        base64Data = Buffer.from(result.zipData).toString("base64");
      }

      const details: Record<
        string,
        string | number | boolean | null | undefined
      > = {
        "Footprint Count": result.footprintCount,
        Checksum: result.checksum,
        "Git Info": params.includeGitInfo ? "Included" : "Excluded",
        "Output Mode": outputMode,
      };
      if (filename) details.Filename = filename;
      if (base64Data)
        details["Base64 Size"] = `${Math.round(base64Data.length / 1024)}KB`;

      return formatSuccessResponse("Export completed successfully", details, {
        ...(filename && { filename }),
        ...(base64Data && { base64Data }),
        checksum: result.checksum,
        footprintCount: result.footprintCount,
        success: true,
      });
    },
  );
}
