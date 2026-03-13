import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { FootprintServer } from "../src/index.js";
import { EvidenceDatabase } from "../src/lib/storage/index.js";
import { FootprintTestHelpers } from "./test-helpers.js";
import type { ServerConfig } from "../src/types.js";

describe("Session Tools", () => {
  let tempDir: string;
  let dbPath: string;
  let server: FootprintServer;
  let helpers: FootprintTestHelpers;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), "footprint-session-tools-"));
    dbPath = path.join(tempDir, "footprint.db");

    const seedDb = new EvidenceDatabase(dbPath);
    const firstSession = seedDb.createSession({
      host: "claude",
      projectRoot: tempDir,
      cwd: tempDir,
      title: null,
      status: "completed",
      startedAt: "2026-03-08T08:00:00.000Z",
      endedAt: "2026-03-08T08:01:00.000Z",
      metadata: JSON.stringify({ command: "claude", args: ["--resume"] }),
    });
    seedDb.appendMessage({
      sessionId: firstSession,
      seq: 1,
      role: "user",
      source: "wrapper",
      content: "Older session",
      capturedAt: "2026-03-08T08:00:10.000Z",
      metadata: null,
    });
    seedDb.appendTimelineEvent({
      sessionId: firstSession,
      seq: 1,
      eventType: "session.start",
      eventSubType: null,
      source: "wrapper",
      summary: "Started older session",
      payload: null,
      startedAt: "2026-03-08T08:00:00.000Z",
      endedAt: "2026-03-08T08:00:00.000Z",
      status: "completed",
      relatedMessageId: null,
    });

    const secondSession = seedDb.createSession({
      host: "claude",
      projectRoot: tempDir,
      cwd: tempDir,
      title: "Implement Slice A",
      status: "failed",
      startedAt: "2026-03-09T09:00:00.000Z",
      endedAt: "2026-03-09T09:02:00.000Z",
      metadata: JSON.stringify({ command: "claude", args: ["--dangerously"] }),
    });
    const userMessageId = seedDb.appendMessage({
      sessionId: secondSession,
      seq: 1,
      role: "user",
      source: "wrapper",
      content: "Implement Slice A",
      capturedAt: "2026-03-09T09:00:05.000Z",
      metadata: null,
    });
    seedDb.appendMessage({
      sessionId: secondSession,
      seq: 2,
      role: "assistant",
      source: "wrapper",
      content: "Running tests",
      capturedAt: "2026-03-09T09:00:06.000Z",
      metadata: null,
    });
    seedDb.appendTimelineEvent({
      sessionId: secondSession,
      seq: 1,
      eventType: "session.start",
      eventSubType: null,
      source: "wrapper",
      summary: "Started",
      payload: null,
      startedAt: "2026-03-09T09:00:00.000Z",
      endedAt: "2026-03-09T09:00:00.000Z",
      status: "running",
      relatedMessageId: null,
    });
    seedDb.appendTimelineEvent({
      sessionId: secondSession,
      seq: 2,
      eventType: "message.user.submitted",
      eventSubType: null,
      source: "wrapper",
      summary: "Implement Slice A",
      payload: null,
      startedAt: "2026-03-09T09:00:05.000Z",
      endedAt: "2026-03-09T09:00:05.000Z",
      status: "captured",
      relatedMessageId: userMessageId,
    });
    seedDb.appendTimelineEvent({
      sessionId: secondSession,
      seq: 3,
      eventType: "session.end",
      eventSubType: null,
      source: "wrapper",
      summary: "Failed",
      payload: JSON.stringify({ exitCode: 1 }),
      startedAt: "2026-03-09T09:02:00.000Z",
      endedAt: "2026-03-09T09:02:00.000Z",
      status: "failed",
      relatedMessageId: null,
    });
    seedDb.createArtifact({
      sessionId: secondSession,
      eventId: null,
      artifactType: "command-output",
      path: null,
      metadata: JSON.stringify({
        summary: "pnpm test",
        category: "test",
        status: "failed",
        outcome: "failed",
        intent: "test",
        command: "pnpm",
        args: ["test"],
        issueKey: "test:pnpm-test",
        issueLabel: "pnpm test",
      }),
    });
    seedDb.close();

    const config: ServerConfig = {
      dbPath,
      password: "session-tool-password",
    };
    server = new FootprintServer(config);
    helpers = new FootprintTestHelpers(server);
  });

  afterEach(() => {
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("registers list-sessions and get-session", async () => {
    const tools = await helpers.getTools();

    expect(tools).toContainEqual(
      expect.objectContaining({
        name: "list-sessions",
        description: expect.stringContaining("reverse chronological order"),
      }),
    );

    expect(tools).toContainEqual(
      expect.objectContaining({
        name: "get-session",
        description: expect.stringContaining("paginated transcript"),
      }),
    );

    expect(tools).toContainEqual(
      expect.objectContaining({
        name: "get-session-artifacts",
        description: expect.stringContaining("deterministic artifacts"),
      }),
    );

    expect(tools).toContainEqual(
      expect.objectContaining({
        name: "get-session-trends",
        description: expect.stringContaining("recurring trend"),
      }),
    );

    expect(tools).toContainEqual(
      expect.objectContaining({
        name: "export-sessions",
        description: expect.stringContaining("ZIP archive"),
      }),
    );

    expect(tools).toContainEqual(
      expect.objectContaining({
        name: "get-history-trends",
        description: expect.stringContaining("recurring issue patterns"),
      }),
    );
  });

  it("binds session tools to the correct MCP app resources", async () => {
    const toolNamesByResource = {
      "ui://footprint/session-dashboard.html": [
        "list-contexts",
        "list-sessions",
        "search-history",
        "get-history-trends",
        "get-history-handoff",
      ],
      "ui://footprint/session-detail.html": [
        "get-session",
        "export-sessions",
        "get-session-messages",
        "get-session-trends",
        "get-session-timeline",
        "get-session-artifacts",
        "get-session-narrative",
        "get-session-decisions",
        "reingest-session",
      ],
    } as const;

    for (const [resourceUri, toolNames] of Object.entries(
      toolNamesByResource,
    )) {
      for (const toolName of toolNames) {
        const toolDefinition = await helpers.getToolDefinition(toolName);
        expect(
          (
            (toolDefinition._meta as Record<string, unknown>)?.ui as Record<
              string,
              unknown
            >
          )?.resourceUri,
        ).toBe(resourceUri);
      }
    }
  });

  it("lists sessions in reverse chronological order with fallback labels", async () => {
    const result = await helpers.callTool("list-sessions", {});
    const sessions = result.structuredContent.sessions as Array<{
      id: string;
      label: string;
      title: string | null;
      status: string;
    }>;

    expect(result.structuredContent.total).toBe(2);
    expect(sessions).toHaveLength(2);
    expect(sessions[0]?.title).toBe("Implement Slice A");
    expect(sessions[0]?.status).toBe("failed");
    expect(sessions[1]?.title).toBeNull();
    expect(sessions[1]?.label).toContain("claude session");
  });

  it("filters list-sessions by host and status", async () => {
    const result = await helpers.callTool("list-sessions", {
      host: "claude",
      status: "failed",
    });
    const sessions = result.structuredContent.sessions as Array<{
      id: string;
      status: string;
      title: string | null;
    }>;

    expect(result.structuredContent.filters).toEqual({
      query: undefined,
      issueKey: undefined,
      host: "claude",
      status: "failed",
    });
    expect(result.structuredContent.total).toBe(1);
    expect(sessions).toEqual([
      expect.objectContaining({
        status: "failed",
        title: "Implement Slice A",
      }),
    ]);
  });

  it("filters list-sessions by query and issue key", async () => {
    const result = await helpers.callTool("list-sessions", {
      query: "running tests",
      issueKey: "test:pnpm-test",
    });
    const sessions = result.structuredContent.sessions as Array<{
      id: string;
      status: string;
      title: string | null;
    }>;

    expect(result.structuredContent.filters).toEqual({
      query: "running tests",
      issueKey: "test:pnpm-test",
      host: undefined,
      status: undefined,
    });
    expect(result.structuredContent.total).toBe(1);
    expect(sessions).toEqual([
      expect.objectContaining({
        status: "failed",
        title: "Implement Slice A",
      }),
    ]);
  });

  it("resolves text-filtered list-sessions without hydrating full session detail", async () => {
    const serverDb = (server as unknown as { db: EvidenceDatabase }).db;
    const detailSpy = vi.spyOn(serverDb, "getSessionDetail");

    try {
      const result = await helpers.callTool("list-sessions", {
        query: "running tests",
      });
      const sessions = result.structuredContent.sessions as Array<{
        title: string | null;
      }>;

      expect(result.structuredContent.total).toBe(1);
      expect(sessions).toEqual([
        expect.objectContaining({
          title: "Implement Slice A",
        }),
      ]);
      expect(detailSpy).not.toHaveBeenCalled();
    } finally {
      detailSpy.mockRestore();
    }
  });

  it("returns session metadata, message summary, and timeline summary", async () => {
    const listResult = await helpers.callTool("list-sessions", {});
    const sessionId = (
      listResult.structuredContent.sessions as Array<{ id: string }>
    )[0]?.id;

    const result = await helpers.callTool("get-session", { id: sessionId });
    const session = result.structuredContent.session as {
      host: string;
      status: string;
      label: string;
    };
    const messageSummary = result.structuredContent.messageSummary as {
      total: number;
      byRole: { user: number; assistant: number; system: number };
    };
    const timelineSummary = result.structuredContent.timelineSummary as {
      total: number;
      eventTypes: string[];
      statuses: string[];
    };
    const messagePage = result.structuredContent.messagePage as {
      total: number;
      offset: number;
      returned: number;
      hasMore: boolean;
    };
    const timelinePage = result.structuredContent.timelinePage as {
      total: number;
      offset: number;
      returned: number;
      hasMore: boolean;
    };
    const artifactSummary = result.structuredContent.artifactSummary as {
      total: number;
      byType: {
        fileChange: number;
        commandOutput: number;
        testResult: number;
        gitCommit: number;
      };
    };

    expect(session.host).toBe("claude");
    expect(session.status).toBe("failed");
    expect(session.label).toBe("Implement Slice A");
    expect(messageSummary.total).toBe(2);
    expect(messageSummary.byRole).toEqual({
      user: 1,
      assistant: 1,
      system: 0,
    });
    expect(timelineSummary.total).toBe(3);
    expect(timelineSummary.eventTypes).toContain("session.start");
    expect(timelineSummary.statuses).toContain("failed");
    expect(messagePage).toEqual(
      expect.objectContaining({
        total: 2,
        offset: 0,
        limit: 50,
        returned: 2,
        hasMore: false,
        nextOffset: null,
      }),
    );
    expect(timelinePage).toEqual(
      expect.objectContaining({
        total: 3,
        offset: 0,
        limit: 50,
        returned: 3,
        hasMore: false,
        nextOffset: null,
      }),
    );
    expect(artifactSummary.total).toBe(1);
    expect(artifactSummary.byType).toEqual({
      fileChange: 0,
      commandOutput: 1,
      testResult: 0,
      gitCommit: 0,
    });
    expect(result.structuredContent.hasNarratives).toBe(false);
  });
});
