import { describe, expect, it } from "vitest";
import {
  buildArtifactListHtml,
  buildContextCandidateListHtml,
  buildContextOverviewHtml,
  buildContextReportHtml,
  buildDecisionListHtml,
  buildErrorHtml,
  buildHistorySearchResultsHtml,
  buildHistoryTrendListHtml,
  buildNarrativeListHtml,
  buildSessionTrendContextHtml,
  buildSessionRowsHtml,
  canReingestSession,
} from "../ui/src/session-ui";

describe("Session UI helpers", () => {
  it("escapes untrusted dashboard content and disables reingest for running sessions", () => {
    const html = buildSessionRowsHtml(
      [
        {
          id: 'abc" onmouseover="alert(1)',
          host: "claude",
          label: '<img src=x onerror="alert(1)">',
          status: "running",
          startedAt: "<script>alert(1)</script>",
        },
      ],
      (value) => value,
    );

    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("disabled");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("escapes narrative, decision, and error content", () => {
    const narrativesHtml = buildNarrativeListHtml([
      {
        kind: "journal<script>",
        content: "<b>unsafe</b>\nnext line",
      },
    ]);
    const decisionsHtml = buildDecisionListHtml([
      {
        title: 'Ship "alpha"',
        status: "accepted",
        summary: "<svg onload=alert(1)>",
      },
    ]);
    const errorHtml = buildErrorHtml('failed <script>alert("x")</script>');
    const artifactsHtml = buildArtifactListHtml([
      {
        artifactType: "command-output",
        summary: "<b>pnpm test</b>",
        category: 'test" onclick="alert(1)',
        status: "<svg>",
        path: "src/<app>.ts",
        failureSignatureLabel: 'Assertion "failure"',
        testSuite: "src/<suite>.test.ts",
        testCase: 'renders "home"',
        dependencyAction: 'add" onclick="alert(1)',
        dependencyNames: ["react", 'react-dom" onclick="alert(1)'],
        changeScope: 'dependency-manifest" onclick="alert(1)',
        manifestKind: 'package.json" onclick="alert(1)',
      },
    ]);
    const searchResultsHtml = buildHistorySearchResultsHtml(
      [
        {
          sessionId: 'session" onclick="alert(1)',
          host: "codex",
          label: "<b>Search</b>",
          status: "failed",
          startedAt: "2026-03-10T12:00:00.000Z",
          snippets: ['<img src=x onerror="alert(1)">'],
        },
      ],
      (value) => value,
    );
    const trendHtml = buildHistoryTrendListHtml(
      [
        {
          groupBy: "issue",
          issueKey: 'test:pnpm-test" onclick="alert(1)',
          label: "<strong>pnpm test</strong>",
          kind: "test",
          relatedIssueKeys: ['test:pnpm-test" onclick="alert(1)'],
          blockerCategory: "test",
          blockerState: "active",
          remediationState: "regressed",
          remediationSummary:
            'Regressed after 1 successful attempt(s); latest "<svg>".',
          latestOutcome: "<svg>",
          latestFailureAt: "2026-03-10T12:00:00.000Z",
          latestSuccessAt: "2026-03-10T11:55:00.000Z",
          lastSeenAt: "2026-03-10T12:00:00.000Z",
          attemptCount: 3,
          sessionCount: 2,
          failedAttempts: 2,
          succeededAttempts: 1,
          otherAttempts: 0,
          hosts: ["claude", 'codex" onmouseover="alert(1)'],
          sessions: [
            {
              sessionId: "session-1",
              label: '<img src=x onerror="alert(1)">',
              host: "claude",
              status: "failed",
              attempts: 2,
              latestOutcome: "failed",
            },
          ],
        },
      ],
      (value) => value,
    );
    const trendContextHtml = buildSessionTrendContextHtml(
      [
        {
          issueKey: 'test:pnpm-test" onclick="alert(1)',
          label: "<strong>pnpm test</strong>",
          kind: "test",
          issueFamilyKey: 'test-family:pnpm" onclick="alert(1)',
          issueFamilyLabel: "<svg>pnpm tests</svg>",
          relatedIssueKeys: [
            'test:pnpm-test" onclick="alert(1)',
            "test:pnpm-browser",
          ],
          blockerCategory: "test",
          blockerState: "active",
          remediationState: "regressed",
          remediationSummary:
            'Regressed after 1 successful attempt(s); latest "<svg>".',
          lastSeenAt: "2026-03-10T12:00:00.000Z",
          latestFailureAt: "2026-03-10T12:00:00.000Z",
          latestSuccessAt: "2026-03-10T11:55:00.000Z",
          sessionCount: 2,
          sessionAttempts: 1,
          globalAttempts: 3,
          sessionLatestOutcome: "failed",
          latestOutcome: "<svg>",
          hosts: ["claude", 'codex" onmouseover="alert(1)'],
          relatedSessionCount: 1,
          relatedSessions: [
            {
              sessionId: 'session-2" onclick="alert(1)',
              label: '<img src=x onerror="alert(1)">',
              host: "gemini",
              status: "failed",
              lastAttemptAt: "2026-03-10T12:05:00.000Z",
              attempts: 2,
              latestOutcome: "failed",
            },
          ],
        },
      ],
      (value) => value,
    );
    const contextReportHtml = buildContextReportHtml(
      {
        context: {
          id: 'context" onclick="alert(1)',
          label: "<b>Auth</b>",
          workspaceKey: "/tmp/<project>",
          latestSessionId: 'session" onclick="alert(1)',
          latestSessionLabel: '<img src=x onerror="alert(1)">',
          latestStartedAt: "2026-03-10T12:00:00.000Z",
          latestEndedAt: null,
          sessionCount: 2,
          hosts: ["claude"],
          statuses: ["completed"],
          confidence: "high",
          confidenceScore: 11.2,
          signals: ["shared issue family"],
        },
        currentTruth: {
          summary: "<script>alert(1)</script>",
          latestSessionId: "session-1",
          latestSessionLabel: "Auth retry",
          latestSummaryNarrative: null,
          latestHandoff: null,
          activeBlockers: ["auth <timeout>"],
          openQuestions: ['should we "retry"?'],
        },
        activeDecisions: [
          {
            decisionId: "decision-1",
            title: 'Keep "retry" cap',
            summary: "summary",
            status: "accepted",
            createdAt: "2026-03-10T12:00:00.000Z",
          },
        ],
        supersededDecisions: [
          {
            decisionId: "decision-2",
            title: "<old>",
            summary: "summary",
            status: "rejected",
            createdAt: "2026-03-10T12:00:00.000Z",
            supersededByTitle: 'Use "new" flow',
          },
        ],
        sessions: [],
      },
      (value) => value,
    );
    const contextCandidatesHtml = buildContextCandidateListHtml([
      {
        kind: "existing-context",
        contextId: 'context" onclick="alert(1)',
        label: "<b>Auth</b>",
        workspaceKey: "/tmp/<project>",
        confidence: "high",
        confidenceScore: 12.3,
        reasons: ["shared <issue>", 'same "workspace"'],
        sessionIds: ["session-1"],
        latestSessionId: 'session" onclick="alert(1)',
        latestSessionLabel: "<img src=x onerror=alert(1)>",
        preferred: true,
        confirmationRequired: true,
      },
      {
        kind: "new-context",
        contextId: null,
        label: "<i>New context</i>",
        workspaceKey: "/tmp/<project>",
        confidence: "medium",
        confidenceScore: 7.4,
        reasons: ["thread <signal>"],
        sessionIds: ['session-1" onclick="alert(1)', "session-2"],
        latestSessionId: null,
        latestSessionLabel: null,
        preferred: false,
        confirmationRequired: true,
      },
    ]);
    const contextOverviewHtml = buildContextOverviewHtml(
      [
        {
          id: 'context" onclick="alert(1)',
          label: "<b>Auth</b>",
          workspaceKey: "/tmp/<project>",
          latestSessionId: 'session" onclick="alert(1)',
          latestSessionLabel: "<img src=x onerror=alert(1)>",
          latestStartedAt: "2026-03-10T12:00:00.000Z",
          latestEndedAt: null,
          sessionCount: 2,
          hosts: ["claude"],
          statuses: ["completed"],
          confidence: "high",
          confidenceScore: 12.3,
          signals: ["shared issue family"],
        },
      ],
      (value) => value,
    );
    const ansiSearchHtml = buildHistorySearchResultsHtml(
      [
        {
          sessionId: "session-ansi",
          host: "claude",
          label: "Cursor blink",
          status: "completed",
          startedAt: "2026-03-10T12:00:00.000Z",
          snippets: ["\u001b[?25hRecovered summary"],
        },
      ],
      (value) => value,
    );

    expect(narrativesHtml).toContain("Journal&lt;Script&gt;");
    expect(narrativesHtml).toContain("&lt;b&gt;unsafe&lt;/b&gt;<br>next line");
    expect(decisionsHtml).toContain("Ship &quot;alpha&quot;");
    expect(decisionsHtml).toContain("&lt;svg onload=alert(1)&gt;");
    expect(errorHtml).toContain(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
    expect(artifactsHtml).toContain("&lt;b&gt;pnpm test&lt;/b&gt;");
    expect(artifactsHtml).toContain("Test&quot; Onclick=&quot;Alert(1)");
    expect(artifactsHtml).toContain("&lt;Svg&gt;");
    expect(artifactsHtml).toContain("src/&lt;app&gt;.ts");
    expect(artifactsHtml).toContain("Assertion &quot;failure&quot;");
    expect(artifactsHtml).toContain("src/&lt;suite&gt;.test.ts");
    expect(artifactsHtml).toContain("renders &quot;home&quot;");
    expect(artifactsHtml).toContain("react-dom&quot; onclick=&quot;alert(1)");
    expect(artifactsHtml).toContain(
      "package.json&quot; onclick=&quot;alert(1)",
    );
    expect(searchResultsHtml).toContain("&lt;b&gt;Search&lt;/b&gt;");
    expect(searchResultsHtml).toContain(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
    expect(searchResultsHtml).toContain('data-action="detail"');
    expect(searchResultsHtml).toContain('data-action="set-host"');
    expect(trendHtml).toContain("&lt;strong&gt;pnpm test&lt;/strong&gt;");
    expect(trendHtml).toContain("Codex&quot; onmouseover=&quot;alert(1)");
    expect(trendHtml).toContain(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
    expect(trendHtml).toContain('data-action="set-issue-key"');
    expect(trendHtml).toContain('data-action="set-query"');
    expect(trendContextHtml).toContain(
      "&lt;strong&gt;pnpm test&lt;/strong&gt;",
    );
    expect(trendContextHtml).toContain("&lt;Svg&gt;");
    expect(trendContextHtml).toContain('data-action="detail"');
    expect(trendContextHtml).toContain('data-action="load-scope-handoff"');
    expect(trendContextHtml).toContain(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
    expect(trendContextHtml).toContain(
      "session-2&quot; onclick=&quot;alert(1)",
    );
    expect(trendContextHtml).toContain("test:pnpm-browser");
    expect(contextReportHtml).toContain("&lt;b&gt;Auth&lt;/b&gt;");
    expect(contextReportHtml).toContain(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
    expect(contextReportHtml).toContain("auth &lt;timeout&gt;");
    expect(contextCandidatesHtml).toContain("Shared &lt;Issue&gt;");
    expect(contextCandidatesHtml).toContain("Folder: /tmp/&lt;project&gt;");
    expect(contextCandidatesHtml).toContain(
      'data-action="confirm-context-candidate"',
    );
    expect(contextCandidatesHtml).toContain(
      'data-action="reject-context-candidate"',
    );
    expect(contextCandidatesHtml).toContain(
      'data-action="confirm-context-new"',
    );
    expect(contextCandidatesHtml).toContain("Keep Separate");
    expect(contextCandidatesHtml).toContain("Start New Topic");
    expect(contextCandidatesHtml).toContain(
      "session-1&quot; onclick=&quot;alert(1)",
    );
    expect(contextOverviewHtml).toContain("&lt;b&gt;Auth&lt;/b&gt;");
    expect(contextOverviewHtml).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(ansiSearchHtml).toContain("Recovered summary");
    expect(ansiSearchHtml).not.toContain("\u001b[?25h");

    const familyTrendHtml = buildHistoryTrendListHtml(
      [
        {
          groupBy: "family",
          issueKey: "test-family:pnpm",
          label: "<i>pnpm tests</i>",
          kind: "test",
          relatedIssueKeys: ["test:pnpm-test", "test:pnpm-test-browser"],
          blockerCategory: "test",
          blockerState: "active",
          remediationState: "regressed",
          remediationSummary:
            "Regressed after 1 successful attempt(s); latest failed.",
          latestOutcome: "failed",
          latestFailureAt: "2026-03-10T12:00:00.000Z",
          latestSuccessAt: "2026-03-10T11:55:00.000Z",
          lastSeenAt: "2026-03-10T12:00:00.000Z",
          attemptCount: 4,
          sessionCount: 2,
          failedAttempts: 3,
          succeededAttempts: 1,
          otherAttempts: 0,
          hosts: ["claude", "gemini"],
          sessions: [],
        },
      ],
      (value) => value,
    );
    expect(familyTrendHtml).toContain('data-action="focus-family"');
    expect(familyTrendHtml).toContain("test:pnpm-test, test:pnpm-test-browser");
  });

  it("allows reingest only after the session stops running", () => {
    expect(canReingestSession("running")).toBe(false);
    expect(canReingestSession("completed")).toBe(true);
    expect(canReingestSession("failed")).toBe(true);
    expect(canReingestSession("interrupted")).toBe(true);
  });

  it("turns machine-style context summaries into cleaner plain-language text", () => {
    const html = buildContextReportHtml(
      {
        context: {
          id: "context-1",
          label: "Footprint Project",
          workspaceKey: "/tmp/footprint",
          latestSessionId: "session-1",
          latestSessionLabel: "claude session @ footprint",
          latestStartedAt: "2026-03-10T12:00:00.000Z",
          latestEndedAt: null,
          sessionCount: 2,
          hosts: ["claude"],
          statuses: ["failed", "completed"],
          confidence: "high",
          confidenceScore: 9.5,
          signals: ["shared workspace"],
        },
        currentTruth: {
          summary:
            "Handoff for claude session @ footprint Session status: failed Latest failure: claude exited Blocking failures: claude exited Dependency changes: none detected Issue clusters: none detected Retry hotspots: none detected No active blockers are currently detected in this context.",
          latestSessionId: "session-1",
          latestSessionLabel: "claude session @ footprint",
          latestSummaryNarrative: null,
          latestHandoff: null,
          activeBlockers: [],
          openQuestions: [],
        },
        activeDecisions: [],
        supersededDecisions: [],
        sessions: [],
      },
      (value) => value,
    );

    expect(html).toContain("The latest related work ended with a problem.");
    expect(html).toContain("Most recent issue: Claude closed unexpectedly.");
    expect(html).toContain("Still blocking: Claude closed unexpectedly.");
    expect(html).toContain("Nothing is blocking this line of work right now.");
    expect(html).not.toContain("Recent package or setup changes:");
    expect(html).not.toContain("Repeated trouble seen here:");
  });
});
