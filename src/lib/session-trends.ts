import { buildPageInfo, getSessionLabel } from "./session-history.js";
import { traceSyncOperation } from "./observability.js";
import type {
  EvidenceDatabase,
  SessionHost,
  SessionStatus,
} from "./storage/index.js";

export type HistoryTrendGroupBy = "issue" | "family";
export type TrendBlockerState = "active" | "resolved";
export type TrendRemediationState =
  | "unresolved"
  | "recovered"
  | "regressed"
  | "stable";

export interface HistoryTrendSession extends Record<string, unknown> {
  sessionId: string;
  label: string;
  host: SessionHost;
  status: SessionStatus;
  startedAt: string;
  lastAttemptAt: string;
  attempts: number;
  latestOutcome: string;
}

export interface HistoryTrend extends Record<string, unknown> {
  groupBy: HistoryTrendGroupBy;
  issueKey: string;
  label: string;
  kind: string | null;
  issueFamilyKey: string | null;
  issueFamilyLabel: string | null;
  relatedIssueKeys: string[];
  blockerCategory: string;
  blockerState: TrendBlockerState;
  remediationState: TrendRemediationState;
  remediationSummary: string;
  latestOutcome: string;
  latestFailureAt: string | null;
  latestSuccessAt: string | null;
  lastSeenAt: string;
  attemptCount: number;
  sessionCount: number;
  failedAttempts: number;
  succeededAttempts: number;
  otherAttempts: number;
  hosts: SessionHost[];
  statuses: SessionStatus[];
  sessions: HistoryTrendSession[];
}

export interface HistoryTrendSummary extends Record<string, unknown> {
  groupBy: HistoryTrendGroupBy;
  totalTrends: number;
  matchingSessions: number;
  totalAttempts: number;
  activeBlockers: number;
  recoveredTrends: number;
  regressedTrends: number;
  byOutcome: {
    failed: number;
    succeeded: number;
    other: number;
  };
}

export interface HistoryTrendReport extends Record<string, unknown> {
  summary: HistoryTrendSummary;
  total: number;
  trends: HistoryTrend[];
}

export interface SessionTrendContextItem extends Record<string, unknown> {
  issueKey: string;
  label: string;
  kind: string | null;
  issueFamilyKey: string | null;
  issueFamilyLabel: string | null;
  relatedIssueKeys: string[];
  blockerCategory: string;
  blockerState: TrendBlockerState;
  remediationState: TrendRemediationState;
  remediationSummary: string;
  lastSeenAt: string;
  latestFailureAt: string | null;
  latestSuccessAt: string | null;
  sessionCount: number;
  sessionAttempts: number;
  globalAttempts: number;
  sessionLatestOutcome: string;
  latestOutcome: string;
  hosts: SessionHost[];
  statuses: SessionStatus[];
  relatedSessionCount: number;
  relatedSessions: SessionTrendContextRelatedSession[];
}

export interface SessionTrendContextRelatedSession extends Record<
  string,
  unknown
> {
  sessionId: string;
  label: string;
  host: SessionHost;
  status: SessionStatus;
  lastAttemptAt: string;
  attempts: number;
  latestOutcome: string;
}

export interface SessionTrendContextSummary extends Record<string, unknown> {
  totalTrends: number;
  crossSessionTrends: number;
  sessionAttempts: number;
  globalAttempts: number;
  otherSessions: number;
  activeBlockers: number;
  recoveredTrends: number;
  regressedTrends: number;
}

export interface SessionTrendContext extends Record<string, unknown> {
  summary: SessionTrendContextSummary;
  page?: {
    total: number;
    offset: number;
    limit: number;
    returned: number;
    hasMore: boolean;
    nextOffset: number | null;
  };
  trends: SessionTrendContextItem[];
}

export interface HistoryTrendQuery {
  query?: string;
  issueKey?: string;
  host?: SessionHost;
  status?: SessionStatus;
  sessionIds?: string[];
  groupBy?: HistoryTrendGroupBy;
  limit?: number;
  offset?: number;
}

interface TrendAccumulator {
  groupBy: HistoryTrendGroupBy;
  issueKey: string;
  label: string;
  kind: string | null;
  issueFamilyKey: string | null;
  issueFamilyLabel: string | null;
  relatedIssueKeys: Set<string>;
  lastSeenAt: string;
  latestOutcome: string;
  latestFailureAt: string | null;
  latestSuccessAt: string | null;
  attemptCount: number;
  failedAttempts: number;
  succeededAttempts: number;
  otherAttempts: number;
  hosts: Set<SessionHost>;
  statuses: Set<SessionStatus>;
  sessions: Map<
    string,
    {
      label: string;
      host: SessionHost;
      status: SessionStatus;
      startedAt: string;
      lastAttemptAt: string;
      attempts: number;
      latestOutcome: string;
    }
  >;
}

type TrendAttempt = ReturnType<
  EvidenceDatabase["querySessionTrendAttempts"]
>[number];

function matchesTrendQuery(
  issueKey: string,
  label: string,
  kind: string | null,
  relatedIssueKeys: string[],
  query: string | undefined,
  exactIssueKey: string | undefined,
): boolean {
  if (
    exactIssueKey &&
    issueKey !== exactIssueKey &&
    !relatedIssueKeys.includes(exactIssueKey)
  ) {
    return false;
  }

  if (!query) {
    return true;
  }

  const loweredQuery = query.toLowerCase();
  return [issueKey, label, kind ?? "", ...relatedIssueKeys]
    .join(" ")
    .toLowerCase()
    .includes(loweredQuery);
}

function createTrendAccumulator(
  groupBy: HistoryTrendGroupBy,
  issueKey: string,
  label: string,
  kind: string | null,
  issueFamilyKey: string | null,
  issueFamilyLabel: string | null,
  relatedIssueKeys: string[],
  attempt: TrendAttempt,
): TrendAccumulator {
  return {
    groupBy,
    issueKey,
    label,
    kind,
    issueFamilyKey,
    issueFamilyLabel,
    relatedIssueKeys: new Set(relatedIssueKeys),
    lastSeenAt: attempt.seenAt,
    latestOutcome: attempt.outcome,
    latestFailureAt:
      attempt.outcomeCategory === "failed" ? attempt.seenAt : null,
    latestSuccessAt:
      attempt.outcomeCategory === "succeeded" ? attempt.seenAt : null,
    attemptCount: 0,
    failedAttempts: 0,
    succeededAttempts: 0,
    otherAttempts: 0,
    hosts: new Set<SessionHost>(),
    statuses: new Set<SessionStatus>(),
    sessions: new Map([
      [
        attempt.sessionId,
        {
          label: getSessionLabel({
            title: attempt.title,
            host: attempt.host,
            cwd: attempt.cwd,
          }),
          host: attempt.host,
          status: attempt.status,
          startedAt: attempt.startedAt,
          lastAttemptAt: attempt.seenAt,
          attempts: 0,
          latestOutcome: attempt.outcome,
        },
      ],
    ]),
  };
}

function isFailedOutcome(outcome: string): boolean {
  return /\b(?:fail|failed|error|timeout|timed-out|interrupted|non-zero)\b/i.test(
    outcome,
  );
}

function classifyBlockerCategory(
  kind: string | null,
  issueKey: string,
): string {
  if (kind) {
    return kind;
  }

  const prefix = issueKey.split(":", 1)[0];
  return prefix?.trim() || "issue";
}

function getRemediationState(options: {
  latestOutcome: string;
  failedAttempts: number;
  succeededAttempts: number;
}): TrendRemediationState {
  if (isFailedOutcome(options.latestOutcome)) {
    return options.succeededAttempts > 0 ? "regressed" : "unresolved";
  }

  if (options.failedAttempts > 0 && options.succeededAttempts > 0) {
    return "recovered";
  }

  return "stable";
}

function buildRemediationSummary(options: {
  latestOutcome: string;
  attemptCount: number;
  failedAttempts: number;
  succeededAttempts: number;
  remediationState: TrendRemediationState;
}): string {
  switch (options.remediationState) {
    case "recovered":
      return `Recovered after ${options.failedAttempts} failed attempt(s); latest ${options.latestOutcome}.`;
    case "regressed":
      return `Regressed after ${options.succeededAttempts} successful attempt(s); latest ${options.latestOutcome}.`;
    case "unresolved":
      return `Still failing after ${options.attemptCount} attempt(s); latest ${options.latestOutcome}.`;
    case "stable":
    default:
      return options.failedAttempts > 0
        ? `Mixed outcomes stabilized at ${options.latestOutcome}.`
        : `No active blocker; latest outcome ${options.latestOutcome}.`;
  }
}

function validateHistoryTrendQuery(options?: HistoryTrendQuery): {
  groupBy: HistoryTrendGroupBy;
  query: string | undefined;
  exactIssueKey: string | undefined;
} {
  const groupBy = options?.groupBy ?? "issue";
  const query = options?.query?.trim();
  if (options?.query !== undefined && !query) {
    throw new Error("Query must not be empty");
  }
  if (options?.issueKey !== undefined && !options.issueKey.trim()) {
    throw new Error("issueKey must not be empty");
  }
  if (
    options?.limit !== undefined &&
    (!Number.isInteger(options.limit) || options.limit <= 0)
  ) {
    throw new Error("Limit must be a positive integer");
  }
  if (
    options?.offset !== undefined &&
    (!Number.isInteger(options.offset) || options.offset < 0)
  ) {
    throw new Error("Offset must be a non-negative integer");
  }
  if (options?.sessionIds?.some((sessionId) => !sessionId.trim())) {
    throw new Error("sessionIds must not contain empty values");
  }

  return {
    groupBy,
    query,
    exactIssueKey: options?.issueKey?.trim(),
  };
}

function materializeHistoryTrends(
  attempts: TrendAttempt[],
  groupBy: HistoryTrendGroupBy,
  query: string | undefined,
  exactIssueKey: string | undefined,
): HistoryTrend[] {
  const trends = new Map<string, TrendAccumulator>();

  for (const attempt of attempts) {
    const groupingKey =
      groupBy === "family" ? attempt.issueFamilyKey : attempt.issueKey;
    if (!groupingKey) {
      continue;
    }

    const relatedIssueKeys = [attempt.issueKey];
    const label =
      (groupBy === "family" ? attempt.issueFamilyLabel : attempt.issueLabel) ??
      groupingKey;
    const kind = attempt.kind;
    if (
      !matchesTrendQuery(
        groupingKey,
        label,
        kind,
        relatedIssueKeys,
        query,
        exactIssueKey,
      )
    ) {
      continue;
    }

    const existing =
      trends.get(groupingKey) ??
      createTrendAccumulator(
        groupBy,
        groupingKey,
        label,
        kind,
        attempt.issueFamilyKey,
        attempt.issueFamilyLabel,
        relatedIssueKeys,
        attempt,
      );

    existing.attemptCount += 1;
    if (attempt.outcomeCategory === "failed") {
      existing.failedAttempts += 1;
      if (
        !existing.latestFailureAt ||
        attempt.seenAt >= existing.latestFailureAt
      ) {
        existing.latestFailureAt = attempt.seenAt;
      }
    } else if (attempt.outcomeCategory === "succeeded") {
      existing.succeededAttempts += 1;
      if (
        !existing.latestSuccessAt ||
        attempt.seenAt >= existing.latestSuccessAt
      ) {
        existing.latestSuccessAt = attempt.seenAt;
      }
    } else {
      existing.otherAttempts += 1;
    }

    existing.hosts.add(attempt.host);
    existing.statuses.add(attempt.status);
    existing.relatedIssueKeys.add(attempt.issueKey);
    if (!existing.issueFamilyKey && attempt.issueFamilyKey) {
      existing.issueFamilyKey = attempt.issueFamilyKey;
    }
    if (!existing.issueFamilyLabel && attempt.issueFamilyLabel) {
      existing.issueFamilyLabel = attempt.issueFamilyLabel;
    }

    if (attempt.seenAt >= existing.lastSeenAt) {
      existing.lastSeenAt = attempt.seenAt;
      existing.latestOutcome = attempt.outcome;
      existing.label = label;
      if (!existing.kind && kind) {
        existing.kind = kind;
      }
    }

    const sessionEntry = existing.sessions.get(attempt.sessionId) ?? {
      label: getSessionLabel({
        title: attempt.title,
        host: attempt.host,
        cwd: attempt.cwd,
      }),
      host: attempt.host,
      status: attempt.status,
      startedAt: attempt.startedAt,
      lastAttemptAt: attempt.seenAt,
      attempts: 0,
      latestOutcome: attempt.outcome,
    };
    sessionEntry.attempts += 1;
    if (attempt.seenAt >= sessionEntry.lastAttemptAt) {
      sessionEntry.lastAttemptAt = attempt.seenAt;
      sessionEntry.latestOutcome = attempt.outcome;
    }
    existing.sessions.set(attempt.sessionId, sessionEntry);

    trends.set(groupingKey, existing);
  }

  return Array.from(trends.values())
    .map<HistoryTrend>((trend) => {
      const remediationState = getRemediationState({
        latestOutcome: trend.latestOutcome,
        failedAttempts: trend.failedAttempts,
        succeededAttempts: trend.succeededAttempts,
      });

      return {
        groupBy: trend.groupBy,
        issueKey: trend.issueKey,
        label: trend.label,
        kind: trend.kind,
        issueFamilyKey: trend.issueFamilyKey,
        issueFamilyLabel: trend.issueFamilyLabel,
        relatedIssueKeys: Array.from(trend.relatedIssueKeys).sort(),
        blockerCategory: classifyBlockerCategory(trend.kind, trend.issueKey),
        blockerState: isFailedOutcome(trend.latestOutcome)
          ? "active"
          : "resolved",
        remediationState,
        remediationSummary: buildRemediationSummary({
          latestOutcome: trend.latestOutcome,
          attemptCount: trend.attemptCount,
          failedAttempts: trend.failedAttempts,
          succeededAttempts: trend.succeededAttempts,
          remediationState,
        }),
        latestOutcome: trend.latestOutcome,
        latestFailureAt: trend.latestFailureAt,
        latestSuccessAt: trend.latestSuccessAt,
        lastSeenAt: trend.lastSeenAt,
        attemptCount: trend.attemptCount,
        sessionCount: trend.sessions.size,
        failedAttempts: trend.failedAttempts,
        succeededAttempts: trend.succeededAttempts,
        otherAttempts: trend.otherAttempts,
        hosts: Array.from(trend.hosts).sort(),
        statuses: Array.from(trend.statuses).sort(),
        sessions: Array.from(trend.sessions.entries())
          .map(([sessionId, session]) => ({
            sessionId,
            label: session.label,
            host: session.host,
            status: session.status,
            startedAt: session.startedAt,
            lastAttemptAt: session.lastAttemptAt,
            attempts: session.attempts,
            latestOutcome: session.latestOutcome,
          }))
          .sort((left, right) =>
            right.lastAttemptAt.localeCompare(left.lastAttemptAt),
          ),
      };
    })
    .sort((left, right) => {
      if (right.sessionCount !== left.sessionCount) {
        return right.sessionCount - left.sessionCount;
      }
      if (right.failedAttempts !== left.failedAttempts) {
        return right.failedAttempts - left.failedAttempts;
      }
      if (right.attemptCount !== left.attemptCount) {
        return right.attemptCount - left.attemptCount;
      }
      return right.lastSeenAt.localeCompare(left.lastSeenAt);
    });
}

export function buildHistoryTrendReport(
  db: EvidenceDatabase,
  options?: HistoryTrendQuery,
): HistoryTrendReport {
  return traceSyncOperation(
    "history.build-trend-report",
    {
      host: options?.host,
      status: options?.status,
      groupBy: options?.groupBy ?? "issue",
      hasQuery: Boolean(options?.query?.trim()),
      issueKey: options?.issueKey?.trim() || undefined,
      sessionIds: options?.sessionIds?.length ?? 0,
      limit: options?.limit,
      offset: options?.offset,
    },
    () => {
      const { groupBy, query, exactIssueKey } =
        validateHistoryTrendQuery(options);
      const allTrends = materializeHistoryTrends(
        db.querySessionTrendAttempts({
          host: options?.host,
          status: options?.status,
          sessionIds: options?.sessionIds,
        }),
        groupBy,
        query,
        exactIssueKey,
      );

      const offset = options?.offset ?? 0;
      const paginatedTrends = allTrends.slice(
        offset,
        options?.limit ? offset + options.limit : undefined,
      );
      const matchingSessions = new Set(
        allTrends.flatMap((trend) =>
          trend.sessions.map((session) => session.sessionId),
        ),
      );

      return {
        summary: {
          groupBy,
          totalTrends: allTrends.length,
          matchingSessions: matchingSessions.size,
          totalAttempts: allTrends.reduce(
            (total, trend) => total + trend.attemptCount,
            0,
          ),
          activeBlockers: allTrends.filter(
            (trend) => trend.blockerState === "active",
          ).length,
          recoveredTrends: allTrends.filter(
            (trend) => trend.remediationState === "recovered",
          ).length,
          regressedTrends: allTrends.filter(
            (trend) => trend.remediationState === "regressed",
          ).length,
          byOutcome: {
            failed: allTrends.reduce(
              (total, trend) => total + trend.failedAttempts,
              0,
            ),
            succeeded: allTrends.reduce(
              (total, trend) => total + trend.succeededAttempts,
              0,
            ),
            other: allTrends.reduce(
              (total, trend) => total + trend.otherAttempts,
              0,
            ),
          },
        },
        total: allTrends.length,
        trends: paginatedTrends,
      };
    },
  );
}

export function buildSessionTrendContext(
  db: EvidenceDatabase,
  sessionId: string,
  options?: {
    limit?: number;
    offset?: number;
  },
): SessionTrendContext {
  const allTrends = materializeHistoryTrends(
    db.querySessionTrendContextAttempts(sessionId),
    "issue",
    undefined,
    undefined,
  );
  const trends = allTrends
    .map((trend) => {
      const session =
        trend.sessions.find((item) => item.sessionId === sessionId) ?? null;
      if (!session) {
        return null;
      }

      const relatedSessions = trend.sessions.filter(
        (item) => item.sessionId !== sessionId,
      );

      return {
        issueKey: trend.issueKey,
        label: trend.label,
        kind: trend.kind,
        issueFamilyKey: trend.issueFamilyKey,
        issueFamilyLabel: trend.issueFamilyLabel,
        relatedIssueKeys: trend.relatedIssueKeys,
        blockerCategory: trend.blockerCategory,
        blockerState: trend.blockerState,
        remediationState: trend.remediationState,
        remediationSummary: trend.remediationSummary,
        lastSeenAt: trend.lastSeenAt,
        latestFailureAt: trend.latestFailureAt,
        latestSuccessAt: trend.latestSuccessAt,
        sessionCount: trend.sessionCount,
        sessionAttempts: session.attempts,
        globalAttempts: trend.attemptCount,
        sessionLatestOutcome: session.latestOutcome,
        latestOutcome: trend.latestOutcome,
        hosts: trend.hosts,
        statuses: trend.statuses,
        relatedSessionCount: relatedSessions.length,
        relatedSessions: relatedSessions.slice(0, 3).map((relatedSession) => ({
          sessionId: relatedSession.sessionId,
          label: relatedSession.label,
          host: relatedSession.host,
          status: relatedSession.status,
          lastAttemptAt: relatedSession.lastAttemptAt,
          attempts: relatedSession.attempts,
          latestOutcome: relatedSession.latestOutcome,
        })),
      };
    })
    .filter((trend): trend is SessionTrendContextItem => Boolean(trend));
  const offset = options?.offset ?? 0;
  const limit = options?.limit ?? trends.length;
  const paginatedTrends = trends.slice(offset, offset + limit);

  const otherSessions = new Set(
    trends.flatMap((trend) =>
      trend.relatedSessions.map((session) => session.sessionId),
    ),
  );

  return {
    summary: {
      totalTrends: trends.length,
      crossSessionTrends: trends.filter((trend) => trend.sessionCount > 1)
        .length,
      sessionAttempts: trends.reduce(
        (total, trend) => total + trend.sessionAttempts,
        0,
      ),
      globalAttempts: trends.reduce(
        (total, trend) => total + trend.globalAttempts,
        0,
      ),
      otherSessions: otherSessions.size,
      activeBlockers: trends.filter((trend) => trend.blockerState === "active")
        .length,
      recoveredTrends: trends.filter(
        (trend) => trend.remediationState === "recovered",
      ).length,
      regressedTrends: trends.filter(
        (trend) => trend.remediationState === "regressed",
      ).length,
    },
    page: buildPageInfo(trends.length, paginatedTrends.length, {
      offset,
      limit,
    }),
    trends: paginatedTrends,
  };
}
