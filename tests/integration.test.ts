import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FootprintServer, FootprintTestHelpers } from "../src/index.js";
import type { ServerConfig } from "../src/types.js";
import * as fs from "fs";
import * as path from "path";

describe("TraceGuard MCP Server Integration", () => {
  let server: FootprintServer;
  let helpers: FootprintTestHelpers;
  let testDbPath: string;
  const testPassword = "integration-test-password";

  beforeEach(() => {
    // Use unique database path for each test to avoid conflicts
    testDbPath = path.join(
      process.cwd(),
      `test-footprint-${Date.now()}-${Math.random().toString(36).substring(7)}.db`,
    );

    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    const config: ServerConfig = {
      dbPath: testDbPath,
      password: testPassword,
    };

    server = new FootprintServer(config);
    helpers = new FootprintTestHelpers(server);
  });

  afterEach(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    // Clean up exported files
    const exports = fs
      .readdirSync(".")
      .filter((f) => f.startsWith("footprint-export-"));
    exports.forEach((f) => fs.unlinkSync(f));
  });

  it("should complete full evidence lifecycle: capture → list → get → export", async () => {
    // 1. Capture evidence
    const captureResult = await helpers.callTool("capture-footprint", {
      conversationId: "test-conv-001",
      llmProvider: "Claude Sonnet 4.5",
      content: "User: Hello\nAssistant: Hi! How can I help?",
      messageCount: 2,
      tags: "test,integration",
    });

    expect(captureResult.structuredContent).toMatchObject({
      success: true,
      id: expect.any(String),
    });

    const evidenceId = captureResult.structuredContent.id;

    // 2. List evidences
    const listResult = await helpers.callTool("list-footprints", {});

    expect(listResult.structuredContent.total).toBe(1);
    expect((listResult.structuredContent as any).footprints[0]).toMatchObject({
      id: evidenceId,
      conversationId: "test-conv-001",
      llmProvider: "Claude Sonnet 4.5",
      messageCount: 2,
    });

    // 3. Get evidence (decrypt)
    const getResult = await helpers.callTool("get-footprint", {
      id: evidenceId,
    });

    expect(getResult.structuredContent).toMatchObject({
      id: evidenceId,
      content: "User: Hello\nAssistant: Hi! How can I help?",
      messageCount: 2,
    });

    // 4. Export evidences
    const exportResult = await helpers.callTool("export-footprints", {
      ids: [evidenceId],
      includeGitInfo: true,
    });

    expect(exportResult.structuredContent).toMatchObject({
      success: true,
      footprintCount: 1,
      filename: expect.stringMatching(/^footprint-export-/),
      checksum: expect.stringMatching(/^[0-9a-f]{64}$/),
    });

    // Verify ZIP file created
    expect(
      fs.existsSync((exportResult.structuredContent as any).filename),
    ).toBe(true);
  });

  it("should handle multiple evidences correctly", async () => {
    // Capture 3 evidences
    const ids = [];

    for (let i = 1; i <= 3; i++) {
      const result = await helpers.callTool("capture-footprint", {
        conversationId: `conv-${i}`,
        llmProvider: "Claude Sonnet 4.5",
        content: `Conversation ${i} content`,
        messageCount: i,
      });
      ids.push(result.structuredContent.id);
    }

    // List with pagination
    const page1 = await helpers.callTool("list-footprints", {
      limit: 2,
      offset: 0,
    });
    expect(page1.structuredContent.total).toBe(2);

    const page2 = await helpers.callTool("list-footprints", {
      limit: 2,
      offset: 2,
    });
    expect(page2.structuredContent.total).toBe(1);

    // Export subset
    const exportResult = await helpers.callTool("export-footprints", {
      ids: [ids[0], ids[2]],
    });

    expect(exportResult.structuredContent.footprintCount).toBe(2);
  });

  it("should handle errors gracefully", async () => {
    // Try to get non-existent footprint
    await expect(
      helpers.callTool("get-footprint", { id: "nonexistent-id" }),
    ).rejects.toThrow("Footprint not found");

    // Try to export non-existent footprint
    await expect(
      helpers.callTool("export-footprints", { ids: ["bad-id"] }),
    ).rejects.toThrow("Footprint IDs not found");
  });
});
