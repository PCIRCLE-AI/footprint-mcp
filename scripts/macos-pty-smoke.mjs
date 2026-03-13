import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  assertBuiltCli,
  fixturePath,
  packageRoot,
  cliPath,
  verifyRecordedSession,
} from "./session-pty-smoke-common.mjs";

const driverPath = path.join(packageRoot, "scripts", "macos-pty-driver.py");

function runPtyDriver(options) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "python3",
      [
        driverPath,
        process.execPath,
        cliPath,
        fixturePath,
      ],
      {
        cwd: packageRoot,
        env: {
          ...process.env,
          ...options.env,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

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
  });
}

function assertPythonAvailable() {
  const result = spawnSync("python3", ["--version"], {
    cwd: packageRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.error || result.status !== 0) {
    const detail =
      result.error?.message ||
      result.stderr?.trim() ||
      result.stdout?.trim() ||
      "python3 is required for macOS PTY smoke";
    throw new Error(
      `macOS PTY smoke requires python3 on PATH. ${detail}`,
    );
  }
}

async function main() {
  assert.equal(
    process.platform,
    "darwin",
    "packages/mcp-server/scripts/macos-pty-smoke.mjs must run on macOS",
  );
  assertBuiltCli();
  assertPythonAvailable();

  const tempDir = mkdtempSync(path.join(tmpdir(), "footprint-macos-pty-smoke-"));
  const dbPath = path.join(tempDir, "footprint.db");

  try {
    const result = await runPtyDriver({
      env: {
        FOOTPRINT_CLAUDE_COMMAND: process.execPath,
        FOOTPRINT_DB_PATH: dbPath,
        FOOTPRINT_PTY_MODE: "force",
      },
    });

    assert.equal(
      result.code,
      0,
      `macOS PTY smoke failed with exit code ${result.code}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`,
    );

    await verifyRecordedSession({
      dbPath,
      expectedTranscriptFormat: "script-bsd",
      expectedStdinMode: "inherit",
    });

    console.log("macOS PTY smoke passed (BSD script -r transcript)");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`macOS PTY smoke failed: ${message}`);
  process.exit(1);
});
