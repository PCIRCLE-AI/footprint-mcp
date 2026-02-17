import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  readClaudeConfig,
  writeClaudeConfig,
  backupConfig,
} from "../../../src/cli/utils/config.js";
import * as fs from "fs";
import * as path from "path";
import { tmpdir } from "os";

describe("Config File Management", () => {
  let tempDir: string;
  let testConfigPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), "footprint-test-"));
    testConfigPath = path.join(tempDir, "claude_desktop_config.json");
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  it("should read existing config file", () => {
    const config = { mcpServers: { test: { command: "test", args: [] } } };
    fs.writeFileSync(testConfigPath, JSON.stringify(config));

    const result = readClaudeConfig(testConfigPath);
    expect(result).toEqual(config);
  });

  it("should return empty config if file does not exist", () => {
    const result = readClaudeConfig("/nonexistent/path.json");
    expect(result).toEqual({});
  });

  it("should write config file", () => {
    const config = {
      mcpServers: {
        footprint: { command: "npx", args: ["@pcircle/footprint"] },
      },
    };
    writeClaudeConfig(testConfigPath, config);

    const written = JSON.parse(fs.readFileSync(testConfigPath, "utf-8"));
    expect(written).toEqual(config);
  });

  it("should backup existing config", () => {
    const config = { mcpServers: {} };
    fs.writeFileSync(testConfigPath, JSON.stringify(config));

    const backupPath = backupConfig(testConfigPath);
    expect(fs.existsSync(backupPath)).toBe(true);
    expect(backupPath).toContain(".backup");
  });
});
