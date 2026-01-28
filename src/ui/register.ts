import { registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import fs from "node:fs/promises";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const DIST_DIR = path.join(import.meta.dirname, "../../dist/ui");

interface UIResourceConfig {
  uri: string;
  filename: string;
  title: string;
  emoji: string;
  description: string;
}

/**
 * Create a resource handler for a UI file
 */
function createUIResourceHandler(config: UIResourceConfig) {
  return async () => {
    try {
      const htmlPath = path.join(DIST_DIR, config.filename);
      const html = await fs.readFile(htmlPath, "utf-8");

      return {
        contents: [{
          uri: config.uri,
          mimeType: RESOURCE_MIME_TYPE,
          text: html,
        }],
      };
    } catch (error) {
      console.error(`Failed to load ${config.filename}:`, error);

      return {
        contents: [{
          uri: config.uri,
          mimeType: RESOURCE_MIME_TYPE,
          text: createFallbackHTML(config),
        }],
      };
    }
  };
}

/**
 * Generate fallback HTML for when UI files are not built
 */
function createFallbackHTML(config: UIResourceConfig): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${config.title}</title>
      <style>
        body { font-family: system-ui; padding: 2rem; text-align: center; }
        .error { color: #ef4444; background: #fef2f2; padding: 1rem; border-radius: 8px; }
      </style>
    </head>
    <body>
      <h1>${config.emoji} ${config.description}</h1>
      <div class="error">
        <p>${config.description} not available. Please build the UI first:</p>
        <code>pnpm build:ui</code>
      </div>
    </body>
    </html>
  `;
}

export function registerUIResources(server: McpServer) {
  const resources: UIResourceConfig[] = [
    {
      uri: "ui://footprint/dashboard.html",
      filename: "dashboard.html",
      title: "Footprint Dashboard",
      emoji: "🔐",
      description: "Dashboard"
    },
    {
      uri: "ui://footprint/detail.html",
      filename: "detail.html",
      title: "Footprint Detail",
      emoji: "🔍",
      description: "Detail view"
    },
    {
      uri: "ui://footprint/export.html",
      filename: "export.html",
      title: "Export Footprint",
      emoji: "📦",
      description: "Export view"
    }
  ];

  // Register all UI resources using data-driven approach
  resources.forEach(config => {
    registerAppResource(
      server,
      config.uri,
      config.uri,
      { mimeType: RESOURCE_MIME_TYPE },
      createUIResourceHandler(config)
    );
  });

  console.log("✅ Registered UI resources:", resources.map(r => r.uri).join(", "));

  return {
    dashboardUri: resources[0].uri,
    detailUri: resources[1].uri,
    exportUri: resources[2].uri,
  };
}
