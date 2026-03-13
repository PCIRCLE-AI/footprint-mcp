import { describe, expect, it } from "vitest";
import { getHostAdapter } from "../src/adapters/index.js";

const adapterContext = {
  host: "claude" as const,
  cwd: "/tmp/project",
  args: ["--resume"],
};

describe("Host adapters", () => {
  it("registers adapters for all supported hosts", () => {
    expect(getHostAdapter("claude")?.name).toBe("claude-adapter");
    expect(getHostAdapter("gemini")?.name).toBe("gemini-adapter");
    expect(getHostAdapter("codex")?.name).toBe("codex-adapter");
  });

  it("parses host-specific structured event prefixes", () => {
    const claudeResult = getHostAdapter("claude")?.parseLine(
      'FOOTPRINT_CLAUDE_EVENT {"eventType":"tool.started","summary":"claude"}',
      "stdout",
      adapterContext,
    );
    const geminiResult = getHostAdapter("gemini")?.parseLine(
      'FOOTPRINT_GEMINI_EVENT {"eventType":"tool.started","summary":"gemini"}',
      "stderr",
      { ...adapterContext, host: "gemini" },
    );
    const codexResult = getHostAdapter("codex")?.parseLine(
      'FOOTPRINT_CODEX_EVENT {"eventType":"tool.started","summary":"codex"}',
      "stdout",
      { ...adapterContext, host: "codex" },
    );

    expect(claudeResult?.suppressTranscript).toBe(true);
    expect(claudeResult?.events?.[0]?.payload).toMatchObject({
      stream: "stdout",
    });

    expect(geminiResult?.suppressTranscript).toBe(true);
    expect(geminiResult?.events?.[0]?.payload).toMatchObject({
      stream: "stderr",
    });

    expect(codexResult?.suppressTranscript).toBe(true);
    expect(codexResult?.events?.[0]?.payload).toMatchObject({
      stream: "stdout",
    });
  });

  it("records parse errors instead of dropping malformed structured events", () => {
    const result = getHostAdapter("gemini")?.parseLine(
      "FOOTPRINT_GEMINI_EVENT {not-json}",
      "stdout",
      { ...adapterContext, host: "gemini" },
    );

    expect(result?.handled).toBe(true);
    expect(result?.suppressTranscript).toBe(false);
    expect(result?.events?.[0]).toMatchObject({
      eventType: "error.observed",
      status: "parse-error",
      summary: "gemini-adapter failed to parse host event",
    });
  });
});
