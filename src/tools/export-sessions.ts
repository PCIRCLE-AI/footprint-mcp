import { Buffer } from "node:buffer";
import * as z from "zod";
import { formatSuccessResponse } from "../lib/tool-response.js";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";
import { sessionDetailUiMetadata } from "./session-ui-metadata.js";

const outputModeEnum = z.enum(["file", "base64", "both"]);
const sessionHostEnum = z.enum(["claude", "gemini", "codex"]);
const sessionStatusEnum = z.enum([
  "running",
  "completed",
  "failed",
  "interrupted",
]);
const trendGroupByEnum = z.enum(["issue", "family"]);

export const exportSessionsSchema = {
  inputSchema: {
    sessionIds: z
      .array(z.string())
      .optional()
      .describe(
        "Specific session IDs to export. If omitted, exports all recorded sessions.",
      ),
    query: z
      .string()
      .optional()
      .describe(
        "Optional text filter across metadata, transcript, and derived history. Cannot be combined with sessionIds.",
      ),
    issueKey: z
      .string()
      .optional()
      .describe(
        "Optional exact issue key filter. Cannot be combined with sessionIds.",
      ),
    host: sessionHostEnum
      .optional()
      .describe("Optional host filter. Cannot be combined with sessionIds."),
    status: sessionStatusEnum
      .optional()
      .describe("Optional status filter. Cannot be combined with sessionIds."),
    groupBy: trendGroupByEnum
      .optional()
      .describe(
        "Optional history summary grouping. Controls whether exported cross-session summaries are grouped by exact issue keys or broader failure families.",
      ),
    outputMode: outputModeEnum
      .default("both")
      .describe(
        "Output mode: 'file' writes ZIP to disk, 'base64' returns ZIP as base64 string, 'both' does both.",
      ),
  },
  outputSchema: {
    filename: z.string().optional(),
    base64Data: z.string().optional(),
    checksum: z.string(),
    sessionCount: z.number(),
    historyGrouping: trendGroupByEnum,
    filters: z
      .object({
        query: z.string().optional(),
        issueKey: z.string().optional(),
        host: sessionHostEnum.optional(),
        status: sessionStatusEnum.optional(),
        groupBy: trendGroupByEnum.optional(),
      })
      .optional(),
    sessions: z.array(
      z.object({
        id: z.string(),
        host: sessionHostEnum,
        label: z.string(),
        status: sessionStatusEnum,
        startedAt: z.string(),
        endedAt: z.string().nullable(),
      }),
    ),
    success: z.boolean(),
  },
};

export const exportSessionsMetadata = {
  title: "Export Sessions",
  description:
    "Export recorded CLI sessions to a ZIP archive with raw transcript, timeline, derived artifacts, narratives, decisions, and top-level history summaries.",
  ...sessionDetailUiMetadata,
};

export function createExportSessionsHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "export-sessions",
    "Check session IDs exist, do not mix sessionIds with query/issueKey/host/status filters, and use outputMode='file' if the archive is too large for base64 delivery.",
    async (params: {
      sessionIds?: string[];
      query?: string;
      issueKey?: string;
      host?: "claude" | "gemini" | "codex";
      status?: "running" | "completed" | "failed" | "interrupted";
      groupBy?: "issue" | "family";
      outputMode?: "file" | "base64" | "both";
    }) => {
      const { exportSessions } = await import("../lib/storage/index.js");
      const fs = await import("fs");
      const os = await import("os");
      const path = await import("path");

      const outputMode = params.outputMode || "both";
      const result = await exportSessions(db, {
        sessionIds: params.sessionIds,
        query: params.query,
        issueKey: params.issueKey,
        host: params.host,
        status: params.status,
        groupBy: params.groupBy,
      });
      const maxBase64Size = 75 * 1024 * 1024;

      if (
        (outputMode === "base64" || outputMode === "both") &&
        result.zipData.length > maxBase64Size
      ) {
        throw new Error(
          `Export too large for base64 mode (${(result.zipData.length / (1024 * 1024)).toFixed(1)}MB). Use outputMode="file" or export fewer sessions.`,
        );
      }

      let filename: string | undefined;
      let base64Data: string | undefined;

      if (outputMode === "file" || outputMode === "both") {
        const outputDir =
          process.env.FOOTPRINT_DATA_DIR ||
          process.env.FOOTPRINT_EXPORT_DIR ||
          os.tmpdir();
        const outputPath = path.join(outputDir, result.filename);
        fs.writeFileSync(outputPath, result.zipData);
        filename = outputPath;
      }

      if (outputMode === "base64" || outputMode === "both") {
        base64Data = Buffer.from(result.zipData).toString("base64");
      }

      const details: Record<
        string,
        string | number | boolean | null | undefined
      > = {
        Sessions: result.sessionCount,
        Checksum: result.checksum,
        "Output Mode": outputMode,
      };

      if (filename) {
        details.Filename = filename;
      }

      if (base64Data) {
        details["Base64 Size"] = `${Math.round(base64Data.length / 1024)}KB`;
      }

      if (result.filters) {
        details.Query = result.filters.query ?? "all";
        details.Issue = result.filters.issueKey ?? "all";
        details.Host = result.filters.host ?? "all";
        details.Status = result.filters.status ?? "all";
      }
      details["History Grouping"] = result.historyGrouping;

      return formatSuccessResponse(
        "Session export completed successfully",
        details,
        {
          ...(filename && { filename }),
          ...(base64Data && { base64Data }),
          checksum: result.checksum,
          sessionCount: result.sessionCount,
          historyGrouping: result.historyGrouping,
          ...(result.filters ? { filters: result.filters } : {}),
          sessions: result.sessions,
          success: true,
        },
      );
    },
  );
}
