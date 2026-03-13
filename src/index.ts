#!/usr/bin/env node
/* global console, process */

import * as path from "path";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  EvidenceDatabase,
  storeSalt,
  retrieveSalt,
} from "./lib/storage/index.js";
import { deriveKey, rederiveKey, type DerivedKey } from "./lib/crypto/index.js";
import { registerUIResources } from "./ui/register.js";
import { getErrorMessage } from "./lib/tool-wrapper.js";
import { decrypt } from "./lib/crypto/index.js";
import type { ServerConfig } from "./types.js";
import { registerSkillPrompts } from "./prompts/skill-prompt.js";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// Resolve package.json in both compiled (dist/src/) and tsx source (src/) environments
const PKG_VERSION: string = (() => {
  for (const rel of ["../../package.json", "../package.json"]) {
    try {
      return (require(rel) as { version: string }).version;
    } catch {
      // try next candidate path
    }
  }
  return "0.0.0";
})();

// Import all tool handlers
import {
  captureFootprintSchema,
  captureFootprintMetadata,
  createCaptureFootprintHandler,
  listFootprintsSchema,
  listFootprintsMetadata,
  createListFootprintsHandler,
  exportFootprintsSchema,
  exportFootprintsMetadata,
  createExportFootprintsHandler,
  getFootprintSchema,
  getFootprintMetadata,
  createGetFootprintHandler,
  searchFootprintsSchema,
  searchFootprintsMetadata,
  createSearchFootprintsHandler,
  verifyFootprintSchema,
  verifyFootprintMetadata,
  createVerifyFootprintHandler,
  suggestCaptureSchema,
  suggestCaptureMetadata,
  createSuggestCaptureHandler,
  deleteFootprintsSchema,
  deleteFootprintsMetadata,
  createDeleteFootprintsHandler,
  manageTagsSchema,
  manageTagsMetadata,
  createManageTagsHandler,
  listSessionsSchema,
  listSessionsMetadata,
  createListSessionsHandler,
  listContextsSchema,
  listContextsMetadata,
  createListContextsHandler,
  getContextSchema,
  getContextMetadata,
  createGetContextHandler,
  resolveContextSchema,
  resolveContextMetadata,
  createResolveContextHandler,
  confirmContextLinkSchema,
  confirmContextLinkMetadata,
  createConfirmContextLinkHandler,
  rejectContextLinkSchema,
  rejectContextLinkMetadata,
  createRejectContextLinkHandler,
  moveSessionContextSchema,
  moveSessionContextMetadata,
  createMoveSessionContextHandler,
  mergeContextsSchema,
  mergeContextsMetadata,
  createMergeContextsHandler,
  splitContextSchema,
  splitContextMetadata,
  createSplitContextHandler,
  setActiveContextSchema,
  setActiveContextMetadata,
  createSetActiveContextHandler,
  getSessionSchema,
  getSessionMetadata,
  createGetSessionHandler,
  exportSessionsSchema,
  exportSessionsMetadata,
  createExportSessionsHandler,
  getSessionMessagesSchema,
  getSessionMessagesMetadata,
  createGetSessionMessagesHandler,
  getSessionTrendsSchema,
  getSessionTrendsMetadata,
  createGetSessionTrendsHandler,
  getSessionTimelineSchema,
  getSessionTimelineMetadata,
  createGetSessionTimelineHandler,
  getSessionArtifactsSchema,
  getSessionArtifactsMetadata,
  createGetSessionArtifactsHandler,
  getSessionNarrativeSchema,
  getSessionNarrativeMetadata,
  createGetSessionNarrativeHandler,
  getSessionDecisionsSchema,
  getSessionDecisionsMetadata,
  createGetSessionDecisionsHandler,
  searchHistorySchema,
  searchHistoryMetadata,
  createSearchHistoryHandler,
  getHistoryTrendsSchema,
  getHistoryTrendsMetadata,
  createGetHistoryTrendsHandler,
  getHistoryHandoffSchema,
  getHistoryHandoffMetadata,
  createGetHistoryHandoffHandler,
  reingestSessionSchema,
  reingestSessionMetadata,
  createReingestSessionHandler,
} from "./tools/index.js";

/**
 * Footprint Server - Captures LLM conversations as encrypted evidence
 * with Git timestamps and export capabilities.
 */
export class FootprintServer {
  private server: McpServer;
  private config: ServerConfig;
  private db: EvidenceDatabase;
  private derivedKey: Uint8Array | null = null;
  private keyDerivationPromise: Promise<Uint8Array> | null = null;
  private shutdownPromise: Promise<void> | null = null;

  constructor(config: ServerConfig) {
    this.config = config;

    try {
      this.db = new EvidenceDatabase(config.dbPath);
    } catch (error) {
      throw new Error(
        `Failed to initialize database: ${getErrorMessage(error)}`,
      );
    }

    this.server = new McpServer({
      name: config.name || "footprint",
      version: config.version || PKG_VERSION,
    });

    // Register UI resources for MCP Apps
    registerUIResources(this.server, { distDir: config.uiDistDir });

    this.registerTools();
    this.registerResources();
    try {
      registerSkillPrompts(this.server);
    } catch (error) {
      throw new Error(
        `Failed to register skill prompts: ${getErrorMessage(error)}`,
      );
    }
  }

  /**
   * Get or derive encryption key using stored salt (thread-safe)
   * Caches key in memory for performance, with cleanup on shutdown
   * Handles concurrent calls by ensuring only one derivation happens at a time
   *
   * @returns 32-byte encryption key
   * @throws Error if salt storage fails
   */
  private async getDerivedKey(): Promise<Uint8Array> {
    // Fast path: key already derived
    if (this.derivedKey) {
      return this.derivedKey;
    }

    // If derivation is in progress, wait for it to complete
    if (this.keyDerivationPromise) {
      return this.keyDerivationPromise;
    }

    // Start derivation (only one caller proceeds here)
    this.keyDerivationPromise = (async () => {
      try {
        // Check if salt exists in database
        const existingSalt = retrieveSalt(this.db.getDb());
        let result: DerivedKey;

        if (existingSalt) {
          // Re-derive key using stored salt
          result = await rederiveKey(this.config.password, existingSalt);
        } else {
          // First-time: generate new key and store salt
          result = await deriveKey(this.config.password);
          storeSalt(this.db.getDb(), result.salt);
        }

        this.derivedKey = result.key;
        return result.key;
      } finally {
        // Clear promise after derivation completes (success or failure)
        this.keyDerivationPromise = null;
      }
    })();

    return this.keyDerivationPromise;
  }

  /**
   * Securely clear derived key from memory
   * Should be called on server shutdown
   */
  private clearDerivedKey(): void {
    if (this.derivedKey) {
      // Zero out key in memory
      this.derivedKey.fill(0);
      this.derivedKey = null;
    }
  }

  private registerTools(): void {
    // Capture footprint tool
    this.server.registerTool(
      "capture-footprint",
      {
        ...captureFootprintMetadata,
        inputSchema: captureFootprintSchema.inputSchema,
        outputSchema: captureFootprintSchema.outputSchema,
      },
      createCaptureFootprintHandler(this.db, this.getDerivedKey.bind(this)),
    );

    // List footprints tool
    this.server.registerTool(
      "list-footprints",
      {
        ...listFootprintsMetadata,
        inputSchema: listFootprintsSchema.inputSchema,
        outputSchema: listFootprintsSchema.outputSchema,
      },
      createListFootprintsHandler(this.db),
    );

    // Export footprints tool
    this.server.registerTool(
      "export-footprints",
      {
        ...exportFootprintsMetadata,
        inputSchema: exportFootprintsSchema.inputSchema,
        outputSchema: exportFootprintsSchema.outputSchema,
      },
      createExportFootprintsHandler(this.db),
    );

    // Get footprint tool
    this.server.registerTool(
      "get-footprint",
      {
        ...getFootprintMetadata,
        inputSchema: getFootprintSchema.inputSchema,
        outputSchema: getFootprintSchema.outputSchema,
      },
      createGetFootprintHandler(this.db, this.getDerivedKey.bind(this)),
    );

    // Search footprints tool
    this.server.registerTool(
      "search-footprints",
      {
        ...searchFootprintsMetadata,
        inputSchema: searchFootprintsSchema.inputSchema,
        outputSchema: searchFootprintsSchema.outputSchema,
      },
      createSearchFootprintsHandler(this.db),
    );

    // Verify footprint tool
    this.server.registerTool(
      "verify-footprint",
      {
        ...verifyFootprintMetadata,
        inputSchema: verifyFootprintSchema.inputSchema,
        outputSchema: verifyFootprintSchema.outputSchema,
      },
      createVerifyFootprintHandler(this.db, this.getDerivedKey.bind(this)),
    );

    // Suggest capture tool
    this.server.registerTool(
      "suggest-capture",
      {
        ...suggestCaptureMetadata,
        inputSchema: suggestCaptureSchema.inputSchema,
        outputSchema: suggestCaptureSchema.outputSchema,
      },
      createSuggestCaptureHandler(),
    );

    // Delete footprints tool
    this.server.registerTool(
      "delete-footprints",
      {
        ...deleteFootprintsMetadata,
        inputSchema: deleteFootprintsSchema.inputSchema,
        outputSchema: deleteFootprintsSchema.outputSchema,
      },
      createDeleteFootprintsHandler(this.db),
    );

    // Unified tag management tool (replaces rename-tag, remove-tag, get-tag-stats)
    this.server.registerTool(
      "manage-tags",
      {
        ...manageTagsMetadata,
        inputSchema: manageTagsSchema.inputSchema,
        outputSchema: manageTagsSchema.outputSchema,
      },
      createManageTagsHandler(this.db),
    );

    this.server.registerTool(
      "list-sessions",
      {
        ...listSessionsMetadata,
        inputSchema: listSessionsSchema.inputSchema,
        outputSchema: listSessionsSchema.outputSchema,
      },
      createListSessionsHandler(this.db),
    );

    this.server.registerTool(
      "list-contexts",
      {
        ...listContextsMetadata,
        inputSchema: listContextsSchema.inputSchema,
        outputSchema: listContextsSchema.outputSchema,
      },
      createListContextsHandler(this.db),
    );

    this.server.registerTool(
      "get-context",
      {
        ...getContextMetadata,
        inputSchema: getContextSchema.inputSchema,
        outputSchema: getContextSchema.outputSchema,
      },
      createGetContextHandler(this.db),
    );

    this.server.registerTool(
      "resolve-context",
      {
        ...resolveContextMetadata,
        inputSchema: resolveContextSchema.inputSchema,
        outputSchema: resolveContextSchema.outputSchema,
      },
      createResolveContextHandler(this.db),
    );

    this.server.registerTool(
      "confirm-context-link",
      {
        ...confirmContextLinkMetadata,
        inputSchema: confirmContextLinkSchema.inputSchema,
        outputSchema: confirmContextLinkSchema.outputSchema,
      },
      createConfirmContextLinkHandler(this.db),
    );

    this.server.registerTool(
      "reject-context-link",
      {
        ...rejectContextLinkMetadata,
        inputSchema: rejectContextLinkSchema.inputSchema,
        outputSchema: rejectContextLinkSchema.outputSchema,
      },
      createRejectContextLinkHandler(this.db),
    );

    this.server.registerTool(
      "move-session-context",
      {
        ...moveSessionContextMetadata,
        inputSchema: moveSessionContextSchema.inputSchema,
        outputSchema: moveSessionContextSchema.outputSchema,
      },
      createMoveSessionContextHandler(this.db),
    );

    this.server.registerTool(
      "merge-contexts",
      {
        ...mergeContextsMetadata,
        inputSchema: mergeContextsSchema.inputSchema,
        outputSchema: mergeContextsSchema.outputSchema,
      },
      createMergeContextsHandler(this.db),
    );

    this.server.registerTool(
      "split-context",
      {
        ...splitContextMetadata,
        inputSchema: splitContextSchema.inputSchema,
        outputSchema: splitContextSchema.outputSchema,
      },
      createSplitContextHandler(this.db),
    );

    this.server.registerTool(
      "set-active-context",
      {
        ...setActiveContextMetadata,
        inputSchema: setActiveContextSchema.inputSchema,
        outputSchema: setActiveContextSchema.outputSchema,
      },
      createSetActiveContextHandler(this.db),
    );

    this.server.registerTool(
      "get-session",
      {
        ...getSessionMetadata,
        inputSchema: getSessionSchema.inputSchema,
        outputSchema: getSessionSchema.outputSchema,
      },
      createGetSessionHandler(this.db),
    );

    this.server.registerTool(
      "export-sessions",
      {
        ...exportSessionsMetadata,
        inputSchema: exportSessionsSchema.inputSchema,
        outputSchema: exportSessionsSchema.outputSchema,
      },
      createExportSessionsHandler(this.db),
    );

    this.server.registerTool(
      "get-session-messages",
      {
        ...getSessionMessagesMetadata,
        inputSchema: getSessionMessagesSchema.inputSchema,
        outputSchema: getSessionMessagesSchema.outputSchema,
      },
      createGetSessionMessagesHandler(this.db),
    );

    this.server.registerTool(
      "get-session-trends",
      {
        ...getSessionTrendsMetadata,
        inputSchema: getSessionTrendsSchema.inputSchema,
        outputSchema: getSessionTrendsSchema.outputSchema,
      },
      createGetSessionTrendsHandler(this.db),
    );

    this.server.registerTool(
      "get-session-timeline",
      {
        ...getSessionTimelineMetadata,
        inputSchema: getSessionTimelineSchema.inputSchema,
        outputSchema: getSessionTimelineSchema.outputSchema,
      },
      createGetSessionTimelineHandler(this.db),
    );

    this.server.registerTool(
      "get-session-artifacts",
      {
        ...getSessionArtifactsMetadata,
        inputSchema: getSessionArtifactsSchema.inputSchema,
        outputSchema: getSessionArtifactsSchema.outputSchema,
      },
      createGetSessionArtifactsHandler(this.db),
    );

    this.server.registerTool(
      "get-session-narrative",
      {
        ...getSessionNarrativeMetadata,
        inputSchema: getSessionNarrativeSchema.inputSchema,
        outputSchema: getSessionNarrativeSchema.outputSchema,
      },
      createGetSessionNarrativeHandler(this.db),
    );

    this.server.registerTool(
      "get-session-decisions",
      {
        ...getSessionDecisionsMetadata,
        inputSchema: getSessionDecisionsSchema.inputSchema,
        outputSchema: getSessionDecisionsSchema.outputSchema,
      },
      createGetSessionDecisionsHandler(this.db),
    );

    this.server.registerTool(
      "search-history",
      {
        ...searchHistoryMetadata,
        inputSchema: searchHistorySchema.inputSchema,
        outputSchema: searchHistorySchema.outputSchema,
      },
      createSearchHistoryHandler(this.db),
    );

    this.server.registerTool(
      "get-history-trends",
      {
        ...getHistoryTrendsMetadata,
        inputSchema: getHistoryTrendsSchema.inputSchema,
        outputSchema: getHistoryTrendsSchema.outputSchema,
      },
      createGetHistoryTrendsHandler(this.db),
    );

    this.server.registerTool(
      "get-history-handoff",
      {
        ...getHistoryHandoffMetadata,
        inputSchema: getHistoryHandoffSchema.inputSchema,
        outputSchema: getHistoryHandoffSchema.outputSchema,
      },
      createGetHistoryHandoffHandler(this.db),
    );

    this.server.registerTool(
      "reingest-session",
      {
        ...reingestSessionMetadata,
        inputSchema: reingestSessionSchema.inputSchema,
        outputSchema: reingestSessionSchema.outputSchema,
      },
      createReingestSessionHandler(this.db),
    );
  }

  private registerResources(): void {
    this.server.registerResource(
      "evidence",
      new ResourceTemplate("evidence://{id}", { list: undefined }),
      {
        title: "Evidence Content",
        description: "Access encrypted footprint record by ID",
        mimeType: "text/plain",
      },
      async (uri, { id }) => {
        try {
          if (!id || typeof id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(id)) {
            throw new Error("Invalid evidence ID format");
          }
          const evidence = this.db.findById(id as string);
          if (!evidence) {
            throw new Error(`Evidence with ID ${id} not found`);
          }

          const key = await this.getDerivedKey();
          const decrypted = decrypt(
            evidence.encryptedContent,
            evidence.nonce,
            key,
          );

          return {
            contents: [
              { uri: uri.href, mimeType: "text/plain", text: decrypted },
            ],
          };
        } catch (error) {
          throw new Error(
            `Failed to access evidence resource: ${getErrorMessage(error)}`,
          );
        }
      },
    );
  }

  async connect(transport: Transport): Promise<void> {
    await this.server.connect(transport);
  }

  async start(): Promise<void> {
    await this.connect(new StdioServerTransport());
  }

  async shutdown(): Promise<void> {
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    this.shutdownPromise = (async () => {
      try {
        await this.server.close();
      } finally {
        this.clearDerivedKey();
        this.db.close();
      }
    })();

    return this.shutdownPromise;
  }

  /**
   * Cleanup server resources
   * Clears derived key from memory and closes database
   */
  close(): void {
    void this.shutdown().catch(() => {});
  }
}

// Export main as named function
export async function main(): Promise<void> {
  const config: ServerConfig = {
    dbPath: process.env.FOOTPRINT_DATA_DIR
      ? path.join(process.env.FOOTPRINT_DATA_DIR, "footprint.db")
      : process.env.FOOTPRINT_DB_PATH || "./evidence.db",
    password:
      process.env.FOOTPRINT_PASSPHRASE || process.env.FOOTPRINT_PASSWORD || "",
  };

  if (!config.password) {
    console.error("Error: FOOTPRINT_PASSPHRASE environment variable required");
    process.exit(1);
  }

  const server = new FootprintServer(config);

  // Setup cleanup handlers for graceful shutdown
  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    server.close();
  };

  // Handle uncaught exceptions and promise rejections
  process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
    cleanup();
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled rejection:", reason);
    cleanup();
    process.exit(1);
  });

  process.on("SIGINT", () => {
    cleanup();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    cleanup();
    process.exit(0);
  });

  process.on("exit", cleanup);

  await server.start();
}

// Only run if this is the main module (not imported by CLI)
const isMainModule = (() => {
  try {
    const thisFile = fileURLToPath(import.meta.url);
    const mainFile = realpathSync(process.argv[1] ?? "");
    return thisFile === mainFile;
  } catch {
    return false;
  }
})();

if (isMainModule && !process.argv.includes("setup")) {
  main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
