export interface SessionDashboardRow {
  id: string;
  host: string;
  label: string;
  status: string;
  startedAt: string;
}

export interface HistorySearchResultView {
  sessionId: string;
  host: string;
  label: string;
  status: string;
  startedAt: string;
  snippets: string[];
}

export interface HistoryTrendSessionView {
  sessionId: string;
  label: string;
  host: string;
  status: string;
  attempts: number;
  latestOutcome: string;
}

export interface HistoryTrendView {
  groupBy: "issue" | "family";
  issueKey: string;
  label: string;
  kind: string | null;
  relatedIssueKeys: string[];
  blockerCategory: string;
  blockerState: "active" | "resolved";
  remediationState: "unresolved" | "recovered" | "regressed" | "stable";
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
  hosts: string[];
  sessions: HistoryTrendSessionView[];
}

export interface HistoryHandoffSessionView {
  id: string;
  label: string;
  host: string;
  status: string;
  startedAt: string;
}

export interface HistoryHandoffView {
  blockers: string[];
  recoveries?: string[];
  followUps: string[];
  recentSessions: HistoryHandoffSessionView[];
}

export interface SessionMessageView {
  seq: number;
  role: string;
  content: string;
}

export interface SessionTimelineView {
  seq: number;
  eventType: string;
  summary: string | null;
}

export interface SessionNarrativeView {
  kind: string;
  content: string;
}

export interface SessionDecisionView {
  title: string;
  status: string;
  summary: string;
}

export interface SessionArtifactView {
  artifactType: string;
  summary: string;
  category: string | null;
  status: string | null;
  path: string | null;
  dependencyAction?: string | null;
  dependencyNames?: string[];
  failureSignatureLabel?: string | null;
  errorCode?: string | null;
  lintRuleId?: string | null;
  testSuite?: string | null;
  testCase?: string | null;
  changeScope?: string | null;
  manifestKind?: string | null;
}

export interface SessionTrendContextView {
  issueKey: string;
  label: string;
  kind: string | null;
  issueFamilyKey: string | null;
  issueFamilyLabel: string | null;
  relatedIssueKeys: string[];
  blockerCategory: string;
  blockerState: "active" | "resolved";
  remediationState: "unresolved" | "recovered" | "regressed" | "stable";
  remediationSummary: string;
  lastSeenAt: string;
  latestFailureAt: string | null;
  latestSuccessAt: string | null;
  sessionCount: number;
  sessionAttempts: number;
  globalAttempts: number;
  sessionLatestOutcome: string;
  latestOutcome: string;
  hosts: string[];
  relatedSessionCount: number;
  relatedSessions: Array<{
    sessionId: string;
    label: string;
    host: string;
    status: string;
    lastAttemptAt: string;
    attempts: number;
    latestOutcome: string;
  }>;
}

export interface ContextListItemView {
  id: string;
  label: string;
  workspaceKey: string;
  latestSessionId: string;
  latestSessionLabel: string;
  latestStartedAt: string;
  latestEndedAt: string | null;
  sessionCount: number;
  hosts: string[];
  statuses: string[];
  confidence: "high" | "medium" | "low";
  confidenceScore: number;
  signals: string[];
}

export interface ContextDecisionSummaryView {
  decisionId: string;
  title: string;
  summary: string;
  status: string;
  createdAt: string;
  supersededByTitle?: string | null;
}

export interface ContextReportView {
  context: ContextListItemView;
  currentTruth: {
    summary: string;
    latestSessionId: string;
    latestSessionLabel: string;
    latestSummaryNarrative: string | null;
    latestHandoff: string | null;
    activeBlockers: string[];
    openQuestions: string[];
  };
  activeDecisions: ContextDecisionSummaryView[];
  supersededDecisions: ContextDecisionSummaryView[];
  sessions: Array<{
    id: string;
    label: string;
    host: string;
    status: string;
    startedAt: string;
    endedAt: string | null;
  }>;
}

export interface ContextCandidateView {
  kind: "existing-context" | "new-context";
  contextId: string | null;
  label: string;
  workspaceKey: string;
  confidence: "high" | "medium" | "low";
  confidenceScore: number;
  reasons: string[];
  sessionIds: string[];
  latestSessionId: string | null;
  latestSessionLabel: string | null;
  preferred: boolean;
  confirmationRequired: boolean;
}

const STATUS_CLASS_BY_VALUE: Record<string, string> = {
  completed: "completed",
  failed: "failed",
  interrupted: "interrupted",
  running: "running",
};

const STATUS_LABEL_BY_VALUE: Record<string, string> = {
  completed: "Done",
  failed: "Needs Attention",
  interrupted: "Stopped",
  running: "In Progress",
};

const ROLE_LABEL_BY_VALUE: Record<string, string> = {
  user: "You",
  assistant: "AI",
  system: "System",
};

const ARTIFACT_LABEL_BY_TYPE: Record<string, string> = {
  "file-change": "File Change",
  "command-output": "Command Run",
  "test-result": "Test Result",
  "git-commit": "Saved Change",
};

const NARRATIVE_LABEL_BY_KIND: Record<string, string> = {
  "project-summary": "Big-Picture Summary",
  handoff: "What To Know Next",
};

const DECISION_STATUS_LABEL_BY_VALUE: Record<string, string> = {
  active: "Current",
  accepted: "Current",
  superseded: "Replaced",
  pending: "Open",
  rejected: "Not Chosen",
};

function translateWithFallback(
  key: string,
  fallback: string,
  variables?: Record<string, string | number>,
): string {
  const translated = t(key, variables);
  return translated === key ? fallback : translated;
}

const EVENT_LABEL_BY_TYPE: Record<string, string> = {
  "session.start": "Work started",
  "session.end": "Work ended",
  "session.started": "Work started",
  "session.completed": "Work finished",
  "session.failed": "Work ended with a problem",
  "session.interrupted": "Work stopped early",
  "message.user": "You sent a message",
  "message.user.submitted": "You sent a message",
  "message.assistant": "AI replied",
  "message.assistant.completed": "AI finished replying",
  "command.started": "A command started",
  "command.completed": "A command finished",
  "command.failed": "A command failed",
  "test.completed": "A test run finished",
  "error.observed": "A problem was noticed",
  "file.changed": "A file changed",
  "git.commit": "A saved change was created",
  "tool.started": "An AI tool started",
  "context.resolved": "A topic was suggested",
  "context.updated": "The topic link was updated",
};

function renderMultilineText(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

function buildListHtml(items: string[], emptyMessage: string): string {
  if (items.length === 0) {
    return `<li class="muted">${escapeHtml(emptyMessage)}</li>`;
  }

  return items.map((item) => `<li>${item}</li>`).join("");
}

function stripAnsiAndControlSequences(value: string): string {
  let sanitized = "";

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);

    if (code === 0x1b) {
      const next = value.charCodeAt(index + 1);

      if (next === 0x5b) {
        index += 2;
        while (index < value.length) {
          const sequenceCode = value.charCodeAt(index);
          if (sequenceCode >= 0x40 && sequenceCode <= 0x7e) {
            break;
          }
          index += 1;
        }
        continue;
      }

      if (next === 0x5d) {
        index += 2;
        while (index < value.length) {
          const sequenceCode = value.charCodeAt(index);
          if (sequenceCode === 0x07) {
            break;
          }
          if (sequenceCode === 0x1b && value.charCodeAt(index + 1) === 0x5c) {
            index += 1;
            break;
          }
          index += 1;
        }
        continue;
      }

      continue;
    }

    const isControlCharacter =
      (code >= 0x00 && code <= 0x08) ||
      (code >= 0x0b && code <= 0x0c) ||
      (code >= 0x0e && code <= 0x1f) ||
      (code >= 0x7f && code <= 0x9f);

    if (!isControlCharacter) {
      sanitized += value.charAt(index);
    }
  }

  return sanitized;
}

function hasDisplayText(value: string): boolean {
  return stripAnsiAndControlSequences(value).trim().length > 0;
}

export function escapeHtml(value: string): string {
  return stripAnsiAndControlSequences(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildErrorHtml(message: string): string {
  return `<div class="error">${escapeHtml(message)}</div>`;
}

export function buildSuccessHtml(message: string): string {
  return `<div class="success">${escapeHtml(message)}</div>`;
}

export function getStatusClass(status: string): string {
  return STATUS_CLASS_BY_VALUE[status] ?? "";
}

export function formatStatusLabel(status: string): string {
  return translateWithFallback(
    `status.${status}`,
    STATUS_LABEL_BY_VALUE[status] ?? humanizeKey(status),
  );
}

export function formatRoleLabel(role: string): string {
  return translateWithFallback(
    `role.${role}`,
    ROLE_LABEL_BY_VALUE[role] ?? humanizeKey(role),
  );
}

export function formatArtifactTypeLabel(artifactType: string): string {
  return translateWithFallback(
    `artifact.${artifactType}`,
    ARTIFACT_LABEL_BY_TYPE[artifactType] ?? humanizeKey(artifactType),
  );
}

export function formatNarrativeKindLabel(kind: string): string {
  return translateWithFallback(
    `narrative.${kind}`,
    NARRATIVE_LABEL_BY_KIND[kind] ?? humanizeKey(kind),
  );
}

export function formatDecisionStatusLabel(status: string): string {
  return translateWithFallback(
    `decision.${status}`,
    DECISION_STATUS_LABEL_BY_VALUE[status] ?? humanizeKey(status),
  );
}

export function formatEventTypeLabel(eventType: string): string {
  return translateWithFallback(
    `event.${eventType}`,
    EVENT_LABEL_BY_TYPE[eventType] ?? humanizeKey(eventType),
  );
}

export function formatHostLabel(host: string): string {
  return host.length > 0 ? host.charAt(0).toUpperCase() + host.slice(1) : host;
}

function formatCandidateKindLabel(kind: ContextCandidateView["kind"]): string {
  return kind === "existing-context"
    ? t("context.savedTopic")
    : t("context.newTopicSuggestion");
}

function formatConfidenceLabel(
  confidence: ContextCandidateView["confidence"],
): string {
  switch (confidence) {
    case "high":
      return t("context.confidence.high");
    case "medium":
      return t("context.confidence.medium");
    case "low":
      return t("context.confidence.low");
    default:
      return humanizeKey(confidence);
  }
}

export function humanizeKey(value: string): string {
  return value
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatCountLabel(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function titleCaseWords(value: string): string {
  return value.replace(/\b\w/g, (character) => character.toUpperCase());
}

function humanizeLooseLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  if (/^[a-z0-9._/-]+$/i.test(trimmed) && !/[A-Z]/.test(trimmed)) {
    return titleCaseWords(trimmed.replace(/[._/-]+/g, " "));
  }

  return trimmed;
}

export function formatWorkDisplayLabel(label: string, host?: string): string {
  const trimmed = label.trim();
  const normalizedHost = host ? formatHostLabel(host.toLowerCase()) : null;

  if (!trimmed) {
    return normalizedHost
      ? translateWithFallback("context.hostWork", `${normalizedHost} work`, {
          host: normalizedHost,
        })
      : t("context.untitledWork");
  }

  const hostMatch = trimmed.match(/^([a-z0-9_-]+)\s+session(?:\s*@\s*(.+))?$/i);
  if (hostMatch) {
    const matchedHost = formatHostLabel(hostMatch[1].toLowerCase());
    const subject = hostMatch[2]?.trim();
    if (subject) {
      return translateWithFallback(
        "context.hostWorkOn",
        `${matchedHost} work on ${humanizeLooseLabel(subject)}`,
        {
          host: matchedHost,
          subject: humanizeLooseLabel(subject),
        },
      );
    }
    return translateWithFallback("context.hostWork", `${matchedHost} work`, {
      host: matchedHost,
    });
  }

  return humanizeLooseLabel(trimmed);
}

function summarizePath(path: string, trailingSegments = 3): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= trailingSegments) {
    return path;
  }
  return `${normalized.startsWith("/") ? "/" : ""}.../${parts.slice(-trailingSegments).join("/")}`;
}

function looksLikeOpaqueId(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value.trim(),
  );
}

function formatTopicDisplayLabel(
  label: string,
  fallbackLabel?: string | null,
): string {
  const trimmed = label.trim();
  if (!trimmed || looksLikeOpaqueId(trimmed)) {
    return fallbackLabel?.trim()
      ? t("context.topicFrom", {
          label: formatWorkDisplayLabel(fallbackLabel.trim()),
        })
      : t("context.untitledTopic");
  }
  return trimmed;
}

function formatContextReason(reason: string): string {
  switch (reason) {
    case "shared workspace":
      return t("context.reason.sameFolder");
    case "isolated workspace activity":
      return t("context.reason.noOtherTopic");
    case "shared issue keys":
      return t("context.reason.sameProblem");
    case "shared failure families":
      return t("context.reason.sameFailureFamily");
    case "shared goal wording":
      return t("context.reason.similarGoal");
    case "recent continuity":
      return t("context.reason.recentContinuity");
    case "preferred workspace context":
      return t("context.reason.preferred");
    default:
      return humanizeKey(reason);
  }
}

function formatTimelineSummary(
  eventType: string,
  summary: string | null,
): string | null {
  if (!summary) {
    return null;
  }

  if (eventType === "command.started") {
    const launched = summary.match(/^Launched (\w+) via /i);
    if (launched) {
      return t("timeline.startedHost", {
        host: formatHostLabel(launched[1].toLowerCase()),
      });
    }
  }

  if (eventType === "command.completed") {
    const finished = summary.match(/^(\w+) exited$/i);
    if (finished) {
      return t("timeline.finishedHost", {
        host: formatHostLabel(finished[1].toLowerCase()),
      });
    }
  }

  if (eventType === "session.start" && /^Started .+ session$/i.test(summary)) {
    return t("timeline.sessionStarted");
  }

  if (eventType === "session.end") {
    if (summary.includes("status completed")) {
      return t("timeline.sessionCompleted");
    }
    if (summary.includes("status failed")) {
      return t("timeline.sessionFailed");
    }
    if (summary.includes("status interrupted")) {
      return t("timeline.sessionInterrupted");
    }
  }

  return summary;
}

function humanizeFailureLine(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  const exitedMatch = trimmed.match(/^([a-z0-9_-]+)\s+exited$/i);
  if (exitedMatch) {
    return t("timeline.closedUnexpectedly", {
      host: formatHostLabel(exitedMatch[1].toLowerCase()),
    });
  }

  return trimmed;
}

function formatCurrentTruthSummary(summary: string): string {
  const normalized = stripAnsiAndControlSequences(summary)
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return t("context.noOverviewReady");
  }

  const sentences: string[] = [];
  const fieldLabels = [
    "Session status",
    "Latest failure",
    "Blocking failures",
    "Dependency changes",
    "Issue clusters",
    "Blocking clusters",
    "Recovered clusters",
    "Retry hotspots",
    "Active decisions",
  ] as const;

  const extractedFields = new Map<string, string>();
  const markers = fieldLabels
    .map((label) => {
      const index = normalized.indexOf(`${label}:`);
      return index >= 0 ? { label, index } : null;
    })
    .filter((marker): marker is { label: string; index: number } =>
      Boolean(marker),
    )
    .sort((left, right) => left.index - right.index);

  for (let index = 0; index < markers.length; index += 1) {
    const current = markers[index];
    const next = markers[index + 1];
    const valueStart = current.index + current.label.length + 1;
    const valueEnd = next ? next.index : normalized.length;
    extractedFields.set(
      current.label,
      normalized.slice(valueStart, valueEnd).trim(),
    );
  }

  const extractField = (label: (typeof fieldLabels)[number]): string | null => {
    return extractedFields.get(label) ?? null;
  };

  const cleanFieldValue = (value: string | null): string | null => {
    if (!value) {
      return null;
    }

    return value
      .replace(
        /\s*No active blockers are currently detected in this context\.\s*$/i,
        "",
      )
      .trim();
  };

  const hasMeaningfulValue = (value: string | null): value is string => {
    const cleaned = cleanFieldValue(value);
    if (!cleaned) {
      return false;
    }

    return !/^(none|none detected|none \.\.\.|n\/a)\b/i.test(cleaned);
  };

  const status = extractField("Session status");
  if (status) {
    if (/failed/i.test(status)) {
      sentences.push(t("context.latestFailed"));
    } else if (/completed/i.test(status)) {
      sentences.push(t("context.latestCompleted"));
    } else if (/interrupted/i.test(status)) {
      sentences.push(t("context.latestStopped"));
    }
  }

  const latestFailure = cleanFieldValue(extractField("Latest failure"));
  if (hasMeaningfulValue(latestFailure)) {
    sentences.push(
      t("context.mostRecentIssue", {
        value: humanizeFailureLine(latestFailure),
      }),
    );
  }

  const blockingFailures = cleanFieldValue(extractField("Blocking failures"));
  if (hasMeaningfulValue(blockingFailures)) {
    sentences.push(
      t("context.stillBlockingLine", {
        value: humanizeFailureLine(blockingFailures),
      }),
    );
  }

  const dependencyChanges = cleanFieldValue(extractField("Dependency changes"));
  if (hasMeaningfulValue(dependencyChanges)) {
    sentences.push(t("context.packageChanges", { value: dependencyChanges }));
  }

  const issueClusters = cleanFieldValue(extractField("Issue clusters"));
  if (hasMeaningfulValue(issueClusters)) {
    sentences.push(t("context.repeatedTroubleLine", { value: issueClusters }));
  }

  const retryHotspots = cleanFieldValue(extractField("Retry hotspots"));
  if (hasMeaningfulValue(retryHotspots)) {
    sentences.push(t("context.retryLoop", { value: retryHotspots }));
  }

  if (
    /No active blockers are currently detected in this context\./i.test(
      normalized,
    )
  ) {
    sentences.push(t("context.nothingBlocking"));
  }

  if (sentences.length > 0) {
    return sentences.join("\n");
  }

  return normalized;
}

function formatNarrativeOverview(summary: string): string[] {
  const normalized = stripAnsiAndControlSequences(summary).trim();
  if (!normalized) {
    return [];
  }

  const lines = normalized
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const overviewLines: string[] = [];

  const extractLineValue = (label: string): string | null => {
    const prefix = `${label}:`;
    const match = lines.find((line) =>
      line.toLowerCase().startsWith(prefix.toLowerCase()),
    );
    return match ? match.slice(prefix.length).trim() : null;
  };

  const goal = extractLineValue("Goal");
  if (goal) {
    if (/no user prompt captured/i.test(goal)) {
      overviewLines.push(t("context.quickCheck"));
    } else {
      overviewLines.push(t("context.mainGoal", { value: goal }));
    }
  }

  const commands = Number(extractLineValue("Commands observed"));
  if (Number.isFinite(commands) && commands > 0) {
    overviewLines.push(t("context.commandsObserved", { count: commands }));
  }

  const tests = Number(extractLineValue("Tests observed"));
  if (Number.isFinite(tests) && tests > 0) {
    overviewLines.push(t("context.testsObserved", { count: tests }));
  }

  const failures = Number(extractLineValue("Failures observed"));
  if (Number.isFinite(failures) && failures > 0) {
    overviewLines.push(
      failures === 1
        ? t("context.problemSingle")
        : t("context.problemPlural", { count: failures }),
    );
  }

  const issueClusters = extractLineValue("Issue clusters");
  if (issueClusters && !/^(none|none detected)$/i.test(issueClusters)) {
    overviewLines.push(t("context.repeatedTrouble", { value: issueClusters }));
  }

  const activeBlockers = extractLineValue("Active blockers");
  if (activeBlockers && !/^(none|none detected)$/i.test(activeBlockers)) {
    overviewLines.push(
      t("context.stillBlockingLine", { value: activeBlockers }),
    );
  }

  const retryHotspots = extractLineValue("Retry hotspots");
  if (retryHotspots && !/^(none|none detected)$/i.test(retryHotspots)) {
    overviewLines.push(t("context.retryLoop", { value: retryHotspots }));
  }

  return overviewLines;
}

function buildCurrentTruthOverview(
  truth: ContextReportView["currentTruth"],
): string {
  const normalizedHandoff = stripAnsiAndControlSequences(
    truth.latestHandoff ?? "",
  ).trim();
  const normalizedNarrative = stripAnsiAndControlSequences(
    truth.latestSummaryNarrative ?? "",
  ).trim();

  const isStructuredHandoff =
    normalizedHandoff.length > 0 &&
    (/^Handoff for\b/i.test(normalizedHandoff) ||
      /Session status:/i.test(normalizedHandoff));

  if (normalizedHandoff && !isStructuredHandoff) {
    return normalizedHandoff;
  }

  const lines = [
    ...formatNarrativeOverview(normalizedNarrative),
    ...formatCurrentTruthSummary(
      normalizedHandoff || truth.summary || normalizedNarrative,
    )
      .split(/\r?\n+/)
      .map((line) => line.trim())
      .filter(Boolean),
  ];

  const deduped = lines.filter(
    (line, index) =>
      lines.findIndex(
        (candidate) => candidate.toLowerCase() === line.toLowerCase(),
      ) === index,
  );

  return deduped.join("\n");
}

export function canReingestSession(status: string): boolean {
  return status !== "running";
}

export function buildSessionRowsHtml(
  sessions: SessionDashboardRow[],
  formatDate: (value: string) => string,
): string {
  if (sessions.length === 0) {
    return `<tr><td colspan="5" class="empty">${escapeHtml(t("sessionDashboard.sessions.empty"))}</td></tr>`;
  }

  return sessions
    .map((session) => {
      const statusClass = getStatusClass(session.status);
      const escapedStatus = escapeHtml(session.status);
      const escapedSessionId = escapeHtml(session.id);
      const displayLabel = formatWorkDisplayLabel(session.label, session.host);
      const escapedLabel = escapeHtml(displayLabel);
      const escapedStartedAt = escapeHtml(formatDate(session.startedAt));
      const reingestable = canReingestSession(session.status);
      const disabledAttrs = reingestable
        ? ""
        : ` disabled title="${escapeHtml(t("session.action.refreshSummaryDisabled"))}"`;

      return `
        <tr>
          <td>
            <strong class="primary-line">${escapedLabel}</strong>
            <br><span class="muted secondary-line" title="${escapedSessionId}">${escapeHtml(t("context.savedWorkRecord"))}</span>
          </td>
          <td>${escapeHtml(formatHostLabel(session.host))}</td>
          <td><span class="pill ${statusClass}">${escapeHtml(formatStatusLabel(session.status))}</span></td>
          <td>${escapedStartedAt}</td>
          <td>
            <div class="actions">
              <button data-session-id="${escapedSessionId}" data-action="detail" aria-label="${escapeHtml(t("session.action.openSession", { label: displayLabel }))}">${escapeHtml(t("context.open"))}</button>
              <button class="secondary" data-session-id="${escapedSessionId}" data-session-status="${escapedStatus}" data-action="ingest" aria-label="${escapeHtml(reingestable ? t("session.action.refreshSummaryFor", { label: displayLabel }) : t("session.action.stillInProgress", { label: displayLabel }))}"${disabledAttrs}>${escapeHtml(reingestable ? t("context.refreshSummary") : t("context.inProgress"))}</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");
}

export function buildHistorySearchResultsHtml(
  results: HistorySearchResultView[],
  formatDate: (value: string) => string,
): string {
  return buildListHtml(
    results.map((result) => {
      const snippets = result.snippets
        .map((snippet) => renderMultilineText(snippet))
        .join("<br>");
      const escapedSessionId = escapeHtml(result.sessionId);
      const displayLabel = formatWorkDisplayLabel(result.label, result.host);
      const escapedLabel = escapeHtml(displayLabel);
      const escapedHost = escapeHtml(result.host);
      const hostLabel = escapeHtml(formatHostLabel(result.host));
      return `
        <strong>${escapedLabel}</strong>
        <span class="pill ${getStatusClass(result.status)}">${escapeHtml(formatStatusLabel(result.status))}</span>
        <br><span class="muted">${hostLabel} · ${escapeHtml(formatDate(result.startedAt))}</span>
        <br><span class="muted">${escapeHtml(t("context.whyThisMatches"))}</span><br>${snippets || `<span class="muted">${escapeHtml(t("context.noHighlights"))}</span>`}
        <div class="actions compact">
          <button data-action="detail" data-session-id="${escapedSessionId}" aria-label="${escapeHtml(t("session.action.openMatchingSession", { label: displayLabel }))}">${escapeHtml(t("context.open"))}</button>
          <button class="secondary" data-action="set-host" data-host="${escapedHost}" aria-label="${escapeHtml(t("session.action.onlyHostAria", { host: formatHostLabel(result.host) }))}">${escapeHtml(t("context.onlyHost", { host: formatHostLabel(result.host) }))}</button>
        </div>
      `;
    }),
    t("context.resultsHere"),
  );
}

export function buildHistoryTrendListHtml(
  trends: HistoryTrendView[],
  formatDate: (value: string) => string,
): string {
  return buildListHtml(
    trends.map((trend) => {
      const latestSession = trend.sessions[0] ?? null;
      const blockerState = trend.blockerState ?? "resolved";
      const remediationSummary =
        trend.remediationSummary ??
        t("session.trend.latestOutcomeFallback", {
          outcome: formatStatusLabel(trend.latestOutcome),
        });
      const sessionPreview = trend.sessions
        .slice(0, 3)
        .map(
          (session) =>
            `${escapeHtml(formatWorkDisplayLabel(session.label, session.host))} (${escapeHtml(formatHostLabel(session.host))}, ${escapeHtml(formatStatusLabel(session.status))}, ${escapeHtml(formatCountLabel(session.attempts, "attempt"))}, latest ${escapeHtml(formatStatusLabel(session.latestOutcome))})`,
        )
        .join("<br>");
      const escapedIssueKey = escapeHtml(trend.issueKey);
      const escapedLabel = escapeHtml(trend.label);
      const escapedQuery = escapeHtml(trend.label);
      const relatedIssueKeys =
        trend.groupBy === "family" && trend.relatedIssueKeys.length > 0
          ? `<br><span class="muted">${escapeHtml(t("context.relatedIssues"))}: ${escapeHtml(trend.relatedIssueKeys.join(", "))}</span>`
          : "";
      const focusButton =
        trend.groupBy === "family"
          ? `<button class="secondary" data-action="focus-family" data-query="${escapedQuery}" aria-label="${escapeHtml(t("session.action.showBroaderPatternAria", { label: trend.label }))}">${escapeHtml(t("context.showBroaderPattern"))}</button>`
          : `<button class="secondary" data-action="set-issue-key" data-issue-key="${escapedIssueKey}" aria-label="${escapeHtml(t("session.action.showThisProblemAria", { label: trend.label }))}">${escapeHtml(t("context.showThisProblem"))}</button>`;
      const openLatestButton = latestSession
        ? `<button data-action="detail" data-session-id="${escapeHtml(latestSession.sessionId)}" aria-label="${escapeHtml(t("session.action.openLatestSessionAria", { label: formatWorkDisplayLabel(latestSession.label, latestSession.host) }))}">${escapeHtml(t("context.openLatest"))}</button>`
        : "";

      return `
        <strong>${escapedLabel}</strong>
        <br><span class="muted">${escapeHtml(t(blockerState === "active" ? "session.trend.blocking" : "session.trend.notBlocking"))} · ${escapeHtml(t("session.trend.lastSeen", { value: formatDate(trend.lastSeenAt) }))}</span>
        <br>${escapeHtml(
          t("session.trend.seenIn", {
            sessions: formatCountLabel(
              trend.sessionCount,
              t("common.savedWorkRecord"),
              t("common.savedWorkRecords"),
            ),
            attempts: formatCountLabel(
              trend.attemptCount,
              t("common.attempt"),
              t("common.attempts"),
            ),
          }),
        )}
        <br><span class="muted">${escapeHtml(t("context.latestOutcome"))}: ${escapeHtml(formatStatusLabel(trend.latestOutcome))} · ${escapeHtml(remediationSummary)}</span>
        <br><span class="muted">${escapeHtml(t("context.seenWith"))}: ${escapeHtml(trend.hosts.map(formatHostLabel).join(", ") || t("common.notAvailable"))}</span>
        ${relatedIssueKeys}
        ${sessionPreview ? `<br><span class="muted">${escapeHtml(t("context.recentRelatedWork"))}:</span><br>${sessionPreview}` : ""}
        <div class="actions compact">
          ${openLatestButton}
          ${focusButton}
          <button class="secondary" data-action="set-query" data-query="${escapedQuery}" aria-label="${escapeHtml(t("session.action.searchForAria", { label: trend.label }))}">${escapeHtml(t("context.findRelated"))}</button>
        </div>
      `;
    }),
    t("sessionDashboard.trends.empty"),
  );
}

export function buildHistoryHandoffListHtml(
  handoff: HistoryHandoffView,
  formatDate: (value: string) => string,
  options?: { includeHostFilterButtons?: boolean },
): string {
  const includeHostFilterButtons = options?.includeHostFilterButtons ?? true;
  const items: string[] = [];
  const blockers = handoff.blockers.filter(hasDisplayText);
  const recoveries = (handoff.recoveries ?? []).filter(hasDisplayText);
  const followUps = handoff.followUps.filter(hasDisplayText);
  const recentSessions = handoff.recentSessions.filter(
    (session) =>
      hasDisplayText(session.label) ||
      hasDisplayText(session.status) ||
      hasDisplayText(session.host),
  );

  if (blockers.length > 0) {
    items.push(`
      <strong>${escapeHtml(t("context.needsAttention"))}</strong>
      <br>${blockers.map((item) => escapeHtml(item)).join("<br>")}
    `);
  }

  if (recoveries.length > 0) {
    items.push(`
      <strong>${escapeHtml(t("context.recentlyImproved"))}</strong>
      <br>${recoveries.map((item) => escapeHtml(item)).join("<br>")}
    `);
  }

  if (followUps.length > 0) {
    items.push(`
      <strong>${escapeHtml(t("context.openQuestions"))}</strong>
      <br>${followUps.map((item) => renderMultilineText(item)).join("<br>")}
    `);
  }

  items.push(
    ...recentSessions.map((session) => {
      const escapedSessionId = escapeHtml(session.id);
      const escapedLabel = escapeHtml(
        formatWorkDisplayLabel(session.label, session.host),
      );
      const hostLabel = escapeHtml(formatHostLabel(session.host));
      return `
        <strong>${escapedLabel}</strong>
        <span class="pill ${getStatusClass(session.status)}">${escapeHtml(formatStatusLabel(session.status))}</span>
        <br><span class="muted">${hostLabel} · ${escapeHtml(formatDate(session.startedAt))}</span>
        <div class="actions compact">
          <button data-action="detail" data-session-id="${escapedSessionId}" aria-label="${escapeHtml(t("session.action.openSession", { label: formatWorkDisplayLabel(session.label, session.host) }))}">${escapeHtml(t("context.open"))}</button>
          ${
            includeHostFilterButtons
              ? `<button class="secondary" data-action="set-host" data-host="${escapeHtml(session.host)}" aria-label="${escapeHtml(t("session.action.onlyHostAria", { host: formatHostLabel(session.host) }))}">${escapeHtml(t("context.onlyHost", { host: formatHostLabel(session.host) }))}</button>`
              : ""
          }
        </div>
      `;
    }),
  );

  return buildListHtml(items, t("context.nothingUrgent"));
}

export function buildSessionTrendContextHtml(
  trends: SessionTrendContextView[],
  formatDate: (value: string) => string,
): string {
  return buildListHtml(
    trends.map((trend) => {
      const latestRelatedSession = trend.relatedSessions[0] ?? null;
      const blockerState = trend.blockerState ?? "resolved";
      const remediationSummary =
        trend.remediationSummary ??
        t("session.trend.latestOutcomeFallback", {
          outcome: formatStatusLabel(trend.latestOutcome),
        });
      const escapedIssueKey = escapeHtml(trend.issueKey);
      const escapedLabel = escapeHtml(trend.label);
      const relatedPreview = trend.relatedSessions
        .map(
          (session) =>
            `${escapeHtml(formatWorkDisplayLabel(session.label, session.host))} (${escapeHtml(formatHostLabel(session.host))}, ${escapeHtml(formatStatusLabel(session.status))}, ${escapeHtml(formatCountLabel(session.attempts, "attempt"))}, latest ${escapeHtml(formatStatusLabel(session.latestOutcome))}, last ${escapeHtml(formatDate(session.lastAttemptAt))})`,
        )
        .join("<br>");
      const hiddenRelatedSessions = Math.max(
        trend.relatedSessionCount - trend.relatedSessions.length,
        0,
      );
      const familyScopeButton =
        trend.issueFamilyKey && trend.issueFamilyKey !== trend.issueKey
          ? `<button class="secondary" data-action="load-scope-handoff" data-issue-key="${escapeHtml(trend.issueFamilyKey)}" data-group-by="family" data-scope-label="${escapeHtml(trend.issueFamilyLabel ?? trend.label)}" aria-label="${escapeHtml(t("session.action.loadBroaderSummaryAria", { label: trend.issueFamilyLabel ?? trend.label }))}">${escapeHtml(t("context.openShortSummaryBroader"))}</button>`
          : "";
      const relatedIssuesLine =
        trend.relatedIssueKeys.length > 0
          ? `<br><span class="muted">${escapeHtml(t("context.relatedIssues"))}: ${escapeHtml(trend.relatedIssueKeys.join(", "))}</span>`
          : "";
      const openLatestRelatedButton = latestRelatedSession
        ? `<button data-action="detail" data-session-id="${escapeHtml(latestRelatedSession.sessionId)}" aria-label="${escapeHtml(t("session.action.openLatestRelatedAria", { label: formatWorkDisplayLabel(latestRelatedSession.label, latestRelatedSession.host) }))}">${escapeHtml(t("context.openLatestRelatedWork"))}</button>`
        : "";

      return `
        <strong>${escapedLabel}</strong>
        <br><span class="muted">${escapeHtml(t(blockerState === "active" ? "session.trend.sessionBlocking" : "session.trend.sessionNotBlocking"))}</span>
        <br>${escapeHtml(
          t("session.trend.encountered", {
            sessionAttempts: formatCountLabel(
              trend.sessionAttempts,
              t("common.time"),
              t("common.times"),
            ),
            globalAttempts: formatCountLabel(
              trend.globalAttempts,
              t("common.time"),
              t("common.times"),
            ),
          }),
        )}
        <br><span class="muted">${escapeHtml(t("context.latestOutcome"))}: ${escapeHtml(formatStatusLabel(trend.latestOutcome))} · ${escapeHtml(remediationSummary)}</span>
        ${
          trend.issueFamilyKey
            ? `<br><span class="muted">${escapeHtml(t("context.broaderPattern"))}: ${escapeHtml(trend.issueFamilyLabel ?? trend.issueFamilyKey)}</span>`
            : ""
        }
        ${relatedIssuesLine}
        <br><span class="muted">${escapeHtml(t("context.otherRelatedRecords"))}: ${escapeHtml(String(trend.relatedSessionCount))}</span>
        ${relatedPreview ? `<br><span class="muted">${relatedPreview}</span>` : ""}
        ${hiddenRelatedSessions > 0 ? `<br><span class="muted">${escapeHtml(t("context.moreRelatedRecords", { count: hiddenRelatedSessions }))}</span>` : ""}
        <div class="actions compact">
          ${openLatestRelatedButton}
          <button class="secondary" data-action="load-scope-handoff" data-issue-key="${escapedIssueKey}" data-group-by="issue" data-scope-label="${escapedLabel}" aria-label="${escapeHtml(t("session.action.loadSummaryAria", { label: trend.label }))}">${escapeHtml(t("context.openShortSummary"))}</button>
          ${familyScopeButton}
        </div>
      `;
    }),
    t("context.noSimilarPastWork"),
  );
}

export function buildContextReportHtml(
  report: ContextReportView,
  formatDate: (value: string) => string,
): string {
  const truth = report.currentTruth;
  const filteredBlockers = truth.activeBlockers.filter(hasDisplayText);
  const filteredQuestions = truth.openQuestions.filter(hasDisplayText);
  const latestSessionLine = `${escapeHtml(formatWorkDisplayLabel(truth.latestSessionLabel))} · ${escapeHtml(formatDate(report.context.latestStartedAt))}`;
  const blockerLine =
    filteredBlockers.length > 0
      ? filteredBlockers.map((blocker) => escapeHtml(blocker)).join("<br>")
      : `<span class="muted">${escapeHtml(t("context.noBlockers"))}</span>`;
  const openQuestionLine =
    filteredQuestions.length > 0
      ? filteredQuestions.map((question) => escapeHtml(question)).join("<br>")
      : `<span class="muted">${escapeHtml(t("context.noQuestions"))}</span>`;
  const activeDecisionLine =
    report.activeDecisions.length > 0
      ? report.activeDecisions
          .slice(0, 3)
          .map(
            (decision) =>
              `${escapeHtml(decision.title)} (${escapeHtml(formatDecisionStatusLabel(decision.status))})`,
          )
          .join("<br>")
      : `<span class="muted">${escapeHtml(t("context.noCurrentDecisions"))}</span>`;
  const supersededDecisionLine =
    report.supersededDecisions.length > 0
      ? report.supersededDecisions
          .slice(0, 3)
          .map((decision) => {
            const supersededBy = decision.supersededByTitle
              ? ` -> ${escapeHtml(decision.supersededByTitle)}`
              : "";
            return `${escapeHtml(decision.title)}${supersededBy}`;
          })
          .join("<br>")
      : `<span class="muted">${escapeHtml(t("context.noReplacedDecisions"))}</span>`;

  return buildListHtml(
    [
      `
        <strong>${escapeHtml(
          formatTopicDisplayLabel(
            report.context.label,
            truth.latestSessionLabel || report.context.latestSessionLabel,
          ),
        )}</strong>
        <br><span class="muted">${escapeHtml(formatCountLabel(report.context.sessionCount, t("common.savedWorkRecord"), t("common.savedWorkRecords")))} ${escapeHtml(t("session.context.linkedToTopic"))}</span>
        <br><span class="muted path-text" title="${escapeHtml(report.context.workspaceKey)}">${escapeHtml(t("session.context.workedIn"))} ${escapeHtml(summarizePath(report.context.workspaceKey))}</span>
      `,
      `
        <strong>${escapeHtml(t("context.bestCurrentPicture"))}</strong>
        <br>${renderMultilineText(buildCurrentTruthOverview(truth))}
        <br><span class="muted">${escapeHtml(t("context.latestRelatedWork"))}: ${latestSessionLine}</span>
      `,
      `
        <strong>${escapeHtml(t("context.stillBlocking"))}</strong>
        <br>${blockerLine}
      `,
      `
        <strong>${escapeHtml(t("context.stillUnclear"))}</strong>
        <br>${openQuestionLine}
      `,
      `
        <strong>${escapeHtml(t("context.currentDecisions"))}</strong>
        <br>${activeDecisionLine}
      `,
      `
        <strong>${escapeHtml(t("context.olderDecisions"))}</strong>
        <br>${supersededDecisionLine}
      `,
    ],
    t("context.noConfirmedSummary"),
  );
}

export function buildContextCandidateListHtml(
  candidates: ContextCandidateView[],
): string {
  return buildListHtml(
    candidates.map((candidate) => {
      const displayLabel = formatTopicDisplayLabel(
        candidate.label,
        candidate.latestSessionLabel,
      );
      const escapedLabel = escapeHtml(displayLabel);
      const escapedWorkspaceKey = escapeHtml(candidate.workspaceKey);
      const reasonLine =
        candidate.reasons.length > 0
          ? candidate.reasons
              .map((reason) => escapeHtml(formatContextReason(reason)))
              .join("<br>")
          : `<span class="muted">${escapeHtml(t("context.noMatchingSignals"))}</span>`;
      const latestSessionLine =
        candidate.latestSessionLabel && candidate.latestSessionId
          ? `${escapeHtml(formatWorkDisplayLabel(candidate.latestSessionLabel))}`
          : t("context.noEarlierWork");
      const preferredLine = candidate.preferred
        ? `<br><span class="muted">${escapeHtml(t("context.preferredFolder"))}</span>`
        : "";
      const actionHtml =
        candidate.kind === "existing-context" && candidate.contextId
          ? `
              <button data-action="confirm-context-candidate" data-context-id="${escapeHtml(candidate.contextId)}" aria-label="${escapeHtml(t("session.action.linkTopicAria", { label: displayLabel }))}">${escapeHtml(t("context.linkTopic"))}</button>
              <button class="secondary" data-action="reject-context-candidate" data-context-id="${escapeHtml(candidate.contextId)}" aria-label="${escapeHtml(t("session.action.keepSeparateAria", { label: displayLabel }))}">${escapeHtml(t("context.keepSeparate"))}</button>
            `
          : `
              <button data-action="confirm-context-new" data-session-ids="${escapeHtml(candidate.sessionIds.join(","))}" data-context-label="${escapedLabel}" aria-label="${escapeHtml(t("session.action.startNewTopicAria", { label: displayLabel }))}">${escapeHtml(t("context.startNewTopic"))}</button>
            `;

      return `
        <strong>${escapedLabel}</strong>
        <br><span class="muted">${escapeHtml(formatCandidateKindLabel(candidate.kind))} · ${escapeHtml(formatConfidenceLabel(candidate.confidence))}</span>
        <br><span class="muted">${escapeHtml(t("context.latestRelatedWork"))}: ${latestSessionLine}</span>
        ${preferredLine}
        <br><span class="muted">${escapeHtml(t("context.whySuggested"))}</span><br>${reasonLine}
        <br><span class="muted path-text" title="${escapedWorkspaceKey}">${escapeHtml(t("session.context.folder"))}: ${escapeHtml(summarizePath(candidate.workspaceKey))}</span>
        <div class="actions compact">
          ${actionHtml}
        </div>
      `;
    }),
    t("context.noSuggestedTopics"),
  );
}

export function buildContextOverviewHtml(
  contexts: ContextListItemView[],
  formatDate: (value: string) => string,
): string {
  return buildListHtml(
    contexts.map((context) => {
      const escapedLabel = escapeHtml(
        formatTopicDisplayLabel(context.label, context.latestSessionLabel),
      );
      const escapedLatestSessionId = escapeHtml(context.latestSessionId);
      const escapedLatestSessionLabel = escapeHtml(
        formatWorkDisplayLabel(context.latestSessionLabel),
      );
      return `
        <strong>${escapedLabel}</strong>
        <br><span class="muted">${escapeHtml(formatCountLabel(context.sessionCount, t("common.savedWorkRecord"), t("common.savedWorkRecords")))} ${escapeHtml(t("session.context.inTopic"))} · ${escapeHtml(t("session.context.latest"))} ${escapeHtml(formatDate(context.latestStartedAt))}</span>
        <br><span class="muted">${escapeHtml(t("context.latestRelatedWork"))}: ${escapedLatestSessionLabel}</span>
        <br><span class="muted path-text" title="${escapeHtml(context.workspaceKey)}">${escapeHtml(t("session.context.folder"))}: ${escapeHtml(summarizePath(context.workspaceKey))}</span>
        <div class="actions compact">
          <button data-action="detail" data-session-id="${escapedLatestSessionId}" aria-label="${escapeHtml(t("session.action.openLatestWorkAria", { label: formatTopicDisplayLabel(context.label, context.latestSessionLabel) }))}">${escapeHtml(t("context.openLatestWork"))}</button>
        </div>
      `;
    }),
    t("context.noOngoingTopics"),
  );
}

export function buildMetaCardsHtml(
  items: Array<{
    label: string;
    value: string;
    note?: string;
    valueClassName?: string;
    title?: string;
  }>,
): string {
  return items
    .map(
      (item) => `
        <div class="card">
          <strong>${escapeHtml(item.label)}</strong>
          <div class="meta-value${item.valueClassName ? ` ${escapeHtml(item.valueClassName)}` : ""}"${
            item.title ? ` title="${escapeHtml(item.title)}"` : ""
          }>${escapeHtml(item.value)}</div>
          ${item.note ? `<div class="meta-note">${escapeHtml(item.note)}</div>` : ""}
        </div>
      `,
    )
    .join("");
}

export function buildMessageListHtml(messages: SessionMessageView[]): string {
  return buildListHtml(
    messages.map(
      (message) =>
        `<strong>${escapeHtml(formatRoleLabel(message.role))}:</strong><br>${renderMultilineText(message.content)}`,
    ),
    t("context.noConversation"),
  );
}

export function buildTimelineListHtml(events: SessionTimelineView[]): string {
  return buildListHtml(
    events.map((event) => {
      const formattedSummary = formatTimelineSummary(
        event.eventType,
        event.summary,
      );
      const summary = formattedSummary
        ? `<br><span class="muted">${escapeHtml(formattedSummary)}</span>`
        : "";
      return `<strong>${escapeHtml(formatEventTypeLabel(event.eventType))}</strong>${summary}`;
    }),
    t("context.noTimeline"),
  );
}

export function buildNarrativeListHtml(
  narratives: SessionNarrativeView[],
): string {
  return buildListHtml(
    narratives.map(
      (narrative) =>
        `<strong>${escapeHtml(formatNarrativeKindLabel(narrative.kind))}</strong><br>${renderMultilineText(narrative.content)}`,
    ),
    t("context.noNarratives"),
  );
}

export function buildDecisionListHtml(
  decisions: SessionDecisionView[],
): string {
  return buildListHtml(
    decisions.map(
      (decision) =>
        `<strong>${escapeHtml(formatDecisionStatusLabel(decision.status))}</strong> ${escapeHtml(decision.title)}<br>${renderMultilineText(decision.summary)}`,
    ),
    t("context.noDecisions"),
  );
}

export function buildArtifactListHtml(
  artifacts: SessionArtifactView[],
): string {
  return buildListHtml(
    artifacts.map((artifact) => {
      const headlineParts = [
        escapeHtml(formatArtifactTypeLabel(artifact.artifactType)),
        artifact.category ? escapeHtml(humanizeKey(artifact.category)) : null,
        artifact.status ? escapeHtml(formatStatusLabel(artifact.status)) : null,
      ].filter(Boolean);
      const pathLine = artifact.path
        ? `<br><span class="muted path-text" title="${escapeHtml(artifact.path)}">${escapeHtml(summarizePath(artifact.path, 4))}</span>`
        : "";
      const detailLines = [
        artifact.failureSignatureLabel
          ? `${t("session.artifact.failure")}: ${artifact.failureSignatureLabel}`
          : null,
        artifact.errorCode
          ? `${t("session.artifact.errorCode")}: ${artifact.errorCode}`
          : null,
        artifact.lintRuleId
          ? `${t("session.artifact.lintRule")}: ${artifact.lintRuleId}`
          : null,
        artifact.testSuite
          ? `${t("session.artifact.test")}: ${artifact.testSuite}${artifact.testCase ? ` > ${artifact.testCase}` : ""}`
          : null,
        artifact.dependencyNames && artifact.dependencyNames.length > 0
          ? `${t("session.artifact.dependencies")}: ${artifact.dependencyAction ?? t("session.artifact.dependencyChange")} ${artifact.dependencyNames.join(", ")}`
          : null,
        artifact.changeScope
          ? `${t("session.artifact.scope")}: ${artifact.changeScope}${artifact.manifestKind ? ` (${artifact.manifestKind})` : ""}`
          : null,
      ]
        .filter(Boolean)
        .map(
          (line) => `<br><span class="muted">${escapeHtml(line ?? "")}</span>`,
        )
        .join("");

      return `<strong>${headlineParts.join(" · ")}</strong><br>${renderMultilineText(artifact.summary)}${pathLine}${detailLines}`;
    }),
    t("context.noArtifacts"),
  );
}
import { t } from "./i18n";
