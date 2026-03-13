/* global process */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { FootprintServer } from "../src/index.js";
import { FootprintTestHelpers } from "./test-helpers.js";
import type { ServerConfig } from "../src/types.js";
import { resolveDefaultUIDistDir } from "../src/ui/register.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

describe("MCP Resources", () => {
  let server: FootprintServer;
  let helpers: FootprintTestHelpers;
  const testDbPath = path.join(
    process.cwd(),
    `test-resources-${Date.now()}-${Math.random().toString(36).substring(7)}.db`,
  );
  const testPassword = "test-password-123";
  const uiFixtures = new Map<string, string>([
    [
      "session-dashboard.html",
      "<!DOCTYPE html><html><head><title>Sentinel Session Dashboard</title></head><body><h1>Sentinel Session Dashboard</h1><p>Waiting for session history...</p></body></html>",
    ],
    [
      "session-detail.html",
      "<!DOCTYPE html><html><head><title>Sentinel Session Detail</title></head><body><h1>Sentinel Session Detail</h1><button>Export ZIP</button><button>Load Artifacts</button></body></html>",
    ],
  ]);
  let uiDistDir: string;

  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }

    uiDistDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "footprint-session-ui-resource-"),
    );
    for (const [filename, contents] of uiFixtures) {
      const filePath = path.join(uiDistDir, filename);
      fs.writeFileSync(filePath, contents, "utf8");
    }

    const config: ServerConfig = {
      dbPath: testDbPath,
      password: testPassword,
      uiDistDir,
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
      for (const suffix of ["-wal", "-shm"]) {
        if (fs.existsSync(testDbPath + suffix)) {
          fs.unlinkSync(testDbPath + suffix);
        }
      }
      if (uiDistDir && fs.existsSync(uiDistDir)) {
        fs.rmSync(uiDistDir, { recursive: true, force: true });
      }
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("Resource Registration", () => {
    it("should register evidence resource with template", async () => {
      const resources = await helpers.getResources();

      expect(resources).toBeDefined();
      expect(Array.isArray(resources)).toBe(true);

      const evidenceResource = resources.find((r) => r.name === "evidence");
      expect(evidenceResource).toBeDefined();
      expect(evidenceResource?.uriTemplate).toBe("evidence://{id}");
      expect(evidenceResource?.description).toContain(
        "encrypted footprint record",
      );
      expect(evidenceResource?.mimeType).toBe("text/plain");
    });

    it("should register session app resources for MCP UI views", async () => {
      const resources = await helpers.getAppResources();

      expect(resources).toContainEqual(
        expect.objectContaining({
          name: "ui://footprint/session-dashboard.html",
          mimeType: "text/html;profile=mcp-app",
          enabled: true,
        }),
      );
      expect(resources).toContainEqual(
        expect.objectContaining({
          name: "ui://footprint/session-detail.html",
          mimeType: "text/html;profile=mcp-app",
          enabled: true,
        }),
      );
    });

    it("resolves built UI assets from both source and compiled register locations", () => {
      const sourceRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "footprint-ui-source-base-"),
      );
      const compiledRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "footprint-ui-compiled-base-"),
      );

      try {
        const sourceBaseDir = path.join(sourceRoot, "src", "ui");
        const compiledBaseDir = path.join(compiledRoot, "dist", "src", "ui");
        const sourceDistDir = path.join(sourceRoot, "dist", "ui");
        const compiledDistDir = path.join(compiledRoot, "dist", "ui");

        fs.mkdirSync(sourceBaseDir, { recursive: true });
        fs.mkdirSync(compiledBaseDir, { recursive: true });
        fs.mkdirSync(sourceDistDir, { recursive: true });
        fs.mkdirSync(compiledDistDir, { recursive: true });
        fs.writeFileSync(
          path.join(sourceDistDir, "dashboard.html"),
          "<!DOCTYPE html><title>source-built-ui</title>",
          "utf8",
        );
        fs.writeFileSync(
          path.join(compiledDistDir, "dashboard.html"),
          "<!DOCTYPE html><title>compiled-built-ui</title>",
          "utf8",
        );

        expect(resolveDefaultUIDistDir(sourceBaseDir)).toBe(sourceDistDir);
        expect(resolveDefaultUIDistDir(compiledBaseDir)).toBe(compiledDistDir);
      } finally {
        fs.rmSync(sourceRoot, { recursive: true, force: true });
        fs.rmSync(compiledRoot, { recursive: true, force: true });
      }
    });

    it("should open the session UI resources referenced by session tool metadata", async () => {
      const dashboardTool = await helpers.getToolDefinition("list-sessions");
      const detailTool = await helpers.getToolDefinition("export-sessions");

      const dashboardUri = (
        (dashboardTool._meta as Record<string, unknown>)?.ui as Record<
          string,
          unknown
        >
      )?.resourceUri as string;
      const detailUri = (
        (detailTool._meta as Record<string, unknown>)?.ui as Record<
          string,
          unknown
        >
      )?.resourceUri as string;

      const dashboardContent = await helpers.readResource(dashboardUri);
      expect(dashboardContent.contents[0]?.uri).toBe(
        "ui://footprint/session-dashboard.html",
      );
      expect(dashboardContent.contents[0]?.mimeType).toBe(
        "text/html;profile=mcp-app",
      );
      expect(dashboardContent.contents[0]?.text).toContain(
        "Sentinel Session Dashboard",
      );
      expect(dashboardContent.contents[0]?.text).toContain(
        "Waiting for session history",
      );

      const detailContent = await helpers.readResource(detailUri);
      expect(detailContent.contents[0]?.uri).toBe(
        "ui://footprint/session-detail.html",
      );
      expect(detailContent.contents[0]?.mimeType).toBe(
        "text/html;profile=mcp-app",
      );
      expect(detailContent.contents[0]?.text).toContain(
        "Sentinel Session Detail",
      );
      expect(detailContent.contents[0]?.text).toContain("Export ZIP");
      expect(detailContent.contents[0]?.text).toContain("Load Artifacts");
    });

    it("should read evidence resource with valid ID", async () => {
      // First create evidence using capture-footprint tool
      const result = await helpers.executeTool("capture-footprint", {
        conversationId: "test-resource-evidence",
        llmProvider: "Claude Sonnet 4.5",
        content: JSON.stringify({
          method: "GET",
          url: "https://api.example.com/data",
          headers: { Authorization: "Bearer token" },
        }),
        messageCount: 1,
        tags: "resource-test",
      });

      expect(result.success).toBe(true);
      expect(result.id).toBeDefined();

      // Read through resource using the returned ID
      const evidenceId = result.id;
      const resourceContent = await helpers.readResource(
        `evidence://${evidenceId}`,
      );

      expect(resourceContent).toBeDefined();
      expect(resourceContent.contents).toBeDefined();
      expect(resourceContent.contents[0].uri).toBe(`evidence://${evidenceId}`);
      expect(resourceContent.contents[0].mimeType).toBe("text/plain");
      expect(resourceContent.contents[0].text).toContain("method");
      expect(resourceContent.contents[0].text).toContain("GET");
      expect(resourceContent.contents[0].text).toContain(
        "https://api.example.com/data",
      );
    });

    it("should return error for non-existent evidence ID", async () => {
      await expect(
        helpers.readResource("evidence://non-existent-id"),
      ).rejects.toThrow("Evidence with ID non-existent-id not found");
    });

    it("should return error for invalid URI format", async () => {
      await expect(helpers.readResource("invalid://format")).rejects.toThrow(
        "Unknown resource",
      );
    });
  });
});
