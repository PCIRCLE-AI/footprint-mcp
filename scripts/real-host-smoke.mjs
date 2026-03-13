import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  assertBuiltCli,
  cliPath,
  packageRoot,
} from "./session-pty-smoke-common.mjs";

const storageModuleUrl = new URL(
  "../dist/src/lib/storage/index.js",
  import.meta.url,
);
const supportedHosts = ["claude", "gemini", "codex"];
const hostCommandEnvVar = {
  claude: "FOOTPRINT_CLAUDE_COMMAND",
  gemini: "FOOTPRINT_GEMINI_COMMAND",
  codex: "FOOTPRINT_CODEX_COMMAND",
};

function parseRequestedHosts(argv) {
  const requested = argv.length > 0 ? argv : supportedHosts;
  for (const host of requested) {
    assert.ok(
      supportedHosts.includes(host),
      `Unsupported host "${host}". Supported hosts: ${supportedHosts.join(", ")}`,
    );
  }

  return requested;
}

function resolveCommandPath(host) {
  const envVar = hostCommandEnvVar[host];
  const configured = process.env[envVar];
  if (configured) {
    return configured;
  }

  const locator = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(locator, [host], {
    cwd: packageRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error || result.status !== 0) {
    return null;
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? null;
}

function runRecordedHostVersion(host, commandPath, dbPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [cliPath, "run", host, "--", "--version"],
      {
        cwd: packageRoot,
        env: {
          ...process.env,
          FOOTPRINT_DB_PATH: dbPath,
          [hostCommandEnvVar[host]]: commandPath,
        },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );

    let stdout = "";
    let stderr = "";
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      child.kill("SIGTERM");
      reject(new Error(`${host} real-host smoke timed out after 20s`));
    }, 20_000);

    child.stdout.on("data", (chunk) => {
      stdout += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    });

    child.once("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      reject(error);
    });

    child.once("close", (code, signal) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      resolve({ code, signal, stdout, stderr });
    });

    child.stdin.end();
  });
}

function parseJson(value, label) {
  try {
    return JSON.parse(value ?? "{}");
  } catch (error) {
    throw new Error(
      `Failed to parse ${label}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function verifyRecordedHostSession(host, commandPath, dbPath, result) {
  const { EvidenceDatabase } = await import(storageModuleUrl.href);
  const db = new EvidenceDatabase(dbPath);

  try {
    const sessions = db.listSessions();
    assert.equal(sessions.length, 1, `Expected one recorded ${host} session`);

    const detail = db.getSessionDetail(sessions[0].id);
    assert.ok(detail, `Expected ${host} session detail`);
    assert.equal(detail.session.host, host);
    assert.equal(detail.session.status, "completed");

    const metadata = parseJson(detail.session.metadata, `${host} metadata`);
    const startEvent = detail.timeline.find(
      (event) => event.eventType === "session.start",
    );
    assert.ok(startEvent?.payload, `Expected ${host} session.start payload`);
    const startPayload = parseJson(
      startEvent.payload,
      `${host} session.start payload`,
    );

    assert.equal(metadata.command, commandPath);
    assert.deepEqual(metadata.args, ["--version"]);
    assert.equal(metadata.transport, "pipe");
    assert.equal(metadata.ptyTranscriptFormat ?? null, null);
    assert.equal(metadata.ptyStdinMode ?? null, null);
    assert.equal(metadata.fallbackReason, "stdio-not-tty");
    assert.equal(startPayload.transport, "pipe");
    assert.equal(startPayload.ptyTranscriptFormat ?? null, null);
    assert.equal(startPayload.ptyStdinMode ?? null, null);
    assert.equal(startPayload.fallbackReason, "stdio-not-tty");

    const combinedOutput = `${result.stdout}\n${result.stderr}`.trim();
    assert.ok(combinedOutput.length > 0, `Expected ${host} version output`);
    const assistantMessages = detail.messages
      .filter((message) => message.role === "assistant")
      .map((message) => message.content.trim())
      .filter(Boolean);
    assert.ok(
      assistantMessages.length > 0,
      `Expected recorded assistant transcript for ${host}`,
    );
    assert.ok(
      assistantMessages.some((message) => combinedOutput.includes(message)),
      `Expected ${host} transcript to match captured CLI output`,
    );

    const timelineEventTypes = detail.timeline.map((event) => event.eventType);
    assert.ok(
      timelineEventTypes.includes("session.start"),
      `Expected session.start for ${host}`,
    );
    assert.equal(detail.timeline.at(-1)?.eventType, "session.end");
  } finally {
    db.close();
  }
}

async function runHostSmoke(host) {
  const commandPath = resolveCommandPath(host);
  if (!commandPath) {
    console.log(`Skipping ${host}: binary not found on PATH`);
    return { host, skipped: true };
  }

  const tempDir = mkdtempSync(path.join(tmpdir(), `footprint-${host}-smoke-`));
  const dbPath = path.join(tempDir, "footprint.db");

  try {
    const result = await runRecordedHostVersion(host, commandPath, dbPath);
    assert.equal(
      result.code,
      0,
      `${host} recorder smoke failed with exit code ${result.code ?? "null"}${result.signal ? ` signal ${result.signal}` : ""}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );
    await verifyRecordedHostSession(host, commandPath, dbPath, result);
    console.log(`Real-host smoke passed for ${host} (${commandPath})`);
    return { host, skipped: false };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  assertBuiltCli();
  const requestedHosts = parseRequestedHosts(process.argv.slice(2));
  const results = [];

  for (const host of requestedHosts) {
    results.push(await runHostSmoke(host));
  }

  const executedHosts = results.filter((result) => !result.skipped);
  if (executedHosts.length === 0) {
    console.log("Real-host smoke skipped: no supported host binaries found");
    return;
  }

  console.log(
    `Real-host smoke completed for ${executedHosts.map((result) => result.host).join(", ")}`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Real-host smoke failed: ${message}`);
  process.exit(1);
});
