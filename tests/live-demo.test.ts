import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { EvidenceDatabase } from "../src/lib/storage/index.js";
import {
  createLiveDemoBackend,
  type LiveDemoBackend,
} from "../src/cli/live-demo.js";

describe("Live demo server", () => {
  let tempDir: string;
  let dbPath: string;
  let uiDistDir: string;
  let sessionId: string;
  let backend: LiveDemoBackend | null = null;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), "footprint-live-demo-"));
    dbPath = path.join(tempDir, "footprint.db");
    uiDistDir = path.join(tempDir, "ui");
    fs.mkdirSync(uiDistDir);
    fs.writeFileSync(
      path.join(uiDistDir, "session-dashboard-live.html"),
      "<!doctype html><title>Dashboard</title><body>dashboard</body>",
      "utf8",
    );
    fs.writeFileSync(
      path.join(uiDistDir, "session-detail-live.html"),
      "<!doctype html><title>Detail</title><body>detail</body>",
      "utf8",
    );

    const db = new EvidenceDatabase(dbPath);
    sessionId = db.createSession({
      host: "claude",
      projectRoot: tempDir,
      cwd: tempDir,
      title: "Live demo session",
      status: "completed",
      startedAt: "2026-03-12T09:00:00.000Z",
      endedAt: "2026-03-12T09:05:00.000Z",
      metadata: JSON.stringify({ command: "claude" }),
    });
    db.appendMessage({
      sessionId,
      seq: 1,
      role: "user",
      source: "wrapper",
      content: "Check the live demo",
      capturedAt: "2026-03-12T09:00:05.000Z",
      metadata: null,
    });
    db.close();
  });

  afterEach(async () => {
    await backend?.close();
    backend = null;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("serves live pages and proxies tool calls through a real MCP client", async () => {
    backend = await createLiveDemoBackend({
      dbPath,
      password: "demo-passphrase",
      uiDistDir,
    });

    const dashboardHtml = await backend.readHtml("session-dashboard-live.html");
    expect(dashboardHtml).toContain("dashboard");

    const detailHtml = await backend.readHtml("session-detail-live.html");
    expect(detailHtml).toContain("detail");

    const bootstrap = (await backend.bootstrap()) as {
      defaultSessionId: string | null;
      totalSessions: number;
    };
    expect(bootstrap.defaultSessionId).toBe(sessionId);
    expect(bootstrap.totalSessions).toBe(1);

    const toolResult = (await backend.callTool({
      name: "list-sessions",
      arguments: {},
    })) as {
      structuredContent?: {
        total?: number;
        sessions?: Array<{ id: string }>;
      };
    };
    expect(toolResult.structuredContent?.total).toBe(1);
    expect(toolResult.structuredContent?.sessions?.[0]?.id).toBe(sessionId);
  });
});
