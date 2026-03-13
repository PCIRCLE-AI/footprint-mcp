import * as z from "zod";
import * as crypto from "crypto";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import { encrypt } from "../lib/crypto/index.js";
import {
  getCurrentCommit,
  type EvidenceDatabase,
} from "../lib/storage/index.js";
import type { CaptureEvidenceParams } from "../types.js";

export const captureFootprintSchema = {
  inputSchema: {
    conversationId: z
      .string()
      .max(500, "Conversation ID too long (max 500 chars)")
      .describe(
        "Unique conversation identifier. Recommended format: {topic}-{descriptor}-{YYYY-MM-DD} (e.g., api-auth-decision-2026-01-28)",
      ),
    llmProvider: z
      .string()
      .default("unknown")
      .describe(
        "LLM provider name (e.g., Claude Sonnet 4.5). Defaults to 'unknown' if not specified.",
      ),
    content: z
      .string()
      .max(10 * 1024 * 1024, "Content exceeds 10MB limit")
      .describe(
        "Full conversation text including both human and assistant messages. Include complete message history for accurate evidence preservation.",
      ),
    messageCount: z
      .number()
      .int()
      .positive()
      .optional()
      .describe(
        "Number of messages in the conversation. If omitted, auto-calculated by counting conversation turn markers (Human:/Assistant:/User:/AI:/System:).",
      ),
    tags: z
      .string()
      .optional()
      .describe(
        "Comma-separated tags for categorization (e.g., 'ip,patent,decision'). Use 3-6 tags. Common types: decision, milestone, research, legal, compliance.",
      ),
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
  description:
    "Capture and encrypt an LLM conversation as a tamper-evident footprint. Use when: user explicitly asks to save, or high-value content detected (IP, legal, business, research, compliance). Creates encrypted record with SHA-256 hash and Git timestamp anchor.",
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
      const MAX_CONTENT_LENGTH = 10 * 1024 * 1024; // 10MB
      if (params.content.length > MAX_CONTENT_LENGTH) {
        throw new Error(
          `Content too large (${(params.content.length / (1024 * 1024)).toFixed(1)}MB). Maximum 10MB allowed.`,
        );
      }
      if (params.conversationId.length > 500) {
        throw new Error("Conversation ID too long (max 500 chars)");
      }
      if (params.messageCount !== undefined && params.messageCount <= 0) {
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
        const MAX_TAG_LENGTH = 100;
        const MAX_TAGS_COUNT = 20;
        const tags = params.tags
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0);

        if (tags.length === 0) {
          throw new Error("All provided tags are empty or whitespace");
        }

        if (tags.length > MAX_TAGS_COUNT) {
          throw new Error(
            `Too many tags (${tags.length}). Maximum ${MAX_TAGS_COUNT} tags allowed.`,
          );
        }

        for (const tag of tags) {
          if (tag.length > MAX_TAG_LENGTH) {
            throw new Error(
              `Tag too long (${tag.length} chars). Maximum ${MAX_TAG_LENGTH} characters per tag.`,
            );
          }
          // eslint-disable-next-line no-control-regex
          if (/[\x00\n\r,]/.test(tag)) {
            throw new Error(
              `Invalid tag format: "${tag}". Tags cannot contain null bytes, newlines, or commas.`,
            );
          }
        }

        // Use sanitized tags without mutating original params
        params = { ...params, tags: tags.join(",") };
      }

      // Auto-calculate messageCount if not provided
      let messageCount = params.messageCount;
      if (!messageCount) {
        const turnPattern = /^(Human|Assistant|User|System|AI):/im;
        const lines = params.content.split("\n");
        messageCount = lines.filter((line) =>
          turnPattern.test(line.trim()),
        ).length;
        if (messageCount === 0) messageCount = 1; // Default to 1 if no turns detected
      }

      // Apply runtime defaults for parameters with Zod schema defaults
      // (Zod defaults only apply through MCP SDK transport layer)
      const llmProvider = params.llmProvider || "unknown";

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
        llmProvider,
        encryptedContent: encrypted.ciphertext,
        nonce: encrypted.nonce,
        contentHash,
        messageCount,
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
          "Message Count": messageCount,
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
