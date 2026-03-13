import * as z from "zod";
import {
  buildPageInfo,
  MAX_SESSION_DETAIL_PAGE_LIMIT,
} from "../lib/session-history.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";
import { sessionDetailUiMetadata } from "./session-ui-metadata.js";

const pageInfoSchema = z.object({
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
  returned: z.number(),
  hasMore: z.boolean(),
  nextOffset: z.number().nullable(),
});
export const getSessionMessagesSchema = {
  inputSchema: {
    id: z.string().describe("ID of the recorded session"),
    limit: z
      .number()
      .int()
      .positive()
      .max(MAX_SESSION_DETAIL_PAGE_LIMIT)
      .optional()
      .describe("Optional page size for transcript pagination"),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Optional transcript offset for pagination"),
  },
  outputSchema: {
    sessionId: z.string(),
    total: z.number(),
    page: pageInfoSchema,
    messages: z.array(
      z.object({
        id: z.string(),
        sessionId: z.string(),
        seq: z.number(),
        role: z.enum(["user", "assistant", "system"]),
        source: z.string(),
        content: z.string(),
        capturedAt: z.string(),
        metadata: z.string().nullable(),
      }),
    ),
  },
};

export const getSessionMessagesMetadata = {
  title: "Get Session Messages",
  description:
    "Return the ordered raw transcript for a recorded session, with optional pagination.",
  ...sessionDetailUiMetadata,
};

export function createGetSessionMessagesHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "get-session-messages",
    "Verify the session ID exists and keep transcript pagination values valid before requesting transcript details.",
    async (params: { id: string; limit?: number; offset?: number }) => {
      const session = db.findSessionById(params.id);
      if (!session) {
        throw new Error(`Session not found: ${params.id}`);
      }

      if (
        params.limit !== undefined &&
        (params.limit <= 0 || params.limit > MAX_SESSION_DETAIL_PAGE_LIMIT)
      ) {
        throw new Error(
          `limit must be between 1 and ${MAX_SESSION_DETAIL_PAGE_LIMIT}`,
        );
      }

      if (params.offset !== undefined && params.offset < 0) {
        throw new Error("offset cannot be negative");
      }

      const offset = params.offset ?? 0;
      const messages = db.getSessionMessages(params.id, {
        limit: params.limit,
        offset,
      });
      const total = db.countSessionMessages(params.id);
      const page = buildPageInfo(total, messages.length, {
        offset,
        limit: params.limit ?? Math.max(messages.length, total - offset, 0),
      });
      return formatSuccessResponse(
        "Session messages retrieved successfully",
        {
          Session: params.id,
          Messages: messages.length,
          Total: total,
          Offset: page.offset,
          Limit: page.limit,
        },
        {
          sessionId: params.id,
          total,
          page,
          messages,
        },
      );
    },
  );
}
