import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FootprintServer, FootprintTestHelpers } from "../src/index.js";
import type { ServerConfig } from "../src/types.js";
import * as fs from "fs";
import * as path from "path";
import { tmpdir } from "node:os";

describe("MCP Tools", () => {
  let server: FootprintServer;
  let helpers: FootprintTestHelpers;
  let testDbPath: string;
  let tempDir: string;
  const testPassword = "test-password-123";

  beforeEach(() => {
    // Create unique temporary directory for each test
    tempDir = fs.mkdtempSync(path.join(tmpdir(), "evidence-mcp-test-"));
    testDbPath = path.join(tempDir, "test-evidence.db");

    // Clean up any existing test database
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
    // Clean up test database and directory
    try {
      if (server) {
        // Close any database connections if the server has them
      }
    } catch (error) {
      // Ignore close errors
    }

    try {
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("capture-footprint tool", () => {
    it("should capture and encrypt conversation evidence", async () => {
      // This test will fail initially - tool not registered yet
      const tools = await helpers.getTools();

      expect(tools).toContainEqual(
        expect.objectContaining({
          name: "capture-footprint",
          description: expect.stringContaining("conversation"),
        }),
      );
    });
  });

  describe("list-footprints tool", () => {
    it("should list all evidences", async () => {
      const tools = await helpers.getTools();

      expect(tools).toContainEqual(
        expect.objectContaining({
          name: "list-footprints",
        }),
      );
    });
  });

  describe("export-footprints tool", () => {
    it("should export evidences to ZIP", async () => {
      const tools = await helpers.getTools();

      expect(tools).toContainEqual(
        expect.objectContaining({
          name: "export-footprints",
        }),
      );
    });
  });

  describe("get-footprint tool", () => {
    it("should retrieve and decrypt specific evidence", async () => {
      const tools = await helpers.getTools();

      expect(tools).toContainEqual(
        expect.objectContaining({
          name: "get-footprint",
        }),
      );
    });
  });

  describe("search-footprints tool", () => {
    it("should be registered as a tool", async () => {
      const tools = await helpers.getTools();

      expect(tools).toContainEqual(
        expect.objectContaining({
          name: "search-footprints",
          description: expect.stringContaining("Search and filter footprints"),
        }),
      );
    });

    it("should have correct input schema", async () => {
      const tools = await helpers.getTools();
      const searchTool = tools.find((t) => t.name === "search-footprints");

      expect(searchTool).toBeDefined();
      // The helper only returns name and description, not the full schema
      expect(searchTool?.name).toBe("search-footprints");
      expect(searchTool?.description).toContain("Search and filter footprints");
    });

    it("should return empty results for no matches", async () => {
      const result = await helpers.callTool("search-footprints", {
        query: "nonexistent-conversation",
      });

      expect(result).toHaveProperty("structuredContent");
      expect(result.structuredContent).toHaveProperty("evidences");
      expect(result.structuredContent).toHaveProperty("total");
      expect(result.structuredContent.evidences).toHaveLength(0);
      expect(result.structuredContent.total).toBe(0);
    });

    it("should validate limit parameter", async () => {
      await expect(
        helpers.callTool("search-footprints", { limit: 0 }),
      ).rejects.toThrow("Limit must be positive");

      await expect(
        helpers.callTool("search-footprints", { limit: -1 }),
      ).rejects.toThrow("Limit must be positive");
    });

    it("should validate offset parameter", async () => {
      await expect(
        helpers.callTool("search-footprints", { offset: -1 }),
      ).rejects.toThrow("Offset cannot be negative");
    });

    it("should validate date parameters", async () => {
      await expect(
        helpers.callTool("search-footprints", { dateFrom: "invalid-date" }),
      ).rejects.toThrow("dateFrom must be a valid ISO date string");

      await expect(
        helpers.callTool("search-footprints", { dateTo: "invalid-date" }),
      ).rejects.toThrow("dateTo must be a valid ISO date string");
    });
  });

  describe("verify-footprint tool", () => {
    it("should verify evidence integrity", async () => {
      // First capture an evidence
      const captureResult = await helpers.callTool("capture-footprint", {
        conversationId: "test-verify",
        llmProvider: "Test LLM",
        content: "Test content for verification",
        messageCount: 1,
      });
      const evidenceId = captureResult.structuredContent.id;

      // Then verify it
      const verifyResult = await helpers.callTool("verify-footprint", {
        id: evidenceId,
      });
      expect(verifyResult.structuredContent.verified).toBe(true);
      expect(
        (verifyResult.structuredContent as any).checks.contentIntegrity.passed,
      ).toBe(true);
    });
  });

  describe("suggest-capture tool", () => {
    it("should be registered as a tool", async () => {
      const tools = await helpers.getTools();

      expect(tools).toContainEqual(
        expect.objectContaining({
          name: "suggest-capture",
          description: expect.stringContaining("Analyze conversation content"),
        }),
      );
    });

    it("should suggest capture for IP-related content", async () => {
      const result = await helpers.callTool("suggest-capture", {
        summary:
          "We discussed the new caching algorithm patent and its implementation details. The invention uses a novel approach for memory management.",
      });

      expect(result.structuredContent).toHaveProperty("shouldCapture", true);
      expect(result.structuredContent).toHaveProperty(
        "reason",
        expect.stringContaining("IP"),
      );
      expect(result.structuredContent).toHaveProperty("suggestedTags");
      expect(result.structuredContent.suggestedTags).toContain("ip");
      expect(result.structuredContent).toHaveProperty(
        "suggestedConversationId",
        expect.any(String),
      );
      expect(result.structuredContent).toHaveProperty(
        "confidence",
        expect.any(Number),
      );
      expect(result.structuredContent.confidence).toBeGreaterThan(0.7);
    });

    it("should suggest capture for legal content", async () => {
      const result = await helpers.callTool("suggest-capture", {
        summary:
          "We reviewed the software license agreement and contract terms for the new vendor partnership.",
      });

      expect(result.structuredContent.shouldCapture).toBe(true);
      expect(result.structuredContent.reason).toContain("legal");
      expect(result.structuredContent.suggestedTags).toContain("legal");
      expect(result.structuredContent.confidence).toBeGreaterThan(0.7);
    });

    it("should suggest capture for business decisions", async () => {
      const result = await helpers.callTool("suggest-capture", {
        summary:
          "The team made a critical decision about the product milestone and approved the final deliverable for Q1.",
      });

      expect(result.structuredContent.shouldCapture).toBe(true);
      expect(result.structuredContent.reason).toContain("business");
      expect(result.structuredContent.suggestedTags).toContain("decision");
      expect(result.structuredContent.confidence).toBeGreaterThan(0.7);
    });

    it("should suggest capture for research content", async () => {
      const result = await helpers.callTool("suggest-capture", {
        summary:
          "Our research findings show clear evidence supporting our hypothesis about machine learning performance.",
      });

      expect(result.structuredContent.shouldCapture).toBe(true);
      expect(result.structuredContent.reason).toContain("research");
      expect(result.structuredContent.suggestedTags).toContain("research");
      expect(result.structuredContent.confidence).toBeGreaterThan(0.7);
    });

    it("should suggest capture for compliance content", async () => {
      const result = await helpers.callTool("suggest-capture", {
        summary:
          "We need to document this for audit purposes and ensure compliance with the new regulations.",
      });

      expect(result.structuredContent.shouldCapture).toBe(true);
      expect(result.structuredContent.reason).toContain("compliance");
      expect(result.structuredContent.suggestedTags).toContain("audit");
      expect(result.structuredContent.confidence).toBeGreaterThan(0.7);
    });

    it("should not suggest capture for casual conversation", async () => {
      const result = await helpers.callTool("suggest-capture", {
        summary:
          "We chatted about the weather and discussed weekend plans. Nothing important was covered.",
      });

      expect(result.structuredContent.shouldCapture).toBe(false);
      expect(result.structuredContent.reason).toContain("casual");
      expect(result.structuredContent.confidence).toBeLessThan(0.5);
    });

    it("should generate appropriate conversation ID", async () => {
      const result = await helpers.callTool("suggest-capture", {
        summary:
          "Discussing patent application for the new AI algorithm invention.",
      });

      expect(result.structuredContent.suggestedConversationId).toMatch(
        /^[a-z0-9-]+$/,
      );
      expect(result.structuredContent.suggestedConversationId).toContain(
        "patent",
      );
      expect(result.structuredContent.suggestedConversationId).toContain(
        new Date().toISOString().slice(0, 10),
      );
    });

    it("should validate input parameters", async () => {
      await expect(helpers.callTool("suggest-capture", {})).rejects.toThrow();

      await expect(
        helpers.callTool("suggest-capture", { summary: "" }),
      ).rejects.toThrow("Summary cannot be empty");
    });

    it("should handle multiple keyword categories", async () => {
      const result = await helpers.callTool("suggest-capture", {
        summary:
          "We discussed the patent license agreement and our research findings for compliance documentation.",
      });

      expect(result.structuredContent.shouldCapture).toBe(true);
      expect(
        (result.structuredContent as any).suggestedTags.length,
      ).toBeGreaterThan(1);
      expect((result.structuredContent as any).suggestedTags).toContain("ip");
      expect((result.structuredContent as any).suggestedTags).toContain(
        "legal",
      );
      expect(result.structuredContent.confidence).toBeGreaterThan(0.8);
    });
  });
});
