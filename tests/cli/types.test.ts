import { describe, it, expect } from "vitest";
import type {
  SetupConfig,
  SystemInfo,
  ClaudeConfig,
} from "../../src/cli/types.js";

describe("CLI Types", () => {
  it("should accept valid SetupConfig", () => {
    const config: SetupConfig = {
      dataDir: "/path/to/data",
      passphrase: "test-pass-123",
      autoConfig: true,
    };
    expect(config.dataDir).toBe("/path/to/data");
  });

  it("should accept valid SystemInfo", () => {
    const info: SystemInfo = {
      platform: "darwin",
      shell: "zsh",
      claudeConfigPath: "/path/to/config",
      homeDir: "/Users/test",
      shellRcPath: "/Users/test/.zshrc",
    };
    expect(info.platform).toBe("darwin");
  });
});
