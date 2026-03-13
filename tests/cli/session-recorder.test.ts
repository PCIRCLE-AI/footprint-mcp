import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync, spawn } from "node:child_process";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { EvidenceDatabase } from "../../src/lib/storage/index.js";

const require = createRequire(import.meta.url);
const cliPath = fileURLToPath(
  new URL("../../src/cli/index.ts", import.meta.url),
);
const fixturePath = fileURLToPath(
  new URL("../fixtures/recorder-host.mjs", import.meta.url),
);
const packageRoot = fileURLToPath(new URL("../../", import.meta.url));
const tsxLoaderPath = path.join(
  path.dirname(require.resolve("tsx/package.json")),
  "dist/loader.mjs",
);

function runCli(
  args: string[],
  options?: {
    input?: string;
    env?: NodeJS.ProcessEnv;
    cwd?: string;
  },
): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--import", tsxLoaderPath, cliPath, ...args],
      {
        cwd: options?.cwd ?? packageRoot,
        env: {
          ...process.env,
          ...options?.env,
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    });

    child.once("error", reject);
    child.once("close", (code) => {
      resolve({ code, stdout, stderr });
    });

    child.stdin.end(options?.input ?? "");
  });
}

describe("CLI Session Recorder", () => {
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), "footprint-session-cli-"));
    dbPath = path.join(tempDir, "footprint.db");
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("records a successful claude session and exposes it through list/show commands", async () => {
    const runResult = await runCli(["run", "claude", "--", fixturePath], {
      input: "ship pnpm test on src/app.ts\n",
      env: {
        FOOTPRINT_DB_PATH: dbPath,
        FOOTPRINT_CLAUDE_COMMAND: process.execPath,
      },
    });

    expect(runResult.code).toBe(0);
    expect(runResult.stdout).toContain(
      "assistant:ship pnpm test on src/app.ts",
    );
    expect(runResult.stdout).toContain("done:ship pnpm test on src/app.ts");

    const db = new EvidenceDatabase(dbPath);
    const sessions = db.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.host).toBe("claude");
    expect(sessions[0]?.status).toBe("completed");

    const detail = db.getSessionDetail(sessions[0]!.id);
    const sessionMetadata = JSON.parse(detail?.session.metadata ?? "{}") as {
      transport?: string;
      ptyTranscriptFormat?: string | null;
      ptyStdinMode?: string | null;
      fallbackReason?: string | null;
    };
    const sessionStartPayload = JSON.parse(
      detail?.timeline[0]?.payload ?? "{}",
    ) as {
      transport?: string;
      ptyTranscriptFormat?: string | null;
      ptyStdinMode?: string | null;
      fallbackReason?: string | null;
    };
    expect(detail?.messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "assistant",
    ]);
    expect(detail?.timeline[0]?.eventType).toBe("session.start");
    expect(detail?.timeline.at(-1)?.eventType).toBe("session.end");
    expect(sessionMetadata.transport).toBe("pipe");
    expect(sessionMetadata.ptyTranscriptFormat).toBeNull();
    expect(sessionMetadata.ptyStdinMode).toBeNull();
    expect(sessionMetadata.fallbackReason).toBe("stdio-not-tty");
    expect(sessionStartPayload.transport).toBe("pipe");
    expect(sessionStartPayload.ptyTranscriptFormat).toBeNull();
    expect(sessionStartPayload.ptyStdinMode).toBeNull();
    expect(sessionStartPayload.fallbackReason).toBe("stdio-not-tty");
    db.close();

    const listResult = await runCli(["list-sessions"], {
      env: {
        FOOTPRINT_DB_PATH: dbPath,
      },
    });
    expect(listResult.code).toBe(0);
    expect(listResult.stdout).toContain("Recorded sessions: 1");
    expect(listResult.stdout).toContain("claude | completed");

    const aliasListResult = await runCli(["sessions", "list"], {
      env: {
        FOOTPRINT_DB_PATH: dbPath,
      },
    });
    expect(aliasListResult.code).toBe(0);
    expect(aliasListResult.stdout).toContain("Recorded sessions: 1");

    const showResult = await runCli(["get-session", sessions[0]!.id], {
      env: {
        FOOTPRINT_DB_PATH: dbPath,
      },
    });
    expect(showResult.code).toBe(0);
    expect(showResult.stdout).toContain(`Session: ${sessions[0]!.id}`);
    expect(showResult.stdout).toContain("Messages: 3");
    expect(showResult.stdout).toContain("Recurring Trend Preview:");
    expect(showResult.stdout).toContain("Artifact Preview:");
    expect(showResult.stdout).toContain("Transcript Preview:");
    expect(showResult.stdout).toContain("Timeline Preview:");
    expect(showResult.stdout).toContain("pnpm test");

    const aliasShowResult = await runCli(["session", "show", sessions[0]!.id], {
      env: {
        FOOTPRINT_DB_PATH: dbPath,
      },
    });
    expect(aliasShowResult.code).toBe(0);
    expect(aliasShowResult.stdout).toContain(`Session: ${sessions[0]!.id}`);
    expect(aliasShowResult.stdout).not.toContain("Handoff Highlights:");

    const ingestResult = await runCli(["session", "ingest", sessions[0]!.id], {
      env: {
        FOOTPRINT_DB_PATH: dbPath,
      },
    });
    expect(ingestResult.code).toBe(0);
    expect(ingestResult.stdout).toContain(
      `Reingested session: ${sessions[0]!.id}`,
    );

    const postIngestShowResult = await runCli(
      ["session", "show", sessions[0]!.id],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(postIngestShowResult.code).toBe(0);
    expect(postIngestShowResult.stdout).toContain("Handoff Highlights:");

    const jsonListResult = await runCli(["sessions", "list", "--json"], {
      env: {
        FOOTPRINT_DB_PATH: dbPath,
      },
    });
    expect(jsonListResult.code).toBe(0);
    expect(JSON.parse(jsonListResult.stdout)).toEqual(
      expect.objectContaining({
        total: 1,
        sessions: expect.arrayContaining([
          expect.objectContaining({
            id: sessions[0]!.id,
            host: "claude",
          }),
        ]),
      }),
    );

    const jsonShowResult = await runCli(
      ["session", "show", sessions[0]!.id, "--json"],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(jsonShowResult.code).toBe(0);
    const parsedShowResult = JSON.parse(jsonShowResult.stdout) as {
      session: { id: string; host: string };
      messagePage: { limit: number; returned: number; hasMore: boolean };
      trendPage: { limit: number; returned: number; hasMore: boolean };
      timelinePage: { limit: number; returned: number; hasMore: boolean };
      artifactPage: { limit: number; returned: number; hasMore: boolean };
      narrativePage: { limit: number; returned: number; hasMore: boolean };
      decisionPage: { limit: number; returned: number; hasMore: boolean };
      artifactSummary: { total: number };
      hasNarratives: boolean;
    };
    expect(parsedShowResult.session).toEqual(
      expect.objectContaining({
        id: sessions[0]!.id,
        host: "claude",
      }),
    );
    expect(parsedShowResult.messagePage.limit).toBe(50);
    expect(parsedShowResult.messagePage.returned).toBe(3);
    expect(parsedShowResult.messagePage.hasMore).toBe(false);
    expect(parsedShowResult.trendPage.limit).toBe(50);
    expect(parsedShowResult.timelinePage.limit).toBe(50);
    expect(parsedShowResult.artifactPage.limit).toBe(50);
    expect(parsedShowResult.narrativePage.limit).toBe(50);
    expect(parsedShowResult.decisionPage.limit).toBe(50);
    expect(parsedShowResult.artifactSummary.total).toBeGreaterThan(0);
    expect(parsedShowResult.hasNarratives).toBe(true);

    const pagedShowResult = await runCli(
      [
        "session",
        "show",
        sessions[0]!.id,
        "--message-limit",
        "2",
        "--trend-limit",
        "1",
        "--timeline-limit",
        "2",
        "--artifact-limit",
        "1",
        "--narrative-limit",
        "2",
        "--decision-limit",
        "1",
        "--json",
      ],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(pagedShowResult.code).toBe(0);
    expect(JSON.parse(pagedShowResult.stdout)).toEqual(
      expect.objectContaining({
        messagePage: expect.objectContaining({
          limit: 2,
          returned: 2,
          hasMore: true,
          nextOffset: 2,
        }),
        trendPage: expect.objectContaining({
          limit: 1,
          returned: 1,
          hasMore: false,
          nextOffset: null,
        }),
        timelinePage: expect.objectContaining({
          limit: 2,
          returned: 2,
          hasMore: true,
          nextOffset: 2,
        }),
        artifactPage: expect.objectContaining({
          limit: 1,
          returned: 1,
          hasMore: true,
          nextOffset: 1,
        }),
        narrativePage: expect.objectContaining({
          limit: 2,
          returned: 2,
          hasMore: true,
          nextOffset: 2,
        }),
        decisionPage: expect.objectContaining({
          limit: 1,
          returned: 1,
          hasMore: true,
          nextOffset: 1,
        }),
      }),
    );

    const pagedHumanShowResult = await runCli(
      [
        "session",
        "show",
        sessions[0]!.id,
        "--message-limit",
        "2",
        "--trend-limit",
        "1",
        "--timeline-limit",
        "2",
        "--artifact-limit",
        "1",
        "--narrative-limit",
        "2",
        "--decision-limit",
        "1",
      ],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(pagedHumanShowResult.code).toBe(0);
    expect(pagedHumanShowResult.stdout).toContain(
      "Use --message-offset 2 to continue this transcript page.",
    );
    expect(pagedHumanShowResult.stdout).toContain(
      "Trend page: offset 0, limit 1, returned 1",
    );
    expect(pagedHumanShowResult.stdout).toContain(
      "Use --timeline-offset 2 to continue this timeline page.",
    );
    expect(pagedHumanShowResult.stdout).toContain(
      "Use --artifact-offset 1 to continue this artifact page.",
    );
    expect(pagedHumanShowResult.stdout).toContain(
      "Use --narrative-offset 2 to continue narrative highlights.",
    );
    expect(pagedHumanShowResult.stdout).toContain(
      "Use --decision-offset 1 to continue this decision page.",
    );

    const exportJsonResult = await runCli(
      [
        "session",
        "export",
        sessions[0]!.id,
        "--output-mode",
        "base64",
        "--json",
      ],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
          FOOTPRINT_EXPORT_DIR: tempDir,
        },
      },
    );
    expect(exportJsonResult.code).toBe(0);
    expect(JSON.parse(exportJsonResult.stdout)).toEqual(
      expect.objectContaining({
        sessionCount: 1,
        success: true,
        base64Data: expect.any(String),
        sessions: expect.arrayContaining([
          expect.objectContaining({
            id: sessions[0]!.id,
          }),
        ]),
      }),
    );

    const exportFileResult = await runCli(
      ["export-sessions", sessions[0]!.id, "--output-mode", "file"],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
          FOOTPRINT_EXPORT_DIR: tempDir,
        },
      },
    );
    expect(exportFileResult.code).toBe(0);
    expect(exportFileResult.stdout).toContain("Exported sessions: 1");
    const filenameLine = exportFileResult.stdout
      .split("\n")
      .find((line) => line.startsWith("Filename: "));
    expect(filenameLine).toBeDefined();
    expect(fs.existsSync(filenameLine!.replace("Filename: ", "").trim())).toBe(
      true,
    );

    const messagesResult = await runCli(
      ["get-session-messages", sessions[0]!.id, "--json"],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(messagesResult.code).toBe(0);
    expect(JSON.parse(messagesResult.stdout)).toEqual(
      expect.objectContaining({
        total: 3,
        page: expect.objectContaining({
          offset: 0,
          returned: 3,
          hasMore: false,
        }),
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: "ship pnpm test on src/app.ts",
          }),
        ]),
      }),
    );

    const pagedMessagesResult = await runCli(
      [
        "session",
        "messages",
        sessions[0]!.id,
        "--limit",
        "2",
        "--offset",
        "1",
        "--json",
      ],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(pagedMessagesResult.code).toBe(0);
    expect(JSON.parse(pagedMessagesResult.stdout)).toEqual(
      expect.objectContaining({
        total: 3,
        page: expect.objectContaining({
          offset: 1,
          limit: 2,
          returned: 2,
          hasMore: false,
          nextOffset: null,
        }),
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "assistant" }),
        ]),
      }),
    );

    const timelineResult = await runCli(
      ["session", "timeline", sessions[0]!.id, "--json"],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(timelineResult.code).toBe(0);
    const parsedTimelineResult = JSON.parse(timelineResult.stdout) as {
      timelineSummary: { total: number };
      page: { offset: number; returned: number };
      timeline: Array<{ eventType: string }>;
    };
    expect(parsedTimelineResult.timelineSummary.total).toBeGreaterThanOrEqual(
      5,
    );
    expect(parsedTimelineResult.page.offset).toBe(0);
    expect(
      parsedTimelineResult.timeline.map((event) => event.eventType),
    ).toContain("session.end");

    const artifactsResult = await runCli(
      ["get-session-artifacts", sessions[0]!.id, "--json"],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(artifactsResult.code).toBe(0);
    expect(JSON.parse(artifactsResult.stdout)).toEqual(
      expect.objectContaining({
        sessionId: sessions[0]!.id,
        artifactSummary: expect.objectContaining({
          total: expect.any(Number),
          byType: expect.objectContaining({
            commandOutput: expect.any(Number),
            testResult: expect.any(Number),
            fileChange: expect.any(Number),
          }),
        }),
        page: expect.objectContaining({
          offset: 0,
          returned: expect.any(Number),
          total: expect.any(Number),
        }),
        artifacts: expect.arrayContaining([
          expect.objectContaining({
            artifactType: "command-output",
            command: "pnpm",
            category: "test",
          }),
        ]),
      }),
    );

    const pagedArtifactsResult = await runCli(
      [
        "session",
        "artifacts",
        sessions[0]!.id,
        "--limit",
        "1",
        "--offset",
        "1",
        "--json",
      ],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(pagedArtifactsResult.code).toBe(0);
    expect(JSON.parse(pagedArtifactsResult.stdout)).toEqual(
      expect.objectContaining({
        sessionId: sessions[0]!.id,
        page: expect.objectContaining({
          offset: 1,
          limit: 1,
          returned: expect.any(Number),
        }),
      }),
    );

    const narrativesResult = await runCli(
      ["session", "narratives", sessions[0]!.id, "--json"],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(narrativesResult.code).toBe(0);
    expect(JSON.parse(narrativesResult.stdout)).toEqual(
      expect.objectContaining({
        sessionId: sessions[0]!.id,
        page: expect.objectContaining({
          total: 3,
          offset: 0,
          limit: 3,
          returned: 3,
          hasMore: false,
          nextOffset: null,
        }),
        narratives: expect.arrayContaining([
          expect.objectContaining({ kind: "journal" }),
          expect.objectContaining({ kind: "project-summary" }),
          expect.objectContaining({ kind: "handoff" }),
        ]),
      }),
    );

    const trendsResult = await runCli(
      ["session", "trends", sessions[0]!.id, "--limit", "1", "--json"],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(trendsResult.code).toBe(0);
    expect(JSON.parse(trendsResult.stdout)).toEqual(
      expect.objectContaining({
        sessionId: sessions[0]!.id,
        summary: expect.objectContaining({
          totalTrends: 1,
          crossSessionTrends: 0,
        }),
        page: expect.objectContaining({
          total: 1,
          offset: 0,
          limit: 1,
          returned: 1,
          hasMore: false,
          nextOffset: null,
        }),
        trends: expect.arrayContaining([
          expect.objectContaining({
            issueKey: expect.any(String),
          }),
        ]),
      }),
    );

    const decisionsResult = await runCli(
      ["get-session-decisions", sessions[0]!.id, "--json"],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(decisionsResult.code).toBe(0);
    expect(JSON.parse(decisionsResult.stdout)).toEqual(
      expect.objectContaining({
        sessionId: sessions[0]!.id,
        page: expect.objectContaining({
          total: 3,
          offset: 0,
          limit: 3,
          returned: 3,
          hasMore: false,
          nextOffset: null,
        }),
        decisions: expect.arrayContaining([
          expect.objectContaining({
            status: "accepted",
          }),
        ]),
      }),
    );

    const historySearchResult = await runCli(
      ["search-history", "command-output", "--json"],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(historySearchResult.code).toBe(0);
    expect(JSON.parse(historySearchResult.stdout)).toEqual(
      expect.objectContaining({
        query: "command-output",
        total: 1,
        results: expect.arrayContaining([
          expect.objectContaining({
            sessionId: sessions[0]!.id,
          }),
        ]),
      }),
    );
  }, 20_000);

  it("aggregates execution-backed history trends through CLI commands", async () => {
    const db = new EvidenceDatabase(dbPath);
    const firstSessionId = db.createSession({
      host: "claude",
      projectRoot: tempDir,
      cwd: tempDir,
      title: "Fix test failures",
      status: "completed",
      startedAt: "2026-03-09T10:00:00.000Z",
      endedAt: "2026-03-09T10:05:00.000Z",
      metadata: null,
    });
    db.appendTimelineEvent({
      sessionId: firstSessionId,
      seq: 1,
      eventType: "command.started",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm test",
      payload: JSON.stringify({ command: "pnpm", args: ["test"] }),
      startedAt: "2026-03-09T10:00:05.000Z",
      endedAt: "2026-03-09T10:00:05.000Z",
      status: "running",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId: firstSessionId,
      seq: 2,
      eventType: "command.completed",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm test",
      payload: JSON.stringify({ command: "pnpm", args: ["test"], exitCode: 1 }),
      startedAt: "2026-03-09T10:00:05.000Z",
      endedAt: "2026-03-09T10:00:15.000Z",
      status: "failed",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId: firstSessionId,
      seq: 3,
      eventType: "command.started",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm test",
      payload: JSON.stringify({ command: "pnpm", args: ["test"] }),
      startedAt: "2026-03-09T10:00:20.000Z",
      endedAt: "2026-03-09T10:00:20.000Z",
      status: "running",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId: firstSessionId,
      seq: 4,
      eventType: "command.completed",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm test",
      payload: JSON.stringify({ command: "pnpm", args: ["test"], exitCode: 0 }),
      startedAt: "2026-03-09T10:00:20.000Z",
      endedAt: "2026-03-09T10:00:30.000Z",
      status: "completed",
      relatedMessageId: null,
    });
    db.finalizeSession(firstSessionId, {
      status: "completed",
      endedAt: "2026-03-09T10:05:00.000Z",
      title: "Fix test failures",
    });

    const secondSessionId = db.createSession({
      host: "gemini",
      projectRoot: tempDir,
      cwd: tempDir,
      title: "Retry lint and test",
      status: "failed",
      startedAt: "2026-03-09T11:00:00.000Z",
      endedAt: "2026-03-09T11:03:00.000Z",
      metadata: null,
    });
    db.appendTimelineEvent({
      sessionId: secondSessionId,
      seq: 1,
      eventType: "command.started",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm test",
      payload: JSON.stringify({ command: "pnpm", args: ["test"] }),
      startedAt: "2026-03-09T11:00:05.000Z",
      endedAt: "2026-03-09T11:00:05.000Z",
      status: "running",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId: secondSessionId,
      seq: 2,
      eventType: "command.completed",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm test",
      payload: JSON.stringify({ command: "pnpm", args: ["test"], exitCode: 1 }),
      startedAt: "2026-03-09T11:00:05.000Z",
      endedAt: "2026-03-09T11:00:25.000Z",
      status: "failed",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId: secondSessionId,
      seq: 3,
      eventType: "command.started",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm lint",
      payload: JSON.stringify({ command: "pnpm", args: ["lint"] }),
      startedAt: "2026-03-09T11:00:30.000Z",
      endedAt: "2026-03-09T11:00:30.000Z",
      status: "running",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId: secondSessionId,
      seq: 4,
      eventType: "command.completed",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm lint",
      payload: JSON.stringify({ command: "pnpm", args: ["lint"], exitCode: 1 }),
      startedAt: "2026-03-09T11:00:30.000Z",
      endedAt: "2026-03-09T11:00:40.000Z",
      status: "failed",
      relatedMessageId: null,
    });
    db.finalizeSession(secondSessionId, {
      status: "failed",
      endedAt: "2026-03-09T11:03:00.000Z",
      title: "Retry lint and test",
    });
    db.close();

    const firstIngestResult = await runCli(
      ["session", "ingest", firstSessionId, "--json"],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(firstIngestResult.code).toBe(0);

    const secondIngestResult = await runCli(
      ["session", "ingest", secondSessionId, "--json"],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(secondIngestResult.code).toBe(0);

    const historyTrendsResult = await runCli(
      ["history", "trends", "--issue-key", "test:pnpm-test", "--json"],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(historyTrendsResult.code).toBe(0);
    expect(JSON.parse(historyTrendsResult.stdout)).toEqual(
      expect.objectContaining({
        filters: expect.objectContaining({
          issueKey: "test:pnpm-test",
        }),
        total: 1,
        summary: expect.objectContaining({
          totalTrends: 1,
          matchingSessions: 2,
          totalAttempts: 3,
        }),
        trends: expect.arrayContaining([
          expect.objectContaining({
            issueKey: "test:pnpm-test",
            sessionCount: 2,
            failedAttempts: 2,
            succeededAttempts: 1,
            hosts: ["claude", "gemini"],
          }),
        ]),
      }),
    );

    const historyTrendsAliasResult = await runCli(
      ["get-history-trends", "--query", "pnpm", "--host", "gemini", "--json"],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(historyTrendsAliasResult.code).toBe(0);
    expect(JSON.parse(historyTrendsAliasResult.stdout)).toEqual(
      expect.objectContaining({
        filters: expect.objectContaining({
          query: "pnpm",
          host: "gemini",
        }),
        total: 2,
        summary: expect.objectContaining({
          totalTrends: 2,
          matchingSessions: 1,
          totalAttempts: 2,
        }),
        trends: expect.arrayContaining([
          expect.objectContaining({
            issueKey: "test:pnpm-test",
            sessionCount: 1,
            hosts: ["gemini"],
          }),
          expect.objectContaining({
            issueKey: "lint:pnpm-lint",
            sessionCount: 1,
            hosts: ["gemini"],
          }),
        ]),
      }),
    );

    const historyFamilyResult = await runCli(
      [
        "history",
        "trends",
        "--group-by",
        "family",
        "--query",
        "tests",
        "--json",
      ],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(historyFamilyResult.code).toBe(0);
    expect(JSON.parse(historyFamilyResult.stdout)).toEqual(
      expect.objectContaining({
        filters: expect.objectContaining({
          query: "tests",
          groupBy: "family",
        }),
        total: 1,
        summary: expect.objectContaining({
          groupBy: "family",
          totalTrends: 1,
          matchingSessions: 2,
          totalAttempts: 3,
        }),
        trends: expect.arrayContaining([
          expect.objectContaining({
            groupBy: "family",
            issueKey: "test-family:pnpm",
            label: "pnpm tests",
            relatedIssueKeys: ["test:pnpm-test"],
            sessionCount: 2,
            hosts: ["claude", "gemini"],
          }),
        ]),
      }),
    );

    const historyHandoffResult = await runCli(
      ["history", "handoff", "--issue-key", "test:pnpm-test", "--json"],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(historyHandoffResult.code).toBe(0);
    expect(JSON.parse(historyHandoffResult.stdout)).toEqual(
      expect.objectContaining({
        filters: {
          query: undefined,
          issueKey: "test:pnpm-test",
          host: undefined,
          status: undefined,
        },
        summary: expect.objectContaining({
          groupBy: "issue",
          matchingSessions: 2,
          totalTrends: 1,
          blockingTrends: 1,
        }),
        blockers: [expect.stringContaining("test:pnpm-test: pnpm test")],
        markdown: expect.stringContaining("# History Handoff"),
      }),
    );

    const historyFamilyHandoffResult = await runCli(
      [
        "history",
        "handoff",
        "--query",
        "tests",
        "--group-by",
        "family",
        "--json",
      ],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(historyFamilyHandoffResult.code).toBe(0);
    expect(JSON.parse(historyFamilyHandoffResult.stdout)).toEqual(
      expect.objectContaining({
        filters: {
          query: "tests",
          issueKey: undefined,
          host: undefined,
          status: undefined,
          groupBy: "family",
        },
        summary: expect.objectContaining({
          groupBy: "family",
          matchingSessions: 2,
          totalTrends: 1,
          blockingTrends: 1,
        }),
        blockers: [expect.stringContaining("test-family:pnpm: pnpm tests")],
      }),
    );

    const filteredListResult = await runCli(
      [
        "sessions",
        "list",
        "--query",
        "retry",
        "--issue-key",
        "test:pnpm-test",
        "--host",
        "gemini",
        "--status",
        "failed",
        "--json",
      ],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(filteredListResult.code).toBe(0);
    expect(JSON.parse(filteredListResult.stdout)).toEqual(
      expect.objectContaining({
        filters: {
          query: "retry",
          issueKey: "test:pnpm-test",
          host: "gemini",
          status: "failed",
        },
        total: 1,
        sessions: [
          expect.objectContaining({
            id: secondSessionId,
            host: "gemini",
            status: "failed",
          }),
        ],
      }),
    );

    const filteredExportResult = await runCli(
      [
        "export-sessions",
        "--issue-key",
        "test:pnpm-test",
        "--host",
        "gemini",
        "--status",
        "failed",
        "--group-by",
        "family",
        "--output-mode",
        "base64",
        "--json",
      ],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
          FOOTPRINT_EXPORT_DIR: tempDir,
        },
      },
    );
    expect(filteredExportResult.code).toBe(0);
    expect(JSON.parse(filteredExportResult.stdout)).toEqual(
      expect.objectContaining({
        success: true,
        sessionCount: 1,
        historyGrouping: "family",
        filters: {
          issueKey: "test:pnpm-test",
          host: "gemini",
          status: "failed",
          groupBy: "family",
        },
        sessions: [
          expect.objectContaining({
            id: secondSessionId,
            host: "gemini",
            status: "failed",
          }),
        ],
        base64Data: expect.any(String),
      }),
    );
  });

  it("preserves a failed session with captured transcript and events", async () => {
    const runResult = await runCli(
      ["run", "claude", "--", fixturePath, "--fail"],
      {
        input: "retry later\n",
        env: {
          FOOTPRINT_DB_PATH: dbPath,
          FOOTPRINT_CLAUDE_COMMAND: process.execPath,
        },
      },
    );

    expect(runResult.code).toBe(7);
    expect(runResult.stderr).toContain("simulated failure");

    const db = new EvidenceDatabase(dbPath);
    const session = db.listSessions()[0];
    const detail = db.getSessionDetail(session!.id);

    expect(session?.status).toBe("failed");
    expect(detail?.messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
      "system",
    ]);
    expect(detail?.timeline.at(-1)?.status).toBe("failed");
    expect(detail?.timeline.at(-1)?.eventType).toBe("session.end");
    db.close();
  });

  it("records gemini and codex sessions without requiring adapters", async () => {
    const geminiResult = await runCli(["run", "gemini", "--", fixturePath], {
      input: "gemini prompt\n",
      env: {
        FOOTPRINT_DB_PATH: dbPath,
        FOOTPRINT_GEMINI_COMMAND: process.execPath,
      },
    });
    expect(geminiResult.code).toBe(0);

    const codexResult = await runCli(["run", "codex", "--", fixturePath], {
      input: "codex prompt\n",
      env: {
        FOOTPRINT_DB_PATH: dbPath,
        FOOTPRINT_CODEX_COMMAND: process.execPath,
      },
    });
    expect(codexResult.code).toBe(0);

    const db = new EvidenceDatabase(dbPath);
    const sessions = db.listSessions();
    expect(sessions.map((session) => session.host)).toEqual([
      "codex",
      "gemini",
    ]);
    for (const session of sessions) {
      const detail = db.getSessionDetail(session.id);
      expect(detail?.messages.length).toBeGreaterThan(0);
      expect(detail?.timeline[0]?.eventType).toBe("session.start");
      expect(detail?.timeline.some((event) => event.source !== "wrapper")).toBe(
        false,
      );
    }
    db.close();
  });

  it("stores Claude adapter events alongside wrapper events with source attribution", async () => {
    const runResult = await runCli(
      ["run", "claude", "--", fixturePath, "--emit-adapter"],
      {
        input: "adapter prompt\n",
        env: {
          FOOTPRINT_DB_PATH: dbPath,
          FOOTPRINT_CLAUDE_COMMAND: process.execPath,
        },
      },
    );

    expect(runResult.code).toBe(0);

    const db = new EvidenceDatabase(dbPath);
    const session = db.listSessions()[0];
    const detail = db.getSessionDetail(session!.id);
    const adapterEvents =
      detail?.timeline.filter((event) => event.source === "claude-adapter") ??
      [];

    expect(adapterEvents.length).toBeGreaterThan(0);
    expect(adapterEvents[0]?.eventType).toBe("tool.started");
    expect(adapterEvents[0]?.eventSubType).toBe("edit");
    expect(adapterEvents[0]?.summary).toContain("claude adapter event");
    expect(detail?.timeline.some((event) => event.source === "wrapper")).toBe(
      true,
    );
    db.close();
  });

  it("stores Gemini and Codex adapter events with host-specific attribution", async () => {
    const geminiResult = await runCli(
      ["run", "gemini", "--", fixturePath, "--emit-adapter"],
      {
        input: "gemini adapter prompt\n",
        env: {
          FOOTPRINT_DB_PATH: dbPath,
          FOOTPRINT_GEMINI_COMMAND: process.execPath,
        },
      },
    );
    expect(geminiResult.code).toBe(0);

    const codexResult = await runCli(
      ["run", "codex", "--", fixturePath, "--emit-adapter"],
      {
        input: "codex adapter prompt\n",
        env: {
          FOOTPRINT_DB_PATH: dbPath,
          FOOTPRINT_CODEX_COMMAND: process.execPath,
        },
      },
    );
    expect(codexResult.code).toBe(0);

    const db = new EvidenceDatabase(dbPath);
    const sessions = db.listSessions();
    const geminiDetail = db.getSessionDetail(
      sessions.find((session) => session.host === "gemini")!.id,
    );
    const codexDetail = db.getSessionDetail(
      sessions.find((session) => session.host === "codex")!.id,
    );
    const geminiAdapterEvents =
      geminiDetail?.timeline.filter(
        (event) => event.source === "gemini-adapter",
      ) ?? [];
    const codexAdapterEvents =
      codexDetail?.timeline.filter(
        (event) => event.source === "codex-adapter",
      ) ?? [];

    expect(geminiAdapterEvents.length).toBeGreaterThan(0);
    expect(geminiAdapterEvents[0]?.eventType).toBe("tool.started");
    expect(geminiAdapterEvents[0]?.eventSubType).toBe("shell");
    expect(geminiAdapterEvents[0]?.summary).toContain("gemini adapter event");

    expect(codexAdapterEvents.length).toBeGreaterThan(0);
    expect(codexAdapterEvents[0]?.eventType).toBe("tool.started");
    expect(codexAdapterEvents[0]?.eventSubType).toBe("patch");
    expect(codexAdapterEvents[0]?.summary).toContain("codex adapter event");
    db.close();
  });

  it("captures file and git wrapper events from repository changes", async () => {
    const repoDir = fs.mkdtempSync(path.join(tempDir, "repo-"));
    fs.writeFileSync(path.join(repoDir, "notes.txt"), "seed\n", "utf8");
    const gitEnv = {
      ...process.env,
      GIT_AUTHOR_NAME: "Footprint Test",
      GIT_AUTHOR_EMAIL: "footprint@example.com",
      GIT_COMMITTER_NAME: "Footprint Test",
      GIT_COMMITTER_EMAIL: "footprint@example.com",
    };

    const execSync = (command: string[]) =>
      execFileSync("git", command, {
        cwd: repoDir,
        env: gitEnv,
        stdio: "ignore",
      });

    execSync(["init"]);
    execSync(["add", "notes.txt"]);
    execSync(["commit", "-m", "initial"]);

    const runResult = await runCli(
      ["run", "claude", "--", fixturePath, "--touch-file", "--commit"],
      {
        input: "git snapshot\n",
        cwd: repoDir,
        env: {
          FOOTPRINT_DB_PATH: dbPath,
          FOOTPRINT_CLAUDE_COMMAND: process.execPath,
          ...gitEnv,
        },
      },
    );

    expect(runResult.code).toBe(0);

    const db = new EvidenceDatabase(dbPath);
    const detail = db.getSessionDetail(db.listSessions()[0]!.id);
    expect(
      detail?.timeline.some((event) => event.eventType === "file.changed"),
    ).toBe(true);
    expect(
      detail?.timeline.some((event) => event.eventType === "git.commit"),
    ).toBe(true);
    db.close();
  });

  it("captures file changes even when the repository was already dirty", async () => {
    const repoDir = fs.mkdtempSync(path.join(tempDir, "dirty-repo-"));
    fs.writeFileSync(path.join(repoDir, "notes.txt"), "seed\n", "utf8");
    const gitEnv = {
      ...process.env,
      GIT_AUTHOR_NAME: "Footprint Test",
      GIT_AUTHOR_EMAIL: "footprint@example.com",
      GIT_COMMITTER_NAME: "Footprint Test",
      GIT_COMMITTER_EMAIL: "footprint@example.com",
    };

    const execSync = (command: string[]) =>
      execFileSync("git", command, {
        cwd: repoDir,
        env: gitEnv,
        stdio: "ignore",
      });

    execSync(["init"]);
    execSync(["add", "notes.txt"]);
    execSync(["commit", "-m", "initial"]);
    fs.appendFileSync(
      path.join(repoDir, "notes.txt"),
      "preexisting dirty\n",
      "utf8",
    );

    const runResult = await runCli(
      ["run", "claude", "--", fixturePath, "--touch-file"],
      {
        input: "dirty snapshot\n",
        cwd: repoDir,
        env: {
          FOOTPRINT_DB_PATH: dbPath,
          FOOTPRINT_CLAUDE_COMMAND: process.execPath,
          ...gitEnv,
        },
      },
    );

    expect(runResult.code).toBe(0);

    const db = new EvidenceDatabase(dbPath);
    const detail = db.getSessionDetail(db.listSessions()[0]!.id);
    const fileEvent = detail?.timeline.find(
      (event) => event.eventType === "file.changed",
    );

    expect(fileEvent).toBeDefined();
    expect(fileEvent?.summary).toContain("notes.txt");

    const payload = JSON.parse(fileEvent?.payload ?? "{}") as {
      beforeStatus?: string | null;
      afterStatus?: string | null;
      beforeFingerprint?: string | null;
      afterFingerprint?: string | null;
    };
    expect(payload.beforeStatus).toBe("M");
    expect(payload.afterStatus).toBe("M");
    expect(payload.beforeFingerprint).not.toBe(payload.afterFingerprint);
    db.close();
  });

  it("rejects reingest attempts for running sessions", async () => {
    const db = new EvidenceDatabase(dbPath);
    const sessionId = db.createSession({
      host: "claude",
      projectRoot: tempDir,
      cwd: tempDir,
      title: "Still running",
      status: "running",
      startedAt: "2026-03-10T00:00:00.000Z",
      endedAt: null,
      metadata: null,
    });
    db.close();

    const ingestResult = await runCli(["session", "ingest", sessionId], {
      env: {
        FOOTPRINT_DB_PATH: dbPath,
      },
    });

    expect(ingestResult.code).toBe(1);
    expect(ingestResult.stderr).toContain(
      "Session is still running and cannot be reingested yet",
    );
  });

  it("records platform-specific forced PTY behavior when stdin is not a tty", async () => {
    const runResult = await runCli(["run", "claude", "--", fixturePath], {
      input: "forced fallback\n",
      env: {
        FOOTPRINT_DB_PATH: dbPath,
        FOOTPRINT_CLAUDE_COMMAND: process.execPath,
        FOOTPRINT_PTY_MODE: "force",
      },
    });

    expect(runResult.code).toBe(0);

    const db = new EvidenceDatabase(dbPath);
    const detail = db.getSessionDetail(db.listSessions()[0]!.id);
    const sessionMetadata = JSON.parse(detail?.session.metadata ?? "{}") as {
      transport?: string;
      ptyDriver?: string | null;
      ptyTranscriptFormat?: string | null;
      ptyStdinMode?: string | null;
      fallbackReason?: string | null;
    };
    const sessionStartPayload = JSON.parse(
      detail?.timeline.find((event) => event.eventType === "session.start")
        ?.payload ?? "{}",
    ) as {
      transport?: string;
      ptyDriver?: string | null;
      ptyTranscriptFormat?: string | null;
      ptyStdinMode?: string | null;
      fallbackReason?: string | null;
    };

    if (
      process.platform === "darwin" ||
      process.platform === "freebsd" ||
      process.platform === "openbsd"
    ) {
      expect(sessionMetadata.transport).toBe("pipe");
      expect(sessionMetadata.ptyTranscriptFormat).toBeNull();
      expect(sessionMetadata.ptyStdinMode).toBeNull();
      expect(sessionMetadata.fallbackReason).toBe("pty-requires-tty-stdin");
      expect(sessionStartPayload.transport).toBe("pipe");
      expect(sessionStartPayload.ptyTranscriptFormat).toBeNull();
      expect(sessionStartPayload.ptyStdinMode).toBeNull();
      expect(sessionStartPayload.fallbackReason).toBe("pty-requires-tty-stdin");
      db.close();
      return;
    }

    expect(sessionMetadata.transport).toBe("pty");
    expect(sessionMetadata.ptyDriver).toBe("script");
    expect(sessionMetadata.ptyStdinMode).toBe("pipe");
    expect(sessionMetadata.fallbackReason).toBeNull();
    expect(sessionStartPayload.transport).toBe("pty");
    expect(sessionStartPayload.ptyDriver).toBe("script");
    expect(sessionStartPayload.ptyStdinMode).toBe("pipe");
    expect(sessionStartPayload.fallbackReason).toBeNull();
    db.close();
  });

  it("supports context resolve, confirm, show, and activate commands", async () => {
    const db = new EvidenceDatabase(dbPath);
    const authSession = db.createSession({
      host: "claude",
      projectRoot: tempDir,
      cwd: tempDir,
      title: "Investigate auth timeout",
      status: "completed",
      startedAt: "2026-03-12T00:00:00.000Z",
      endedAt: "2026-03-12T00:03:00.000Z",
      metadata: null,
    });
    db.createArtifact({
      sessionId: authSession,
      eventId: null,
      artifactType: "command-output",
      path: null,
      metadata: JSON.stringify({
        summary: "pnpm test auth/login.spec.ts",
        category: "test",
        intent: "test",
        status: "failed",
        outcome: "failed",
        issueKey: "test:auth-timeout",
        issueLabel: "auth timeout",
        issueFamilyKey: "family:auth-timeout",
        issueFamilyLabel: "auth timeout family",
      }),
    });
    db.replaceNarrativesForSession(authSession, [
      {
        sessionId: authSession,
        kind: "handoff",
        content: "Continue auth timeout mitigation.",
        sourceRefs: "[]",
      },
    ]);
    const authContext = db.createContext({
      label: "Auth timeout context",
      workspaceKey: tempDir,
      metadata: null,
    });
    db.assignSessionToContext({
      sessionId: authSession,
      contextId: authContext.id,
      linkSource: "bootstrap",
    });

    const candidateSession = db.createSession({
      host: "codex",
      projectRoot: tempDir,
      cwd: tempDir,
      title: "Continue auth timeout fix",
      status: "completed",
      startedAt: "2026-03-12T01:00:00.000Z",
      endedAt: "2026-03-12T01:04:00.000Z",
      metadata: null,
    });
    db.createArtifact({
      sessionId: candidateSession,
      eventId: null,
      artifactType: "command-output",
      path: null,
      metadata: JSON.stringify({
        summary: "pnpm test auth/login.spec.ts",
        category: "test",
        intent: "test",
        status: "failed",
        outcome: "failed",
        issueKey: "test:auth-timeout",
        issueLabel: "auth timeout",
        issueFamilyKey: "family:auth-timeout",
        issueFamilyLabel: "auth timeout family",
      }),
    });
    db.close();

    const resolveResult = await runCli(
      ["context", "resolve", "--session", candidateSession, "--json"],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(resolveResult.code).toBe(0);
    expect(JSON.parse(resolveResult.stdout)).toEqual(
      expect.objectContaining({
        mode: "suggested",
        candidates: expect.arrayContaining([
          expect.objectContaining({
            contextId: authContext.id,
          }),
        ]),
      }),
    );

    const confirmResult = await runCli(
      [
        "context",
        "confirm",
        candidateSession,
        "--context",
        authContext.id,
        "--json",
      ],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(confirmResult.code).toBe(0);
    expect(JSON.parse(confirmResult.stdout)).toEqual(
      expect.objectContaining({
        action: "confirmed",
        contextId: authContext.id,
        affectedSessionIds: [candidateSession],
      }),
    );

    const showResult = await runCli(
      ["context", "show", authContext.id, "--json"],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(showResult.code).toBe(0);
    expect(JSON.parse(showResult.stdout)).toEqual(
      expect.objectContaining({
        context: expect.objectContaining({
          id: authContext.id,
          sessionCount: 2,
        }),
      }),
    );

    const activateResult = await runCli(
      ["context", "activate", authContext.id, "--cwd", tempDir, "--json"],
      {
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(activateResult.code).toBe(0);
    expect(JSON.parse(activateResult.stdout)).toEqual(
      expect.objectContaining({
        action: "preferred",
        contextId: authContext.id,
      }),
    );
  });

  it("supports interactive context prepare and run preflight", async () => {
    const db = new EvidenceDatabase(dbPath);
    const priorSession = db.createSession({
      host: "claude",
      projectRoot: tempDir,
      cwd: tempDir,
      title: "Investigate auth timeout",
      status: "completed",
      startedAt: "2026-03-12T00:00:00.000Z",
      endedAt: "2026-03-12T00:03:00.000Z",
      metadata: null,
    });
    db.createArtifact({
      sessionId: priorSession,
      eventId: null,
      artifactType: "command-output",
      path: null,
      metadata: JSON.stringify({
        summary: "pnpm test auth/login.spec.ts",
        category: "test",
        intent: "test",
        status: "failed",
        outcome: "failed",
        issueKey: "test:auth-timeout",
        issueLabel: "auth timeout",
        issueFamilyKey: "family:auth-timeout",
        issueFamilyLabel: "auth timeout family",
      }),
    });
    db.replaceNarrativesForSession(priorSession, [
      {
        sessionId: priorSession,
        kind: "handoff",
        content: "Continue auth timeout mitigation.",
        sourceRefs: "[]",
      },
    ]);
    const authContext = db.createContext({
      label: "Auth timeout context",
      workspaceKey: tempDir,
      metadata: null,
    });
    db.assignSessionToContext({
      sessionId: priorSession,
      contextId: authContext.id,
      linkSource: "bootstrap",
    });

    const candidateSession = db.createSession({
      host: "codex",
      projectRoot: tempDir,
      cwd: tempDir,
      title: "Continue auth timeout fix",
      status: "completed",
      startedAt: "2026-03-12T01:00:00.000Z",
      endedAt: "2026-03-12T01:04:00.000Z",
      metadata: null,
    });
    db.createArtifact({
      sessionId: candidateSession,
      eventId: null,
      artifactType: "command-output",
      path: null,
      metadata: JSON.stringify({
        summary: "pnpm test auth/login.spec.ts",
        category: "test",
        intent: "test",
        status: "failed",
        outcome: "failed",
        issueKey: "test:auth-timeout",
        issueLabel: "auth timeout",
        issueFamilyKey: "family:auth-timeout",
        issueFamilyLabel: "auth timeout family",
      }),
    });
    db.close();

    const prepareResult = await runCli(
      [
        "context",
        "prepare",
        "--session",
        candidateSession,
        "--interactive",
        "--json",
      ],
      {
        input: "1\n",
        env: {
          FOOTPRINT_DB_PATH: dbPath,
        },
      },
    );
    expect(prepareResult.code).toBe(0);
    expect(JSON.parse(prepareResult.stdout)).toEqual(
      expect.objectContaining({
        action: "confirmed",
        contextId: authContext.id,
        report: expect.objectContaining({
          context: expect.objectContaining({
            id: authContext.id,
            sessionCount: 2,
          }),
        }),
      }),
    );

    const runResult = await runCli(
      [
        "run",
        "claude",
        "--prepare-context",
        "--interactive-context",
        "--context-title",
        "Continue auth timeout retries",
        "--",
        fixturePath,
      ],
      {
        input: "1\ncontinue auth timeout retries\n",
        cwd: tempDir,
        env: {
          FOOTPRINT_DB_PATH: dbPath,
          FOOTPRINT_CLAUDE_COMMAND: process.execPath,
        },
      },
    );
    expect(runResult.code).toBe(0);
    expect(runResult.stderr).toContain("Context mode: suggested");
    expect(runResult.stderr).toContain("Context Briefing:");

    const afterRunDb = new EvidenceDatabase(dbPath);
    const latestSession = afterRunDb
      .listSessions()
      .find((session) => session.title === "Continue auth timeout retries");
    expect(latestSession?.status).toBe("completed");
    const latestLink = latestSession
      ? afterRunDb.findContextLinkForSession(latestSession.id)
      : null;
    expect(latestLink?.contextId).toBe(authContext.id);
    const detail = latestSession
      ? afterRunDb.getSessionDetail(latestSession.id)
      : null;
    expect(detail?.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: "context.resolved" }),
        expect.objectContaining({
          eventType: "context.updated",
          summary: "Context action: confirmed",
        }),
      ]),
    );
    afterRunDb.close();
  });

  it("does not auto-link non-interactive runs to a preferred context without semantic evidence", async () => {
    const db = new EvidenceDatabase(dbPath);
    const priorSession = db.createSession({
      host: "claude",
      projectRoot: tempDir,
      cwd: tempDir,
      title: "Investigate auth timeout",
      status: "completed",
      startedAt: "2026-03-12T00:00:00.000Z",
      endedAt: "2026-03-12T00:03:00.000Z",
      metadata: null,
    });
    db.createArtifact({
      sessionId: priorSession,
      eventId: null,
      artifactType: "command-output",
      path: null,
      metadata: JSON.stringify({
        summary: "pnpm test auth/login.spec.ts",
        category: "test",
        intent: "test",
        status: "failed",
        outcome: "failed",
        issueKey: "test:auth-timeout",
        issueLabel: "auth timeout",
        issueFamilyKey: "family:auth-timeout",
        issueFamilyLabel: "auth timeout family",
      }),
    });
    const authContext = db.createContext({
      label: "Auth timeout context",
      workspaceKey: tempDir,
      metadata: null,
    });
    db.assignSessionToContext({
      sessionId: priorSession,
      contextId: authContext.id,
      linkSource: "bootstrap",
    });
    db.setWorkspacePreferredContext(tempDir, authContext.id);
    db.close();

    const runResult = await runCli(
      [
        "run",
        "claude",
        "--prepare-context",
        "--context-title",
        "Investigate billing export bug",
        "--",
        fixturePath,
      ],
      {
        input: "investigate billing export bug\n",
        cwd: tempDir,
        env: {
          FOOTPRINT_DB_PATH: dbPath,
          FOOTPRINT_CLAUDE_COMMAND: process.execPath,
        },
      },
    );
    expect(runResult.code).toBe(0);
    expect(runResult.stderr).toContain("Context mode: suggested");
    expect(runResult.stderr).toContain("Confirmation required: yes");

    const afterRunDb = new EvidenceDatabase(dbPath);
    const latestSession = afterRunDb
      .listSessions()
      .find((session) => session.id !== priorSession);
    expect(latestSession?.status).toBe("completed");
    expect(
      latestSession
        ? afterRunDb.findContextLinkForSession(latestSession.id)
        : null,
    ).toBeNull();
    const detail = latestSession
      ? afterRunDb.getSessionDetail(latestSession.id)
      : null;
    expect(detail?.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "context.resolved",
          status: "skipped",
        }),
      ]),
    );
    expect(
      detail?.timeline.some((event) => event.eventType === "context.updated"),
    ).toBe(false);
    afterRunDb.close();
  });

  it("links suggested related sessions when run preflight creates a new context", async () => {
    const db = new EvidenceDatabase(dbPath);
    const relatedSession = db.createSession({
      host: "codex",
      projectRoot: tempDir,
      cwd: tempDir,
      title: "Continue auth timeout fix",
      status: "completed",
      startedAt: "2026-03-12T01:00:00.000Z",
      endedAt: "2026-03-12T01:04:00.000Z",
      metadata: null,
    });
    db.createArtifact({
      sessionId: relatedSession,
      eventId: null,
      artifactType: "command-output",
      path: null,
      metadata: JSON.stringify({
        summary: "pnpm test auth/login.spec.ts",
        category: "test",
        intent: "test",
        status: "failed",
        outcome: "failed",
        issueKey: "test:auth-timeout",
        issueLabel: "auth timeout",
        issueFamilyKey: "family:auth-timeout",
        issueFamilyLabel: "auth timeout family",
      }),
    });
    db.replaceNarrativesForSession(relatedSession, [
      {
        sessionId: relatedSession,
        kind: "handoff",
        content: "Continue auth timeout mitigation.",
        sourceRefs: "[]",
      },
    ]);
    db.close();

    const runResult = await runCli(
      [
        "run",
        "claude",
        "--prepare-context",
        "--interactive-context",
        "--context-title",
        "Continue auth timeout retries",
        "--",
        fixturePath,
      ],
      {
        input: "1\ncontinue auth timeout retries\n",
        cwd: tempDir,
        env: {
          FOOTPRINT_DB_PATH: dbPath,
          FOOTPRINT_CLAUDE_COMMAND: process.execPath,
        },
      },
    );
    expect(runResult.code).toBe(0);
    expect(runResult.stderr).toContain("Context mode: suggested");
    expect(runResult.stderr).toContain(
      "Will create a new canonical context from the suggested related sessions.",
    );

    const afterRunDb = new EvidenceDatabase(dbPath);
    const latestSession = afterRunDb
      .listSessions()
      .find((session) => session.title === "Continue auth timeout retries");
    const latestLink = latestSession
      ? afterRunDb.findContextLinkForSession(latestSession.id)
      : null;
    expect(latestLink?.contextId).toBeTruthy();
    const linkedSessions = latestLink?.contextId
      ? afterRunDb.listSessionsForContext(latestLink.contextId)
      : [];
    expect(linkedSessions.map((session) => session.id)).toEqual(
      expect.arrayContaining([relatedSession, latestSession!.id]),
    );
    const detail = latestSession
      ? afterRunDb.getSessionDetail(latestSession.id)
      : null;
    expect(detail?.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventType: "context.updated",
          summary: "Context action: create-new",
        }),
      ]),
    );
    afterRunDb.close();
  });
});
