import * as z from "zod";
import {
  buildPageInfo,
  DEFAULT_SESSION_DETAIL_PAGE_LIMIT,
  MAX_SESSION_DETAIL_PAGE_LIMIT,
} from "../lib/session-history.js";
import { buildSessionTrendContext } from "../lib/session-trends.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";
import { sessionDetailUiMetadata } from "./session-ui-metadata.js";

const sessionHostEnum = z.enum(["claude", "gemini", "codex"]);
const sessionStatusEnum = z.enum([
  "running",
  "completed",
  "failed",
  "interrupted",
]);
const pageInfoSchema = z.object({
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
  returned: z.number(),
  hasMore: z.boolean(),
  nextOffset: z.number().nullable(),
});

export const getSessionTrendsSchema = {
  inputSchema: {
    id: z.string().describe("ID of the recorded session"),
    limit: z
      .number()
      .int()
      .positive()
      .max(MAX_SESSION_DETAIL_PAGE_LIMIT)
      .optional()
      .describe(
        `Optional page size for the recurring trend slice. Defaults to ${DEFAULT_SESSION_DETAIL_PAGE_LIMIT}.`,
      ),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Optional offset for the recurring trend slice."),
  },
  outputSchema: {
    sessionId: z.string(),
    summary: z.object({
      totalTrends: z.number(),
      crossSessionTrends: z.number(),
      sessionAttempts: z.number(),
      globalAttempts: z.number(),
      otherSessions: z.number(),
      activeBlockers: z.number(),
      recoveredTrends: z.number(),
      regressedTrends: z.number(),
    }),
    page: pageInfoSchema,
    trends: z.array(
      z.object({
        issueKey: z.string(),
        label: z.string(),
        kind: z.string().nullable(),
        issueFamilyKey: z.string().nullable(),
        issueFamilyLabel: z.string().nullable(),
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
        lastSeenAt: z.string(),
        latestFailureAt: z.string().nullable(),
        latestSuccessAt: z.string().nullable(),
        sessionCount: z.number(),
        sessionAttempts: z.number(),
        globalAttempts: z.number(),
        sessionLatestOutcome: z.string(),
        latestOutcome: z.string(),
        hosts: z.array(sessionHostEnum),
        statuses: z.array(sessionStatusEnum),
        relatedSessionCount: z.number(),
        relatedSessions: z.array(
          z.object({
            sessionId: z.string(),
            label: z.string(),
            host: sessionHostEnum,
            status: sessionStatusEnum,
            lastAttemptAt: z.string(),
            attempts: z.number(),
            latestOutcome: z.string(),
          }),
        ),
      }),
    ),
  },
};

export const getSessionTrendsMetadata = {
  title: "Get Session Trends",
  description:
    "Return paginated recurring trend context for a specific session, including related retries across other sessions.",
  ...sessionDetailUiMetadata,
};

export function createGetSessionTrendsHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "get-session-trends",
    "Use limit and offset to page through recurring session trends without reloading the full session detail payload.",
    async (params: { id: string; limit?: number; offset?: number }) => {
      const session = db.findSessionById(params.id);
      if (!session) {
        throw new Error(`Session not found: ${params.id}`);
      }

      const limit = params.limit ?? DEFAULT_SESSION_DETAIL_PAGE_LIMIT;
      const offset = params.offset ?? 0;

      if (limit <= 0 || limit > MAX_SESSION_DETAIL_PAGE_LIMIT) {
        throw new Error(
          `limit must be between 1 and ${MAX_SESSION_DETAIL_PAGE_LIMIT}`,
        );
      }

      if (offset < 0) {
        throw new Error("offset cannot be negative");
      }

      const trendContext = buildSessionTrendContext(db, params.id, {
        limit,
        offset,
      });
      const page =
        trendContext.page ??
        buildPageInfo(
          trendContext.summary.totalTrends,
          trendContext.trends.length,
          { limit, offset },
        );

      return formatSuccessResponse(
        "Session trends retrieved successfully",
        {
          Session: params.id,
          Trends: trendContext.trends.length,
          Total: trendContext.summary.totalTrends,
          Offset: offset,
          Limit: limit,
        },
        {
          sessionId: params.id,
          summary: trendContext.summary,
          page,
          trends: trendContext.trends,
        },
      );
    },
  );
}
