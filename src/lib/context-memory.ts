import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  buildHistoryHandoffReport,
  type HistoryHandoffReport,
} from "./history-handoff.js";
import {
  buildHistoryTrendReport,
  type HistoryTrendReport,
} from "./session-trends.js";
import { getSessionLabel, truncateSummary } from "./session-history.js";
import { parseArtifactMetadata } from "./session-artifacts.js";
import type {
  ContextLinkSource,
  ContextRecord,
  DecisionRecord,
  EvidenceDatabase,
  SessionHost,
  SessionRecord,
  SessionStatus,
} from "./storage/index.js";

const CONTEXT_STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "because",
  "browser",
  "build",
  "change",
  "changes",
  "check",
  "context",
  "continue",
  "coverage",
  "decision",
  "feature",
  "fix",
  "for",
  "from",
  "handoff",
  "implement",
  "in",
  "into",
  "is",
  "it",
  "its",
  "latest",
  "memory",
  "new",
  "of",
  "on",
  "or",
  "project",
  "review",
  "scope",
  "session",
  "ship",
  "should",
  "status",
  "story",
  "task",
  "tests",
  "that",
  "the",
  "this",
  "to",
  "update",
  "use",
  "we",
  "with",
  "work",
]);

export type ContextConfidence = "high" | "medium" | "low";

export interface ContextSessionSummary extends Record<string, unknown> {
  id: string;
  label: string;
  host: SessionHost;
  status: SessionStatus;
  startedAt: string;
  endedAt: string | null;
}

export interface ContextListItem extends Record<string, unknown> {
  id: string;
  label: string;
  workspaceKey: string;
  latestSessionId: string;
  latestSessionLabel: string;
  latestStartedAt: string;
  latestEndedAt: string | null;
  sessionCount: number;
  hosts: SessionHost[];
  statuses: SessionStatus[];
  confidence: ContextConfidence;
  confidenceScore: number;
  signals: string[];
}

export interface ContextDecisionItem extends Record<string, unknown> {
  decisionId: string;
  topic: string;
  sessionId: string;
  sessionLabel: string;
  title: string;
  summary: string;
  rationale: string | null;
  status: DecisionRecord["status"];
  createdAt: string;
}

export interface SupersededContextDecisionItem extends ContextDecisionItem {
  supersededByDecisionId: string | null;
  supersededByTitle: string | null;
}

export interface ContextChangeItem extends Record<string, unknown> {
  kind: "decision-updated" | "context-refreshed";
  summary: string;
  sessionId: string | null;
  sessionLabel: string | null;
  createdAt: string | null;
}

export interface ContextCurrentTruth extends Record<string, unknown> {
  summary: string;
  latestSessionId: string;
  latestSessionLabel: string;
  latestSummaryNarrative: string | null;
  latestHandoff: string | null;
  activeBlockers: string[];
  openQuestions: string[];
}

export interface ContextReport extends Record<string, unknown> {
  context: ContextListItem;
  currentTruth: ContextCurrentTruth;
  activeDecisions: ContextDecisionItem[];
  supersededDecisions: SupersededContextDecisionItem[];
  changeLog: ContextChangeItem[];
  sessions: ContextSessionSummary[];
  trends: HistoryTrendReport["trends"];
  handoff: Pick<HistoryHandoffReport, "summary" | "followUps" | "blockers">;
  markdown: string;
}

export interface ContextCandidate extends Record<string, unknown> {
  kind: "existing-context" | "new-context";
  contextId: string | null;
  label: string;
  workspaceKey: string;
  confidence: ContextConfidence;
  confidenceScore: number;
  reasons: string[];
  sessionIds: string[];
  latestSessionId: string | null;
  latestSessionLabel: string | null;
  preferred: boolean;
  confirmationRequired: boolean;
}

export interface ContextResolution extends Record<string, unknown> {
  mode: "linked" | "preferred" | "suggested" | "none";
  sessionId: string | null;
  cwd: string | null;
  confirmationRequired: boolean;
  recommendedAction:
    | "use-linked"
    | "use-preferred"
    | "confirm-existing"
    | "create-new-context"
    | "choose-candidate"
    | "none";
  linkedContextId: string | null;
  currentContext: ContextListItem | null;
  briefing: ContextReport | null;
  candidates: ContextCandidate[];
}

export interface ContextLinkMutationResult extends Record<string, unknown> {
  action: "confirmed" | "rejected" | "moved" | "merged" | "split" | "preferred";
  context: ContextListItem | null;
  affectedSessionIds: string[];
  contextId: string | null;
  mergedFromContextId: string | null;
}

interface SessionSignal {
  session: SessionRecord;
  workspaceKey: string;
  titleTokens: Set<string>;
  issueKeys: Set<string>;
  issueFamilies: Set<string>;
  issueLabels: string[];
  issueFamilyLabels: string[];
}

interface AggregatedSignal {
  workspaceKey: string;
  issueKeys: Set<string>;
  issueFamilies: Set<string>;
  anchorTokens: Set<string>;
  latestTokens: Set<string>;
  latestSession: SessionRecord | null;
  issueLabelCounts: Map<string, number>;
  issueFamilyLabelCounts: Map<string, number>;
  sessions: SessionRecord[];
}

interface AutoThread {
  workspaceKey: string;
  sessions: SessionRecord[];
  signals: Set<string>;
  confidence: ContextConfidence;
  confidenceScore: number;
}

interface DecisionTopicState {
  topic: string;
  representativeTokens: Set<string>;
  sharedTokens: Set<string>;
  decisions: ContextDecisionItem[];
}

interface ResolveContextOptions {
  sessionId?: string;
  cwd?: string;
  title?: string;
  host?: SessionHost;
}

interface ConfirmContextOptions {
  sessionIds: string[];
  contextId?: string;
  label?: string;
  setPreferred?: boolean;
  linkSource?: ContextLinkSource;
}

interface MoveContextOptions {
  sessionId: string;
  contextId?: string;
  label?: string;
  setPreferred?: boolean;
}

interface SplitContextOptions {
  contextId: string;
  sessionIds: string[];
  label?: string;
  setPreferred?: boolean;
}

function hashText(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 12);
}

function normalizeWorkspaceKey(value: string): string {
  const resolved = path.resolve(value.trim());
  try {
    return fs.realpathSync.native(resolved);
  } catch {
    return resolved;
  }
}

function normalizeWorkspaceFromSession(session: SessionRecord): string {
  return normalizeWorkspaceKey(
    session.projectRoot?.trim() || session.cwd.trim(),
  );
}

function tokenize(value: string | null | undefined): Set<string> {
  if (!value) {
    return new Set();
  }

  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9@/_-]+/i)
      .map((token) => token.trim())
      .filter(
        (token) =>
          token.length >= 3 &&
          !CONTEXT_STOPWORDS.has(token) &&
          !/^\d+$/.test(token),
      ),
  );
}

function countOverlap(left: Set<string>, right: Set<string>): number {
  let overlap = 0;
  for (const value of left) {
    if (right.has(value)) {
      overlap += 1;
    }
  }
  return overlap;
}

function incrementCounts(map: Map<string, number>, values: string[]): void {
  for (const value of values) {
    map.set(value, (map.get(value) ?? 0) + 1);
  }
}

function parseWorkspacePath(value: string): string {
  return normalizeWorkspaceKey(value);
}

function isSameWorkspace(target: string, candidate: string): boolean {
  return (
    target === candidate ||
    target.startsWith(`${candidate}${path.sep}`) ||
    candidate.startsWith(`${target}${path.sep}`)
  );
}

function collectSessionSignals(
  db: EvidenceDatabase,
  sessions: SessionRecord[],
): SessionSignal[] {
  const attemptsBySession = new Map<
    string,
    Array<{
      issueKey: string;
      issueLabel: string;
      issueFamilyKey: string | null;
      issueFamilyLabel: string | null;
    }>
  >();

  for (const attempt of db.querySessionTrendAttempts({
    sessionIds: sessions.map((session) => session.id),
  })) {
    const group = attemptsBySession.get(attempt.sessionId) ?? [];
    group.push({
      issueKey: attempt.issueKey,
      issueLabel: attempt.issueLabel,
      issueFamilyKey: attempt.issueFamilyKey,
      issueFamilyLabel: attempt.issueFamilyLabel,
    });
    attemptsBySession.set(attempt.sessionId, group);
  }

  return sessions.map((session) => {
    const attempts = attemptsBySession.get(session.id) ?? [];
    const artifactLabels: string[] = [];
    const artifactFamilyLabels: string[] = [];
    const issueKeys = new Set(attempts.map((attempt) => attempt.issueKey));
    const issueFamilies = new Set(
      attempts
        .map((attempt) => attempt.issueFamilyKey)
        .filter((value): value is string => Boolean(value)),
    );

    for (const artifact of db.getSessionArtifacts(session.id)) {
      const metadata = parseArtifactMetadata(artifact.metadata);
      if (metadata.issueKey) {
        issueKeys.add(metadata.issueKey);
        artifactLabels.push(metadata.issueLabel ?? metadata.issueKey);
      }
      if (metadata.issueFamilyKey) {
        issueFamilies.add(metadata.issueFamilyKey);
        artifactFamilyLabels.push(
          metadata.issueFamilyLabel ?? metadata.issueFamilyKey,
        );
      }
    }

    return {
      session,
      workspaceKey: normalizeWorkspaceFromSession(session),
      titleTokens: tokenize(session.title ?? ""),
      issueKeys,
      issueFamilies,
      issueLabels: [
        ...attempts
          .map((attempt) => attempt.issueLabel)
          .filter((value) => value.trim().length > 0),
        ...artifactLabels,
      ],
      issueFamilyLabels: [
        ...attempts
          .map((attempt) => attempt.issueFamilyLabel)
          .filter((value): value is string => Boolean(value?.trim())),
        ...artifactFamilyLabels,
      ],
    };
  });
}

function aggregateSignals(signals: SessionSignal[]): AggregatedSignal {
  const issueLabelCounts = new Map<string, number>();
  const issueFamilyLabelCounts = new Map<string, number>();
  const issueKeys = new Set<string>();
  const issueFamilies = new Set<string>();
  const sessions = signals
    .map((signal) => signal.session)
    .sort(
      (left, right) =>
        Date.parse(left.startedAt) - Date.parse(right.startedAt) ||
        left.id.localeCompare(right.id),
    );

  for (const signal of signals) {
    for (const issueKey of signal.issueKeys) {
      issueKeys.add(issueKey);
    }
    for (const issueFamily of signal.issueFamilies) {
      issueFamilies.add(issueFamily);
    }
    incrementCounts(issueLabelCounts, signal.issueLabels);
    incrementCounts(issueFamilyLabelCounts, signal.issueFamilyLabels);
  }

  const first = signals[0];
  const last = signals.at(-1) ?? first;

  return {
    workspaceKey: first?.workspaceKey ?? "",
    issueKeys,
    issueFamilies,
    anchorTokens: new Set(first?.titleTokens ?? []),
    latestTokens: new Set(last?.titleTokens ?? []),
    latestSession: sessions.at(-1) ?? null,
    issueLabelCounts,
    issueFamilyLabelCounts,
    sessions,
  };
}

function confidenceFromScore(score: number): ContextConfidence {
  if (score >= 10) {
    return "high";
  }
  if (score >= 6) {
    return "medium";
  }
  return "low";
}

function hasSemanticLinkReason(reasons: string[]): boolean {
  return reasons.some(
    (reason) =>
      reason === "shared issue keys" ||
      reason === "shared failure families" ||
      reason === "shared goal wording",
  );
}

function scoreSignalAgainstAggregate(options: {
  signal: Pick<
    SessionSignal,
    "workspaceKey" | "titleTokens" | "issueKeys" | "issueFamilies" | "session"
  >;
  aggregate: AggregatedSignal;
  preferred?: boolean;
}): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  if (
    isSameWorkspace(options.signal.workspaceKey, options.aggregate.workspaceKey)
  ) {
    score += 4;
    reasons.push("shared workspace");
  } else {
    return { score: 0, reasons: [] };
  }

  const issueOverlap = countOverlap(
    options.signal.issueKeys,
    options.aggregate.issueKeys,
  );
  if (issueOverlap > 0) {
    score += 8 + Math.min(issueOverlap, 2);
    reasons.push("shared issue keys");
  }

  const familyOverlap = countOverlap(
    options.signal.issueFamilies,
    options.aggregate.issueFamilies,
  );
  if (familyOverlap > 0) {
    score += 5 + Math.min(familyOverlap, 2);
    reasons.push("shared failure families");
  }

  const titleOverlap = Math.max(
    countOverlap(options.signal.titleTokens, options.aggregate.anchorTokens),
    countOverlap(options.signal.titleTokens, options.aggregate.latestTokens),
  );
  if (titleOverlap >= 2) {
    score += 3;
    reasons.push("shared goal wording");
  } else if (titleOverlap === 1) {
    score += 1;
  }

  if (options.aggregate.latestSession) {
    const latestTs = Date.parse(
      options.aggregate.latestSession.endedAt ??
        options.aggregate.latestSession.startedAt,
    );
    const currentTs = Date.parse(options.signal.session.startedAt);
    const gapHours = Math.max(currentTs - latestTs, 0) / (1000 * 60 * 60);
    if (gapHours <= 72) {
      score += 2;
      reasons.push("recent continuity");
    } else if (gapHours <= 24 * 14) {
      score += 1;
    }

    if (options.aggregate.latestSession.host === options.signal.session.host) {
      score += 1;
    }
  }

  if (options.preferred) {
    score += 4;
    reasons.push("preferred workspace context");
  }

  return { score, reasons };
}

function buildAutoThreads(
  db: EvidenceDatabase,
  sessions: SessionRecord[],
): AutoThread[] {
  const signals = collectSessionSignals(db, sessions).sort(
    (left, right) =>
      Date.parse(left.session.startedAt) -
        Date.parse(right.session.startedAt) ||
      left.session.id.localeCompare(right.session.id),
  );
  const threadsByWorkspace = new Map<
    string,
    Array<{
      signals: SessionSignal[];
      reasons: Set<string>;
      scores: number[];
    }>
  >();

  for (const signal of signals) {
    const workspaceThreads = threadsByWorkspace.get(signal.workspaceKey) ?? [];
    let bestThread: {
      signals: SessionSignal[];
      reasons: Set<string>;
      scores: number[];
    } | null = null;
    let bestScore = -1;
    let bestReasons: string[] = [];

    for (const thread of workspaceThreads) {
      const aggregate = aggregateSignals(thread.signals);
      const candidate = scoreSignalAgainstAggregate({
        signal,
        aggregate,
      });
      if (candidate.score > bestScore) {
        bestScore = candidate.score;
        bestThread = thread;
        bestReasons = candidate.reasons;
      }
    }

    if (!bestThread || bestScore < 5 || !hasSemanticLinkReason(bestReasons)) {
      workspaceThreads.push({
        signals: [signal],
        reasons: new Set(
          signal.issueKeys.size > 0 || signal.issueFamilies.size > 0
            ? ["shared workspace signals"]
            : ["isolated workspace activity"],
        ),
        scores: [],
      });
      threadsByWorkspace.set(signal.workspaceKey, workspaceThreads);
      continue;
    }

    bestThread.signals.push(signal);
    bestReasons.forEach((reason) => bestThread?.reasons.add(reason));
    bestThread.scores.push(bestScore);
  }

  return Array.from(threadsByWorkspace.values())
    .flat()
    .map((thread) => {
      const aggregate = aggregateSignals(thread.signals);
      const average =
        thread.scores.length > 0
          ? thread.scores.reduce((total, value) => total + value, 0) /
            thread.scores.length
          : 6;

      return {
        workspaceKey: aggregate.workspaceKey,
        sessions: aggregate.sessions,
        signals: new Set(thread.reasons),
        confidence: confidenceFromScore(average),
        confidenceScore: Number(average.toFixed(2)),
      };
    })
    .sort(
      (left, right) =>
        Date.parse(
          right.sessions.at(-1)?.startedAt ?? "1970-01-01T00:00:00.000Z",
        ) -
          Date.parse(
            left.sessions.at(-1)?.startedAt ?? "1970-01-01T00:00:00.000Z",
          ) || right.workspaceKey.localeCompare(left.workspaceKey),
    );
}

function buildContextListItem(
  context: ContextRecord,
  sessions: SessionRecord[],
  aggregate: AggregatedSignal,
): ContextListItem {
  const latestSession = aggregate.latestSession ?? sessions.at(-1);
  if (!latestSession) {
    throw new Error(`Context ${context.id} has no linked sessions`);
  }

  return {
    id: context.id,
    label: context.label,
    workspaceKey: aggregate.workspaceKey,
    latestSessionId: latestSession.id,
    latestSessionLabel: getSessionLabel(latestSession),
    latestStartedAt: latestSession.startedAt,
    latestEndedAt: latestSession.endedAt,
    sessionCount: sessions.length,
    hosts: [...new Set(sessions.map((session) => session.host))],
    statuses: [...new Set(sessions.map((session) => session.status))],
    confidence: "high",
    confidenceScore: 100,
    signals: [
      aggregate.issueKeys.size > 0
        ? "confirmed issue continuity"
        : "confirmed context",
      aggregate.issueFamilies.size > 0
        ? "failure-family continuity"
        : "workspace continuity",
    ],
  };
}

function sortDecisionChronologically<T extends ContextDecisionItem>(
  decisions: T[],
): T[] {
  return decisions
    .slice()
    .sort(
      (left, right) =>
        Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
        left.decisionId.localeCompare(right.decisionId),
    );
}

function resolveCurrentDecision(
  decisions: ContextDecisionItem[],
): ContextDecisionItem | null {
  const chronological = sortDecisionChronologically(decisions);
  const accepted = chronological.filter(
    (decision) => decision.status === "accepted",
  );
  if (accepted.length > 0) {
    return accepted.at(-1) ?? null;
  }

  const open = chronological.filter(
    (decision) => decision.status !== "rejected",
  );
  return open.at(-1) ?? null;
}

function resolveDecisionTopics(
  decisions: ContextDecisionItem[],
): DecisionTopicState[] {
  const topics: DecisionTopicState[] = [];

  for (const decision of sortDecisionChronologically(decisions)) {
    const tokens = tokenize([decision.title, decision.summary].join(" "));
    let bestTopic: DecisionTopicState | null = null;
    let bestOverlap = 0;

    for (const topic of topics) {
      const overlap = Math.max(
        countOverlap(tokens, topic.representativeTokens),
        countOverlap(tokens, topic.sharedTokens),
      );
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestTopic = topic;
      }
    }

    if (!bestTopic || bestOverlap < 2) {
      topics.push({
        topic: truncateSummary(decision.title, 80),
        representativeTokens: new Set(tokens),
        sharedTokens: new Set(tokens),
        decisions: [decision],
      });
      continue;
    }

    bestTopic.decisions.push(decision);
    bestTopic.representativeTokens = new Set(tokens);
    bestTopic.sharedTokens = new Set(
      [...bestTopic.sharedTokens].filter((token) => tokens.has(token)),
    );
    bestTopic.topic = truncateSummary(decision.title, 80);
  }

  return topics;
}

function buildDecisionLineage(decisions: ContextDecisionItem[]): {
  activeDecisions: ContextDecisionItem[];
  supersededDecisions: SupersededContextDecisionItem[];
  changeLog: ContextChangeItem[];
} {
  const activeDecisions: ContextDecisionItem[] = [];
  const supersededDecisions: SupersededContextDecisionItem[] = [];
  const changeLog: ContextChangeItem[] = [];

  for (const topic of resolveDecisionTopics(decisions)) {
    const current = resolveCurrentDecision(topic.decisions);
    if (!current) {
      continue;
    }

    activeDecisions.push({
      ...current,
      topic: topic.topic,
    });

    const superseded = topic.decisions
      .filter((decision) => decision.decisionId !== current.decisionId)
      .map((decision) => ({
        ...decision,
        topic: topic.topic,
        supersededByDecisionId: current.decisionId,
        supersededByTitle: current.title,
      }));
    supersededDecisions.push(...superseded);

    if (superseded.length > 0) {
      const latestSuperseded = sortDecisionChronologically(superseded).at(-1)!;
      changeLog.push({
        kind: "decision-updated",
        summary: `Decision updated in ${topic.topic}: ${truncateSummary(latestSuperseded.title, 72)} -> ${truncateSummary(current.title, 72)}`,
        sessionId: current.sessionId,
        sessionLabel: current.sessionLabel,
        createdAt: current.createdAt,
      });
    }
  }

  return {
    activeDecisions: sortDecisionChronologically(activeDecisions).reverse(),
    supersededDecisions:
      sortDecisionChronologically(supersededDecisions).reverse(),
    changeLog: changeLog.sort(
      (left, right) =>
        Date.parse(right.createdAt ?? "1970-01-01T00:00:00.000Z") -
          Date.parse(left.createdAt ?? "1970-01-01T00:00:00.000Z") ||
        right.summary.localeCompare(left.summary),
    ),
  };
}

function buildContextMarkdown(report: ContextReport): string {
  return [
    `# Context Briefing: ${report.context.label}`,
    "",
    `- Context ID: ${report.context.id}`,
    `- Workspace: ${report.context.workspaceKey}`,
    `- Sessions: ${report.context.sessionCount}`,
    `- Latest Session: ${report.context.latestSessionLabel}`,
    "",
    "## Current Truth",
    "",
    report.currentTruth.summary,
    "",
    "## Active Blockers",
    "",
    ...(report.currentTruth.activeBlockers.length > 0
      ? report.currentTruth.activeBlockers.map((item) => `- ${item}`)
      : ["_No active blockers detected in this context._"]),
    "",
    "## Open Questions",
    "",
    ...(report.currentTruth.openQuestions.length > 0
      ? report.currentTruth.openQuestions.map((item) => `- ${item}`)
      : ["_No open questions detected in this context._"]),
    "",
    "## Active Decisions",
    "",
    ...(report.activeDecisions.length > 0
      ? report.activeDecisions.map(
          (decision) =>
            `- [${decision.status}] ${decision.title} (${decision.sessionLabel})`,
        )
      : ["_No active decisions extracted yet._"]),
    "",
    "## Superseded Decisions",
    "",
    ...(report.supersededDecisions.length > 0
      ? report.supersededDecisions.map(
          (decision) =>
            `- [${decision.status}] ${decision.title} -> ${decision.supersededByTitle ?? "replaced later"}`,
        )
      : ["_No superseded decisions detected._"]),
    "",
    "## Recent Sessions",
    "",
    ...report.sessions.map(
      (session) =>
        `- ${session.label} (${session.host}, ${session.status}, ${session.startedAt})`,
    ),
    "",
  ].join("\n");
}

function buildCurrentTruthSummary(options: {
  context: ContextListItem;
  latestSummaryNarrative: string | null;
  latestHandoff: string | null;
  activeDecisions: ContextDecisionItem[];
  trendReport: HistoryTrendReport;
}): string {
  const activeDecisionSummary =
    options.activeDecisions.length > 0
      ? options.activeDecisions
          .slice(0, 3)
          .map((decision) => decision.title)
          .join(" | ")
      : "No active decisions extracted yet.";
  const narrative =
    options.latestHandoff ?? options.latestSummaryNarrative ?? null;
  const narrativeSummary = narrative
    ? truncateSummary(narrative.replace(/\s+/g, " "), 280)
    : `Latest known direction comes from ${options.context.latestSessionLabel}.`;
  const blockerSummary =
    options.trendReport.summary.activeBlockers > 0
      ? `${options.trendReport.summary.activeBlockers} active blocker(s) remain in this context.`
      : "No active blockers are currently detected in this context.";

  return [
    narrativeSummary,
    blockerSummary,
    `Active decisions: ${activeDecisionSummary}`,
  ].join(" ");
}

function buildContextReportFromSessions(
  db: EvidenceDatabase,
  context: ContextListItem,
  sessions: SessionRecord[],
): ContextReport {
  const sessionSummaries = sessions
    .slice()
    .sort(
      (left, right) =>
        Date.parse(right.startedAt) - Date.parse(left.startedAt) ||
        right.id.localeCompare(left.id),
    )
    .map((session) => ({
      id: session.id,
      label: getSessionLabel(session),
      host: session.host,
      status: session.status,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    }));

  const details = sessions
    .map((session) => db.getSessionDetail(session.id))
    .filter((detail): detail is NonNullable<typeof detail> => Boolean(detail));
  const latestWithNarratives =
    details
      .slice()
      .sort(
        (left, right) =>
          Date.parse(right.session.startedAt) -
            Date.parse(left.session.startedAt) ||
          right.session.id.localeCompare(left.session.id),
      )
      .find((detail) => detail.narratives.length > 0) ?? null;
  const latestSummaryNarrative =
    latestWithNarratives?.narratives.find(
      (narrative) => narrative.kind === "project-summary",
    )?.content ?? null;
  const latestHandoff =
    latestWithNarratives?.narratives.find(
      (narrative) => narrative.kind === "handoff",
    )?.content ?? null;

  const decisions = details.flatMap((detail) =>
    detail.decisions.map((decision) => ({
      decisionId: decision.id,
      topic: truncateSummary(decision.title, 80),
      sessionId: detail.session.id,
      sessionLabel: getSessionLabel(detail.session),
      title: decision.title,
      summary: decision.summary,
      rationale: decision.rationale,
      status: decision.status,
      createdAt: decision.createdAt,
    })),
  );
  const decisionLineage = buildDecisionLineage(decisions);
  const sessionIds = sessions.map((session) => session.id);
  const trendReport = buildHistoryTrendReport(db, { sessionIds });
  const handoff = buildHistoryHandoffReport(db, { sessionIds });

  const currentTruth: ContextCurrentTruth = {
    summary: buildCurrentTruthSummary({
      context,
      latestSummaryNarrative,
      latestHandoff,
      activeDecisions: decisionLineage.activeDecisions,
      trendReport,
    }),
    latestSessionId: context.latestSessionId,
    latestSessionLabel: context.latestSessionLabel,
    latestSummaryNarrative,
    latestHandoff,
    activeBlockers: handoff.blockers,
    openQuestions: handoff.followUps,
  };

  const report: ContextReport = {
    context,
    currentTruth,
    activeDecisions: decisionLineage.activeDecisions,
    supersededDecisions: decisionLineage.supersededDecisions,
    changeLog: [
      {
        kind: "context-refreshed",
        summary: `Latest known context state comes from ${context.latestSessionLabel}.`,
        sessionId: context.latestSessionId,
        sessionLabel: context.latestSessionLabel,
        createdAt: context.latestStartedAt,
      },
      ...decisionLineage.changeLog,
    ],
    sessions: sessionSummaries,
    trends: trendReport.trends,
    handoff: {
      summary: handoff.summary,
      followUps: handoff.followUps,
      blockers: handoff.blockers,
    },
    markdown: "",
  };
  report.markdown = buildContextMarkdown(report);
  return report;
}

function buildCanonicalContextStates(db: EvidenceDatabase): Array<{
  record: ContextRecord;
  item: ContextListItem;
  sessions: SessionRecord[];
  aggregate: AggregatedSignal;
}> {
  return db
    .listContexts()
    .map((context) => {
      const sessions = db.listSessionsForContext(context.id);
      if (sessions.length === 0) {
        return null;
      }
      const aggregate = aggregateSignals(collectSessionSignals(db, sessions));
      return {
        record: context,
        item: buildContextListItem(context, sessions, aggregate),
        sessions,
        aggregate,
      };
    })
    .filter(
      (
        value,
      ): value is {
        record: ContextRecord;
        item: ContextListItem;
        sessions: SessionRecord[];
        aggregate: AggregatedSignal;
      } => Boolean(value),
    );
}

function buildSyntheticSignal(input: {
  cwd: string;
  title?: string;
  host?: SessionHost;
}): SessionSignal {
  const now = new Date().toISOString();
  const session: SessionRecord = {
    id: "synthetic",
    host: input.host ?? "claude",
    projectRoot: input.cwd,
    cwd: input.cwd,
    title: input.title ?? null,
    status: "running",
    startedAt: now,
    endedAt: null,
    metadata: null,
    createdAt: now,
    updatedAt: now,
  };

  return {
    session,
    workspaceKey: parseWorkspacePath(input.cwd),
    titleTokens: tokenize(input.title ?? ""),
    issueKeys: new Set(),
    issueFamilies: new Set(),
    issueLabels: [],
    issueFamilyLabels: [],
  };
}

function buildContextCandidate(
  context: ContextListItem,
  sessions: SessionRecord[],
  score: number,
  reasons: string[],
  preferred: boolean,
): ContextCandidate {
  return {
    kind: "existing-context",
    contextId: context.id,
    label: context.label,
    workspaceKey: context.workspaceKey,
    confidence: confidenceFromScore(score),
    confidenceScore: Number(score.toFixed(2)),
    reasons,
    sessionIds: sessions.map((session) => session.id),
    latestSessionId: context.latestSessionId,
    latestSessionLabel: context.latestSessionLabel,
    preferred,
    confirmationRequired: true,
  };
}

function buildNewContextCandidate(thread: AutoThread): ContextCandidate {
  const latestSession = thread.sessions.at(-1) ?? null;
  const label =
    latestSession?.title ??
    latestSession?.id ??
    `Context ${hashText(thread.workspaceKey)}`;
  return {
    kind: "new-context",
    contextId: null,
    label: truncateSummary(label, 120),
    workspaceKey: thread.workspaceKey,
    confidence: thread.confidence,
    confidenceScore: thread.confidenceScore,
    reasons: [...thread.signals],
    sessionIds: thread.sessions.map((session) => session.id),
    latestSessionId: latestSession?.id ?? null,
    latestSessionLabel: latestSession ? getSessionLabel(latestSession) : null,
    preferred: false,
    confirmationRequired: true,
  };
}

export function listContexts(db: EvidenceDatabase): {
  contexts: ContextListItem[];
  total: number;
} {
  const contexts = buildCanonicalContextStates(db)
    .map((state) => state.item)
    .sort(
      (left, right) =>
        Date.parse(right.latestStartedAt) - Date.parse(left.latestStartedAt) ||
        right.id.localeCompare(left.id),
    );
  return {
    contexts,
    total: contexts.length,
  };
}

export function getContextReport(
  db: EvidenceDatabase,
  contextId: string,
): ContextReport {
  const state = buildCanonicalContextStates(db).find(
    (candidate) => candidate.item.id === contextId,
  );
  if (!state) {
    throw new Error(`Context not found: ${contextId}`);
  }

  return buildContextReportFromSessions(db, state.item, state.sessions);
}

export function resolveContext(
  db: EvidenceDatabase,
  options: ResolveContextOptions,
): ContextResolution {
  const canonicalStates = buildCanonicalContextStates(db);
  const byId = new Map(canonicalStates.map((state) => [state.item.id, state]));

  if (options.sessionId) {
    const linked = db.findContextLinkForSession(options.sessionId);
    if (linked) {
      const linkedContext = byId.get(linked.contextId);
      if (!linkedContext) {
        throw new Error(`Linked context not found: ${linked.contextId}`);
      }

      return {
        mode: "linked",
        sessionId: options.sessionId,
        cwd: linkedContext.item.workspaceKey,
        confirmationRequired: false,
        recommendedAction: "use-linked",
        linkedContextId: linkedContext.item.id,
        currentContext: linkedContext.item,
        briefing: buildContextReportFromSessions(
          db,
          linkedContext.item,
          linkedContext.sessions,
        ),
        candidates: [],
      };
    }
  }

  const baseSignal = options.sessionId
    ? (() => {
        const session = db.findSessionById(options.sessionId!);
        if (!session) {
          throw new Error(`Session not found: ${options.sessionId}`);
        }
        return collectSessionSignals(db, [session])[0]!;
      })()
    : options.cwd
      ? buildSyntheticSignal({
          cwd: options.cwd,
          title: options.title,
          host: options.host,
        })
      : null;

  if (!baseSignal) {
    throw new Error("resolve-context requires sessionId or cwd");
  }

  const workspaceKey = baseSignal.workspaceKey;
  const preferred = db.getWorkspacePreferredContext(workspaceKey);
  const rejectedContextIds = options.sessionId
    ? new Set(
        db
          .listContextRejectionsForSession(options.sessionId)
          .map((record) => record.contextId),
      )
    : new Set<string>();

  const candidates = canonicalStates
    .filter((state) =>
      isSameWorkspace(workspaceKey, state.aggregate.workspaceKey),
    )
    .filter((state) => !rejectedContextIds.has(state.item.id))
    .map((state) => {
      const score = scoreSignalAgainstAggregate({
        signal: baseSignal,
        aggregate: state.aggregate,
        preferred: preferred?.contextId === state.item.id,
      });
      return {
        state,
        ...score,
      };
    })
    .filter(
      (candidate) =>
        candidate.score >= 4 &&
        (!options.sessionId || hasSemanticLinkReason(candidate.reasons)),
    )
    .sort(
      (left, right) =>
        right.score - left.score ||
        Date.parse(right.state.item.latestStartedAt) -
          Date.parse(left.state.item.latestStartedAt) ||
        right.state.item.id.localeCompare(left.state.item.id),
    )
    .slice(0, 3)
    .map((candidate) =>
      buildContextCandidate(
        candidate.state.item,
        candidate.state.sessions,
        candidate.score,
        candidate.reasons,
        preferred?.contextId === candidate.state.item.id,
      ),
    );

  if (!options.sessionId && preferred) {
    const preferredContext = byId.get(preferred.contextId);
    const preferredCandidate =
      candidates.find(
        (candidate) => candidate.contextId === preferred.contextId,
      ) ?? null;
    const canAutoUsePreferred =
      preferredContext !== undefined &&
      preferredCandidate !== null &&
      hasSemanticLinkReason(preferredCandidate.reasons) &&
      !candidates.some(
        (candidate) =>
          candidate.contextId !== preferred.contextId &&
          candidate.confidenceScore >= preferredCandidate.confidenceScore &&
          hasSemanticLinkReason(candidate.reasons),
      );
    if (preferredContext && canAutoUsePreferred) {
      return {
        mode: "preferred",
        sessionId: null,
        cwd: workspaceKey,
        confirmationRequired: false,
        recommendedAction: "use-preferred",
        linkedContextId: preferredContext.item.id,
        currentContext: preferredContext.item,
        briefing: buildContextReportFromSessions(
          db,
          preferredContext.item,
          preferredContext.sessions,
        ),
        candidates,
      };
    }
  }

  const autoThreadCandidate = options.sessionId
    ? (() => {
        const thread = buildAutoThreads(
          db,
          db.listUnlinkedSessions({ workspaceKey }),
        ).find((candidate) =>
          candidate.sessions.some(
            (session) => session.id === options.sessionId,
          ),
        );
        return thread ? buildNewContextCandidate(thread) : null;
      })()
    : (() => {
        const thread = buildAutoThreads(
          db,
          db.listUnlinkedSessions({ workspaceKey }),
        )[0];
        return thread && isSameWorkspace(workspaceKey, thread.workspaceKey)
          ? buildNewContextCandidate(thread)
          : null;
      })();

  const allCandidates = autoThreadCandidate
    ? [...candidates, autoThreadCandidate]
    : candidates;

  if (allCandidates.length === 0) {
    return {
      mode: "none",
      sessionId: options.sessionId ?? null,
      cwd: workspaceKey,
      confirmationRequired: true,
      recommendedAction: "create-new-context",
      linkedContextId: null,
      currentContext: null,
      briefing: null,
      candidates: [],
    };
  }

  const top = allCandidates[0]!;
  const briefing =
    top.kind === "existing-context" && top.contextId
      ? (() => {
          const state = byId.get(top.contextId);
          return state
            ? buildContextReportFromSessions(db, state.item, state.sessions)
            : null;
        })()
      : null;

  return {
    mode: "suggested",
    sessionId: options.sessionId ?? null,
    cwd: workspaceKey,
    confirmationRequired: true,
    recommendedAction:
      top.kind === "existing-context" &&
      top.confidence === "high" &&
      hasSemanticLinkReason(top.reasons)
        ? "confirm-existing"
        : top.kind === "new-context"
          ? "create-new-context"
          : "choose-candidate",
    linkedContextId: null,
    currentContext: null,
    briefing,
    candidates: allCandidates,
  };
}

export function confirmContextLink(
  db: EvidenceDatabase,
  options: ConfirmContextOptions,
): ContextLinkMutationResult {
  const normalizedSessionIds = [
    ...new Set(options.sessionIds.map((id) => id.trim()).filter(Boolean)),
  ];
  if (normalizedSessionIds.length === 0) {
    throw new Error("At least one sessionId is required");
  }

  const firstSession = db.findSessionById(normalizedSessionIds[0]!);
  if (!firstSession) {
    throw new Error(`Session not found: ${normalizedSessionIds[0]}`);
  }

  const context =
    options.contextId !== undefined
      ? db.resolveContextById(options.contextId)
      : db.createContext({
          label:
            options.label?.trim() ||
            firstSession.title ||
            getSessionLabel(firstSession),
          workspaceKey: normalizeWorkspaceFromSession(firstSession),
          metadata: JSON.stringify({
            createdFrom: "confirm-context-link",
          }),
        });

  if (!context) {
    throw new Error(`Context not found: ${options.contextId}`);
  }

  for (const sessionId of normalizedSessionIds) {
    db.assignSessionToContext({
      sessionId,
      contextId: context.id,
      linkSource: options.linkSource ?? "confirmed",
    });
  }

  if (options.setPreferred) {
    db.setWorkspacePreferredContext(context.workspaceKey, context.id);
  }

  return {
    action: "confirmed",
    context: getContextReport(db, context.id).context,
    affectedSessionIds: normalizedSessionIds,
    contextId: context.id,
    mergedFromContextId: null,
  };
}

export function rejectContextLink(
  db: EvidenceDatabase,
  sessionId: string,
  contextId: string,
): ContextLinkMutationResult {
  const rejection = db.rejectContextForSession(sessionId, contextId);
  return {
    action: "rejected",
    context: null,
    affectedSessionIds: [rejection.sessionId],
    contextId: rejection.contextId,
    mergedFromContextId: null,
  };
}

export function moveSessionContext(
  db: EvidenceDatabase,
  options: MoveContextOptions,
): ContextLinkMutationResult {
  const session = db.findSessionById(options.sessionId);
  if (!session) {
    throw new Error(`Session not found: ${options.sessionId}`);
  }

  const context =
    options.contextId !== undefined
      ? db.resolveContextById(options.contextId)
      : db.createContext({
          label:
            options.label?.trim() || session.title || getSessionLabel(session),
          workspaceKey: normalizeWorkspaceFromSession(session),
          metadata: JSON.stringify({
            createdFrom: "move-session-context",
          }),
        });

  if (!context) {
    throw new Error(`Context not found: ${options.contextId}`);
  }

  db.assignSessionToContext({
    sessionId: session.id,
    contextId: context.id,
    linkSource: "moved",
  });

  if (options.setPreferred) {
    db.setWorkspacePreferredContext(context.workspaceKey, context.id);
  }

  return {
    action: "moved",
    context: getContextReport(db, context.id).context,
    affectedSessionIds: [session.id],
    contextId: context.id,
    mergedFromContextId: null,
  };
}

export function mergeContexts(
  db: EvidenceDatabase,
  sourceContextId: string,
  targetContextId: string,
): ContextLinkMutationResult {
  db.mergeContexts(sourceContextId, targetContextId);
  const target = db.resolveContextById(targetContextId);
  if (!target) {
    throw new Error(`Context not found: ${targetContextId}`);
  }

  return {
    action: "merged",
    context: getContextReport(db, target.id).context,
    affectedSessionIds: db
      .listSessionsForContext(target.id)
      .map((session) => session.id),
    contextId: target.id,
    mergedFromContextId: sourceContextId,
  };
}

export function splitContext(
  db: EvidenceDatabase,
  options: SplitContextOptions,
): ContextLinkMutationResult {
  const source = db.resolveContextById(options.contextId);
  if (!source) {
    throw new Error(`Context not found: ${options.contextId}`);
  }

  const sessions = options.sessionIds
    .map((sessionId) => db.findSessionById(sessionId))
    .filter((session): session is SessionRecord => Boolean(session));
  if (sessions.length === 0) {
    throw new Error("At least one valid session is required for split");
  }

  const next = db.createContext({
    label:
      options.label?.trim() ||
      sessions.at(-1)?.title ||
      `${source.label} split`,
    workspaceKey: normalizeWorkspaceFromSession(sessions[0]!),
    metadata: JSON.stringify({
      createdFrom: "split-context",
      sourceContextId: source.id,
    }),
  });

  for (const session of sessions) {
    db.assignSessionToContext({
      sessionId: session.id,
      contextId: next.id,
      linkSource: "split",
    });
  }

  if (options.setPreferred) {
    db.setWorkspacePreferredContext(next.workspaceKey, next.id);
  }

  return {
    action: "split",
    context: getContextReport(db, next.id).context,
    affectedSessionIds: sessions.map((session) => session.id),
    contextId: next.id,
    mergedFromContextId: source.id,
  };
}

export function setActiveContext(
  db: EvidenceDatabase,
  contextId: string,
  cwd?: string,
): ContextLinkMutationResult {
  const context = db.resolveContextById(contextId);
  if (!context) {
    throw new Error(`Context not found: ${contextId}`);
  }

  db.setWorkspacePreferredContext(
    cwd ? parseWorkspacePath(cwd) : normalizeWorkspaceKey(context.workspaceKey),
    context.id,
  );

  return {
    action: "preferred",
    context: getContextReport(db, context.id).context,
    affectedSessionIds: [],
    contextId: context.id,
    mergedFromContextId: null,
  };
}
