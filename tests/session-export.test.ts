import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import JSZip from "jszip";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { FootprintServer } from "../src/index.js";
import { reingestSessionHistory } from "../src/ingestion/index.js";
import { EvidenceDatabase } from "../src/lib/storage/index.js";
import { FootprintTestHelpers } from "./test-helpers.js";
import type { ServerConfig } from "../src/types.js";

describe("Session Export", () => {
  let tempDir: string;
  let dbPath: string;
  let server: FootprintServer;
  let helpers: FootprintTestHelpers;
  let sessionId: string;
  let secondSessionId: string;
  let originalExportDir: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), "footprint-session-export-"));
    dbPath = path.join(tempDir, "footprint.db");
    originalExportDir = process.env.FOOTPRINT_EXPORT_DIR;
    process.env.FOOTPRINT_EXPORT_DIR = tempDir;

    const db = new EvidenceDatabase(dbPath);
    sessionId = db.createSession({
      host: "claude",
      projectRoot: tempDir,
      cwd: tempDir,
      title: "Exported release handoff",
      status: "completed",
      startedAt: "2026-03-10T08:00:00.000Z",
      endedAt: "2026-03-10T08:05:00.000Z",
      metadata: JSON.stringify({ transport: "pty", branch: "main" }),
    });

    const messageId = db.appendMessage({
      sessionId,
      seq: 1,
      role: "user",
      source: "wrapper",
      content: "Ship the browser coverage rollout and confirm follow-up docs.",
      capturedAt: "2026-03-10T08:00:05.000Z",
      metadata: null,
    });
    db.appendMessage({
      sessionId,
      seq: 2,
      role: "assistant",
      source: "wrapper",
      content: "Running pnpm test:browser and updating README.md",
      capturedAt: "2026-03-10T08:00:15.000Z",
      metadata: null,
    });
    db.appendMessage({
      sessionId,
      seq: 3,
      role: "assistant",
      source: "wrapper",
      content:
        "Next: verify whether ARCHITECTURE.md needs the same rollout note?",
      capturedAt: "2026-03-10T08:00:25.000Z",
      metadata: null,
    });

    db.appendTimelineEvent({
      sessionId,
      seq: 1,
      eventType: "message.user.submitted",
      eventSubType: null,
      source: "wrapper",
      summary: "Ship the browser coverage rollout",
      payload: null,
      startedAt: "2026-03-10T08:00:05.000Z",
      endedAt: "2026-03-10T08:00:05.000Z",
      status: "captured",
      relatedMessageId: messageId,
    });
    db.appendTimelineEvent({
      sessionId,
      seq: 2,
      eventType: "command.started",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm test:browser",
      payload: JSON.stringify({ command: "pnpm", args: ["test:browser"] }),
      startedAt: "2026-03-10T08:00:10.000Z",
      endedAt: "2026-03-10T08:00:10.000Z",
      status: "running",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId,
      seq: 3,
      eventType: "command.completed",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm test:browser",
      payload: JSON.stringify({
        command: "pnpm",
        args: ["test:browser"],
        exitCode: 1,
        stdout:
          "FAIL tests/browser.spec.ts > captures trend card\nAssertionError: expected visible",
      }),
      startedAt: "2026-03-10T08:00:10.000Z",
      endedAt: "2026-03-10T08:00:12.000Z",
      status: "failed",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId,
      seq: 4,
      eventType: "command.started",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm test:browser",
      payload: JSON.stringify({ command: "pnpm", args: ["test:browser"] }),
      startedAt: "2026-03-10T08:00:13.000Z",
      endedAt: "2026-03-10T08:00:13.000Z",
      status: "running",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId,
      seq: 5,
      eventType: "command.completed",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm test:browser",
      payload: JSON.stringify({
        command: "pnpm",
        args: ["test:browser"],
        exitCode: 0,
      }),
      startedAt: "2026-03-10T08:00:13.000Z",
      endedAt: "2026-03-10T08:00:14.000Z",
      status: "completed",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId,
      seq: 6,
      eventType: "file.changed",
      eventSubType: null,
      source: "wrapper",
      summary: "README.md changed",
      payload: JSON.stringify({ path: "README.md", afterStatus: "M" }),
      startedAt: "2026-03-10T08:00:20.000Z",
      endedAt: "2026-03-10T08:00:20.000Z",
      status: "M",
      relatedMessageId: null,
    });

    secondSessionId = db.createSession({
      host: "gemini",
      projectRoot: tempDir,
      cwd: tempDir,
      title: "Follow-up browser retry",
      status: "failed",
      startedAt: "2026-03-10T09:00:00.000Z",
      endedAt: "2026-03-10T09:03:00.000Z",
      metadata: JSON.stringify({ transport: "pty", branch: "main" }),
    });
    const secondMessageId = db.appendMessage({
      sessionId: secondSessionId,
      seq: 1,
      role: "user",
      source: "wrapper",
      content: "Retry browser coverage on Gemini and note blockers.",
      capturedAt: "2026-03-10T09:00:05.000Z",
      metadata: null,
    });
    db.appendMessage({
      sessionId: secondSessionId,
      seq: 2,
      role: "assistant",
      source: "wrapper",
      content: "pnpm test:browser still failing on WebKit snapshot drift.",
      capturedAt: "2026-03-10T09:00:15.000Z",
      metadata: null,
    });
    db.appendTimelineEvent({
      sessionId: secondSessionId,
      seq: 1,
      eventType: "message.user.submitted",
      eventSubType: null,
      source: "wrapper",
      summary: "Retry browser coverage on Gemini",
      payload: null,
      startedAt: "2026-03-10T09:00:05.000Z",
      endedAt: "2026-03-10T09:00:05.000Z",
      status: "captured",
      relatedMessageId: secondMessageId,
    });
    db.appendTimelineEvent({
      sessionId: secondSessionId,
      seq: 2,
      eventType: "command.started",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm test:browser",
      payload: JSON.stringify({ command: "pnpm", args: ["test:browser"] }),
      startedAt: "2026-03-10T09:00:10.000Z",
      endedAt: "2026-03-10T09:00:10.000Z",
      status: "running",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId: secondSessionId,
      seq: 3,
      eventType: "command.completed",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm test:browser",
      payload: JSON.stringify({
        command: "pnpm",
        args: ["test:browser"],
        exitCode: 1,
      }),
      startedAt: "2026-03-10T09:00:10.000Z",
      endedAt: "2026-03-10T09:00:12.000Z",
      status: "failed",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId: secondSessionId,
      seq: 4,
      eventType: "file.changed",
      eventSubType: null,
      source: "wrapper",
      summary: "ARCHITECTURE.md changed",
      payload: JSON.stringify({ path: "ARCHITECTURE.md", afterStatus: "M" }),
      startedAt: "2026-03-10T09:00:20.000Z",
      endedAt: "2026-03-10T09:00:20.000Z",
      status: "M",
      relatedMessageId: null,
    });

    reingestSessionHistory(db, sessionId);
    reingestSessionHistory(db, secondSessionId);
    db.close();

    server = new FootprintServer({
      dbPath,
      password: "session-export-password",
    } satisfies ServerConfig);
    helpers = new FootprintTestHelpers(server);
  });

  afterEach(() => {
    server.close();
    if (originalExportDir === undefined) {
      delete process.env.FOOTPRINT_EXPORT_DIR;
    } else {
      process.env.FOOTPRINT_EXPORT_DIR = originalExportDir;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("registers export-sessions and returns a base64 archive with raw and derived session files", async () => {
    const tools = await helpers.getTools();
    expect(tools).toContainEqual(
      expect.objectContaining({
        name: "export-sessions",
        description: expect.stringContaining("ZIP archive"),
      }),
    );
    const exportTool = await helpers.getToolDefinition("export-sessions");
    expect(
      (
        (exportTool._meta as Record<string, unknown>)?.ui as Record<
          string,
          unknown
        >
      )?.resourceUri,
    ).toBe("ui://footprint/session-detail.html");

    const result = await helpers.callTool("export-sessions", {
      sessionIds: [sessionId, secondSessionId],
      outputMode: "base64",
    });

    expect(result.structuredContent.success).toBe(true);
    expect(result.structuredContent.sessionCount).toBe(2);
    expect(result.structuredContent.historyGrouping).toBe("issue");
    expect(result.structuredContent.filename).toBeUndefined();
    expect(result.structuredContent.base64Data).toEqual(expect.any(String));

    const zip = await JSZip.loadAsync(
      Buffer.from(result.structuredContent.base64Data as string, "base64"),
    );
    const manifest = JSON.parse(
      await zip.file("manifest.json")!.async("text"),
    ) as {
      historyGrouping: string;
      sessionCount: number;
      includedSections: string[];
    };
    expect(manifest.historyGrouping).toBe("issue");
    expect(manifest.sessionCount).toBe(2);
    expect(manifest.includedSections).toContain("history-trends.json");
    expect(manifest.includedSections).toContain("history-trends.md");
    expect(manifest.includedSections).toContain("history-handoff.json");
    expect(manifest.includedSections).toContain("history-handoff.md");
    expect(manifest.includedSections).toContain("sessions/{id}/handoff.md");

    const index = JSON.parse(
      await zip.file("sessions/index.json")!.async("text"),
    ) as Array<{ id: string; label: string }>;
    expect(index).toEqual([
      expect.objectContaining({
        id: sessionId,
        label: "Exported release handoff",
      }),
      expect.objectContaining({
        id: secondSessionId,
        label: "Follow-up browser retry",
      }),
    ]);

    const historyTrends = JSON.parse(
      await zip.file("history-trends.json")!.async("text"),
    ) as {
      summary: { totalTrends: number; matchingSessions: number };
      trends: Array<{
        issueKey: string;
        sessionCount: number;
        attemptCount: number;
      }>;
    };
    expect(historyTrends.summary.totalTrends).toBeGreaterThan(0);
    expect(historyTrends.summary.matchingSessions).toBe(2);
    expect(historyTrends.trends).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          issueKey: "test:pnpm-test-browser",
          sessionCount: 2,
          attemptCount: 3,
        }),
      ]),
    );

    const historyTrendsMarkdown = await zip
      .file("history-trends.md")!
      .async("text");
    expect(historyTrendsMarkdown).toContain("Export History Trends");
    expect(historyTrendsMarkdown).toContain(
      "test:pnpm-test-browser: pnpm test:browser [test] (regressed, sessions 2, attempts 3, latest failed, hosts claude, gemini)",
    );

    const historyHandoff = JSON.parse(
      await zip.file("history-handoff.json")!.async("text"),
    ) as {
      summary: {
        matchingSessions: number;
        blockingTrends: number;
      };
      followUps: string[];
    };
    expect(historyHandoff.summary.matchingSessions).toBe(2);
    expect(historyHandoff.summary.blockingTrends).toBeGreaterThan(0);
    expect(historyHandoff.followUps).toContain(
      "Next: verify whether ARCHITECTURE.md needs the same rollout note?",
    );

    const historyHandoffMarkdown = await zip
      .file("history-handoff.md")!
      .async("text");
    expect(historyHandoffMarkdown).toContain("# History Handoff");
    expect(historyHandoffMarkdown).toContain("## Blocking Trends");
    expect(historyHandoffMarkdown).toContain("## Recent Recoveries");
    expect(historyHandoffMarkdown).toContain("## Follow-Ups");

    const summary = JSON.parse(
      await zip.file(`sessions/${sessionId}/session.json`)!.async("text"),
    ) as {
      session: { metadataDetails: { branch: string } };
      artifactSummary: { total: number };
      counts: { decisions: number };
    };
    expect(summary.session.metadataDetails.branch).toBe("main");
    expect(summary.artifactSummary.total).toBeGreaterThan(0);
    expect(summary.counts.decisions).toBeGreaterThan(0);

    const handoff = await zip
      .file(`sessions/${sessionId}/handoff.md`)!
      .async("text");
    expect(handoff).toContain(
      "Issue clusters: test: pnpm test:browser / tests/browser.spec.ts > captures trend card [Assertion failure] (recovered after 1 failed attempt(s); latest succeeded)",
    );
    expect(handoff).toContain("Retry hotspots: pnpm test:browser x2");
    expect(handoff).toContain("## Recurring Trend Context");
    expect(handoff).toContain(
      "test:pnpm-test-browser: pnpm test:browser [test] (Regressed after 1 successful attempt(s); latest failed.; exported sessions 2, total attempts 3, this session attempts 2, this session latest succeeded, global latest failed)",
    );
    expect(handoff).toContain(
      "Next: verify whether ARCHITECTURE.md needs the same rollout note?",
    );

    const transcript = await zip
      .file(`sessions/${sessionId}/transcript.md`)!
      .async("text");
    expect(transcript).toContain("Ship the browser coverage rollout");
    expect(transcript).toContain(
      "Running pnpm test:browser and updating README.md",
    );

    const artifacts = JSON.parse(
      await zip.file(`sessions/${sessionId}/artifacts.json`)!.async("text"),
    ) as Array<{
      artifactType: string;
      category: string | null;
      intent: string | null;
      issueKey: string | null;
      failureSignatureLabel: string | null;
      testSuite: string | null;
      testCase: string | null;
    }>;
    expect(artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          artifactType: "command-output",
          category: "test",
          intent: "test",
          issueKey: "test:pnpm-test-browser",
          failureSignatureLabel: "Assertion failure",
          testSuite: "tests/browser.spec.ts",
          testCase: "captures trend card",
        }),
      ]),
    );
  });

  it("writes a session export file when outputMode is file", async () => {
    const result = await helpers.callTool("export-sessions", {
      sessionIds: [sessionId],
      outputMode: "file",
    });

    expect(result.structuredContent.success).toBe(true);
    expect(result.structuredContent.base64Data).toBeUndefined();
    expect(result.structuredContent.filename).toEqual(expect.any(String));
    expect(fs.existsSync(result.structuredContent.filename as string)).toBe(
      true,
    );
  });

  it("exports filtered sessions and records export scope in the manifest", async () => {
    const result = await helpers.callTool("export-sessions", {
      issueKey: "test:pnpm-test-browser",
      host: "gemini",
      status: "failed",
      groupBy: "family",
      outputMode: "base64",
    });

    expect(result.structuredContent.success).toBe(true);
    expect(result.structuredContent.sessionCount).toBe(1);
    expect(result.structuredContent.historyGrouping).toBe("family");
    expect(result.structuredContent.filters).toEqual({
      issueKey: "test:pnpm-test-browser",
      host: "gemini",
      status: "failed",
      groupBy: "family",
    });
    expect(result.structuredContent.sessions).toEqual([
      expect.objectContaining({
        id: secondSessionId,
        host: "gemini",
        status: "failed",
      }),
    ]);

    const zip = await JSZip.loadAsync(
      Buffer.from(result.structuredContent.base64Data as string, "base64"),
    );
    const manifest = JSON.parse(
      await zip.file("manifest.json")!.async("text"),
    ) as {
      historyGrouping: string;
      selection: {
        mode: string;
        filters?: {
          issueKey?: string;
          host?: string;
          status?: string;
          groupBy?: string;
        };
      };
    };
    expect(manifest.historyGrouping).toBe("family");
    expect(manifest.selection).toEqual({
      mode: "filters",
      filters: {
        issueKey: "test:pnpm-test-browser",
        host: "gemini",
        status: "failed",
        groupBy: "family",
      },
    });

    const index = JSON.parse(
      await zip.file("sessions/index.json")!.async("text"),
    ) as Array<{ id: string }>;
    expect(index).toEqual([
      expect.objectContaining({
        id: secondSessionId,
      }),
    ]);

    const historyHandoff = JSON.parse(
      await zip.file("history-handoff.json")!.async("text"),
    ) as {
      summary: { matchingSessions: number; groupBy: string };
      blockers: string[];
      recentSessions: Array<{ id: string }>;
    };
    expect(historyHandoff.summary.groupBy).toBe("family");
    expect(historyHandoff.blockers).toEqual([
      expect.stringContaining("test-family:pnpm"),
    ]);
    expect(historyHandoff.summary.matchingSessions).toBe(1);
    expect(historyHandoff.recentSessions).toEqual([
      expect.objectContaining({
        id: secondSessionId,
      }),
    ]);

    const historyTrends = JSON.parse(
      await zip.file("history-trends.json")!.async("text"),
    ) as {
      summary: { groupBy: string };
      trends: Array<{ issueKey: string; label: string }>;
    };
    expect(historyTrends.summary.groupBy).toBe("family");
    expect(historyTrends.trends).toEqual([
      expect.objectContaining({
        issueKey: "test-family:pnpm",
        label: "pnpm tests",
      }),
    ]);
  });

  it("hydrates only the filtered export match instead of the full session history", async () => {
    const serverDb = (server as unknown as { db: EvidenceDatabase }).db;

    for (let index = 0; index < 10; index += 1) {
      const extraSessionId = serverDb.createSession({
        host: "codex",
        projectRoot: tempDir,
        cwd: tempDir,
        title: `Unrelated bulk session ${index + 1}`,
        status: "completed",
        startedAt: `2026-03-10T10:${String(index).padStart(2, "0")}:00.000Z`,
        endedAt: `2026-03-10T10:${String(index).padStart(2, "0")}:30.000Z`,
        metadata: JSON.stringify({ branch: "bulk-history" }),
      });
      serverDb.appendMessage({
        sessionId: extraSessionId,
        seq: 1,
        role: "assistant",
        source: "wrapper",
        content: `Unrelated replay ${index + 1}`,
        capturedAt: `2026-03-10T10:${String(index).padStart(2, "0")}:05.000Z`,
        metadata: null,
      });
      serverDb.finalizeSession(extraSessionId, {
        status: "completed",
        endedAt: `2026-03-10T10:${String(index).padStart(2, "0")}:30.000Z`,
        title: `Unrelated bulk session ${index + 1}`,
      });
    }

    const detailSpy = vi.spyOn(serverDb, "getSessionDetail");
    const listSpy = vi.spyOn(serverDb, "listSessions");

    try {
      const result = await helpers.callTool("export-sessions", {
        query: "WebKit snapshot drift",
        outputMode: "base64",
      });

      expect(result.structuredContent.sessionCount).toBe(1);
      expect(result.structuredContent.sessions).toEqual([
        expect.objectContaining({
          id: secondSessionId,
        }),
      ]);
      expect(detailSpy).toHaveBeenCalledTimes(1);
      expect(detailSpy).toHaveBeenCalledWith(secondSessionId);
      expect(listSpy).not.toHaveBeenCalled();
    } finally {
      detailSpy.mockRestore();
      listSpy.mockRestore();
    }
  });

  it("scopes history handoff queries to explicit session ids during export", async () => {
    const serverDb = (server as unknown as { db: EvidenceDatabase }).db;
    const historyQuerySpy = vi.spyOn(serverDb, "querySessionsByHistory");

    try {
      const result = await helpers.callTool("export-sessions", {
        sessionIds: [secondSessionId],
        outputMode: "base64",
      });

      expect(result.structuredContent.sessionCount).toBe(1);
      expect(result.structuredContent.sessions).toEqual([
        expect.objectContaining({
          id: secondSessionId,
        }),
      ]);
      expect(historyQuerySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionIds: [secondSessionId],
        }),
      );
    } finally {
      historyQuerySpy.mockRestore();
    }
  });

  it("rejects unknown session ids", async () => {
    await expect(
      helpers.callTool("export-sessions", {
        sessionIds: ["missing-session"],
        outputMode: "base64",
      }),
    ).rejects.toThrow("Session IDs not found: missing-session");
  });

  it("rejects mixing session ids with export filters", async () => {
    await expect(
      helpers.callTool("export-sessions", {
        sessionIds: [sessionId],
        host: "claude",
        outputMode: "base64",
      }),
    ).rejects.toThrow(
      "Cannot combine sessionIds with query/issueKey/host/status filters",
    );
  });
});
