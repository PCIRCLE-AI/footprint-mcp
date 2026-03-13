import {
  registerAppResource,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

function isBuiltUIDirectory(distDir: string): boolean {
  const normalized = path.normalize(distDir);
  return (
    normalized.endsWith(path.join("dist", "ui")) &&
    existsSync(path.join(distDir, "dashboard.html"))
  );
}

export function resolveDefaultUIDistDir(
  baseDir: string = import.meta.dirname,
): string {
  const candidates = [
    path.resolve(baseDir, "../../dist/ui"),
    path.resolve(baseDir, "../../ui"),
  ];

  for (const candidate of candidates) {
    if (isBuiltUIDirectory(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

const DEFAULT_DIST_DIR = resolveDefaultUIDistDir();

interface UIResourceConfig {
  uri: string;
  filename: string;
  title: string;
  emoji: string;
  description: string;
}

interface UIRegistrationOptions {
  distDir?: string;
}

function shouldLogUIRegistration(): boolean {
  return process.env.FOOTPRINT_DEBUG_UI === "1";
}

/**
 * Create a resource handler for a UI file
 */
function createUIResourceHandler(config: UIResourceConfig, distDir: string) {
  return async () => {
    try {
      const htmlPath = path.join(distDir, config.filename);
      const html = await fs.readFile(htmlPath, "utf-8");

      return {
        contents: [
          {
            uri: config.uri,
            mimeType: RESOURCE_MIME_TYPE,
            text: html,
          },
        ],
      };
    } catch (error) {
      console.error(`Failed to load ${config.filename}:`, error);

      return {
        contents: [
          {
            uri: config.uri,
            mimeType: RESOURCE_MIME_TYPE,
            text: createFallbackHTML(config),
          },
        ],
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

export function registerUIResources(
  server: McpServer,
  options?: UIRegistrationOptions,
) {
  const distDir = options?.distDir
    ? path.resolve(options.distDir)
    : DEFAULT_DIST_DIR;
  const resources: UIResourceConfig[] = [
    {
      uri: "ui://footprint/dashboard.html",
      filename: "dashboard.html",
      title: "Footprint Dashboard",
      emoji: "🔐",
      description: "Dashboard",
    },
    {
      uri: "ui://footprint/detail.html",
      filename: "detail.html",
      title: "Evidence Detail - Footprint",
      emoji: "🔍",
      description: "Detail view",
    },
    {
      uri: "ui://footprint/export.html",
      filename: "export.html",
      title: "Export Evidence - Footprint",
      emoji: "📦",
      description: "Export view",
    },
    {
      uri: "ui://footprint/session-dashboard.html",
      filename: "session-dashboard.html",
      title: "Session Dashboard - Footprint",
      emoji: "🧭",
      description: "Session dashboard",
    },
    {
      uri: "ui://footprint/session-detail.html",
      filename: "session-detail.html",
      title: "Session Detail - Footprint",
      emoji: "📝",
      description: "Session detail view",
    },
  ];

  // Register all UI resources using data-driven approach
  resources.forEach((config) => {
    registerAppResource(
      server,
      config.uri,
      config.uri,
      { mimeType: RESOURCE_MIME_TYPE },
      createUIResourceHandler(config, distDir),
    );
  });

  if (shouldLogUIRegistration()) {
    console.error(
      "Registered UI resources:",
      resources.map((resource) => resource.uri).join(", "),
    );
  }

  return {
    dashboardUri: resources[0].uri,
    detailUri: resources[1].uri,
    exportUri: resources[2].uri,
  };
}
