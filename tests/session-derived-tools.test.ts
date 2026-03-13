import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { FootprintServer } from "../src/index.js";
import { EvidenceDatabase } from "../src/lib/storage/index.js";
import { FootprintTestHelpers } from "./test-helpers.js";
import type { ServerConfig } from "../src/types.js";

describe("Derived Session Tools", () => {
  let tempDir: string;
  let dbPath: string;
  let server: FootprintServer;
  let helpers: FootprintTestHelpers;
  let sessionId: string;
  let secondSessionId: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), "footprint-derived-tools-"));
    dbPath = path.join(tempDir, "footprint.db");

    const seedDb = new EvidenceDatabase(dbPath);
    sessionId = seedDb.createSession({
      host: "claude",
      projectRoot: tempDir,
      cwd: tempDir,
      title: "Derived history coverage",
      status: "completed",
      startedAt: "2026-03-09T12:00:00.000Z",
      endedAt: "2026-03-09T12:03:00.000Z",
      metadata: null,
    });

    const userMessageId = seedDb.appendMessage({
      sessionId,
      seq: 1,
      role: "user",
      source: "wrapper",
      content: "We decided to ship the Vitest migration and update src/app.ts",
      capturedAt: "2026-03-09T12:00:01.000Z",
      metadata: null,
    });
    seedDb.appendMessage({
      sessionId,
      seq: 2,
      role: "assistant",
      source: "wrapper",
      content: "Running pnpm test and updating src/app.ts",
      capturedAt: "2026-03-09T12:00:02.000Z",
      metadata: null,
    });
    seedDb.appendMessage({
      sessionId,
      seq: 3,
      role: "assistant",
      source: "wrapper",
      content: "Next: confirm whether README.md needs the same migration note?",
      capturedAt: "2026-03-09T12:00:03.000Z",
      metadata: null,
    });
    seedDb.appendTimelineEvent({
      sessionId,
      seq: 1,
      eventType: "message.user.submitted",
      eventSubType: null,
      source: "wrapper",
      summary: "Ship the Vitest migration",
      payload: null,
      startedAt: "2026-03-09T12:00:01.000Z",
      endedAt: "2026-03-09T12:00:01.000Z",
      status: "captured",
      relatedMessageId: userMessageId,
    });
    seedDb.appendTimelineEvent({
      sessionId,
      seq: 2,
      eventType: "command.started",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm test",
      payload: JSON.stringify({ command: "pnpm", args: ["test"] }),
      startedAt: "2026-03-09T12:00:02.000Z",
      endedAt: "2026-03-09T12:00:02.000Z",
      status: "running",
      relatedMessageId: null,
    });
    seedDb.appendTimelineEvent({
      sessionId,
      seq: 3,
      eventType: "command.completed",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm test",
      payload: JSON.stringify({
        command: "pnpm",
        args: ["test"],
        exitCode: 1,
        stdout:
          "FAIL src/app.test.ts > renders app\nAssertionError: expected true to be false",
      }),
      startedAt: "2026-03-09T12:00:02.000Z",
      endedAt: "2026-03-09T12:00:02.500Z",
      status: "failed",
      relatedMessageId: null,
    });
    seedDb.appendTimelineEvent({
      sessionId,
      seq: 4,
      eventType: "command.started",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm test",
      payload: JSON.stringify({ command: "pnpm", args: ["test"] }),
      startedAt: "2026-03-09T12:00:02.600Z",
      endedAt: "2026-03-09T12:00:02.600Z",
      status: "running",
      relatedMessageId: null,
    });
    seedDb.appendTimelineEvent({
      sessionId,
      seq: 5,
      eventType: "command.completed",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm test",
      payload: JSON.stringify({ command: "pnpm", args: ["test"], exitCode: 0 }),
      startedAt: "2026-03-09T12:00:02.600Z",
      endedAt: "2026-03-09T12:00:02.900Z",
      status: "completed",
      relatedMessageId: null,
    });
    seedDb.appendTimelineEvent({
      sessionId,
      seq: 6,
      eventType: "file.changed",
      eventSubType: null,
      source: "wrapper",
      summary: "src/app.ts changed",
      payload: JSON.stringify({ path: "src/app.ts", afterStatus: "M" }),
      startedAt: "2026-03-09T12:00:03.000Z",
      endedAt: "2026-03-09T12:00:03.000Z",
      status: "M",
      relatedMessageId: null,
    });
    seedDb.finalizeSession(sessionId, {
      status: "completed",
      endedAt: "2026-03-09T12:03:00.000Z",
      title: "Derived history coverage",
    });

    secondSessionId = seedDb.createSession({
      host: "gemini",
      projectRoot: tempDir,
      cwd: tempDir,
      title: "Retry the test suite",
      status: "failed",
      startedAt: "2026-03-09T13:00:00.000Z",
      endedAt: "2026-03-09T13:02:00.000Z",
      metadata: null,
    });
    seedDb.appendTimelineEvent({
      sessionId: secondSessionId,
      seq: 1,
      eventType: "command.started",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm test",
      payload: JSON.stringify({ command: "pnpm", args: ["test"] }),
      startedAt: "2026-03-09T13:00:10.000Z",
      endedAt: "2026-03-09T13:00:10.000Z",
      status: "running",
      relatedMessageId: null,
    });
    seedDb.appendTimelineEvent({
      sessionId: secondSessionId,
      seq: 2,
      eventType: "command.completed",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm test",
      payload: JSON.stringify({ command: "pnpm", args: ["test"], exitCode: 1 }),
      startedAt: "2026-03-09T13:00:10.000Z",
      endedAt: "2026-03-09T13:00:20.000Z",
      status: "failed",
      relatedMessageId: null,
    });
    seedDb.appendTimelineEvent({
      sessionId: secondSessionId,
      seq: 3,
      eventType: "command.started",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm lint",
      payload: JSON.stringify({ command: "pnpm", args: ["lint"] }),
      startedAt: "2026-03-09T13:00:30.000Z",
      endedAt: "2026-03-09T13:00:30.000Z",
      status: "running",
      relatedMessageId: null,
    });
    seedDb.appendTimelineEvent({
      sessionId: secondSessionId,
      seq: 4,
      eventType: "command.completed",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm lint",
      payload: JSON.stringify({
        command: "pnpm",
        args: ["lint"],
        exitCode: 1,
        stderr:
          "src/app.ts\n  2:5  error  'unused' is assigned a value but never used  @typescript-eslint/no-unused-vars",
      }),
      startedAt: "2026-03-09T13:00:30.000Z",
      endedAt: "2026-03-09T13:00:45.000Z",
      status: "failed",
      relatedMessageId: null,
    });
    seedDb.finalizeSession(secondSessionId, {
      status: "failed",
      endedAt: "2026-03-09T13:02:00.000Z",
      title: "Retry the test suite",
    });
    seedDb.close();

    server = new FootprintServer({
      dbPath,
      password: "derived-session-tools",
    } satisfies ServerConfig);
    helpers = new FootprintTestHelpers(server);
  });

  afterEach(() => {
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("registers the session-derived tools", async () => {
    const tools = await helpers.getTools();

    expect(tools).toContainEqual(
      expect.objectContaining({ name: "get-session-messages" }),
    );
    expect(tools).toContainEqual(
      expect.objectContaining({ name: "get-session-trends" }),
    );
    expect(tools).toContainEqual(
      expect.objectContaining({ name: "get-session-timeline" }),
    );
    expect(tools).toContainEqual(
      expect.objectContaining({ name: "get-session-artifacts" }),
    );
    expect(tools).toContainEqual(
      expect.objectContaining({ name: "get-session-narrative" }),
    );
    expect(tools).toContainEqual(
      expect.objectContaining({ name: "get-session-decisions" }),
    );
    expect(tools).toContainEqual(
      expect.objectContaining({ name: "export-sessions" }),
    );
    expect(tools).toContainEqual(
      expect.objectContaining({ name: "search-history" }),
    );
    expect(tools).toContainEqual(
      expect.objectContaining({ name: "get-history-trends" }),
    );
    expect(tools).toContainEqual(
      expect.objectContaining({ name: "get-history-handoff" }),
    );
    expect(tools).toContainEqual(
      expect.objectContaining({ name: "reingest-session" }),
    );
  });

  it("reingests a session and exposes derived narratives, decisions, messages, and timeline", async () => {
    const reingestResult = await helpers.callTool("reingest-session", {
      id: sessionId,
    });
    expect(reingestResult.structuredContent.narrativesCreated).toBe(3);

    const sessionResult = await helpers.callTool("get-session", {
      id: sessionId,
    });
    expect(sessionResult.structuredContent.hasNarratives).toBe(true);

    const narrativesResult = await helpers.callTool("get-session-narrative", {
      id: sessionId,
      limit: 2,
    });
    expect(narrativesResult.structuredContent.sessionId).toBe(sessionId);
    expect(narrativesResult.structuredContent.page).toEqual(
      expect.objectContaining({
        total: 3,
        offset: 0,
        limit: 2,
        returned: 2,
        hasMore: true,
        nextOffset: 2,
      }),
    );
    const firstNarrativePage = narrativesResult.structuredContent
      .narratives as Array<{
      kind: string;
      content: string;
    }>;
    expect(firstNarrativePage.map((narrative) => narrative.kind)).toEqual([
      "journal",
      "project-summary",
    ]);
    const secondNarrativePageResult = await helpers.callTool(
      "get-session-narrative",
      {
        id: sessionId,
        limit: 2,
        offset: 2,
      },
    );
    expect(secondNarrativePageResult.structuredContent.page).toEqual(
      expect.objectContaining({
        total: 3,
        offset: 2,
        limit: 2,
        returned: 1,
        hasMore: false,
        nextOffset: null,
      }),
    );
    const handoffNarrative = (
      secondNarrativePageResult.structuredContent.narratives as Array<{
        kind: string;
        content: string;
      }>
    )[0];
    expect(handoffNarrative?.kind).toBe("handoff");
    expect(handoffNarrative?.content).toContain(
      "Retry hotspots: pnpm test x2 (latest succeeded)",
    );
    expect(handoffNarrative?.content).toContain(
      "Issue clusters: test: pnpm test / src/app.test.ts > renders app [Assertion failure] (recovered after 1 failed attempt(s); latest succeeded)",
    );
    expect(handoffNarrative?.content).toContain(
      "Recovered clusters: test: pnpm test / src/app.test.ts > renders app [Assertion failure] (recovered after 1 failed attempt(s); latest succeeded)",
    );
    expect(handoffNarrative?.content).toContain(
      "Open items: Next: confirm whether README.md needs the same migration note?",
    );

    const decisionsResult = await helpers.callTool("get-session-decisions", {
      id: sessionId,
      limit: 1,
    });
    expect(decisionsResult.structuredContent.sessionId).toBe(sessionId);
    expect(decisionsResult.structuredContent.page).toEqual(
      expect.objectContaining({
        total: 1,
        offset: 0,
        limit: 1,
        returned: 1,
        hasMore: false,
        nextOffset: null,
      }),
    );
    expect(
      (
        decisionsResult.structuredContent.decisions as Array<{ status: string }>
      ).map((decision) => decision.status),
    ).toContain("accepted");

    const messagesResult = await helpers.callTool("get-session-messages", {
      id: sessionId,
    });
    expect(messagesResult.structuredContent.messages).toHaveLength(3);

    const timelineResult = await helpers.callTool("get-session-timeline", {
      id: sessionId,
    });
    expect(timelineResult.structuredContent.timeline).toHaveLength(6);

    const artifactsResult = await helpers.callTool("get-session-artifacts", {
      id: sessionId,
      artifactType: "command-output",
      limit: 1,
    });
    expect(
      artifactsResult.structuredContent.artifactSummary.total,
    ).toBeGreaterThan(0);
    expect(artifactsResult.structuredContent.sessionId).toBe(sessionId);
    expect(artifactsResult.structuredContent.page).toEqual(
      expect.objectContaining({
        total: expect.any(Number),
        offset: 0,
        limit: 1,
        returned: 1,
      }),
    );
    const commandArtifactsFullResult = await helpers.callTool(
      "get-session-artifacts",
      {
        id: sessionId,
        artifactType: "command-output",
      },
    );
    const commandArtifact = (
      commandArtifactsFullResult.structuredContent.artifacts as Array<{
        category: string | null;
        intent: string | null;
        command: string | null;
        outcome: string | null;
        issueKey: string | null;
        issueLabel: string | null;
        issueFamilyKey: string | null;
        issueFamilyLabel: string | null;
        failureSignatureLabel: string | null;
        testSuite: string | null;
        testCase: string | null;
      }>
    ).find(
      (artifact) =>
        artifact.command === "pnpm" &&
        artifact.category === "test" &&
        artifact.outcome === "failed",
    );
    expect(commandArtifactsFullResult.structuredContent.page).toEqual(
      expect.objectContaining({
        total: expect.any(Number),
        offset: 0,
        returned: expect.any(Number),
      }),
    );
    expect(commandArtifact).toEqual(
      expect.objectContaining({
        category: "test",
        intent: "test",
        command: "pnpm",
        issueFamilyKey: "test-family:pnpm",
        issueFamilyLabel: "pnpm tests",
        failureSignatureLabel: "Assertion failure",
        testSuite: "src/app.test.ts",
        testCase: "renders app",
      }),
    );

    const searchResult = await helpers.callTool("search-history", {
      query: "command-output",
    });
    expect(searchResult.structuredContent.query).toBe("command-output");
    expect(searchResult.structuredContent.filters).toEqual({
      host: undefined,
      status: undefined,
    });
    expect(searchResult.structuredContent.total).toBe(1);
  });

  it("returns paginated transcript and timeline slices for session detail inspection", async () => {
    const detailResult = await helpers.callTool("get-session", {
      id: sessionId,
      messageLimit: 2,
      timelineLimit: 4,
    });

    expect(detailResult.structuredContent.messages).toHaveLength(2);
    expect(detailResult.structuredContent.timeline).toHaveLength(4);
    expect(detailResult.structuredContent.messagePage).toEqual(
      expect.objectContaining({
        total: 3,
        offset: 0,
        limit: 2,
        returned: 2,
        hasMore: true,
        nextOffset: 2,
      }),
    );
    expect(detailResult.structuredContent.timelinePage).toEqual(
      expect.objectContaining({
        total: 6,
        offset: 0,
        limit: 4,
        returned: 4,
        hasMore: true,
        nextOffset: 4,
      }),
    );

    const messagesResult = await helpers.callTool("get-session-messages", {
      id: sessionId,
      limit: 2,
      offset: 2,
    });
    expect(messagesResult.structuredContent.messages).toHaveLength(1);
    expect(messagesResult.structuredContent.page).toEqual(
      expect.objectContaining({
        total: 3,
        offset: 2,
        limit: 2,
        returned: 1,
        hasMore: false,
        nextOffset: null,
      }),
    );

    const timelineResult = await helpers.callTool("get-session-timeline", {
      id: sessionId,
      limit: 4,
      offset: 4,
    });
    expect(timelineResult.structuredContent.timeline).toHaveLength(2);
    expect(timelineResult.structuredContent.page).toEqual(
      expect.objectContaining({
        total: 6,
        offset: 4,
        limit: 4,
        returned: 2,
        hasMore: false,
        nextOffset: null,
      }),
    );
  });

  it("hydrates search snippets only for the paginated result slice", async () => {
    await helpers.callTool("reingest-session", {
      id: sessionId,
    });
    await helpers.callTool("reingest-session", {
      id: secondSessionId,
    });

    const serverDb = (server as unknown as { db: EvidenceDatabase }).db;
    const detailSpy = vi.spyOn(serverDb, "getSessionDetail");

    try {
      const result = await helpers.callTool("search-history", {
        query: "pnpm",
        limit: 1,
        offset: 0,
      });

      expect(result.structuredContent.total).toBe(2);
      expect((result.structuredContent.results as Array<unknown>).length).toBe(
        1,
      );
      expect(detailSpy).toHaveBeenCalledTimes(1);
    } finally {
      detailSpy.mockRestore();
    }
  });

  it("aggregates recurring issue trends across sessions", async () => {
    await helpers.callTool("reingest-session", {
      id: sessionId,
    });
    await helpers.callTool("reingest-session", {
      id: secondSessionId,
    });

    const result = await helpers.callTool("get-history-trends", {});
    const summary = result.structuredContent.summary as {
      totalTrends: number;
      matchingSessions: number;
      totalAttempts: number;
      byOutcome: { failed: number; succeeded: number; other: number };
    };
    const trends = result.structuredContent.trends as Array<{
      issueKey: string;
      label: string;
      kind: string | null;
      sessionCount: number;
      attemptCount: number;
      latestOutcome: string;
      hosts: string[];
      sessions: Array<{
        sessionId: string;
        attempts: number;
        latestOutcome: string;
      }>;
    }>;

    expect(summary).toEqual(
      expect.objectContaining({
        groupBy: "issue",
        totalTrends: 2,
        matchingSessions: 2,
        totalAttempts: 4,
        activeBlockers: 2,
        recoveredTrends: 0,
        regressedTrends: 1,
        byOutcome: {
          failed: 3,
          succeeded: 1,
          other: 0,
        },
      }),
    );
    expect(trends[0]).toEqual(
      expect.objectContaining({
        issueKey: "test:pnpm-test",
        label: "pnpm test",
        kind: "test",
        sessionCount: 2,
        attemptCount: 3,
        latestOutcome: "failed",
        blockerState: "active",
        remediationState: "regressed",
        hosts: ["claude", "gemini"],
      }),
    );
    expect(trends[0]?.sessions).toEqual([
      expect.objectContaining({
        sessionId: secondSessionId,
        attempts: 1,
        latestOutcome: "failed",
      }),
      expect.objectContaining({
        sessionId,
        attempts: 2,
        latestOutcome: "succeeded",
      }),
    ]);
    expect(trends[1]).toEqual(
      expect.objectContaining({
        issueKey: "lint:pnpm-lint",
        label: "pnpm lint",
        kind: "lint",
        sessionCount: 1,
        attemptCount: 1,
        blockerState: "active",
        remediationState: "unresolved",
      }),
    );

    const filteredResult = await helpers.callTool("get-history-trends", {
      issueKey: "test:pnpm-test",
      host: "gemini",
    });
    expect(filteredResult.structuredContent.filters).toEqual({
      query: undefined,
      issueKey: "test:pnpm-test",
      host: "gemini",
      status: undefined,
    });
    expect(filteredResult.structuredContent.total).toBe(1);
    expect(filteredResult.structuredContent.trends).toEqual([
      expect.objectContaining({
        groupBy: "issue",
        issueKey: "test:pnpm-test",
        sessionCount: 1,
        attemptCount: 1,
        hosts: ["gemini"],
      }),
    ]);
  });

  it("aggregates broader failure families when requested", async () => {
    await helpers.callTool("reingest-session", {
      id: sessionId,
    });
    await helpers.callTool("reingest-session", {
      id: secondSessionId,
    });

    const result = await helpers.callTool("get-history-trends", {
      groupBy: "family",
      query: "tests",
    });
    const summary = result.structuredContent.summary as {
      groupBy: string;
      totalTrends: number;
      matchingSessions: number;
      totalAttempts: number;
    };
    const trends = result.structuredContent.trends as Array<{
      groupBy: string;
      issueKey: string;
      label: string;
      relatedIssueKeys: string[];
      sessionCount: number;
      attemptCount: number;
    }>;

    expect(summary).toEqual(
      expect.objectContaining({
        groupBy: "family",
        totalTrends: 1,
        matchingSessions: 2,
        totalAttempts: 3,
        activeBlockers: 1,
        recoveredTrends: 0,
        regressedTrends: 1,
      }),
    );
    expect(trends).toEqual([
      expect.objectContaining({
        groupBy: "family",
        issueKey: "test-family:pnpm",
        label: "pnpm tests",
        relatedIssueKeys: ["test:pnpm-test"],
        sessionCount: 2,
        attemptCount: 3,
        blockerCategory: "test",
        blockerState: "active",
        remediationState: "regressed",
      }),
    ]);
  });

  it("builds history trends without hydrating per-session detail or artifact trees", async () => {
    await helpers.callTool("reingest-session", {
      id: sessionId,
    });
    await helpers.callTool("reingest-session", {
      id: secondSessionId,
    });

    const serverDb = (server as unknown as { db: EvidenceDatabase }).db;
    const detailSpy = vi.spyOn(serverDb, "getSessionDetail");
    const artifactSpy = vi.spyOn(serverDb, "getSessionArtifacts");

    try {
      const result = await helpers.callTool("get-history-trends", {});

      expect(result.structuredContent.total).toBe(2);
      expect(detailSpy).not.toHaveBeenCalled();
      expect(artifactSpy).not.toHaveBeenCalled();
    } finally {
      detailSpy.mockRestore();
      artifactSpy.mockRestore();
    }
  });

  it("builds a handoff-oriented history scope summary", async () => {
    await helpers.callTool("reingest-session", {
      id: sessionId,
    });
    await helpers.callTool("reingest-session", {
      id: secondSessionId,
    });

    const result = await helpers.callTool("get-history-handoff", {
      issueKey: "test:pnpm-test",
    });

    expect(result.structuredContent.filters).toEqual({
      query: undefined,
      issueKey: "test:pnpm-test",
      host: undefined,
      status: undefined,
    });
    expect(result.structuredContent.summary).toEqual(
      expect.objectContaining({
        matchingSessions: 2,
        totalTrends: 1,
        blockingTrends: 1,
        recoveredTrends: 0,
        regressedTrends: 1,
        unresolvedQuestions: 1,
        latestSessionId: secondSessionId,
      }),
    );
    expect(result.structuredContent.blockers).toEqual([
      expect.stringContaining("test:pnpm-test: pnpm test [test] (regressed"),
    ]);
    expect(result.structuredContent.recoveries).toEqual([]);
    expect(result.structuredContent.followUps).toEqual([
      "Next: confirm whether README.md needs the same migration note?",
    ]);
    expect(result.structuredContent.recentSessions).toEqual([
      expect.objectContaining({
        id: secondSessionId,
        host: "gemini",
      }),
      expect.objectContaining({
        id: sessionId,
        host: "claude",
      }),
    ]);
    expect(result.structuredContent.markdown).toContain("# History Handoff");
    expect(result.structuredContent.markdown).toContain("## Blocking Trends");
  });

  it("builds family-grouped history handoffs when requested", async () => {
    await helpers.callTool("reingest-session", {
      id: sessionId,
    });
    await helpers.callTool("reingest-session", {
      id: secondSessionId,
    });

    const result = await helpers.callTool("get-history-handoff", {
      query: "tests",
      groupBy: "family",
    });

    expect(result.structuredContent.filters).toEqual({
      query: "tests",
      issueKey: undefined,
      host: undefined,
      status: undefined,
      groupBy: "family",
    });
    expect(result.structuredContent.summary).toEqual(
      expect.objectContaining({
        groupBy: "family",
        matchingSessions: 2,
        totalTrends: 1,
        blockingTrends: 1,
        regressedTrends: 1,
      }),
    );
    expect(result.structuredContent.blockers).toEqual([
      expect.stringContaining("test-family:pnpm: pnpm tests [test] (regressed"),
    ]);
    expect(result.structuredContent.markdown).toContain(
      "- Trend Grouping: family",
    );
  });

  it("reports full blocker and recovery totals even when handoff previews are capped", async () => {
    const serverDb = (server as unknown as { db: EvidenceDatabase }).db;
    const scopedSessionIds: string[] = [];

    const createScopedSession = (options: {
      title: string;
      seqPrefix: number;
      summary: string;
      args: string[];
      events: Array<{
        exitCode: number;
        status: string;
        offsetSeconds: number;
      }>;
    }): string => {
      const scopedSessionId = serverDb.createSession({
        host: "codex",
        projectRoot: tempDir,
        cwd: tempDir,
        title: options.title,
        status:
          options.events.at(-1)?.status === "completed"
            ? "completed"
            : "failed",
        startedAt: `2026-03-10T10:${String(options.seqPrefix).padStart(2, "0")}:00.000Z`,
        endedAt: `2026-03-10T10:${String(options.seqPrefix).padStart(2, "0")}:59.000Z`,
        metadata: null,
      });

      options.events.forEach((event, index) => {
        serverDb.appendTimelineEvent({
          sessionId: scopedSessionId,
          seq: index + 1,
          eventType: "command.completed",
          eventSubType: "pnpm",
          source: "wrapper",
          summary: options.summary,
          payload: JSON.stringify({
            command: "pnpm",
            args: options.args,
            exitCode: event.exitCode,
          }),
          startedAt: `2026-03-10T10:${String(options.seqPrefix).padStart(2, "0")}:${String(event.offsetSeconds).padStart(2, "0")}.000Z`,
          endedAt: `2026-03-10T10:${String(options.seqPrefix).padStart(2, "0")}:${String(event.offsetSeconds + 1).padStart(2, "0")}.000Z`,
          status: event.status,
          relatedMessageId: null,
        });
      });

      serverDb.finalizeSession(scopedSessionId, {
        status:
          options.events.at(-1)?.status === "completed"
            ? "completed"
            : "failed",
        endedAt: `2026-03-10T10:${String(options.seqPrefix).padStart(2, "0")}:59.000Z`,
        title: options.title,
      });
      return scopedSessionId;
    };

    for (let index = 0; index < 6; index += 1) {
      scopedSessionIds.push(
        createScopedSession({
          title: `Codex blocker ${index + 1}`,
          seqPrefix: 20 + index,
          summary: `pnpm lint:blocker-${index + 1}`,
          args: [`lint:blocker-${index + 1}`],
          events: [{ exitCode: 1, status: "failed", offsetSeconds: 10 }],
        }),
      );
    }

    for (let index = 0; index < 6; index += 1) {
      scopedSessionIds.push(
        createScopedSession({
          title: `Codex recovery ${index + 1}`,
          seqPrefix: 40 + index,
          summary: `pnpm test:recover-${index + 1}`,
          args: [`test:recover-${index + 1}`],
          events: [
            { exitCode: 1, status: "failed", offsetSeconds: 10 },
            { exitCode: 0, status: "completed", offsetSeconds: 20 },
          ],
        }),
      );
    }

    for (const scopedSessionId of scopedSessionIds) {
      await helpers.callTool("reingest-session", { id: scopedSessionId });
    }

    const result = await helpers.callTool("get-history-handoff", {
      host: "codex",
    });

    expect(result.structuredContent.summary).toEqual(
      expect.objectContaining({
        matchingSessions: 12,
        blockingTrends: 6,
        recoveredTrends: 6,
      }),
    );
    expect(result.structuredContent.blockers).toHaveLength(5);
    expect(result.structuredContent.recoveries).toHaveLength(5);
    expect(result.structuredContent.summary.headline).toContain(
      "6 blocking trend(s) remain active",
    );
    expect(result.structuredContent.summary.headline).toContain(
      "6 trend(s) recently recovered.",
    );
  });

  it("builds history handoffs without hydrating per-session detail or message trees", async () => {
    await helpers.callTool("reingest-session", {
      id: sessionId,
    });
    await helpers.callTool("reingest-session", {
      id: secondSessionId,
    });

    const serverDb = (server as unknown as { db: EvidenceDatabase }).db;
    const detailSpy = vi.spyOn(serverDb, "getSessionDetail");
    const messageSpy = vi.spyOn(serverDb, "getSessionMessages");

    try {
      const result = await helpers.callTool("get-history-handoff", {
        issueKey: "test:pnpm-test",
      });

      expect(result.structuredContent.summary).toEqual(
        expect.objectContaining({
          matchingSessions: 2,
          totalTrends: 1,
        }),
      );
      expect(detailSpy).not.toHaveBeenCalled();
      expect(messageSpy).not.toHaveBeenCalled();
    } finally {
      detailSpy.mockRestore();
      messageSpy.mockRestore();
    }
  });

  it("includes recurring trend context in get-session output", async () => {
    await helpers.callTool("reingest-session", {
      id: sessionId,
    });
    await helpers.callTool("reingest-session", {
      id: secondSessionId,
    });

    const result = await helpers.callTool("get-session", { id: sessionId });
    expect(result.structuredContent.trendContext.summary).toEqual({
      totalTrends: 1,
      crossSessionTrends: 1,
      sessionAttempts: 2,
      globalAttempts: 3,
      otherSessions: 1,
      activeBlockers: 1,
      recoveredTrends: 0,
      regressedTrends: 1,
    });
    expect(result.structuredContent.trendContext.page).toEqual(
      expect.objectContaining({
        total: 1,
        offset: 0,
        limit: 50,
        returned: 1,
        hasMore: false,
        nextOffset: null,
      }),
    );
    expect(result.structuredContent.trendContext.trends).toEqual([
      expect.objectContaining({
        issueKey: "test:pnpm-test",
        issueFamilyKey: "test-family:pnpm",
        issueFamilyLabel: "pnpm tests",
        relatedIssueKeys: ["test:pnpm-test"],
        blockerCategory: "test",
        blockerState: "active",
        remediationState: "regressed",
        remediationSummary:
          "Regressed after 1 successful attempt(s); latest failed.",
        sessionAttempts: 2,
        globalAttempts: 3,
        sessionCount: 2,
        sessionLatestOutcome: "succeeded",
        latestOutcome: "failed",
        hosts: ["claude", "gemini"],
        relatedSessionCount: 1,
        relatedSessions: [
          expect.objectContaining({
            sessionId: secondSessionId,
            host: "gemini",
            status: "failed",
            attempts: 1,
            latestOutcome: "failed",
          }),
        ],
      }),
    ]);

    const trendsResult = await helpers.callTool("get-session-trends", {
      id: sessionId,
      limit: 1,
    });
    expect(trendsResult.structuredContent.sessionId).toBe(sessionId);
    expect(trendsResult.structuredContent.summary).toEqual(
      expect.objectContaining({
        totalTrends: 1,
        crossSessionTrends: 1,
        activeBlockers: 1,
        regressedTrends: 1,
      }),
    );
    expect(trendsResult.structuredContent.page).toEqual(
      expect.objectContaining({
        total: 1,
        offset: 0,
        limit: 1,
        returned: 1,
        hasMore: false,
        nextOffset: null,
      }),
    );
    expect(trendsResult.structuredContent.trends).toEqual([
      expect.objectContaining({
        issueKey: "test:pnpm-test",
        relatedSessionCount: 1,
        remediationState: "regressed",
      }),
    ]);
  });

  it("builds session trend context without scanning the full trend attempt history", async () => {
    await helpers.callTool("reingest-session", {
      id: sessionId,
    });
    await helpers.callTool("reingest-session", {
      id: secondSessionId,
    });

    const serverDb = (server as unknown as { db: EvidenceDatabase }).db;
    const allAttemptsSpy = vi.spyOn(serverDb, "querySessionTrendAttempts");
    const contextSpy = vi.spyOn(serverDb, "querySessionTrendContextAttempts");

    try {
      const result = await helpers.callTool("get-session-trends", {
        id: sessionId,
        limit: 1,
      });

      expect(result.structuredContent.sessionId).toBe(sessionId);
      expect(contextSpy).toHaveBeenCalledWith(sessionId);
      expect(allAttemptsSpy).not.toHaveBeenCalled();
    } finally {
      contextSpy.mockRestore();
      allAttemptsSpy.mockRestore();
    }
  });
});
