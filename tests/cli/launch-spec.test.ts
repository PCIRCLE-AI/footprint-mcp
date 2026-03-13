import { describe, expect, it } from "vitest";
import { resolveHostLaunchSpec } from "../../src/cli/launch-spec.js";

describe("CLI launch spec", () => {
  it("falls back to pipe mode by default when stdio is not a tty", () => {
    const spec = resolveHostLaunchSpec({
      hostCommand: "claude",
      hostArgs: ["--print"],
      env: {},
      platform: "darwin",
      stdinIsTTY: false,
      stdoutIsTTY: false,
      stderrIsTTY: false,
      scriptPath: "/usr/bin/script",
    });

    expect(spec.transport).toBe("pipe");
    expect(spec.command).toBe("claude");
    expect(spec.args).toEqual(["--print"]);
    expect(spec.fallbackReason).toBe("stdio-not-tty");
  });

  it("uses script-backed pty mode automatically on supported tty environments", () => {
    const spec = resolveHostLaunchSpec({
      hostCommand: "claude",
      hostArgs: ["chat", "--resume"],
      env: {},
      platform: "darwin",
      ptyTranscriptPath: "/tmp/footprint.typescript",
      stdinIsTTY: true,
      stdoutIsTTY: true,
      stderrIsTTY: true,
      scriptPath: "/usr/bin/script",
    });

    expect(spec.transport).toBe("pty");
    expect(spec.command).toBe("/usr/bin/script");
    expect(spec.args).toEqual([
      "-q",
      "-F",
      "-k",
      "-r",
      "/tmp/footprint.typescript",
      "claude",
      "chat",
      "--resume",
    ]);
    expect(spec.ptyDriver).toBe("script");
    expect(spec.ptyTranscriptFormat).toBe("script-bsd");
    expect(spec.ptyStdinMode).toBe("inherit");
    expect(spec.fallbackReason).toBeNull();
  });

  it("allows force mode to request pty on linux even when stdio is not a tty", () => {
    const spec = resolveHostLaunchSpec({
      hostCommand: "gemini",
      hostArgs: ["--plain"],
      env: { FOOTPRINT_PTY_MODE: "force" },
      platform: "linux",
      stdinIsTTY: false,
      stdoutIsTTY: false,
      stderrIsTTY: false,
      scriptPath: "/usr/bin/script",
    });

    expect(spec.transport).toBe("pty");
    expect(spec.command).toBe("/usr/bin/script");
    expect(spec.ptyTranscriptFormat).toBeNull();
    expect(spec.ptyStdinMode).toBe("pipe");
  });

  it("falls back when force mode cannot satisfy BSD script tty requirements", () => {
    const spec = resolveHostLaunchSpec({
      hostCommand: "gemini",
      hostArgs: ["--plain"],
      env: { FOOTPRINT_PTY_MODE: "force" },
      platform: "darwin",
      stdinIsTTY: false,
      stdoutIsTTY: false,
      stderrIsTTY: false,
      scriptPath: "/usr/bin/script",
    });

    expect(spec.transport).toBe("pipe");
    expect(spec.command).toBe("gemini");
    expect(spec.args).toEqual(["--plain"]);
    expect(spec.fallbackReason).toBe("pty-requires-tty-stdin");
  });

  it("respects explicit pty disablement", () => {
    const spec = resolveHostLaunchSpec({
      hostCommand: "codex",
      hostArgs: ["--json"],
      env: { FOOTPRINT_PTY_MODE: "off" },
      platform: "darwin",
      stdinIsTTY: true,
      stdoutIsTTY: true,
      stderrIsTTY: true,
      scriptPath: "/usr/bin/script",
    });

    expect(spec.transport).toBe("pipe");
    expect(spec.command).toBe("codex");
    expect(spec.args).toEqual(["--json"]);
    expect(spec.fallbackReason).toBe("pty-disabled");
  });

  it("falls back cleanly when script is unavailable", () => {
    const spec = resolveHostLaunchSpec({
      hostCommand: "claude",
      hostArgs: [],
      env: { FOOTPRINT_PTY_MODE: "force" },
      platform: "darwin",
      stdinIsTTY: true,
      stdoutIsTTY: true,
      stderrIsTTY: true,
      scriptPath: null,
    });

    expect(spec.transport).toBe("pipe");
    expect(spec.command).toBe("claude");
    expect(spec.fallbackReason).toBe("script-unavailable");
  });

  it("builds linux script invocations with util-linux advanced transcript logs", () => {
    const spec = resolveHostLaunchSpec({
      hostCommand: "claude",
      hostArgs: ["say", "it's ready"],
      env: { FOOTPRINT_PTY_MODE: "force" },
      platform: "linux",
      linuxScriptSupportsAdvancedTranscript: true,
      ptyInputPath: "/tmp/footprint.stdin",
      ptyOutputPath: "/tmp/footprint.stdout",
      ptyTimingPath: "/tmp/footprint.timing",
      stdinIsTTY: true,
      stdoutIsTTY: true,
      stderrIsTTY: true,
      scriptPath: "/usr/bin/script",
    });

    expect(spec.transport).toBe("pty");
    expect(spec.command).toBe("/usr/bin/script");
    expect(spec.args).toEqual([
      "--quiet",
      "--return",
      "--echo",
      "never",
      "--log-in",
      "/tmp/footprint.stdin",
      "--log-out",
      "/tmp/footprint.stdout",
      "--log-timing",
      "/tmp/footprint.timing",
      "--logging-format",
      "advanced",
      "--command",
      "'claude' 'say' 'it'\\''s ready'",
    ]);
    expect(spec.ptyTranscriptFormat).toBe("util-linux-advanced");
    expect(spec.ptyStdinMode).toBe("pipe");
  });

  it("falls back to linux -c mode when transcript paths are unavailable", () => {
    const spec = resolveHostLaunchSpec({
      hostCommand: "claude",
      hostArgs: ["say", "it's ready"],
      env: { FOOTPRINT_PTY_MODE: "force" },
      platform: "linux",
      linuxScriptSupportsAdvancedTranscript: false,
      ptyInputPath: "/tmp/footprint.stdin",
      ptyOutputPath: "/tmp/footprint.stdout",
      ptyTimingPath: "/tmp/footprint.timing",
      stdinIsTTY: true,
      stdoutIsTTY: true,
      stderrIsTTY: true,
      scriptPath: "/usr/bin/script",
    });

    expect(spec.transport).toBe("pty");
    expect(spec.command).toBe("/usr/bin/script");
    expect(spec.args).toEqual([
      "-q",
      "-e",
      "-c",
      "'claude' 'say' 'it'\\''s ready'",
      "/dev/null",
    ]);
    expect(spec.ptyTranscriptFormat).toBeNull();
    expect(spec.ptyStdinMode).toBe("pipe");
  });
});
