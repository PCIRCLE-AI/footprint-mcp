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
export const getSessionTimelineSchema = {
  inputSchema: {
    id: z.string().describe("ID of the recorded session"),
    limit: z
      .number()
      .int()
      .positive()
      .max(MAX_SESSION_DETAIL_PAGE_LIMIT)
      .optional()
      .describe("Optional page size for timeline pagination"),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Optional timeline offset for pagination"),
  },
  outputSchema: {
    sessionId: z.string(),
    total: z.number(),
    page: pageInfoSchema,
    timeline: z.array(
      z.object({
        id: z.string(),
        sessionId: z.string(),
        seq: z.number(),
        eventType: z.string(),
        eventSubType: z.string().nullable(),
        source: z.string(),
        summary: z.string().nullable(),
        payload: z.string().nullable(),
        startedAt: z.string(),
        endedAt: z.string().nullable(),
        status: z.string().nullable(),
        relatedMessageId: z.string().nullable(),
      }),
    ),
  },
};

export const getSessionTimelineMetadata = {
  title: "Get Session Timeline",
  description:
    "Return the ordered timeline for a recorded session, with optional pagination.",
  ...sessionDetailUiMetadata,
};

export function createGetSessionTimelineHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "get-session-timeline",
    "Verify the session ID exists and keep timeline pagination values valid before requesting timeline details.",
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
      const timeline = db.getSessionTimeline(params.id, {
        limit: params.limit,
        offset,
      });
      const total = db.countSessionTimeline(params.id);
      const page = buildPageInfo(total, timeline.length, {
        offset,
        limit: params.limit ?? Math.max(timeline.length, total - offset, 0),
      });
      return formatSuccessResponse(
        "Session timeline retrieved successfully",
        {
          Session: params.id,
          Events: timeline.length,
          Total: total,
          Offset: page.offset,
          Limit: page.limit,
        },
        {
          sessionId: params.id,
          total,
          page,
          timeline,
        },
      );
    },
  );
}
