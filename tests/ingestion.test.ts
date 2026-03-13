import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { reingestSessionHistory } from "../src/ingestion/index.js";
import { EvidenceDatabase } from "../src/lib/storage/index.js";

describe("Session Ingestion", () => {
  let tempDir: string;
  let dbPath: string;
  let db: EvidenceDatabase;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), "footprint-ingestion-"));
    dbPath = path.join(tempDir, "footprint.db");
    db = new EvidenceDatabase(dbPath);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function seedSession(): string {
    const sessionId = db.createSession({
      host: "claude",
      projectRoot: tempDir,
      cwd: tempDir,
      title: "Implement recorder ingestion",
      status: "completed",
      startedAt: "2026-03-09T10:00:00.000Z",
      endedAt: "2026-03-09T10:05:00.000Z",
      metadata: JSON.stringify({ command: "claude", args: ["--resume"] }),
    });

    const userMessageId = db.appendMessage({
      sessionId,
      seq: 1,
      role: "user",
      source: "wrapper",
      content:
        "We decided to use Vitest. Run pnpm test and update src/app.ts plus README.md",
      capturedAt: "2026-03-09T10:00:01.000Z",
      metadata: null,
    });
    db.appendMessage({
      sessionId,
      seq: 2,
      role: "assistant",
      source: "wrapper",
      content: "Running pnpm test",
      capturedAt: "2026-03-09T10:00:02.000Z",
      metadata: null,
    });
    db.appendMessage({
      sessionId,
      seq: 3,
      role: "assistant",
      source: "wrapper",
      content: "FAIL vitest suite in src/app.ts",
      capturedAt: "2026-03-09T10:00:03.000Z",
      metadata: null,
    });
    db.appendMessage({
      sessionId,
      seq: 4,
      role: "assistant",
      source: "wrapper",
      content: "Retrying pnpm test after updating src/app.ts",
      capturedAt: "2026-03-09T10:00:04.000Z",
      metadata: null,
    });
    db.appendMessage({
      sessionId,
      seq: 5,
      role: "assistant",
      source: "wrapper",
      content: "PASS vitest suite and updated src/app.ts",
      capturedAt: "2026-03-09T10:00:05.000Z",
      metadata: null,
    });
    db.appendMessage({
      sessionId,
      seq: 6,
      role: "assistant",
      source: "wrapper",
      content:
        "Next: follow up on docs polish. Should we split the CLI setup docs?",
      capturedAt: "2026-03-09T10:00:06.000Z",
      metadata: null,
    });

    db.appendTimelineEvent({
      sessionId,
      seq: 1,
      eventType: "session.start",
      eventSubType: null,
      source: "wrapper",
      summary: "Session started",
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
      summary: "We decided to use Vitest",
      payload: null,
      startedAt: "2026-03-09T10:00:01.000Z",
      endedAt: "2026-03-09T10:00:01.000Z",
      status: "captured",
      relatedMessageId: userMessageId,
    });
    db.appendTimelineEvent({
      sessionId,
      seq: 3,
      eventType: "command.started",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm test",
      payload: JSON.stringify({ command: "pnpm", args: ["test"] }),
      startedAt: "2026-03-09T10:00:02.000Z",
      endedAt: "2026-03-09T10:00:02.000Z",
      status: "running",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId,
      seq: 4,
      eventType: "test.completed",
      eventSubType: "vitest",
      source: "claude-adapter",
      summary: "FAIL vitest suite",
      payload: JSON.stringify({ command: "pnpm test", passed: false }),
      startedAt: "2026-03-09T10:00:03.000Z",
      endedAt: "2026-03-09T10:00:03.000Z",
      status: "failed",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId,
      seq: 5,
      eventType: "error.observed",
      eventSubType: null,
      source: "claude-adapter",
      summary: "Test run failed in src/app.ts",
      payload: JSON.stringify({ severity: "error" }),
      startedAt: "2026-03-09T10:00:03.500Z",
      endedAt: "2026-03-09T10:00:03.500Z",
      status: "error",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId,
      seq: 6,
      eventType: "command.completed",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm test",
      payload: JSON.stringify({ command: "pnpm", args: ["test"], exitCode: 1 }),
      startedAt: "2026-03-09T10:00:03.000Z",
      endedAt: "2026-03-09T10:00:03.500Z",
      status: "failed",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId,
      seq: 7,
      eventType: "file.changed",
      eventSubType: null,
      source: "wrapper",
      summary: "src/app.ts changed",
      payload: JSON.stringify({
        path: "src/app.ts",
        beforeStatus: null,
        afterStatus: "M",
      }),
      startedAt: "2026-03-09T10:00:03.000Z",
      endedAt: "2026-03-09T10:00:03.000Z",
      status: "M",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId,
      seq: 8,
      eventType: "command.started",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm test",
      payload: JSON.stringify({ command: "pnpm", args: ["test"] }),
      startedAt: "2026-03-09T10:00:04.000Z",
      endedAt: "2026-03-09T10:00:04.000Z",
      status: "running",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId,
      seq: 9,
      eventType: "test.completed",
      eventSubType: "vitest",
      source: "claude-adapter",
      summary: "PASS vitest suite",
      payload: JSON.stringify({ command: "pnpm test", passed: true }),
      startedAt: "2026-03-09T10:00:05.000Z",
      endedAt: "2026-03-09T10:00:05.000Z",
      status: "passed",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId,
      seq: 10,
      eventType: "command.completed",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm test",
      payload: JSON.stringify({ command: "pnpm", args: ["test"], exitCode: 0 }),
      startedAt: "2026-03-09T10:00:04.000Z",
      endedAt: "2026-03-09T10:00:05.000Z",
      status: "completed",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId,
      seq: 11,
      eventType: "git.commit",
      eventSubType: null,
      source: "wrapper",
      summary: "HEAD moved to abc123def456",
      payload: JSON.stringify({
        previousHead: "abc000",
        currentHead: "abc123def456",
      }),
      startedAt: "2026-03-09T10:00:06.000Z",
      endedAt: "2026-03-09T10:00:06.000Z",
      status: "captured",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId,
      seq: 12,
      eventType: "session.end",
      eventSubType: null,
      source: "wrapper",
      summary: "Session completed",
      payload: JSON.stringify({ exitCode: 0 }),
      startedAt: "2026-03-09T10:05:00.000Z",
      endedAt: "2026-03-09T10:05:00.000Z",
      status: "completed",
      relatedMessageId: null,
    });

    db.finalizeSession(sessionId, {
      status: "completed",
      endedAt: "2026-03-09T10:05:00.000Z",
      title: "Implement recorder ingestion",
    });

    return sessionId;
  }

  it("creates deterministic artifacts plus semantic narratives and decisions with provenance", () => {
    const sessionId = seedSession();

    const summary = reingestSessionHistory(db, sessionId);
    const detail = db.getSessionDetail(sessionId);

    expect(summary.artifactsCreated).toBeGreaterThanOrEqual(4);
    expect(summary.narrativesCreated).toBe(3);
    expect(summary.decisionsCreated).toBeGreaterThanOrEqual(1);
    expect(detail?.artifacts.map((artifact) => artifact.artifactType)).toEqual(
      expect.arrayContaining([
        "command-output",
        "test-result",
        "file-change",
        "git-commit",
      ]),
    );
    expect(detail?.narratives.map((narrative) => narrative.kind)).toEqual([
      "journal",
      "project-summary",
      "handoff",
    ]);
    expect(detail?.decisions.map((decision) => decision.status)).toContain(
      "accepted",
    );
    expect(
      detail?.narratives.find(
        (narrative) => narrative.kind === "project-summary",
      )?.content,
    ).toContain("Failures observed: 3");
    expect(
      detail?.narratives.find(
        (narrative) => narrative.kind === "project-summary",
      )?.content,
    ).toContain(
      "Issue clusters: test: pnpm test / vitest (recovered after 1 failed attempt(s); latest succeeded)",
    );
    expect(
      detail?.narratives.find(
        (narrative) => narrative.kind === "project-summary",
      )?.content,
    ).toContain("Active blockers: none detected");
    expect(
      detail?.narratives.find(
        (narrative) => narrative.kind === "project-summary",
      )?.content,
    ).toContain(
      "Recovered clusters: test: pnpm test / vitest (recovered after 1 failed attempt(s); latest succeeded)",
    );
    expect(
      detail?.narratives.find(
        (narrative) => narrative.kind === "project-summary",
      )?.content,
    ).toContain("Retry hotspots: pnpm test x2 (latest succeeded)");
    expect(
      detail?.narratives.find((narrative) => narrative.kind === "handoff")
        ?.content,
    ).toContain(
      "Blocking failures: FAIL vitest suite | Test run failed in src/app.ts | pnpm test",
    );
    expect(
      detail?.narratives.find((narrative) => narrative.kind === "handoff")
        ?.content,
    ).toContain(
      "Issue clusters: test: pnpm test / vitest (recovered after 1 failed attempt(s); latest succeeded)",
    );
    expect(
      detail?.narratives.find((narrative) => narrative.kind === "handoff")
        ?.content,
    ).toContain("Blocking clusters: none detected");
    expect(
      detail?.narratives.find((narrative) => narrative.kind === "handoff")
        ?.content,
    ).toContain(
      "Recovered clusters: test: pnpm test / vitest (recovered after 1 failed attempt(s); latest succeeded)",
    );
    expect(
      detail?.narratives.find((narrative) => narrative.kind === "handoff")
        ?.content,
    ).toContain(
      "Open items: Next: follow up on docs polish. Should we split the CLI setup docs?",
    );

    const commandArtifact = detail?.artifacts.find(
      (artifact) =>
        artifact.artifactType === "command-output" &&
        (artifact.metadata ?? "").includes('"command":"pnpm"') &&
        (artifact.metadata ?? "").includes('"eventType":"command.completed"') &&
        (artifact.metadata ?? "").includes('"outcome":"failed"'),
    );
    const parsedCommandArtifactMetadata = JSON.parse(
      commandArtifact?.metadata ?? "{}",
    ) as {
      sourceRefs?: Array<{ type: string; id: string }>;
      category?: string;
      outcome?: string;
      intent?: string;
      commandFamily?: string;
      packageManager?: string | null;
      scriptName?: string | null;
      issueKey?: string | null;
      issueLabel?: string | null;
      issueFamilyKey?: string | null;
      issueFamilyLabel?: string | null;
    };
    expect(parsedCommandArtifactMetadata.sourceRefs?.length).toBeGreaterThan(0);
    expect(parsedCommandArtifactMetadata.category).toBe("test");
    expect(parsedCommandArtifactMetadata.intent).toBe("test");
    expect(parsedCommandArtifactMetadata.commandFamily).toBe("package-manager");
    expect(parsedCommandArtifactMetadata.packageManager).toBe("pnpm");
    expect(parsedCommandArtifactMetadata.scriptName).toBe("test");
    expect(parsedCommandArtifactMetadata.outcome).toBe("failed");
    expect(parsedCommandArtifactMetadata.issueKey).toBe("test:pnpm-test");
    expect(parsedCommandArtifactMetadata.issueLabel).toBe("pnpm test");
    expect(parsedCommandArtifactMetadata.issueFamilyKey).toBe(
      "test-family:pnpm",
    );
    expect(parsedCommandArtifactMetadata.issueFamilyLabel).toBe("pnpm tests");

    const fileArtifact = detail?.artifacts.find(
      (artifact) =>
        artifact.artifactType === "file-change" &&
        artifact.path === "src/app.ts",
    );
    const parsedFileArtifactMetadata = JSON.parse(
      fileArtifact?.metadata ?? "{}",
    ) as { pathCategory?: string };
    expect(parsedFileArtifactMetadata.pathCategory).toBe("source");
  });

  it("classifies richer non-test command intents and issue keys", () => {
    const sessionId = db.createSession({
      host: "claude",
      projectRoot: tempDir,
      cwd: tempDir,
      title: "Command classification coverage",
      status: "completed",
      startedAt: "2026-03-09T11:00:00.000Z",
      endedAt: "2026-03-09T11:02:00.000Z",
      metadata: null,
    });

    const appendCommand = (
      seq: number,
      summary: string,
      payload: Record<string, unknown>,
      status: string,
    ) => {
      db.appendTimelineEvent({
        sessionId,
        seq,
        eventType: "command.completed",
        eventSubType: null,
        source: "wrapper",
        summary,
        payload: JSON.stringify(payload),
        startedAt: `2026-03-09T11:00:${String(seq).padStart(2, "0")}.000Z`,
        endedAt: `2026-03-09T11:00:${String(seq).padStart(2, "0")}.500Z`,
        status,
        relatedMessageId: null,
      });
    };

    appendCommand(
      1,
      "pnpm install",
      {
        command: "pnpm",
        args: ["install"],
        exitCode: 0,
      },
      "completed",
    );
    appendCommand(
      2,
      "pnpm add @tanstack/react-query",
      {
        command: "pnpm",
        args: ["add", "@tanstack/react-query"],
        exitCode: 1,
        stderr:
          "ERR_PNPM_FETCH_404 GET https://registry.npmjs.org/@tanstack%2freact-query: Not Found",
      },
      "failed",
    );
    appendCommand(
      3,
      "pnpm lint",
      {
        command: "pnpm",
        args: ["lint"],
        exitCode: 1,
      },
      "failed",
    );
    appendCommand(
      4,
      "pnpm typecheck",
      {
        command: "pnpm",
        args: ["typecheck"],
        exitCode: 0,
      },
      "completed",
    );
    appendCommand(
      5,
      "pnpm prisma migrate deploy",
      {
        command: "pnpm",
        args: ["prisma", "migrate", "deploy"],
        exitCode: 0,
      },
      "completed",
    );
    appendCommand(
      6,
      "wrangler deploy",
      {
        command: "wrangler",
        args: ["deploy"],
        exitCode: 1,
      },
      "failed",
    );

    db.finalizeSession(sessionId, {
      status: "failed",
      endedAt: "2026-03-09T11:02:00.000Z",
      title: "Command classification coverage",
    });

    reingestSessionHistory(db, sessionId);
    const detail = db.getSessionDetail(sessionId);
    const commandArtifacts = detail?.artifacts
      .filter((artifact) => artifact.artifactType === "command-output")
      .map(
        (artifact) =>
          JSON.parse(artifact.metadata ?? "{}") as {
            category?: string;
            intent?: string;
            packageManager?: string | null;
            scriptName?: string | null;
            issueKey?: string | null;
            issueLabel?: string | null;
            issueFamilyKey?: string | null;
            issueFamilyLabel?: string | null;
          },
      );

    expect(commandArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "install",
          intent: "install",
          packageManager: "pnpm",
          scriptName: "install",
          issueKey: "install:pnpm-install",
          issueLabel: "pnpm install",
          issueFamilyKey: "install-family:pnpm",
          issueFamilyLabel: "pnpm install",
        }),
        expect.objectContaining({
          category: "install",
          intent: "install",
          packageManager: "pnpm",
          scriptName: "add",
          dependencyAction: "add",
          dependencyNames: ["@tanstack/react-query"],
          failureSignatureLabel: "Error code ERR_PNPM_FETCH_404",
          lintRuleId: null,
          issueKey: "install:pnpm-add",
          issueLabel: "pnpm add",
          issueFamilyKey: "install-family:pnpm",
          issueFamilyLabel: "pnpm install",
        }),
        expect.objectContaining({
          category: "lint",
          intent: "lint",
          packageManager: "pnpm",
          scriptName: "lint",
          issueKey: "lint:pnpm-lint",
          issueLabel: "pnpm lint",
          issueFamilyKey: "lint-family:pnpm",
          issueFamilyLabel: "pnpm lint",
        }),
        expect.objectContaining({
          category: "typecheck",
          intent: "typecheck",
          packageManager: "pnpm",
          scriptName: "typecheck",
          issueKey: "typecheck:pnpm-typecheck",
          issueLabel: "pnpm typecheck",
          issueFamilyKey: "typecheck-family:pnpm",
          issueFamilyLabel: "pnpm typecheck",
        }),
        expect.objectContaining({
          category: "migration",
          intent: "migration",
          packageManager: "pnpm",
          scriptName: "prisma",
          issueKey: "migration:pnpm-prisma-migrate-deploy",
          issueLabel: "pnpm prisma migrate deploy",
          issueFamilyKey: "migration-family:prisma",
          issueFamilyLabel: "prisma migrations",
        }),
        expect.objectContaining({
          category: "deploy",
          intent: "deploy",
          issueKey: "deploy:wrangler-deploy",
          issueLabel: "wrangler deploy",
          issueFamilyKey: "deploy-family:wrangler",
          issueFamilyLabel: "wrangler deploy",
        }),
      ]),
    );

    expect(
      detail?.narratives.find((narrative) => narrative.kind === "handoff")
        ?.content,
    ).toContain("Blocking clusters:");
    expect(
      detail?.narratives.find((narrative) => narrative.kind === "handoff")
        ?.content,
    ).toContain(
      "deploy: wrangler deploy (still failing after 1 attempt(s); latest failed)",
    );
    expect(
      detail?.narratives.find((narrative) => narrative.kind === "handoff")
        ?.content,
    ).toContain(
      "lint: pnpm lint (still failing after 1 attempt(s); latest failed)",
    );
  });

  it("extracts dependency, failure signature, test case, and manifest metadata", () => {
    const sessionId = db.createSession({
      host: "codex",
      projectRoot: tempDir,
      cwd: tempDir,
      title: "Deterministic metadata extraction",
      status: "failed",
      startedAt: "2026-03-09T12:10:00.000Z",
      endedAt: "2026-03-09T12:12:00.000Z",
      metadata: null,
    });

    db.appendTimelineEvent({
      sessionId,
      seq: 1,
      eventType: "command.completed",
      eventSubType: "pnpm",
      source: "wrapper",
      summary: "pnpm add zod @types/node -D",
      payload: JSON.stringify({
        command: "pnpm",
        args: ["add", "zod", "@types/node", "-D"],
        exitCode: 0,
      }),
      startedAt: "2026-03-09T12:10:01.000Z",
      endedAt: "2026-03-09T12:10:02.000Z",
      status: "completed",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId,
      seq: 2,
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
      startedAt: "2026-03-09T12:10:03.000Z",
      endedAt: "2026-03-09T12:10:04.000Z",
      status: "failed",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
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
          "FAIL src/login.test.ts > renders login form\nAssertionError: expected true to be false",
      }),
      startedAt: "2026-03-09T12:10:05.000Z",
      endedAt: "2026-03-09T12:10:06.000Z",
      status: "failed",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId,
      seq: 4,
      eventType: "file.changed",
      eventSubType: null,
      source: "wrapper",
      summary: "package.json changed",
      payload: JSON.stringify({ path: "package.json", afterStatus: "M" }),
      startedAt: "2026-03-09T12:10:07.000Z",
      endedAt: "2026-03-09T12:10:07.000Z",
      status: "M",
      relatedMessageId: null,
    });
    db.appendTimelineEvent({
      sessionId,
      seq: 5,
      eventType: "file.changed",
      eventSubType: null,
      source: "wrapper",
      summary: "pnpm-lock.yaml changed",
      payload: JSON.stringify({ path: "pnpm-lock.yaml", afterStatus: "M" }),
      startedAt: "2026-03-09T12:10:08.000Z",
      endedAt: "2026-03-09T12:10:08.000Z",
      status: "M",
      relatedMessageId: null,
    });

    db.finalizeSession(sessionId, {
      status: "failed",
      endedAt: "2026-03-09T12:12:00.000Z",
      title: "Deterministic metadata extraction",
    });

    reingestSessionHistory(db, sessionId);
    const detail = db.getSessionDetail(sessionId);
    const artifacts = detail?.artifacts.map((artifact) => ({
      artifactType: artifact.artifactType,
      path: artifact.path,
      metadata: JSON.parse(artifact.metadata ?? "{}") as Record<
        string,
        unknown
      >,
    }));
    const projectSummary = detail?.narratives.find(
      (narrative) => narrative.kind === "project-summary",
    )?.content;
    const handoff = detail?.narratives.find(
      (narrative) => narrative.kind === "handoff",
    )?.content;

    expect(projectSummary).toContain(
      "Dependency changes: pnpm add: zod, @types/node | package.json updated | pnpm-lock.yaml updated",
    );
    expect(projectSummary).toContain(
      "install: pnpm add / zod, @types/node (no active blocker; latest succeeded)",
    );
    expect(projectSummary).toContain(
      "lint: pnpm lint / @typescript-eslint/no-unused-vars (still failing after 1 attempt(s); latest failed)",
    );
    expect(projectSummary).toContain(
      "test: pnpm test / src/login.test.ts > renders login form [Assertion failure] (still failing after 1 attempt(s); latest failed)",
    );
    expect(handoff).toContain(
      "Dependency changes: pnpm add: zod, @types/node | package.json updated | pnpm-lock.yaml updated",
    );
    expect(handoff).toContain(
      "Blocking clusters: lint: pnpm lint / @typescript-eslint/no-unused-vars (still failing after 1 attempt(s); latest failed) | test: pnpm test / src/login.test.ts > renders login form [Assertion failure] (still failing after 1 attempt(s); latest failed)",
    );

    const installArtifact = artifacts?.find(
      (artifact) =>
        artifact.artifactType === "command-output" &&
        artifact.metadata.category === "install",
    );
    expect(installArtifact?.metadata).toEqual(
      expect.objectContaining({
        dependencyAction: "add",
        dependencyNames: ["zod", "@types/node"],
      }),
    );

    const lintArtifact = artifacts?.find(
      (artifact) =>
        artifact.artifactType === "command-output" &&
        artifact.metadata.category === "lint",
    );
    expect(lintArtifact?.metadata).toEqual(
      expect.objectContaining({
        failureSignatureKey: "lint-rule:typescript-eslint-no-unused-vars",
        failureSignatureLabel: "ESLint @typescript-eslint/no-unused-vars",
        lintRuleId: "@typescript-eslint/no-unused-vars",
      }),
    );

    const testArtifact = artifacts?.find(
      (artifact) =>
        artifact.artifactType === "command-output" &&
        artifact.metadata.category === "test",
    );
    expect(testArtifact?.metadata).toEqual(
      expect.objectContaining({
        failureSignatureKey: "test:assertion",
        failureSignatureLabel: "Assertion failure",
        testSuite: "src/login.test.ts",
        testCase: "renders login form",
      }),
    );

    const manifestArtifact = artifacts?.find(
      (artifact) => artifact.path === "package.json",
    );
    expect(manifestArtifact?.metadata).toEqual(
      expect.objectContaining({
        pathCategory: "config",
        changeScope: "dependency-manifest",
        manifestKind: "package.json",
      }),
    );

    const lockfileArtifact = artifacts?.find(
      (artifact) => artifact.path === "pnpm-lock.yaml",
    );
    expect(lockfileArtifact?.metadata).toEqual(
      expect.objectContaining({
        pathCategory: "config",
        changeScope: "dependency-lockfile",
        manifestKind: "pnpm-lock.yaml",
      }),
    );
  });

  it("reingests by replacing derived records while preserving raw messages and events", () => {
    const sessionId = seedSession();
    const initialDetail = db.getSessionDetail(sessionId);
    const initialMessageIds = initialDetail?.messages.map(
      (message) => message.id,
    );
    const initialEventIds = initialDetail?.timeline.map((event) => event.id);

    const firstRun = reingestSessionHistory(db, sessionId);
    const firstDetail = db.getSessionDetail(sessionId);
    const firstNarrativeIds = firstDetail?.narratives.map(
      (narrative) => narrative.id,
    );

    const secondRun = reingestSessionHistory(db, sessionId);
    const secondDetail = db.getSessionDetail(sessionId);
    const secondNarrativeIds = secondDetail?.narratives.map(
      (narrative) => narrative.id,
    );

    expect(firstRun.narrativesCreated).toBe(3);
    expect(secondRun.narrativesCreated).toBe(3);
    expect(secondDetail?.messages.map((message) => message.id)).toEqual(
      initialMessageIds,
    );
    expect(secondDetail?.timeline.map((event) => event.id)).toEqual(
      initialEventIds,
    );
    expect(secondNarrativeIds).not.toEqual(firstNarrativeIds);
    expect(secondDetail?.ingestionRuns).toHaveLength(4);
  });

  it("rejects reingest for sessions that are still running", () => {
    const sessionId = db.createSession({
      host: "claude",
      projectRoot: tempDir,
      cwd: tempDir,
      title: "Running ingestion guard",
      status: "running",
      startedAt: "2026-03-10T01:00:00.000Z",
      endedAt: null,
      metadata: null,
    });

    expect(() => reingestSessionHistory(db, sessionId)).toThrow(
      "Session is still running and cannot be reingested yet",
    );
  });
});
