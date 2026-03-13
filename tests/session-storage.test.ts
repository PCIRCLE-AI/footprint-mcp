import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { EvidenceDatabase } from "../src/lib/storage/index.js";

describe("Session Storage", () => {
  let tempDir: string;
  let dbPath: string;
  let db: EvidenceDatabase;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), "footprint-session-db-"));
    dbPath = path.join(tempDir, "footprint.db");
    db = new EvidenceDatabase(dbPath);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("stores ordered messages and timeline events under the same session", () => {
    const sessionId = db.createSession({
      host: "claude",
      projectRoot: "/tmp/project",
      cwd: "/tmp/project",
      title: null,
      status: "running",
      startedAt: "2026-03-09T10:00:00.000Z",
      endedAt: null,
      metadata: JSON.stringify({ command: "claude", args: ["--print"] }),
    });

    const userMessageId = db.appendMessage({
      sessionId,
      seq: 1,
      role: "user",
      source: "wrapper",
      content: "Implement Slice A",
      capturedAt: "2026-03-09T10:00:01.000Z",
      metadata: null,
    });
    db.appendMessage({
      sessionId,
      seq: 2,
      role: "assistant",
      source: "wrapper",
      content: "Working on it",
      capturedAt: "2026-03-09T10:00:02.000Z",
      metadata: null,
    });

    db.appendTimelineEvent({
      sessionId,
      seq: 1,
      eventType: "session.start",
      eventSubType: null,
      source: "wrapper",
      summary: "Started claude session",
      payload: null,
      startedAt: "2026-03-09T10:00:00.000Z",
      endedAt: "2026-03-09T10:00:00.000Z",
      status: "running",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId,
      seq: 2,
      eventType: "message.user.submitted",
      eventSubType: null,
      source: "wrapper",
      summary: "Implement Slice A",
      payload: null,
      startedAt: "2026-03-09T10:00:01.000Z",
      endedAt: "2026-03-09T10:00:01.000Z",
      status: "captured",
      relatedMessageId: userMessageId,
    });
    db.appendTimelineEvent({
      sessionId,
      seq: 3,
      eventType: "session.end",
      eventSubType: null,
      source: "wrapper",
      summary: "Finished",
      payload: JSON.stringify({ exitCode: 0 }),
      startedAt: "2026-03-09T10:00:03.000Z",
      endedAt: "2026-03-09T10:00:03.000Z",
      status: "completed",
      relatedMessageId: null,
    });

    db.finalizeSession(sessionId, {
      status: "completed",
      endedAt: "2026-03-09T10:00:03.000Z",
      title: "Implement Slice A",
    });

    const detail = db.getSessionDetail(sessionId);
    expect(detail).not.toBeNull();
    expect(detail?.session.host).toBe("claude");
    expect(detail?.session.status).toBe("completed");
    expect(detail?.messages.map((message) => message.seq)).toEqual([1, 2]);
    expect(detail?.messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
    ]);
    expect(detail?.timeline.map((event) => event.seq)).toEqual([1, 2, 3]);
    expect(detail?.timeline[1]?.relatedMessageId).toBe(userMessageId);
    expect(detail?.hasNarratives).toBe(false);
  });

  it("keeps sessions in reverse chronological order and rejects duplicate sequence numbers", () => {
    const olderSession = db.createSession({
      host: "claude",
      projectRoot: "/tmp/project",
      cwd: "/tmp/project",
      title: "Older",
      status: "completed",
      startedAt: "2026-03-08T09:00:00.000Z",
      endedAt: "2026-03-08T09:05:00.000Z",
      metadata: null,
    });
    const newerSession = db.createSession({
      host: "claude",
      projectRoot: "/tmp/project",
      cwd: "/tmp/project",
      title: "Newer",
      status: "failed",
      startedAt: "2026-03-09T09:00:00.000Z",
      endedAt: "2026-03-09T09:01:00.000Z",
      metadata: null,
    });

    db.appendMessage({
      sessionId: newerSession,
      seq: 1,
      role: "user",
      source: "wrapper",
      content: "hello",
      capturedAt: "2026-03-09T09:00:01.000Z",
      metadata: null,
    });

    expect(() =>
      db.appendMessage({
        sessionId: newerSession,
        seq: 1,
        role: "assistant",
        source: "wrapper",
        content: "duplicate",
        capturedAt: "2026-03-09T09:00:02.000Z",
        metadata: null,
      }),
    ).toThrow("Failed to append message");

    db.appendTimelineEvent({
      sessionId: olderSession,
      seq: 1,
      eventType: "session.start",
      eventSubType: null,
      source: "wrapper",
      summary: null,
      payload: null,
      startedAt: "2026-03-08T09:00:00.000Z",
      endedAt: "2026-03-08T09:00:00.000Z",
      status: "completed",
      relatedMessageId: null,
    });

    expect(() =>
      db.appendTimelineEvent({
        sessionId: olderSession,
        seq: 1,
        eventType: "session.end",
        eventSubType: null,
        source: "wrapper",
        summary: null,
        payload: null,
        startedAt: "2026-03-08T09:05:00.000Z",
        endedAt: "2026-03-08T09:05:00.000Z",
        status: "completed",
        relatedMessageId: null,
      }),
    ).toThrow("Failed to append timeline event");

    expect(db.listSessions().map((session) => session.id)).toEqual([
      newerSession,
      olderSession,
    ]);
    expect(db.getSessionCount()).toBe(2);
  });

  it("summarizes artifacts in SQL and paginates them with a stable tie-breaker", () => {
    const sessionId = db.createSession({
      host: "claude",
      projectRoot: "/tmp/project",
      cwd: "/tmp/project",
      title: "Artifacts",
      status: "completed",
      startedAt: "2026-03-09T09:00:00.000Z",
      endedAt: "2026-03-09T09:05:00.000Z",
      metadata: null,
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T09:06:00.000Z"));
    const uuidSpy = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("c-id")
      .mockReturnValueOnce("a-id")
      .mockReturnValueOnce("b-id");

    try {
      db.replaceArtifactsForSession(sessionId, [
        {
          sessionId,
          eventId: null,
          artifactType: "git-commit",
          path: null,
          metadata: JSON.stringify({ summary: "commit" }),
        },
        {
          sessionId,
          eventId: null,
          artifactType: "command-output",
          path: null,
          metadata: JSON.stringify({ summary: "lint" }),
        },
        {
          sessionId,
          eventId: null,
          artifactType: "file-change",
          path: "src/server.ts",
          metadata: JSON.stringify({ summary: "server.ts" }),
        },
      ]);
    } finally {
      uuidSpy.mockRestore();
      vi.useRealTimers();
    }

    expect(db.getSessionArtifactSummary(sessionId)).toEqual({
      total: 3,
      byType: {
        fileChange: 1,
        commandOutput: 1,
        testResult: 0,
        gitCommit: 1,
      },
    });
    expect(
      db
        .getSessionArtifacts(sessionId, { limit: 2, offset: 0 })
        .map((artifact) => artifact.id),
    ).toEqual(["a-id", "b-id"]);
    expect(
      db
        .getSessionArtifacts(sessionId, { limit: 2, offset: 2 })
        .map((artifact) => artifact.id),
    ).toEqual(["c-id"]);
  });

  it("stores canonical contexts, rejections, preferences, and merges", () => {
    const firstSession = db.createSession({
      host: "claude",
      projectRoot: "/tmp/project",
      cwd: "/tmp/project",
      title: "Auth timeout",
      status: "completed",
      startedAt: "2026-03-10T09:00:00.000Z",
      endedAt: "2026-03-10T09:03:00.000Z",
      metadata: null,
    });
    const secondSession = db.createSession({
      host: "codex",
      projectRoot: "/tmp/project",
      cwd: "/tmp/project",
      title: "Dashboard filters",
      status: "completed",
      startedAt: "2026-03-10T10:00:00.000Z",
      endedAt: "2026-03-10T10:05:00.000Z",
      metadata: null,
    });

    const firstContext = db.createContext({
      label: "Auth context",
      workspaceKey: "/tmp/project",
      metadata: null,
    });
    const secondContext = db.createContext({
      label: "UI context",
      workspaceKey: "/tmp/project",
      metadata: null,
    });

    db.assignSessionToContext({
      sessionId: firstSession,
      contextId: firstContext.id,
      linkSource: "confirmed",
    });
    db.rejectContextForSession(secondSession, firstContext.id);
    db.setWorkspacePreferredContext("/tmp/project", firstContext.id);

    expect(db.findContextLinkForSession(firstSession)).toEqual(
      expect.objectContaining({
        sessionId: firstSession,
        contextId: firstContext.id,
      }),
    );
    expect(db.listContextRejectionsForSession(secondSession)).toEqual([
      expect.objectContaining({
        sessionId: secondSession,
        contextId: firstContext.id,
      }),
    ]);
    expect(db.getWorkspacePreferredContext("/tmp/project")).toEqual(
      expect.objectContaining({
        contextId: firstContext.id,
      }),
    );

    db.setWorkspacePreferredContext("/tmp/project", secondContext.id);
    expect(db.getWorkspacePreferredContext("/tmp/project")).toEqual(
      expect.objectContaining({
        contextId: secondContext.id,
      }),
    );

    db.assignSessionToContext({
      sessionId: secondSession,
      contextId: secondContext.id,
      linkSource: "confirmed",
    });
    db.mergeContexts(secondContext.id, firstContext.id);

    expect(db.resolveContextById(secondContext.id)).toEqual(
      expect.objectContaining({
        id: firstContext.id,
      }),
    );
    expect(
      db.listSessionsForContext(firstContext.id).map((session) => session.id),
    ).toEqual([firstSession, secondSession]);
    expect(db.getWorkspacePreferredContext("/tmp/project")).toEqual(
      expect.objectContaining({
        contextId: firstContext.id,
      }),
    );
  });

  it("paginates narratives and decisions with stable ordering", () => {
    const sessionId = db.createSession({
      host: "claude",
      projectRoot: "/tmp/project",
      cwd: "/tmp/project",
      title: "Derived",
      status: "completed",
      startedAt: "2026-03-09T09:00:00.000Z",
      endedAt: "2026-03-09T09:05:00.000Z",
      metadata: null,
    });

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-09T09:06:00.000Z"));
    const uuidSpy = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("decision-b")
      .mockReturnValueOnce("decision-a")
      .mockReturnValueOnce("narrative-b")
      .mockReturnValueOnce("narrative-a")
      .mockReturnValueOnce("narrative-c");

    try {
      db.replaceDecisionsForSession(sessionId, [
        {
          sessionId,
          title: "Second decision",
          summary: "Later by id",
          rationale: null,
          status: "open",
          sourceRefs: "[]",
        },
        {
          sessionId,
          title: "First decision",
          summary: "Earlier by id",
          rationale: null,
          status: "accepted",
          sourceRefs: "[]",
        },
      ]);
      db.replaceNarrativesForSession(sessionId, [
        {
          sessionId,
          kind: "project-summary",
          content: "Project summary",
          sourceRefs: "[]",
        },
        {
          sessionId,
          kind: "journal",
          content: "Journal entry",
          sourceRefs: "[]",
        },
        {
          sessionId,
          kind: "handoff",
          content: "Handoff entry",
          sourceRefs: "[]",
        },
      ]);
    } finally {
      uuidSpy.mockRestore();
      vi.useRealTimers();
    }

    expect(db.countSessionDecisions(sessionId)).toBe(2);
    expect(
      db
        .getSessionDecisions(sessionId, { limit: 1, offset: 0 })
        .map((decision) => decision.id),
    ).toEqual(["decision-a"]);
    expect(
      db
        .getSessionDecisions(sessionId, { limit: 1, offset: 1 })
        .map((decision) => decision.id),
    ).toEqual(["decision-b"]);

    expect(db.countSessionNarratives(sessionId)).toBe(3);
    expect(
      db
        .getSessionNarratives(sessionId, { limit: 3, offset: 0 })
        .map((narrative) => narrative.kind),
    ).toEqual(["journal", "project-summary", "handoff"]);
    expect(
      db
        .getSessionNarratives(sessionId, { limit: 1, offset: 1 })
        .map((narrative) => narrative.kind),
    ).toEqual(["project-summary"]);
  });

  it("queries session history from the cached search surface", () => {
    const firstSessionId = db.createSession({
      host: "claude",
      projectRoot: "/tmp/project",
      cwd: "/tmp/project",
      title: "Browser hardening",
      status: "completed",
      startedAt: "2026-03-09T11:00:00.000Z",
      endedAt: "2026-03-09T11:05:00.000Z",
      metadata: JSON.stringify({ branch: "browser-hardening" }),
    });
    db.appendMessage({
      sessionId: firstSessionId,
      seq: 1,
      role: "user",
      source: "wrapper",
      content: "Ship the browser hardening patch",
      capturedAt: "2026-03-09T11:00:01.000Z",
      metadata: null,
    });
    db.replaceArtifactsForSession(firstSessionId, [
      {
        sessionId: firstSessionId,
        eventId: null,
        artifactType: "command-output",
        path: null,
        metadata: JSON.stringify({
          summary: "pnpm test browser",
          issueKey: "test:pnpm-browser",
          issueLabel: "pnpm browser",
        }),
      },
    ]);
    db.replaceNarrativesForSession(firstSessionId, [
      {
        sessionId: firstSessionId,
        kind: "handoff",
        content: "Browser hardening still needs verification.",
        sourceRefs: "[]",
      },
    ]);
    db.replaceDecisionsForSession(firstSessionId, [
      {
        sessionId: firstSessionId,
        title: "Ship browser hardening",
        summary: "Ship browser hardening after the test fix lands.",
        rationale: null,
        status: "accepted",
        sourceRefs: "[]",
      },
    ]);

    const secondSessionId = db.createSession({
      host: "gemini",
      projectRoot: "/tmp/project",
      cwd: "/tmp/project",
      title: "Lint follow-up",
      status: "failed",
      startedAt: "2026-03-09T12:00:00.000Z",
      endedAt: "2026-03-09T12:05:00.000Z",
      metadata: null,
    });
    db.appendMessage({
      sessionId: secondSessionId,
      seq: 1,
      role: "assistant",
      source: "wrapper",
      content: "Investigating lint follow-up",
      capturedAt: "2026-03-09T12:00:01.000Z",
      metadata: null,
    });

    expect(
      db.querySessionsByHistory({
        query: "browser hardening",
      }),
    ).toEqual({
      total: 1,
      sessions: [
        expect.objectContaining({
          id: firstSessionId,
          title: "Browser hardening",
        }),
      ],
    });

    expect(
      db.querySessionsByHistory({
        issueKey: "test:pnpm-browser",
      }),
    ).toEqual({
      total: 1,
      sessions: [
        expect.objectContaining({
          id: firstSessionId,
          host: "claude",
        }),
      ],
    });

    expect(
      db.querySessionsByHistory({
        status: "failed",
        limit: 1,
        offset: 0,
      }),
    ).toEqual({
      total: 1,
      sessions: [
        expect.objectContaining({
          id: secondSessionId,
          status: "failed",
        }),
      ],
    });

    expect(
      db.querySessionsByHistory({
        sessionIds: [firstSessionId],
      }),
    ).toEqual({
      total: 1,
      sessions: [
        expect.objectContaining({
          id: firstSessionId,
          title: "Browser hardening",
        }),
      ],
    });
  });

  it("materializes trend attempts and follow-up messages for cross-session queries", () => {
    const firstSessionId = db.createSession({
      host: "claude",
      projectRoot: "/tmp/project",
      cwd: "/tmp/project",
      title: "Trend source",
      status: "completed",
      startedAt: "2026-03-09T13:00:00.000Z",
      endedAt: "2026-03-09T13:05:00.000Z",
      metadata: null,
    });
    db.appendTimelineEvent({
      sessionId: firstSessionId,
      seq: 1,
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
    db.appendMessage({
      sessionId: firstSessionId,
      seq: 1,
      role: "assistant",
      source: "wrapper",
      content: "Next: retry the browser test?",
      capturedAt: "2026-03-09T13:00:30.000Z",
      metadata: null,
    });
    const artifact = db.createArtifact({
      sessionId: firstSessionId,
      eventId: db.getSessionTimeline(firstSessionId)[0]?.id ?? null,
      artifactType: "command-output",
      path: null,
      metadata: JSON.stringify({
        summary: "pnpm test",
        issueKey: "test:pnpm-test",
        issueLabel: "pnpm test",
        issueFamilyKey: "test-family:pnpm",
        issueFamilyLabel: "pnpm tests",
        outcome: "failed",
        intent: "test",
        eventType: "command.completed",
      }),
    });

    expect(artifact.id).toBeTruthy();
    expect(db.querySessionTrendAttempts()).toEqual([
      expect.objectContaining({
        sessionId: firstSessionId,
        issueKey: "test:pnpm-test",
        issueFamilyKey: "test-family:pnpm",
        outcomeCategory: "failed",
        host: "claude",
      }),
    ]);
    expect(
      db.getSessionFollowUpMessages([firstSessionId], { limit: 10 }),
    ).toEqual([
      expect.objectContaining({
        sessionId: firstSessionId,
        content: "Next: retry the browser test?",
      }),
    ]);
  });

  it("paginates follow-up messages with a stable cross-session tie-breaker", () => {
    const uuidSpy = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValueOnce("session-a")
      .mockReturnValueOnce("session-c")
      .mockReturnValueOnce("session-b")
      .mockReturnValueOnce("session-d")
      .mockReturnValueOnce("message-a")
      .mockReturnValueOnce("message-c")
      .mockReturnValueOnce("message-b")
      .mockReturnValueOnce("message-d");

    try {
      const sessionIds = [
        db.createSession({
          host: "claude",
          projectRoot: "/tmp/project",
          cwd: "/tmp/project",
          title: "A",
          status: "completed",
          startedAt: "2026-03-09T14:00:00.000Z",
          endedAt: "2026-03-09T14:01:00.000Z",
          metadata: null,
        }),
        db.createSession({
          host: "claude",
          projectRoot: "/tmp/project",
          cwd: "/tmp/project",
          title: "C",
          status: "completed",
          startedAt: "2026-03-09T14:00:00.000Z",
          endedAt: "2026-03-09T14:01:00.000Z",
          metadata: null,
        }),
        db.createSession({
          host: "claude",
          projectRoot: "/tmp/project",
          cwd: "/tmp/project",
          title: "B",
          status: "completed",
          startedAt: "2026-03-09T14:00:00.000Z",
          endedAt: "2026-03-09T14:01:00.000Z",
          metadata: null,
        }),
        db.createSession({
          host: "claude",
          projectRoot: "/tmp/project",
          cwd: "/tmp/project",
          title: "D",
          status: "completed",
          startedAt: "2026-03-09T14:00:00.000Z",
          endedAt: "2026-03-09T14:01:00.000Z",
          metadata: null,
        }),
      ];

      for (const sessionId of sessionIds) {
        db.appendMessage({
          sessionId,
          seq: 1,
          role: "assistant",
          source: "wrapper",
          content: `Next: inspect ${sessionId}?`,
          capturedAt: "2026-03-09T14:00:30.000Z",
          metadata: null,
        });
      }

      const firstPage = db.getSessionFollowUpMessages(sessionIds, {
        limit: 2,
        offset: 0,
      });
      const secondPage = db.getSessionFollowUpMessages(sessionIds, {
        limit: 2,
        offset: 2,
      });

      expect(
        [...firstPage, ...secondPage].map((message) => message.sessionId),
      ).toEqual(["session-d", "session-c", "session-b", "session-a"]);
    } finally {
      uuidSpy.mockRestore();
    }
  });
});
