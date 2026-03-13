import * as z from "zod";
import { buildHistoryTrendReport } from "../lib/session-trends.js";
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

export const getHistoryTrendsSchema = {
  inputSchema: {
    query: z
      .string()
      .optional()
      .describe("Optional text filter across issue key, label, and kind"),
    issueKey: z.string().optional().describe("Optional exact issue key filter"),
    host: sessionHostEnum.optional().describe("Optional host filter"),
    status: sessionStatusEnum
      .optional()
      .describe("Optional session status filter"),
    groupBy: trendGroupByEnum
      .optional()
      .describe("Aggregate by exact issue keys or broader failure families"),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().min(0).optional(),
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
      totalTrends: z.number(),
      matchingSessions: z.number(),
      totalAttempts: z.number(),
      activeBlockers: z.number(),
      recoveredTrends: z.number(),
      regressedTrends: z.number(),
      byOutcome: z.object({
        failed: z.number(),
        succeeded: z.number(),
        other: z.number(),
      }),
    }),
    total: z.number(),
    trends: z.array(
      z.object({
        groupBy: trendGroupByEnum,
        issueKey: z.string(),
        label: z.string(),
        kind: z.string().nullable(),
        relatedIssueKeys: z.array(z.string()),
        blockerCategory: z.string(),
        blockerState: z.enum(["active", "resolved"]),
        remediationState: z.enum([
          "unresolved",
          "recovered",
          "regressed",
          "stable",
        ]),
        remediationSummary: z.string(),
        latestOutcome: z.string(),
        latestFailureAt: z.string().nullable(),
        latestSuccessAt: z.string().nullable(),
        lastSeenAt: z.string(),
        attemptCount: z.number(),
        sessionCount: z.number(),
        failedAttempts: z.number(),
        succeededAttempts: z.number(),
        otherAttempts: z.number(),
        hosts: z.array(sessionHostEnum),
        statuses: z.array(sessionStatusEnum),
        sessions: z.array(
          z.object({
            sessionId: z.string(),
            label: z.string(),
            host: sessionHostEnum,
            status: sessionStatusEnum,
            startedAt: z.string(),
            lastAttemptAt: z.string(),
            attempts: z.number(),
            latestOutcome: z.string(),
          }),
        ),
      }),
    ),
  },
};

export const getHistoryTrendsMetadata = {
  title: "Get History Trends",
  description:
    "Aggregate recurring issue patterns across recorded sessions, including retries, failure clusters, latest outcomes, and optional broader failure families.",
  ...sessionDashboardUiMetadata,
};

export function createGetHistoryTrendsHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "get-history-trends",
    "Use optional query, issueKey, host, status, groupBy, limit, and offset filters to inspect recurring cross-session issues.",
    async (params: {
      query?: string;
      issueKey?: string;
      host?: SessionHost;
      status?: SessionStatus;
      groupBy?: "issue" | "family";
      limit?: number;
      offset?: number;
    }) => {
      const report = buildHistoryTrendReport(db, params);

      return formatSuccessResponse(
        "History trends retrieved successfully",
        {
          Query: params.query?.trim() || "all",
          Issue: params.issueKey?.trim() || "all",
          Host: params.host ?? "all",
          Status: params.status ?? "all",
          GroupBy: params.groupBy ?? "issue",
          Trends: report.trends.length,
          Total: report.total,
          Sessions: report.summary.matchingSessions,
          Attempts: report.summary.totalAttempts,
        },
        {
          filters: {
            query: params.query?.trim() || undefined,
            issueKey: params.issueKey?.trim() || undefined,
            host: params.host,
            status: params.status,
            groupBy: params.groupBy,
          },
          ...report,
        },
      );
    },
  );
}
