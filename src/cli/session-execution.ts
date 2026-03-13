/* global process */

import { createHash } from "node:crypto";
import { execFileSync, spawn } from "node:child_process";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { createInterface } from "node:readline/promises";
import { getHostAdapter } from "../adapters/index.js";
import { resolveHostLaunchSpec } from "./launch-spec.js";
import {
  controlEchoTokens,
  decodeTranscriptInputText,
  decodeTranscriptOutputText,
  parseUtilLinuxTranscript,
  parseScriptTranscript,
} from "./pty-transcript.js";
import { confirmContextLink } from "../lib/context-memory.js";
import { truncateSummary } from "../lib/session-history.js";
import {
  EvidenceDatabase,
  type SessionHost,
  type SessionMessageRole,
  type SessionStatus,
} from "../lib/storage/index.js";
import {
  preparePendingRunContextFlow,
  type ContextActionStatus,
  type PreparedContextSelection,
} from "./context-flow.js";

export type LineWriter = (line: string) => void;
export type PromptReader = ReturnType<typeof createInterface>;

export interface RunContextOptions {
  prepareContext?: boolean;
  interactiveContext?: boolean;
  contextTitle?: string;
}

export interface GitSnapshot {
  head: string | null;
  statusByPath: Map<string, string>;
  fingerprintByPath: Map<string, string | null>;
}

export function resolveDbPath(): string {
  return process.env.FOOTPRINT_DATA_DIR
    ? path.join(process.env.FOOTPRINT_DATA_DIR, "footprint.db")
    : process.env.FOOTPRINT_DB_PATH || "./evidence.db";
}

export function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function findProjectRoot(startDir: string): string {
  let current = path.resolve(startDir);

  while (true) {
    if (fs.existsSync(path.join(current, ".git"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return path.resolve(startDir);
    }

    current = parent;
  }
}

function normalizeGitStatusPath(rawPath: string): string {
  const renamedParts = rawPath.split(" -> ");
  return renamedParts.at(-1)?.trim() ?? rawPath.trim();
}

function hashBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function buildPathFingerprint(targetPath: string): string | null {
  try {
    const stats = fs.lstatSync(targetPath);
    if (stats.isSymbolicLink()) {
      return `symlink:${hashBuffer(Buffer.from(fs.readlinkSync(targetPath), "utf8"))}`;
    }

    if (stats.isDirectory()) {
      const entries = fs.readdirSync(targetPath, { withFileTypes: true });
      const childFingerprints = entries
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((entry) => {
          const entryPath = path.join(targetPath, entry.name);
          const childFingerprint = buildPathFingerprint(entryPath);
          return `${entry.name}:${childFingerprint ?? "missing"}`;
        })
        .join("|");
      return `dir:${hashBuffer(Buffer.from(childFingerprints, "utf8"))}`;
    }

    if (stats.isFile()) {
      return `file:${hashBuffer(fs.readFileSync(targetPath))}`;
    }

    return `other:${stats.mode}:${stats.size}`;
  } catch {
    return null;
  }
}

function parseDiffNameStatusLine(line: string): {
  statusCode: string;
  changedPath: string | null;
} {
  const parts = line.split("\t");
  if (parts.length >= 2) {
    return {
      statusCode: parts[0]?.trim() ?? "",
      changedPath: parts.at(-1)?.trim() || null,
    };
  }

  const [statusCode, changedPath] = line.trim().split(/\s+/, 2);
  return {
    statusCode: statusCode ?? "",
    changedPath: changedPath?.trim() || null,
  };
}

export function getGitSnapshot(projectRoot: string): GitSnapshot | null {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd: projectRoot,
      stdio: "ignore",
    });

    const head = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: projectRoot,
      encoding: "utf8",
    }).trim();
    const statusOutput = execFileSync("git", ["status", "--short"], {
      cwd: projectRoot,
      encoding: "utf8",
    });

    const statusByPath = new Map<string, string>();
    const fingerprintByPath = new Map<string, string | null>();
    for (const line of statusOutput.split("\n")) {
      const trimmed = line.trimEnd();
      if (!trimmed) {
        continue;
      }

      const status = trimmed.slice(0, 2).trim() || "??";
      const filePath = normalizeGitStatusPath(trimmed.slice(3).trim());
      if (filePath) {
        statusByPath.set(filePath, status);
        fingerprintByPath.set(
          filePath,
          buildPathFingerprint(path.join(projectRoot, filePath)),
        );
      }
    }

    return {
      head: head || null,
      statusByPath,
      fingerprintByPath,
    };
  } catch {
    return null;
  }
}

export function serializeJson(value: unknown): string | null {
  return value === undefined ? null : JSON.stringify(value);
}

export function createLineCapture(onLine: (line: string) => void): {
  write: (chunk: string) => void;
  flush: () => void;
} {
  let buffer = "";

  return {
    write(chunk: string) {
      buffer += chunk;
      const parts = buffer.split(/\r?\n/);
      buffer = parts.pop() ?? "";

      for (const line of parts) {
        if (line.trim().length > 0) {
          onLine(line);
        }
      }
    },
    flush() {
      if (buffer.trim().length > 0) {
        onLine(buffer);
      }
      buffer = "";
    },
  };
}

interface PtyReplayRecord {
  direction: "i" | "o";
  payload: Buffer;
}

function readPtyReplayRecords(options: {
  transcriptFormat: "script-bsd" | "util-linux-advanced";
  transcriptPath?: string | null;
  inputPath?: string | null;
  outputPath?: string | null;
  timingPath?: string | null;
}): PtyReplayRecord[] {
  if (options.transcriptFormat === "script-bsd") {
    if (!options.transcriptPath || !fs.existsSync(options.transcriptPath)) {
      return [];
    }

    const transcript = fs.readFileSync(options.transcriptPath);
    return parseScriptTranscript(transcript).records.flatMap((record) =>
      record.direction === "i" || record.direction === "o"
        ? [{ direction: record.direction, payload: record.payload }]
        : [],
    );
  }

  if (
    !options.inputPath ||
    !options.outputPath ||
    !options.timingPath ||
    !fs.existsSync(options.inputPath) ||
    !fs.existsSync(options.outputPath) ||
    !fs.existsSync(options.timingPath)
  ) {
    return [];
  }

  return parseUtilLinuxTranscript({
    timing: fs.readFileSync(options.timingPath),
    input: fs.readFileSync(options.inputPath),
    output: fs.readFileSync(options.outputPath),
  }).records.map((record) => ({
    direction: record.direction,
    payload: record.payload,
  }));
}

export function recordMessageAndEvent(
  db: EvidenceDatabase,
  options: {
    sessionId: string;
    messageSeq: number;
    eventSeq: number;
    role: SessionMessageRole;
    source: string;
    content: string;
    eventType: string;
    eventStatus?: string | null;
    payload?: Record<string, unknown>;
  },
): { messageSeq: number; eventSeq: number; messageId: string } {
  const timestamp = new Date().toISOString();
  const messageId = db.appendMessage({
    sessionId: options.sessionId,
    seq: options.messageSeq,
    role: options.role,
    source: options.source,
    content: options.content,
    capturedAt: timestamp,
    metadata: serializeJson(options.payload),
  });

  db.appendTimelineEvent({
    sessionId: options.sessionId,
    seq: options.eventSeq,
    eventType: options.eventType,
    eventSubType: null,
    source: options.source,
    summary: truncateSummary(options.content),
    payload: serializeJson(options.payload),
    startedAt: timestamp,
    endedAt: timestamp,
    status: options.eventStatus ?? null,
    relatedMessageId: messageId,
  });

  return {
    messageSeq: options.messageSeq + 1,
    eventSeq: options.eventSeq + 1,
    messageId,
  };
}

export function appendTimelineEvent(
  db: EvidenceDatabase,
  options: {
    sessionId: string;
    eventSeq: number;
    eventType: string;
    eventSubType?: string | null;
    source: string;
    summary?: string | null;
    payload?: unknown;
    startedAt?: string | null;
    endedAt?: string | null;
    status?: string | null;
    relatedMessageId?: string | null;
  },
): number {
  const now = new Date().toISOString();

  db.appendTimelineEvent({
    sessionId: options.sessionId,
    seq: options.eventSeq,
    eventType: options.eventType,
    eventSubType: options.eventSubType ?? null,
    source: options.source,
    summary: options.summary ?? null,
    payload: serializeJson(options.payload),
    startedAt: options.startedAt ?? now,
    endedAt: options.endedAt ?? options.startedAt ?? now,
    status: options.status ?? null,
    relatedMessageId: options.relatedMessageId ?? null,
  });

  return options.eventSeq + 1;
}

function getHostCommand(host: SessionHost): string {
  switch (host) {
    case "claude":
      return process.env.FOOTPRINT_CLAUDE_COMMAND || "claude";
    case "gemini":
      return process.env.FOOTPRINT_GEMINI_COMMAND || "gemini";
    case "codex":
      return process.env.FOOTPRINT_CODEX_COMMAND || "codex";
  }
}

async function runRecordedSession(
  host: SessionHost,
  commandArgs: string[],
  options?: RunContextOptions,
): Promise<number> {
  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);

  const db = new EvidenceDatabase(dbPath);
  const cwd = process.cwd();
  const projectRoot = findProjectRoot(cwd);
  const startedAt = new Date().toISOString();
  const command = getHostCommand(host);
  const supportsPtyTranscript =
    process.platform === "linux" ||
    process.platform === "darwin" ||
    process.platform === "freebsd" ||
    process.platform === "openbsd";
  let ptyTranscriptDir: string | null = null;
  let ptyTranscriptPath: string | null = null;
  let ptyInputPath: string | null = null;
  let ptyOutputPath: string | null = null;
  let ptyTimingPath: string | null = null;
  if (supportsPtyTranscript) {
    ptyTranscriptDir = fs.mkdtempSync(path.join(tmpdir(), "footprint-pty-"));
    if (process.platform === "linux") {
      ptyInputPath = path.join(ptyTranscriptDir, "session.stdin");
      ptyOutputPath = path.join(ptyTranscriptDir, "session.stdout");
      ptyTimingPath = path.join(ptyTranscriptDir, "session.timing");
    } else {
      ptyTranscriptPath = path.join(ptyTranscriptDir, "session.typescript");
    }
  }
  const launchSpec = resolveHostLaunchSpec({
    hostCommand: command,
    hostArgs: commandArgs,
    env: process.env,
    ptyTranscriptPath,
    ptyInputPath,
    ptyOutputPath,
    ptyTimingPath,
    stdinIsTTY: Boolean(process.stdin.isTTY),
    stdoutIsTTY: Boolean(process.stdout.isTTY),
    stderrIsTTY: Boolean(process.stderr.isTTY),
  });
  if (launchSpec.transport !== "pty" && ptyTranscriptDir) {
    fs.rmSync(ptyTranscriptDir, { recursive: true, force: true });
    ptyTranscriptDir = null;
    ptyTranscriptPath = null;
    ptyInputPath = null;
    ptyOutputPath = null;
    ptyTimingPath = null;
  }
  const replaysPtyTranscript =
    launchSpec.transport === "pty" && launchSpec.ptyTranscriptFormat !== null;
  const pipesChildStdin =
    launchSpec.transport !== "pty" || launchSpec.ptyStdinMode === "pipe";
  const suppressesPtyEcho =
    launchSpec.transport === "pty" &&
    launchSpec.ptyTranscriptFormat !== "util-linux-advanced";
  const adapter = getHostAdapter(host);
  const adapterName = adapter?.name ?? `${host}-adapter`;
  const adapterContext = { host, cwd, args: commandArgs };
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    FOOTPRINT_SESSION_HOST: host,
  };
  const beforeGitSnapshot = getGitSnapshot(projectRoot);
  let eventSeq = 1;
  let messageSeq = 1;
  let titleCaptured = false;
  let settled = false;
  const preparedContext = options?.prepareContext
    ? await preparePendingRunContextFlow(db, {
        cwd,
        title: options.contextTitle,
        host,
        interactive: options.interactiveContext,
        printTo: "stderr",
      })
    : null;
  const sessionTitle =
    preparedContext?.title ?? options?.contextTitle?.trim() ?? null;

  const sessionId = db.createSession({
    host,
    projectRoot,
    cwd,
    title: sessionTitle,
    status: "running",
    startedAt,
    endedAt: null,
    metadata: serializeJson({
      command,
      args: commandArgs,
      transport: launchSpec.transport,
      ptyDriver: launchSpec.ptyDriver,
      ptyTranscriptFormat: launchSpec.ptyTranscriptFormat,
      ptyStdinMode: launchSpec.ptyStdinMode,
      fallbackReason: launchSpec.fallbackReason,
    }),
  });

  if (preparedContext) {
    let appliedContextId: string | null = null;
    let appliedAction: ContextActionStatus = preparedContext.action;
    let appliedNote = preparedContext.note;
    if (
      (preparedContext.action === "confirmed" ||
        preparedContext.action === "preferred" ||
        preparedContext.action === "used-preferred") &&
      preparedContext.contextId
    ) {
      const result = confirmContextLink(db, {
        sessionIds: [sessionId],
        contextId: preparedContext.contextId,
        linkSource: "confirmed",
      });
      appliedContextId = result.contextId;
    } else if (preparedContext.action === "create-new") {
      const result = confirmContextLink(db, {
        sessionIds: [
          sessionId,
          ...preparedContext.relatedSessionIds.filter(
            (candidateId) => candidateId !== sessionId,
          ),
        ],
        label: preparedContext.contextLabel ?? sessionTitle ?? undefined,
        linkSource: "confirmed",
      });
      appliedContextId = result.contextId;
      appliedNote =
        preparedContext.relatedSessionIds.length > 0
          ? "Created a new canonical context from the suggested related sessions."
          : "Created a new canonical context for this session.";
    }

    eventSeq = appendTimelineEvent(db, {
      sessionId,
      eventSeq,
      eventType: "context.resolved",
      source: "wrapper",
      summary: `Context resolution: ${preparedContext.resolution.mode}`,
      payload: {
        mode: preparedContext.resolution.mode,
        recommendedAction: preparedContext.resolution.recommendedAction,
        confirmationRequired: preparedContext.resolution.confirmationRequired,
        candidates: preparedContext.resolution.candidates.map((candidate) => ({
          kind: candidate.kind,
          contextId: candidate.contextId,
          label: candidate.label,
          confidence: candidate.confidence,
          reasons: candidate.reasons,
        })),
      },
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      status: appliedAction,
    });
    if (appliedContextId) {
      eventSeq = appendTimelineEvent(db, {
        sessionId,
        eventSeq,
        eventType: "context.updated",
        source: "wrapper",
        summary: `Context action: ${appliedAction}`,
        payload: {
          action: appliedAction,
          contextId: appliedContextId,
          note: appliedNote,
        },
        startedAt: new Date().toISOString(),
        endedAt: new Date().toISOString(),
        status: appliedAction,
      });
    }
  }

  eventSeq = appendTimelineEvent(db, {
    sessionId,
    eventSeq,
    eventType: "session.start",
    source: "wrapper",
    summary: `Started ${host} session`,
    payload: {
      command,
      args: commandArgs,
      cwd,
      transport: launchSpec.transport,
      ptyDriver: launchSpec.ptyDriver,
      ptyTranscriptFormat: launchSpec.ptyTranscriptFormat,
      ptyStdinMode: launchSpec.ptyStdinMode,
      fallbackReason: launchSpec.fallbackReason,
    },
    startedAt,
    endedAt: startedAt,
    status: "running",
  });
  eventSeq = appendTimelineEvent(db, {
    sessionId,
    eventSeq,
    eventType: "command.started",
    eventSubType: host,
    source: "wrapper",
    summary: `Launched ${command} via ${launchSpec.transport}`,
    payload: {
      command,
      args: commandArgs,
      cwd,
      transport: launchSpec.transport,
      ptyDriver: launchSpec.ptyDriver,
      ptyTranscriptFormat: launchSpec.ptyTranscriptFormat,
      ptyStdinMode: launchSpec.ptyStdinMode,
      fallbackReason: launchSpec.fallbackReason,
    },
    startedAt,
    status: "running",
  });

  for (const event of adapter?.onSessionStart?.(adapterContext) ?? []) {
    eventSeq = appendTimelineEvent(db, {
      sessionId,
      eventSeq,
      eventType: event.eventType,
      eventSubType: event.eventSubType,
      source: adapterName,
      summary: event.summary,
      payload: event.payload,
      startedAt: event.startedAt,
      endedAt: event.endedAt,
      status: event.status,
    });
  }

  const child = spawn(launchSpec.command, launchSpec.args, {
    cwd,
    env: childEnv,
    stdio:
      launchSpec.transport === "pty" && launchSpec.ptyStdinMode === "inherit"
        ? ["inherit", "pipe", "pipe"]
        : ["pipe", "pipe", "pipe"],
  });

  const cleanupSignalHandlers: Array<() => void> = [];
  const pendingEchoLines: string[] = [];

  const finalize = (status: SessionStatus, exitCode: number): number => {
    if (settled) {
      return exitCode;
    }

    settled = true;
    if (replaysPtyTranscript && launchSpec.ptyTranscriptFormat) {
      for (const record of readPtyReplayRecords({
        transcriptFormat: launchSpec.ptyTranscriptFormat,
        transcriptPath: ptyTranscriptPath,
        inputPath: ptyInputPath,
        outputPath: ptyOutputPath,
        timingPath: ptyTimingPath,
      })) {
        if (record.direction === "i") {
          if (suppressesPtyEcho) {
            for (const token of controlEchoTokens(record.payload)) {
              pendingEchoLines.push(token);
            }
          }

          const inputText = decodeTranscriptInputText(record.payload);
          if (inputText.length > 0) {
            stdinCapture.write(inputText);
          }
          continue;
        }

        if (record.direction === "o") {
          const outputText = decodeTranscriptOutputText(record.payload);
          if (outputText.length > 0) {
            stdoutCapture.write(outputText);
          }
        }
      }
    }

    stdinCapture.flush();
    stdoutCapture.flush();
    stderrCapture.flush();

    const endedAt = new Date().toISOString();
    const afterGitSnapshot = getGitSnapshot(projectRoot);
    eventSeq = appendTimelineEvent(db, {
      sessionId,
      eventSeq,
      eventType: "command.completed",
      eventSubType: host,
      source: "wrapper",
      summary: `${command} exited`,
      payload: { command, args: commandArgs, exitCode },
      startedAt: endedAt,
      endedAt,
      status,
    });

    if (beforeGitSnapshot && afterGitSnapshot) {
      const changedPaths = new Set([
        ...beforeGitSnapshot.statusByPath.keys(),
        ...afterGitSnapshot.statusByPath.keys(),
      ]);
      const emittedFileChanges = new Set<string>();

      for (const changedPath of changedPaths) {
        const beforeStatus =
          beforeGitSnapshot.statusByPath.get(changedPath) ?? null;
        const afterStatus =
          afterGitSnapshot.statusByPath.get(changedPath) ?? null;
        const beforeFingerprint =
          beforeGitSnapshot.fingerprintByPath.get(changedPath) ?? null;
        const afterFingerprint =
          afterGitSnapshot.fingerprintByPath.get(changedPath) ?? null;

        if (
          beforeStatus === afterStatus &&
          beforeFingerprint === afterFingerprint
        ) {
          continue;
        }

        eventSeq = appendTimelineEvent(db, {
          sessionId,
          eventSeq,
          eventType: "file.changed",
          source: "wrapper",
          summary: `${changedPath} changed`,
          payload: {
            path: changedPath,
            beforeStatus,
            afterStatus,
            beforeFingerprint,
            afterFingerprint,
          },
          startedAt: endedAt,
          endedAt,
          status: afterStatus ?? "removed",
        });
        emittedFileChanges.add(changedPath);
      }

      if (
        beforeGitSnapshot.head !== afterGitSnapshot.head &&
        afterGitSnapshot.head
      ) {
        if (beforeGitSnapshot.head) {
          try {
            const diffOutput = execFileSync(
              "git",
              [
                "diff",
                "--name-status",
                `${beforeGitSnapshot.head}..${afterGitSnapshot.head}`,
              ],
              {
                cwd: projectRoot,
                encoding: "utf8",
              },
            );

            for (const line of diffOutput.split("\n")) {
              const trimmed = line.trim();
              if (!trimmed) {
                continue;
              }

              const { statusCode, changedPath } =
                parseDiffNameStatusLine(trimmed);
              if (!changedPath || emittedFileChanges.has(changedPath)) {
                continue;
              }

              eventSeq = appendTimelineEvent(db, {
                sessionId,
                eventSeq,
                eventType: "file.changed",
                source: "wrapper",
                summary: `${changedPath} changed in commit`,
                payload: {
                  path: changedPath,
                  beforeStatus: null,
                  afterStatus: statusCode,
                  committed: true,
                },
                startedAt: endedAt,
                endedAt,
                status: statusCode,
              });
              emittedFileChanges.add(changedPath);
            }
          } catch (diffError) {
            // Skip diff-derived file events if git diff is unavailable.
            console.warn(
              "[footprint] git diff failed, skipping diff-based file events:",
              diffError,
            );
          }
        }

        eventSeq = appendTimelineEvent(db, {
          sessionId,
          eventSeq,
          eventType: "git.commit",
          source: "wrapper",
          summary: `HEAD moved to ${afterGitSnapshot.head.slice(0, 12)}`,
          payload: {
            previousHead: beforeGitSnapshot.head,
            currentHead: afterGitSnapshot.head,
          },
          startedAt: endedAt,
          endedAt,
          status: "captured",
        });
      }
    }

    for (const event of adapter?.onSessionEnd?.(adapterContext, {
      exitCode,
      status,
    }) ?? []) {
      eventSeq = appendTimelineEvent(db, {
        sessionId,
        eventSeq,
        eventType: event.eventType,
        eventSubType: event.eventSubType,
        source: adapterName,
        summary: event.summary,
        payload: event.payload,
        startedAt: event.startedAt,
        endedAt: event.endedAt,
        status: event.status,
      });
    }

    eventSeq = appendTimelineEvent(db, {
      sessionId,
      eventSeq,
      eventType: "session.end",
      source: "wrapper",
      summary: `Session ended with status ${status}`,
      payload: { exitCode },
      startedAt: endedAt,
      endedAt,
      status,
    });

    db.finalizeSession(sessionId, { status, endedAt });
    db.close();

    if (ptyTranscriptDir) {
      fs.rmSync(ptyTranscriptDir, { recursive: true, force: true });
    }

    for (const cleanup of cleanupSignalHandlers) {
      cleanup();
    }

    return exitCode;
  };

  const stdinCapture = createLineCapture((line) => {
    const result = recordMessageAndEvent(db, {
      sessionId,
      messageSeq,
      eventSeq,
      role: "user",
      source: "wrapper",
      content: line,
      eventType: "message.user.submitted",
      eventStatus: "captured",
      payload: { stream: "stdin" },
    });
    messageSeq = result.messageSeq;
    eventSeq = result.eventSeq;
    if (suppressesPtyEcho) {
      pendingEchoLines.push(line);
    }

    if (!titleCaptured && line.trim()) {
      db.updateSessionTitle(sessionId, truncateSummary(line.trim()));
      titleCaptured = true;
    }
  });

  const stdoutCapture = createLineCapture((line) => {
    if (suppressesPtyEcho && pendingEchoLines[0] === line) {
      pendingEchoLines.shift();
      return;
    }

    const adapterResult = adapter?.parseLine(line, "stdout", adapterContext);
    if (adapterResult?.events?.length) {
      for (const event of adapterResult.events) {
        eventSeq = appendTimelineEvent(db, {
          sessionId,
          eventSeq,
          eventType: event.eventType,
          eventSubType: event.eventSubType,
          source: adapterName,
          summary: event.summary,
          payload: event.payload,
          startedAt: event.startedAt,
          endedAt: event.endedAt,
          status: event.status,
        });
      }
    }

    if (adapterResult?.suppressTranscript) {
      return;
    }

    const result = recordMessageAndEvent(db, {
      sessionId,
      messageSeq,
      eventSeq,
      role: "assistant",
      source: "wrapper",
      content: line,
      eventType: "message.assistant.completed",
      eventStatus: "captured",
      payload: { stream: "stdout" },
    });
    messageSeq = result.messageSeq;
    eventSeq = result.eventSeq;
  });

  const stderrCapture = createLineCapture((line) => {
    const adapterResult = adapter?.parseLine(line, "stderr", adapterContext);
    if (adapterResult?.events?.length) {
      for (const event of adapterResult.events) {
        eventSeq = appendTimelineEvent(db, {
          sessionId,
          eventSeq,
          eventType: event.eventType,
          eventSubType: event.eventSubType,
          source: adapterName,
          summary: event.summary,
          payload: event.payload,
          startedAt: event.startedAt,
          endedAt: event.endedAt,
          status: event.status,
        });
      }
    }

    if (adapterResult?.suppressTranscript) {
      return;
    }

    const result = recordMessageAndEvent(db, {
      sessionId,
      messageSeq,
      eventSeq,
      role: "system",
      source: "wrapper",
      content: line,
      eventType: "error.observed",
      eventStatus: "observed",
      payload: { stream: "stderr" },
    });
    messageSeq = result.messageSeq;
    eventSeq = result.eventSeq;
  });

  return await new Promise<number>((resolve) => {
    const stdin = process.stdin;

    const onStdinData = (chunk: Buffer | string) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      if (child.stdin && !child.stdin.destroyed) {
        child.stdin.write(text);
      }
      if (!replaysPtyTranscript) {
        stdinCapture.write(text);
      }
    };

    const onStdinEnd = () => {
      if (!replaysPtyTranscript) {
        stdinCapture.flush();
      }
      if (child.stdin && !child.stdin.destroyed) {
        child.stdin.end();
      }
    };

    if (pipesChildStdin) {
      stdin.on("data", onStdinData);
      stdin.on("end", onStdinEnd);
      stdin.resume();

      cleanupSignalHandlers.push(() => {
        stdin.off("data", onStdinData);
        stdin.off("end", onStdinEnd);
      });
    }

    child.stdout?.on("data", (chunk: Buffer | string) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      process.stdout.write(text);
      if (!replaysPtyTranscript) {
        stdoutCapture.write(text);
      }
    });

    child.stderr?.on("data", (chunk: Buffer | string) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
      process.stderr.write(text);
      stderrCapture.write(text);
    });

    child.once("error", (error) => {
      process.stderr.write(`${error.message}\n`);
      stderrCapture.write(error.message);
      resolve(finalize("failed", 1));
    });

    child.once("close", (code, signal) => {
      const status: SessionStatus = signal
        ? "interrupted"
        : code === 0
          ? "completed"
          : "failed";
      resolve(finalize(status, code ?? 1));
    });

    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      const handler = () => {
        if (!child.killed) {
          child.kill(signal);
        }
      };

      process.once(signal, handler);
      cleanupSignalHandlers.push(() => {
        process.off(signal, handler);
      });
    }

    if (child.stdin) {
      child.stdin.on("error", (error) => {
        if ((error as NodeJS.ErrnoException).code !== "EPIPE") {
          process.stderr.write(`${error.message}\n`);
          stderrCapture.write(error.message);
          resolve(finalize("failed", 1));
        }
      });
    }
  });
}

export async function runClaudeSession(
  commandArgs: string[],
  options?: RunContextOptions,
): Promise<number> {
  return runRecordedSession("claude", commandArgs, options);
}

export async function runGeminiSession(
  commandArgs: string[],
  options?: RunContextOptions,
): Promise<number> {
  return runRecordedSession("gemini", commandArgs, options);
}

export async function runCodexSession(
  commandArgs: string[],
  options?: RunContextOptions,
): Promise<number> {
  return runRecordedSession("codex", commandArgs, options);
}
