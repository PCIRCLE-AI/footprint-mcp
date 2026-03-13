import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FootprintServer } from "../src/index.js";
import type { ServerConfig } from "../src/types.js";
import * as fs from "fs";
import * as path from "path";
import { tmpdir } from "node:os";

describe("MCP Prompts", () => {
  let server: FootprintServer;
  let testDbPath: string;
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), "evidence-prompts-test-"));
    testDbPath = path.join(tempDir, "test-evidence.db");
    const config: ServerConfig = {
      dbPath: testDbPath,
      password: "test-password-123",
    };
    server = new FootprintServer(config);
  });

  afterEach(() => {
    try {
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  // Access _registeredPrompts from the internal McpServer instance.
  // The MCP SDK stores prompts as a plain object keyed by name.
  function getRegisteredPrompts(): Record<string, unknown> {
    const serverInternal = (
      server as unknown as { server: Record<string, unknown> }
    ).server;
    return Reflect.get(serverInternal, "_registeredPrompts") as Record<
      string,
      unknown
    >;
  }

  it("should register footprint-skill prompt", () => {
    const prompts = getRegisteredPrompts();
    expect(prompts).toBeDefined();
    expect("footprint-skill" in prompts).toBe(true);
  });

  it("should register footprint-quick-ref prompt", () => {
    const prompts = getRegisteredPrompts();
    expect(prompts).toBeDefined();
    expect("footprint-quick-ref" in prompts).toBe(true);
  });

  it("should register footprint-should-capture prompt", () => {
    const prompts = getRegisteredPrompts();
    expect(prompts).toBeDefined();
    expect("footprint-should-capture" in prompts).toBe(true);
  });
});
