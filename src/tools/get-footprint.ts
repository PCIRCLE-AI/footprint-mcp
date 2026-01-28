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
    "Verify the evidence ID exists and password is correct.",
    async (params: { id: string }) => {
      const evidence = db.findById(params.id);
      if (!evidence) {
        throw new Error(`Evidence not found: ${params.id}`);
      }

      const key = await getDerivedKey();
      const decrypted = decrypt(evidence.encryptedContent, evidence.nonce, key);

      const gitInfo =
        evidence.gitCommitHash && evidence.gitTimestamp
          ? {
              commitHash: evidence.gitCommitHash,
              timestamp: evidence.gitTimestamp,
            }
          : null;

      return formatSuccessResponse(
        "Evidence retrieved successfully",
        {
          ID: evidence.id,
          Timestamp: evidence.timestamp,
          Provider: evidence.llmProvider,
          "Message Count": evidence.messageCount,
          "Content Preview": `${decrypted.substring(0, 100)}...`,
        },
        {
          id: evidence.id,
          timestamp: evidence.timestamp,
          conversationId: evidence.conversationId,
          llmProvider: evidence.llmProvider,
          content: decrypted,
          messageCount: evidence.messageCount,
          gitInfo,
          tags: evidence.tags,
        },
      );
    },
  );
}
