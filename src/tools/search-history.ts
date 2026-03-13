import * as z from "zod";
import { collectSessionSearchableText } from "../lib/session-filters.js";
import { getSessionLabel } from "../lib/session-history.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import type {
  EvidenceDatabase,
  SessionHost,
  SessionStatus,
} from "../lib/storage/index.js";
import { sessionDashboardUiMetadata } from "./session-ui-metadata.js";

function collectSnippets(
  textNeedle: string,
  haystack: string[],
  limit: number = 3,
): string[] {
  const loweredNeedle = textNeedle.toLowerCase();
  return haystack
    .filter((item) => item.toLowerCase().includes(loweredNeedle))
    .slice(0, limit);
}

export const searchHistorySchema = {
  inputSchema: {
    query: z
      .string()
      .describe(
        "Text to search across sessions, messages, narratives, and decisions",
      ),
    host: z
      .enum(["claude", "gemini", "codex"])
      .optional()
      .describe("Optional host filter"),
    status: z
      .enum(["running", "completed", "failed", "interrupted"])
      .optional()
      .describe("Optional status filter"),
    limit: z.number().int().positive().optional(),
    offset: z.number().int().min(0).optional(),
  },
  outputSchema: {
    query: z.string(),
    filters: z.object({
      host: z.enum(["claude", "gemini", "codex"]).optional(),
      status: z
        .enum(["running", "completed", "failed", "interrupted"])
        .optional(),
    }),
    results: z.array(
      z.object({
        sessionId: z.string(),
        host: z.enum(["claude", "gemini", "codex"]),
        label: z.string(),
        status: z.enum(["running", "completed", "failed", "interrupted"]),
        startedAt: z.string(),
        snippets: z.array(z.string()),
      }),
    ),
    total: z.number(),
  },
};

export const searchHistoryMetadata = {
  title: "Search History",
  description:
    "Search recorded session history across session metadata, transcript, artifacts, narratives, and decisions.",
  ...sessionDashboardUiMetadata,
};

export function createSearchHistoryHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "search-history",
    "Provide a non-empty query and optional host/status filters.",
    async (params: {
      query: string;
      host?: SessionHost;
      status?: SessionStatus;
      limit?: number;
      offset?: number;
    }) => {
      const query = params.query.trim();
      if (!query) {
        throw new Error("Query must not be empty");
      }
      if (params.limit !== undefined && params.limit <= 0) {
        throw new Error("Limit must be positive");
      }
      if (params.offset !== undefined && params.offset < 0) {
        throw new Error("Offset cannot be negative");
      }

      const matchedSessions = db.querySessionsByHistory({
        host: params.host,
        status: params.status,
        query,
        limit: params.limit,
        offset: params.offset,
      });
      const paginated = matchedSessions.sessions
        .map((session) => {
          const searchable = collectSessionSearchableText(db, session);
          const snippets = collectSnippets(query, searchable);
          return snippets.length > 0
            ? {
                sessionId: session.id,
                host: session.host,
                label: getSessionLabel(session),
                status: session.status,
                startedAt: session.startedAt,
                snippets,
              }
            : null;
        })
        .filter((result): result is NonNullable<typeof result> =>
          Boolean(result),
        );

      return formatSuccessResponse(
        "Session history search completed successfully",
        {
          Matches: paginated.length,
          Total: matchedSessions.total,
          Query: query,
        },
        {
          query,
          filters: {
            host: params.host,
            status: params.status,
          },
          results: paginated,
          total: matchedSessions.total,
        },
      );
    },
  );
}
