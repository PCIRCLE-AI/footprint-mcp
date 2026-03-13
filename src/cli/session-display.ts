/* global process */

import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { reingestSessionHistory } from "../ingestion/index.js";
import { parseArtifactMetadata } from "../lib/session-artifacts.js";
import { filterSessionsByHistory } from "../lib/session-filters.js";
import { getContextReport } from "../lib/context-memory.js";
import { buildSessionTrendContext } from "../lib/session-trends.js";
import { buildHistoryHandoffReport } from "../lib/history-handoff.js";
import {
  buildPageInfo,
  DEFAULT_SESSION_DETAIL_PAGE_LIMIT,
  getSessionLabel,
  MAX_SESSION_DETAIL_PAGE_LIMIT,
  toSessionListItem,
  truncateSummary,
} from "../lib/session-history.js";
import {
  EvidenceDatabase,
  type ArtifactType,
  type NarrativeKind,
  type SessionHost,
  type SessionStatus,
  exportSessions,
} from "../lib/storage/index.js";
import { ensureParentDir, resolveDbPath } from "./session-execution.js";

type LineWriter = (line: string) => void;

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function parseRefs(
  value: string | null,
): Array<{ type: "message" | "event" | "artifact"; id: string }> {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item): item is { type: "message" | "event" | "artifact"; id: string } =>
        Boolean(
          item &&
          typeof item === "object" &&
          typeof (item as { id?: unknown }).id === "string" &&
          ["message", "event", "artifact"].includes(
            String((item as { type?: unknown }).type),
          ),
        ),
    );
  } catch {
    return [];
  }
}

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

function buildSessionShowData(
  db: EvidenceDatabase,
  id: string,
  options?: {
    messageLimit?: number;
    messageOffset?: number;
    trendLimit?: number;
    trendOffset?: number;
    timelineLimit?: number;
    timelineOffset?: number;
    artifactLimit?: number;
    artifactOffset?: number;
    narrativeLimit?: number;
    narrativeOffset?: number;
    decisionLimit?: number;
    decisionOffset?: number;
  },
) {
  const session = db.findSessionById(id);
  if (!session) {
    throw new Error(`Session not found: ${id}`);
  }

  const messageLimit =
    options?.messageLimit ?? DEFAULT_SESSION_DETAIL_PAGE_LIMIT;
  const messageOffset = options?.messageOffset ?? 0;
  const trendLimit = options?.trendLimit ?? DEFAULT_SESSION_DETAIL_PAGE_LIMIT;
  const trendOffset = options?.trendOffset ?? 0;
  const timelineLimit =
    options?.timelineLimit ?? DEFAULT_SESSION_DETAIL_PAGE_LIMIT;
  const timelineOffset = options?.timelineOffset ?? 0;
  const artifactLimit =
    options?.artifactLimit ?? DEFAULT_SESSION_DETAIL_PAGE_LIMIT;
  const artifactOffset = options?.artifactOffset ?? 0;
  const narrativeLimit =
    options?.narrativeLimit ?? DEFAULT_SESSION_DETAIL_PAGE_LIMIT;
  const narrativeOffset = options?.narrativeOffset ?? 0;
  const decisionLimit =
    options?.decisionLimit ?? DEFAULT_SESSION_DETAIL_PAGE_LIMIT;
  const decisionOffset = options?.decisionOffset ?? 0;

  if (!Number.isInteger(messageLimit) || messageLimit <= 0) {
    throw new Error("messageLimit must be a positive integer");
  }
  if (
    !Number.isInteger(messageLimit) ||
    messageLimit > MAX_SESSION_DETAIL_PAGE_LIMIT
  ) {
    throw new Error(
      `messageLimit must be between 1 and ${MAX_SESSION_DETAIL_PAGE_LIMIT}`,
    );
  }
  if (!Number.isInteger(timelineLimit) || timelineLimit <= 0) {
    throw new Error("timelineLimit must be a positive integer");
  }
  if (
    !Number.isInteger(timelineLimit) ||
    timelineLimit > MAX_SESSION_DETAIL_PAGE_LIMIT
  ) {
    throw new Error(
      `timelineLimit must be between 1 and ${MAX_SESSION_DETAIL_PAGE_LIMIT}`,
    );
  }
  if (!Number.isInteger(messageOffset) || messageOffset < 0) {
    throw new Error("messageOffset must be a non-negative integer");
  }
  if (!Number.isInteger(trendLimit) || trendLimit <= 0) {
    throw new Error("trendLimit must be a positive integer");
  }
  if (
    !Number.isInteger(trendLimit) ||
    trendLimit > MAX_SESSION_DETAIL_PAGE_LIMIT
  ) {
    throw new Error(
      `trendLimit must be between 1 and ${MAX_SESSION_DETAIL_PAGE_LIMIT}`,
    );
  }
  if (!Number.isInteger(trendOffset) || trendOffset < 0) {
    throw new Error("trendOffset must be a non-negative integer");
  }
  if (!Number.isInteger(timelineOffset) || timelineOffset < 0) {
    throw new Error("timelineOffset must be a non-negative integer");
  }
  if (!Number.isInteger(artifactLimit) || artifactLimit <= 0) {
    throw new Error("artifactLimit must be a positive integer");
  }
  if (
    !Number.isInteger(artifactLimit) ||
    artifactLimit > MAX_SESSION_DETAIL_PAGE_LIMIT
  ) {
    throw new Error(
      `artifactLimit must be between 1 and ${MAX_SESSION_DETAIL_PAGE_LIMIT}`,
    );
  }
  if (!Number.isInteger(artifactOffset) || artifactOffset < 0) {
    throw new Error("artifactOffset must be a non-negative integer");
  }
  if (!Number.isInteger(narrativeLimit) || narrativeLimit <= 0) {
    throw new Error("narrativeLimit must be a positive integer");
  }
  if (
    !Number.isInteger(narrativeLimit) ||
    narrativeLimit > MAX_SESSION_DETAIL_PAGE_LIMIT
  ) {
    throw new Error(
      `narrativeLimit must be between 1 and ${MAX_SESSION_DETAIL_PAGE_LIMIT}`,
    );
  }
  if (!Number.isInteger(narrativeOffset) || narrativeOffset < 0) {
    throw new Error("narrativeOffset must be a non-negative integer");
  }
  if (!Number.isInteger(decisionLimit) || decisionLimit <= 0) {
    throw new Error("decisionLimit must be a positive integer");
  }
  if (
    !Number.isInteger(decisionLimit) ||
    decisionLimit > MAX_SESSION_DETAIL_PAGE_LIMIT
  ) {
    throw new Error(
      `decisionLimit must be between 1 and ${MAX_SESSION_DETAIL_PAGE_LIMIT}`,
    );
  }
  if (!Number.isInteger(decisionOffset) || decisionOffset < 0) {
    throw new Error("decisionOffset must be a non-negative integer");
  }

  const messageStats = db.getSessionMessageStats(id);
  const timelineSummary = db.getSessionTimelineStats(id);
  const messages = db.getSessionMessages(id, {
    limit: messageLimit,
    offset: messageOffset,
  });
  const timeline = db.getSessionTimeline(id, {
    limit: timelineLimit,
    offset: timelineOffset,
  });
  const trendContext = buildSessionTrendContext(db, session.id, {
    limit: trendLimit,
    offset: trendOffset,
  });
  const artifactSummary = db.getSessionArtifactSummary(id);
  const artifacts = db.getSessionArtifacts(id, {
    limit: artifactLimit,
    offset: artifactOffset,
  });
  const narrativeTotal = db.countSessionNarratives(id);
  const narratives = db.getSessionNarratives(id, {
    limit: narrativeLimit,
    offset: narrativeOffset,
  });
  const decisionTotal = db.countSessionDecisions(id);
  const decisions = db.getSessionDecisions(id, {
    limit: decisionLimit,
    offset: decisionOffset,
  });
  const ingestionRuns = db.getSessionIngestionRuns(id);
  const messageSummary = {
    total: messageStats.total,
    byRole: messageStats.byRole,
    firstCapturedAt: messageStats.firstCapturedAt,
    lastCapturedAt: messageStats.lastCapturedAt,
    preview: messageStats.previewContent
      ? truncateSummary(messageStats.previewContent)
      : null,
  };
  const messagePage = buildPageInfo(messageSummary.total, messages.length, {
    offset: messageOffset,
    limit: messageLimit,
  });
  const trendPage =
    trendContext.page ??
    buildPageInfo(
      trendContext.summary.totalTrends,
      trendContext.trends.length,
      {
        offset: trendOffset,
        limit: trendLimit,
      },
    );
  const timelinePage = buildPageInfo(timelineSummary.total, timeline.length, {
    offset: timelineOffset,
    limit: timelineLimit,
  });
  const artifactPage = buildPageInfo(artifactSummary.total, artifacts.length, {
    offset: artifactOffset,
    limit: artifactLimit,
  });
  const narrativePage = buildPageInfo(narrativeTotal, narratives.length, {
    offset: narrativeOffset,
    limit: narrativeLimit,
  });
  const decisionPage = buildPageInfo(decisionTotal, decisions.length, {
    offset: decisionOffset,
    limit: decisionLimit,
  });

  return {
    session: {
      id: session.id,
      host: session.host,
      title: session.title,
      label: getSessionLabel(session),
      status: session.status,
      projectRoot: session.projectRoot,
      cwd: session.cwd,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      metadata: session.metadata,
    },
    messageSummary,
    messagePage,
    trendPage,
    timelineSummary,
    timelinePage,
    artifactSummary,
    artifactPage,
    narrativePage,
    decisionPage,
    trendContext,
    messages,
    timeline,
    artifacts: artifacts.map((artifact) => {
      const metadata = parseArtifactMetadata(artifact.metadata);
      return {
        ...artifact,
        metadata: metadata.details,
        summary: metadata.summary ?? artifact.path ?? artifact.artifactType,
        category: metadata.category,
        status: metadata.status,
        outcome: metadata.outcome,
        intent: metadata.intent,
        commandFamily: metadata.commandFamily,
        command: metadata.command,
        args: metadata.args,
        framework: metadata.framework,
        packageManager: metadata.packageManager,
        scriptName: metadata.scriptName,
        dependencyAction: metadata.dependencyAction,
        dependencyNames: metadata.dependencyNames,
        failureSignatureKey: metadata.failureSignatureKey,
        failureSignatureLabel: metadata.failureSignatureLabel,
        errorCode: metadata.errorCode,
        lintRuleId: metadata.lintRuleId,
        testSuite: metadata.testSuite,
        testCase: metadata.testCase,
        issueKey: metadata.issueKey,
        issueLabel: metadata.issueLabel,
        issueFamilyKey: metadata.issueFamilyKey,
        issueFamilyLabel: metadata.issueFamilyLabel,
        pathCategory: metadata.pathCategory,
        changeScope: metadata.changeScope,
        manifestKind: metadata.manifestKind,
        sourceRefs: metadata.sourceRefs,
      };
    }),
    narratives: narratives.map((narrative) => ({
      ...narrative,
      sourceRefs: parseRefs(narrative.sourceRefs),
    })),
    decisions: decisions.map((decision) => ({
      ...decision,
      sourceRefs: parseRefs(decision.sourceRefs),
    })),
    ingestionRuns,
    hasNarratives: narrativeTotal > 0,
  };
}

function toSingleLine(value: string | null | undefined): string {
  if (!value) {
    return "n/a";
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || "n/a";
}

function formatPreviewText(
  value: string | null | undefined,
  maxLength: number = 120,
): string {
  return truncateSummary(toSingleLine(value), maxLength);
}

export function printSection(
  title: string,
  lines: string[],
  writeLine: LineWriter = (line) => console.log(line),
): void {
  writeLine("");
  writeLine(`${title}:`);
  if (lines.length === 0) {
    writeLine("- none");
    return;
  }

  for (const line of lines) {
    writeLine(`- ${line}`);
  }
}

export function printContextBriefing(
  report: ReturnType<typeof getContextReport>,
  writeLine: LineWriter = (line) => console.log(line),
): void {
  writeLine(`Context: ${report.context.id}`);
  writeLine(`Label: ${report.context.label}`);
  writeLine(`Workspace: ${report.context.workspaceKey}`);
  writeLine(`Sessions: ${report.context.sessionCount}`);
  writeLine(`Latest: ${report.context.latestSessionLabel}`);
  printSection("Current Truth", [report.currentTruth.summary], writeLine);
  printSection(
    "Active Blockers",
    report.currentTruth.activeBlockers,
    writeLine,
  );
  printSection("Open Questions", report.currentTruth.openQuestions, writeLine);
  printSection(
    "Active Decisions",
    report.activeDecisions.map(
      (decision) => `[${decision.status}] ${decision.title}`,
    ),
    writeLine,
  );
  printSection(
    "Superseded Decisions",
    report.supersededDecisions.map(
      (decision) =>
        `[${decision.status}] ${decision.title} -> ${decision.supersededByTitle ?? "superseded"}`,
    ),
    writeLine,
  );
}

function buildTrendPreviewLines(
  trends: ReturnType<typeof buildSessionShowData>["trendContext"]["trends"],
  limit: number = 3,
): string[] {
  return trends.slice(0, limit).map((trend) => {
    const family =
      trend.issueFamilyLabel && trend.issueFamilyLabel !== trend.label
        ? ` | family ${trend.issueFamilyLabel}`
        : "";
    return `${trend.label} | ${trend.kind ?? "unknown"} | session ${trend.sessionAttempts}/${trend.globalAttempts} attempt(s) | latest ${trend.latestOutcome}${family}`;
  });
}

function buildArtifactPreviewLines(
  artifacts: ReturnType<typeof buildSessionShowData>["artifacts"],
  limit: number = 4,
): string[] {
  return artifacts.slice(0, limit).map((artifact) => {
    const category = artifact.category ? ` | ${artifact.category}` : "";
    const status = artifact.status ? ` | ${artifact.status}` : "";
    const detail =
      artifact.failureSignatureLabel ??
      (artifact.testSuite
        ? `${artifact.testSuite}${artifact.testCase ? ` > ${artifact.testCase}` : ""}`
        : artifact.dependencyNames.length > 0
          ? `${artifact.dependencyAction ?? "deps"} ${artifact.dependencyNames.join(", ")}`
          : artifact.changeScope
            ? `${artifact.changeScope}${artifact.manifestKind ? ` ${artifact.manifestKind}` : ""}`
            : null);
    const suffix = detail ? ` | ${formatPreviewText(detail, 80)}` : "";
    return `${artifact.artifactType}${category}${status} | ${formatPreviewText(
      artifact.summary,
      110,
    )}${suffix}`;
  });
}

function buildDecisionPreviewLines(
  decisions: ReturnType<typeof buildSessionShowData>["decisions"],
  limit: number = 3,
): string[] {
  return decisions.slice(0, limit).map((decision) => {
    return `${decision.status} | ${formatPreviewText(
      decision.title,
      80,
    )} | ${formatPreviewText(decision.summary, 100)}`;
  });
}

function buildNarrativeHighlightLines(
  narratives: ReturnType<typeof buildSessionShowData>["narratives"],
  limit: number = 5,
): string[] {
  const handoffNarrative = narratives.find(
    (narrative) => narrative.kind === "handoff",
  );
  const narrative = handoffNarrative ?? narratives[0];
  if (!narrative) {
    return [];
  }

  return narrative.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, limit)
    .map((line) => formatPreviewText(line, 140));
}

function buildMessagePreviewLines(
  messages: ReturnType<typeof buildSessionShowData>["messages"],
): string[] {
  return messages.map((message) => {
    return `#${message.seq} ${message.role} | ${message.capturedAt} | ${formatPreviewText(
      message.content,
      140,
    )}`;
  });
}

function buildTimelinePreviewLines(
  timeline: ReturnType<typeof buildSessionShowData>["timeline"],
): string[] {
  return timeline.map((event) => {
    const suffix = event.summary
      ? ` | ${formatPreviewText(event.summary, 120)}`
      : "";
    return `#${event.seq} ${event.eventType} | ${event.status ?? "n/a"} | ${event.startedAt}${suffix}`;
  });
}

function listSessionsCliWithOptions(options?: {
  json?: boolean;
  query?: string;
  issueKey?: string;
  host?: SessionHost;
  status?: SessionStatus;
}): void {
  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);
  const db = new EvidenceDatabase(dbPath);

  try {
    if (options?.query !== undefined && !options.query.trim()) {
      throw new Error("Query must not be empty");
    }
    if (options?.issueKey !== undefined && !options.issueKey.trim()) {
      throw new Error("issueKey must not be empty");
    }

    const sessions = filterSessionsByHistory(db, {
      query: options?.query,
      issueKey: options?.issueKey,
      host: options?.host,
      status: options?.status,
    }).map(toSessionListItem);
    if (options?.json) {
      printJson({
        filters: {
          query: options.query?.trim() || undefined,
          issueKey: options.issueKey?.trim() || undefined,
          host: options.host,
          status: options.status,
        },
        total: sessions.length,
        sessions,
      });
      return;
    }

    console.log(`Recorded sessions: ${sessions.length}`);
    if (
      options?.query ||
      options?.issueKey ||
      options?.host ||
      options?.status
    ) {
      console.log(
        `Filters: query=${options.query?.trim() || "all"} issue=${options.issueKey?.trim() || "all"} host=${options.host ?? "all"} status=${options.status ?? "all"}`,
      );
    }
    for (const session of sessions) {
      console.log(
        `${session.id} | ${session.host} | ${session.status} | ${session.label} | ${session.startedAt}`,
      );
    }
  } finally {
    db.close();
  }
}

export function listSessionsCli(options?: {
  json?: boolean;
  query?: string;
  issueKey?: string;
  host?: SessionHost;
  status?: SessionStatus;
}): void {
  listSessionsCliWithOptions(options);
}

export function showSessionCli(
  id: string,
  options?: {
    json?: boolean;
    messageLimit?: number;
    messageOffset?: number;
    trendLimit?: number;
    trendOffset?: number;
    timelineLimit?: number;
    timelineOffset?: number;
    artifactLimit?: number;
    artifactOffset?: number;
    narrativeLimit?: number;
    narrativeOffset?: number;
    decisionLimit?: number;
    decisionOffset?: number;
  },
): void {
  showSessionCliWithOptions(id, options);
}

function showSessionCliWithOptions(
  id: string,
  options?: {
    json?: boolean;
    messageLimit?: number;
    messageOffset?: number;
    trendLimit?: number;
    trendOffset?: number;
    timelineLimit?: number;
    timelineOffset?: number;
    artifactLimit?: number;
    artifactOffset?: number;
    narrativeLimit?: number;
    narrativeOffset?: number;
    decisionLimit?: number;
    decisionOffset?: number;
  },
): void {
  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);
  const db = new EvidenceDatabase(dbPath);

  try {
    const data = buildSessionShowData(db, id, options);

    if (options?.json) {
      printJson(data);
      return;
    }

    console.log(`Session: ${data.session.id}`);
    console.log(`Host: ${data.session.host}`);
    console.log(`Label: ${data.session.label}`);
    console.log(`Status: ${data.session.status}`);
    console.log(`Started: ${data.session.startedAt}`);
    console.log(`Ended: ${data.session.endedAt ?? "running"}`);
    console.log(`CWD: ${data.session.cwd}`);
    console.log(`Narratives: ${data.hasNarratives ? "yes" : "no"}`);
    console.log(
      `Artifacts: ${data.artifactSummary.total} (file ${data.artifactSummary.byType.fileChange}, command ${data.artifactSummary.byType.commandOutput}, test ${data.artifactSummary.byType.testResult}, git ${data.artifactSummary.byType.gitCommit})`,
    );
    console.log(`Decisions: ${data.decisionPage.total}`);
    console.log(`Ingestion runs: ${data.ingestionRuns.length}`);
    console.log(
      `Recurring trends: ${data.trendContext.summary.totalTrends} (cross-session ${data.trendContext.summary.crossSessionTrends}, session attempts ${data.trendContext.summary.sessionAttempts}, global attempts ${data.trendContext.summary.globalAttempts})`,
    );
    console.log(
      `Messages: ${data.messageSummary.total} (user ${data.messageSummary.byRole.user}, assistant ${data.messageSummary.byRole.assistant}, system ${data.messageSummary.byRole.system})`,
    );
    console.log(
      `Message page: offset ${data.messagePage.offset}, limit ${data.messagePage.limit}, returned ${data.messagePage.returned}`,
    );
    console.log(
      `Trend page: offset ${data.trendPage.offset}, limit ${data.trendPage.limit}, returned ${data.trendPage.returned}`,
    );
    console.log(
      `Timeline: ${data.timelineSummary.total} (${data.timelineSummary.eventTypes.join(", ") || "no events"})`,
    );
    console.log(
      `Timeline page: offset ${data.timelinePage.offset}, limit ${data.timelinePage.limit}, returned ${data.timelinePage.returned}`,
    );
    console.log(
      `Artifact page: offset ${data.artifactPage.offset}, limit ${data.artifactPage.limit}, returned ${data.artifactPage.returned}`,
    );
    console.log(
      `Narrative page: offset ${data.narrativePage.offset}, limit ${data.narrativePage.limit}, returned ${data.narrativePage.returned}`,
    );
    console.log(
      `Decision page: offset ${data.decisionPage.offset}, limit ${data.decisionPage.limit}, returned ${data.decisionPage.returned}`,
    );

    const trendLines = buildTrendPreviewLines(data.trendContext.trends);
    if (data.trendPage.total > data.trendContext.trends.length) {
      trendLines.push(
        `+${data.trendPage.total - data.trendContext.trends.length} more recurring trend(s)`,
      );
    }
    if (data.trendPage.hasMore) {
      trendLines.push(
        `Use --trend-offset ${data.trendPage.nextOffset} to continue this recurring trend page.`,
      );
    }
    printSection("Recurring Trend Preview", trendLines);

    const narrativeLines = buildNarrativeHighlightLines(data.narratives);
    if (narrativeLines.length > 0) {
      if (data.narrativePage.hasMore) {
        narrativeLines.push(
          `Use --narrative-offset ${data.narrativePage.nextOffset} to continue narrative highlights.`,
        );
      }
      printSection("Handoff Highlights", narrativeLines);
    }

    const artifactLines = buildArtifactPreviewLines(data.artifacts);
    if (data.artifacts.length > artifactLines.length) {
      artifactLines.push(
        `+${data.artifacts.length - artifactLines.length} more artifact(s)`,
      );
    }
    if (data.artifactPage.hasMore) {
      artifactLines.push(
        `Use --artifact-offset ${data.artifactPage.nextOffset} to continue this artifact page.`,
      );
    }
    printSection("Artifact Preview", artifactLines);

    const decisionLines = buildDecisionPreviewLines(data.decisions);
    if (data.decisionPage.total > decisionLines.length) {
      decisionLines.push(
        `+${data.decisionPage.total - decisionLines.length} more decision(s)`,
      );
    }
    if (data.decisionPage.hasMore) {
      decisionLines.push(
        `Use --decision-offset ${data.decisionPage.nextOffset} to continue this decision page.`,
      );
    }
    if (data.decisionPage.total > 0) {
      printSection("Decision Preview", decisionLines);
    }

    const messageLines = buildMessagePreviewLines(data.messages);
    if (data.messagePage.hasMore) {
      messageLines.push(
        `Use --message-offset ${data.messagePage.nextOffset} to continue this transcript page.`,
      );
    }
    printSection("Transcript Preview", messageLines);

    const timelineLines = buildTimelinePreviewLines(data.timeline);
    if (data.timelinePage.hasMore) {
      timelineLines.push(
        `Use --timeline-offset ${data.timelinePage.nextOffset} to continue this timeline page.`,
      );
    }
    printSection("Timeline Preview", timelineLines);
  } finally {
    db.close();
  }
}

export async function exportSessionsCli(
  sessionIds?: string[],
  options?: {
    json?: boolean;
    outputMode?: "file" | "base64" | "both";
    query?: string;
    issueKey?: string;
    host?: SessionHost;
    status?: SessionStatus;
    groupBy?: "issue" | "family";
  },
): Promise<void> {
  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);
  const db = new EvidenceDatabase(dbPath);

  try {
    const outputMode = options?.outputMode ?? (options?.json ? "both" : "file");
    const result = await exportSessions(db, {
      sessionIds,
      query: options?.query,
      issueKey: options?.issueKey,
      host: options?.host,
      status: options?.status,
      groupBy: options?.groupBy,
    });
    const maxBase64Size = 75 * 1024 * 1024;

    if (
      (outputMode === "base64" || outputMode === "both") &&
      result.zipData.length > maxBase64Size
    ) {
      throw new Error(
        `Export too large for base64 mode (${(result.zipData.length / (1024 * 1024)).toFixed(1)}MB). Use --output-mode file or export fewer sessions.`,
      );
    }

    let filename: string | undefined;
    let base64Data: string | undefined;

    if (outputMode === "file" || outputMode === "both") {
      const outputDir =
        process.env.FOOTPRINT_DATA_DIR ||
        process.env.FOOTPRINT_EXPORT_DIR ||
        tmpdir();
      filename = path.join(outputDir, result.filename);
      fs.writeFileSync(filename, result.zipData);
    }

    if (outputMode === "base64" || outputMode === "both") {
      base64Data = Buffer.from(result.zipData).toString("base64");
    }

    if (options?.json) {
      printJson({
        ...(filename && { filename }),
        ...(base64Data && { base64Data }),
        checksum: result.checksum,
        sessionCount: result.sessionCount,
        historyGrouping: result.historyGrouping,
        ...(result.filters ? { filters: result.filters } : {}),
        sessions: result.sessions,
        success: true,
      });
      return;
    }

    console.log(`Exported sessions: ${result.sessionCount}`);
    console.log(`Output mode: ${outputMode}`);
    console.log(`History grouping: ${result.historyGrouping}`);
    console.log(`Checksum: ${result.checksum}`);
    if (result.filters) {
      console.log(
        `Filters: query=${result.filters.query ?? "all"} issue=${result.filters.issueKey ?? "all"} host=${result.filters.host ?? "all"} status=${result.filters.status ?? "all"} groupBy=${result.filters.groupBy ?? result.historyGrouping}`,
      );
    }
    if (filename) {
      console.log(`Filename: ${filename}`);
    }
    if (base64Data) {
      console.log(`Base64 size: ${Math.round(base64Data.length / 1024)}KB`);
    }
    for (const session of result.sessions) {
      console.log(
        `${session.id} | ${session.host} | ${session.status} | ${session.label}`,
      );
    }
  } finally {
    db.close();
  }
}

export function ingestSessionCli(
  id: string,
  options?: { json?: boolean },
): void {
  ingestSessionCliWithOptions(id, options);
}

function ingestSessionCliWithOptions(
  id: string,
  options?: { json?: boolean },
): void {
  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);
  const db = new EvidenceDatabase(dbPath);

  try {
    const session = db.findSessionById(id);
    if (!session) {
      throw new Error(`Session not found: ${id}`);
    }

    if (session.status === "running") {
      throw new Error(
        `Session is still running and cannot be reingested yet: ${id}`,
      );
    }

    const summary = reingestSessionHistory(db, id);
    if (options?.json) {
      printJson({
        sessionId: id,
        artifactsCreated: summary.artifactsCreated,
        narrativesCreated: summary.narrativesCreated,
        decisionsCreated: summary.decisionsCreated,
      });
      return;
    }

    console.log(`Reingested session: ${id}`);
    console.log(`Artifacts: ${summary.artifactsCreated}`);
    console.log(`Narratives: ${summary.narrativesCreated}`);
    console.log(`Decisions: ${summary.decisionsCreated}`);
  } finally {
    db.close();
  }
}

export function showSessionMessagesCli(
  id: string,
  options?: { json?: boolean; limit?: number; offset?: number },
): void {
  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);
  const db = new EvidenceDatabase(dbPath);

  try {
    if (!db.findSessionById(id)) {
      throw new Error(`Session not found: ${id}`);
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
    const total = db.countSessionMessages(id);
    const messages = db.getSessionMessages(id, {
      limit: options?.limit,
      offset,
    });
    const page = buildPageInfo(total, messages.length, {
      offset,
      limit: options?.limit ?? Math.max(messages.length, total - offset, 0),
    });
    if (options?.json) {
      printJson({
        sessionId: id,
        total,
        page,
        messages,
      });
      return;
    }

    console.log(`Messages for session: ${id}`);
    console.log(
      `Showing ${messages.length} of ${total} (offset ${page.offset}, limit ${page.limit})`,
    );
    for (const message of messages) {
      console.log(
        `message#${message.seq} ${message.role} ${message.capturedAt} ${message.content}`,
      );
    }
    if (page.hasMore) {
      console.log(`More messages available from offset ${page.nextOffset}`);
    }
  } finally {
    db.close();
  }
}

export function showSessionTrendsCli(
  id: string,
  options?: { json?: boolean; limit?: number; offset?: number },
): void {
  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);
  const db = new EvidenceDatabase(dbPath);

  try {
    if (!db.findSessionById(id)) {
      throw new Error(`Session not found: ${id}`);
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

    const limit = options?.limit ?? DEFAULT_SESSION_DETAIL_PAGE_LIMIT;
    const offset = options?.offset ?? 0;
    const trendContext = buildSessionTrendContext(db, id, {
      limit,
      offset,
    });
    const page =
      trendContext.page ??
      buildPageInfo(
        trendContext.summary.totalTrends,
        trendContext.trends.length,
        {
          offset,
          limit,
        },
      );
    if (options?.json) {
      printJson({
        sessionId: id,
        summary: trendContext.summary,
        page,
        trends: trendContext.trends,
      });
      return;
    }

    console.log(`Recurring trends for session: ${id}`);
    console.log(
      `Showing ${trendContext.trends.length} of ${trendContext.summary.totalTrends} (cross-session ${trendContext.summary.crossSessionTrends}, session attempts ${trendContext.summary.sessionAttempts}, global attempts ${trendContext.summary.globalAttempts})`,
    );
    for (const line of buildTrendPreviewLines(
      trendContext.trends,
      page.limit,
    )) {
      console.log(line);
    }
    if (page.hasMore) {
      console.log(
        `More recurring trends available from offset ${page.nextOffset}`,
      );
    }
  } finally {
    db.close();
  }
}

export function showSessionTimelineCli(
  id: string,
  options?: { json?: boolean; limit?: number; offset?: number },
): void {
  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);
  const db = new EvidenceDatabase(dbPath);

  try {
    if (!db.findSessionById(id)) {
      throw new Error(`Session not found: ${id}`);
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
    const total = db.countSessionTimeline(id);
    const summary = db.getSessionTimelineStats(id);
    const timeline = db.getSessionTimeline(id, {
      limit: options?.limit,
      offset,
    });
    const page = buildPageInfo(total, timeline.length, {
      offset,
      limit: options?.limit ?? Math.max(timeline.length, total - offset, 0),
    });
    if (options?.json) {
      printJson({
        sessionId: id,
        timelineSummary: summary,
        total,
        page,
        timeline,
      });
      return;
    }

    console.log(`Timeline for session: ${id}`);
    console.log(
      `Showing ${timeline.length} of ${summary.total} (${summary.eventTypes.join(", ") || "no events"})`,
    );
    for (const event of timeline) {
      console.log(
        `event#${event.seq} ${event.eventType} ${event.status ?? "n/a"} ${event.startedAt}${event.summary ? ` ${event.summary}` : ""}`,
      );
    }
    if (page.hasMore) {
      console.log(
        `More timeline events available from offset ${page.nextOffset}`,
      );
    }
  } finally {
    db.close();
  }
}

export function showSessionArtifactsCli(
  id: string,
  options?: {
    json?: boolean;
    artifactType?: ArtifactType;
    limit?: number;
    offset?: number;
  },
): void {
  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);
  const db = new EvidenceDatabase(dbPath);

  try {
    if (!db.findSessionById(id)) {
      throw new Error(`Session not found: ${id}`);
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

    const artifactSummary = db.getSessionArtifactSummary(id);
    const offset = options?.offset ?? 0;
    const total = db.countSessionArtifacts(id, {
      artifactType: options?.artifactType,
    });
    const artifacts = db
      .getSessionArtifacts(id, {
        artifactType: options?.artifactType,
        limit: options?.limit,
        offset,
      })
      .map((artifact) => {
        const metadata = parseArtifactMetadata(artifact.metadata);
        return {
          ...artifact,
          summary: metadata.summary ?? artifact.path ?? artifact.artifactType,
          category: metadata.category,
          status: metadata.status,
          outcome: metadata.outcome,
          intent: metadata.intent,
          commandFamily: metadata.commandFamily,
          command: metadata.command,
          args: metadata.args,
          framework: metadata.framework,
          packageManager: metadata.packageManager,
          scriptName: metadata.scriptName,
          dependencyAction: metadata.dependencyAction,
          dependencyNames: metadata.dependencyNames,
          failureSignatureKey: metadata.failureSignatureKey,
          failureSignatureLabel: metadata.failureSignatureLabel,
          errorCode: metadata.errorCode,
          lintRuleId: metadata.lintRuleId,
          testSuite: metadata.testSuite,
          testCase: metadata.testCase,
          issueKey: metadata.issueKey,
          issueLabel: metadata.issueLabel,
          issueFamilyKey: metadata.issueFamilyKey,
          issueFamilyLabel: metadata.issueFamilyLabel,
          pathCategory: metadata.pathCategory,
          changeScope: metadata.changeScope,
          manifestKind: metadata.manifestKind,
          previousHead: metadata.previousHead,
          currentHead: metadata.currentHead,
          sourceRefs: metadata.sourceRefs,
          details: metadata.details,
        };
      });
    const page = buildPageInfo(total, artifacts.length, {
      offset,
      limit: options?.limit ?? Math.max(artifacts.length, total - offset, 0),
    });

    if (options?.json) {
      printJson({
        sessionId: id,
        artifactSummary,
        page,
        artifacts,
      });
      return;
    }

    console.log(`Artifacts for session: ${id}`);
    console.log(
      `Total: ${artifacts.length} shown, ${page.total} matching current filter, ${artifactSummary.total} overall`,
    );
    console.log(
      `By type: file ${artifactSummary.byType.fileChange}, command ${artifactSummary.byType.commandOutput}, test ${artifactSummary.byType.testResult}, git ${artifactSummary.byType.gitCommit}`,
    );
    console.log(
      `Page: offset ${page.offset}, limit ${page.limit}, returned ${page.returned}`,
    );
    for (const [index, artifact] of artifacts.entries()) {
      const detail =
        artifact.failureSignatureLabel ??
        (artifact.testSuite
          ? `${artifact.testSuite}${artifact.testCase ? ` > ${artifact.testCase}` : ""}`
          : artifact.dependencyNames.length > 0
            ? `${artifact.dependencyAction ?? "deps"} ${artifact.dependencyNames.join(", ")}`
            : artifact.changeScope
              ? `${artifact.changeScope}${artifact.manifestKind ? ` ${artifact.manifestKind}` : ""}`
              : null);
      console.log(
        `artifact#${index + 1} ${artifact.artifactType}${artifact.category ? ` ${artifact.category}` : ""}${artifact.status ? ` ${artifact.status}` : ""} ${artifact.summary}${artifact.path ? ` [${artifact.path}]` : ""}${detail ? ` | ${detail}` : ""}`,
      );
    }
    if (page.hasMore) {
      console.log(`More artifacts available from offset ${page.nextOffset}`);
    }
  } finally {
    db.close();
  }
}

export function showSessionNarrativesCli(
  id: string,
  options?: {
    json?: boolean;
    kind?: NarrativeKind;
    limit?: number;
    offset?: number;
  },
): void {
  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);
  const db = new EvidenceDatabase(dbPath);

  try {
    if (!db.findSessionById(id)) {
      throw new Error(`Session not found: ${id}`);
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
    const total = db.countSessionNarratives(id, {
      kind: options?.kind,
    });
    const narratives = db
      .getSessionNarratives(id, {
        kind: options?.kind,
        limit: options?.limit,
        offset,
      })
      .map((narrative) => ({
        ...narrative,
        sourceRefs: parseRefs(narrative.sourceRefs),
      }));
    const page = buildPageInfo(total, narratives.length, {
      offset,
      limit: options?.limit ?? Math.max(narratives.length, total - offset, 0),
    });

    if (options?.json) {
      printJson({
        sessionId: id,
        page,
        narratives,
      });
      return;
    }

    console.log(`Narratives for session: ${id}`);
    console.log(`Total: ${narratives.length} shown, ${page.total} matching`);
    console.log(
      `Page: offset ${page.offset}, limit ${page.limit}, returned ${page.returned}`,
    );
    for (const narrative of narratives) {
      console.log(`[${narrative.kind}] ${narrative.content}`);
    }
    if (page.hasMore) {
      console.log(`More narratives available from offset ${page.nextOffset}`);
    }
  } finally {
    db.close();
  }
}

export function showSessionDecisionsCli(
  id: string,
  options?: { json?: boolean; limit?: number; offset?: number },
): void {
  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);
  const db = new EvidenceDatabase(dbPath);

  try {
    if (!db.findSessionById(id)) {
      throw new Error(`Session not found: ${id}`);
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
    const total = db.countSessionDecisions(id);
    const decisions = db
      .getSessionDecisions(id, {
        limit: options?.limit,
        offset,
      })
      .map((decision) => ({
        ...decision,
        sourceRefs: parseRefs(decision.sourceRefs),
      }));
    const page = buildPageInfo(total, decisions.length, {
      offset,
      limit: options?.limit ?? Math.max(decisions.length, total - offset, 0),
    });

    if (options?.json) {
      printJson({
        sessionId: id,
        page,
        decisions,
      });
      return;
    }

    console.log(`Decisions for session: ${id}`);
    console.log(`Total: ${decisions.length} shown, ${page.total} overall`);
    console.log(
      `Page: offset ${page.offset}, limit ${page.limit}, returned ${page.returned}`,
    );
    for (const decision of decisions) {
      console.log(
        `[${decision.status}] ${decision.title} :: ${decision.summary}${decision.rationale ? ` :: rationale=${decision.rationale}` : ""}`,
      );
    }
    if (page.hasMore) {
      console.log(`More decisions available from offset ${page.nextOffset}`);
    }
  } finally {
    db.close();
  }
}
