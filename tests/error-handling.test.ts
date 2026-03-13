/* global process */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FootprintServer } from "../src/index.js";
import { FootprintTestHelpers } from "./test-helpers.js";
import type { ServerConfig } from "../src/types.js";
import * as fs from "fs";
import * as path from "path";

describe("Error Handling & Edge Cases", () => {
  let server: FootprintServer;
  let helpers: FootprintTestHelpers;
  const testDbPath = path.join(
    process.cwd(),
    `test-edge-cases-${Date.now()}-${Math.random().toString(36).substring(7)}.db`,
  );
  const testPassword = "edge-case-password";

  beforeEach(() => {
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
    try {
      if (server) {
        server.close();
      }
    } catch {
      // Ignore close errors
    }
    try {
      if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
      }
      // Clean up WAL/SHM files
      for (const suffix of ["-wal", "-shm"]) {
        if (fs.existsSync(testDbPath + suffix)) {
          fs.unlinkSync(testDbPath + suffix);
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Input Validation", () => {
    it("should reject empty conversation content", async () => {
      await expect(
        helpers.callTool("capture-footprint", {
          conversationId: "conv-1",
          llmProvider: "Claude",
          content: "",
          messageCount: 0,
        }),
      ).rejects.toThrow();
    });

    it("should reject negative message count", async () => {
      await expect(
        helpers.callTool("capture-footprint", {
          conversationId: "conv-1",
          llmProvider: "Claude",
          content: "test",
          messageCount: -1,
        }),
      ).rejects.toThrow();
    });

    it("should reject invalid pagination parameters", async () => {
      await expect(
        helpers.callTool("list-footprints", { limit: -1 }),
      ).rejects.toThrow();

      await expect(
        helpers.callTool("list-footprints", { offset: -5 }),
      ).rejects.toThrow();
    });
  });

  describe("Large Content Handling", () => {
    it("should handle large conversation content (>1MB)", async () => {
      const largeContent = "x".repeat(2 * 1024 * 1024); // 2MB

      const result = await helpers.callTool("capture-footprint", {
        conversationId: "large-conv",
        llmProvider: "Claude",
        content: largeContent,
        messageCount: 100,
      });

      expect(result.structuredContent.success).toBe(true);

      // Verify retrieval
      const retrieved = await helpers.callTool("get-footprint", {
        id: result.structuredContent.id,
      });

      expect(retrieved.structuredContent.content).toBe(largeContent);
    });

    it("should reject content exceeding 10MB", async () => {
      const hugeContent = "x".repeat(10 * 1024 * 1024 + 1); // Just over 10MB

      await expect(
        helpers.callTool("capture-footprint", {
          conversationId: "huge-conv",
          llmProvider: "Claude",
          content: hugeContent,
          messageCount: 1,
        }),
      ).rejects.toThrow(/Content too large/);
    });

    it("should reject conversationId exceeding 500 characters", async () => {
      const longId = "x".repeat(501);

      await expect(
        helpers.callTool("capture-footprint", {
          conversationId: longId,
          llmProvider: "Claude",
          content: "test content",
          messageCount: 1,
        }),
      ).rejects.toThrow("Conversation ID too long");
    });
  });

  describe("Content Preview", () => {
    it('should not append "..." to short content preview in get-footprint', async () => {
      const shortContent = "Short message under 100 chars";
      const result = await helpers.callTool("capture-footprint", {
        conversationId: "short-content-test",
        llmProvider: "Claude",
        content: shortContent,
        messageCount: 1,
      });

      const getResult = await helpers.callTool("get-footprint", {
        id: result.structuredContent.id,
      });

      // Full content is in structuredContent.content
      expect(getResult.structuredContent.content).toBe(shortContent);
      // Text output should NOT have trailing "..."
      expect(getResult.textContent).not.toContain(
        "Short message under 100 chars...",
      );
    });

    it('should append "..." to long content preview in get-footprint', async () => {
      const longContent = "A".repeat(200);
      const result = await helpers.callTool("capture-footprint", {
        conversationId: "long-content-test",
        llmProvider: "Claude",
        content: longContent,
        messageCount: 1,
      });

      const getResult = await helpers.callTool("get-footprint", {
        id: result.structuredContent.id,
      });

      // Text output should have trailing "..." for truncated preview
      expect(getResult.textContent).toContain("...");
      // Full content is preserved
      expect(getResult.structuredContent.content).toBe(longContent);
    });
  });

  describe("Special Characters", () => {
    it("should handle UTF-8, emoji, and special characters", async () => {
      const specialContent = "你好 🔐 测试 \n\t Special: <>&\"'";

      const result = await helpers.callTool("capture-footprint", {
        conversationId: "special-conv",
        llmProvider: "Claude Sonnet 4.5",
        content: specialContent,
        messageCount: 1,
        tags: "emoji-✨,中文-测试",
      });

      const retrieved = await helpers.callTool("get-footprint", {
        id: result.structuredContent.id,
      });

      expect(retrieved.structuredContent.content).toBe(specialContent);
      expect(retrieved.structuredContent.tags).toBe("emoji-✨,中文-测试");
    });
  });

  describe("Database Errors", () => {
    it("should handle database corruption gracefully", async () => {
      // Corrupt database by writing garbage
      fs.writeFileSync(testDbPath, "CORRUPTED_DATA");

      // Also remove WAL files if they exist (WAL mode creates these)
      const walPath = `${testDbPath}-wal`;
      const shmPath = `${testDbPath}-shm`;
      if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
      if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

      // Create new server instance (should fail gracefully)
      expect(() => {
        new FootprintServer({
          dbPath: testDbPath,
          password: testPassword,
        });
      }).toThrow();
    });
  });

  describe("Empty Database", () => {
    it("should handle empty database correctly", async () => {
      const result = await helpers.callTool("list-footprints", {});

      expect(result.structuredContent.total).toBe(0);
      expect(result.structuredContent.evidences).toEqual([]);
    });

    it("should handle export of empty database", async () => {
      const result = await helpers.callTool("export-footprints", {});

      expect(result.structuredContent.evidenceCount).toBe(0);
    });
  });
});
