/* global process */

import {
  collectSessionSearchableText,
  filterSessionsByHistory,
} from "../lib/session-filters.js";
import { buildHistoryTrendReport } from "../lib/session-trends.js";
import { buildHistoryHandoffReport } from "../lib/history-handoff.js";
import { getSessionLabel } from "../lib/session-history.js";
import {
  EvidenceDatabase,
  type SessionHost,
  type SessionStatus,
} from "../lib/storage/index.js";
import { ensureParentDir, resolveDbPath } from "./session-execution.js";
import { printJson } from "./session-display.js";

function collectSnippets(
  textNeedle: string,
  haystack: string[],
  limit: number = 3,
): string[] {
  const loweredNeedle = textNeedle.toLowerCase();
  return haystack
    .filter((item) => item.toLowerCase().includes(loweredNeedle))
    .slice(0, limit);
}

export function searchHistoryCli(
  query: string,
  options?: {
    json?: boolean;
    host?: SessionHost;
    status?: SessionStatus;
    limit?: number;
    offset?: number;
  },
): void {
  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);
  const db = new EvidenceDatabase(dbPath);

  try {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      throw new Error("Query must not be empty");
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

    const offset = options?.offset ?? 0;
    const allMatches = filterSessionsByHistory(db, {
      host: options?.host,
      status: options?.status,
      query: trimmedQuery,
    })
      .map((session) => {
        const searchable = collectSessionSearchableText(db, session);
        const snippets = collectSnippets(trimmedQuery, searchable);
        return snippets.length > 0
          ? {
              sessionId: session.id,
              host: session.host,
              label: getSessionLabel(session),
              status: session.status,
              startedAt: session.startedAt,
              snippets,
            }
          : null;
      })
      .filter((result): result is NonNullable<typeof result> =>
        Boolean(result),
      );

    const results = allMatches.slice(
      offset,
      options?.limit ? offset + options.limit : undefined,
    );

    if (options?.json) {
      printJson({
        query: trimmedQuery,
        filters: {
          host: options.host,
          status: options.status,
        },
        total: allMatches.length,
        results,
      });
      return;
    }

    console.log(`History search: ${trimmedQuery}`);
    console.log(`Matches: ${results.length} shown, ${allMatches.length} total`);
    for (const result of results) {
      console.log(
        `${result.sessionId} | ${result.host} | ${result.status} | ${result.label}`,
      );
      for (const snippet of result.snippets) {
        console.log(`  - ${snippet}`);
      }
    }
  } finally {
    db.close();
  }
}

export function showHistoryTrendsCli(options?: {
  json?: boolean;
  query?: string;
  issueKey?: string;
  host?: SessionHost;
  status?: SessionStatus;
  groupBy?: "issue" | "family";
  limit?: number;
  offset?: number;
}): void {
  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);
  const db = new EvidenceDatabase(dbPath);

  try {
    const report = buildHistoryTrendReport(db, {
      query: options?.query,
      issueKey: options?.issueKey,
      host: options?.host,
      status: options?.status,
      groupBy: options?.groupBy,
      limit: options?.limit,
      offset: options?.offset,
    });

    if (options?.json) {
      printJson({
        filters: {
          query: options?.query?.trim() || undefined,
          issueKey: options?.issueKey?.trim() || undefined,
          host: options?.host,
          status: options?.status,
          groupBy: options?.groupBy,
        },
        ...report,
      });
      return;
    }

    console.log(
      `History trends (${report.summary.groupBy}): ${report.trends.length} shown, ${report.total} total`,
    );
    console.log(
      `Sessions: ${report.summary.matchingSessions} | Attempts: ${report.summary.totalAttempts} | Failed: ${report.summary.byOutcome.failed} | Succeeded: ${report.summary.byOutcome.succeeded} | Other: ${report.summary.byOutcome.other}`,
    );
    for (const trend of report.trends) {
      console.log(
        `${trend.issueKey} | ${trend.kind ?? "unknown"} | sessions ${trend.sessionCount} | attempts ${trend.attemptCount} | latest ${trend.latestOutcome} | last ${trend.lastSeenAt}`,
      );
      console.log(`  label: ${trend.label}`);
      if (trend.groupBy === "family" && trend.relatedIssueKeys.length > 0) {
        console.log(`  issues: ${trend.relatedIssueKeys.join(", ")}`);
      }
      console.log(
        `  outcomes: failed ${trend.failedAttempts}, succeeded ${trend.succeededAttempts}, other ${trend.otherAttempts}`,
      );
      console.log(
        `  hosts: ${trend.hosts.join(", ") || "n/a"} | statuses: ${trend.statuses.join(", ") || "n/a"}`,
      );
      for (const session of trend.sessions) {
        console.log(
          `  - ${session.sessionId} | ${session.host} | ${session.status} | attempts ${session.attempts} | latest ${session.latestOutcome} | ${session.label}`,
        );
      }
    }
  } finally {
    db.close();
  }
}

export function showHistoryHandoffCli(options?: {
  json?: boolean;
  query?: string;
  issueKey?: string;
  host?: SessionHost;
  status?: SessionStatus;
  groupBy?: "issue" | "family";
}): void {
  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);
  const db = new EvidenceDatabase(dbPath);

  try {
    const report = buildHistoryHandoffReport(db, {
      query: options?.query,
      issueKey: options?.issueKey,
      host: options?.host,
      status: options?.status,
      groupBy: options?.groupBy,
    });

    if (options?.json) {
      printJson(report);
      return;
    }

    console.log(`Headline: ${report.summary.headline}`);
    console.log(
      `Sessions: ${report.summary.matchingSessions} | Trends: ${report.summary.totalTrends} | Blocking: ${report.summary.blockingTrends} | Questions: ${report.summary.unresolvedQuestions} | Grouping: ${report.summary.groupBy}`,
    );
    console.log(
      `Filters: query=${report.filters.query ?? "all"} issue=${report.filters.issueKey ?? "all"} host=${report.filters.host ?? "all"} status=${report.filters.status ?? "all"} groupBy=${report.filters.groupBy ?? report.summary.groupBy}`,
    );

    if (report.blockers.length > 0) {
      console.log("Blocking trends:");
      for (const blocker of report.blockers) {
        console.log(`- ${blocker}`);
      }
    }

    if (report.followUps.length > 0) {
      console.log("Follow-ups:");
      for (const followUp of report.followUps) {
        console.log(`- ${followUp}`);
      }
    }

    if (report.recentSessions.length > 0) {
      console.log("Recent sessions:");
      for (const session of report.recentSessions) {
        console.log(
          `- ${session.id} | ${session.host} | ${session.status} | ${session.label}`,
        );
      }
    }
  } finally {
    db.close();
  }
}
