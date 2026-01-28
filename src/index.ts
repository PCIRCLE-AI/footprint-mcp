#!/usr/bin/env node

import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
  renameTagSchema,
  renameTagMetadata,
  createRenameTagHandler,
  removeTagSchema,
  removeTagMetadata,
  createRemoveTagHandler,
  getTagStatsSchema,
  getTagStatsMetadata,
  createGetTagStatsHandler,
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
      name: config.name || "traceguard-mcp",
      version: config.version || "0.1.0",
    });

    // Register UI resources for MCP Apps
    registerUIResources(this.server);

    this.registerTools();
    this.registerResources();
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

    // Rename tag tool
    this.server.registerTool(
      "rename-tag",
      {
        ...renameTagMetadata,
        inputSchema: renameTagSchema.inputSchema,
        outputSchema: renameTagSchema.outputSchema,
      },
      createRenameTagHandler(this.db),
    );

    // Remove tag tool
    this.server.registerTool(
      "remove-tag",
      {
        ...removeTagMetadata,
        inputSchema: removeTagSchema.inputSchema,
        outputSchema: removeTagSchema.outputSchema,
      },
      createRemoveTagHandler(this.db),
    );

    // Get tag statistics tool
    this.server.registerTool(
      "get-tag-stats",
      {
        ...getTagStatsMetadata,
        inputSchema: getTagStatsSchema.inputSchema,
        outputSchema: getTagStatsSchema.outputSchema,
      },
      createGetTagStatsHandler(this.db),
    );
  }

  private registerResources(): void {
    this.server.registerResource(
      "footprint",
      new ResourceTemplate("footprint://{id}", { list: undefined }),
      {
        title: "Footprint Content",
        description: "Access encrypted footprint record by ID",
        mimeType: "text/plain",
      },
      async (uri, { id }) => {
        try {
          const footprint = this.db.findById(id as string);
          if (!footprint) {
            throw new Error(`Footprint with ID ${id} not found`);
          }

          const key = await this.getDerivedKey();
          const decrypted = decrypt(
            footprint.encryptedContent,
            footprint.nonce,
            key,
          );

          return {
            contents: [
              { uri: uri.href, mimeType: "text/plain", text: decrypted },
            ],
          };
        } catch (error) {
          throw new Error(
            `Failed to access footprint resource: ${getErrorMessage(error)}`,
          );
        }
      },
    );
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  /**
   * Cleanup server resources
   * Clears derived key from memory and closes database
   */
  close(): void {
    this.clearDerivedKey();
    this.db.close();
  }
}

async function main(): Promise<void> {
  const config: ServerConfig = {
    dbPath: process.env.FOOTPRINT_DB_PATH || "./footprints.db",
    password: process.env.FOOTPRINT_PASSWORD || "",
  };

  if (!config.password) {
    console.error("Error: FOOTPRINT_PASSWORD environment variable required");
    process.exit(1);
  }

  const server = new FootprintServer(config);

  // Setup cleanup handlers for graceful shutdown
  const cleanup = () => {
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

// Handle both direct execution and symlink execution
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("/footprint") ||
  process.argv[1]?.endsWith("/dist/index.js");

if (isMainModule) {
  main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}

export { FootprintTestHelpers } from "./test-helpers.js";
