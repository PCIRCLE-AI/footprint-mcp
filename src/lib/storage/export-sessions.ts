import JSZip from "jszip";
import { createHash, randomUUID } from "node:crypto";
import { Buffer } from "node:buffer";
import { traceAsyncOperation } from "../observability.js";
import {
  buildArtifactSummary,
  parseArtifactMetadata,
} from "../session-artifacts.js";
import {
  buildMessageSummary,
  buildTimelineSummary,
  getSessionLabel,
} from "../session-history.js";
import {
  buildHistoryTrendReport,
  type HistoryTrendGroupBy,
  type HistoryTrend,
  type HistoryTrendReport,
} from "../session-trends.js";
import { buildHistoryHandoffReport } from "../history-handoff.js";
import {
  filterSessionsByHistory,
  type SessionHistoryFilters,
} from "../session-filters.js";
import type { EvidenceDatabase } from "./database.js";
import type {
  ArtifactRecord,
  DecisionRecord,
  NarrativeRecord,
  SessionDetail,
  SessionRecord,
} from "./types.js";

export interface SessionExportOptions {
  sessionIds?: string[];
  query?: string;
  issueKey?: string;
  host?: SessionRecord["host"];
  status?: SessionRecord["status"];
  groupBy?: HistoryTrendGroupBy;
}

export interface SessionExportFilters extends SessionHistoryFilters {
  groupBy?: HistoryTrendGroupBy;
}

export interface SessionExportResult {
  filename: string;
  zipData: Uint8Array;
  checksum: string;
  sessionCount: number;
  filters?: SessionExportFilters;
  historyGrouping: HistoryTrendGroupBy;
  sessions: Array<{
    id: string;
    host: SessionRecord["host"];
    label: string;
    status: SessionRecord["status"];
    startedAt: string;
    endedAt: string | null;
  }>;
}

interface SessionExportManifest {
  version: string;
  exportDate: string;
  sessionCount: number;
  historyGrouping: HistoryTrendGroupBy;
  includedSections: string[];
  selection: {
    mode: "all" | "ids" | "filters";
    sessionIds?: string[];
    filters?: SessionHistoryFilters;
  };
}

const SESSION_EXPORT_FORMAT_VERSION = "1.3.0";
const MAX_SESSION_EXPORT_SIZE_MB = 100;
const ESTIMATED_SESSION_OVERHEAD_BYTES = 4096;

function parseJsonRecord(value: string | null): Record<string, unknown> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseRefs(value: string): Array<{ type: string; id: string }> {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((ref): ref is { type: string; id: string } =>
          Boolean(
            ref &&
            typeof ref === "object" &&
            typeof (ref as { type?: unknown }).type === "string" &&
            typeof (ref as { id?: unknown }).id === "string",
          ),
        )
      : [];
  } catch {
    return [];
  }
}

function normalizeArtifacts(artifacts: ArtifactRecord[]) {
  return artifacts.map((artifact) => {
    const metadata = parseArtifactMetadata(artifact.metadata);
    return {
      id: artifact.id,
      sessionId: artifact.sessionId,
      eventId: artifact.eventId,
      artifactType: artifact.artifactType,
      path: artifact.path,
      createdAt: artifact.createdAt,
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
}

function normalizeNarratives(narratives: NarrativeRecord[]) {
  return narratives.map((narrative) => ({
    id: narrative.id,
    sessionId: narrative.sessionId,
    kind: narrative.kind,
    content: narrative.content,
    sourceRefs: parseRefs(narrative.sourceRefs),
    createdAt: narrative.createdAt,
    updatedAt: narrative.updatedAt,
  }));
}

function normalizeDecisions(decisions: DecisionRecord[]) {
  return decisions.map((decision) => ({
    id: decision.id,
    sessionId: decision.sessionId,
    title: decision.title,
    summary: decision.summary,
    rationale: decision.rationale,
    status: decision.status,
    sourceRefs: parseRefs(decision.sourceRefs),
    createdAt: decision.createdAt,
  }));
}

function estimateSessionDetailSize(detail: SessionDetail): number {
  let total = ESTIMATED_SESSION_OVERHEAD_BYTES;
  const add = (value: string | null | undefined): void => {
    if (value) {
      total += Buffer.byteLength(value, "utf8");
    }
  };

  add(detail.session.id);
  add(detail.session.title);
  add(detail.session.projectRoot);
  add(detail.session.cwd);
  add(detail.session.metadata);
  add(detail.session.startedAt);
  add(detail.session.endedAt);

  for (const message of detail.messages) {
    add(message.id);
    add(message.source);
    add(message.content);
    add(message.metadata);
    add(message.capturedAt);
  }

  for (const event of detail.timeline) {
    add(event.id);
    add(event.eventType);
    add(event.eventSubType);
    add(event.source);
    add(event.summary);
    add(event.payload);
    add(event.startedAt);
    add(event.endedAt);
    add(event.status);
    add(event.relatedMessageId);
  }

  for (const artifact of detail.artifacts) {
    add(artifact.id);
    add(artifact.eventId);
    add(artifact.path);
    add(artifact.metadata);
    add(artifact.createdAt);
  }

  for (const narrative of detail.narratives) {
    add(narrative.id);
    add(narrative.kind);
    add(narrative.content);
    add(narrative.sourceRefs);
    add(narrative.createdAt);
    add(narrative.updatedAt);
  }

  for (const decision of detail.decisions) {
    add(decision.id);
    add(decision.title);
    add(decision.summary);
    add(decision.rationale);
    add(decision.sourceRefs);
    add(decision.createdAt);
  }

  for (const run of detail.ingestionRuns) {
    add(run.id);
    add(run.stage);
    add(run.status);
    add(run.error);
    add(run.startedAt);
    add(run.endedAt);
  }

  return total;
}

function buildSessionSummary(detail: SessionDetail) {
  return {
    session: {
      id: detail.session.id,
      host: detail.session.host,
      title: detail.session.title,
      label: getSessionLabel(detail.session),
      status: detail.session.status,
      projectRoot: detail.session.projectRoot,
      cwd: detail.session.cwd,
      startedAt: detail.session.startedAt,
      endedAt: detail.session.endedAt,
      metadata: detail.session.metadata,
      metadataDetails: parseJsonRecord(detail.session.metadata),
    },
    messageSummary: buildMessageSummary(detail.messages),
    timelineSummary: buildTimelineSummary(detail.timeline),
    artifactSummary: buildArtifactSummary(detail.artifacts),
    counts: {
      messages: detail.messages.length,
      timeline: detail.timeline.length,
      artifacts: detail.artifacts.length,
      narratives: detail.narratives.length,
      decisions: detail.decisions.length,
      ingestionRuns: detail.ingestionRuns.length,
    },
    hasNarratives: detail.hasNarratives,
  };
}

function buildTranscriptMarkdown(detail: SessionDetail): string {
  const lines = [
    `# Transcript: ${getSessionLabel(detail.session)}`,
    "",
    `- Session ID: ${detail.session.id}`,
    `- Host: ${detail.session.host}`,
    `- Status: ${detail.session.status}`,
    "",
    "## Messages",
    "",
  ];

  if (detail.messages.length === 0) {
    lines.push("_No messages captured._");
    return lines.join("\n");
  }

  for (const message of detail.messages) {
    lines.push(
      `### #${message.seq} ${message.role}`,
      "",
      `- Captured At: ${message.capturedAt}`,
      `- Source: ${message.source}`,
      "",
      message.content || "_Empty message_",
      "",
    );
  }

  return lines.join("\n");
}

function buildDecisionLines(
  decisions: ReturnType<typeof normalizeDecisions>,
): string[] {
  if (decisions.length === 0) {
    return ["_No derived decisions exported._"];
  }

  return decisions.map((decision) => {
    const rationale = decision.rationale
      ? ` Rationale: ${decision.rationale}`
      : "";
    return `- [${decision.status}] ${decision.title}: ${decision.summary}${rationale}`;
  });
}

function buildArtifactLines(
  artifacts: ReturnType<typeof normalizeArtifacts>,
): string[] {
  if (artifacts.length === 0) {
    return ["_No deterministic artifacts exported._"];
  }

  return artifacts.map((artifact) => {
    const qualifiers = [artifact.category, artifact.status]
      .filter((value): value is string => Boolean(value))
      .join(" / ");
    const prefix = qualifiers
      ? `${artifact.artifactType} (${qualifiers})`
      : artifact.artifactType;
    const path = artifact.path ? ` [${artifact.path}]` : "";
    return `- ${prefix}: ${artifact.summary}${path}`;
  });
}

function buildNarrativeSection(
  title: string,
  content: string | undefined,
  missingMessage: string,
): string[] {
  return [title, "", content?.trim() || missingMessage, ""];
}

function buildTrendLines(trends: HistoryTrend[]): string[] {
  if (trends.length === 0) {
    return [
      "_No recurring issue trends were found in the exported session set._",
    ];
  }

  return trends.map((trend) => {
    const hostList = trend.hosts.join(", ") || "n/a";
    return `- ${trend.issueKey}: ${trend.label} [${trend.blockerCategory}] (${trend.remediationState}, sessions ${trend.sessionCount}, attempts ${trend.attemptCount}, latest ${trend.latestOutcome}, hosts ${hostList})`;
  });
}

function buildSessionTrendLines(
  sessionId: string,
  trends: HistoryTrend[],
): string[] {
  const sessionTrends = trends
    .map((trend) => ({
      trend,
      session: trend.sessions.find(
        (session) => session.sessionId === sessionId,
      ),
    }))
    .filter(
      (
        value,
      ): value is {
        trend: HistoryTrend;
        session: HistoryTrend["sessions"][number];
      } => Boolean(value.session),
    );

  if (sessionTrends.length === 0) {
    return [
      "_No recurring trend context for this session in the exported session set._",
    ];
  }

  return sessionTrends.map(({ trend, session }) => {
    return `- ${trend.issueKey}: ${trend.label} [${trend.blockerCategory}] (${trend.remediationSummary}; exported sessions ${trend.sessionCount}, total attempts ${trend.attemptCount}, this session attempts ${session.attempts}, this session latest ${session.latestOutcome}, global latest ${trend.latestOutcome})`;
  });
}

function buildHistoryTrendsMarkdown(report: HistoryTrendReport): string {
  return [
    "# Export History Trends",
    "",
    `- Grouping: ${report.summary.groupBy}`,
    `- Total Trends: ${report.summary.totalTrends}`,
    `- Matching Sessions: ${report.summary.matchingSessions}`,
    `- Total Attempts: ${report.summary.totalAttempts}`,
    `- Active Blockers: ${report.summary.activeBlockers}`,
    `- Recovered Trends: ${report.summary.recoveredTrends}`,
    `- Regressed Trends: ${report.summary.regressedTrends}`,
    `- Failed Attempts: ${report.summary.byOutcome.failed}`,
    `- Succeeded Attempts: ${report.summary.byOutcome.succeeded}`,
    `- Other Attempts: ${report.summary.byOutcome.other}`,
    "",
    "## Recurring Issues",
    "",
    ...buildTrendLines(report.trends),
    "",
  ].join("\n");
}

function buildHandoffMarkdown(
  detail: SessionDetail,
  historyTrends: HistoryTrend[],
): string {
  const artifacts = normalizeArtifacts(detail.artifacts);
  const narratives = normalizeNarratives(detail.narratives);
  const decisions = normalizeDecisions(detail.decisions);
  const summary = buildSessionSummary(detail);
  const projectSummary = narratives.find(
    (narrative) => narrative.kind === "project-summary",
  )?.content;
  const handoff = narratives.find(
    (narrative) => narrative.kind === "handoff",
  )?.content;

  return [
    `# Session Handoff: ${summary.session.label}`,
    "",
    `- Session ID: ${summary.session.id}`,
    `- Host: ${summary.session.host}`,
    `- Status: ${summary.session.status}`,
    `- Started: ${summary.session.startedAt}`,
    `- Ended: ${summary.session.endedAt ?? "running"}`,
    `- Messages: ${summary.counts.messages}`,
    `- Timeline Events: ${summary.counts.timeline}`,
    `- Artifacts: ${summary.counts.artifacts}`,
    `- Narratives: ${summary.counts.narratives}`,
    `- Decisions: ${summary.counts.decisions}`,
    "",
    ...buildNarrativeSection(
      "## Project Summary",
      projectSummary,
      "_No project summary generated. Run reingest-session if needed._",
    ),
    ...buildNarrativeSection(
      "## Handoff Notes",
      handoff,
      "_No handoff narrative generated. Run reingest-session if needed._",
    ),
    "## Recurring Trend Context",
    "",
    ...buildSessionTrendLines(detail.session.id, historyTrends),
    "",
    "## Decisions",
    "",
    ...buildDecisionLines(decisions),
    "",
    "## Artifacts",
    "",
    ...buildArtifactLines(artifacts),
    "",
  ].join("\n");
}

function addTextFile(
  zip: JSZip,
  checksumEntries: string[],
  filePath: string,
  content: string,
): void {
  zip.file(filePath, content);
  const checksum = createHash("sha256").update(content).digest("hex");
  checksumEntries.push(`${checksum}  ${filePath}`);
}

function addJsonFile(
  zip: JSZip,
  checksumEntries: string[],
  filePath: string,
  content: unknown,
): void {
  addTextFile(zip, checksumEntries, filePath, JSON.stringify(content, null, 2));
}

function resolveSessionDetails(
  db: EvidenceDatabase,
  options: SessionExportOptions,
): {
  details: SessionDetail[];
  filters?: SessionExportFilters;
  selectionMode: "all" | "ids" | "filters";
} {
  const filters: SessionExportFilters = {
    query: options.query?.trim() || undefined,
    issueKey: options.issueKey?.trim() || undefined,
    host: options.host,
    status: options.status,
    groupBy: options.groupBy,
  };
  const hasFilters = Boolean(
    filters.query || filters.issueKey || filters.host || filters.status,
  );

  if (options.query !== undefined && !filters.query) {
    throw new Error("Query must not be empty");
  }

  if (options.issueKey !== undefined && !filters.issueKey) {
    throw new Error("issueKey must not be empty");
  }

  if (options.sessionIds && options.sessionIds.length > 0 && hasFilters) {
    throw new Error(
      "Cannot combine sessionIds with query/issueKey/host/status filters",
    );
  }

  if (options.sessionIds && options.sessionIds.length > 0) {
    const details: SessionDetail[] = [];
    const missing: string[] = [];

    for (const id of options.sessionIds) {
      const detail = db.getSessionDetail(id);
      if (detail) {
        details.push(detail);
      } else {
        missing.push(id);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Session IDs not found: ${missing.join(", ")}`);
    }

    return {
      details,
      selectionMode: "ids",
    };
  }

  if (hasFilters) {
    const details = filterSessionsByHistory(db, filters)
      .map((session) => db.getSessionDetail(session.id))
      .filter((detail): detail is SessionDetail => Boolean(detail));

    if (details.length === 0) {
      throw new Error("No sessions matched export filters");
    }

    return {
      details,
      filters,
      selectionMode: "filters",
    };
  }

  return {
    details: db
      .listSessions()
      .map((session) => db.getSessionDetail(session.id))
      .filter((detail): detail is SessionDetail => Boolean(detail)),
    selectionMode: "all",
  };
}

export async function exportSessions(
  db: EvidenceDatabase,
  options: SessionExportOptions = {},
): Promise<SessionExportResult> {
  return traceAsyncOperation(
    "history.export-sessions",
    {
      sessionIds: options.sessionIds?.length ?? 0,
      hasQuery: Boolean(options.query?.trim()),
      issueKey: options.issueKey?.trim() || undefined,
      host: options.host,
      status: options.status,
      groupBy: options.groupBy ?? "issue",
    },
    async () => {
      try {
        const resolved = resolveSessionDetails(db, options);
        const { details } = resolved;
        const estimatedSizeBytes = details.reduce(
          (total, detail) => total + estimateSessionDetailSize(detail),
          0,
        );
        const estimatedSizeMb = estimatedSizeBytes / (1024 * 1024);

        if (estimatedSizeMb > MAX_SESSION_EXPORT_SIZE_MB) {
          throw new Error(
            `Export size (${estimatedSizeMb.toFixed(1)}MB) exceeds limit (${MAX_SESSION_EXPORT_SIZE_MB}MB). Please export fewer sessions at once.`,
          );
        }

        const zip = new JSZip();
        const checksumEntries: string[] = [];
        const exportedSessionIds = details.map((detail) => detail.session.id);
        const historyTrends = buildHistoryTrendReport(db, {
          sessionIds: exportedSessionIds,
          groupBy: options.groupBy,
        });
        const historyHandoff = buildHistoryHandoffReport(db, {
          sessionIds: exportedSessionIds,
          groupBy: options.groupBy,
        });
        const sessionIndex = details.map((detail) => {
          const summary = buildSessionSummary(detail);
          return {
            id: summary.session.id,
            host: summary.session.host,
            label: summary.session.label,
            status: summary.session.status,
            startedAt: summary.session.startedAt,
            endedAt: summary.session.endedAt,
            counts: summary.counts,
          };
        });

        const manifest: SessionExportManifest = {
          version: SESSION_EXPORT_FORMAT_VERSION,
          exportDate: new Date().toISOString(),
          sessionCount: details.length,
          historyGrouping: options.groupBy ?? "issue",
          selection: {
            mode: resolved.selectionMode,
            ...(resolved.selectionMode === "ids"
              ? { sessionIds: details.map((detail) => detail.session.id) }
              : {}),
            ...(resolved.filters ? { filters: resolved.filters } : {}),
          },
          includedSections: [
            "sessions/index.json",
            "history-trends.json",
            "history-trends.md",
            "history-handoff.json",
            "history-handoff.md",
            "sessions/{id}/session.json",
            "sessions/{id}/messages.json",
            "sessions/{id}/timeline.json",
            "sessions/{id}/artifacts.json",
            "sessions/{id}/narratives.json",
            "sessions/{id}/decisions.json",
            "sessions/{id}/ingestion-runs.json",
            "sessions/{id}/handoff.md",
            "sessions/{id}/transcript.md",
          ],
        };

        addJsonFile(zip, checksumEntries, "manifest.json", manifest);
        addJsonFile(zip, checksumEntries, "sessions/index.json", sessionIndex);
        addJsonFile(zip, checksumEntries, "history-trends.json", historyTrends);
        addTextFile(
          zip,
          checksumEntries,
          "history-trends.md",
          buildHistoryTrendsMarkdown(historyTrends),
        );
        addJsonFile(
          zip,
          checksumEntries,
          "history-handoff.json",
          historyHandoff,
        );
        addTextFile(
          zip,
          checksumEntries,
          "history-handoff.md",
          historyHandoff.markdown,
        );

        for (const detail of details) {
          const baseDir = `sessions/${detail.session.id}`;
          addJsonFile(
            zip,
            checksumEntries,
            `${baseDir}/session.json`,
            buildSessionSummary(detail),
          );
          addJsonFile(
            zip,
            checksumEntries,
            `${baseDir}/messages.json`,
            detail.messages,
          );
          addJsonFile(
            zip,
            checksumEntries,
            `${baseDir}/timeline.json`,
            detail.timeline,
          );
          addJsonFile(
            zip,
            checksumEntries,
            `${baseDir}/artifacts.json`,
            normalizeArtifacts(detail.artifacts),
          );
          addJsonFile(
            zip,
            checksumEntries,
            `${baseDir}/narratives.json`,
            normalizeNarratives(detail.narratives),
          );
          addJsonFile(
            zip,
            checksumEntries,
            `${baseDir}/decisions.json`,
            normalizeDecisions(detail.decisions),
          );
          addJsonFile(
            zip,
            checksumEntries,
            `${baseDir}/ingestion-runs.json`,
            detail.ingestionRuns,
          );
          addTextFile(
            zip,
            checksumEntries,
            `${baseDir}/handoff.md`,
            buildHandoffMarkdown(detail, historyTrends.trends),
          );
          addTextFile(
            zip,
            checksumEntries,
            `${baseDir}/transcript.md`,
            buildTranscriptMarkdown(detail),
          );
        }

        addTextFile(
          zip,
          checksumEntries,
          "checksum.txt",
          [
            "SHA-256 Checksums",
            "=================",
            "",
            ...checksumEntries,
          ].join("\n"),
        );

        const zipData = await zip.generateAsync({
          type: "uint8array",
          compression: "DEFLATE",
          compressionOptions: { level: 9 },
        });
        const checksum = createHash("sha256").update(zipData).digest("hex");
        const filename = `session-export-${new Date().toISOString().split("T")[0]}-${randomUUID().slice(0, 8)}.zip`;

        return {
          filename,
          zipData,
          checksum,
          sessionCount: details.length,
          historyGrouping: options.groupBy ?? "issue",
          ...(resolved.filters ? { filters: resolved.filters } : {}),
          sessions: details.map((detail) => ({
            id: detail.session.id,
            host: detail.session.host,
            label: getSessionLabel(detail.session),
            status: detail.session.status,
            startedAt: detail.session.startedAt,
            endedAt: detail.session.endedAt,
          })),
        };
      } catch (error) {
        throw new Error(
          `Failed to export sessions: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    },
  );
}
