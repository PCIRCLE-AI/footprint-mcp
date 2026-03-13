import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { FootprintServer } from "../src/index.js";
import { EvidenceDatabase } from "../src/lib/storage/index.js";
import { FootprintTestHelpers } from "./test-helpers.js";
import type { ServerConfig } from "../src/types.js";

describe("Context Tools", () => {
  let tempDir: string;
  let dbPath: string;
  let server: FootprintServer;
  let helpers: FootprintTestHelpers;
  let authContextId: string;
  let uiContextId: string;
  let authSessionOne: string;
  let authSessionTwo: string;
  let uiSession: string;
  let candidateSession: string;
  let ambiguousSession: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), "footprint-context-tools-"));
    dbPath = path.join(tempDir, "footprint.db");

    const seedDb = new EvidenceDatabase(dbPath);
    authSessionOne = seedDb.createSession({
      host: "claude",
      projectRoot: tempDir,
      cwd: tempDir,
      title: "Investigate login timeout",
      status: "completed",
      startedAt: "2026-03-11T08:00:00.000Z",
      endedAt: "2026-03-11T08:08:00.000Z",
      metadata: null,
    });
    seedDb.createArtifact({
      sessionId: authSessionOne,
      eventId: null,
      artifactType: "command-output",
      path: null,
      metadata: JSON.stringify({
        summary: "pnpm test auth/login.spec.ts",
        category: "test",
        intent: "test",
        status: "failed",
        outcome: "failed",
        issueKey: "test:auth-login-timeout",
        issueLabel: "auth login timeout",
        issueFamilyKey: "family:auth-timeout",
        issueFamilyLabel: "auth timeout family",
      }),
    });
    seedDb.replaceNarrativesForSession(authSessionOne, [
      {
        sessionId: authSessionOne,
        kind: "project-summary",
        content: "Current direction: stabilize login timeout handling.",
        sourceRefs: "[]",
      },
      {
        sessionId: authSessionOne,
        kind: "handoff",
        content: "Continue validating auth timeout retries.",
        sourceRefs: "[]",
      },
    ]);
    seedDb.replaceDecisionsForSession(authSessionOne, [
      {
        sessionId: authSessionOne,
        title: "Cap auth retry attempts at three",
        summary: "Use retry cap of three to keep failures deterministic.",
        rationale: "Avoid unbounded retries in login recovery.",
        status: "accepted",
        sourceRefs: "[]",
      },
    ]);

    authSessionTwo = seedDb.createSession({
      host: "codex",
      projectRoot: tempDir,
      cwd: tempDir,
      title: "Retry login timeout fix",
      status: "completed",
      startedAt: "2026-03-11T09:00:00.000Z",
      endedAt: "2026-03-11T09:05:00.000Z",
      metadata: null,
    });
    seedDb.createArtifact({
      sessionId: authSessionTwo,
      eventId: null,
      artifactType: "command-output",
      path: null,
      metadata: JSON.stringify({
        summary: "pnpm test auth/login.spec.ts",
        category: "test",
        intent: "test",
        status: "completed",
        outcome: "completed",
        issueKey: "test:auth-login-timeout",
        issueLabel: "auth login timeout",
        issueFamilyKey: "family:auth-timeout",
        issueFamilyLabel: "auth timeout family",
      }),
    });
    seedDb.replaceDecisionsForSession(authSessionTwo, [
      {
        sessionId: authSessionTwo,
        title: "Cap auth retry attempts at three",
        summary: "Keep retry cap at three and treat later retries as failure.",
        rationale: "Preserve consistent failure handling.",
        status: "accepted",
        sourceRefs: "[]",
      },
    ]);

    uiSession = seedDb.createSession({
      host: "gemini",
      projectRoot: tempDir,
      cwd: tempDir,
      title: "Add dashboard filter chips",
      status: "completed",
      startedAt: "2026-03-11T10:00:00.000Z",
      endedAt: "2026-03-11T10:04:00.000Z",
      metadata: null,
    });
    seedDb.createArtifact({
      sessionId: uiSession,
      eventId: null,
      artifactType: "file-change",
      path: "ui/src/session-dashboard-view.ts",
      metadata: JSON.stringify({
        summary: "add filter chips",
        category: "file",
        issueKey: "ui:dashboard-filters",
        issueLabel: "dashboard filters",
        issueFamilyKey: "family:ui-dashboard",
        issueFamilyLabel: "dashboard ui family",
      }),
    });

    candidateSession = seedDb.createSession({
      host: "claude",
      projectRoot: tempDir,
      cwd: tempDir,
      title: "Continue auth timeout retries",
      status: "completed",
      startedAt: "2026-03-11T11:00:00.000Z",
      endedAt: "2026-03-11T11:06:00.000Z",
      metadata: null,
    });
    seedDb.createArtifact({
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
        issueKey: "test:auth-login-timeout",
        issueLabel: "auth login timeout",
        issueFamilyKey: "family:auth-timeout",
        issueFamilyLabel: "auth timeout family",
      }),
    });

    ambiguousSession = seedDb.createSession({
      host: "claude",
      projectRoot: tempDir,
      cwd: tempDir,
      title: "Investigate metrics drift",
      status: "completed",
      startedAt: "2026-03-11T12:00:00.000Z",
      endedAt: "2026-03-11T12:03:00.000Z",
      metadata: null,
    });

    const authContext = seedDb.createContext({
      label: "Auth timeout workstream",
      workspaceKey: tempDir,
      metadata: null,
    });
    authContextId = authContext.id;
    seedDb.assignSessionToContext({
      sessionId: authSessionOne,
      contextId: authContext.id,
      linkSource: "bootstrap",
    });
    seedDb.assignSessionToContext({
      sessionId: authSessionTwo,
      contextId: authContext.id,
      linkSource: "bootstrap",
    });
    seedDb.setWorkspacePreferredContext(tempDir, authContext.id);

    const secondContext = seedDb.createContext({
      label: "Dashboard UI workstream",
      workspaceKey: tempDir,
      metadata: null,
    });
    uiContextId = secondContext.id;
    seedDb.assignSessionToContext({
      sessionId: uiSession,
      contextId: secondContext.id,
      linkSource: "bootstrap",
    });
    seedDb.close();

    server = new FootprintServer({
      dbPath,
      password: "context-tools-password",
    } satisfies ServerConfig);
    helpers = new FootprintTestHelpers(server);
  });

  afterEach(() => {
    server.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it("registers context tools", async () => {
    const tools = await helpers.getTools();

    expect(tools).toContainEqual(
      expect.objectContaining({ name: "list-contexts" }),
    );
    expect(tools).toContainEqual(
      expect.objectContaining({ name: "get-context" }),
    );
    expect(tools).toContainEqual(
      expect.objectContaining({ name: "resolve-context" }),
    );
    expect(tools).toContainEqual(
      expect.objectContaining({ name: "confirm-context-link" }),
    );
    expect(tools).toContainEqual(
      expect.objectContaining({ name: "move-session-context" }),
    );
    expect(tools).toContainEqual(
      expect.objectContaining({ name: "merge-contexts" }),
    );
    expect(tools).toContainEqual(
      expect.objectContaining({ name: "split-context" }),
    );
    expect(tools).toContainEqual(
      expect.objectContaining({ name: "set-active-context" }),
    );
  });

  it("resolves related sessions conservatively and returns a context briefing", async () => {
    const related = await helpers.callTool("resolve-context", {
      sessionId: candidateSession,
    });
    expect(related.structuredContent).toEqual(
      expect.objectContaining({
        mode: "suggested",
        confirmationRequired: true,
        recommendedAction: "confirm-existing",
        briefing: expect.objectContaining({
          context: expect.objectContaining({
            id: authContextId,
            label: "Auth timeout workstream",
          }),
        }),
        candidates: expect.arrayContaining([
          expect.objectContaining({
            kind: "existing-context",
            contextId: authContextId,
          }),
        ]),
      }),
    );

    const unrelated = await helpers.callTool("resolve-context", {
      sessionId: ambiguousSession,
    });
    expect(unrelated.structuredContent).toEqual(
      expect.objectContaining({
        confirmationRequired: true,
        recommendedAction: "create-new-context",
      }),
    );

    await helpers.callTool("set-active-context", {
      contextId: authContextId,
      cwd: tempDir,
    });

    const preferredMismatch = await helpers.callTool("resolve-context", {
      cwd: tempDir,
      title: "Investigate billing export bug",
      host: "claude",
    });
    expect(preferredMismatch.structuredContent).toEqual(
      expect.objectContaining({
        mode: "suggested",
        confirmationRequired: true,
        recommendedAction: "choose-candidate",
        currentContext: null,
        candidates: expect.arrayContaining([
          expect.objectContaining({
            contextId: authContextId,
            preferred: true,
          }),
        ]),
      }),
    );

    await helpers.callTool("reject-context-link", {
      sessionId: candidateSession,
      contextId: authContextId,
    });
    const afterReject = await helpers.callTool("resolve-context", {
      sessionId: candidateSession,
    });
    expect(afterReject.structuredContent).toEqual(
      expect.objectContaining({
        confirmationRequired: true,
        recommendedAction: "create-new-context",
      }),
    );
    expect(
      (
        afterReject.structuredContent as {
          candidates?: Array<{ contextId?: string | null }>;
        }
      ).candidates?.some((candidate) => candidate.contextId === authContextId),
    ).toBe(false);
  });

  it("supports confirm, reject, move, split, merge, and preferred context flows", async () => {
    const confirmResult = await helpers.callTool("confirm-context-link", {
      sessionIds: [candidateSession],
      contextId: authContextId,
    });
    expect(confirmResult.structuredContent).toEqual(
      expect.objectContaining({
        action: "confirmed",
        contextId: authContextId,
        affectedSessionIds: [candidateSession],
      }),
    );

    const authReport = await helpers.callTool("get-context", {
      id: authContextId,
    });
    expect(authReport.structuredContent).toEqual(
      expect.objectContaining({
        context: expect.objectContaining({
          id: authContextId,
          sessionCount: 3,
        }),
        currentTruth: expect.objectContaining({
          summary: expect.stringContaining("auth timeout"),
        }),
        activeDecisions: expect.arrayContaining([
          expect.objectContaining({
            title: "Cap auth retry attempts at three",
          }),
        ]),
        supersededDecisions: expect.arrayContaining([
          expect.objectContaining({
            title: "Cap auth retry attempts at three",
            supersededByDecisionId: expect.any(String),
          }),
        ]),
      }),
    );
    const authStructured = authReport.structuredContent as {
      activeDecisions: Array<{ sessionId: string }>;
      supersededDecisions: Array<{ sessionId: string }>;
    };
    expect(authStructured.activeDecisions).toHaveLength(1);
    expect(authStructured.supersededDecisions).toHaveLength(1);
    expect([authSessionOne, authSessionTwo]).toContain(
      authStructured.activeDecisions[0]?.sessionId,
    );
    expect([authSessionOne, authSessionTwo]).toContain(
      authStructured.supersededDecisions[0]?.sessionId,
    );
    expect(authStructured.activeDecisions[0]?.sessionId).not.toBe(
      authStructured.supersededDecisions[0]?.sessionId,
    );

    const rejectResult = await helpers.callTool("reject-context-link", {
      sessionId: ambiguousSession,
      contextId: authContextId,
    });
    expect(rejectResult.structuredContent).toEqual(
      expect.objectContaining({
        action: "rejected",
        contextId: authContextId,
      }),
    );

    const moved = await helpers.callTool("move-session-context", {
      sessionId: uiSession,
      contextId: authContextId,
    });
    expect(moved.structuredContent).toEqual(
      expect.objectContaining({
        action: "moved",
        contextId: authContextId,
      }),
    );

    const split = await helpers.callTool("split-context", {
      contextId: authContextId,
      sessionIds: [uiSession],
      label: "Recovered dashboard UI thread",
    });
    const splitContextId = split.structuredContent.contextId as string;
    expect(split.structuredContent).toEqual(
      expect.objectContaining({
        action: "split",
        contextId: expect.any(String),
        affectedSessionIds: [uiSession],
      }),
    );

    const preferred = await helpers.callTool("set-active-context", {
      contextId: splitContextId,
      cwd: tempDir,
    });
    expect(preferred.structuredContent).toEqual(
      expect.objectContaining({
        action: "preferred",
        contextId: splitContextId,
      }),
    );

    const resolveByCwd = await helpers.callTool("resolve-context", {
      cwd: tempDir,
      title: "Resume dashboard filter work",
    });
    expect(resolveByCwd.structuredContent).toEqual(
      expect.objectContaining({
        mode: "preferred",
        currentContext: expect.objectContaining({
          id: splitContextId,
        }),
      }),
    );

    const merge = await helpers.callTool("merge-contexts", {
      sourceContextId: splitContextId,
      targetContextId: uiContextId,
    });
    expect(merge.structuredContent).toEqual(
      expect.objectContaining({
        action: "merged",
        mergedFromContextId: splitContextId,
        contextId: uiContextId,
      }),
    );

    const resolveAfterMerge = await helpers.callTool("resolve-context", {
      cwd: tempDir,
      title: "Resume dashboard filter work",
    });
    expect(resolveAfterMerge.structuredContent).toEqual(
      expect.objectContaining({
        mode: "preferred",
        currentContext: expect.objectContaining({
          id: uiContextId,
        }),
      }),
    );
  });
});
