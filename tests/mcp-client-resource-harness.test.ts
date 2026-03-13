import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { FootprintServer } from "../src/index.js";
import {
  FootprintMcpTestClient,
  FootprintTestHelpers,
} from "./test-helpers.js";
import type { ServerConfig } from "../src/types.js";

describe("MCP Client Resource Harness", () => {
  let tempDir: string;
  let dbPath: string;
  let uiDistDir: string;
  let server: FootprintServer;
  let helpers: FootprintTestHelpers;
  let client: FootprintMcpTestClient | null = null;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "footprint-mcp-client-"));
    dbPath = path.join(tempDir, "footprint.db");
    uiDistDir = fs.mkdtempSync(path.join(os.tmpdir(), "footprint-ui-dist-"));

    fs.writeFileSync(
      path.join(uiDistDir, "session-dashboard.html"),
      "<!DOCTYPE html><html><body><h1>Sentinel Session Dashboard</h1></body></html>",
      "utf8",
    );
    fs.writeFileSync(
      path.join(uiDistDir, "session-detail.html"),
      "<!DOCTYPE html><html><body><h1>Sentinel Session Detail</h1><button>Export ZIP</button></body></html>",
      "utf8",
    );

    const config: ServerConfig = {
      dbPath,
      password: "mcp-client-test-password",
      uiDistDir,
    };
    server = new FootprintServer(config);
    helpers = new FootprintTestHelpers(server);
  });

  afterEach(async () => {
    if (client) {
      await client.close();
      client = null;
    } else if (server) {
      await server.shutdown();
    }

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    if (uiDistDir && fs.existsSync(uiDistDir)) {
      fs.rmSync(uiDistDir, { recursive: true, force: true });
    }
  });

  it("opens session app resources through the MCP SDK transport path", async () => {
    client = await helpers.connectMcpClient();

    const resourcesResult = await client.listResources();
    expect(resourcesResult.resources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uri: "ui://footprint/session-dashboard.html",
          mimeType: "text/html;profile=mcp-app",
        }),
        expect.objectContaining({
          uri: "ui://footprint/session-detail.html",
          mimeType: "text/html;profile=mcp-app",
        }),
      ]),
    );

    const toolsResult = await client.listTools();
    const listSessionsTool = toolsResult.tools.find(
      (tool) => tool.name === "list-sessions",
    ) as { _meta?: { ui?: { resourceUri?: string } } } | undefined;
    const exportSessionsTool = toolsResult.tools.find(
      (tool) => tool.name === "export-sessions",
    ) as { _meta?: { ui?: { resourceUri?: string } } } | undefined;

    expect(listSessionsTool?._meta?.ui?.resourceUri).toBe(
      "ui://footprint/session-dashboard.html",
    );
    expect(exportSessionsTool?._meta?.ui?.resourceUri).toBe(
      "ui://footprint/session-detail.html",
    );

    const dashboardContent = await client.readResource(
      listSessionsTool!._meta!.ui!.resourceUri!,
    );
    expect(dashboardContent.contents[0]?.uri).toBe(
      "ui://footprint/session-dashboard.html",
    );
    expect(dashboardContent.contents[0]?.mimeType).toBe(
      "text/html;profile=mcp-app",
    );
    expect(dashboardContent.contents[0]?.text).toContain(
      "Sentinel Session Dashboard",
    );

    const detailContent = await client.readResource(
      exportSessionsTool!._meta!.ui!.resourceUri!,
    );
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
  });

  it("reads templated evidence resources through the MCP SDK transport path", async () => {
    client = await helpers.connectMcpClient();

    const templatesResult = await client.listResourceTemplates();
    expect(templatesResult.resourceTemplates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          uriTemplate: "evidence://{id}",
          mimeType: "text/plain",
        }),
      ]),
    );

    const captureResult = await client.callTool("capture-footprint", {
      conversationId: "sdk-resource-read",
      llmProvider: "Claude Sonnet 4.5",
      content: JSON.stringify({
        method: "POST",
        url: "https://api.example.com/ship",
        body: { slice: "a" },
      }),
      messageCount: 1,
      tags: "sdk-resource",
    });
    const evidenceId = captureResult.structuredContent?.id as
      | string
      | undefined;

    expect(evidenceId).toBeDefined();

    const resourceContent = await client.readResource(
      `evidence://${evidenceId}`,
    );
    expect(resourceContent.contents[0]?.uri).toBe(`evidence://${evidenceId}`);
    expect(resourceContent.contents[0]?.mimeType).toBe("text/plain");
    const parsedContent = JSON.parse(
      resourceContent.contents[0]?.text ?? "{}",
    ) as {
      url?: string;
      body?: { slice?: string };
    };
    expect(parsedContent.url).toBe("https://api.example.com/ship");
    expect(parsedContent.body?.slice).toBe("a");
  });
});
