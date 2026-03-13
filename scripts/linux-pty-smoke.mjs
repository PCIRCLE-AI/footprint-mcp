import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import {
  assertBuiltCli,
  assertCliOutput,
  fixturePath,
  getSmokeInput,
  packageRoot,
  runCli,
  verifyRecordedSession,
} from "./session-pty-smoke-common.mjs";

function detectAdvancedTranscriptSupport() {
  const result = spawnSync("script", ["--help"], {
    cwd: packageRoot,
    encoding: "utf8",
  });
  const helpText = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  return (
    helpText.includes("--log-in") &&
    helpText.includes("--log-out") &&
    helpText.includes("--log-timing") &&
    helpText.includes("--logging-format")
  );
}

async function main() {
  assert.equal(
    process.platform,
    "linux",
    "packages/mcp-server/scripts/linux-pty-smoke.mjs must run on Linux",
  );
  assertBuiltCli();

  const supportsAdvancedTranscript = detectAdvancedTranscriptSupport();
  const tempDir = mkdtempSync(path.join(tmpdir(), "footprint-linux-pty-smoke-"));
  const dbPath = path.join(tempDir, "footprint.db");

  try {
    const result = await runCli(
      ["run", "claude", "--", fixturePath, "--emit-adapter"],
      {
        input: getSmokeInput(),
        env: {
          FOOTPRINT_CLAUDE_COMMAND: process.execPath,
          FOOTPRINT_DB_PATH: dbPath,
          FOOTPRINT_PTY_MODE: "force",
        },
      },
    );
    assertCliOutput(result, "Linux PTY smoke");
    await verifyRecordedSession({
      dbPath,
      expectedTranscriptFormat: supportsAdvancedTranscript
        ? "util-linux-advanced"
        : null,
      expectedStdinMode: "pipe",
    });

    console.log(
      `Linux PTY smoke passed (${supportsAdvancedTranscript ? "util-linux advanced transcript" : "script fallback transcript"})`,
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Linux PTY smoke failed: ${message}`);
  process.exit(1);
});
