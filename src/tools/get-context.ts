import * as z from "zod";
import { getContextReport } from "../lib/context-memory.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";
import { contextReportSchema } from "./context-schemas.js";

export const getContextSchema = {
  inputSchema: {
    id: z.string().min(1, "Context ID is required"),
  },
  outputSchema: contextReportSchema.shape,
};

export const getContextMetadata = {
  title: "Get Context",
  description:
    "Return the current truth, blockers, open questions, decisions, and recent session trail for a canonical context.",
};

export function createGetContextHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "get-context",
    "Fetch a canonical context briefing by ID.",
    async (params: { id: string }) => {
      const report = getContextReport(db, params.id.trim());
      return formatSuccessResponse(
        "Context retrieved successfully",
        {
          Context: report.context.label,
          Sessions: report.context.sessionCount,
          ActiveDecisions: report.activeDecisions.length,
          ActiveBlockers: report.currentTruth.activeBlockers.length,
        },
        report,
      );
    },
  );
}
