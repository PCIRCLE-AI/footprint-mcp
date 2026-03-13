import { execFileSync } from "node:child_process";

export type LaunchTransport = "pipe" | "pty";
export type PtyMode = "auto" | "force" | "off";
export type PtyTranscriptFormat = "script-bsd" | "util-linux-advanced" | null;
export type PtyStdinMode = "inherit" | "pipe" | null;

export interface HostLaunchSpec {
  command: string;
  args: string[];
  transport: LaunchTransport;
  ptyDriver: "script" | null;
  ptyTranscriptFormat: PtyTranscriptFormat;
  ptyStdinMode: PtyStdinMode;
  fallbackReason: string | null;
}

interface ResolveLaunchSpecOptions {
  hostCommand: string;
  hostArgs: string[];
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  linuxScriptSupportsAdvancedTranscript?: boolean | null;
  ptyTranscriptPath?: string | null;
  ptyInputPath?: string | null;
  ptyOutputPath?: string | null;
  ptyTimingPath?: string | null;
  stdinIsTTY?: boolean;
  stdoutIsTTY?: boolean;
  stderrIsTTY?: boolean;
  scriptPath?: string | null;
}

function resolvePtyMode(env: NodeJS.ProcessEnv | undefined): PtyMode {
  const raw = env?.FOOTPRINT_PTY_MODE?.trim().toLowerCase();
  if (raw === "force") {
    return "force";
  }
  if (raw === "off" || raw === "pipe" || raw === "disabled") {
    return "off";
  }
  return "auto";
}

function shouldUsePty(
  mode: PtyMode,
  options: ResolveLaunchSpecOptions,
): boolean {
  if (mode === "off") {
    return false;
  }

  if (mode === "force") {
    const platform = options.platform ?? process.platform;

    // BSD/macOS `script` expects a real terminal for stdin. Falling back to
    // pipes avoids hard failures in CI or other non-interactive callers.
    if (
      (platform === "darwin" ||
        platform === "freebsd" ||
        platform === "openbsd") &&
      !options.stdinIsTTY
    ) {
      return false;
    }

    return true;
  }

  return Boolean(
    options.stdinIsTTY && options.stdoutIsTTY && options.stderrIsTTY,
  );
}

function getScriptPath(
  platform: NodeJS.Platform,
  explicitPath?: string | null,
): string | null {
  if (explicitPath !== undefined) {
    return explicitPath;
  }

  if (platform === "win32") {
    return null;
  }

  try {
    const resolved = execFileSync("which", ["script"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return resolved || null;
  } catch {
    return null;
  }
}

function supportsLinuxAdvancedTranscript(
  scriptPath: string,
  explicitSupport?: boolean | null,
): boolean {
  if (explicitSupport !== undefined && explicitSupport !== null) {
    return explicitSupport;
  }

  try {
    const helpOutput = execFileSync(scriptPath, ["--help"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return (
      helpOutput.includes("--log-in") &&
      helpOutput.includes("--log-out") &&
      helpOutput.includes("--log-timing") &&
      helpOutput.includes("--logging-format")
    );
  } catch {
    return false;
  }
}

function escapePosixArg(value: string): string {
  if (value.length === 0) {
    return "''";
  }

  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function buildLinuxScriptArgs(
  command: string,
  args: string[],
  options: {
    inputPath?: string | null;
    outputPath?: string | null;
    timingPath?: string | null;
  },
): string[] {
  if (!options.inputPath || !options.outputPath || !options.timingPath) {
    return [
      "-q",
      "-e",
      "-c",
      [command, ...args].map(escapePosixArg).join(" "),
      "/dev/null",
    ];
  }

  return [
    "--quiet",
    "--return",
    "--echo",
    "never",
    "--log-in",
    options.inputPath,
    "--log-out",
    options.outputPath,
    "--log-timing",
    options.timingPath,
    "--logging-format",
    "advanced",
    "--command",
    [command, ...args].map(escapePosixArg).join(" "),
  ];
}

function buildBsdScriptArgs(
  command: string,
  args: string[],
  transcriptPath?: string | null,
): string[] {
  if (transcriptPath) {
    return ["-q", "-F", "-k", "-r", transcriptPath, command, ...args];
  }

  return ["-q", "/dev/null", command, ...args];
}

export function resolveHostLaunchSpec(
  options: ResolveLaunchSpecOptions,
): HostLaunchSpec {
  const platform = options.platform ?? process.platform;
  const mode = resolvePtyMode(options.env);
  const forcedBsdWithoutTTY =
    mode === "force" &&
    (platform === "darwin" ||
      platform === "freebsd" ||
      platform === "openbsd") &&
    !options.stdinIsTTY;

  if (!shouldUsePty(mode, options)) {
    return {
      command: options.hostCommand,
      args: options.hostArgs,
      transport: "pipe",
      ptyDriver: null,
      ptyTranscriptFormat: null,
      ptyStdinMode: null,
      fallbackReason: forcedBsdWithoutTTY
        ? "pty-requires-tty-stdin"
        : mode === "off"
          ? "pty-disabled"
          : "stdio-not-tty",
    };
  }

  const scriptPath = getScriptPath(platform, options.scriptPath);
  if (!scriptPath) {
    return {
      command: options.hostCommand,
      args: options.hostArgs,
      transport: "pipe",
      ptyDriver: null,
      ptyTranscriptFormat: null,
      ptyStdinMode: null,
      fallbackReason: "script-unavailable",
    };
  }

  if (platform === "linux") {
    const supportsAdvancedTranscript =
      Boolean(
        options.ptyInputPath && options.ptyOutputPath && options.ptyTimingPath,
      ) &&
      supportsLinuxAdvancedTranscript(
        scriptPath,
        options.linuxScriptSupportsAdvancedTranscript,
      );

    return {
      command: scriptPath,
      args: buildLinuxScriptArgs(options.hostCommand, options.hostArgs, {
        inputPath: supportsAdvancedTranscript ? options.ptyInputPath : null,
        outputPath: supportsAdvancedTranscript ? options.ptyOutputPath : null,
        timingPath: supportsAdvancedTranscript ? options.ptyTimingPath : null,
      }),
      transport: "pty",
      ptyDriver: "script",
      ptyTranscriptFormat: supportsAdvancedTranscript
        ? "util-linux-advanced"
        : null,
      ptyStdinMode: "pipe",
      fallbackReason: null,
    };
  }

  if (
    platform === "darwin" ||
    platform === "freebsd" ||
    platform === "openbsd"
  ) {
    return {
      command: scriptPath,
      args: buildBsdScriptArgs(
        options.hostCommand,
        options.hostArgs,
        options.ptyTranscriptPath,
      ),
      transport: "pty",
      ptyDriver: "script",
      ptyTranscriptFormat: options.ptyTranscriptPath ? "script-bsd" : null,
      ptyStdinMode: "inherit",
      fallbackReason: null,
    };
  }

  return {
    command: options.hostCommand,
    args: options.hostArgs,
    transport: "pipe",
    ptyDriver: null,
    ptyTranscriptFormat: null,
    ptyStdinMode: null,
    fallbackReason: "platform-unsupported",
  };
}
