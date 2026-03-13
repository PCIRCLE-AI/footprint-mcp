import {
  buildArtifactListHtml,
  buildContextCandidateListHtml,
  buildContextReportHtml,
  buildDecisionListHtml,
  buildErrorHtml,
  buildHistoryHandoffListHtml,
  buildMessageListHtml,
  buildMetaCardsHtml,
  buildNarrativeListHtml,
  buildSessionTrendContextHtml,
  buildSuccessHtml,
  buildTimelineListHtml,
  canReingestSession,
  escapeHtml,
  formatHostLabel,
  formatStatusLabel,
  formatWorkDisplayLabel,
} from "./session-ui";
import { getIntlLocale, t } from "./i18n";
import {
  downloadSessionArchive,
  type SessionArchiveDownload,
} from "./session-archive-download";

export interface SessionDetailApp {
  connect(): Promise<void>;
  callServerTool(request: {
    name: string;
    arguments: Record<string, unknown>;
  }): Promise<{ structuredContent?: unknown }>;
  ontoolresult?: ((result: { structuredContent?: unknown }) => void) | null;
}

interface SessionPageInfo {
  total: number;
  offset: number;
  limit: number;
  returned: number;
  hasMore: boolean;
  nextOffset: number | null;
}

interface SessionDetailData {
  session: {
    id: string;
    host: string;
    label: string;
    status: string;
    projectRoot: string;
    cwd: string;
    startedAt: string;
    endedAt: string | null;
  };
  messageSummary: {
    total: number;
    byRole: { user: number; assistant: number; system: number };
  };
  timelineSummary: {
    total: number;
    eventTypes: string[];
  };
  artifactSummary: {
    total: number;
    byType: {
      fileChange: number;
      commandOutput: number;
      testResult: number;
      gitCommit: number;
    };
  };
  trendContext: {
    summary: {
      totalTrends: number;
      crossSessionTrends: number;
      sessionAttempts: number;
      globalAttempts: number;
      otherSessions: number;
      activeBlockers: number;
      recoveredTrends: number;
      regressedTrends: number;
    };
    page?: SessionPageInfo;
    trends: Array<{
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
    }>;
  };
  messagePage?: SessionPageInfo;
  timelinePage?: SessionPageInfo;
  messages: Array<{ seq: number; role: string; content: string }>;
  timeline: Array<{ seq: number; eventType: string; summary: string | null }>;
  hasNarratives: boolean;
}

interface ContextListItem {
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

interface ContextReport {
  context: ContextListItem;
  currentTruth: {
    summary: string;
    latestSessionId: string;
    latestSessionLabel: string;
    latestSummaryNarrative: string | null;
    latestHandoff: string | null;
    activeBlockers: string[];
    openQuestions: string[];
  };
  activeDecisions: Array<{
    decisionId: string;
    title: string;
    summary: string;
    status: string;
    createdAt: string;
  }>;
  supersededDecisions: Array<{
    decisionId: string;
    title: string;
    summary: string;
    status: string;
    createdAt: string;
    supersededByTitle: string | null;
  }>;
  sessions: Array<{
    id: string;
    label: string;
    host: string;
    status: string;
    startedAt: string;
    endedAt: string | null;
  }>;
}

interface ContextCandidate {
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

interface ContextResolution {
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

interface ContextListResult {
  contexts: ContextListItem[];
  total: number;
}

interface ContextMutationResult {
  action: "confirmed" | "rejected" | "moved" | "merged" | "split" | "preferred";
  context: ContextListItem | null;
  affectedSessionIds: string[];
  contextId: string | null;
}

interface SessionMessagesPageData {
  sessionId: string;
  page: SessionPageInfo;
  messages: Array<{ seq: number; role: string; content: string }>;
}

interface SessionTrendsPageData {
  sessionId: string;
  summary: SessionDetailData["trendContext"]["summary"];
  page: SessionPageInfo;
  trends: SessionDetailData["trendContext"]["trends"];
}

interface SessionTimelinePageData {
  sessionId: string;
  page: SessionPageInfo;
  timeline: Array<{ seq: number; eventType: string; summary: string | null }>;
}

interface SessionArtifactsPageData {
  sessionId: string;
  page: SessionPageInfo;
  artifacts: Array<{
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
  }>;
}

interface SessionNarrativesPageData {
  sessionId: string;
  page: SessionPageInfo;
  narratives: Array<{ kind: string; content: string }>;
}

interface SessionDecisionsPageData {
  sessionId: string;
  page: SessionPageInfo;
  decisions: Array<{ title: string; status: string; summary: string }>;
}

interface HistoryHandoffReport {
  summary: {
    groupBy: "issue" | "family";
    headline: string;
  };
  blockers: string[];
  followUps: string[];
  recentSessions: Array<{
    id: string;
    label: string;
    host: string;
    status: string;
    startedAt: string;
  }>;
}

interface SessionExportResult {
  filename?: string;
  base64Data?: string;
  sessionCount?: number;
}

interface TrendScopeSelection {
  issueKey: string;
  groupBy: "issue" | "family";
  label: string;
}

interface TrendScopeHandoffState {
  scope: TrendScopeSelection;
  summaryText: string;
  listHtml: string;
}

const DEFAULT_SESSION_DETAIL_PAGE_LIMIT = 50;
export type { SessionArchiveDownload } from "./session-archive-download";
export { downloadSessionArchive } from "./session-archive-download";

function isSessionDetailData(value: unknown): value is SessionDetailData {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as SessionDetailData).session?.id === "string",
  );
}

function isHistoryHandoffReport(value: unknown): value is HistoryHandoffReport {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as HistoryHandoffReport).summary?.headline === "string" &&
    Array.isArray((value as HistoryHandoffReport).recentSessions),
  );
}

function isSessionPageInfo(value: unknown): value is SessionPageInfo {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as SessionPageInfo).total === "number" &&
    typeof (value as SessionPageInfo).offset === "number" &&
    typeof (value as SessionPageInfo).limit === "number" &&
    typeof (value as SessionPageInfo).returned === "number" &&
    typeof (value as SessionPageInfo).hasMore === "boolean" &&
    ("nextOffset" in (value as SessionPageInfo)
      ? (value as SessionPageInfo).nextOffset === null ||
        typeof (value as SessionPageInfo).nextOffset === "number"
      : false),
  );
}

function isSessionMessagesPageData(
  value: unknown,
): value is SessionMessagesPageData {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as SessionMessagesPageData).sessionId === "string" &&
    Array.isArray((value as SessionMessagesPageData).messages) &&
    isSessionPageInfo((value as SessionMessagesPageData).page),
  );
}

function isSessionTrendsPageData(
  value: unknown,
): value is SessionTrendsPageData {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as SessionTrendsPageData).sessionId === "string" &&
    Array.isArray((value as SessionTrendsPageData).trends) &&
    typeof (value as SessionTrendsPageData).summary?.totalTrends === "number" &&
    isSessionPageInfo((value as SessionTrendsPageData).page),
  );
}

function isSessionTimelinePageData(
  value: unknown,
): value is SessionTimelinePageData {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as SessionTimelinePageData).sessionId === "string" &&
    Array.isArray((value as SessionTimelinePageData).timeline) &&
    isSessionPageInfo((value as SessionTimelinePageData).page),
  );
}

function isSessionArtifactsPageData(
  value: unknown,
): value is SessionArtifactsPageData {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as SessionArtifactsPageData).sessionId === "string" &&
    Array.isArray((value as SessionArtifactsPageData).artifacts) &&
    isSessionPageInfo((value as SessionArtifactsPageData).page),
  );
}

function isSessionNarrativesPageData(
  value: unknown,
): value is SessionNarrativesPageData {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as SessionNarrativesPageData).sessionId === "string" &&
    Array.isArray((value as SessionNarrativesPageData).narratives) &&
    isSessionPageInfo((value as SessionNarrativesPageData).page),
  );
}

function isSessionDecisionsPageData(
  value: unknown,
): value is SessionDecisionsPageData {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as SessionDecisionsPageData).sessionId === "string" &&
    Array.isArray((value as SessionDecisionsPageData).decisions) &&
    isSessionPageInfo((value as SessionDecisionsPageData).page),
  );
}

function isContextListItem(value: unknown): value is ContextListItem {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as ContextListItem).id === "string" &&
    typeof (value as ContextListItem).label === "string" &&
    typeof (value as ContextListItem).workspaceKey === "string" &&
    typeof (value as ContextListItem).latestSessionId === "string" &&
    typeof (value as ContextListItem).latestSessionLabel === "string" &&
    typeof (value as ContextListItem).latestStartedAt === "string" &&
    Array.isArray((value as ContextListItem).hosts) &&
    Array.isArray((value as ContextListItem).statuses) &&
    Array.isArray((value as ContextListItem).signals),
  );
}

function isContextReport(value: unknown): value is ContextReport {
  return Boolean(
    value &&
    typeof value === "object" &&
    isContextListItem((value as ContextReport).context) &&
    typeof (value as ContextReport).currentTruth?.summary === "string" &&
    Array.isArray((value as ContextReport).currentTruth?.activeBlockers) &&
    Array.isArray((value as ContextReport).currentTruth?.openQuestions) &&
    Array.isArray((value as ContextReport).activeDecisions) &&
    Array.isArray((value as ContextReport).supersededDecisions) &&
    Array.isArray((value as ContextReport).sessions),
  );
}

function isContextCandidate(value: unknown): value is ContextCandidate {
  return Boolean(
    value &&
    typeof value === "object" &&
    ((value as ContextCandidate).kind === "existing-context" ||
      (value as ContextCandidate).kind === "new-context") &&
    typeof (value as ContextCandidate).label === "string" &&
    typeof (value as ContextCandidate).workspaceKey === "string" &&
    Array.isArray((value as ContextCandidate).reasons) &&
    Array.isArray((value as ContextCandidate).sessionIds),
  );
}

function isContextResolution(value: unknown): value is ContextResolution {
  return Boolean(
    value &&
    typeof value === "object" &&
    ((value as ContextResolution).mode === "linked" ||
      (value as ContextResolution).mode === "preferred" ||
      (value as ContextResolution).mode === "suggested" ||
      (value as ContextResolution).mode === "none") &&
    Array.isArray((value as ContextResolution).candidates) &&
    (value as ContextResolution).candidates.every(isContextCandidate) &&
    ((value as ContextResolution).currentContext === null ||
      isContextListItem((value as ContextResolution).currentContext)) &&
    ((value as ContextResolution).briefing === null ||
      isContextReport((value as ContextResolution).briefing)),
  );
}

function isContextListResult(value: unknown): value is ContextListResult {
  return Boolean(
    value &&
    typeof value === "object" &&
    Array.isArray((value as ContextListResult).contexts) &&
    (value as ContextListResult).contexts.every(isContextListItem) &&
    typeof (value as ContextListResult).total === "number",
  );
}

function isContextMutationResult(
  value: unknown,
): value is ContextMutationResult {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as ContextMutationResult).action === "string" &&
    Array.isArray((value as ContextMutationResult).affectedSessionIds),
  );
}

function formatDate(value: string | null): string {
  if (!value) return t("common.notAvailable");
  try {
    return new Date(value).toLocaleString(getIntlLocale());
  } catch {
    return value;
  }
}

function formatCountLabel(
  count: number,
  singular: string,
  plural = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function summarizePath(path: string, trailingSegments = 3): string {
  const normalized = path.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= trailingSegments) {
    return path;
  }
  return `${normalized.startsWith("/") ? "/" : ""}.../${parts.slice(-trailingSegments).join("/")}`;
}

export function bootSessionDetail(
  app: SessionDetailApp,
  rootDocument: Document = document,
  rootWindow: Window & typeof globalThis = window,
  downloadArchive: (archive: SessionArchiveDownload) => void = (archive) =>
    downloadSessionArchive(archive, rootDocument, rootWindow),
): () => void {
  let currentSessionId: string | null = null;
  let currentSessionStatus: string | null = null;
  let sessionRequestVersion = 0;
  let messageRequestVersion = 0;
  let trendRequestVersion = 0;
  let timelineRequestVersion = 0;
  let artifactRequestVersion = 0;
  let narrativeRequestVersion = 0;
  let decisionRequestVersion = 0;
  let handoffRequestVersion = 0;
  let contextRequestVersion = 0;
  let currentTrendScope: TrendScopeSelection | null = null;
  let currentTrendHandoffState: TrendScopeHandoffState | null = null;
  let exportingTrendScope: TrendScopeSelection | null = null;
  let currentSessionCwd: string | null = null;
  let currentSessionLabel: string | null = null;
  let currentMessages: SessionDetailData["messages"] = [];
  let currentTrends: SessionDetailData["trendContext"]["trends"] = [];
  let currentTimeline: SessionDetailData["timeline"] = [];
  let currentArtifacts: SessionArtifactsPageData["artifacts"] = [];
  let currentNarratives: SessionNarrativesPageData["narratives"] = [];
  let currentDecisions: SessionDecisionsPageData["decisions"] = [];
  let currentMessagePage: SessionPageInfo | null = null;
  let currentTrendPage: SessionPageInfo | null = null;
  let currentTimelinePage: SessionPageInfo | null = null;
  let currentArtifactPage: SessionPageInfo | null = null;
  let currentNarrativePage: SessionPageInfo | null = null;
  let currentDecisionPage: SessionPageInfo | null = null;
  let currentContextResolution: ContextResolution | null = null;
  let currentContextReport: ContextReport | null = null;
  let currentContextList: ContextListItem[] = [];
  const pendingInternalSessionIds = new Map<string, number>();

  function markPendingInternalSession(sessionId: string): void {
    pendingInternalSessionIds.set(
      sessionId,
      (pendingInternalSessionIds.get(sessionId) ?? 0) + 1,
    );
  }

  function clearPendingInternalSession(sessionId: string): void {
    const nextCount = (pendingInternalSessionIds.get(sessionId) ?? 0) - 1;
    if (nextCount <= 0) {
      pendingInternalSessionIds.delete(sessionId);
      return;
    }
    pendingInternalSessionIds.set(sessionId, nextCount);
  }

  function isPendingInternalSession(sessionId: string): boolean {
    return (pendingInternalSessionIds.get(sessionId) ?? 0) > 0;
  }

  function showError(message: string): void {
    const error = rootDocument.getElementById("error");
    if (!error) return;
    error.innerHTML = buildErrorHtml(message);
  }

  function showSuccess(message: string): void {
    const error = rootDocument.getElementById("error");
    if (!error) return;
    error.innerHTML = buildSuccessHtml(message);
  }

  function renderListHtml(id: string, html: string): void {
    const container = rootDocument.getElementById(id);
    if (!container) return;
    container.innerHTML = html;
  }

  function normalizePageInfo(
    page: SessionPageInfo | undefined,
    total: number,
    returned: number,
  ): SessionPageInfo {
    if (isSessionPageInfo(page)) {
      return page;
    }

    const limit = Math.max(returned, DEFAULT_SESSION_DETAIL_PAGE_LIMIT);
    const hasMore = returned < total;
    return {
      total,
      offset: 0,
      limit,
      returned,
      hasMore,
      nextOffset: hasMore ? returned : null,
    };
  }

  function setPagedLoadButton(
    id: string,
    page: SessionPageInfo | null,
    options: {
      loading: boolean;
      idleLabel: string;
      loadingLabel: string;
    },
  ): void {
    const button = rootDocument.getElementById(id) as HTMLButtonElement | null;
    if (!button) return;

    const hasMore = Boolean(page?.hasMore);
    button.hidden = !hasMore && !options.loading;
    button.disabled = !hasMore || options.loading;
    button.textContent = options.loading
      ? options.loadingLabel
      : options.idleLabel;
  }

  function renderMessages(
    messages: SessionDetailData["messages"],
    page: SessionPageInfo | null,
  ): void {
    currentMessages = messages;
    currentMessagePage = page;
    renderListHtml("messages", buildMessageListHtml(messages));
    setPagedLoadButton("load-more-messages", page, {
      loading: false,
      idleLabel: t("sessionDetail.loadMoreConversation"),
      loadingLabel: t("session.detail.loading.conversation"),
    });
  }

  function renderTimeline(
    timeline: SessionDetailData["timeline"],
    page: SessionPageInfo | null,
  ): void {
    currentTimeline = timeline;
    currentTimelinePage = page;
    renderListHtml("timeline", buildTimelineListHtml(timeline));
    setPagedLoadButton("load-more-timeline", page, {
      loading: false,
      idleLabel: t("sessionDetail.loadMoreSteps"),
      loadingLabel: t("session.detail.loading.steps"),
    });
  }

  function renderTrendContext(
    trends: SessionDetailData["trendContext"]["trends"],
    page: SessionPageInfo | null,
  ): void {
    currentTrends = trends;
    currentTrendPage = page;
    renderListHtml(
      "trend-context",
      buildSessionTrendContextHtml(trends, formatDate),
    );
    setPagedLoadButton("load-more-session-trends", page, {
      loading: false,
      idleLabel: t("sessionDetail.loadMoreRelatedWork"),
      loadingLabel: t("session.detail.loading.relatedWork"),
    });
  }

  function renderArtifacts(
    artifacts: SessionArtifactsPageData["artifacts"],
    page: SessionPageInfo | null,
  ): void {
    currentArtifacts = artifacts;
    currentArtifactPage = page;
    renderListHtml("artifacts", buildArtifactListHtml(artifacts));
    setPagedLoadButton("load-more-artifacts", page, {
      loading: false,
      idleLabel: t("sessionDetail.loadMoreSupporting"),
      loadingLabel: t("session.detail.loading.supporting"),
    });
  }

  function renderNarratives(
    narratives: SessionNarrativesPageData["narratives"],
    page: SessionPageInfo | null,
  ): void {
    currentNarratives = narratives;
    currentNarrativePage = page;
    renderListHtml("narratives", buildNarrativeListHtml(narratives));
    setPagedLoadButton("load-more-narratives", page, {
      loading: false,
      idleLabel: t("sessionDetail.loadMoreNarratives"),
      loadingLabel: t("session.detail.loading.summaries"),
    });
  }

  function renderDecisions(
    decisions: SessionDecisionsPageData["decisions"],
    page: SessionPageInfo | null,
  ): void {
    currentDecisions = decisions;
    currentDecisionPage = page;
    renderListHtml("decisions", buildDecisionListHtml(decisions));
    setPagedLoadButton("load-more-decisions", page, {
      loading: false,
      idleLabel: t("sessionDetail.loadMoreDecisions"),
      loadingLabel: t("session.detail.loading.decisions"),
    });
  }

  function setContextTargetOptions(selectedContextId?: string | null): void {
    const select = rootDocument.getElementById(
      "context-target-select",
    ) as HTMLSelectElement | null;
    const moveButton = rootDocument.getElementById(
      "move-context-button",
    ) as HTMLButtonElement | null;
    const activateButton = rootDocument.getElementById(
      "set-active-context-button",
    ) as HTMLButtonElement | null;
    if (!select) return;

    const selectedId =
      selectedContextId ??
      currentContextReport?.context.id ??
      currentContextList[0]?.id ??
      "";
    select.innerHTML =
      currentContextList.length === 0
        ? `<option value="">${escapeHtml(t("session.detail.context.none"))}</option>`
        : currentContextList
            .map((context) => {
              const selected = context.id === selectedId ? " selected" : "";
              return `<option value="${escapeHtml(context.id)}"${selected}>${escapeHtml(context.label)} · ${escapeHtml(summarizePath(context.workspaceKey))}</option>`;
            })
            .join("");
    select.disabled = currentContextList.length === 0;
    if (moveButton) {
      moveButton.disabled =
        !currentSessionId || currentContextList.length === 0 || !select.value;
    }
    if (activateButton) {
      activateButton.disabled =
        !currentSessionId || currentContextList.length === 0 || !select.value;
    }
  }

  function renderContextPanel(): void {
    const summary = rootDocument.getElementById("context-summary");
    const candidateSummary = rootDocument.getElementById(
      "context-candidates-summary",
    );
    const current = rootDocument.getElementById("context-current");
    const candidates = rootDocument.getElementById("context-candidates");
    if (!summary || !candidateSummary || !current || !candidates) {
      return;
    }

    if (!currentSessionId) {
      summary.textContent = t("session.detail.context.openRecord");
      current.innerHTML = `<li class="muted">${escapeHtml(t("sessionDetail.noConfirmedTopic"))}</li>`;
      candidateSummary.textContent = t(
        "session.detail.context.confirmationRequired",
      );
      candidates.innerHTML = `<li class="muted">${escapeHtml(t("session.detail.context.noOtherTopics"))}</li>`;
      setContextTargetOptions(null);
      return;
    }

    if (!currentContextResolution) {
      summary.textContent = t("session.detail.context.checking");
      current.innerHTML = `<li class="muted">${escapeHtml(t("session.detail.context.loadingConfirmed"))}</li>`;
      candidateSummary.textContent = t(
        "session.detail.context.loadingCandidatesSummary",
      );
      candidates.innerHTML = `<li class="muted">${escapeHtml(t("session.detail.context.loadingCandidates"))}</li>`;
      setContextTargetOptions(null);
      return;
    }

    if (currentContextReport) {
      summary.textContent = t("session.detail.context.alreadyLinked", {
        label: currentContextReport.context.label,
      });
      current.innerHTML = buildContextReportHtml(
        currentContextReport,
        formatDate,
      );
    } else {
      summary.textContent =
        currentContextResolution.mode === "suggested"
          ? t("session.detail.context.reviewSuggestions")
          : t("session.detail.context.notLinked");
      current.innerHTML = `<li class="muted">${escapeHtml(t("sessionDetail.noConfirmedTopic"))}</li>`;
    }

    const candidateCount = currentContextResolution.candidates.length;
    candidateSummary.textContent =
      candidateCount === 0
        ? t("session.detail.context.noSuggestions")
        : t("session.detail.context.suggestionCount", {
            count: candidateCount,
          });
    candidates.innerHTML = buildContextCandidateListHtml(
      currentContextResolution.candidates,
    );
    setContextTargetOptions();
  }

  function resetContextPanel(): void {
    contextRequestVersion += 1;
    currentContextResolution = null;
    currentContextReport = null;
    currentContextList = [];
    renderContextPanel();
  }

  async function refreshContextPanel(
    sessionId: string,
    options?: { selectedContextId?: string | null },
  ): Promise<void> {
    contextRequestVersion += 1;
    const currentRequestVersion = contextRequestVersion;
    currentContextResolution = null;
    currentContextReport = null;
    currentContextList = [];
    renderContextPanel();

    try {
      const [resolutionResult, contextsResult] = await Promise.all([
        app.callServerTool({
          name: "resolve-context",
          arguments: { sessionId },
        }),
        app.callServerTool({
          name: "list-contexts",
          arguments: {},
        }),
      ]);

      if (
        currentRequestVersion !== contextRequestVersion ||
        sessionId !== currentSessionId
      ) {
        return;
      }

      if (!isContextResolution(resolutionResult.structuredContent)) {
        throw new Error(t("session.detail.error.invalidContextResolution"));
      }
      if (!isContextListResult(contextsResult.structuredContent)) {
        throw new Error(t("session.detail.error.invalidContextList"));
      }

      currentContextResolution = resolutionResult.structuredContent;
      currentContextReport =
        currentContextResolution.mode === "linked" ||
        currentContextResolution.mode === "preferred"
          ? currentContextResolution.briefing
          : null;
      currentContextList = contextsResult.structuredContent.contexts;
      renderContextPanel();
      if (options?.selectedContextId) {
        setContextTargetOptions(options.selectedContextId);
      }
    } catch (error) {
      if (
        currentRequestVersion === contextRequestVersion &&
        sessionId === currentSessionId
      ) {
        currentContextResolution = {
          mode: "none",
          sessionId,
          cwd: currentSessionCwd,
          confirmationRequired: true,
          recommendedAction: "none",
          linkedContextId: null,
          currentContext: null,
          briefing: null,
          candidates: [],
        };
        currentContextReport = null;
        currentContextList = [];
        renderContextPanel();
      }
      throw error;
    }
  }

  function setScopeExportButton(scope: TrendScopeSelection | null): void {
    const exportButton = rootDocument.getElementById(
      "scope-export-button",
    ) as HTMLButtonElement | null;
    if (!exportButton) return;

    const buttonScope = exportingTrendScope ?? scope;
    exportButton.disabled = !scope || exportingTrendScope !== null;
    exportButton.textContent =
      buttonScope && exportingTrendScope
        ? t(
            buttonScope.groupBy === "family"
              ? "session.detail.scope.exportingBroader"
              : "session.detail.scope.exportingPickup",
          )
        : scope
          ? t(
              scope.groupBy === "family"
                ? "session.detail.scope.exportBroader"
                : "session.detail.scope.exportPickup",
            )
          : t("sessionDetail.pickupExport");
    exportButton.title = scope ? "" : t("session.detail.scope.loadFirst");
  }

  function renderScopeHandoffPlaceholder(message?: string): void {
    currentTrendScope = null;
    currentTrendHandoffState = null;
    const summary = rootDocument.getElementById("scope-handoff-summary");
    if (summary) {
      summary.textContent = message ?? t("sessionDetail.pickupNote.summary");
    }
    renderListHtml(
      "scope-handoff-results",
      `<li class="muted">${escapeHtml(
        message ?? t("session.detail.scope.none"),
      )}</li>`,
    );
    setScopeExportButton(null);
  }

  function resetScopeHandoff(message?: string): void {
    handoffRequestVersion += 1;
    renderScopeHandoffPlaceholder(message);
  }

  function renderScopeHandoffState(state: TrendScopeHandoffState): void {
    currentTrendScope = state.scope;
    currentTrendHandoffState = state;
    const summary = rootDocument.getElementById("scope-handoff-summary");
    if (summary) {
      summary.textContent = state.summaryText;
    }
    renderListHtml("scope-handoff-results", state.listHtml);
    setScopeExportButton(state.scope);
  }

  function renderScopeHandoff(
    report: HistoryHandoffReport,
    scope: TrendScopeSelection,
  ): void {
    renderScopeHandoffState({
      scope,
      summaryText: t("session.detail.scope.summaryText", {
        group:
          scope.groupBy === "family"
            ? t("session.dashboard.trends.group.family")
            : t("session.dashboard.trends.group.issue"),
        label: scope.label,
        headline: report.summary.headline,
      }),
      listHtml: buildHistoryHandoffListHtml(
        {
          blockers: report.blockers,
          followUps: report.followUps,
          recentSessions: report.recentSessions,
        },
        formatDate,
        { includeHostFilterButtons: false },
      ),
    });
  }

  async function loadTrendScopeHandoff(
    scope: TrendScopeSelection,
  ): Promise<void> {
    handoffRequestVersion += 1;
    const currentHandoffRequestVersion = handoffRequestVersion;
    const previousState = currentTrendHandoffState;
    const summary = rootDocument.getElementById("scope-handoff-summary");
    if (summary) {
      summary.textContent = t("session.detail.scope.loadingFor", {
        label: scope.label,
      });
    }
    renderListHtml(
      "scope-handoff-results",
      `<li class="muted">${escapeHtml(t("session.detail.scope.loading"))}</li>`,
    );
    setScopeExportButton(null);

    try {
      const result = await app.callServerTool({
        name: "get-history-handoff",
        arguments: {
          issueKey: scope.issueKey,
          groupBy: scope.groupBy,
        },
      });
      if (currentHandoffRequestVersion !== handoffRequestVersion) {
        return;
      }
      if (!isHistoryHandoffReport(result.structuredContent)) {
        throw new Error(t("session.detail.error.invalidScope"));
      }
      renderScopeHandoff(result.structuredContent, scope);
    } catch (error) {
      if (currentHandoffRequestVersion === handoffRequestVersion) {
        if (previousState) {
          renderScopeHandoffState(previousState);
        } else {
          renderScopeHandoffPlaceholder();
        }
      }
      throw error;
    }
  }

  async function exportTrendScope(): Promise<void> {
    const scope = currentTrendScope;
    if (!scope) {
      throw new Error(t("session.detail.scope.loadFirst"));
    }

    exportingTrendScope = scope;
    setScopeExportButton(currentTrendScope);

    try {
      const result = (await app.callServerTool({
        name: "export-sessions",
        arguments: {
          issueKey: scope.issueKey,
          groupBy: scope.groupBy,
          outputMode: "base64",
        },
      })) as {
        structuredContent?: SessionExportResult;
      };

      const exported = result.structuredContent;
      if (!exported?.base64Data || !exported.filename) {
        throw new Error(t("session.export.noArchive"));
      }

      downloadArchive({
        filename: exported.filename,
        base64Data: exported.base64Data,
        mimeType: "application/zip",
      });
      showSuccess(
        t("session.detail.scope.exportSuccess", {
          kind:
            scope.groupBy === "family"
              ? t("session.dashboard.trends.group.family")
              : t("session.dashboard.trends.group.issue"),
          filename: exported.filename,
        }),
      );
    } finally {
      exportingTrendScope = null;
      setScopeExportButton(currentTrendScope);
    }
  }

  function renderSession(detail: SessionDetailData): void {
    currentSessionId = detail.session.id;
    currentSessionStatus = detail.session.status;
    currentSessionCwd = detail.session.cwd;
    currentSessionLabel = detail.session.label;
    messageRequestVersion += 1;
    trendRequestVersion += 1;
    timelineRequestVersion += 1;
    artifactRequestVersion += 1;
    narrativeRequestVersion += 1;
    decisionRequestVersion += 1;

    const error = rootDocument.getElementById("error");
    if (error) {
      error.innerHTML = "";
    }

    const subtitle = rootDocument.getElementById("subtitle");
    if (subtitle) {
      subtitle.textContent = t("session.detail.subtitle", {
        label: formatWorkDisplayLabel(
          detail.session.label,
          detail.session.host,
        ),
        status: formatStatusLabel(detail.session.status),
        host: formatHostLabel(detail.session.host),
        startedAt: formatDate(detail.session.startedAt),
      });
    }

    const meta = rootDocument.getElementById("meta");
    if (meta) {
      const activeBlockers = detail.trendContext.summary.activeBlockers ?? 0;
      const regressedTrends = detail.trendContext.summary.regressedTrends ?? 0;
      meta.innerHTML = buildMetaCardsHtml([
        {
          label: t("session.detail.meta.aiHelper"),
          value: formatHostLabel(detail.session.host),
        },
        {
          label: t("session.detail.meta.currentState"),
          value: formatStatusLabel(detail.session.status),
        },
        {
          label: t("session.detail.meta.started"),
          value: formatDate(detail.session.startedAt),
        },
        {
          label: t("session.detail.meta.finished"),
          value: formatDate(detail.session.endedAt),
        },
        {
          label: t("session.detail.meta.conversation"),
          value: formatCountLabel(
            detail.messageSummary.total,
            t("common.message"),
            t("common.messages"),
          ),
        },
        {
          label: t("session.detail.meta.timeline"),
          value: formatCountLabel(
            detail.timelineSummary.total,
            t("common.step"),
            t("common.steps"),
          ),
        },
        {
          label: t("session.detail.meta.supporting"),
          value: formatCountLabel(
            detail.artifactSummary.total,
            t("common.item"),
            t("common.items"),
          ),
        },
        {
          label: t("session.detail.meta.related"),
          value:
            detail.trendContext.summary.totalTrends === 0
              ? t("session.detail.meta.relatedNone")
              : t("session.detail.meta.relatedSummary", {
                  patterns: formatCountLabel(
                    detail.trendContext.summary.totalTrends,
                    t("common.relatedPattern"),
                    t("common.relatedPatterns"),
                  ),
                  blockers: formatCountLabel(
                    activeBlockers,
                    t("common.activeBlocker"),
                    t("common.activeBlockers"),
                  ),
                  regressed: formatCountLabel(
                    regressedTrends,
                    t("common.returnedProblem"),
                    t("common.returnedProblems"),
                  ),
                }),
        },
        {
          label: t("session.detail.meta.overview"),
          value: detail.hasNarratives
            ? t("session.detail.meta.ready")
            : t("session.detail.meta.needsRefresh"),
        },
        {
          label: t("session.detail.meta.workedIn"),
          value: summarizePath(detail.session.cwd),
          note: t("session.detail.meta.pathNote"),
          valueClassName: "path-text",
          title: detail.session.cwd,
        },
      ]);
    }

    renderMessages(
      detail.messages,
      normalizePageInfo(
        detail.messagePage,
        detail.messageSummary.total,
        detail.messages.length,
      ),
    );
    renderTimeline(
      detail.timeline,
      normalizePageInfo(
        detail.timelinePage,
        detail.timelineSummary.total,
        detail.timeline.length,
      ),
    );
    renderTrendContext(
      detail.trendContext.trends,
      normalizePageInfo(
        detail.trendContext.page,
        detail.trendContext.summary.totalTrends,
        detail.trendContext.trends.length,
      ),
    );
    resetScopeHandoff();
    resetContextPanel();
    renderArtifacts([], null);
    renderNarratives([], null);
    renderDecisions([], null);

    const reingestButton = rootDocument.getElementById(
      "reingest-button",
    ) as HTMLButtonElement | null;
    if (reingestButton) {
      const reingestable = canReingestSession(detail.session.status);
      reingestButton.disabled = !reingestable;
      reingestButton.textContent = reingestable
        ? t("sessionDetail.refreshOverview")
        : t("session.reingest.inProgress");
      reingestButton.title = reingestable
        ? ""
        : t("session.reingest.whenStopped");
    }

    void refreshContextPanel(detail.session.id).catch((error) => {
      showError(
        error instanceof Error
          ? error.message
          : t("session.detail.context.refreshError"),
      );
    });
  }

  async function loadSessionDetail(sessionId: string): Promise<void> {
    sessionRequestVersion += 1;
    const currentRequestVersion = sessionRequestVersion;
    markPendingInternalSession(sessionId);

    try {
      const result = await app.callServerTool({
        name: "get-session",
        arguments: { id: sessionId },
      });

      if (currentRequestVersion !== sessionRequestVersion) {
        return;
      }

      if (!isSessionDetailData(result.structuredContent)) {
        throw new Error(t("session.detail.error.invalidDetail"));
      }

      renderSession(result.structuredContent);
    } finally {
      clearPendingInternalSession(sessionId);
    }
  }

  async function loadMoreMessages(): Promise<void> {
    const sessionId = currentSessionId;
    const page = currentMessagePage;
    if (!sessionId || !page?.hasMore || page.nextOffset === null) {
      return;
    }

    messageRequestVersion += 1;
    const currentRequestVersion = messageRequestVersion;
    setPagedLoadButton("load-more-messages", page, {
      loading: true,
      idleLabel: t("sessionDetail.loadMoreConversation"),
      loadingLabel: t("session.detail.loading.conversation"),
    });

    try {
      const result = await app.callServerTool({
        name: "get-session-messages",
        arguments: {
          id: sessionId,
          limit: page.limit,
          offset: page.nextOffset,
        },
      });

      if (
        currentRequestVersion !== messageRequestVersion ||
        sessionId !== currentSessionId
      ) {
        return;
      }

      if (!isSessionMessagesPageData(result.structuredContent)) {
        throw new Error(t("session.detail.error.invalidMessages"));
      }

      renderMessages(
        [...currentMessages, ...result.structuredContent.messages],
        result.structuredContent.page,
      );
    } finally {
      if (
        currentRequestVersion === messageRequestVersion &&
        sessionId === currentSessionId
      ) {
        setPagedLoadButton("load-more-messages", currentMessagePage, {
          loading: false,
          idleLabel: t("sessionDetail.loadMoreConversation"),
          loadingLabel: t("session.detail.loading.conversation"),
        });
      }
    }
  }

  async function loadMoreTimeline(): Promise<void> {
    const sessionId = currentSessionId;
    const page = currentTimelinePage;
    if (!sessionId || !page?.hasMore || page.nextOffset === null) {
      return;
    }

    timelineRequestVersion += 1;
    const currentRequestVersion = timelineRequestVersion;
    setPagedLoadButton("load-more-timeline", page, {
      loading: true,
      idleLabel: t("sessionDetail.loadMoreSteps"),
      loadingLabel: t("session.detail.loading.steps"),
    });

    try {
      const result = await app.callServerTool({
        name: "get-session-timeline",
        arguments: {
          id: sessionId,
          limit: page.limit,
          offset: page.nextOffset,
        },
      });

      if (
        currentRequestVersion !== timelineRequestVersion ||
        sessionId !== currentSessionId
      ) {
        return;
      }

      if (!isSessionTimelinePageData(result.structuredContent)) {
        throw new Error(t("session.detail.error.invalidTimeline"));
      }

      renderTimeline(
        [...currentTimeline, ...result.structuredContent.timeline],
        result.structuredContent.page,
      );
    } finally {
      if (
        currentRequestVersion === timelineRequestVersion &&
        sessionId === currentSessionId
      ) {
        setPagedLoadButton("load-more-timeline", currentTimelinePage, {
          loading: false,
          idleLabel: t("sessionDetail.loadMoreSteps"),
          loadingLabel: t("session.detail.loading.steps"),
        });
      }
    }
  }

  async function loadMoreTrends(): Promise<void> {
    const sessionId = currentSessionId;
    const page = currentTrendPage;
    if (!sessionId || !page?.hasMore || page.nextOffset === null) {
      return;
    }

    trendRequestVersion += 1;
    const currentRequestVersion = trendRequestVersion;
    setPagedLoadButton("load-more-session-trends", page, {
      loading: true,
      idleLabel: t("sessionDetail.loadMoreRelatedWork"),
      loadingLabel: t("session.detail.loading.relatedWork"),
    });

    try {
      const result = await app.callServerTool({
        name: "get-session-trends",
        arguments: {
          id: sessionId,
          limit: page.limit,
          offset: page.nextOffset,
        },
      });

      if (
        currentRequestVersion !== trendRequestVersion ||
        sessionId !== currentSessionId
      ) {
        return;
      }

      if (!isSessionTrendsPageData(result.structuredContent)) {
        throw new Error(t("session.detail.error.invalidTrends"));
      }

      renderTrendContext(
        [...currentTrends, ...result.structuredContent.trends],
        result.structuredContent.page,
      );
    } finally {
      if (
        currentRequestVersion === trendRequestVersion &&
        sessionId === currentSessionId
      ) {
        setPagedLoadButton("load-more-session-trends", currentTrendPage, {
          loading: false,
          idleLabel: t("sessionDetail.loadMoreRelatedWork"),
          loadingLabel: t("session.detail.loading.relatedWork"),
        });
      }
    }
  }

  async function loadMoreArtifacts(): Promise<void> {
    const sessionId = currentSessionId;
    const page = currentArtifactPage;
    if (!sessionId || !page?.hasMore || page.nextOffset === null) {
      return;
    }

    artifactRequestVersion += 1;
    const currentRequestVersion = artifactRequestVersion;
    setPagedLoadButton("load-more-artifacts", page, {
      loading: true,
      idleLabel: t("sessionDetail.loadMoreSupporting"),
      loadingLabel: t("session.detail.loading.supporting"),
    });

    try {
      const result = await app.callServerTool({
        name: "get-session-artifacts",
        arguments: {
          id: sessionId,
          limit: page.limit,
          offset: page.nextOffset,
        },
      });

      if (
        currentRequestVersion !== artifactRequestVersion ||
        sessionId !== currentSessionId
      ) {
        return;
      }

      if (!isSessionArtifactsPageData(result.structuredContent)) {
        throw new Error(t("session.detail.error.invalidArtifacts"));
      }

      renderArtifacts(
        [...currentArtifacts, ...result.structuredContent.artifacts],
        result.structuredContent.page,
      );
    } finally {
      if (
        currentRequestVersion === artifactRequestVersion &&
        sessionId === currentSessionId
      ) {
        setPagedLoadButton("load-more-artifacts", currentArtifactPage, {
          loading: false,
          idleLabel: t("sessionDetail.loadMoreSupporting"),
          loadingLabel: t("session.detail.loading.supporting"),
        });
      }
    }
  }

  async function loadMoreNarratives(): Promise<void> {
    const sessionId = currentSessionId;
    const page = currentNarrativePage;
    if (!sessionId || !page?.hasMore || page.nextOffset === null) {
      return;
    }

    narrativeRequestVersion += 1;
    const currentRequestVersion = narrativeRequestVersion;
    setPagedLoadButton("load-more-narratives", page, {
      loading: true,
      idleLabel: t("sessionDetail.loadMoreNarratives"),
      loadingLabel: t("session.detail.loading.summaries"),
    });

    try {
      const result = await app.callServerTool({
        name: "get-session-narrative",
        arguments: {
          id: sessionId,
          limit: page.limit,
          offset: page.nextOffset,
        },
      });

      if (
        currentRequestVersion !== narrativeRequestVersion ||
        sessionId !== currentSessionId
      ) {
        return;
      }

      if (!isSessionNarrativesPageData(result.structuredContent)) {
        throw new Error(t("session.detail.error.invalidNarratives"));
      }

      renderNarratives(
        [...currentNarratives, ...result.structuredContent.narratives],
        result.structuredContent.page,
      );
    } finally {
      if (
        currentRequestVersion === narrativeRequestVersion &&
        sessionId === currentSessionId
      ) {
        setPagedLoadButton("load-more-narratives", currentNarrativePage, {
          loading: false,
          idleLabel: t("sessionDetail.loadMoreNarratives"),
          loadingLabel: t("session.detail.loading.summaries"),
        });
      }
    }
  }

  async function loadMoreDecisions(): Promise<void> {
    const sessionId = currentSessionId;
    const page = currentDecisionPage;
    if (!sessionId || !page?.hasMore || page.nextOffset === null) {
      return;
    }

    decisionRequestVersion += 1;
    const currentRequestVersion = decisionRequestVersion;
    setPagedLoadButton("load-more-decisions", page, {
      loading: true,
      idleLabel: t("sessionDetail.loadMoreDecisions"),
      loadingLabel: t("session.detail.loading.decisions"),
    });

    try {
      const result = await app.callServerTool({
        name: "get-session-decisions",
        arguments: {
          id: sessionId,
          limit: page.limit,
          offset: page.nextOffset,
        },
      });

      if (
        currentRequestVersion !== decisionRequestVersion ||
        sessionId !== currentSessionId
      ) {
        return;
      }

      if (!isSessionDecisionsPageData(result.structuredContent)) {
        throw new Error(t("session.detail.error.invalidDecisions"));
      }

      renderDecisions(
        [...currentDecisions, ...result.structuredContent.decisions],
        result.structuredContent.page,
      );
    } finally {
      if (
        currentRequestVersion === decisionRequestVersion &&
        sessionId === currentSessionId
      ) {
        setPagedLoadButton("load-more-decisions", currentDecisionPage, {
          loading: false,
          idleLabel: t("sessionDetail.loadMoreDecisions"),
          loadingLabel: t("session.detail.loading.decisions"),
        });
      }
    }
  }

  function readSelectedContextId(): string | null {
    const select = rootDocument.getElementById(
      "context-target-select",
    ) as HTMLSelectElement | null;
    const value = select?.value?.trim();
    return value ? value : null;
  }

  async function runContextMutation(
    request: {
      name:
        | "confirm-context-link"
        | "reject-context-link"
        | "move-session-context"
        | "set-active-context";
      arguments: Record<string, unknown>;
    },
    successMessage: (result: ContextMutationResult) => string,
    options?: { selectedContextId?: string | null },
  ): Promise<void> {
    const sessionId = currentSessionId;
    if (!sessionId) {
      throw new Error(t("session.detail.error.noSession"));
    }

    const result = await app.callServerTool(request);
    if (!isContextMutationResult(result.structuredContent)) {
      throw new Error(t("session.detail.error.invalidContextMutation"));
    }
    if (sessionId !== currentSessionId) {
      return;
    }
    await refreshContextPanel(sessionId, options);
    showSuccess(successMessage(result.structuredContent));
  }

  resetScopeHandoff();

  const onClick = async (event: Event) => {
    const target = (event.target as Element | null)?.closest(
      "[data-action]",
    ) as HTMLElement | null;
    if (!target) return;

    const action = target.getAttribute("data-action");
    try {
      if (action === "detail") {
        const sessionId = target.getAttribute("data-session-id");
        if (!sessionId) return;
        await loadSessionDetail(sessionId);
        return;
      }

      if (action === "load-scope-handoff") {
        const issueKey = target.getAttribute("data-issue-key");
        const groupBy = target.getAttribute("data-group-by");
        const label = target.getAttribute("data-scope-label");
        if (
          !issueKey ||
          (groupBy !== "issue" && groupBy !== "family") ||
          !label
        ) {
          return;
        }
        await loadTrendScopeHandoff({ issueKey, groupBy, label });
        return;
      }

      if (action === "export-scope") {
        await exportTrendScope();
        return;
      }

      if (action === "load-more-messages") {
        await loadMoreMessages();
        return;
      }

      if (action === "load-more-session-trends") {
        await loadMoreTrends();
        return;
      }

      if (action === "load-more-timeline") {
        await loadMoreTimeline();
        return;
      }

      if (action === "load-more-artifacts") {
        await loadMoreArtifacts();
        return;
      }

      if (action === "load-more-narratives") {
        await loadMoreNarratives();
        return;
      }

      if (action === "load-more-decisions") {
        await loadMoreDecisions();
        return;
      }

      if (action === "refresh-context") {
        if (!currentSessionId) return;
        await refreshContextPanel(currentSessionId, {
          selectedContextId: readSelectedContextId(),
        });
        showSuccess(t("session.detail.context.refreshed"));
        return;
      }

      if (action === "confirm-context-candidate") {
        const contextId = target.getAttribute("data-context-id");
        if (!contextId || !currentSessionId) {
          return;
        }
        await runContextMutation(
          {
            name: "confirm-context-link",
            arguments: {
              sessionIds: [currentSessionId],
              contextId,
            },
          },
          (result) =>
            t("session.detail.context.linked", {
              label:
                result.context?.label ?? result.contextId ?? contextId ?? "",
            }),
          { selectedContextId: contextId },
        );
        return;
      }

      if (action === "confirm-context-new") {
        if (!currentSessionId) {
          return;
        }
        const label = target.getAttribute("data-context-label")?.trim();
        const sessionIds = [
          ...new Set(
            (target.getAttribute("data-session-ids") ?? "")
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean)
              .concat(currentSessionId),
          ),
        ];
        await runContextMutation(
          {
            name: "confirm-context-link",
            arguments: {
              sessionIds,
              label: label || currentSessionLabel || undefined,
            },
          },
          (result) =>
            t("session.detail.context.createdFromRelated", {
              label:
                result.context?.label ??
                label ??
                t("session.detail.context.newContext"),
            }),
          { selectedContextId: null },
        );
        return;
      }

      if (action === "reject-context-candidate") {
        const contextId = target.getAttribute("data-context-id");
        if (!contextId || !currentSessionId) {
          return;
        }
        await runContextMutation(
          {
            name: "reject-context-link",
            arguments: {
              sessionId: currentSessionId,
              contextId,
            },
          },
          () => t("session.detail.context.rejected", { label: contextId }),
          { selectedContextId: readSelectedContextId() },
        );
        return;
      }

      if (action === "move-to-selected-context") {
        const contextId = readSelectedContextId();
        if (!contextId || !currentSessionId) {
          return;
        }
        await runContextMutation(
          {
            name: "move-session-context",
            arguments: {
              sessionId: currentSessionId,
              contextId,
            },
          },
          (result) =>
            t("session.detail.context.moved", {
              label:
                result.context?.label ?? result.contextId ?? contextId ?? "",
            }),
          { selectedContextId: contextId },
        );
        return;
      }

      if (action === "create-context-from-session") {
        if (!currentSessionId) {
          return;
        }
        const input = rootDocument.getElementById(
          "context-create-label",
        ) as HTMLInputElement | null;
        const label = input?.value.trim() || undefined;
        await runContextMutation(
          {
            name: "move-session-context",
            arguments: {
              sessionId: currentSessionId,
              label,
            },
          },
          (result) =>
            t("session.detail.context.moved", {
              label:
                result.context?.label ??
                label ??
                t("session.detail.context.newContext"),
            }),
        );
        if (input) {
          input.value = "";
        }
        return;
      }

      if (action === "set-selected-context-active") {
        const contextId = readSelectedContextId();
        if (!contextId) {
          return;
        }
        await runContextMutation(
          {
            name: "set-active-context",
            arguments: {
              contextId,
              cwd: currentSessionCwd ?? undefined,
            },
          },
          (result) =>
            t("session.detail.context.preferred", {
              label:
                result.context?.label ?? result.contextId ?? contextId ?? "",
            }),
          { selectedContextId: contextId },
        );
        return;
      }
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : t("session.detail.error.action"),
      );
    }
  };

  async function withSession(
    callback: (sessionId: string) => Promise<void>,
  ): Promise<void> {
    if (!currentSessionId) {
      showError(t("session.detail.error.noSession"));
      return;
    }

    try {
      await callback(currentSessionId);
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : t("session.detail.error.sessionAction"),
      );
    }
  }

  (
    rootWindow as Window &
      typeof globalThis & {
        reingestSession: () => Promise<void>;
        exportSessionBundle: () => Promise<void>;
        loadArtifacts: () => Promise<void>;
        loadNarratives: () => Promise<void>;
        loadDecisions: () => Promise<void>;
      }
  ).reingestSession = async () => {
    if (!canReingestSession(currentSessionStatus ?? "")) {
      showError(t("session.reingest.notReady"));
      return;
    }

    await withSession(async (sessionId) => {
      await app.callServerTool({
        name: "reingest-session",
        arguments: { id: sessionId },
      });
      await loadSessionDetail(sessionId);
    });
  };

  (
    rootWindow as Window &
      typeof globalThis & {
        exportSessionBundle: () => Promise<void>;
      }
  ).exportSessionBundle = async () => {
    await withSession(async (sessionId) => {
      const result = (await app.callServerTool({
        name: "export-sessions",
        arguments: {
          sessionIds: [sessionId],
          outputMode: "base64",
        },
      })) as {
        structuredContent?: SessionExportResult;
      };
      const exported = result.structuredContent;
      if (!exported?.base64Data || !exported.filename) {
        throw new Error(t("session.export.noArchive"));
      }

      downloadArchive({
        filename: exported.filename,
        base64Data: exported.base64Data,
        mimeType: "application/zip",
      });
      showSuccess(
        t("session.detail.export.success", { filename: exported.filename }),
      );
    });
  };

  (
    rootWindow as Window &
      typeof globalThis & {
        loadArtifacts: () => Promise<void>;
      }
  ).loadArtifacts = async () => {
    await withSession(async (sessionId) => {
      artifactRequestVersion += 1;
      const currentRequestVersion = artifactRequestVersion;
      const result = (await app.callServerTool({
        name: "get-session-artifacts",
        arguments: {
          id: sessionId,
          limit: DEFAULT_SESSION_DETAIL_PAGE_LIMIT,
        },
      })) as { structuredContent?: unknown };
      if (
        currentRequestVersion !== artifactRequestVersion ||
        sessionId !== currentSessionId
      ) {
        return;
      }
      if (!isSessionArtifactsPageData(result.structuredContent)) {
        throw new Error(t("session.detail.error.invalidArtifacts"));
      }
      renderArtifacts(
        result.structuredContent.artifacts,
        result.structuredContent.page,
      );
    });
  };

  (
    rootWindow as Window &
      typeof globalThis & {
        loadNarratives: () => Promise<void>;
      }
  ).loadNarratives = async () => {
    await withSession(async (sessionId) => {
      narrativeRequestVersion += 1;
      const currentRequestVersion = narrativeRequestVersion;
      const result = (await app.callServerTool({
        name: "get-session-narrative",
        arguments: {
          id: sessionId,
          limit: DEFAULT_SESSION_DETAIL_PAGE_LIMIT,
        },
      })) as { structuredContent?: unknown };
      if (
        currentRequestVersion !== narrativeRequestVersion ||
        sessionId !== currentSessionId
      ) {
        return;
      }
      if (!isSessionNarrativesPageData(result.structuredContent)) {
        throw new Error(t("session.detail.error.invalidNarratives"));
      }
      renderNarratives(
        result.structuredContent.narratives,
        result.structuredContent.page,
      );
    });
  };

  (
    rootWindow as Window &
      typeof globalThis & {
        loadDecisions: () => Promise<void>;
      }
  ).loadDecisions = async () => {
    await withSession(async (sessionId) => {
      decisionRequestVersion += 1;
      const currentRequestVersion = decisionRequestVersion;
      const result = (await app.callServerTool({
        name: "get-session-decisions",
        arguments: {
          id: sessionId,
          limit: DEFAULT_SESSION_DETAIL_PAGE_LIMIT,
        },
      })) as { structuredContent?: unknown };
      if (
        currentRequestVersion !== decisionRequestVersion ||
        sessionId !== currentSessionId
      ) {
        return;
      }
      if (!isSessionDecisionsPageData(result.structuredContent)) {
        throw new Error(t("session.detail.error.invalidDecisions"));
      }
      renderDecisions(
        result.structuredContent.decisions,
        result.structuredContent.page,
      );
    });
  };

  app.ontoolresult = (result) => {
    if (!isSessionDetailData(result.structuredContent)) {
      return;
    }

    if (isPendingInternalSession(result.structuredContent.session.id)) {
      return;
    }

    sessionRequestVersion += 1;
    renderSession(result.structuredContent);
  };

  app.connect().catch((error) => {
    showError(
      error instanceof Error
        ? error.message
        : t("session.detail.error.connect"),
    );
  });

  rootDocument.addEventListener("click", onClick);

  return () => {
    rootDocument.removeEventListener("click", onClick);
    delete (
      rootWindow as Window &
        typeof globalThis & {
          reingestSession?: () => Promise<void>;
          exportSessionBundle?: () => Promise<void>;
          loadArtifacts?: () => Promise<void>;
          loadNarratives?: () => Promise<void>;
          loadDecisions?: () => Promise<void>;
        }
    ).reingestSession;
    delete (
      rootWindow as Window &
        typeof globalThis & {
          exportSessionBundle?: () => Promise<void>;
        }
    ).exportSessionBundle;
    delete (
      rootWindow as Window &
        typeof globalThis & {
          loadArtifacts?: () => Promise<void>;
        }
    ).loadArtifacts;
    delete (
      rootWindow as Window &
        typeof globalThis & {
          loadNarratives?: () => Promise<void>;
        }
    ).loadNarratives;
    delete (
      rootWindow as Window &
        typeof globalThis & {
          loadDecisions?: () => Promise<void>;
        }
    ).loadDecisions;
  };
}
