import * as z from "zod";
import { buildHistoryHandoffReport } from "../lib/history-handoff.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import type {
  EvidenceDatabase,
  SessionHost,
  SessionStatus,
} from "../lib/storage/index.js";
import { sessionDashboardUiMetadata } from "./session-ui-metadata.js";

const sessionHostEnum = z.enum(["claude", "gemini", "codex"]);
const sessionStatusEnum = z.enum([
  "running",
  "completed",
  "failed",
  "interrupted",
]);
const trendGroupByEnum = z.enum(["issue", "family"]);

export const getHistoryHandoffSchema = {
  inputSchema: {
    query: z
      .string()
      .optional()
      .describe(
        "Optional text filter across metadata, transcript, and derived history",
      ),
    issueKey: z.string().optional().describe("Optional exact issue key filter"),
    host: sessionHostEnum.optional().describe("Optional host filter"),
    status: sessionStatusEnum.optional().describe("Optional status filter"),
    groupBy: trendGroupByEnum
      .optional()
      .describe(
        "Aggregate blockers and trend counts by exact issue keys or broader failure families",
      ),
  },
  outputSchema: {
    filters: z.object({
      query: z.string().optional(),
      issueKey: z.string().optional(),
      host: sessionHostEnum.optional(),
      status: sessionStatusEnum.optional(),
      groupBy: trendGroupByEnum.optional(),
    }),
    summary: z.object({
      groupBy: trendGroupByEnum,
      headline: z.string(),
      matchingSessions: z.number(),
      matchingHosts: z.array(sessionHostEnum),
      statuses: z.array(sessionStatusEnum),
      totalTrends: z.number(),
      blockingTrends: z.number(),
      recoveredTrends: z.number(),
      regressedTrends: z.number(),
      unresolvedQuestions: z.number(),
      latestSessionId: z.string().nullable(),
      latestSessionLabel: z.string().nullable(),
      latestStartedAt: z.string().nullable(),
    }),
    blockers: z.array(z.string()),
    recoveries: z.array(z.string()),
    followUps: z.array(z.string()),
    recentSessions: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        host: sessionHostEnum,
        status: sessionStatusEnum,
        startedAt: z.string(),
        endedAt: z.string().nullable(),
      }),
    ),
    markdown: z.string(),
  },
};

export const getHistoryHandoffMetadata = {
  title: "Get History Handoff",
  description:
    "Summarize the current history scope as a handoff-oriented status report with blockers, follow-ups, recent sessions, and optional broader failure-family grouping.",
  ...sessionDashboardUiMetadata,
};

export function createGetHistoryHandoffHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "get-history-handoff",
    "Use optional query, issueKey, host, status, and groupBy filters to summarize the current history scope.",
    async (params: {
      query?: string;
      issueKey?: string;
      host?: SessionHost;
      status?: SessionStatus;
      groupBy?: "issue" | "family";
    }) => {
      const report = buildHistoryHandoffReport(db, params);

      return formatSuccessResponse(
        "History handoff retrieved successfully",
        {
          Query: params.query?.trim() || "all",
          Issue: params.issueKey?.trim() || "all",
          Host: params.host ?? "all",
          Status: params.status ?? "all",
          GroupBy: params.groupBy ?? "issue",
          Sessions: report.summary.matchingSessions,
          Trends: report.summary.totalTrends,
          Blockers: report.summary.blockingTrends,
          Questions: report.summary.unresolvedQuestions,
        },
        report,
      );
    },
  );
}
