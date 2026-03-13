import { appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

process.stdin.setEncoding("utf8");

let captured = "";
let completed = false;
const adapterPrefixByHost = {
  claude: "FOOTPRINT_CLAUDE_EVENT",
  gemini: "FOOTPRINT_GEMINI_EVENT",
  codex: "FOOTPRINT_CODEX_EVENT",
};
const host = process.env.FOOTPRINT_SESSION_HOST || "claude";
const shouldEmitAdapter = process.argv.includes("--emit-adapter");
const shouldEmitReady = process.argv.includes("--emit-ready");

function emitAdapterEvent(event) {
  const adapterPrefix = adapterPrefixByHost[host] || adapterPrefixByHost.claude;
  process.stdout.write(`${adapterPrefix} ${JSON.stringify(event)}\n`);
}

if (shouldEmitReady) {
  emitAdapterEvent({
    eventType: "session.ready",
    eventSubType: "smoke",
    summary: "footprint-smoke-ready",
    payload: { host },
    status: "ready",
  });
}

function finishSession() {
  if (completed) {
    return;
  }

  completed = true;

  if (process.argv.includes("--touch-file")) {
    appendFileSync("notes.txt", `touched:${captured.trim() || "empty"}\n`, "utf8");
  }

  if (process.argv.includes("--commit")) {
    execFileSync("git", ["config", "user.name", "Footprint Test"], {
      stdio: "ignore",
    });
    execFileSync("git", ["config", "user.email", "footprint@example.com"], {
      stdio: "ignore",
    });
    execFileSync("git", ["add", "notes.txt"], { stdio: "ignore" });
    execFileSync("git", ["commit", "-m", "fixture commit"], { stdio: "ignore" });
  }

  if (process.argv.includes("--fail")) {
    process.stderr.write("simulated failure\n");
    process.exit(7);
  }

  process.stdout.write(`done:${captured.trim() || "no-input"}\n`);
  process.exit(0);
}

process.stdin.on("data", (chunk) => {
  captured += chunk;
  const lines = chunk.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    if (shouldEmitAdapter) {
      emitAdapterEvent({
        eventType: "tool.started",
        eventSubType: host === "codex" ? "patch" : host === "gemini" ? "shell" : "edit",
        summary: `${host} adapter event for ${line}`,
        payload: {
          tool:
            host === "codex"
              ? "apply_patch"
              : host === "gemini"
                ? "shell"
                : "edit_file",
          host,
          line,
        },
        status: "running",
      });
    }
    process.stdout.write(`assistant:${line}\n`);
  }
});

process.stdin.on("end", () => {
  finishSession();
});
