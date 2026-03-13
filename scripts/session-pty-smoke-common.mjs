import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const packageRoot = fileURLToPath(new URL("../", import.meta.url));
export const cliPath = fileURLToPath(new URL("../dist/src/cli/index.js", import.meta.url));
export const fixturePath = fileURLToPath(
  new URL("../tests/fixtures/recorder-host.mjs", import.meta.url),
);
const storageModuleUrl = new URL(
  "../dist/src/lib/storage/index.js",
  import.meta.url,
);
const inputText = "ship pnpm test on src/app.ts\n";
const expectedRoles = ["user", "assistant", "assistant"];
const expectedAssistantMessages = [
  "assistant:ship pnpm test on src/app.ts",
  "done:ship pnpm test on src/app.ts",
];

export function assertBuiltCli() {
  assert.ok(
    existsSync(cliPath),
    `Missing build output at ${cliPath}. Run "pnpm --dir packages/mcp-server build" first.`,
  );
}

export function getSmokeInput() {
  return inputText;
}

export function runCli(args, options = {}) {
  const stdinMode = options.stdinMode ?? "pipe";

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, ...args], {
      cwd: options.cwd ?? packageRoot,
      env: {
        ...process.env,
        ...options.env,
      },
      stdio: [stdinMode === "inherit" ? "inherit" : "pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    });

    child.once("error", reject);
    child.once("close", (code) => {
      resolve({ code, stdout, stderr });
    });

    if (stdinMode === "pipe") {
      child.stdin.end(options.input ?? "");
    } else if (options.input !== undefined) {
      reject(
        new Error(
          'runCli received explicit input while stdinMode="inherit"; provide input through the inherited terminal instead.',
        ),
      );
    }
  });
}

export function assertCliOutput(result, label) {
  assert.equal(
    result.code,
    0,
    `${label} failed with exit code ${result.code}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
  );
  assert.match(result.stdout, /assistant:ship pnpm test on src\/app\.ts/);
  assert.match(result.stdout, /done:ship pnpm test on src\/app\.ts/);
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(
      `Failed to parse ${label}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function verifyRecordedSession(options) {
  const { EvidenceDatabase } = await import(storageModuleUrl.href);
  const db = new EvidenceDatabase(options.dbPath);

  try {
    const sessions = db.listSessions();
    assert.equal(sessions.length, 1, "Expected exactly one recorded session");

    const detail = db.getSessionDetail(sessions[0].id);
    assert.ok(detail, "Expected recorded session detail");
    assert.equal(detail.session.status, "completed");

    const sessionMetadata = parseJson(
      detail.session.metadata ?? "{}",
      "session metadata",
    );
    const startEvent = detail.timeline.find(
      (event) => event.eventType === "session.start",
    );
    assert.ok(startEvent?.payload, "Expected session.start payload");
    const startPayload = parseJson(startEvent.payload, "session.start payload");

    assert.equal(sessionMetadata.transport, "pty");
    assert.equal(sessionMetadata.ptyDriver, "script");
    assert.equal(sessionMetadata.ptyStdinMode, options.expectedStdinMode);
    assert.equal(sessionMetadata.fallbackReason, null);
    assert.equal(startPayload.transport, "pty");
    assert.equal(startPayload.ptyDriver, "script");
    assert.equal(startPayload.ptyStdinMode, options.expectedStdinMode);
    assert.equal(startPayload.fallbackReason, null);
    assert.equal(
      sessionMetadata.ptyTranscriptFormat ?? null,
      options.expectedTranscriptFormat,
    );
    assert.equal(
      startPayload.ptyTranscriptFormat ?? null,
      options.expectedTranscriptFormat,
    );

    assert.deepEqual(
      detail.messages.map((message) => message.role),
      expectedRoles,
    );
    assert.equal(detail.messages[0]?.content, inputText.trim());
    assert.deepEqual(
      detail.messages.slice(1).map((message) => message.content),
      expectedAssistantMessages,
    );

    const timelineEventTypes = detail.timeline.map((event) => event.eventType);
    assert.ok(
      timelineEventTypes.includes("tool.started"),
      `Expected adapter timeline event in ${timelineEventTypes.join(", ")}`,
    );
    assert.equal(detail.timeline.at(-1)?.eventType, "session.end");
  } finally {
    db.close();
  }
}
