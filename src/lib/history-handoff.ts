import {
  filterSessionsByHistory,
  type SessionHistoryFilters,
} from "./session-filters.js";
import { getSessionLabel } from "./session-history.js";
import {
  buildHistoryTrendReport,
  type HistoryTrendGroupBy,
  type HistoryTrend,
} from "./session-trends.js";
import { traceSyncOperation } from "./observability.js";
import type {
  EvidenceDatabase,
  SessionHost,
  SessionRecord,
  SessionStatus,
} from "./storage/index.js";

export interface HistoryHandoffSession extends Record<string, unknown> {
  id: string;
  label: string;
  host: SessionHost;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
}

export interface HistoryHandoffSummary extends Record<string, unknown> {
  groupBy: HistoryTrendGroupBy;
  headline: string;
  matchingSessions: number;
  matchingHosts: SessionHost[];
  statuses: SessionStatus[];
  totalTrends: number;
  blockingTrends: number;
  recoveredTrends: number;
  regressedTrends: number;
  unresolvedQuestions: number;
  latestSessionId: string | null;
  latestSessionLabel: string | null;
  latestStartedAt: string | null;
}

export interface HistoryHandoffFilters extends SessionHistoryFilters {
  groupBy?: HistoryTrendGroupBy;
}

export interface HistoryHandoffReport extends Record<string, unknown> {
  filters: HistoryHandoffFilters;
  summary: HistoryHandoffSummary;
  blockers: string[];
  recoveries: string[];
  followUps: string[];
  recentSessions: HistoryHandoffSession[];
  markdown: string;
}

export interface HistoryHandoffQuery extends HistoryHandoffFilters {
  sessionIds?: string[];
}

interface HistoryHandoffDraft {
  filters: HistoryHandoffFilters;
  summary: HistoryHandoffSummary;
  blockers: string[];
  recoveries: string[];
  followUps: string[];
  recentSessions: HistoryHandoffSession[];
}

function normalizeFilters(
  filters?: HistoryHandoffFilters,
): HistoryHandoffFilters {
  return {
    query: filters?.query?.trim() || undefined,
    issueKey: filters?.issueKey?.trim() || undefined,
    host: filters?.host,
    status: filters?.status,
    groupBy: filters?.groupBy,
  };
}

function collectRecentFollowUps(
  db: EvidenceDatabase,
  sessions: SessionRecord[],
  limit: number,
): string[] {
  const followUps: string[] = [];
  const seen = new Set<string>();

  const sessionIds = sessions.map((session) => session.id);
  let offset = 0;
  const pageSize = Math.max(limit * 10, 25);

  while (followUps.length < limit) {
    const page = db.getSessionFollowUpMessages(sessionIds, {
      limit: pageSize,
      offset,
    });
    if (page.length === 0) {
      break;
    }

    for (const message of page) {
      const content = message.content.trim();
      if (!content || seen.has(content)) {
        continue;
      }
      seen.add(content);
      followUps.push(content);
      if (followUps.length >= limit) {
        return followUps;
      }
    }

    offset += page.length;
  }

  return followUps;
}

function buildBlockingTrendLines(
  trends: HistoryTrend[],
  limit: number,
): string[] {
  return trends
    .filter((trend) => trend.blockerState === "active")
    .slice(0, limit)
    .map((trend) => {
      const hostList = trend.hosts.join(", ") || "n/a";
      return `${trend.issueKey}: ${trend.label} [${trend.blockerCategory}] (${trend.remediationState}, sessions ${trend.sessionCount}, attempts ${trend.attemptCount}, latest ${trend.latestOutcome}, hosts ${hostList})`;
    });
}

function buildRecoveryTrendLines(
  trends: HistoryTrend[],
  limit: number,
): string[] {
  return trends
    .filter((trend) => trend.remediationState === "recovered")
    .slice(0, limit)
    .map((trend) => {
      const hostList = trend.hosts.join(", ") || "n/a";
      return `${trend.issueKey}: ${trend.label} [${trend.blockerCategory}] (${trend.remediationSummary} hosts ${hostList})`;
    });
}

function buildRecentSessions(
  sessions: SessionRecord[],
  limit: number,
): HistoryHandoffSession[] {
  return sessions.slice(0, limit).map((session) => ({
    id: session.id,
    label: getSessionLabel(session),
    host: session.host,
    status: session.status,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
  }));
}

function buildHeadline(
  sessions: SessionRecord[],
  blockingTrendCount: number,
  recoveredTrendCount: number,
  groupBy: HistoryTrendGroupBy,
): string {
  if (sessions.length === 0) {
    return "No recorded sessions match the current history scope.";
  }

  const latest = sessions[0];
  const hostCount = new Set(sessions.map((session) => session.host)).size;
  const blockingClause =
    blockingTrendCount > 0
      ? `${blockingTrendCount} blocking trend(s) remain active`
      : "no blocking trends remain active";
  const recoveryClause =
    recoveredTrendCount > 0
      ? ` ${recoveredTrendCount} trend(s) recently recovered.`
      : "";
  const groupingClause =
    groupBy === "family" ? " Failure families are grouped broadly." : "";

  return `${sessions.length} session(s) matched across ${hostCount} host(s); ${blockingClause}.${recoveryClause} Latest session: ${getSessionLabel(latest)} (${latest.status}).${groupingClause}`;
}

function buildMarkdown(report: HistoryHandoffDraft): string {
  const lines = [
    "# History Handoff",
    "",
    `- Headline: ${report.summary.headline}`,
    `- Trend Grouping: ${report.summary.groupBy}`,
    `- Matching Sessions: ${report.summary.matchingSessions}`,
    `- Matching Hosts: ${report.summary.matchingHosts.join(", ") || "n/a"}`,
    `- Total Trends: ${report.summary.totalTrends}`,
    `- Blocking Trends: ${report.summary.blockingTrends}`,
    `- Recovered Trends: ${report.summary.recoveredTrends}`,
    `- Regressed Trends: ${report.summary.regressedTrends}`,
    `- Unresolved Questions: ${report.summary.unresolvedQuestions}`,
    "",
    "## Blocking Trends",
    "",
    ...(report.blockers.length > 0
      ? report.blockers.map((item) => `- ${item}`)
      : ["_No blocking trends in the current scope._"]),
    "",
    "## Recent Recoveries",
    "",
    ...(report.recoveries.length > 0
      ? report.recoveries.map((item) => `- ${item}`)
      : ["_No recovered trends in the current scope._"]),
    "",
    "## Follow-Ups",
    "",
    ...(report.followUps.length > 0
      ? report.followUps.map((item) => `- ${item}`)
      : ["_No direct follow-up questions detected in the current scope._"]),
    "",
    "## Recent Sessions",
    "",
    ...(report.recentSessions.length > 0
      ? report.recentSessions.map(
          (session) =>
            `- ${session.label} (${session.host}, ${session.status}, started ${session.startedAt})`,
        )
      : ["_No matching sessions._"]),
    "",
  ];

  return lines.join("\n");
}

export function buildHistoryHandoffReport(
  db: EvidenceDatabase,
  query?: HistoryHandoffQuery,
): HistoryHandoffReport {
  return traceSyncOperation(
    "history.build-handoff-report",
    {
      host: query?.host,
      status: query?.status,
      groupBy: query?.groupBy ?? "issue",
      hasQuery: Boolean(query?.query?.trim()),
      issueKey: query?.issueKey?.trim() || undefined,
      sessionIds: query?.sessionIds?.length ?? 0,
    },
    () => {
      const normalizedFilters = normalizeFilters(query);
      const sessions = filterSessionsByHistory(db, {
        ...normalizedFilters,
        sessionIds: query?.sessionIds,
      });
      const trendReport = buildHistoryTrendReport(db, {
        ...normalizedFilters,
        sessionIds: query?.sessionIds,
      });
      const activeBlockerCount = trendReport.summary.activeBlockers;
      const recoveredTrendCount = trendReport.summary.recoveredTrends;
      const blockers = buildBlockingTrendLines(trendReport.trends, 5);
      const recoveries = buildRecoveryTrendLines(trendReport.trends, 5);
      const followUps = collectRecentFollowUps(db, sessions, 5);
      const recentSessions = buildRecentSessions(sessions, 5);

      const reportWithoutMarkdown: HistoryHandoffDraft = {
        filters: normalizedFilters,
        summary: {
          groupBy: trendReport.summary.groupBy,
          headline: buildHeadline(
            sessions,
            activeBlockerCount,
            recoveredTrendCount,
            trendReport.summary.groupBy,
          ),
          matchingSessions: sessions.length,
          matchingHosts: [...new Set(sessions.map((session) => session.host))],
          statuses: [...new Set(sessions.map((session) => session.status))],
          totalTrends: trendReport.summary.totalTrends,
          blockingTrends: activeBlockerCount,
          recoveredTrends: recoveredTrendCount,
          regressedTrends: trendReport.summary.regressedTrends,
          unresolvedQuestions: followUps.length,
          latestSessionId: sessions[0]?.id ?? null,
          latestSessionLabel: sessions[0] ? getSessionLabel(sessions[0]) : null,
          latestStartedAt: sessions[0]?.startedAt ?? null,
        },
        blockers,
        recoveries,
        followUps,
        recentSessions,
      };

      return {
        ...reportWithoutMarkdown,
        markdown: buildMarkdown(reportWithoutMarkdown),
      };
    },
  );
}
