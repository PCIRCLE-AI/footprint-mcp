import {
  buildContextOverviewHtml,
  buildErrorHtml,
  buildHistoryHandoffListHtml,
  buildHistorySearchResultsHtml,
  buildHistoryTrendListHtml,
  buildSessionRowsHtml,
  buildSuccessHtml,
  canReingestSession,
  formatWorkDisplayLabel,
} from "./session-ui";
import { getIntlLocale, t } from "./i18n";
import {
  downloadSessionArchive,
  type SessionArchiveDownload,
} from "./session-archive-download";

export interface SessionDashboardApp {
  connect(): Promise<void>;
  callServerTool(request: {
    name: string;
    arguments: Record<string, unknown>;
  }): Promise<{ structuredContent?: unknown }>;
  ontoolresult?: ((result: { structuredContent?: unknown }) => void) | null;
}

interface SessionRow {
  id: string;
  host: string;
  label: string;
  status: string;
  startedAt: string;
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

interface SessionListResult {
  sessions: SessionRow[];
  total?: number;
  filters?: {
    query?: string;
    issueKey?: string;
    host?: string;
    status?: string;
  };
}

interface ContextListResult {
  contexts: ContextListItem[];
  total: number;
}

interface HistorySearchResult {
  query?: string;
  filters?: {
    host?: string;
    status?: string;
  };
  results: Array<{
    sessionId: string;
    host: string;
    label: string;
    status: string;
    startedAt: string;
    snippets: string[];
  }>;
  total?: number;
}

interface HistoryTrendReport {
  filters?: {
    query?: string;
    issueKey?: string;
    host?: string;
    status?: string;
    groupBy?: "issue" | "family";
  };
  summary: {
    groupBy: "issue" | "family";
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
  };
  trends: Array<{
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
    sessions: Array<{
      sessionId: string;
      label: string;
      host: string;
      status: string;
      attempts: number;
      latestOutcome: string;
    }>;
  }>;
  total?: number;
}

interface HistoryHandoffReport {
  filters?: {
    query?: string;
    issueKey?: string;
    host?: string;
    status?: string;
    groupBy?: "issue" | "family";
  };
  summary: {
    groupBy: "issue" | "family";
    headline: string;
    matchingSessions: number;
    matchingHosts: string[];
    statuses: string[];
    totalTrends: number;
    blockingTrends: number;
    recoveredTrends: number;
    regressedTrends: number;
    unresolvedQuestions: number;
    latestSessionId: string | null;
    latestSessionLabel: string | null;
    latestStartedAt: string | null;
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
  markdown: string;
}

interface DashboardFilters {
  query: string;
  issueKey: string;
  host: string;
  status: string;
  groupBy: "issue" | "family";
}

interface SessionExportResult {
  filename?: string;
  base64Data?: string;
  sessionCount?: number;
}

interface PaginationState {
  limit: number;
  total: number;
  loaded: number;
  loading: boolean;
}

const SESSION_PAGE_SIZE = 8;
const TREND_PAGE_SIZE = 6;
const SEARCH_PAGE_SIZE = 6;

function isSessionListResult(value: unknown): value is SessionListResult {
  return Boolean(
    value &&
    typeof value === "object" &&
    Array.isArray((value as SessionListResult).sessions),
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

function isContextListResult(value: unknown): value is ContextListResult {
  return Boolean(
    value &&
    typeof value === "object" &&
    Array.isArray((value as ContextListResult).contexts) &&
    (value as ContextListResult).contexts.every(isContextListItem) &&
    typeof (value as ContextListResult).total === "number",
  );
}

function isHistorySearchResult(value: unknown): value is HistorySearchResult {
  return Boolean(
    value &&
    typeof value === "object" &&
    Array.isArray((value as HistorySearchResult).results),
  );
}

function isHistoryTrendReport(value: unknown): value is HistoryTrendReport {
  return Boolean(
    value &&
    typeof value === "object" &&
    typeof (value as HistoryTrendReport).summary?.totalTrends === "number" &&
    Array.isArray((value as HistoryTrendReport).trends),
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

function formatDate(value: string): string {
  try {
    return new Date(value).toLocaleString(getIntlLocale());
  } catch {
    return value;
  }
}

function getInputValue(rootDocument: Document, id: string): string {
  const input = rootDocument.getElementById(id) as
    | HTMLInputElement
    | HTMLSelectElement
    | null;
  return input?.value ?? "";
}

function setInputValue(
  rootDocument: Document,
  id: string,
  value: string,
): void {
  const input = rootDocument.getElementById(id) as
    | HTMLInputElement
    | HTMLSelectElement
    | null;
  if (input) {
    input.value = value;
  }
}

function readDashboardFilters(rootDocument: Document): DashboardFilters {
  return {
    query: getInputValue(rootDocument, "query-filter").trim(),
    issueKey: getInputValue(rootDocument, "issue-key-filter").trim(),
    host: getInputValue(rootDocument, "host-filter"),
    status: getInputValue(rootDocument, "status-filter"),
    groupBy:
      (getInputValue(rootDocument, "group-by-filter") as "issue" | "family") ||
      "issue",
  };
}

function applyDashboardFilters(
  rootDocument: Document,
  filters: Partial<DashboardFilters>,
): void {
  if (filters.query !== undefined) {
    setInputValue(rootDocument, "query-filter", filters.query);
  }
  if (filters.issueKey !== undefined) {
    setInputValue(rootDocument, "issue-key-filter", filters.issueKey);
  }
  if (filters.host !== undefined) {
    setInputValue(rootDocument, "host-filter", filters.host);
  }
  if (filters.status !== undefined) {
    setInputValue(rootDocument, "status-filter", filters.status);
  }
  if (filters.groupBy !== undefined) {
    setInputValue(rootDocument, "group-by-filter", filters.groupBy);
  }
}

function buildDashboardToolFilters(filters: DashboardFilters): {
  sessionFilters: {
    query?: string;
    issueKey?: string;
    host?: string;
    status?: string;
  };
  trendFilters: {
    query?: string;
    issueKey?: string;
    host?: string;
    status?: string;
    groupBy: "issue" | "family";
  };
  handoffFilters: {
    query?: string;
    issueKey?: string;
    host?: string;
    status?: string;
    groupBy: "issue" | "family";
  };
  searchFilters: {
    query?: string;
    host?: string;
    status?: string;
  };
  exportFilters: {
    query?: string;
    issueKey?: string;
    host?: string;
    status?: string;
    groupBy: "issue" | "family";
  };
} {
  const query = filters.query || undefined;
  const issueKey = filters.issueKey || undefined;
  const host = filters.host || undefined;
  const status = filters.status || undefined;

  return {
    sessionFilters: {
      query,
      issueKey,
      host,
      status,
    },
    trendFilters: {
      query,
      issueKey,
      host,
      status,
      groupBy: filters.groupBy,
    },
    handoffFilters: {
      query,
      issueKey,
      host,
      status,
      groupBy: filters.groupBy,
    },
    searchFilters: {
      query,
      host,
      status,
    },
    exportFilters: {
      query,
      issueKey,
      host,
      status,
      groupBy: filters.groupBy,
    },
  };
}

function buildFiltersKey(filters: DashboardFilters): string {
  return JSON.stringify(filters);
}

function setButtonBusy(
  rootDocument: Document,
  id: string,
  loading: boolean,
  labels: { idle: string; busy: string },
): void {
  const button = rootDocument.getElementById(id) as HTMLButtonElement | null;
  if (!button) return;
  button.disabled = loading;
  button.textContent = loading ? labels.busy : labels.idle;
}

function updateLoadMoreButton(
  rootDocument: Document,
  options: {
    id: string;
    loaded: number;
    total: number;
    loading: boolean;
    idleLabel: string;
    busyLabel: string;
  },
): void {
  const button = rootDocument.getElementById(
    options.id,
  ) as HTMLButtonElement | null;
  if (!button) return;

  const hasMore = options.loaded < options.total;
  button.hidden = !hasMore && !options.loading;
  button.disabled = options.loading || !hasMore;
  button.textContent = options.loading ? options.busyLabel : options.idleLabel;
}

export function bootSessionDashboard(
  app: SessionDashboardApp,
  rootDocument: Document = document,
  rootWindow: Window & typeof globalThis = window,
  downloadArchive: (archive: SessionArchiveDownload) => void = (archive) =>
    downloadSessionArchive(archive, rootDocument, rootWindow),
): () => void {
  let hasSessionData = false;
  let hasContextData = false;
  let hasTrendData = false;
  let hasSearchData = false;
  let hasHandoffData = false;
  let suppressToolResultDepth = 0;
  let requestVersion = 0;
  let activeFiltersKey = buildFiltersKey(readDashboardFilters(rootDocument));

  const sessionState = {
    items: [] as SessionRow[],
    page: {
      limit: SESSION_PAGE_SIZE,
      total: 0,
      loaded: 0,
      loading: false,
    } satisfies PaginationState,
  };
  const searchState = {
    items: [] as HistorySearchResult["results"],
    page: {
      limit: SEARCH_PAGE_SIZE,
      total: 0,
      loaded: 0,
      loading: false,
    } satisfies PaginationState,
  };
  const contextState = {
    items: [] as ContextListItem[],
    total: 0,
  };
  const trendState = {
    report: null as HistoryTrendReport | null,
    page: {
      limit: TREND_PAGE_SIZE,
      total: 0,
      loaded: 0,
      loading: false,
    } satisfies PaginationState,
  };

  function resetPaginationState(): void {
    sessionState.items = [];
    sessionState.page.total = 0;
    sessionState.page.loaded = 0;
    sessionState.page.loading = false;
    searchState.items = [];
    searchState.page.total = 0;
    searchState.page.loaded = 0;
    searchState.page.loading = false;
    trendState.report = null;
    trendState.page.total = 0;
    trendState.page.loaded = 0;
    trendState.page.loading = false;
  }

  function applySessionList(
    result: SessionListResult,
    mode: "replace" | "append" = "replace",
  ): void {
    hasSessionData = true;
    const total = result.total ?? result.sessions.length;
    sessionState.items =
      mode === "append"
        ? [...sessionState.items, ...result.sessions]
        : [...result.sessions];
    sessionState.page.total = total;
    sessionState.page.loaded = sessionState.items.length;
    renderSessions(sessionState.items, total);
  }

  function applyContextList(result: ContextListResult): void {
    hasContextData = true;
    contextState.items = [...result.contexts];
    contextState.total = result.total;
    renderContexts(contextState.items, contextState.total);
  }

  function applySearchResults(
    result: HistorySearchResult,
    mode: "replace" | "append" = "replace",
  ): void {
    hasSearchData = true;
    const total = result.total ?? result.results.length;
    searchState.items =
      mode === "append"
        ? [...searchState.items, ...result.results]
        : [...result.results];
    searchState.page.total = total;
    searchState.page.loaded = searchState.items.length;
    renderSearchResults(searchState.items, total);
  }

  function applyTrendReport(
    report: HistoryTrendReport,
    mode: "replace" | "append" = "replace",
  ): void {
    hasTrendData = true;
    const mergedTrends =
      mode === "append" && trendState.report
        ? [...trendState.report.trends, ...report.trends]
        : [...report.trends];
    trendState.report = {
      ...report,
      trends: mergedTrends,
    };
    trendState.page.total = report.total ?? report.summary.totalTrends;
    trendState.page.loaded = mergedTrends.length;
    renderTrends(trendState.report);
  }

  async function callInternalTool(request: {
    name: string;
    arguments: Record<string, unknown>;
  }): Promise<{ structuredContent?: unknown }> {
    suppressToolResultDepth += 1;
    try {
      return await app.callServerTool(request);
    } finally {
      suppressToolResultDepth -= 1;
    }
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

  function renderSessions(sessions: SessionRow[], total: number): void {
    const summary = rootDocument.getElementById("summary");
    const rows = rootDocument.getElementById("rows");
    const error = rootDocument.getElementById("error");
    if (!summary || !rows) return;

    if (error) {
      error.innerHTML = "";
    }
    summary.textContent =
      total === 0
        ? t("session.dashboard.summary.noWork")
        : t("session.dashboard.summary.showingWork", {
            visible: sessions.length,
            total,
          });
    rows.innerHTML = buildSessionRowsHtml(sessions, formatDate);
    updateLoadMoreButton(rootDocument, {
      id: "load-more-sessions",
      loaded: sessionState.page.loaded,
      total: sessionState.page.total,
      loading: sessionState.page.loading,
      idleLabel: t("sessionDashboard.loadMoreSessions"),
      busyLabel: t("session.dashboard.loading.work"),
    });
  }

  function renderSearchResults(
    results: HistorySearchResult["results"],
    total: number,
  ): void {
    const summary = rootDocument.getElementById("search-summary");
    const rows = rootDocument.getElementById("search-results");
    if (!summary || !rows) return;

    summary.textContent =
      total === 0
        ? t("session.dashboard.search.noMatches")
        : t("session.dashboard.search.showingMatches", {
            visible: results.length,
            total,
          });
    rows.innerHTML = buildHistorySearchResultsHtml(results, formatDate);
    updateLoadMoreButton(rootDocument, {
      id: "load-more-search",
      loaded: searchState.page.loaded,
      total: searchState.page.total,
      loading: searchState.page.loading,
      idleLabel: t("sessionDashboard.loadMoreSearch"),
      busyLabel: t("session.dashboard.loading.results"),
    });
  }

  function renderContexts(contexts: ContextListItem[], total: number): void {
    const summary = rootDocument.getElementById("context-summary");
    const rows = rootDocument.getElementById("context-results");
    if (!summary || !rows) return;

    summary.textContent =
      total === 0
        ? t("session.dashboard.context.noTopics")
        : t("session.dashboard.context.showingTopics", {
            visible: contexts.length,
            total,
          });
    rows.innerHTML = buildContextOverviewHtml(contexts, formatDate);
  }

  function renderSearchPlaceholder(): void {
    const summary = rootDocument.getElementById("search-summary");
    const rows = rootDocument.getElementById("search-results");
    if (!summary || !rows) return;

    summary.textContent = t("session.dashboard.search.placeholderSummary");
    rows.innerHTML = `<li class="muted">${t("sessionDashboard.search.empty")}</li>`;
    searchState.page.total = 0;
    searchState.page.loaded = 0;
    searchState.page.loading = false;
    updateLoadMoreButton(rootDocument, {
      id: "load-more-search",
      loaded: 0,
      total: 0,
      loading: false,
      idleLabel: t("sessionDashboard.loadMoreSearch"),
      busyLabel: t("session.dashboard.loading.results"),
    });
  }

  function renderTrends(
    report: Pick<HistoryTrendReport, "summary" | "trends"> & { total?: number },
  ): void {
    const summary = rootDocument.getElementById("trend-summary");
    const rows = rootDocument.getElementById("trend-results");
    if (!summary || !rows) return;

    const activeBlockers = report.summary.activeBlockers ?? 0;
    const recoveredTrends = report.summary.recoveredTrends ?? 0;
    const regressedTrends = report.summary.regressedTrends ?? 0;
    const totalTrends = report.total ?? report.summary.totalTrends;
    summary.textContent =
      totalTrends === 0
        ? t("session.dashboard.trends.none")
        : t("session.dashboard.trends.summary", {
            visible: report.trends.length,
            total: totalTrends,
            active: activeBlockers,
            recovered: recoveredTrends,
            regressed: regressedTrends,
            grouping:
              report.summary.groupBy === "family"
                ? t("session.dashboard.trends.group.family")
                : t("session.dashboard.trends.group.issue"),
          });
    rows.innerHTML = buildHistoryTrendListHtml(report.trends, formatDate);
    updateLoadMoreButton(rootDocument, {
      id: "load-more-trends",
      loaded: trendState.page.loaded,
      total: trendState.page.total,
      loading: trendState.page.loading,
      idleLabel: t("sessionDashboard.loadMoreTrends"),
      busyLabel: t("session.dashboard.loading.trends"),
    });
  }

  function renderHandoff(report: HistoryHandoffReport): void {
    hasHandoffData = true;
    const summary = rootDocument.getElementById("handoff-summary");
    const rows = rootDocument.getElementById("handoff-results");
    if (!summary || !rows) return;

    const latestSessionLine =
      report.summary.latestSessionLabel && report.summary.latestStartedAt
        ? ` ${t("session.dashboard.handoff.latest", {
            label: formatWorkDisplayLabel(report.summary.latestSessionLabel),
            startedAt: formatDate(report.summary.latestStartedAt),
          })}`
        : report.summary.latestSessionLabel
          ? ` ${t("session.dashboard.handoff.latestNoTime", {
              label: formatWorkDisplayLabel(report.summary.latestSessionLabel),
            })}`
          : "";
    summary.textContent =
      report.summary.matchingSessions === 0
        ? t("context.nothingUrgent")
        : t("session.dashboard.handoff.summary", {
            sessions: report.summary.matchingSessions,
            blockers: report.summary.blockingTrends,
            latest: latestSessionLine.trim(),
          });
    rows.innerHTML = buildHistoryHandoffListHtml(
      {
        blockers: report.blockers,
        recoveries: report.recoveries,
        followUps: report.followUps,
        recentSessions: report.recentSessions,
      },
      formatDate,
    );
  }

  app.ontoolresult = (result) => {
    if (suppressToolResultDepth > 0) {
      return;
    }

    if (isSessionListResult(result.structuredContent)) {
      hasSessionData = true;
      applyDashboardFilters(rootDocument, {
        query:
          result.structuredContent.filters?.query ??
          getInputValue(rootDocument, "query-filter"),
        issueKey:
          result.structuredContent.filters?.issueKey ??
          getInputValue(rootDocument, "issue-key-filter"),
        host:
          result.structuredContent.filters?.host ??
          getInputValue(rootDocument, "host-filter"),
        status:
          result.structuredContent.filters?.status ??
          getInputValue(rootDocument, "status-filter"),
      });
      activeFiltersKey = buildFiltersKey(readDashboardFilters(rootDocument));
      applySessionList(result.structuredContent, "replace");
      return;
    }

    if (isContextListResult(result.structuredContent)) {
      hasContextData = true;
      applyContextList(result.structuredContent);
      return;
    }

    if (isHistoryTrendReport(result.structuredContent)) {
      hasTrendData = true;
      applyDashboardFilters(rootDocument, {
        query:
          result.structuredContent.filters?.query ??
          getInputValue(rootDocument, "query-filter"),
        issueKey:
          result.structuredContent.filters?.issueKey ??
          getInputValue(rootDocument, "issue-key-filter"),
        host:
          result.structuredContent.filters?.host ??
          getInputValue(rootDocument, "host-filter"),
        status:
          result.structuredContent.filters?.status ??
          getInputValue(rootDocument, "status-filter"),
        groupBy:
          result.structuredContent.filters?.groupBy ??
          getInputValue(rootDocument, "group-by-filter"),
      });
      activeFiltersKey = buildFiltersKey(readDashboardFilters(rootDocument));
      applyTrendReport(result.structuredContent, "replace");
      return;
    }

    if (isHistoryHandoffReport(result.structuredContent)) {
      hasHandoffData = true;
      applyDashboardFilters(rootDocument, {
        query:
          result.structuredContent.filters?.query ??
          getInputValue(rootDocument, "query-filter"),
        issueKey:
          result.structuredContent.filters?.issueKey ??
          getInputValue(rootDocument, "issue-key-filter"),
        host:
          result.structuredContent.filters?.host ??
          getInputValue(rootDocument, "host-filter"),
        status:
          result.structuredContent.filters?.status ??
          getInputValue(rootDocument, "status-filter"),
        groupBy:
          result.structuredContent.filters?.groupBy ??
          getInputValue(rootDocument, "group-by-filter"),
      });
      activeFiltersKey = buildFiltersKey(readDashboardFilters(rootDocument));
      renderHandoff(result.structuredContent);
      return;
    }

    if (isHistorySearchResult(result.structuredContent)) {
      hasSearchData = true;
      applyDashboardFilters(rootDocument, {
        query:
          result.structuredContent.query ??
          getInputValue(rootDocument, "query-filter"),
        host:
          result.structuredContent.filters?.host ??
          getInputValue(rootDocument, "host-filter"),
        status:
          result.structuredContent.filters?.status ??
          getInputValue(rootDocument, "status-filter"),
      });
      activeFiltersKey = buildFiltersKey(readDashboardFilters(rootDocument));
      applySearchResults(result.structuredContent, "replace");
    }
  };

  async function refreshDashboard(): Promise<void> {
    const filters = readDashboardFilters(rootDocument);
    activeFiltersKey = buildFiltersKey(filters);
    requestVersion += 1;
    const currentRequestVersion = requestVersion;
    resetPaginationState();
    const { sessionFilters, trendFilters, handoffFilters, searchFilters } =
      buildDashboardToolFilters(filters);
    setButtonBusy(rootDocument, "load-more-sessions", true, {
      idle: t("sessionDashboard.loadMoreSessions"),
      busy: t("session.dashboard.loading.work"),
    });
    setButtonBusy(rootDocument, "load-more-trends", true, {
      idle: t("sessionDashboard.loadMoreTrends"),
      busy: t("session.dashboard.loading.trends"),
    });
    sessionState.page.loading = true;
    trendState.page.loading = true;

    const requests: Array<Promise<void>> = [
      callInternalTool({
        name: "list-contexts",
        arguments: {},
      }).then((result) => {
        if (currentRequestVersion !== requestVersion) return;
        if (isContextListResult(result.structuredContent)) {
          applyContextList(result.structuredContent);
        }
      }),
      callInternalTool({
        name: "list-sessions",
        arguments: {
          ...sessionFilters,
          limit: sessionState.page.limit,
          offset: 0,
        },
      }).then((result) => {
        if (currentRequestVersion !== requestVersion) return;
        if (isSessionListResult(result.structuredContent)) {
          applySessionList(result.structuredContent, "replace");
        }
      }),
      callInternalTool({
        name: "get-history-trends",
        arguments: {
          ...trendFilters,
          limit: trendState.page.limit,
          offset: 0,
        },
      }).then((result) => {
        if (currentRequestVersion !== requestVersion) return;
        if (isHistoryTrendReport(result.structuredContent)) {
          applyTrendReport(result.structuredContent, "replace");
        }
      }),
      callInternalTool({
        name: "get-history-handoff",
        arguments: handoffFilters,
      }).then((result) => {
        if (currentRequestVersion !== requestVersion) return;
        if (isHistoryHandoffReport(result.structuredContent)) {
          renderHandoff(result.structuredContent);
        }
      }),
    ];

    if (filters.query) {
      setButtonBusy(rootDocument, "load-more-search", true, {
        idle: t("sessionDashboard.loadMoreSearch"),
        busy: t("session.dashboard.loading.results"),
      });
      searchState.page.loading = true;
      requests.push(
        callInternalTool({
          name: "search-history",
          arguments: {
            ...searchFilters,
            limit: searchState.page.limit,
            offset: 0,
          },
        }).then((result) => {
          if (currentRequestVersion !== requestVersion) return;
          if (isHistorySearchResult(result.structuredContent)) {
            applySearchResults(result.structuredContent, "replace");
          }
        }),
      );
    } else {
      hasSearchData = false;
      renderSearchPlaceholder();
    }

    try {
      await Promise.all(requests);
    } finally {
      if (currentRequestVersion === requestVersion) {
        sessionState.page.loading = false;
        trendState.page.loading = false;
        searchState.page.loading = false;
        updateLoadMoreButton(rootDocument, {
          id: "load-more-sessions",
          loaded: sessionState.page.loaded,
          total: sessionState.page.total,
          loading: false,
          idleLabel: t("sessionDashboard.loadMoreSessions"),
          busyLabel: t("session.dashboard.loading.work"),
        });
        updateLoadMoreButton(rootDocument, {
          id: "load-more-trends",
          loaded: trendState.page.loaded,
          total: trendState.page.total,
          loading: false,
          idleLabel: t("sessionDashboard.loadMoreTrends"),
          busyLabel: t("session.dashboard.loading.trends"),
        });
        updateLoadMoreButton(rootDocument, {
          id: "load-more-search",
          loaded: searchState.page.loaded,
          total: searchState.page.total,
          loading: false,
          idleLabel: t("sessionDashboard.loadMoreSearch"),
          busyLabel: t("session.dashboard.loading.results"),
        });
      }
    }
  }

  const onClick = async (event: Event) => {
    const target = (event.target as Element | null)?.closest(
      "[data-action]",
    ) as HTMLElement | null;
    if (!target) return;

    const action = target.getAttribute("data-action");
    if (!action) return;

    try {
      if (action === "detail") {
        const sessionId = target.getAttribute("data-session-id");
        if (!sessionId) return;
        await app.callServerTool({
          name: "get-session",
          arguments: { id: sessionId },
        });
        return;
      }

      if (action === "ingest") {
        const sessionId = target.getAttribute("data-session-id");
        if (!sessionId) return;
        const sessionStatus = target.getAttribute("data-session-status") ?? "";
        if (!canReingestSession(sessionStatus)) {
          showError(t("session.reingest.notReady"));
          return;
        }

        await app.callServerTool({
          name: "reingest-session",
          arguments: { id: sessionId },
        });
        await refreshDashboard();
        return;
      }

      if (action === "set-query") {
        applyDashboardFilters(rootDocument, {
          query: target.getAttribute("data-query") ?? "",
        });
        await refreshDashboard();
        return;
      }

      if (action === "set-issue-key") {
        applyDashboardFilters(rootDocument, {
          issueKey: target.getAttribute("data-issue-key") ?? "",
        });
        await refreshDashboard();
        return;
      }

      if (action === "focus-family") {
        applyDashboardFilters(rootDocument, {
          query: target.getAttribute("data-query") ?? "",
          issueKey: "",
          groupBy: "family",
        });
        await refreshDashboard();
        return;
      }

      if (action === "set-host") {
        applyDashboardFilters(rootDocument, {
          host: target.getAttribute("data-host") ?? "",
        });
        await refreshDashboard();
        return;
      }

      if (action === "clear-filters") {
        applyDashboardFilters(rootDocument, {
          query: "",
          issueKey: "",
          host: "",
          status: "",
          groupBy: "issue",
        });
        await refreshDashboard();
        return;
      }

      if (action === "export-filtered") {
        const filters = readDashboardFilters(rootDocument);
        const { exportFilters } = buildDashboardToolFilters(filters);
        const result = (await app.callServerTool({
          name: "export-sessions",
          arguments: {
            ...exportFilters,
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
          t("session.dashboard.export.success", {
            count: exported.sessionCount ?? 0,
            filename: exported.filename ?? "",
          }),
        );
        return;
      }

      if (action === "load-more-sessions") {
        if (sessionState.page.loading) return;
        const filters = readDashboardFilters(rootDocument);
        if (buildFiltersKey(filters) !== activeFiltersKey) {
          await refreshDashboard();
          return;
        }
        const currentRequestVersion = requestVersion;
        sessionState.page.loading = true;
        updateLoadMoreButton(rootDocument, {
          id: "load-more-sessions",
          loaded: sessionState.page.loaded,
          total: sessionState.page.total,
          loading: true,
          idleLabel: t("sessionDashboard.loadMoreSessions"),
          busyLabel: t("session.dashboard.loading.work"),
        });
        const { sessionFilters } = buildDashboardToolFilters(filters);
        const result = await callInternalTool({
          name: "list-sessions",
          arguments: {
            ...sessionFilters,
            limit: sessionState.page.limit,
            offset: sessionState.page.loaded,
          },
        });
        if (currentRequestVersion !== requestVersion) return;
        if (isSessionListResult(result.structuredContent)) {
          applySessionList(result.structuredContent, "append");
        }
        sessionState.page.loading = false;
        updateLoadMoreButton(rootDocument, {
          id: "load-more-sessions",
          loaded: sessionState.page.loaded,
          total: sessionState.page.total,
          loading: false,
          idleLabel: t("sessionDashboard.loadMoreSessions"),
          busyLabel: t("session.dashboard.loading.work"),
        });
        return;
      }

      if (action === "load-more-trends") {
        if (trendState.page.loading) return;
        const filters = readDashboardFilters(rootDocument);
        if (buildFiltersKey(filters) !== activeFiltersKey) {
          await refreshDashboard();
          return;
        }
        const currentRequestVersion = requestVersion;
        trendState.page.loading = true;
        updateLoadMoreButton(rootDocument, {
          id: "load-more-trends",
          loaded: trendState.page.loaded,
          total: trendState.page.total,
          loading: true,
          idleLabel: t("sessionDashboard.loadMoreTrends"),
          busyLabel: t("session.dashboard.loading.trends"),
        });
        const { trendFilters } = buildDashboardToolFilters(filters);
        const result = await callInternalTool({
          name: "get-history-trends",
          arguments: {
            ...trendFilters,
            limit: trendState.page.limit,
            offset: trendState.page.loaded,
          },
        });
        if (currentRequestVersion !== requestVersion) return;
        if (isHistoryTrendReport(result.structuredContent)) {
          applyTrendReport(result.structuredContent, "append");
        }
        trendState.page.loading = false;
        updateLoadMoreButton(rootDocument, {
          id: "load-more-trends",
          loaded: trendState.page.loaded,
          total: trendState.page.total,
          loading: false,
          idleLabel: t("sessionDashboard.loadMoreTrends"),
          busyLabel: t("session.dashboard.loading.trends"),
        });
        return;
      }

      if (action === "load-more-search") {
        if (searchState.page.loading) return;
        const filters = readDashboardFilters(rootDocument);
        if (!filters.query) return;
        if (buildFiltersKey(filters) !== activeFiltersKey) {
          await refreshDashboard();
          return;
        }
        const currentRequestVersion = requestVersion;
        searchState.page.loading = true;
        updateLoadMoreButton(rootDocument, {
          id: "load-more-search",
          loaded: searchState.page.loaded,
          total: searchState.page.total,
          loading: true,
          idleLabel: t("sessionDashboard.loadMoreSearch"),
          busyLabel: t("session.dashboard.loading.results"),
        });
        const { searchFilters } = buildDashboardToolFilters(filters);
        const result = await callInternalTool({
          name: "search-history",
          arguments: {
            ...searchFilters,
            limit: searchState.page.limit,
            offset: searchState.page.loaded,
          },
        });
        if (currentRequestVersion !== requestVersion) return;
        if (isHistorySearchResult(result.structuredContent)) {
          applySearchResults(result.structuredContent, "append");
        }
        searchState.page.loading = false;
        updateLoadMoreButton(rootDocument, {
          id: "load-more-search",
          loaded: searchState.page.loaded,
          total: searchState.page.total,
          loading: false,
          idleLabel: t("sessionDashboard.loadMoreSearch"),
          busyLabel: t("session.dashboard.loading.results"),
        });
      }
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : t("session.dashboard.error.action"),
      );
    }
  };

  const onSubmit = async (event: Event) => {
    event.preventDefault();

    try {
      await refreshDashboard();
    } catch (error) {
      showError(
        error instanceof Error
          ? error.message
          : t("session.dashboard.error.filters"),
      );
    }
  };

  rootDocument.addEventListener("click", onClick);
  rootDocument
    .getElementById("filter-form")
    ?.addEventListener("submit", onSubmit);

  app
    .connect()
    .then(async () => {
      const filters = readDashboardFilters(rootDocument);
      const { sessionFilters, trendFilters, handoffFilters, searchFilters } =
        buildDashboardToolFilters(filters);

      if (!hasContextData) {
        const result = await callInternalTool({
          name: "list-contexts",
          arguments: {},
        });
        if (isContextListResult(result.structuredContent)) {
          applyContextList(result.structuredContent);
        }
      }

      if (!hasSessionData) {
        const result = await callInternalTool({
          name: "list-sessions",
          arguments: {
            ...sessionFilters,
            limit: sessionState.page.limit,
            offset: 0,
          },
        });
        if (isSessionListResult(result.structuredContent)) {
          applySessionList(result.structuredContent, "replace");
        }
      }

      if (!hasTrendData) {
        const result = await callInternalTool({
          name: "get-history-trends",
          arguments: {
            ...trendFilters,
            limit: trendState.page.limit,
            offset: 0,
          },
        });
        if (isHistoryTrendReport(result.structuredContent)) {
          applyTrendReport(result.structuredContent, "replace");
        }
      }

      if (!hasHandoffData) {
        const result = await callInternalTool({
          name: "get-history-handoff",
          arguments: handoffFilters,
        });
        if (isHistoryHandoffReport(result.structuredContent)) {
          renderHandoff(result.structuredContent);
        }
      }

      if (!hasSearchData) {
        if (filters.query) {
          const result = await callInternalTool({
            name: "search-history",
            arguments: {
              ...searchFilters,
              limit: searchState.page.limit,
              offset: 0,
            },
          });
          if (isHistorySearchResult(result.structuredContent)) {
            applySearchResults(result.structuredContent, "replace");
          }
        } else {
          renderSearchPlaceholder();
        }
      }
    })
    .catch((error) => {
      showError(
        error instanceof Error
          ? error.message
          : t("session.dashboard.error.connect"),
      );
    });

  return () => {
    rootDocument.removeEventListener("click", onClick);
    rootDocument
      .getElementById("filter-form")
      ?.removeEventListener("submit", onSubmit);
  };
}
