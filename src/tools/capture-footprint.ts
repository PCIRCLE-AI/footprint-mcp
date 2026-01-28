import * as z from "zod";
import * as crypto from "crypto";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import { encrypt, type DerivedKey } from "../lib/crypto/index.js";
import {
  getCurrentCommit,
  type EvidenceDatabase,
} from "../lib/storage/index.js";
import type { CaptureEvidenceParams } from "../types.js";

export const captureFootprintSchema = {
  inputSchema: {
    conversationId: z.string().describe("Conversation ID"),
    llmProvider: z
      .string()
      .describe("LLM provider name (e.g., Claude Sonnet 4.5)"),
    content: z
      .string()
      .describe("Conversation content (messages, prompts, responses)"),
    messageCount: z.number().int().positive().describe("Number of messages"),
    tags: z.string().optional().describe("Optional tags (comma-separated)"),
  },
  outputSchema: {
    id: z.string(),
    timestamp: z.string(),
    gitCommitHash: z.string().nullable(),
    success: z.boolean(),
  },
};

export const captureFootprintMetadata = {
  title: "Capture Footprint",
  description: "Capture and encrypt LLM conversation as footprint",
};

export function createCaptureFootprintHandler(
  db: EvidenceDatabase,
  getDerivedKey: () => Promise<Uint8Array>,
) {
  return wrapToolHandler(
    "capture-footprint",
    "Check content is not empty, messageCount is positive, and tags format is valid.",
    async (params: CaptureEvidenceParams) => {
      // Validation
      if (!params.content || params.content.trim().length === 0) {
        throw new Error("Content cannot be empty");
      }
      if (params.messageCount <= 0) {
        throw new Error("Message count must be positive");
      }
      // eslint-disable-next-line no-control-regex
      if (/[\x00\n\r,]/.test(params.conversationId)) {
        throw new Error(
          "Conversation ID cannot contain null bytes, newlines, or commas",
        );
      }

      // Validate and sanitize tags if provided
      if (params.tags) {
        const tags = params.tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0);

        if (tags.length === 0) {
          throw new Error("All provided tags are empty or whitespace");
        }

        for (const tag of tags) {
          // eslint-disable-next-line no-control-regex
          if (/[\x00\n\r,]/.test(tag)) {
            throw new Error(
              `Invalid tag format: "${tag}". Tags cannot contain null bytes, newlines, or commas.`,
            );
          }
        }

        params.tags = tags.join(",");
      }

      // Encrypt and capture
      const key = await getDerivedKey();
      const encrypted = await encrypt(params.content, key);
      const gitInfo = await getCurrentCommit();
      const contentHash = crypto
        .createHash("sha256")
        .update(params.content)
        .digest("hex");
      const timestamp = new Date().toISOString();

      const id = db.create({
        timestamp,
        conversationId: params.conversationId,
        llmProvider: params.llmProvider,
        encryptedContent: encrypted.ciphertext,
        nonce: encrypted.nonce,
        contentHash,
        messageCount: params.messageCount,
        gitCommitHash: gitInfo?.commitHash || null,
        gitTimestamp: gitInfo?.timestamp || null,
        tags: params.tags || null,
      });

      return formatSuccessResponse(
        "Evidence captured successfully",
        {
          ID: id,
          Timestamp: timestamp,
          "Git Commit": gitInfo?.commitHash || "N/A",
          "Message Count": params.messageCount,
        },
        {
          id,
          timestamp,
          gitCommitHash: gitInfo?.commitHash || null,
          success: true,
        },
      );
    },
  );
}
