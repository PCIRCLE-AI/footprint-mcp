import { afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";
import { bootSessionDashboard } from "../../ui/src/session-dashboard-view";
import { bootSessionDetail } from "../../ui/src/session-detail-view";

interface ToolRequest {
  name: string;
  arguments: Record<string, unknown>;
}

interface ToolResult {
  structuredContent?: unknown;
}

type Awaitable<T> = T | Promise<T>;
type ToolResponse =
  | Awaitable<ToolResult>
  | ((request: ToolRequest) => Awaitable<ToolResult>);

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason?: unknown): void;
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

class MockApp {
  ontoolresult: ((result: ToolResult) => void) | null = null;
  calls: ToolRequest[] = [];

  constructor(
    private readonly initialResult: ToolResult,
    private readonly responses: Record<string, ToolResponse>,
  ) {}

  async connect(): Promise<void> {
    this.ontoolresult?.(this.initialResult);
  }

  async callServerTool(request: ToolRequest): Promise<ToolResult> {
    this.calls.push(request);
    const fallbackResponse =
      request.name === "resolve-context"
        ? {
            structuredContent: {
              mode: "none",
              sessionId:
                typeof request.arguments.sessionId === "string"
                  ? request.arguments.sessionId
                  : null,
              cwd: null,
              confirmationRequired: true,
              recommendedAction: "create-new-context",
              linkedContextId: null,
              currentContext: null,
              briefing: null,
              candidates: [],
            },
          }
        : request.name === "list-contexts"
          ? {
              structuredContent: {
                contexts: [],
                total: 0,
              },
            }
          : { structuredContent: {} };
    const response = this.responses[request.name];
    const result = await Promise.resolve(
      typeof response === "function"
        ? response(request)
        : (response ?? fallbackResponse),
    );
    this.ontoolresult?.(result);
    return result;
  }
}

let cleanup: (() => void) | undefined;

afterEach(() => {
  cleanup?.();
  cleanup = undefined;
  document.body.innerHTML = "";
});

const dashboardMarkup = `
  <div class="shell">
    <p id="summary">Loading your recent work...</p>
    <div id="error"></div>
    <form id="filter-form">
      <label for="query-filter">Find Past Work</label>
      <input id="query-filter" />
      <label for="issue-key-filter">Reference Code (Advanced)</label>
      <input id="issue-key-filter" />
      <label for="host-filter">AI Helper</label>
      <select id="host-filter">
        <option value="">All AI assistants</option>
        <option value="claude">Claude</option>
        <option value="gemini">Gemini</option>
        <option value="codex">Codex</option>
      </select>
      <label for="status-filter">Work State</label>
      <select id="status-filter">
        <option value="">All states</option>
        <option value="running">In progress</option>
        <option value="completed">Done</option>
        <option value="failed">Needs attention</option>
        <option value="interrupted">Stopped</option>
      </select>
      <label for="group-by-filter">Group Repeated Problems By</label>
      <select id="group-by-filter">
        <option value="issue">Specific problem</option>
        <option value="family">Broader pattern</option>
      </select>
      <button type="submit">Apply</button>
      <button type="button" data-action="export-filtered">Export This View</button>
      <button type="button" data-action="clear-filters">Reset</button>
    </form>
    <p id="handoff-summary">Waiting for scope summary...</p>
    <ul id="handoff-results"></ul>
    <p id="trend-summary">Looking for issues that have shown up more than once...</p>
    <ul id="trend-results"></ul>
    <button type="button" id="load-more-trends" data-action="load-more-trends" hidden>Show More Repeated Problems</button>
    <p id="context-summary">Loading the ongoing topics Footprint already knows about...</p>
    <ul id="context-results"></ul>
    <p id="search-summary">Type above to find earlier work that may help.</p>
    <ul id="search-results"></ul>
    <button type="button" id="load-more-search" data-action="load-more-search" hidden>Show More Results</button>
    <table><tbody id="rows"></tbody></table>
    <button type="button" id="load-more-sessions" data-action="load-more-sessions" hidden>Show More Work</button>
  </div>
`;

const detailMarkup = `
  <div class="shell">
    <p id="subtitle">Loading this saved work record...</p>
    <div id="error"></div>
    <div id="meta"></div>
    <button id="reingest-button" onclick="reingestSession()">Refresh Overview</button>
    <button onclick="exportSessionBundle()">Export ZIP</button>
    <button onclick="loadArtifacts()">Load Supporting Details</button>
    <button onclick="loadNarratives()">Load Simple Summary</button>
    <button onclick="loadDecisions()">Load Key Decisions</button>
    <p id="context-summary">Checking whether this work belongs to an existing topic...</p>
    <ul id="context-current"></ul>
    <button id="refresh-context-button" data-action="refresh-context">Check Again</button>
    <select id="context-target-select"></select>
    <button id="move-context-button" data-action="move-to-selected-context">Move There</button>
    <button id="set-active-context-button" data-action="set-selected-context-active">Make This The Main Topic</button>
    <input id="context-create-label" />
    <button id="create-context-button" data-action="create-context-from-session">Create Topic</button>
    <p id="context-candidates-summary">Footprint suggests related topics conservatively and waits for your confirmation.</p>
    <ul id="context-candidates"></ul>
    <ul id="messages"></ul>
    <button id="load-more-messages" data-action="load-more-messages" hidden>Show More Conversation</button>
    <ul id="timeline"></ul>
    <button id="load-more-timeline" data-action="load-more-timeline" hidden>Show More Steps</button>
    <ul id="trend-context"></ul>
    <button id="load-more-session-trends" data-action="load-more-session-trends" hidden>Show More Related Work</button>
    <ul id="artifacts"></ul>
    <button id="load-more-artifacts" data-action="load-more-artifacts" hidden>Show More Supporting Details</button>
    <p id="scope-handoff-summary">Pick one item from Related Earlier Work below to load a short pickup note.</p>
    <button id="scope-export-button" data-action="export-scope" disabled>Export Pickup ZIP</button>
    <ul id="scope-handoff-results"></ul>
    <ul id="narratives"></ul>
    <button id="load-more-narratives" data-action="load-more-narratives" hidden>Show More Summaries</button>
    <ul id="decisions"></ul>
    <button id="load-more-decisions" data-action="load-more-decisions" hidden>Show More Decisions</button>
  </div>
`;

function createScopeSessionResult(): ToolResult {
  return {
    structuredContent: {
      session: {
        id: "session-1",
        host: "claude",
        label: "Scope session",
        status: "completed",
        projectRoot: "/tmp/project",
        cwd: "/tmp/project",
        startedAt: "2026-03-10T12:00:00.000Z",
        endedAt: "2026-03-10T12:03:00.000Z",
      },
      messageSummary: {
        total: 1,
        byRole: { user: 1, assistant: 0, system: 0 },
      },
      timelineSummary: {
        total: 1,
        eventTypes: ["message.user.submitted"],
      },
      artifactSummary: {
        total: 1,
        byType: {
          fileChange: 0,
          commandOutput: 1,
          testResult: 0,
          gitCommit: 0,
        },
      },
      trendContext: {
        summary: {
          totalTrends: 1,
          crossSessionTrends: 1,
          sessionAttempts: 1,
          globalAttempts: 3,
          otherSessions: 2,
        },
        trends: [
          {
            issueKey: "test:pnpm-test-browser",
            label: "pnpm test:browser",
            kind: "test",
            issueFamilyKey: "test-family:pnpm",
            issueFamilyLabel: "pnpm tests",
            relatedIssueKeys: ["test:pnpm-test-browser"],
            lastSeenAt: "2026-03-10T12:04:00.000Z",
            sessionCount: 3,
            sessionAttempts: 1,
            globalAttempts: 3,
            sessionLatestOutcome: "failed",
            latestOutcome: "failed",
            hosts: ["claude", "gemini", "codex"],
            relatedSessionCount: 2,
            relatedSessions: [
              {
                sessionId: "session-2",
                label: "Gemini retry",
                host: "gemini",
                status: "failed",
                lastAttemptAt: "2026-03-10T12:04:00.000Z",
                attempts: 1,
                latestOutcome: "failed",
              },
            ],
          },
        ],
      },
      messages: [{ seq: 1, role: "user", content: "Check pnpm tests" }],
      timeline: [
        {
          seq: 1,
          eventType: "message.user.submitted",
          summary: "Check pnpm tests",
        },
      ],
      hasNarratives: false,
    },
  };
}

function createContextListItem(
  id: string,
  label: string,
  latestSessionId: string,
  latestSessionLabel: string,
) {
  return {
    id,
    label,
    workspaceKey: "/tmp/project",
    latestSessionId,
    latestSessionLabel,
    latestStartedAt: "2026-03-10T12:06:00.000Z",
    latestEndedAt: "2026-03-10T12:07:00.000Z",
    sessionCount: 2,
    hosts: ["claude", "gemini"],
    statuses: ["completed", "failed"],
    confidence: "high" as const,
    confidenceScore: 12,
    signals: ["shared issue family"],
  };
}

function createContextReport(
  context: ReturnType<typeof createContextListItem>,
  summary: string,
) {
  return {
    context,
    currentTruth: {
      summary,
      latestSessionId: context.latestSessionId,
      latestSessionLabel: context.latestSessionLabel,
      latestSummaryNarrative: "Current direction remains stable.",
      latestHandoff: "Continue from the latest retry.",
      activeBlockers: ["auth timeout remains unstable"],
      openQuestions: ["Should we keep the retry cap at three?"],
    },
    activeDecisions: [
      {
        decisionId: "decision-1",
        title: "Cap retries at three",
        summary: "Keep retries capped for deterministic failures.",
        status: "accepted",
        createdAt: "2026-03-10T12:06:00.000Z",
      },
    ],
    supersededDecisions: [
      {
        decisionId: "decision-0",
        title: "Infinite retries",
        summary: "Previous retry policy.",
        status: "rejected",
        createdAt: "2026-03-10T12:00:00.000Z",
        supersededByTitle: "Cap retries at three",
      },
    ],
    sessions: [
      {
        id: context.latestSessionId,
        label: context.latestSessionLabel,
        host: "claude",
        status: "completed",
        startedAt: "2026-03-10T12:06:00.000Z",
        endedAt: "2026-03-10T12:07:00.000Z",
      },
    ],
  };
}

describe("Session UI browser flows", () => {
  test("dashboard applies filters and drill-down actions across search and trend panels", async () => {
    document.body.innerHTML = dashboardMarkup;
    const downloads: Array<{ filename: string; mimeType: string }> = [];

    const app = new MockApp(
      {
        structuredContent: {
          query: "pnpm test",
          filters: {},
          results: [
            {
              sessionId: "session-claude",
              host: "claude",
              label: "Claude test session",
              status: "completed",
              startedAt: "2026-03-10T12:00:00.000Z",
              snippets: ["pnpm test failed on src/app.ts"],
            },
          ],
          total: 1,
        },
      },
      {
        "list-contexts": {
          structuredContent: {
            contexts: [
              {
                id: "context-auth",
                label: "Auth timeout workstream",
                workspaceKey: "/tmp/project",
                latestSessionId: "session-gemini",
                latestSessionLabel: "Gemini failed session",
                latestStartedAt: "2026-03-10T12:06:00.000Z",
                latestEndedAt: "2026-03-10T12:07:00.000Z",
                sessionCount: 2,
                hosts: ["claude", "gemini"],
                statuses: ["completed", "failed"],
                confidence: "high",
                confidenceScore: 12,
                signals: ["shared issue family"],
              },
            ],
            total: 1,
          },
        },
        "list-sessions": (request) => ({
          structuredContent:
            request.arguments.host === "gemini" &&
            request.arguments.status === "failed"
              ? {
                  filters: {
                    query: request.arguments.query as string | undefined,
                    issueKey: request.arguments.issueKey as string | undefined,
                    host: "gemini",
                    status: "failed",
                  },
                  sessions: [
                    {
                      id: "session-gemini",
                      host: "gemini",
                      label: "Gemini failed session",
                      status: "failed",
                      startedAt: "2026-03-10T12:06:00.000Z",
                    },
                  ],
                  total: 1,
                }
              : {
                  filters: {
                    query: request.arguments.query as string | undefined,
                    issueKey: request.arguments.issueKey as string | undefined,
                    host: undefined,
                    status: undefined,
                  },
                  sessions: [
                    {
                      id: "session-claude",
                      host: "claude",
                      label: "Claude test session",
                      status: "completed",
                      startedAt: "2026-03-10T12:00:00.000Z",
                    },
                    {
                      id: "session-gemini",
                      host: "gemini",
                      label: "Gemini failed session",
                      status: "failed",
                      startedAt: "2026-03-10T12:06:00.000Z",
                    },
                  ],
                  total: 2,
                },
        }),
        "get-history-trends": (request) => ({
          structuredContent:
            request.arguments.groupBy === "family"
              ? {
                  filters: {
                    query: request.arguments.query as string | undefined,
                    issueKey: request.arguments.issueKey as string | undefined,
                    host:
                      (request.arguments.host as string | undefined) ??
                      undefined,
                    status:
                      (request.arguments.status as string | undefined) ??
                      undefined,
                    groupBy: "family",
                  },
                  summary: {
                    groupBy: "family",
                    totalTrends: 1,
                    matchingSessions:
                      request.arguments.host === "gemini" &&
                      request.arguments.status === "failed"
                        ? 1
                        : 2,
                    totalAttempts:
                      request.arguments.host === "gemini" &&
                      request.arguments.status === "failed"
                        ? 1
                        : 3,
                    byOutcome: {
                      failed:
                        request.arguments.host === "gemini" &&
                        request.arguments.status === "failed"
                          ? 1
                          : 2,
                      succeeded:
                        request.arguments.host === "gemini" &&
                        request.arguments.status === "failed"
                          ? 0
                          : 1,
                      other: 0,
                    },
                  },
                  total: 1,
                  trends: [
                    {
                      groupBy: "family",
                      issueKey: "test-family:pnpm",
                      label: "pnpm tests",
                      kind: "test",
                      relatedIssueKeys: ["test:pnpm-test"],
                      latestOutcome: "failed",
                      lastSeenAt: "2026-03-10T12:08:00.000Z",
                      attemptCount:
                        request.arguments.host === "gemini" &&
                        request.arguments.status === "failed"
                          ? 1
                          : 3,
                      sessionCount:
                        request.arguments.host === "gemini" &&
                        request.arguments.status === "failed"
                          ? 1
                          : 2,
                      failedAttempts:
                        request.arguments.host === "gemini" &&
                        request.arguments.status === "failed"
                          ? 1
                          : 2,
                      succeededAttempts:
                        request.arguments.host === "gemini" &&
                        request.arguments.status === "failed"
                          ? 0
                          : 1,
                      otherAttempts: 0,
                      hosts:
                        request.arguments.host === "gemini" &&
                        request.arguments.status === "failed"
                          ? ["gemini"]
                          : ["claude", "gemini"],
                      statuses:
                        request.arguments.host === "gemini" &&
                        request.arguments.status === "failed"
                          ? ["failed"]
                          : ["completed", "failed"],
                      sessions:
                        request.arguments.host === "gemini" &&
                        request.arguments.status === "failed"
                          ? [
                              {
                                sessionId: "session-gemini",
                                label: "Gemini failed session",
                                host: "gemini",
                                status: "failed",
                                startedAt: "2026-03-10T12:06:00.000Z",
                                lastAttemptAt: "2026-03-10T12:08:00.000Z",
                                attempts: 1,
                                latestOutcome: "failed",
                              },
                            ]
                          : [
                              {
                                sessionId: "session-gemini",
                                label: "Gemini failed session",
                                host: "gemini",
                                status: "failed",
                                startedAt: "2026-03-10T12:06:00.000Z",
                                lastAttemptAt: "2026-03-10T12:08:00.000Z",
                                attempts: 1,
                                latestOutcome: "failed",
                              },
                              {
                                sessionId: "session-claude",
                                label: "Claude test session",
                                host: "claude",
                                status: "completed",
                                startedAt: "2026-03-10T12:00:00.000Z",
                                lastAttemptAt: "2026-03-10T12:05:00.000Z",
                                attempts: 2,
                                latestOutcome: "succeeded",
                              },
                            ],
                    },
                  ],
                }
              : request.arguments.host === "gemini" &&
                  request.arguments.status === "failed"
                ? {
                    filters: {
                      query: request.arguments.query as string | undefined,
                      issueKey: request.arguments.issueKey as
                        | string
                        | undefined,
                      host: "gemini",
                      status: "failed",
                      groupBy: "issue",
                    },
                    summary: {
                      groupBy: "issue",
                      totalTrends: 1,
                      matchingSessions: 1,
                      totalAttempts: 1,
                      byOutcome: {
                        failed: 1,
                        succeeded: 0,
                        other: 0,
                      },
                    },
                    total: 1,
                    trends: [
                      {
                        groupBy: "issue",
                        issueKey: "test:pnpm-test",
                        label: "pnpm test",
                        kind: "test",
                        relatedIssueKeys: ["test:pnpm-test"],
                        latestOutcome: "failed",
                        lastSeenAt: "2026-03-10T12:08:00.000Z",
                        attemptCount: 1,
                        sessionCount: 1,
                        failedAttempts: 1,
                        succeededAttempts: 0,
                        otherAttempts: 0,
                        hosts: ["gemini"],
                        statuses: ["failed"],
                        sessions: [
                          {
                            sessionId: "session-gemini",
                            label: "Gemini failed session",
                            host: "gemini",
                            status: "failed",
                            startedAt: "2026-03-10T12:06:00.000Z",
                            lastAttemptAt: "2026-03-10T12:08:00.000Z",
                            attempts: 1,
                            latestOutcome: "failed",
                          },
                        ],
                      },
                    ],
                  }
                : {
                    filters: {
                      query: request.arguments.query as string | undefined,
                      issueKey: request.arguments.issueKey as
                        | string
                        | undefined,
                      host: undefined,
                      status: undefined,
                      groupBy: "issue",
                    },
                    summary: {
                      groupBy: "issue",
                      totalTrends: 1,
                      matchingSessions: 2,
                      totalAttempts: 3,
                      byOutcome: {
                        failed: 2,
                        succeeded: 1,
                        other: 0,
                      },
                    },
                    total: 1,
                    trends: [
                      {
                        groupBy: "issue",
                        issueKey: "test:pnpm-test",
                        label: "pnpm test",
                        kind: "test",
                        relatedIssueKeys: ["test:pnpm-test"],
                        latestOutcome: "failed",
                        lastSeenAt: "2026-03-10T12:08:00.000Z",
                        attemptCount: 3,
                        sessionCount: 2,
                        failedAttempts: 2,
                        succeededAttempts: 1,
                        otherAttempts: 0,
                        hosts: ["claude", "gemini"],
                        statuses: ["completed", "failed"],
                        sessions: [
                          {
                            sessionId: "session-gemini",
                            label: "Gemini failed session",
                            host: "gemini",
                            status: "failed",
                            startedAt: "2026-03-10T12:06:00.000Z",
                            lastAttemptAt: "2026-03-10T12:08:00.000Z",
                            attempts: 1,
                            latestOutcome: "failed",
                          },
                          {
                            sessionId: "session-claude",
                            label: "Claude test session",
                            host: "claude",
                            status: "completed",
                            startedAt: "2026-03-10T12:00:00.000Z",
                            lastAttemptAt: "2026-03-10T12:05:00.000Z",
                            attempts: 2,
                            latestOutcome: "succeeded",
                          },
                        ],
                      },
                    ],
                  },
        }),
        "get-history-handoff": (request) => ({
          structuredContent:
            request.arguments.groupBy === "family"
              ? {
                  filters: {
                    query: request.arguments.query as string | undefined,
                    issueKey: request.arguments.issueKey as string | undefined,
                    host:
                      (request.arguments.host as string | undefined) ??
                      undefined,
                    status:
                      (request.arguments.status as string | undefined) ??
                      undefined,
                    groupBy: "family",
                  },
                  summary: {
                    groupBy: "family",
                    headline:
                      request.arguments.host === "gemini" &&
                      request.arguments.status === "failed"
                        ? "1 session(s) matched across 1 host(s); 1 blocking trend(s) remain active. Latest session: Gemini failed session (failed). Failure families are grouped broadly."
                        : "2 session(s) matched across 2 host(s); 1 blocking trend(s) remain active. Latest session: Gemini failed session (failed). Failure families are grouped broadly.",
                    matchingSessions:
                      request.arguments.host === "gemini" &&
                      request.arguments.status === "failed"
                        ? 1
                        : 2,
                    matchingHosts:
                      request.arguments.host === "gemini" &&
                      request.arguments.status === "failed"
                        ? ["gemini"]
                        : ["claude", "gemini"],
                    statuses:
                      request.arguments.host === "gemini" &&
                      request.arguments.status === "failed"
                        ? ["failed"]
                        : ["completed", "failed"],
                    totalTrends: 1,
                    blockingTrends: 1,
                    unresolvedQuestions: 1,
                    latestSessionId: "session-gemini",
                    latestSessionLabel: "Gemini failed session",
                    latestStartedAt: "2026-03-10T12:06:00.000Z",
                  },
                  blockers: [
                    request.arguments.host === "gemini" &&
                    request.arguments.status === "failed"
                      ? "test-family:pnpm: pnpm tests (sessions 1, attempts 1, latest failed, hosts gemini)"
                      : "test-family:pnpm: pnpm tests (sessions 2, attempts 3, latest failed, hosts claude, gemini)",
                  ],
                  followUps: [
                    "Next: capture the remaining integration blocker?",
                  ],
                  recentSessions:
                    request.arguments.host === "gemini" &&
                    request.arguments.status === "failed"
                      ? [
                          {
                            id: "session-gemini",
                            label: "Gemini failed session",
                            host: "gemini",
                            status: "failed",
                            startedAt: "2026-03-10T12:06:00.000Z",
                            endedAt: "2026-03-10T12:08:00.000Z",
                          },
                        ]
                      : [
                          {
                            id: "session-gemini",
                            label: "Gemini failed session",
                            host: "gemini",
                            status: "failed",
                            startedAt: "2026-03-10T12:06:00.000Z",
                            endedAt: "2026-03-10T12:08:00.000Z",
                          },
                          {
                            id: "session-claude",
                            label: "Claude test session",
                            host: "claude",
                            status: "completed",
                            startedAt: "2026-03-10T12:00:00.000Z",
                            endedAt: "2026-03-10T12:05:00.000Z",
                          },
                        ],
                  markdown: "# History Handoff",
                }
              : request.arguments.host === "gemini" &&
                  request.arguments.status === "failed"
                ? {
                    filters: {
                      query: request.arguments.query as string | undefined,
                      issueKey: request.arguments.issueKey as
                        | string
                        | undefined,
                      host: "gemini",
                      status: "failed",
                      groupBy: "issue",
                    },
                    summary: {
                      groupBy: "issue",
                      headline:
                        "1 session(s) matched across 1 host(s); 1 blocking trend(s) remain active. Latest session: Gemini failed session (failed).",
                      matchingSessions: 1,
                      matchingHosts: ["gemini"],
                      statuses: ["failed"],
                      totalTrends: 1,
                      blockingTrends: 1,
                      unresolvedQuestions: 1,
                      latestSessionId: "session-gemini",
                      latestSessionLabel: "Gemini failed session",
                      latestStartedAt: "2026-03-10T12:06:00.000Z",
                    },
                    blockers: [
                      "test:pnpm-test: pnpm test (sessions 1, attempts 1, latest failed, hosts gemini)",
                    ],
                    followUps: [
                      "Next: capture the remaining integration blocker?",
                    ],
                    recentSessions: [
                      {
                        id: "session-gemini",
                        label: "Gemini failed session",
                        host: "gemini",
                        status: "failed",
                        startedAt: "2026-03-10T12:06:00.000Z",
                        endedAt: "2026-03-10T12:08:00.000Z",
                      },
                    ],
                    markdown: "# History Handoff",
                  }
                : {
                    filters: {
                      query: request.arguments.query as string | undefined,
                      issueKey: request.arguments.issueKey as
                        | string
                        | undefined,
                      host: undefined,
                      status: undefined,
                      groupBy: "issue",
                    },
                    summary: {
                      groupBy: "issue",
                      headline:
                        "2 session(s) matched across 2 host(s); 1 blocking trend(s) remain active. Latest session: Gemini failed session (failed).",
                      matchingSessions: 2,
                      matchingHosts: ["claude", "gemini"],
                      statuses: ["completed", "failed"],
                      totalTrends: 1,
                      blockingTrends: 1,
                      unresolvedQuestions: 1,
                      latestSessionId: "session-gemini",
                      latestSessionLabel: "Gemini failed session",
                      latestStartedAt: "2026-03-10T12:06:00.000Z",
                    },
                    blockers: [
                      "test:pnpm-test: pnpm test (sessions 2, attempts 3, latest failed, hosts claude, gemini)",
                    ],
                    followUps: [
                      "Next: capture the remaining integration blocker?",
                    ],
                    recentSessions: [
                      {
                        id: "session-gemini",
                        label: "Gemini failed session",
                        host: "gemini",
                        status: "failed",
                        startedAt: "2026-03-10T12:06:00.000Z",
                        endedAt: "2026-03-10T12:08:00.000Z",
                      },
                      {
                        id: "session-claude",
                        label: "Claude test session",
                        host: "claude",
                        status: "completed",
                        startedAt: "2026-03-10T12:00:00.000Z",
                        endedAt: "2026-03-10T12:05:00.000Z",
                      },
                    ],
                    markdown: "# History Handoff",
                  },
        }),
        "search-history": (request) => ({
          structuredContent:
            request.arguments.host === "gemini" &&
            request.arguments.status === "failed"
              ? {
                  query:
                    (request.arguments.query as string | undefined) ??
                    "pnpm test",
                  filters: {
                    host: "gemini",
                    status: "failed",
                  },
                  results: [
                    {
                      sessionId: "session-gemini",
                      host: "gemini",
                      label: "Gemini failed session",
                      status: "failed",
                      startedAt: "2026-03-10T12:06:00.000Z",
                      snippets: [
                        request.arguments.query === "pnpm tests"
                          ? "pnpm tests still failing on integration"
                          : "pnpm test still failing on integration",
                      ],
                    },
                  ],
                  total: 1,
                }
              : {
                  query:
                    (request.arguments.query as string | undefined) ??
                    "pnpm test",
                  filters: {},
                  results: [
                    {
                      sessionId: "session-claude",
                      host: "claude",
                      label: "Claude test session",
                      status: "completed",
                      startedAt: "2026-03-10T12:00:00.000Z",
                      snippets: [
                        request.arguments.query === "pnpm tests"
                          ? "pnpm tests failed on src/app.ts"
                          : "pnpm test failed on src/app.ts",
                      ],
                    },
                  ],
                  total: 1,
                },
        }),
        "get-session": {
          structuredContent: {
            session: {
              id: "session-gemini",
            },
          },
        },
        "export-sessions": {
          structuredContent: {
            filename: "session-export-filtered.zip",
            base64Data: "UEsDBAoAAAAAA",
            sessionCount: 1,
            historyGrouping: "family",
            success: true,
          },
        },
      },
    );

    cleanup = bootSessionDashboard(app, document, window, (archive) => {
      downloads.push({
        filename: archive.filename,
        mimeType: archive.mimeType,
      });
    });

    expect(
      (document.getElementById("query-filter") as HTMLInputElement | null)
        ?.value,
    ).toBe("pnpm test");
    expect(
      (document.getElementById("group-by-filter") as HTMLSelectElement | null)
        ?.value,
    ).toBe("issue");
    await expect
      .element(page.getByText("Showing 1 earlier saved work records out of 1."))
      .toBeInTheDocument();
    await expect
      .element(page.getByText("pnpm test failed on src/app.ts"))
      .toBeInTheDocument();
    await expect
      .element(page.getByText(/2 related work records found\./))
      .toBeInTheDocument();
    await expect
      .element(
        page.getByText(
          "Showing 2 of 2 recent saved work records. Open one to see what happened.",
        ),
      )
      .toBeInTheDocument();
    await expect
      .element(
        page.getByText(
          "Showing 1 specific problem items out of 1. 0 still need attention, 0 improved, and 0 came back again.",
        ),
      )
      .toBeInTheDocument();
    await expect
      .element(
        page.getByText("Seen in 2 saved work records across 3 attempts."),
      )
      .toBeInTheDocument();
    await expect
      .element(
        page
          .getByRole("button", { name: "Open session Claude test session" })
          .first(),
      )
      .toBeVisible();

    await page.getByRole("button", { name: "Show This Problem" }).click();

    expect(
      app.calls
        .map((call) => call.name)
        .filter((name) =>
          [
            "list-sessions",
            "get-history-trends",
            "get-history-handoff",
          ].includes(name),
        )
        .slice(0, 6),
    ).toEqual([
      "list-sessions",
      "get-history-trends",
      "get-history-handoff",
      "list-sessions",
      "get-history-trends",
      "get-history-handoff",
    ]);
    const initialFilterCalls = app.calls.filter((call) =>
      ["list-sessions", "get-history-trends", "get-history-handoff"].includes(
        call.name,
      ),
    );
    expect(initialFilterCalls[0]?.arguments).toEqual({
      query: "pnpm test",
      issueKey: undefined,
      host: undefined,
      status: undefined,
      limit: 8,
      offset: 0,
    });
    expect(initialFilterCalls[1]?.arguments).toEqual({
      query: "pnpm test",
      issueKey: undefined,
      host: undefined,
      status: undefined,
      groupBy: "issue",
      limit: 6,
      offset: 0,
    });
    expect(initialFilterCalls[2]?.arguments).toEqual({
      query: "pnpm test",
      issueKey: undefined,
      host: undefined,
      status: undefined,
      groupBy: "issue",
    });
    expect(
      (document.getElementById("issue-key-filter") as HTMLInputElement | null)
        ?.value,
    ).toBe("test:pnpm-test");
    expect(document.getElementById("error")?.textContent ?? "").toBe("");

    (document.getElementById(
      "host-filter",
    ) as HTMLSelectElement | null)!.value = "gemini";
    (document.getElementById(
      "status-filter",
    ) as HTMLSelectElement | null)!.value = "failed";
    (document.getElementById(
      "group-by-filter",
    ) as HTMLSelectElement | null)!.value = "family";
    await page.getByRole("button", { name: "Apply" }).click();

    const lastFourCalls = app.calls.slice(-4);
    expect(lastFourCalls.map((call) => call.name)).toEqual([
      "list-sessions",
      "get-history-trends",
      "get-history-handoff",
      "search-history",
    ]);
    expect(lastFourCalls[0]?.arguments).toEqual({
      query: "pnpm test",
      issueKey: "test:pnpm-test",
      host: "gemini",
      status: "failed",
      limit: 8,
      offset: 0,
    });
    expect(lastFourCalls[1]?.arguments).toEqual({
      host: "gemini",
      status: "failed",
      issueKey: "test:pnpm-test",
      groupBy: "family",
      limit: 6,
      query: "pnpm test",
      offset: 0,
    });
    expect(lastFourCalls[2]?.arguments).toEqual({
      host: "gemini",
      status: "failed",
      issueKey: "test:pnpm-test",
      groupBy: "family",
      query: "pnpm test",
    });
    expect(lastFourCalls[3]?.arguments).toEqual({
      host: "gemini",
      status: "failed",
      limit: 6,
      query: "pnpm test",
      offset: 0,
    });
    await expect
      .element(
        page.getByText(
          "Showing 1 of 1 recent saved work records. Open one to see what happened.",
        ),
      )
      .toBeInTheDocument();
    await expect
      .element(page.getByText(/1 related work records found\./))
      .toBeInTheDocument();
    await expect
      .element(
        page.getByText(
          "Showing 1 broader pattern items out of 1. 0 still need attention, 0 improved, and 0 came back again.",
        ),
      )
      .toBeInTheDocument();
    await expect
      .element(page.getByText("pnpm test still failing on integration"))
      .toBeInTheDocument();
    expect(
      document.getElementById("trend-results")?.textContent ?? "",
    ).toContain("Seen in 1 saved work record across 1 attempt.");
    await expect
      .element(
        page.getByRole("button", {
          name: "Open matching session Gemini failed session",
        }),
      )
      .toBeVisible();

    await page.getByRole("button", { name: "Show Broader Pattern" }).click();

    const familyFocusCalls = app.calls
      .filter((call) =>
        [
          "list-sessions",
          "get-history-trends",
          "get-history-handoff",
          "search-history",
        ].includes(call.name),
      )
      .slice(-4);
    expect(familyFocusCalls.map((call) => call.name)).toEqual([
      "list-sessions",
      "get-history-trends",
      "get-history-handoff",
      "search-history",
    ]);
    expect(familyFocusCalls[0]?.arguments).toEqual({
      query: "pnpm tests",
      issueKey: undefined,
      host: "gemini",
      status: "failed",
      limit: 8,
      offset: 0,
    });
    expect(familyFocusCalls[1]?.arguments).toEqual({
      host: "gemini",
      status: "failed",
      issueKey: undefined,
      groupBy: "family",
      limit: 6,
      query: "pnpm tests",
      offset: 0,
    });
    expect(familyFocusCalls[2]?.arguments).toEqual({
      host: "gemini",
      status: "failed",
      issueKey: undefined,
      groupBy: "family",
      query: "pnpm tests",
    });
    expect(
      (document.getElementById("query-filter") as HTMLInputElement | null)
        ?.value,
    ).toBe("pnpm tests");
    expect(
      (document.getElementById("issue-key-filter") as HTMLInputElement | null)
        ?.value,
    ).toBe("");
    expect(
      (document.getElementById("group-by-filter") as HTMLSelectElement | null)
        ?.value,
    ).toBe("family");
    await expect
      .element(page.getByText("pnpm tests still failing on integration"))
      .toBeInTheDocument();

    await page.getByRole("button", { name: "Export This View" }).click();

    expect(app.calls.at(-1)?.name).toBe("export-sessions");
    expect(app.calls.at(-1)?.arguments).toEqual({
      query: "pnpm tests",
      issueKey: undefined,
      host: "gemini",
      status: "failed",
      groupBy: "family",
      outputMode: "base64",
    });
    expect(downloads).toEqual([
      {
        filename: "session-export-filtered.zip",
        mimeType: "application/zip",
      },
    ]);
    await expect
      .element(
        page.getByText(
          "Exported 1 matching session bundle(s): session-export-filtered.zip",
        ),
      )
      .toBeInTheDocument();

    await page
      .getByRole("button", {
        name: "Open matching session Gemini failed session",
      })
      .click();

    expect(app.calls.at(-1)?.name).toBe("get-session");
    expect(app.calls.at(-1)?.arguments).toEqual({
      id: "session-gemini",
    });
    expect(document.getElementById("error")?.textContent ?? "").toContain(
      "Exported 1 matching session bundle(s): session-export-filtered.zip",
    );
  });

  test("dashboard paginates sessions, trends, and search results with server-backed offsets", async () => {
    document.body.innerHTML = dashboardMarkup;

    const sessions = Array.from({ length: 10 }, (_, index) => ({
      id: `session-${index + 1}`,
      host: index % 2 === 0 ? "claude" : "gemini",
      label: `Build session ${index + 1}`,
      status: index % 3 === 0 ? "failed" : "completed",
      startedAt: `2026-03-10T12:${String(index).padStart(2, "0")}:00.000Z`,
    }));

    const trends = Array.from({ length: 7 }, (_, index) => ({
      groupBy: "issue" as const,
      issueKey: `build:issue-${index + 1}`,
      label: `Build issue ${index + 1}`,
      kind: "build",
      relatedIssueKeys: [`build:issue-${index + 1}`],
      latestOutcome: index % 2 === 0 ? "failed" : "succeeded",
      lastSeenAt: `2026-03-10T13:${String(index).padStart(2, "0")}:00.000Z`,
      attemptCount: 1,
      sessionCount: 1,
      failedAttempts: index % 2 === 0 ? 1 : 0,
      succeededAttempts: index % 2 === 0 ? 0 : 1,
      otherAttempts: 0,
      hosts: [index % 2 === 0 ? "claude" : "gemini"],
      statuses: [index % 2 === 0 ? "failed" : "completed"],
      sessions: [
        {
          sessionId: `session-${index + 1}`,
          label: `Build session ${index + 1}`,
          host: index % 2 === 0 ? "claude" : "gemini",
          status: index % 2 === 0 ? "failed" : "completed",
          startedAt: `2026-03-10T12:${String(index).padStart(2, "0")}:00.000Z`,
          lastAttemptAt: `2026-03-10T13:${String(index).padStart(2, "0")}:00.000Z`,
          attempts: 1,
          latestOutcome: index % 2 === 0 ? "failed" : "succeeded",
        },
      ],
    }));

    const searchResults = Array.from({ length: 7 }, (_, index) => ({
      sessionId: `session-${index + 1}`,
      host: index % 2 === 0 ? "claude" : "gemini",
      label: `Build session ${index + 1}`,
      status: index % 3 === 0 ? "failed" : "completed",
      startedAt: `2026-03-10T12:${String(index).padStart(2, "0")}:00.000Z`,
      snippets: [`build output snippet ${index + 1}`],
    }));

    const paginate = <T>(items: T[], request: ToolRequest): T[] => {
      const offset = (request.arguments.offset as number | undefined) ?? 0;
      const limit =
        (request.arguments.limit as number | undefined) ?? items.length;
      return items.slice(offset, offset + limit);
    };

    const app = new MockApp(
      {
        structuredContent: {
          query: "build",
          filters: {},
          results: searchResults.slice(0, 6),
          total: searchResults.length,
        },
      },
      {
        "list-contexts": {
          structuredContent: {
            contexts: [
              {
                id: "context-auth",
                label: "Auth timeout workstream",
                workspaceKey: "/tmp/project",
                latestSessionId: "session-10",
                latestSessionLabel: "Build session 10",
                latestStartedAt: "2026-03-10T12:09:00.000Z",
                latestEndedAt: "2026-03-10T12:10:00.000Z",
                sessionCount: 10,
                hosts: ["claude", "gemini"],
                statuses: ["completed", "failed"],
                confidence: "high",
                confidenceScore: 11,
                signals: ["shared build issue family"],
              },
            ],
            total: 1,
          },
        },
        "list-sessions": (request) => ({
          structuredContent: {
            filters: {
              query: request.arguments.query as string | undefined,
              issueKey: request.arguments.issueKey as string | undefined,
              host: request.arguments.host as
                | "claude"
                | "gemini"
                | "codex"
                | undefined,
              status: request.arguments.status as
                | "running"
                | "completed"
                | "failed"
                | "interrupted"
                | undefined,
            },
            sessions: paginate(sessions, request),
            total: sessions.length,
          },
        }),
        "get-history-trends": (request) => ({
          structuredContent: {
            filters: {
              query: request.arguments.query as string | undefined,
              issueKey: request.arguments.issueKey as string | undefined,
              host: request.arguments.host as
                | "claude"
                | "gemini"
                | "codex"
                | undefined,
              status: request.arguments.status as
                | "running"
                | "completed"
                | "failed"
                | "interrupted"
                | undefined,
              groupBy: "issue",
            },
            summary: {
              groupBy: "issue",
              totalTrends: trends.length,
              matchingSessions: sessions.length,
              totalAttempts: trends.length,
              byOutcome: {
                failed: 4,
                succeeded: 3,
                other: 0,
              },
            },
            total: trends.length,
            trends: paginate(trends, request),
          },
        }),
        "get-history-handoff": {
          structuredContent: {
            filters: {
              query: "build",
              groupBy: "issue",
            },
            summary: {
              groupBy: "issue",
              headline:
                "10 session(s) matched across 2 host(s); 4 blocking trend(s) remain active. Latest session: Build session 10 (failed).",
              matchingSessions: 10,
              matchingHosts: ["claude", "gemini"],
              statuses: ["completed", "failed"],
              totalTrends: 7,
              blockingTrends: 4,
              unresolvedQuestions: 0,
              latestSessionId: "session-10",
              latestSessionLabel: "Build session 10",
              latestStartedAt: "2026-03-10T12:09:00.000Z",
            },
            blockers: [
              "build:issue-7: Build issue 7 (sessions 1, attempts 1, latest failed, hosts claude)",
            ],
            followUps: [],
            recentSessions: sessions.slice(-2).map((session) => ({
              id: session.id,
              label: session.label,
              host: session.host,
              status: session.status,
              startedAt: session.startedAt,
            })),
            markdown: "# History Handoff",
          },
        },
        "search-history": (request) => ({
          structuredContent: {
            query: (request.arguments.query as string | undefined) ?? "build",
            filters: {},
            results: paginate(searchResults, request),
            total: searchResults.length,
          },
        }),
      },
    );

    cleanup = bootSessionDashboard(app, document, window);

    await expect
      .element(
        page.getByText(
          "Showing 8 of 10 recent saved work records. Open one to see what happened.",
        ),
      )
      .toBeInTheDocument();
    await expect
      .element(page.getByText("Showing 1 ongoing topics out of 1."))
      .toBeInTheDocument();
    await expect
      .element(
        page.getByRole("button", {
          name: "Open latest work for Auth timeout workstream",
        }),
      )
      .toBeInTheDocument();
    await expect
      .element(
        page.getByText(
          "Showing 6 specific problem items out of 7. 0 still need attention, 0 improved, and 0 came back again.",
        ),
      )
      .toBeInTheDocument();
    await expect
      .element(page.getByText("Showing 6 earlier saved work records out of 7."))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: "Show More Work" }))
      .toBeVisible();
    await expect
      .element(
        page.getByRole("button", { name: "Show More Repeated Problems" }),
      )
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Show More Results" }))
      .toBeVisible();

    await page.getByRole("button", { name: "Show More Work" }).click();

    expect(app.calls.at(-1)?.name).toBe("list-sessions");
    expect(app.calls.at(-1)?.arguments).toEqual({
      query: "build",
      issueKey: undefined,
      host: undefined,
      status: undefined,
      limit: 8,
      offset: 8,
    });
    await expect
      .element(
        page.getByText(
          "Showing 10 of 10 recent saved work records. Open one to see what happened.",
        ),
      )
      .toBeInTheDocument();
    await expect
      .element(
        page
          .getByRole("button", { name: "Open session Build session 10" })
          .first(),
      )
      .toBeInTheDocument();

    await page
      .getByRole("button", { name: "Show More Repeated Problems" })
      .click();

    expect(app.calls.at(-1)?.name).toBe("get-history-trends");
    expect(app.calls.at(-1)?.arguments).toEqual({
      query: "build",
      issueKey: undefined,
      host: undefined,
      status: undefined,
      groupBy: "issue",
      limit: 6,
      offset: 6,
    });
    await expect
      .element(
        page.getByText(
          "Showing 7 specific problem items out of 7. 0 still need attention, 0 improved, and 0 came back again.",
        ),
      )
      .toBeInTheDocument();
    await expect
      .element(
        page.getByRole("button", { name: "Show this problem Build issue 7" }),
      )
      .toBeInTheDocument();

    await page.getByRole("button", { name: "Show More Results" }).click();

    expect(app.calls.at(-1)?.name).toBe("search-history");
    expect(app.calls.at(-1)?.arguments).toEqual({
      query: "build",
      host: undefined,
      status: undefined,
      limit: 6,
      offset: 6,
    });
    expect(
      document.getElementById("search-summary")?.textContent ?? "",
    ).toContain("Showing 7 earlier saved work records out of 7.");
    await expect
      .element(page.getByText("build output snippet 7"))
      .toBeInTheDocument();
  });

  test("detail workflows ignore narrative and decision tool results", async () => {
    document.body.innerHTML = detailMarkup;
    const downloads: Array<{ filename: string; mimeType: string }> = [];

    const sessionResult = {
      structuredContent: {
        session: {
          id: "session-1",
          host: "claude",
          label: "Detail session",
          status: "completed",
          projectRoot: "/tmp/project",
          cwd: "/tmp/project",
          startedAt: "2026-03-10T12:00:00.000Z",
          endedAt: "2026-03-10T12:03:00.000Z",
        },
        messageSummary: {
          total: 2,
          byRole: { user: 1, assistant: 1, system: 0 },
        },
        timelineSummary: {
          total: 2,
          eventTypes: ["message.user.submitted", "message.assistant.completed"],
        },
        artifactSummary: {
          total: 3,
          byType: {
            fileChange: 1,
            commandOutput: 1,
            testResult: 1,
            gitCommit: 0,
          },
        },
        trendContext: {
          summary: {
            totalTrends: 1,
            crossSessionTrends: 1,
            sessionAttempts: 2,
            globalAttempts: 3,
            otherSessions: 1,
          },
          trends: [
            {
              issueKey: "test:pnpm-test-browser",
              label: "pnpm test:browser",
              kind: "test",
              issueFamilyKey: "test-family:pnpm",
              issueFamilyLabel: "pnpm tests",
              relatedIssueKeys: ["test:pnpm-test-browser"],
              lastSeenAt: "2026-03-10T12:04:00.000Z",
              sessionCount: 2,
              sessionAttempts: 2,
              globalAttempts: 3,
              sessionLatestOutcome: "completed",
              latestOutcome: "failed",
              hosts: ["claude", "gemini"],
              relatedSessionCount: 1,
              relatedSessions: [
                {
                  sessionId: "session-2",
                  label: "Retry session",
                  host: "gemini",
                  status: "failed",
                  lastAttemptAt: "2026-03-10T12:04:00.000Z",
                  attempts: 1,
                  latestOutcome: "failed",
                },
              ],
            },
          ],
        },
        messages: [
          { seq: 1, role: "user", content: "Ship it" },
          { seq: 2, role: "assistant", content: "Done" },
        ],
        timeline: [
          { seq: 1, eventType: "message.user.submitted", summary: "Ship it" },
          { seq: 2, eventType: "message.assistant.completed", summary: "Done" },
        ],
        hasNarratives: true,
      },
    };

    const app = new MockApp(sessionResult, {
      "get-session": sessionResult,
      "get-session-artifacts": {
        structuredContent: {
          sessionId: "session-1",
          page: {
            total: 1,
            offset: 0,
            limit: 50,
            returned: 1,
            hasMore: false,
            nextOffset: null,
          },
          artifacts: [
            {
              artifactType: "command-output",
              summary: "pnpm test",
              category: "test",
              status: "completed",
              path: null,
            },
          ],
        },
      },
      "reingest-session": {
        structuredContent: {
          id: "session-1",
          narrativesCreated: 3,
        },
      },
      "export-sessions": {
        structuredContent: {
          filename: "session-export-2026-03-10-abcd1234.zip",
          base64Data: "UEsDBAoAAAAAA",
          sessionCount: 1,
          success: true,
        },
      },
      "get-session-narrative": {
        structuredContent: {
          sessionId: "session-1",
          page: {
            total: 1,
            offset: 0,
            limit: 50,
            returned: 1,
            hasMore: false,
            nextOffset: null,
          },
          narratives: [{ kind: "handoff", content: "Handed off cleanly" }],
        },
      },
      "get-session-decisions": {
        structuredContent: {
          sessionId: "session-1",
          page: {
            total: 1,
            offset: 0,
            limit: 50,
            returned: 1,
            hasMore: false,
            nextOffset: null,
          },
          decisions: [
            {
              title: "Ship browser hardening",
              status: "accepted",
              summary: "Browser workflow coverage is now required.",
            },
          ],
        },
      },
    });

    cleanup = bootSessionDetail(app, document, window, (archive) => {
      downloads.push({
        filename: archive.filename,
        mimeType: archive.mimeType,
      });
    });

    await expect.element(page.getByText("Detail work")).toBeInTheDocument();
    expect(document.getElementById("messages")?.textContent ?? "").toContain(
      "Ship it",
    );
    expect(document.getElementById("messages")?.textContent ?? "").toContain(
      "Done",
    );
    await page.getByRole("button", { name: "Load Supporting Details" }).click();
    await expect
      .element(page.getByText("Command Run · Test · Done"))
      .toBeInTheDocument();
    expect(document.getElementById("error")?.textContent ?? "").toBe("");

    await page.getByRole("button", { name: "Load Simple Summary" }).click();
    await expect
      .element(page.getByText("Handed off cleanly"))
      .toBeInTheDocument();
    expect(document.getElementById("error")?.textContent ?? "").toBe("");

    await page.getByRole("button", { name: "Load Key Decisions" }).click();
    await expect
      .element(page.getByText("Ship browser hardening"))
      .toBeInTheDocument();
    expect(document.getElementById("error")?.textContent ?? "").toBe("");

    await page.getByRole("button", { name: "Export ZIP" }).click();
    expect(downloads).toEqual([
      {
        filename: "session-export-2026-03-10-abcd1234.zip",
        mimeType: "application/zip",
      },
    ]);
    expect(document.getElementById("error")?.textContent ?? "").toContain(
      "Exported session bundle",
    );

    await page.getByRole("button", { name: "Refresh Overview" }).click();
    expect(
      app.calls
        .map((call) => call.name)
        .filter((name) =>
          [
            "get-session-artifacts",
            "get-session-narrative",
            "get-session-decisions",
            "export-sessions",
            "reingest-session",
            "get-session",
          ].includes(name),
        ),
    ).toEqual([
      "get-session-artifacts",
      "get-session-narrative",
      "get-session-decisions",
      "export-sessions",
      "reingest-session",
      "get-session",
    ]);
    await expect
      .element(page.getByText("No supporting details have been loaded yet."))
      .toBeInTheDocument();
    expect(document.getElementById("error")?.textContent ?? "").toBe("");
  });

  test("detail context review can confirm, move, and activate contexts", async () => {
    document.body.innerHTML = detailMarkup;

    const sessionResult = {
      structuredContent: {
        session: {
          id: "session-1",
          host: "claude",
          label: "Context review session",
          status: "completed",
          projectRoot: "/tmp/project",
          cwd: "/tmp/project",
          startedAt: "2026-03-10T12:00:00.000Z",
          endedAt: "2026-03-10T12:03:00.000Z",
        },
        messageSummary: {
          total: 1,
          byRole: { user: 1, assistant: 0, system: 0 },
        },
        timelineSummary: {
          total: 1,
          eventTypes: ["message.user.submitted"],
        },
        artifactSummary: {
          total: 0,
          byType: {
            fileChange: 0,
            commandOutput: 0,
            testResult: 0,
            gitCommit: 0,
          },
        },
        trendContext: {
          summary: {
            totalTrends: 0,
            crossSessionTrends: 0,
            sessionAttempts: 0,
            globalAttempts: 0,
            otherSessions: 0,
          },
          trends: [],
        },
        messages: [{ seq: 1, role: "user", content: "Review contexts" }],
        timeline: [
          {
            seq: 1,
            eventType: "message.user.submitted",
            summary: "Review contexts",
          },
        ],
        hasNarratives: false,
      },
    };
    const authContext = createContextListItem(
      "context-auth",
      "Auth timeout workstream",
      "session-auth",
      "Auth retry",
    );
    const uiContext = createContextListItem(
      "context-ui",
      "Dashboard UI workstream",
      "session-ui",
      "UI filter polish",
    );
    let phase: "suggested" | "linked-auth" | "linked-ui" = "suggested";

    const app = new MockApp(sessionResult, {
      "resolve-context": () => ({
        structuredContent:
          phase === "suggested"
            ? {
                mode: "suggested",
                sessionId: "session-1",
                cwd: "/tmp/project",
                confirmationRequired: true,
                recommendedAction: "confirm-existing",
                linkedContextId: null,
                currentContext: null,
                briefing: null,
                candidates: [
                  {
                    kind: "existing-context",
                    contextId: authContext.id,
                    label: authContext.label,
                    workspaceKey: authContext.workspaceKey,
                    confidence: "high",
                    confidenceScore: 12,
                    reasons: ["shared issue family", "same auth retries"],
                    sessionIds: ["session-auth"],
                    latestSessionId: authContext.latestSessionId,
                    latestSessionLabel: authContext.latestSessionLabel,
                    preferred: false,
                    confirmationRequired: true,
                  },
                ],
              }
            : phase === "linked-auth"
              ? {
                  mode: "linked",
                  sessionId: "session-1",
                  cwd: "/tmp/project",
                  confirmationRequired: false,
                  recommendedAction: "use-linked",
                  linkedContextId: authContext.id,
                  currentContext: authContext,
                  briefing: createContextReport(
                    authContext,
                    "Focus on auth timeout fixes.",
                  ),
                  candidates: [],
                }
              : {
                  mode: "linked",
                  sessionId: "session-1",
                  cwd: "/tmp/project",
                  confirmationRequired: false,
                  recommendedAction: "use-linked",
                  linkedContextId: uiContext.id,
                  currentContext: uiContext,
                  briefing: createContextReport(
                    uiContext,
                    "Focus on dashboard review polish.",
                  ),
                  candidates: [],
                },
      }),
      "list-contexts": () => ({
        structuredContent: {
          contexts: [authContext, uiContext],
          total: 2,
        },
      }),
      "confirm-context-link": () => {
        phase = "linked-auth";
        return {
          structuredContent: {
            action: "confirmed",
            context: authContext,
            affectedSessionIds: ["session-1"],
            contextId: authContext.id,
            mergedFromContextId: null,
          },
        };
      },
      "move-session-context": (request) => {
        expect(request.arguments).toEqual({
          sessionId: "session-1",
          contextId: "context-ui",
        });
        phase = "linked-ui";
        return {
          structuredContent: {
            action: "moved",
            context: uiContext,
            affectedSessionIds: ["session-1"],
            contextId: uiContext.id,
            mergedFromContextId: null,
          },
        };
      },
      "set-active-context": (request) => {
        expect(request.arguments).toEqual({
          contextId: "context-ui",
          cwd: "/tmp/project",
        });
        return {
          structuredContent: {
            action: "preferred",
            context: uiContext,
            affectedSessionIds: [],
            contextId: uiContext.id,
            mergedFromContextId: null,
          },
        };
      },
    });

    cleanup = bootSessionDetail(app, document, window);

    await expect
      .element(
        page.getByText(
          "No topic has been confirmed yet. Review the suggestions below before linking anything.",
        ),
      )
      .toBeInTheDocument();
    await expect
      .element(
        page.getByRole("button", {
          name: "Link to topic Auth timeout workstream",
        }),
      )
      .toBeInTheDocument();

    await page
      .getByRole("button", {
        name: "Link to topic Auth timeout workstream",
      })
      .click();

    await expect
      .element(
        page.getByText(
          'This work is already part of "Auth timeout workstream". Start here before continuing.',
        ),
      )
      .toBeInTheDocument();
    await expect
      .element(page.getByText("Continue from the latest retry."))
      .toBeInTheDocument();

    const select = document.getElementById(
      "context-target-select",
    ) as HTMLSelectElement;
    select.value = "context-ui";

    await page.getByRole("button", { name: "Move There" }).click();

    await expect
      .element(
        page.getByText(
          'This work is already part of "Dashboard UI workstream". Start here before continuing.',
        ),
      )
      .toBeInTheDocument();
    await expect
      .element(page.getByText("Continue from the latest retry."))
      .toBeInTheDocument();

    await page
      .getByRole("button", { name: "Make This The Main Topic" })
      .click();

    expect(document.getElementById("error")?.textContent ?? "").toContain(
      "preferred context for this workspace",
    );
  });

  test("detail context review can reject a suggestion and create a new context from related sessions", async () => {
    document.body.innerHTML = detailMarkup;

    const sessionResult = {
      structuredContent: {
        session: {
          id: "session-1",
          host: "claude",
          label: "Candidate session",
          status: "completed",
          projectRoot: "/tmp/project",
          cwd: "/tmp/project",
          startedAt: "2026-03-10T12:00:00.000Z",
          endedAt: "2026-03-10T12:03:00.000Z",
        },
        messageSummary: {
          total: 1,
          byRole: { user: 1, assistant: 0, system: 0 },
        },
        timelineSummary: {
          total: 1,
          eventTypes: ["message.user.submitted"],
        },
        artifactSummary: {
          total: 0,
          byType: {
            fileChange: 0,
            commandOutput: 0,
            testResult: 0,
            gitCommit: 0,
          },
        },
        trendContext: {
          summary: {
            totalTrends: 0,
            crossSessionTrends: 0,
            sessionAttempts: 0,
            globalAttempts: 0,
            otherSessions: 0,
          },
          trends: [],
        },
        messages: [
          { seq: 1, role: "user", content: "Resolve the right context" },
        ],
        timeline: [
          {
            seq: 1,
            eventType: "message.user.submitted",
            summary: "Resolve the right context",
          },
        ],
        hasNarratives: false,
      },
    };
    const authContext = createContextListItem(
      "context-auth",
      "Auth timeout workstream",
      "session-auth",
      "Auth retry",
    );
    const newContext = createContextListItem(
      "context-candidate",
      "Suggested retry context",
      "session-1",
      "Candidate session",
    );
    let phase: "suggested" | "rejected" | "linked-new" = "suggested";

    const app = new MockApp(sessionResult, {
      "resolve-context": () => ({
        structuredContent:
          phase === "linked-new"
            ? {
                mode: "linked",
                sessionId: "session-1",
                cwd: "/tmp/project",
                confirmationRequired: false,
                recommendedAction: "use-linked",
                linkedContextId: newContext.id,
                currentContext: newContext,
                briefing: createContextReport(
                  newContext,
                  "Continue with the newly confirmed retry context.",
                ),
                candidates: [],
              }
            : {
                mode: "suggested",
                sessionId: "session-1",
                cwd: "/tmp/project",
                confirmationRequired: true,
                recommendedAction:
                  phase === "suggested"
                    ? "choose-candidate"
                    : "create-new-context",
                linkedContextId: null,
                currentContext: null,
                briefing: null,
                candidates:
                  phase === "suggested"
                    ? [
                        {
                          kind: "existing-context",
                          contextId: authContext.id,
                          label: authContext.label,
                          workspaceKey: authContext.workspaceKey,
                          confidence: "medium",
                          confidenceScore: 8,
                          reasons: ["same workspace", "partial retry overlap"],
                          sessionIds: ["session-auth"],
                          latestSessionId: authContext.latestSessionId,
                          latestSessionLabel: authContext.latestSessionLabel,
                          preferred: false,
                          confirmationRequired: true,
                        },
                        {
                          kind: "new-context",
                          contextId: null,
                          label: newContext.label,
                          workspaceKey: newContext.workspaceKey,
                          confidence: "high",
                          confidenceScore: 9,
                          reasons: [
                            "unlinked retry thread",
                            "shared follow-up goal",
                          ],
                          sessionIds: ["session-1", "session-2"],
                          latestSessionId: "session-2",
                          latestSessionLabel: "Candidate companion",
                          preferred: false,
                          confirmationRequired: true,
                        },
                      ]
                    : [
                        {
                          kind: "new-context",
                          contextId: null,
                          label: newContext.label,
                          workspaceKey: newContext.workspaceKey,
                          confidence: "high",
                          confidenceScore: 9,
                          reasons: [
                            "unlinked retry thread",
                            "shared follow-up goal",
                          ],
                          sessionIds: ["session-1", "session-2"],
                          latestSessionId: "session-2",
                          latestSessionLabel: "Candidate companion",
                          preferred: false,
                          confirmationRequired: true,
                        },
                      ],
              },
      }),
      "list-contexts": () => ({
        structuredContent: {
          contexts:
            phase === "linked-new" ? [authContext, newContext] : [authContext],
          total: phase === "linked-new" ? 2 : 1,
        },
      }),
      "reject-context-link": (request) => {
        expect(request.arguments).toEqual({
          sessionId: "session-1",
          contextId: "context-auth",
        });
        phase = "rejected";
        return {
          structuredContent: {
            action: "rejected",
            context: null,
            affectedSessionIds: ["session-1"],
            contextId: "context-auth",
            mergedFromContextId: null,
          },
        };
      },
      "confirm-context-link": (request) => {
        expect(request.arguments).toEqual({
          sessionIds: ["session-1", "session-2"],
          label: "Suggested retry context",
        });
        phase = "linked-new";
        return {
          structuredContent: {
            action: "confirmed",
            context: newContext,
            affectedSessionIds: ["session-1", "session-2"],
            contextId: newContext.id,
            mergedFromContextId: null,
          },
        };
      },
    });

    cleanup = bootSessionDetail(app, document, window);

    await expect
      .element(
        page.getByRole("button", {
          name: "Keep Auth timeout workstream separate",
        }),
      )
      .toBeInTheDocument();

    await page
      .getByRole("button", {
        name: "Keep Auth timeout workstream separate",
      })
      .click();

    await expect
      .element(
        page.getByRole("button", {
          name: "Start new topic Suggested retry context",
        }),
      )
      .toBeInTheDocument();
    expect(
      document.getElementById("context-candidates")?.textContent ?? "",
    ).not.toContain("Auth timeout workstream");

    await page
      .getByRole("button", {
        name: "Start new topic Suggested retry context",
      })
      .click();

    await expect
      .element(
        page.getByText(
          'This work is already part of "Suggested retry context". Start here before continuing.',
        ),
      )
      .toBeInTheDocument();
    await expect
      .element(page.getByText("Continue from the latest retry."))
      .toBeInTheDocument();
  });

  test("detail loads paginated message and timeline slices on demand", async () => {
    document.body.innerHTML = detailMarkup;

    const pagedSessionResult = {
      structuredContent: {
        session: {
          id: "session-1",
          host: "claude",
          label: "Paged session",
          status: "completed",
          projectRoot: "/tmp/project",
          cwd: "/tmp/project",
          startedAt: "2026-03-10T12:00:00.000Z",
          endedAt: "2026-03-10T12:03:00.000Z",
        },
        messageSummary: {
          total: 3,
          byRole: { user: 1, assistant: 2, system: 0 },
        },
        timelineSummary: {
          total: 3,
          eventTypes: [
            "message.user.submitted",
            "message.assistant.completed",
            "session.end",
          ],
        },
        artifactSummary: {
          total: 0,
          byType: {
            fileChange: 0,
            commandOutput: 0,
            testResult: 0,
            gitCommit: 0,
          },
        },
        trendContext: {
          summary: {
            totalTrends: 0,
            crossSessionTrends: 0,
            sessionAttempts: 0,
            globalAttempts: 0,
            otherSessions: 0,
          },
          trends: [],
        },
        messagePage: {
          total: 3,
          offset: 0,
          limit: 2,
          returned: 2,
          hasMore: true,
          nextOffset: 2,
        },
        timelinePage: {
          total: 3,
          offset: 0,
          limit: 2,
          returned: 2,
          hasMore: true,
          nextOffset: 2,
        },
        messages: [
          { seq: 1, role: "user", content: "Start with the first step" },
          { seq: 2, role: "assistant", content: "Captured the first reply" },
        ],
        timeline: [
          {
            seq: 1,
            eventType: "message.user.submitted",
            summary: "Start with the first step",
          },
          {
            seq: 2,
            eventType: "message.assistant.completed",
            summary: "Captured the first reply",
          },
        ],
        hasNarratives: false,
      },
    };

    const app = new MockApp(pagedSessionResult, {
      "get-session-messages": {
        structuredContent: {
          sessionId: "session-1",
          total: 3,
          page: {
            total: 3,
            offset: 2,
            limit: 2,
            returned: 1,
            hasMore: false,
            nextOffset: null,
          },
          messages: [
            { seq: 3, role: "assistant", content: "Captured the final reply" },
          ],
        },
      },
      "get-session-timeline": {
        structuredContent: {
          sessionId: "session-1",
          total: 3,
          page: {
            total: 3,
            offset: 2,
            limit: 2,
            returned: 1,
            hasMore: false,
            nextOffset: null,
          },
          timeline: [
            {
              seq: 3,
              eventType: "session.end",
              summary: "Completed successfully",
            },
          ],
        },
      },
    });

    cleanup = bootSessionDetail(app, document, window);

    await expect.element(page.getByText("Paged work")).toBeInTheDocument();
    expect(document.getElementById("messages")?.textContent ?? "").toContain(
      "Start with the first step",
    );
    await expect
      .element(page.getByRole("button", { name: "Show More Conversation" }))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Show More Steps" }))
      .toBeVisible();

    await page.getByRole("button", { name: "Show More Conversation" }).click();
    await page.getByRole("button", { name: "Show More Steps" }).click();

    expect(
      app.calls.filter(
        (call) =>
          call.name === "get-session-messages" ||
          call.name === "get-session-timeline",
      ),
    ).toEqual([
      {
        name: "get-session-messages",
        arguments: { id: "session-1", limit: 2, offset: 2 },
      },
      {
        name: "get-session-timeline",
        arguments: { id: "session-1", limit: 2, offset: 2 },
      },
    ]);
    expect(document.getElementById("messages")?.textContent ?? "").toContain(
      "Captured the final reply",
    );
    await expect
      .element(page.getByText("Completed successfully"))
      .toBeInTheDocument();
    expect(
      document.getElementById("load-more-messages")?.hasAttribute("hidden"),
    ).toBe(true);
    expect(
      document.getElementById("load-more-timeline")?.hasAttribute("hidden"),
    ).toBe(true);
  });

  test("detail loads paginated recurring trend slices on demand", async () => {
    document.body.innerHTML = detailMarkup;

    const pagedSessionResult = {
      structuredContent: {
        session: {
          id: "session-1",
          host: "claude",
          label: "Paged trends session",
          status: "completed",
          projectRoot: "/tmp/project",
          cwd: "/tmp/project",
          startedAt: "2026-03-10T12:00:00.000Z",
          endedAt: "2026-03-10T12:03:00.000Z",
        },
        messageSummary: {
          total: 1,
          byRole: { user: 1, assistant: 0, system: 0 },
        },
        timelineSummary: {
          total: 1,
          eventTypes: ["message.user.submitted"],
        },
        artifactSummary: {
          total: 0,
          byType: {
            fileChange: 0,
            commandOutput: 0,
            testResult: 0,
            gitCommit: 0,
          },
        },
        trendContext: {
          summary: {
            totalTrends: 3,
            crossSessionTrends: 2,
            sessionAttempts: 4,
            globalAttempts: 6,
            otherSessions: 2,
          },
          page: {
            total: 3,
            offset: 0,
            limit: 2,
            returned: 2,
            hasMore: true,
            nextOffset: 2,
          },
          trends: [
            {
              issueKey: "test:pnpm-lint",
              label: "pnpm lint",
              kind: "test",
              issueFamilyKey: "test-family:pnpm",
              issueFamilyLabel: "pnpm tests",
              relatedIssueKeys: ["test:pnpm-lint"],
              lastSeenAt: "2026-03-10T12:02:00.000Z",
              sessionCount: 2,
              sessionAttempts: 2,
              globalAttempts: 3,
              sessionLatestOutcome: "succeeded",
              latestOutcome: "failed",
              hosts: ["claude", "codex"],
              statuses: ["completed", "failed"],
              relatedSessionCount: 1,
              relatedSessions: [
                {
                  sessionId: "session-2",
                  label: "Retry lint",
                  host: "codex",
                  status: "failed",
                  lastAttemptAt: "2026-03-10T12:01:00.000Z",
                  attempts: 1,
                  latestOutcome: "failed",
                },
              ],
            },
            {
              issueKey: "build:webpack",
              label: "webpack build",
              kind: "build",
              issueFamilyKey: "build-family:webpack",
              issueFamilyLabel: "webpack builds",
              relatedIssueKeys: ["build:webpack"],
              lastSeenAt: "2026-03-10T12:02:30.000Z",
              sessionCount: 1,
              sessionAttempts: 1,
              globalAttempts: 1,
              sessionLatestOutcome: "succeeded",
              latestOutcome: "succeeded",
              hosts: ["claude"],
              statuses: ["completed"],
              relatedSessionCount: 0,
              relatedSessions: [],
            },
          ],
        },
        messages: [{ seq: 1, role: "user", content: "Load trends" }],
        timeline: [
          {
            seq: 1,
            eventType: "message.user.submitted",
            summary: "Load trends",
          },
        ],
        hasNarratives: false,
      },
    };

    const app = new MockApp(pagedSessionResult, {
      "get-session-trends": {
        structuredContent: {
          sessionId: "session-1",
          summary: {
            totalTrends: 3,
            crossSessionTrends: 2,
            sessionAttempts: 4,
            globalAttempts: 6,
            otherSessions: 2,
          },
          page: {
            total: 3,
            offset: 2,
            limit: 2,
            returned: 1,
            hasMore: false,
            nextOffset: null,
          },
          trends: [
            {
              issueKey: "deploy:pages",
              label: "pages deploy",
              kind: "deploy",
              issueFamilyKey: "deploy-family:pages",
              issueFamilyLabel: "pages deploys",
              relatedIssueKeys: ["deploy:pages"],
              lastSeenAt: "2026-03-10T12:03:00.000Z",
              sessionCount: 1,
              sessionAttempts: 1,
              globalAttempts: 2,
              sessionLatestOutcome: "failed",
              latestOutcome: "failed",
              hosts: ["claude", "gemini"],
              statuses: ["completed", "failed"],
              relatedSessionCount: 1,
              relatedSessions: [
                {
                  sessionId: "session-3",
                  label: "Retry deploy",
                  host: "gemini",
                  status: "failed",
                  lastAttemptAt: "2026-03-10T12:02:45.000Z",
                  attempts: 1,
                  latestOutcome: "failed",
                },
              ],
            },
          ],
        },
      },
    });

    cleanup = bootSessionDetail(app, document, window);

    await expect
      .element(page.getByText("Paged trends session"))
      .toBeInTheDocument();
    await expect
      .element(page.getByRole("button", { name: "Show More Related Work" }))
      .toBeVisible();

    await page.getByRole("button", { name: "Show More Related Work" }).click();

    expect(
      app.calls.filter((call) => call.name === "get-session-trends"),
    ).toEqual([
      {
        name: "get-session-trends",
        arguments: { id: "session-1", limit: 2, offset: 2 },
      },
    ]);
    await expect
      .element(page.getByText("pages deploy", { exact: true }))
      .toBeInTheDocument();
    expect(
      document
        .getElementById("load-more-session-trends")
        ?.hasAttribute("hidden"),
    ).toBe(true);
  });

  test("detail loads paginated artifact slices on demand", async () => {
    document.body.innerHTML = detailMarkup;

    const pagedSessionResult = {
      structuredContent: {
        session: {
          id: "session-1",
          host: "claude",
          label: "Paged artifacts session",
          status: "completed",
          projectRoot: "/tmp/project",
          cwd: "/tmp/project",
          startedAt: "2026-03-10T12:00:00.000Z",
          endedAt: "2026-03-10T12:03:00.000Z",
        },
        messageSummary: {
          total: 1,
          byRole: { user: 1, assistant: 0, system: 0 },
        },
        timelineSummary: {
          total: 1,
          eventTypes: ["message.user.submitted"],
        },
        artifactSummary: {
          total: 3,
          byType: {
            fileChange: 1,
            commandOutput: 2,
            testResult: 0,
            gitCommit: 0,
          },
        },
        trendContext: {
          summary: {
            totalTrends: 0,
            crossSessionTrends: 0,
            sessionAttempts: 0,
            globalAttempts: 0,
            otherSessions: 0,
          },
          trends: [],
        },
        messages: [{ seq: 1, role: "user", content: "Load artifacts" }],
        timeline: [
          {
            seq: 1,
            eventType: "message.user.submitted",
            summary: "Load artifacts",
          },
        ],
        hasNarratives: false,
      },
    };

    const app = new MockApp(pagedSessionResult, {
      "get-session-artifacts": (request) => {
        if (request.arguments.offset === 2) {
          return {
            structuredContent: {
              sessionId: "session-1",
              page: {
                total: 3,
                offset: 2,
                limit: 2,
                returned: 1,
                hasMore: false,
                nextOffset: null,
              },
              artifacts: [
                {
                  artifactType: "file-change",
                  summary: "src/server.ts",
                  category: "source",
                  status: "modified",
                  path: "src/server.ts",
                },
              ],
            },
          };
        }

        return {
          structuredContent: {
            sessionId: "session-1",
            page: {
              total: 3,
              offset: 0,
              limit: 2,
              returned: 2,
              hasMore: true,
              nextOffset: 2,
            },
            artifacts: [
              {
                artifactType: "command-output",
                summary: "pnpm lint",
                category: "lint",
                status: "completed",
                path: null,
              },
              {
                artifactType: "command-output",
                summary: "pnpm test",
                category: "test",
                status: "completed",
                path: null,
              },
            ],
          },
        };
      },
    });

    cleanup = bootSessionDetail(app, document, window);

    await expect
      .element(page.getByText("Paged artifacts session"))
      .toBeInTheDocument();

    await page.getByRole("button", { name: "Load Supporting Details" }).click();
    await expect.element(page.getByText("pnpm lint")).toBeInTheDocument();
    await expect
      .element(
        page.getByRole("button", { name: "Show More Supporting Details" }),
      )
      .toBeVisible();

    await page
      .getByRole("button", { name: "Show More Supporting Details" })
      .click();

    expect(
      app.calls.filter((call) => call.name === "get-session-artifacts"),
    ).toEqual([
      {
        name: "get-session-artifacts",
        arguments: { id: "session-1", limit: 50 },
      },
      {
        name: "get-session-artifacts",
        arguments: { id: "session-1", limit: 2, offset: 2 },
      },
    ]);
    await expect.element(page.getByText("src/server.ts")).toBeInTheDocument();
    expect(
      document.getElementById("load-more-artifacts")?.hasAttribute("hidden"),
    ).toBe(true);
  });

  test("detail loads paginated narrative and decision slices on demand", async () => {
    document.body.innerHTML = detailMarkup;

    const pagedSessionResult = {
      structuredContent: {
        session: {
          id: "session-1",
          host: "claude",
          label: "Paged derived session",
          status: "completed",
          projectRoot: "/tmp/project",
          cwd: "/tmp/project",
          startedAt: "2026-03-10T12:00:00.000Z",
          endedAt: "2026-03-10T12:03:00.000Z",
        },
        messageSummary: {
          total: 1,
          byRole: { user: 1, assistant: 0, system: 0 },
        },
        timelineSummary: {
          total: 1,
          eventTypes: ["message.user.submitted"],
        },
        artifactSummary: {
          total: 0,
          byType: {
            fileChange: 0,
            commandOutput: 0,
            testResult: 0,
            gitCommit: 0,
          },
        },
        trendContext: {
          summary: {
            totalTrends: 0,
            crossSessionTrends: 0,
            sessionAttempts: 0,
            globalAttempts: 0,
            otherSessions: 0,
          },
          trends: [],
        },
        messages: [{ seq: 1, role: "user", content: "Load derived views" }],
        timeline: [
          {
            seq: 1,
            eventType: "message.user.submitted",
            summary: "Load derived views",
          },
        ],
        hasNarratives: true,
      },
    };

    const app = new MockApp(pagedSessionResult, {
      "get-session-narrative": (request) => {
        if (request.arguments.offset === 2) {
          return {
            structuredContent: {
              sessionId: "session-1",
              page: {
                total: 3,
                offset: 2,
                limit: 2,
                returned: 1,
                hasMore: false,
                nextOffset: null,
              },
              narratives: [
                {
                  kind: "handoff",
                  content: "Escalate the unresolved migration follow-up.",
                },
              ],
            },
          };
        }

        return {
          structuredContent: {
            sessionId: "session-1",
            page: {
              total: 3,
              offset: 0,
              limit: 2,
              returned: 2,
              hasMore: true,
              nextOffset: 2,
            },
            narratives: [
              {
                kind: "journal",
                content: "Recorded the initial retry timeline.",
              },
              {
                kind: "project-summary",
                content: "Tests now pass after adapter cleanup.",
              },
            ],
          },
        };
      },
      "get-session-decisions": (request) => {
        if (request.arguments.offset === 1) {
          return {
            structuredContent: {
              sessionId: "session-1",
              page: {
                total: 2,
                offset: 1,
                limit: 1,
                returned: 1,
                hasMore: false,
                nextOffset: null,
              },
              decisions: [
                {
                  title: "Keep Linux PTY smoke required",
                  status: "open",
                  summary:
                    "Retain the smoke gate until more host coverage lands.",
                },
              ],
            },
          };
        }

        return {
          structuredContent: {
            sessionId: "session-1",
            page: {
              total: 2,
              offset: 0,
              limit: 1,
              returned: 1,
              hasMore: true,
              nextOffset: 1,
            },
            decisions: [
              {
                title: "Ship artifact pagination",
                status: "accepted",
                summary: "Large derived histories must stay incremental.",
              },
            ],
          },
        };
      },
    });

    cleanup = bootSessionDetail(app, document, window);

    await expect
      .element(page.getByText("Paged derived session"))
      .toBeInTheDocument();

    await page.getByRole("button", { name: "Load Simple Summary" }).click();
    await page.getByRole("button", { name: "Load Key Decisions" }).click();
    await expect
      .element(page.getByRole("button", { name: "Show More Summaries" }))
      .toBeVisible();
    await expect
      .element(page.getByRole("button", { name: "Show More Decisions" }))
      .toBeVisible();

    await page.getByRole("button", { name: "Show More Summaries" }).click();
    await page.getByRole("button", { name: "Show More Decisions" }).click();

    expect(
      app.calls.filter(
        (call) =>
          call.name === "get-session-narrative" ||
          call.name === "get-session-decisions",
      ),
    ).toEqual([
      {
        name: "get-session-narrative",
        arguments: { id: "session-1", limit: 50 },
      },
      {
        name: "get-session-decisions",
        arguments: { id: "session-1", limit: 50 },
      },
      {
        name: "get-session-narrative",
        arguments: { id: "session-1", limit: 2, offset: 2 },
      },
      {
        name: "get-session-decisions",
        arguments: { id: "session-1", limit: 1, offset: 1 },
      },
    ]);
    await expect
      .element(page.getByText("Escalate the unresolved migration follow-up."))
      .toBeInTheDocument();
    await expect
      .element(page.getByText("Keep Linux PTY smoke required"))
      .toBeInTheDocument();
    expect(
      document.getElementById("load-more-narratives")?.hasAttribute("hidden"),
    ).toBe(true);
    expect(
      document.getElementById("load-more-decisions")?.hasAttribute("hidden"),
    ).toBe(true);
  });

  test("detail trend scopes can load handoff summaries and export the selected scope", async () => {
    document.body.innerHTML = detailMarkup;
    const downloads: Array<{ filename: string; mimeType: string }> = [];
    const exportDeferred = createDeferred<ToolResult>();

    const app = new MockApp(createScopeSessionResult(), {
      "get-history-handoff": (request) => ({
        structuredContent:
          request.arguments.groupBy === "family"
            ? {
                summary: {
                  groupBy: "family",
                  headline:
                    "3 session(s) matched across 3 host(s); 1 blocking trend(s) remain active. Latest session: Codex retry (failed).",
                },
                blockers: ["test-family:pnpm: pnpm tests remain unstable"],
                followUps: ["Next: compare flaky retries across hosts."],
                recentSessions: [
                  {
                    id: "session-3",
                    label: "Codex retry",
                    host: "codex",
                    status: "failed",
                    startedAt: "2026-03-10T12:05:00.000Z",
                  },
                ],
              }
            : {
                summary: {
                  groupBy: "issue",
                  headline:
                    "2 session(s) matched across 2 host(s); 1 blocking trend(s) remain active. Latest session: Gemini retry (failed).",
                },
                blockers: [
                  "test:pnpm-test-browser: pnpm test:browser is still failing",
                ],
                followUps: ["Next: stabilize browser fixture output."],
                recentSessions: [
                  {
                    id: "session-2",
                    label: "Gemini retry",
                    host: "gemini",
                    status: "failed",
                    startedAt: "2026-03-10T12:04:00.000Z",
                  },
                ],
              },
      }),
      "export-sessions": exportDeferred.promise,
    });

    cleanup = bootSessionDetail(app, document, window, (archive) => {
      downloads.push({
        filename: archive.filename,
        mimeType: archive.mimeType,
      });
    });

    await expect.element(page.getByText("Scope work")).toBeInTheDocument();
    await page
      .getByRole("button", {
        name: "Load broader summary for pnpm tests",
      })
      .click();

    expect(
      app.calls.find((call) => call.name === "get-history-handoff"),
    ).toEqual({
      name: "get-history-handoff",
      arguments: {
        issueKey: "test-family:pnpm",
        groupBy: "family",
      },
    });
    await expect
      .element(page.getByText(/broader pattern · pnpm tests/i))
      .toBeInTheDocument();
    await expect
      .element(page.getByText("test-family:pnpm: pnpm tests remain unstable"))
      .toBeInTheDocument();

    await page
      .getByRole("button", {
        name: "Export Broader Summary ZIP",
      })
      .click();

    expect(app.calls.find((call) => call.name === "export-sessions")).toEqual({
      name: "export-sessions",
      arguments: {
        issueKey: "test-family:pnpm",
        groupBy: "family",
        outputMode: "base64",
      },
    });

    await page
      .getByRole("button", {
        name: "Load summary for pnpm test:browser",
      })
      .click();

    expect(
      app.calls.filter((call) => call.name === "get-history-handoff").at(-1),
    ).toEqual({
      name: "get-history-handoff",
      arguments: {
        issueKey: "test:pnpm-test-browser",
        groupBy: "issue",
      },
    });
    await expect
      .element(page.getByText(/specific problem · pnpm test:browser/i))
      .toBeInTheDocument();
    await expect
      .element(
        page.getByText(
          "test:pnpm-test-browser: pnpm test:browser is still failing",
        ),
      )
      .toBeInTheDocument();

    exportDeferred.resolve({
      structuredContent: {
        filename: "scope-export-2026-03-10-abcd1234.zip",
        base64Data: "UEsDBAoAAAAAA",
        sessionCount: 3,
        success: true,
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(downloads).toEqual([
      {
        filename: "scope-export-2026-03-10-abcd1234.zip",
        mimeType: "application/zip",
      },
    ]);
    expect(document.getElementById("error")?.textContent ?? "").toContain(
      "Exported broader pattern summary:",
    );
    expect(
      document.getElementById("scope-handoff-summary")?.textContent,
    ).toContain("specific problem · pnpm test:browser");
  });

  test("detail restores the previous scope when a newer handoff load fails", async () => {
    document.body.innerHTML = detailMarkup;

    const app = new MockApp(createScopeSessionResult(), {
      "get-history-handoff": (request) => {
        if (request.arguments.groupBy === "family") {
          return {
            structuredContent: {
              summary: {
                groupBy: "family",
                headline:
                  "3 session(s) matched across 3 host(s); 1 blocking trend(s) remain active. Latest session: Codex retry (failed).",
              },
              blockers: ["test-family:pnpm: pnpm tests remain unstable"],
              followUps: ["Next: compare flaky retries across hosts."],
              recentSessions: [
                {
                  id: "session-3",
                  label: "Codex retry",
                  host: "codex",
                  status: "failed",
                  startedAt: "2026-03-10T12:05:00.000Z",
                },
              ],
            },
          };
        }

        throw new Error("Issue handoff backend timed out");
      },
    });

    cleanup = bootSessionDetail(app, document, window);

    await expect.element(page.getByText("Scope work")).toBeInTheDocument();
    await page
      .getByRole("button", {
        name: "Load broader summary for pnpm tests",
      })
      .click();

    await expect
      .element(page.getByText(/broader pattern · pnpm tests/i))
      .toBeInTheDocument();
    await expect
      .element(page.getByText("test-family:pnpm: pnpm tests remain unstable"))
      .toBeInTheDocument();

    await page
      .getByRole("button", {
        name: "Load summary for pnpm test:browser",
      })
      .click();

    expect(document.getElementById("error")?.textContent ?? "").toContain(
      "Issue handoff backend timed out",
    );
    expect(
      document.getElementById("scope-handoff-summary")?.textContent,
    ).toContain("broader pattern · pnpm tests");
    expect(
      document.getElementById("scope-handoff-results")?.textContent ?? "",
    ).toContain("test-family:pnpm: pnpm tests remain unstable");
    await expect
      .element(page.getByRole("button", { name: "Export Broader Summary ZIP" }))
      .toBeEnabled();
  });

  test("detail trend context can open the latest related session", async () => {
    document.body.innerHTML = detailMarkup;

    const primaryResult = {
      structuredContent: {
        session: {
          id: "session-1",
          host: "claude",
          label: "Primary session",
          status: "completed",
          projectRoot: "/tmp/project",
          cwd: "/tmp/project",
          startedAt: "2026-03-10T12:00:00.000Z",
          endedAt: "2026-03-10T12:03:00.000Z",
        },
        messageSummary: {
          total: 1,
          byRole: { user: 1, assistant: 0, system: 0 },
        },
        timelineSummary: {
          total: 1,
          eventTypes: ["message.user.submitted"],
        },
        artifactSummary: {
          total: 0,
          byType: {
            fileChange: 0,
            commandOutput: 0,
            testResult: 0,
            gitCommit: 0,
          },
        },
        trendContext: {
          summary: {
            totalTrends: 1,
            crossSessionTrends: 1,
            sessionAttempts: 1,
            globalAttempts: 2,
            otherSessions: 1,
          },
          trends: [
            {
              issueKey: "test:pnpm-test",
              label: "pnpm test",
              kind: "test",
              issueFamilyKey: "test-family:pnpm",
              issueFamilyLabel: "pnpm tests",
              relatedIssueKeys: ["test:pnpm-test"],
              lastSeenAt: "2026-03-10T12:05:00.000Z",
              sessionCount: 2,
              sessionAttempts: 1,
              globalAttempts: 2,
              sessionLatestOutcome: "completed",
              latestOutcome: "failed",
              hosts: ["claude", "gemini"],
              relatedSessionCount: 1,
              relatedSessions: [
                {
                  sessionId: "session-2",
                  label: "Follow-up failure",
                  host: "gemini",
                  status: "failed",
                  lastAttemptAt: "2026-03-10T12:05:00.000Z",
                  attempts: 1,
                  latestOutcome: "failed",
                },
              ],
            },
          ],
        },
        messages: [{ seq: 1, role: "user", content: "Start with pnpm test" }],
        timeline: [
          {
            seq: 1,
            eventType: "message.user.submitted",
            summary: "Start with pnpm test",
          },
        ],
        hasNarratives: false,
      },
    };

    const relatedResult = {
      structuredContent: {
        session: {
          id: "session-2",
          host: "gemini",
          label: "Follow-up failure",
          status: "failed",
          projectRoot: "/tmp/project",
          cwd: "/tmp/project",
          startedAt: "2026-03-10T12:04:00.000Z",
          endedAt: "2026-03-10T12:06:00.000Z",
        },
        messageSummary: {
          total: 1,
          byRole: { user: 0, assistant: 1, system: 0 },
        },
        timelineSummary: {
          total: 1,
          eventTypes: ["message.assistant.completed"],
        },
        artifactSummary: {
          total: 1,
          byType: {
            fileChange: 0,
            commandOutput: 1,
            testResult: 0,
            gitCommit: 0,
          },
        },
        trendContext: {
          summary: {
            totalTrends: 1,
            crossSessionTrends: 1,
            sessionAttempts: 1,
            globalAttempts: 2,
            otherSessions: 1,
          },
          trends: [
            {
              issueKey: "test:pnpm-test",
              label: "pnpm test",
              kind: "test",
              issueFamilyKey: "test-family:pnpm",
              issueFamilyLabel: "pnpm tests",
              relatedIssueKeys: ["test:pnpm-test"],
              lastSeenAt: "2026-03-10T12:05:00.000Z",
              sessionCount: 2,
              sessionAttempts: 1,
              globalAttempts: 2,
              sessionLatestOutcome: "failed",
              latestOutcome: "failed",
              hosts: ["claude", "gemini"],
              relatedSessionCount: 1,
              relatedSessions: [
                {
                  sessionId: "session-1",
                  label: "Primary session",
                  host: "claude",
                  status: "completed",
                  lastAttemptAt: "2026-03-10T12:03:00.000Z",
                  attempts: 1,
                  latestOutcome: "completed",
                },
              ],
            },
          ],
        },
        messages: [
          { seq: 1, role: "assistant", content: "Need another retry" },
        ],
        timeline: [
          {
            seq: 1,
            eventType: "message.assistant.completed",
            summary: "Need another retry",
          },
        ],
        hasNarratives: false,
      },
    };

    const app = new MockApp(primaryResult, {
      "get-session": (request) =>
        request.arguments.id === "session-2" ? relatedResult : primaryResult,
    });

    cleanup = bootSessionDetail(app, document, window);

    await expect.element(page.getByText("Primary work")).toBeInTheDocument();
    await expect
      .element(
        page.getByRole("button", {
          name: "Open latest related work Follow-up failure",
        }),
      )
      .toBeVisible();

    await page
      .getByRole("button", {
        name: "Open latest related work Follow-up failure",
      })
      .click();

    expect(app.calls.filter((call) => call.name === "get-session")).toEqual([
      {
        name: "get-session",
        arguments: { id: "session-2" },
      },
    ]);
    await expect
      .element(page.getByText("Follow-up failure"))
      .toBeInTheDocument();
    expect(document.getElementById("messages")?.textContent ?? "").toContain(
      "Need another retry",
    );
  });

  test("detail ignores stale related-session responses that resolve out of order", async () => {
    document.body.innerHTML = detailMarkup;

    const primaryResult = {
      structuredContent: {
        session: {
          id: "session-1",
          host: "claude",
          label: "Primary session",
          status: "completed",
          projectRoot: "/tmp/project",
          cwd: "/tmp/project",
          startedAt: "2026-03-10T12:00:00.000Z",
          endedAt: "2026-03-10T12:03:00.000Z",
        },
        messageSummary: {
          total: 1,
          byRole: { user: 1, assistant: 0, system: 0 },
        },
        timelineSummary: {
          total: 1,
          eventTypes: ["message.user.submitted"],
        },
        artifactSummary: {
          total: 0,
          byType: {
            fileChange: 0,
            commandOutput: 0,
            testResult: 0,
            gitCommit: 0,
          },
        },
        trendContext: {
          summary: {
            totalTrends: 2,
            crossSessionTrends: 2,
            sessionAttempts: 1,
            globalAttempts: 3,
            otherSessions: 2,
          },
          trends: [
            {
              issueKey: "test:older-failure",
              label: "Older failure",
              kind: "test",
              issueFamilyKey: "test-family:older",
              issueFamilyLabel: "Older failures",
              relatedIssueKeys: ["test:older-failure"],
              lastSeenAt: "2026-03-10T12:04:00.000Z",
              sessionCount: 2,
              sessionAttempts: 1,
              globalAttempts: 2,
              sessionLatestOutcome: "completed",
              latestOutcome: "failed",
              hosts: ["claude", "gemini"],
              relatedSessionCount: 1,
              relatedSessions: [
                {
                  sessionId: "session-2",
                  label: "Older retry",
                  host: "gemini",
                  status: "failed",
                  lastAttemptAt: "2026-03-10T12:04:00.000Z",
                  attempts: 1,
                  latestOutcome: "failed",
                },
              ],
            },
            {
              issueKey: "test:latest-retry",
              label: "Latest retry",
              kind: "test",
              issueFamilyKey: "test-family:latest",
              issueFamilyLabel: "Latest retries",
              relatedIssueKeys: ["test:latest-retry"],
              lastSeenAt: "2026-03-10T12:05:00.000Z",
              sessionCount: 2,
              sessionAttempts: 1,
              globalAttempts: 2,
              sessionLatestOutcome: "completed",
              latestOutcome: "completed",
              hosts: ["claude", "codex"],
              relatedSessionCount: 1,
              relatedSessions: [
                {
                  sessionId: "session-3",
                  label: "Latest retry",
                  host: "codex",
                  status: "completed",
                  lastAttemptAt: "2026-03-10T12:05:00.000Z",
                  attempts: 1,
                  latestOutcome: "completed",
                },
              ],
            },
          ],
        },
        messages: [{ seq: 1, role: "user", content: "Start investigation" }],
        timeline: [
          {
            seq: 1,
            eventType: "message.user.submitted",
            summary: "Start investigation",
          },
        ],
        hasNarratives: false,
      },
    };

    const olderResult = {
      structuredContent: {
        session: {
          id: "session-2",
          host: "gemini",
          label: "Older retry",
          status: "failed",
          projectRoot: "/tmp/project",
          cwd: "/tmp/project",
          startedAt: "2026-03-10T12:03:30.000Z",
          endedAt: "2026-03-10T12:04:30.000Z",
        },
        messageSummary: {
          total: 1,
          byRole: { user: 0, assistant: 1, system: 0 },
        },
        timelineSummary: {
          total: 1,
          eventTypes: ["message.assistant.completed"],
        },
        artifactSummary: {
          total: 0,
          byType: {
            fileChange: 0,
            commandOutput: 0,
            testResult: 0,
            gitCommit: 0,
          },
        },
        trendContext: {
          summary: {
            totalTrends: 0,
            crossSessionTrends: 0,
            sessionAttempts: 1,
            globalAttempts: 1,
            otherSessions: 0,
          },
          trends: [],
        },
        messages: [
          { seq: 1, role: "assistant", content: "Older retry still failed" },
        ],
        timeline: [
          {
            seq: 1,
            eventType: "message.assistant.completed",
            summary: "Older retry still failed",
          },
        ],
        hasNarratives: false,
      },
    };

    const latestResult = {
      structuredContent: {
        session: {
          id: "session-3",
          host: "codex",
          label: "Latest retry",
          status: "completed",
          projectRoot: "/tmp/project",
          cwd: "/tmp/project",
          startedAt: "2026-03-10T12:04:30.000Z",
          endedAt: "2026-03-10T12:05:30.000Z",
        },
        messageSummary: {
          total: 1,
          byRole: { user: 0, assistant: 1, system: 0 },
        },
        timelineSummary: {
          total: 1,
          eventTypes: ["message.assistant.completed"],
        },
        artifactSummary: {
          total: 0,
          byType: {
            fileChange: 0,
            commandOutput: 0,
            testResult: 0,
            gitCommit: 0,
          },
        },
        trendContext: {
          summary: {
            totalTrends: 0,
            crossSessionTrends: 0,
            sessionAttempts: 1,
            globalAttempts: 1,
            otherSessions: 0,
          },
          trends: [],
        },
        messages: [
          { seq: 1, role: "assistant", content: "Latest retry fixed it" },
        ],
        timeline: [
          {
            seq: 1,
            eventType: "message.assistant.completed",
            summary: "Latest retry fixed it",
          },
        ],
        hasNarratives: false,
      },
    };

    const olderDeferred = createDeferred<ToolResult>();
    const latestDeferred = createDeferred<ToolResult>();

    const app = new MockApp(primaryResult, {
      "get-session": (request) =>
        request.arguments.id === "session-2"
          ? olderDeferred.promise
          : latestDeferred.promise,
    });

    cleanup = bootSessionDetail(app, document, window);

    await expect.element(page.getByText("Primary work")).toBeInTheDocument();

    await page
      .getByRole("button", {
        name: "Open latest related work Older retry",
      })
      .click();
    await page
      .getByRole("button", {
        name: "Open latest related work Latest retry",
      })
      .click();

    expect(app.calls.filter((call) => call.name === "get-session")).toEqual([
      {
        name: "get-session",
        arguments: { id: "session-2" },
      },
      {
        name: "get-session",
        arguments: { id: "session-3" },
      },
    ]);

    latestDeferred.resolve(latestResult);

    await expect
      .element(page.getByText("Latest retry · Done · Codex"))
      .toBeInTheDocument();
    expect(document.getElementById("messages")?.textContent ?? "").toContain(
      "Latest retry fixed it",
    );

    olderDeferred.resolve(olderResult);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(document.getElementById("subtitle")?.textContent).toContain(
      "Latest retry · Done · Codex",
    );
    expect(document.getElementById("messages")?.textContent ?? "").toContain(
      "Latest retry fixed it",
    );
    expect(
      document.getElementById("messages")?.textContent ?? "",
    ).not.toContain("Older retry still failed");
  });
});
