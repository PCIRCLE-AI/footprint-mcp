/* global NodeJS, process, console */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { tmpdir } from "os";
import type { Ora } from "ora";

// Type aliases for test mocks
type PromptsResponse = Record<string, string | boolean | undefined>;
type MockSpinner = Partial<Ora>;

// Create mocks using vi.hoisted to ensure they're available during module initialization
const mockChalk = vi.hoisted(() => {
  const passthrough = (s: string) => s;
  return Object.assign(passthrough, {
    bold: Object.assign(passthrough, {
      cyan: passthrough,
      green: passthrough,
    }),
    green: passthrough,
    yellow: passthrough,
    red: passthrough,
    gray: passthrough,
  });
});

// Mock modules BEFORE importing setup
vi.mock("prompts");
vi.mock("ora");
vi.mock("chalk", () => ({ default: mockChalk }));

// Mock detectSystem
vi.mock("../../src/cli/utils/detect.js", () => ({
  detectSystem: vi.fn(),
}));

// Import after mocks are set up
import { runSetup } from "../../src/cli/setup.js";
import { detectSystem } from "../../src/cli/utils/detect.js";
import * as os from "os";

describe("CLI Integration Tests", () => {
  let tempDir: string;
  let tempConfigPath: string;
  let tempShellRcPath: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Create temp directory for test files inside user's home directory
    // This is required because validatePath now restricts paths to home directory
    tempDir = fs.mkdtempSync(
      path.join(os.homedir(), ".footprint-integration-test-"),
    );
    tempConfigPath = path.join(tempDir, "claude_desktop_config.json");
    tempShellRcPath = path.join(tempDir, ".zshrc");

    // Save original environment
    originalEnv = { ...process.env };

    // Mock console methods - keep error visible for debugging
    vi.spyOn(console, "log").mockImplementation(() => {});
    // Capture errors but don't suppress them
    const originalError = console.error;
    vi.spyOn(console, "error").mockImplementation((...args) => {
      originalError.apply(console, args);
    });
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }

    // Restore environment
    process.env = originalEnv;

    // Restore console
    vi.restoreAllMocks();
  });

  it("should complete full setup flow with auto-configuration", async () => {
    // Create a mock Claude config file
    const existingConfig = {
      mcpServers: {
        "existing-server": {
          command: "test",
          args: ["arg"],
        },
      },
    };
    fs.writeFileSync(tempConfigPath, JSON.stringify(existingConfig, null, 2));

    // Mock detectSystem to return our temp paths
    vi.mocked(detectSystem).mockReturnValue({
      platform: "darwin",
      shell: "zsh",
      homeDir: tempDir,
      claudeConfigPath: tempConfigPath,
      shellRcPath: tempShellRcPath,
    });

    // Mock prompts module
    const prompts = await import("prompts");
    type PromptsResponse = Record<string, string | boolean | undefined>;
    vi.mocked(prompts.default).mockImplementation(
      async (questions: unknown): Promise<PromptsResponse> => {
        // First prompt batch (main setup)
        if (Array.isArray(questions)) {
          return {
            dataDir: path.join(tempDir, ".footprint"),
            passphrase: "test-secure-password-12345",
            confirmPassphrase: "test-secure-password-12345",
            autoConfig: true,
          };
        }
        // Second prompt (environment setup)
        return {
          setupEnv: false, // Skip env setup for this test
        };
      },
    );

    // Mock ora spinner
    const ora = await import("ora");
    const mockSpinner: MockSpinner = {
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      info: vi.fn().mockReturnThis(),
    };
    vi.mocked(ora.default).mockReturnValue(mockSpinner as Ora);

    // Run setup
    await runSetup();

    // Verify data directory was created
    const dataDir = path.join(tempDir, ".footprint");
    expect(fs.existsSync(dataDir)).toBe(true);

    // Verify Claude config was updated
    const updatedConfig = JSON.parse(fs.readFileSync(tempConfigPath, "utf-8"));
    expect(updatedConfig.mcpServers).toHaveProperty("footprint");
    expect(updatedConfig.mcpServers.footprint).toMatchObject({
      command: "npx",
      args: ["@pcircle/footprint"],
      env: {
        FOOTPRINT_DATA_DIR: dataDir,
        FOOTPRINT_PASSPHRASE: "test-secure-password-12345",
      },
    });

    // Verify existing server is preserved
    expect(updatedConfig.mcpServers).toHaveProperty("existing-server");

    // Verify backup was created
    const backupFiles = fs
      .readdirSync(tempDir)
      .filter((f) => f.includes(".backup"));
    expect(backupFiles.length).toBeGreaterThan(0);
  });

  it("should handle setup cancellation gracefully", async () => {
    // Mock detectSystem
    vi.mocked(detectSystem).mockReturnValue({
      platform: "darwin",
      shell: "zsh",
      homeDir: tempDir,
      claudeConfigPath: tempConfigPath,
      shellRcPath: tempShellRcPath,
    });

    // Mock prompts to simulate cancellation
    const prompts = await import("prompts");
    vi.mocked(prompts.default).mockResolvedValue({
      // User cancelled during passphrase entry
      dataDir: path.join(tempDir, ".footprint"),
      passphrase: undefined, // This triggers cancellation
    });

    // Mock process.exit to prevent actual exit
    const exitMock = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as never);

    // Run setup
    await runSetup();

    // Verify that setup was cancelled
    expect(exitMock).toHaveBeenCalledWith(0);

    // Verify no files were created
    const dataDir = path.join(tempDir, ".footprint");
    expect(fs.existsSync(dataDir)).toBe(false);
    expect(fs.existsSync(tempConfigPath)).toBe(false);

    exitMock.mockRestore();
  });

  it("should backup existing config before modification", async () => {
    // Create existing Claude config
    const existingConfig = {
      mcpServers: {
        "important-server": {
          command: "important",
          args: ["keep", "this"],
        },
      },
      otherSettings: {
        theme: "dark",
      },
    };
    fs.writeFileSync(tempConfigPath, JSON.stringify(existingConfig, null, 2));

    // Mock detectSystem
    vi.mocked(detectSystem).mockReturnValue({
      platform: "darwin",
      shell: "zsh",
      homeDir: tempDir,
      claudeConfigPath: tempConfigPath,
      shellRcPath: tempShellRcPath,
    });

    // Mock prompts
    const prompts = await import("prompts");
    vi.mocked(prompts.default).mockImplementation(
      async (questions: unknown): Promise<PromptsResponse> => {
        if (Array.isArray(questions)) {
          return {
            dataDir: path.join(tempDir, ".footprint"),
            passphrase: "secure-test-pass-123456",
            confirmPassphrase: "secure-test-pass-123456",
            autoConfig: true,
          };
        }
        return { setupEnv: false };
      },
    );

    // Mock ora
    const ora = await import("ora");
    const mockSpinner: MockSpinner = {
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      info: vi.fn().mockReturnThis(),
    };
    vi.mocked(ora.default).mockReturnValue(mockSpinner as Ora);

    // Run setup
    await runSetup();

    // Find backup file
    const backupFiles = fs
      .readdirSync(tempDir)
      .filter((f) => f.includes(".backup"));
    expect(backupFiles.length).toBe(1);

    const backupPath = path.join(tempDir, backupFiles[0]);
    const backupContent = JSON.parse(fs.readFileSync(backupPath, "utf-8"));

    // Verify backup contains original config
    expect(backupContent).toEqual(existingConfig);

    // Verify new config has both old and new servers
    const newConfig = JSON.parse(fs.readFileSync(tempConfigPath, "utf-8"));
    expect(newConfig.mcpServers).toHaveProperty("important-server");
    expect(newConfig.mcpServers).toHaveProperty("footprint");
    expect(newConfig.otherSettings).toEqual({ theme: "dark" });
  });

  it("should handle environment variable setup when requested", async () => {
    // Create shell rc file
    const existingRcContent =
      "# Existing shell config\nexport PATH=$PATH:/usr/local/bin\n";
    fs.writeFileSync(tempShellRcPath, existingRcContent);

    // Mock detectSystem
    vi.mocked(detectSystem).mockReturnValue({
      platform: "darwin",
      shell: "zsh",
      homeDir: tempDir,
      claudeConfigPath: null, // No Claude config
      shellRcPath: tempShellRcPath,
    });

    // Mock prompts
    const prompts = await import("prompts");
    vi.mocked(prompts.default).mockImplementation(
      async (questions: unknown): Promise<PromptsResponse> => {
        if (Array.isArray(questions)) {
          return {
            dataDir: path.join(tempDir, ".footprint"),
            passphrase: "env-test-password-123456",
            confirmPassphrase: "env-test-password-123456",
            autoConfig: false, // Skip Claude config
          };
        }
        // Environment setup prompt
        return { setupEnv: true };
      },
    );

    // Mock ora
    const ora = await import("ora");
    const mockSpinner: MockSpinner = {
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      info: vi.fn().mockReturnThis(),
    };
    vi.mocked(ora.default).mockReturnValue(mockSpinner as Ora);

    // Run setup
    await runSetup();

    // Verify environment variables were added to shell rc
    const updatedRcContent = fs.readFileSync(tempShellRcPath, "utf-8");

    // Check that original content is preserved
    expect(updatedRcContent).toContain(existingRcContent.trim());

    // Check that Footprint env vars were added
    expect(updatedRcContent).toContain("FOOTPRINT_DATA_DIR");
    expect(updatedRcContent).toContain("FOOTPRINT_PASSPHRASE");
    expect(updatedRcContent).toContain(path.join(tempDir, ".footprint"));
  });

  it("should handle missing Claude Desktop gracefully", async () => {
    // Mock detectSystem to simulate no Claude Desktop
    vi.mocked(detectSystem).mockReturnValue({
      platform: "darwin",
      shell: "zsh",
      homeDir: tempDir,
      claudeConfigPath: null, // No Claude Desktop found
      shellRcPath: tempShellRcPath,
    });

    // Mock prompts
    const prompts = await import("prompts");
    vi.mocked(prompts.default).mockImplementation(
      async (questions: unknown): Promise<PromptsResponse> => {
        if (Array.isArray(questions)) {
          return {
            dataDir: path.join(tempDir, ".footprint"),
            passphrase: "no-claude-pass-123456",
            confirmPassphrase: "no-claude-pass-123456",
            autoConfig: undefined, // autoConfig question not shown
          };
        }
        return { setupEnv: false };
      },
    );

    // Mock ora
    const ora = await import("ora");
    const mockSpinner: MockSpinner = {
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      info: vi.fn().mockReturnThis(),
    };
    vi.mocked(ora.default).mockReturnValue(mockSpinner as Ora);

    // Run setup
    await runSetup();

    // Verify data directory was still created
    const dataDir = path.join(tempDir, ".footprint");
    expect(fs.existsSync(dataDir)).toBe(true);

    // Verify no Claude config was created
    expect(fs.existsSync(tempConfigPath)).toBe(false);

    // Verify console.log was called with manual config instructions
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Claude Desktop not found"),
    );
  });

  it("should handle errors during Claude config update", async () => {
    // Create a read-only config file to trigger write error
    fs.writeFileSync(tempConfigPath, JSON.stringify({ mcpServers: {} }));
    fs.chmodSync(tempConfigPath, 0o444); // Read-only

    // Mock detectSystem
    vi.mocked(detectSystem).mockReturnValue({
      platform: "darwin",
      shell: "zsh",
      homeDir: tempDir,
      claudeConfigPath: tempConfigPath,
      shellRcPath: tempShellRcPath,
    });

    // Mock prompts
    const prompts = await import("prompts");
    vi.mocked(prompts.default).mockImplementation(
      async (questions: unknown): Promise<PromptsResponse> => {
        if (Array.isArray(questions)) {
          return {
            dataDir: path.join(tempDir, ".footprint"),
            passphrase: "error-test-pass-123456",
            confirmPassphrase: "error-test-pass-123456",
            autoConfig: true,
          };
        }
        return { setupEnv: false };
      },
    );

    // Mock ora
    const ora = await import("ora");
    const mockSpinner: MockSpinner = {
      start: vi.fn().mockReturnThis(),
      succeed: vi.fn().mockReturnThis(),
      fail: vi.fn().mockReturnThis(),
      info: vi.fn().mockReturnThis(),
    };
    vi.mocked(ora.default).mockReturnValue(mockSpinner as Ora);

    // Mock process.exit
    const exitMock = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as never);

    // Run setup (should fail)
    await runSetup();

    // Verify process.exit was called with error code
    expect(exitMock).toHaveBeenCalledWith(1);

    // Verify error was logged
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Setup failed"),
    );

    // Clean up: restore permissions before cleanup
    fs.chmodSync(tempConfigPath, 0o644);
    exitMock.mockRestore();
  });
});
