import { getSessionLabel, truncateSummary } from "../lib/session-history.js";
import { parseArtifactMetadata } from "../lib/session-artifacts.js";
import type {
  DecisionRecord,
  EvidenceDatabase,
  NarrativeRecord,
  SessionDetail,
} from "../lib/storage/index.js";
import type { SourceRef } from "./types.js";

const ACCEPTED_DECISION_PATTERN =
  /\b(?:decided|approved|going with|we will|let'?s use|choose|ship)\b/i;
const PROPOSED_DECISION_PATTERN =
  /\b(?:should|consider|proposal|option|maybe)\b/i;
const OPEN_QUESTION_PATTERN =
  /\b(?:todo|follow up|follow-up|remaining|next|need to|still need|pending|open question)\b/i;
const FAILURE_STATUS_PATTERN =
  /\b(?:fail|failed|error|parse-error|timeout|timed-out|interrupted|non-zero)\b/i;
const SUCCESS_STATUS_PATTERN =
  /^(?:completed|passed|captured|success|succeeded)$/i;

interface RetryGroup {
  attempts: number;
  label: string;
  latestOutcome: string;
  refs: SourceRef[];
}

interface IssueCluster {
  issueKey: string;
  kind: string;
  label: string;
  issueFamilyKey: string | null;
  issueFamilyLabel: string | null;
  attempts: number;
  failedAttempts: number;
  succeededAttempts: number;
  latestOutcome: string;
  blockerCategory: string;
  blockerState: "active" | "resolved";
  remediationState: "unresolved" | "recovered" | "regressed" | "stable";
  remediationSummary: string;
  refs: SourceRef[];
}

interface DependencyChange {
  summary: string;
  refs: SourceRef[];
  order: number;
}

function buildSourceRefs(refs: SourceRef[]): string {
  const seen = new Set<string>();
  const unique = refs.filter((ref) => {
    const key = `${ref.type}:${ref.id}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
  return JSON.stringify(unique);
}

function parseJson(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function summarizeMessage(content: string): string {
  return truncateSummary(content.trim(), 140);
}

function dedupeSourceRefs(refs: SourceRef[]): SourceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.type}:${ref.id}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return false;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function summarizeEvent(
  event: SessionDetail["timeline"][number],
  fallback: string,
): string {
  const summary = event.summary?.trim();
  return truncateSummary(summary || fallback, 140);
}

function isOpenItemMessage(content: string): boolean {
  const trimmed = content.trim();
  return trimmed.endsWith("?") || OPEN_QUESTION_PATTERN.test(trimmed);
}

function collectOpenItems(detail: SessionDetail): Array<{
  summary: string;
  refs: SourceRef[];
}> {
  const seen = new Set<string>();
  const items: Array<{ summary: string; refs: SourceRef[] }> = [];

  for (const message of detail.messages) {
    if (!isOpenItemMessage(message.content)) {
      continue;
    }

    const summary = summarizeMessage(message.content);
    const key = summary.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    items.push({
      summary,
      refs: [{ type: "message", id: message.id }],
    });
  }

  return items;
}

function isFailureEvent(event: SessionDetail["timeline"][number]): boolean {
  if (event.eventType === "error.observed") {
    return true;
  }

  if (
    event.eventType !== "command.completed" &&
    event.eventType !== "test.completed"
  ) {
    return false;
  }

  const payload = parseJson(event.payload);
  if (typeof payload?.exitCode === "number") {
    return payload.exitCode !== 0;
  }

  if (
    typeof event.status === "string" &&
    FAILURE_STATUS_PATTERN.test(event.status)
  ) {
    return true;
  }

  return FAILURE_STATUS_PATTERN.test(event.summary ?? "");
}

function collectFailureSignals(detail: SessionDetail): Array<{
  summary: string;
  refs: SourceRef[];
}> {
  const seen = new Set<string>();
  const failures: Array<{ summary: string; refs: SourceRef[] }> = [];

  for (const event of detail.timeline) {
    if (!isFailureEvent(event)) {
      continue;
    }

    const payload = parseJson(event.payload);
    const exitCode =
      typeof payload?.exitCode === "number"
        ? ` (exit ${payload.exitCode})`
        : "";
    const fallback =
      event.eventType === "error.observed"
        ? `Observed error${exitCode}`
        : `${event.eventType}${exitCode}`;
    const summary = summarizeEvent(event, fallback);
    const key = `${event.eventType}:${summary}`.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    failures.push({
      summary,
      refs: [{ type: "event", id: event.id }],
    });
  }

  return failures;
}

function getCommandLabel(
  event: SessionDetail["timeline"][number],
): string | null {
  const payload = parseJson(event.payload);
  const command = typeof payload?.command === "string" ? payload.command : null;
  const args = Array.isArray(payload?.args)
    ? payload.args.filter((arg): arg is string => typeof arg === "string")
    : [];

  if (command) {
    return truncateSummary([command, ...args].join(" ").trim(), 96);
  }

  if (event.summary?.trim()) {
    return truncateSummary(event.summary.trim(), 96);
  }

  if (event.eventSubType?.trim()) {
    return truncateSummary(event.eventSubType.trim(), 96);
  }

  return null;
}

function getOutcomeLabel(event: SessionDetail["timeline"][number]): string {
  const payload = parseJson(event.payload);
  if (typeof payload?.exitCode === "number") {
    return payload.exitCode === 0 ? "succeeded" : "failed";
  }

  if (!event.status) {
    return "completed";
  }

  if (SUCCESS_STATUS_PATTERN.test(event.status)) {
    return "succeeded";
  }

  if (FAILURE_STATUS_PATTERN.test(event.status)) {
    return "failed";
  }

  return event.status.toLowerCase();
}

function collectRetryGroups(detail: SessionDetail): RetryGroup[] {
  const groups = new Map<
    string,
    {
      label: string;
      events: SessionDetail["timeline"];
    }
  >();

  for (const event of detail.timeline) {
    if (event.eventType !== "command.completed") {
      continue;
    }

    const label = getCommandLabel(event);
    if (!label) {
      continue;
    }

    const existing = groups.get(label);
    if (existing) {
      existing.events.push(event);
      continue;
    }

    groups.set(label, { label, events: [event] });
  }

  return Array.from(groups.values())
    .filter((group) => group.events.length > 1)
    .map((group) => {
      const latestEvent = group.events.at(-1);
      return {
        label: group.label,
        attempts: group.events.length,
        latestOutcome: latestEvent ? getOutcomeLabel(latestEvent) : "completed",
        refs: group.events.map((event) => ({
          type: "event" as const,
          id: event.id,
        })),
      };
    });
}

function describeRetryGroups(groups: RetryGroup[]): string {
  if (groups.length === 0) {
    return "none detected";
  }

  return groups
    .map(
      (group) =>
        `${group.label} x${group.attempts} (latest ${group.latestOutcome})`,
    )
    .join(" | ");
}

function isFailureOutcome(outcome: string | null | undefined): boolean {
  return Boolean(outcome && FAILURE_STATUS_PATTERN.test(outcome));
}

function classifyBlockerCategory(kind: string): string {
  return kind.trim() || "issue";
}

function getRemediationState(options: {
  latestOutcome: string;
  failedAttempts: number;
  succeededAttempts: number;
}): "unresolved" | "recovered" | "regressed" | "stable" {
  if (isFailureOutcome(options.latestOutcome)) {
    return options.succeededAttempts > 0 ? "regressed" : "unresolved";
  }

  if (options.failedAttempts > 0 && options.succeededAttempts > 0) {
    return "recovered";
  }

  return "stable";
}

function buildRemediationSummary(options: {
  latestOutcome: string;
  attempts: number;
  failedAttempts: number;
  succeededAttempts: number;
  remediationState: "unresolved" | "recovered" | "regressed" | "stable";
}): string {
  switch (options.remediationState) {
    case "recovered":
      return `recovered after ${options.failedAttempts} failed attempt(s); latest ${options.latestOutcome}`;
    case "regressed":
      return `regressed after ${options.succeededAttempts} successful attempt(s); latest ${options.latestOutcome}`;
    case "unresolved":
      return `still failing after ${options.attempts} attempt(s); latest ${options.latestOutcome}`;
    case "stable":
    default:
      return `no active blocker; latest ${options.latestOutcome}`;
  }
}

function isFailureLikeMetadata(
  metadata: ReturnType<typeof parseArtifactMetadata>,
): boolean {
  return isFailureOutcome(metadata.outcome ?? metadata.status ?? null);
}

function scoreIssueMetadata(
  metadata: ReturnType<typeof parseArtifactMetadata>,
): number {
  return [
    metadata.testSuite ? 4 : 0,
    metadata.testCase ? 2 : 0,
    metadata.lintRuleId ? 4 : 0,
    metadata.dependencyNames.length > 0 ? 2 : 0,
    metadata.failureSignatureLabel ? 1 : 0,
    isFailureLikeMetadata(metadata) ? 1 : 0,
  ].reduce((total, score) => total + score, 0);
}

function getIssueTestDescriptor(
  metadata: ReturnType<typeof parseArtifactMetadata>,
): string | null {
  if (!metadata.testSuite) {
    return null;
  }

  return metadata.testCase
    ? `${metadata.testSuite} > ${metadata.testCase}`
    : metadata.testSuite;
}

function shouldIncludeFailureSignature(
  metadata: ReturnType<typeof parseArtifactMetadata>,
): boolean {
  if (!metadata.failureSignatureLabel) {
    return false;
  }

  return !(
    metadata.lintRuleId &&
    metadata.failureSignatureLabel === `ESLint ${metadata.lintRuleId}`
  );
}

function buildIssueClusterLabel(
  baseLabel: string,
  metadata: ReturnType<typeof parseArtifactMetadata>,
): string {
  const detailSegments = dedupeStrings([
    metadata.dependencyNames.length > 0
      ? metadata.dependencyNames.join(", ")
      : "",
    getIssueTestDescriptor(metadata) ?? "",
    metadata.lintRuleId ?? "",
  ]);
  const detailSuffix =
    detailSegments.length > 0 ? ` / ${detailSegments.join(" / ")}` : "";
  const failureSuffix = shouldIncludeFailureSignature(metadata)
    ? ` [${metadata.failureSignatureLabel}]`
    : "";

  return truncateSummary(`${baseLabel}${detailSuffix}${failureSuffix}`, 140);
}

function getArtifactOrder(
  detail: SessionDetail,
  artifact: SessionDetail["artifacts"][number],
  refs: SourceRef[],
): number {
  if (artifact.eventId) {
    const event = detail.timeline.find(
      (candidate) => candidate.id === artifact.eventId,
    );
    if (event) {
      return event.seq;
    }
  }

  const refOrders = refs
    .map((ref) => {
      if (ref.type === "event") {
        return (
          detail.timeline.find((event) => event.id === ref.id)?.seq ?? null
        );
      }
      if (ref.type === "message") {
        return (
          detail.messages.find((message) => message.id === ref.id)?.seq ?? null
        );
      }
      return null;
    })
    .filter((order): order is number => order !== null);

  return refOrders.length > 0
    ? Math.min(...refOrders)
    : Number.MAX_SAFE_INTEGER;
}

function pickIssueDisplayMetadata(
  records: Array<{
    artifact: SessionDetail["artifacts"][number];
    metadata: ReturnType<typeof parseArtifactMetadata>;
    order: number;
  }>,
  fallback: ReturnType<typeof parseArtifactMetadata>,
): ReturnType<typeof parseArtifactMetadata> {
  const bestRecord = records.slice().sort((left, right) => {
    const leftScore = scoreIssueMetadata(left.metadata);
    const rightScore = scoreIssueMetadata(right.metadata);
    return (
      rightScore - leftScore ||
      Number(isFailureLikeMetadata(right.metadata)) -
        Number(isFailureLikeMetadata(left.metadata)) ||
      right.order - left.order
    );
  })[0];

  return bestRecord?.metadata ?? fallback;
}

function pickIssueLabel(labels: string[]): string {
  return (
    labels.slice().sort((left, right) => {
      const leftScore = (left.includes("/") ? 2 : 0) + left.length / 1000;
      const rightScore = (right.includes("/") ? 2 : 0) + right.length / 1000;
      return rightScore - leftScore;
    })[0] ?? "issue"
  );
}

function collectIssueClusters(detail: SessionDetail): IssueCluster[] {
  const groups = new Map<
    string,
    Array<{
      artifact: SessionDetail["artifacts"][number];
      metadata: ReturnType<typeof parseArtifactMetadata>;
      order: number;
    }>
  >();

  for (const artifact of detail.artifacts) {
    if (
      artifact.artifactType !== "command-output" &&
      artifact.artifactType !== "test-result"
    ) {
      continue;
    }

    const metadata = parseArtifactMetadata(artifact.metadata);
    if (!metadata.issueKey || !metadata.issueLabel) {
      continue;
    }

    const eventType =
      typeof metadata.details.eventType === "string"
        ? metadata.details.eventType
        : null;
    if (
      eventType &&
      eventType !== "command.completed" &&
      eventType !== "test.completed"
    ) {
      continue;
    }

    const group = groups.get(metadata.issueKey) ?? [];
    group.push({
      artifact,
      metadata,
      order: getArtifactOrder(detail, artifact, metadata.sourceRefs),
    });
    groups.set(metadata.issueKey, group);
  }

  return Array.from(groups.entries())
    .map(([issueKey, records]) => {
      const sortedRecords = records
        .slice()
        .sort((left, right) => left.order - right.order);
      const preferredRecords = sortedRecords.some(
        (record) => record.artifact.artifactType === "command-output",
      )
        ? sortedRecords.filter(
            (record) => record.artifact.artifactType === "command-output",
          )
        : sortedRecords;
      const latestRecord =
        preferredRecords.at(-1) ?? sortedRecords.at(-1) ?? null;

      if (!latestRecord) {
        return null;
      }

      const displayMetadata = pickIssueDisplayMetadata(
        preferredRecords,
        latestRecord.metadata,
      );

      const failedAttempts = preferredRecords.filter((record) =>
        isFailureOutcome(
          record.metadata.outcome ?? record.metadata.status ?? "captured",
        ),
      ).length;
      const succeededAttempts = Math.max(
        preferredRecords.length - failedAttempts,
        0,
      );
      const latestOutcome =
        latestRecord.metadata.outcome ??
        latestRecord.metadata.status ??
        "captured";
      const blockerCategory = classifyBlockerCategory(
        latestRecord.metadata.intent ??
          latestRecord.metadata.category ??
          "issue",
      );
      const remediationState = getRemediationState({
        latestOutcome,
        failedAttempts,
        succeededAttempts,
      });

      return {
        issueKey,
        kind:
          latestRecord.metadata.intent ??
          latestRecord.metadata.category ??
          "issue",
        label: buildIssueClusterLabel(
          pickIssueLabel(
            sortedRecords
              .map((record) => record.metadata.issueLabel)
              .filter((label): label is string => Boolean(label)),
          ),
          displayMetadata,
        ),
        issueFamilyKey: latestRecord.metadata.issueFamilyKey,
        issueFamilyLabel: latestRecord.metadata.issueFamilyLabel,
        attempts: preferredRecords.length,
        failedAttempts,
        succeededAttempts,
        latestOutcome,
        blockerCategory,
        blockerState: isFailureOutcome(latestOutcome) ? "active" : "resolved",
        remediationState,
        remediationSummary: buildRemediationSummary({
          latestOutcome,
          attempts: preferredRecords.length,
          failedAttempts,
          succeededAttempts,
          remediationState,
        }),
        refs: dedupeSourceRefs(
          sortedRecords.flatMap((record) => record.metadata.sourceRefs),
        ),
      };
    })
    .filter((cluster): cluster is IssueCluster => Boolean(cluster))
    .sort((left, right) => {
      const leftFailed = isFailureOutcome(left.latestOutcome) ? 1 : 0;
      const rightFailed = isFailureOutcome(right.latestOutcome) ? 1 : 0;
      return (
        rightFailed - leftFailed ||
        right.attempts - left.attempts ||
        left.label.localeCompare(right.label)
      );
    });
}

function describeIssueClusters(clusters: IssueCluster[]): string {
  if (clusters.length === 0) {
    return "none detected";
  }

  return clusters
    .map(
      (cluster) =>
        `${cluster.blockerCategory.replace(/-/g, " ")}: ${cluster.label} (${cluster.remediationSummary})`,
    )
    .join(" | ");
}

function getDependencyChangeSummary(
  artifact: SessionDetail["artifacts"][number],
  metadata: ReturnType<typeof parseArtifactMetadata>,
): string | null {
  if (
    artifact.artifactType === "command-output" &&
    metadata.category === "install" &&
    metadata.dependencyNames.length > 0
  ) {
    return metadata.issueLabel
      ? `${metadata.issueLabel}: ${metadata.dependencyNames.join(", ")}`
      : metadata.dependencyNames.join(", ");
  }

  if (
    artifact.artifactType === "file-change" &&
    metadata.changeScope === "dependency-manifest"
  ) {
    return `${metadata.manifestKind ?? artifact.path ?? "dependency manifest"} updated`;
  }

  if (
    artifact.artifactType === "file-change" &&
    metadata.changeScope === "dependency-lockfile"
  ) {
    return `${metadata.manifestKind ?? artifact.path ?? "dependency lockfile"} updated`;
  }

  return null;
}

function collectDependencyChanges(detail: SessionDetail): DependencyChange[] {
  const seen = new Set<string>();
  const changes: DependencyChange[] = [];

  for (const artifact of detail.artifacts) {
    const metadata = parseArtifactMetadata(artifact.metadata);
    const summary = getDependencyChangeSummary(artifact, metadata);
    if (!summary) {
      continue;
    }

    const key = summary.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    changes.push({
      summary,
      refs: dedupeSourceRefs(
        metadata.sourceRefs.length > 0
          ? metadata.sourceRefs
          : [{ type: "artifact", id: artifact.id }],
      ),
      order: getArtifactOrder(detail, artifact, metadata.sourceRefs),
    });
  }

  return changes.sort((left, right) => left.order - right.order);
}

function describeDependencyChanges(changes: DependencyChange[]): string {
  if (changes.length === 0) {
    return "none detected";
  }

  return changes.map((change) => change.summary).join(" | ");
}

function describeBlockingIssueClusters(clusters: IssueCluster[]): string {
  const blockingClusters = clusters.filter(
    (cluster) => cluster.blockerState === "active",
  );
  return describeIssueClusters(blockingClusters);
}

function describeRecoveredIssueClusters(clusters: IssueCluster[]): string {
  return describeIssueClusters(
    clusters.filter((cluster) => cluster.remediationState === "recovered"),
  );
}

function collectFilePaths(detail: SessionDetail): string[] {
  return [
    ...new Set(
      detail.artifacts
        .filter((artifact) => artifact.artifactType === "file-change")
        .map((artifact) => artifact.path)
        .filter((path): path is string => Boolean(path)),
    ),
  ];
}

function buildJournal(
  detail: SessionDetail,
): Omit<NarrativeRecord, "id" | "createdAt" | "updatedAt"> {
  const lines = detail.timeline
    .slice(0, 12)
    .map(
      (event) =>
        `${event.startedAt}: ${event.eventType}${event.summary ? ` - ${event.summary}` : ""}`,
    );

  return {
    sessionId: detail.session.id,
    kind: "journal",
    content: `Session journal for ${getSessionLabel(detail.session)}\n${lines.join("\n")}`,
    sourceRefs: buildSourceRefs(
      detail.timeline
        .slice(0, 12)
        .map((event) => ({ type: "event", id: event.id })),
    ),
  };
}

function buildProjectSummary(
  detail: SessionDetail,
): Omit<NarrativeRecord, "id" | "createdAt" | "updatedAt"> {
  const firstUserMessage =
    detail.messages.find((message) => message.role === "user")?.content ??
    "No user prompt captured";
  const commandCount = detail.artifacts.filter(
    (artifact) => artifact.artifactType === "command-output",
  ).length;
  const testCount = detail.artifacts.filter(
    (artifact) => artifact.artifactType === "test-result",
  ).length;
  const filePaths = collectFilePaths(detail);
  const failures = collectFailureSignals(detail);
  const retries = collectRetryGroups(detail);
  const issueClusters = collectIssueClusters(detail);
  const dependencyChanges = collectDependencyChanges(detail);

  return {
    sessionId: detail.session.id,
    kind: "project-summary",
    content: [
      `Project summary for ${getSessionLabel(detail.session)}`,
      `Goal: ${truncateSummary(firstUserMessage, 140)}`,
      `Commands observed: ${commandCount}`,
      `Tests observed: ${testCount}`,
      `Files touched: ${filePaths.length > 0 ? filePaths.join(", ") : "none detected"}`,
      `Dependency changes: ${describeDependencyChanges(dependencyChanges)}`,
      `Failures observed: ${failures.length}`,
      `Issue clusters: ${describeIssueClusters(issueClusters)}`,
      `Active blockers: ${describeBlockingIssueClusters(issueClusters)}`,
      `Recovered clusters: ${describeRecoveredIssueClusters(issueClusters)}`,
      `Retry hotspots: ${describeRetryGroups(retries)}`,
    ].join("\n"),
    sourceRefs: buildSourceRefs([
      ...detail.messages.slice(0, 4).map((message) => ({
        type: "message" as const,
        id: message.id,
      })),
      ...detail.artifacts.slice(0, 6).map((artifact) => ({
        type: "artifact" as const,
        id: artifact.id,
      })),
      ...dependencyChanges.slice(0, 4).flatMap((change) => change.refs),
      ...failures.slice(0, 4).flatMap((failure) => failure.refs),
      ...issueClusters.slice(0, 4).flatMap((cluster) => cluster.refs),
      ...retries.slice(0, 3).flatMap((retry) => retry.refs),
    ]),
  };
}

function buildHandoff(
  detail: SessionDetail,
): Omit<NarrativeRecord, "id" | "createdAt" | "updatedAt"> {
  const openItems = collectOpenItems(detail);
  const failures = collectFailureSignals(detail);
  const latestError = detail.timeline
    .filter((event) => isFailureEvent(event))
    .at(-1);
  const retries = collectRetryGroups(detail);
  const issueClusters = collectIssueClusters(detail);
  const dependencyChanges = collectDependencyChanges(detail);
  const blockingFailures =
    failures.length > 0
      ? failures
          .slice(-3)
          .map((failure) => failure.summary)
          .join(" | ")
      : "none detected";

  return {
    sessionId: detail.session.id,
    kind: "handoff",
    content: [
      `Handoff for ${getSessionLabel(detail.session)}`,
      `Session status: ${detail.session.status}`,
      latestError
        ? `Latest failure: ${summarizeEvent(latestError, latestError.eventType)}`
        : null,
      `Blocking failures: ${blockingFailures}`,
      `Dependency changes: ${describeDependencyChanges(dependencyChanges)}`,
      `Issue clusters: ${describeIssueClusters(issueClusters)}`,
      `Blocking clusters: ${describeBlockingIssueClusters(issueClusters)}`,
      `Recovered clusters: ${describeRecoveredIssueClusters(issueClusters)}`,
      `Retry hotspots: ${describeRetryGroups(retries)}`,
      openItems.length > 0
        ? `Open items: ${openItems.map((item) => item.summary).join(" | ")}`
        : "Open items: none detected",
    ]
      .filter(Boolean)
      .join("\n"),
    sourceRefs: buildSourceRefs([
      ...openItems.slice(0, 5).flatMap((item) => item.refs),
      ...failures.slice(-3).flatMap((failure) => failure.refs),
      ...dependencyChanges.slice(0, 4).flatMap((change) => change.refs),
      ...issueClusters.slice(0, 5).flatMap((cluster) => cluster.refs),
      ...retries.slice(0, 3).flatMap((retry) => retry.refs),
      ...(latestError ? [{ type: "event" as const, id: latestError.id }] : []),
    ]),
  };
}

function buildDecisions(
  detail: SessionDetail,
): Array<Omit<DecisionRecord, "id" | "createdAt">> {
  return detail.messages
    .filter(
      (message) =>
        ACCEPTED_DECISION_PATTERN.test(message.content) ||
        PROPOSED_DECISION_PATTERN.test(message.content),
    )
    .map((message) => {
      const relatedEvent =
        detail.timeline.find(
          (event) => event.relatedMessageId === message.id,
        ) ?? null;
      const status = ACCEPTED_DECISION_PATTERN.test(message.content)
        ? "accepted"
        : "proposed";

      return {
        sessionId: detail.session.id,
        title: truncateSummary(message.content, 72),
        summary: message.content,
        rationale:
          detail.messages.find((candidate) => candidate.seq === message.seq + 1)
            ?.content ?? null,
        status,
        sourceRefs: buildSourceRefs([
          { type: "message", id: message.id },
          ...(relatedEvent
            ? [{ type: "event" as const, id: relatedEvent.id }]
            : []),
        ]),
      };
    });
}

export function runSemanticIngestion(
  db: EvidenceDatabase,
  sessionId: string,
): {
  narratives: NarrativeRecord[];
  decisions: DecisionRecord[];
} {
  const detail = db.getSessionDetail(sessionId);
  if (!detail) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const run = db.createIngestionRun({
    sessionId,
    stage: "semantic",
    status: "running",
  });

  try {
    const narratives = db.replaceNarrativesForSession(sessionId, [
      buildJournal(detail),
      buildProjectSummary(detail),
      buildHandoff(detail),
    ]);
    const decisions = db.replaceDecisionsForSession(
      sessionId,
      buildDecisions(detail),
    );

    db.completeIngestionRun(run.id, "completed");
    return { narratives, decisions };
  } catch (error) {
    db.completeIngestionRun(
      run.id,
      "failed",
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}
