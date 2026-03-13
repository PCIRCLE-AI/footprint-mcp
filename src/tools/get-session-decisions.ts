import * as z from "zod";
import {
  buildPageInfo,
  DEFAULT_SESSION_DETAIL_PAGE_LIMIT,
  MAX_SESSION_DETAIL_PAGE_LIMIT,
} from "../lib/session-history.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";
import { sessionDetailUiMetadata } from "./session-ui-metadata.js";

function parseRefs(value: string): Array<{ type: string; id: string }> {
  try {
    return JSON.parse(value) as Array<{ type: string; id: string }>;
  } catch {
    return [];
  }
}

const pageInfoSchema = z.object({
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
  returned: z.number(),
  hasMore: z.boolean(),
  nextOffset: z.number().nullable(),
});

export const getSessionDecisionsSchema = {
  inputSchema: {
    id: z.string().describe("ID of the recorded session"),
    limit: z
      .number()
      .int()
      .positive()
      .max(MAX_SESSION_DETAIL_PAGE_LIMIT)
      .optional()
      .describe(
        `Optional page size for the decision slice. Defaults to ${DEFAULT_SESSION_DETAIL_PAGE_LIMIT}.`,
      ),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Optional offset for the decision slice."),
  },
  outputSchema: {
    sessionId: z.string(),
    page: pageInfoSchema,
    decisions: z.array(
      z.object({
        id: z.string(),
        sessionId: z.string(),
        title: z.string(),
        summary: z.string(),
        rationale: z.string().nullable(),
        status: z.enum(["proposed", "accepted", "rejected", "open"]),
        sourceRefs: z.array(z.object({ type: z.string(), id: z.string() })),
        createdAt: z.string(),
      }),
    ),
  },
};

export const getSessionDecisionsMetadata = {
  title: "Get Session Decisions",
  description:
    "Return paginated derived decisions extracted from a session history.",
  ...sessionDetailUiMetadata,
};

export function createGetSessionDecisionsHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "get-session-decisions",
    "Run reingest-session first if decisions have not been generated yet.",
    async (params: { id: string; limit?: number; offset?: number }) => {
      const session = db.findSessionById(params.id);
      if (!session) {
        throw new Error(`Session not found: ${params.id}`);
      }

      const limit = params.limit ?? DEFAULT_SESSION_DETAIL_PAGE_LIMIT;
      const offset = params.offset ?? 0;

      if (limit <= 0 || limit > MAX_SESSION_DETAIL_PAGE_LIMIT) {
        throw new Error(
          `limit must be between 1 and ${MAX_SESSION_DETAIL_PAGE_LIMIT}`,
        );
      }

      if (offset < 0) {
        throw new Error("offset cannot be negative");
      }

      const total = db.countSessionDecisions(params.id);
      const decisions = db
        .getSessionDecisions(params.id, {
          limit,
          offset,
        })
        .map((decision) => ({
          ...decision,
          sourceRefs: parseRefs(decision.sourceRefs),
        }));
      const page = buildPageInfo(total, decisions.length, {
        offset,
        limit,
      });

      return formatSuccessResponse(
        "Session decisions retrieved successfully",
        {
          Session: params.id,
          Decisions: decisions.length,
          Offset: offset,
          Limit: limit,
        },
        {
          sessionId: params.id,
          page,
          decisions,
        },
      );
    },
  );
}
