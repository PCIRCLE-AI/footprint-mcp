import * as z from "zod";
import {
  buildPageInfo,
  DEFAULT_SESSION_DETAIL_PAGE_LIMIT,
  getSessionLabel,
  MAX_SESSION_DETAIL_PAGE_LIMIT,
  truncateSummary,
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
export const getSessionSchema = {
  inputSchema: {
    id: z.string().describe("ID of the recorded session to inspect"),
    messageLimit: z
      .number()
      .int()
      .positive()
      .max(MAX_SESSION_DETAIL_PAGE_LIMIT)
      .optional()
      .describe(
        "Optional page size for the initial transcript slice. Defaults to 50.",
      ),
    messageOffset: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Optional offset for the initial transcript slice."),
    timelineLimit: z
      .number()
      .int()
      .positive()
      .max(MAX_SESSION_DETAIL_PAGE_LIMIT)
      .optional()
      .describe(
        "Optional page size for the initial timeline slice. Defaults to 50.",
      ),
    timelineOffset: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Optional offset for the initial timeline slice."),
    trendLimit: z
      .number()
      .int()
      .positive()
      .max(MAX_SESSION_DETAIL_PAGE_LIMIT)
      .optional()
      .describe(
        "Optional page size for the initial recurring trend slice. Defaults to 50.",
      ),
    trendOffset: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Optional offset for the initial recurring trend slice."),
  },
  outputSchema: {
    session: z.object({
      id: z.string(),
      host: sessionHostEnum,
      title: z.string().nullable(),
      label: z.string(),
      status: sessionStatusEnum,
      projectRoot: z.string(),
      cwd: z.string(),
      startedAt: z.string(),
      endedAt: z.string().nullable(),
      metadata: z.string().nullable(),
    }),
    messageSummary: z.object({
      total: z.number(),
      byRole: z.object({
        user: z.number(),
        assistant: z.number(),
        system: z.number(),
      }),
      firstCapturedAt: z.string().nullable(),
      lastCapturedAt: z.string().nullable(),
      preview: z.string().nullable(),
    }),
    timelineSummary: z.object({
      total: z.number(),
      eventTypes: z.array(z.string()),
      statuses: z.array(z.string()),
      firstStartedAt: z.string().nullable(),
      lastEndedAt: z.string().nullable(),
    }),
    messagePage: pageInfoSchema,
    timelinePage: pageInfoSchema,
    artifactSummary: z.object({
      total: z.number(),
      byType: z.object({
        fileChange: z.number(),
        commandOutput: z.number(),
        testResult: z.number(),
        gitCommit: z.number(),
      }),
    }),
    trendContext: z.object({
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
      page: pageInfoSchema.optional(),
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
    }),
    messages: z.array(
      z.object({
        id: z.string(),
        sessionId: z.string(),
        seq: z.number(),
        role: z.enum(["user", "assistant", "system"]),
        source: z.string(),
        content: z.string(),
        capturedAt: z.string(),
        metadata: z.string().nullable(),
      }),
    ),
    timeline: z.array(
      z.object({
        id: z.string(),
        sessionId: z.string(),
        seq: z.number(),
        eventType: z.string(),
        eventSubType: z.string().nullable(),
        source: z.string(),
        summary: z.string().nullable(),
        payload: z.string().nullable(),
        startedAt: z.string(),
        endedAt: z.string().nullable(),
        status: z.string().nullable(),
        relatedMessageId: z.string().nullable(),
      }),
    ),
    hasNarratives: z.boolean(),
  },
};

export const getSessionMetadata = {
  title: "Get Session",
  description:
    "Inspect a recorded CLI session, including session metadata plus paginated transcript and timeline slices.",
  ...sessionDetailUiMetadata,
};

export function createGetSessionHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "get-session",
    "Verify the session ID exists and keep message/timeline pagination values within the allowed range before requesting details.",
    async (params: {
      id: string;
      messageLimit?: number;
      messageOffset?: number;
      timelineLimit?: number;
      timelineOffset?: number;
      trendLimit?: number;
      trendOffset?: number;
    }) => {
      const sessionRecord = db.findSessionById(params.id);
      if (!sessionRecord) {
        throw new Error(`Session not found: ${params.id}`);
      }

      const messageLimit =
        params.messageLimit ?? DEFAULT_SESSION_DETAIL_PAGE_LIMIT;
      const messageOffset = params.messageOffset ?? 0;
      const timelineLimit =
        params.timelineLimit ?? DEFAULT_SESSION_DETAIL_PAGE_LIMIT;
      const timelineOffset = params.timelineOffset ?? 0;
      const trendLimit = params.trendLimit ?? DEFAULT_SESSION_DETAIL_PAGE_LIMIT;
      const trendOffset = params.trendOffset ?? 0;

      if (messageLimit <= 0 || messageLimit > MAX_SESSION_DETAIL_PAGE_LIMIT) {
        throw new Error(
          `messageLimit must be between 1 and ${MAX_SESSION_DETAIL_PAGE_LIMIT}`,
        );
      }

      if (timelineLimit <= 0 || timelineLimit > MAX_SESSION_DETAIL_PAGE_LIMIT) {
        throw new Error(
          `timelineLimit must be between 1 and ${MAX_SESSION_DETAIL_PAGE_LIMIT}`,
        );
      }

      if (trendLimit <= 0 || trendLimit > MAX_SESSION_DETAIL_PAGE_LIMIT) {
        throw new Error(
          `trendLimit must be between 1 and ${MAX_SESSION_DETAIL_PAGE_LIMIT}`,
        );
      }

      if (messageOffset < 0) {
        throw new Error("messageOffset cannot be negative");
      }

      if (timelineOffset < 0) {
        throw new Error("timelineOffset cannot be negative");
      }

      if (trendOffset < 0) {
        throw new Error("trendOffset cannot be negative");
      }

      const messageStats = db.getSessionMessageStats(params.id);
      const timelineSummary = db.getSessionTimelineStats(params.id);
      const messages = db.getSessionMessages(params.id, {
        limit: messageLimit,
        offset: messageOffset,
      });
      const timeline = db.getSessionTimeline(params.id, {
        limit: timelineLimit,
        offset: timelineOffset,
      });
      const artifactSummary = db.getSessionArtifactSummary(params.id);
      const trendContext = buildSessionTrendContext(db, params.id, {
        limit: trendLimit,
        offset: trendOffset,
      });
      const hasNarratives = db.hasNarrativesForSession(params.id);
      const session = {
        id: sessionRecord.id,
        host: sessionRecord.host,
        title: sessionRecord.title,
        label: getSessionLabel(sessionRecord),
        status: sessionRecord.status,
        projectRoot: sessionRecord.projectRoot,
        cwd: sessionRecord.cwd,
        startedAt: sessionRecord.startedAt,
        endedAt: sessionRecord.endedAt,
        metadata: sessionRecord.metadata,
      };
      const messageSummary = {
        total: messageStats.total,
        byRole: messageStats.byRole,
        firstCapturedAt: messageStats.firstCapturedAt,
        lastCapturedAt: messageStats.lastCapturedAt,
        preview: messageStats.previewContent
          ? truncateSummary(messageStats.previewContent)
          : null,
      };
      const messagePage = buildPageInfo(messageStats.total, messages.length, {
        offset: messageOffset,
        limit: messageLimit,
      });
      const timelinePage = buildPageInfo(
        timelineSummary.total,
        timeline.length,
        {
          offset: timelineOffset,
          limit: timelineLimit,
        },
      );

      return formatSuccessResponse(
        "Session retrieved successfully",
        {
          ID: sessionRecord.id,
          Host: sessionRecord.host,
          Status: sessionRecord.status,
          Messages: messageSummary.total,
          Events: timelineSummary.total,
          MessagePage: `${messagePage.offset}-${messagePage.offset + messagePage.returned}`,
          TimelinePage: `${timelinePage.offset}-${timelinePage.offset + timelinePage.returned}`,
          TrendPage: `${trendContext.page?.offset ?? 0}-${(trendContext.page?.offset ?? 0) + (trendContext.page?.returned ?? trendContext.trends.length)}`,
          Artifacts: artifactSummary.total,
          RecurringTrends: trendContext.summary.totalTrends,
          Narratives: hasNarratives ? "available" : "not generated",
        },
        {
          session,
          messageSummary,
          timelineSummary,
          messagePage,
          timelinePage,
          artifactSummary,
          trendContext,
          messages,
          timeline,
          hasNarratives,
        },
      );
    },
  );
}
