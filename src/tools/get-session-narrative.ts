import * as z from "zod";
import {
  buildPageInfo,
  DEFAULT_SESSION_DETAIL_PAGE_LIMIT,
  MAX_SESSION_DETAIL_PAGE_LIMIT,
} from "../lib/session-history.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import type { EvidenceDatabase, NarrativeKind } from "../lib/storage/index.js";
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

export const getSessionNarrativeSchema = {
  inputSchema: {
    id: z.string().describe("ID of the recorded session"),
    kind: z
      .enum(["journal", "project-summary", "handoff"])
      .optional()
      .describe("Optional narrative kind filter"),
    limit: z
      .number()
      .int()
      .positive()
      .max(MAX_SESSION_DETAIL_PAGE_LIMIT)
      .optional()
      .describe(
        `Optional page size for the narrative slice. Defaults to ${DEFAULT_SESSION_DETAIL_PAGE_LIMIT}.`,
      ),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Optional offset for the narrative slice."),
  },
  outputSchema: {
    sessionId: z.string(),
    page: pageInfoSchema,
    narratives: z.array(
      z.object({
        id: z.string(),
        sessionId: z.string(),
        kind: z.enum(["journal", "project-summary", "handoff"]),
        content: z.string(),
        sourceRefs: z.array(z.object({ type: z.string(), id: z.string() })),
        createdAt: z.string(),
        updatedAt: z.string(),
      }),
    ),
  },
};

export const getSessionNarrativeMetadata = {
  title: "Get Session Narrative",
  description:
    "Return paginated derived narratives for a session, including journal, project summary, and handoff views.",
  ...sessionDetailUiMetadata,
};

export function createGetSessionNarrativeHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "get-session-narrative",
    "Run reingest-session first if narratives have not been generated yet.",
    async (params: {
      id: string;
      kind?: NarrativeKind;
      limit?: number;
      offset?: number;
    }) => {
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

      const total = db.countSessionNarratives(params.id, {
        kind: params.kind,
      });
      const narratives = db
        .getSessionNarratives(params.id, {
          kind: params.kind,
          limit,
          offset,
        })
        .map((narrative) => ({
          ...narrative,
          sourceRefs: parseRefs(narrative.sourceRefs),
        }));
      const page = buildPageInfo(total, narratives.length, {
        offset,
        limit,
      });

      return formatSuccessResponse(
        "Session narratives retrieved successfully",
        {
          Session: params.id,
          Narratives: narratives.length,
          Kind: params.kind ?? "all",
          Offset: offset,
          Limit: limit,
        },
        {
          sessionId: params.id,
          page,
          narratives,
        },
      );
    },
  );
}
