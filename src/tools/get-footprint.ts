import * as z from "zod";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import { decrypt } from "../lib/crypto/index.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";

export const getFootprintSchema = {
  inputSchema: {
    id: z.string().describe("Footprint ID"),
  },
  outputSchema: {
    id: z.string(),
    timestamp: z.string(),
    conversationId: z.string(),
    llmProvider: z.string(),
    content: z.string(),
    messageCount: z.number(),
    gitInfo: z
      .object({
        commitHash: z.string(),
        timestamp: z.string(),
      })
      .nullable(),
    tags: z.string().nullable(),
  },
};

export const getFootprintMetadata = {
  title: "Get Footprint",
  description: "Retrieve and decrypt specific footprint by ID",
  _meta: {
    ui: {
      resourceUri: "ui://footprint/detail.html",
    },
  },
};

export function createGetFootprintHandler(
  db: EvidenceDatabase,
  getDerivedKey: () => Promise<Uint8Array>,
) {
  return wrapToolHandler(
    "get-footprint",
    "Verify the footprint ID exists and password is correct.",
    async (params: { id: string }) => {
      const fp = db.findById(params.id);
      if (!fp) {
        throw new Error(`Footprint not found: ${params.id}`);
      }

      const key = await getDerivedKey();
      const decrypted = decrypt(fp.encryptedContent, fp.nonce, key);

      const gitInfo =
        fp.gitCommitHash && fp.gitTimestamp
          ? {
              commitHash: fp.gitCommitHash,
              timestamp: fp.gitTimestamp,
            }
          : null;

      return formatSuccessResponse(
        "Footprint retrieved successfully",
        {
          ID: fp.id,
          Timestamp: fp.timestamp,
          Provider: fp.llmProvider,
          "Message Count": fp.messageCount,
          "Content Preview": `${decrypted.substring(0, 100)}...`,
        },
        {
          id: fp.id,
          timestamp: fp.timestamp,
          conversationId: fp.conversationId,
          llmProvider: fp.llmProvider,
          content: decrypted,
          messageCount: fp.messageCount,
          gitInfo,
          tags: fp.tags,
        },
      );
    },
  );
}
