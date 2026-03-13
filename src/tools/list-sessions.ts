import * as z from "zod";
import { toSessionListItem } from "../lib/session-history.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import type {
  EvidenceDatabase,
  SessionHost,
  SessionStatus,
} from "../lib/storage/index.js";
import { sessionDashboardUiMetadata } from "./session-ui-metadata.js";

const sessionHostEnum = z.enum(["claude", "gemini", "codex"]);
const sessionStatusEnum = z.enum([
  "running",
  "completed",
  "failed",
  "interrupted",
]);

export const listSessionsSchema = {
  inputSchema: {
    query: z
      .string()
      .optional()
      .describe(
        "Optional text filter across metadata, transcript, and derived history",
      ),
    issueKey: z.string().optional().describe("Optional exact issue key filter"),
    host: sessionHostEnum.optional().describe("Optional host filter"),
    status: sessionStatusEnum.optional().describe("Optional status filter"),
    limit: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Maximum number of sessions to return"),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Number of sessions to skip for pagination"),
  },
  outputSchema: {
    sessions: z.array(
      z.object({
        id: z.string(),
        host: sessionHostEnum,
        title: z.string().nullable(),
        label: z.string(),
        status: sessionStatusEnum,
        startedAt: z.string(),
        endedAt: z.string().nullable(),
        cwd: z.string(),
        projectRoot: z.string(),
      }),
    ),
    filters: z.object({
      query: z.string().optional(),
      issueKey: z.string().optional(),
      host: sessionHostEnum.optional(),
      status: sessionStatusEnum.optional(),
    }),
    total: z.number(),
  },
};

export const listSessionsMetadata = {
  title: "List Sessions",
  description:
    "List recorded CLI sessions in reverse chronological order. Each session includes host, label, status, and timestamps.",
  ...sessionDashboardUiMetadata,
};

export function createListSessionsHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "list-sessions",
    "Ensure limit is positive, offset is non-negative, and optional query/issueKey/host/status filters are valid.",
    async (params: {
      query?: string;
      issueKey?: string;
      host?: SessionHost;
      status?: SessionStatus;
      limit?: number;
      offset?: number;
    }) => {
      if (params.limit !== undefined && params.limit <= 0) {
        throw new Error("Limit must be positive");
      }

      if (params.offset !== undefined && params.offset < 0) {
        throw new Error("Offset cannot be negative");
      }
      if (params.query !== undefined && !params.query.trim()) {
        throw new Error("Query must not be empty");
      }
      if (params.issueKey !== undefined && !params.issueKey.trim()) {
        throw new Error("issueKey must not be empty");
      }

      const result = db.querySessionsByHistory(params);
      const sessions = result.sessions.map(toSessionListItem);

      return formatSuccessResponse(
        "Session list retrieved successfully",
        {
          Count: sessions.length,
          Query: params.query?.trim() || "all",
          Issue: params.issueKey?.trim() || "all",
          Host: params.host ?? "all",
          Status: params.status ?? "all",
          Limit: params.limit ?? "No limit",
          Offset: params.offset ?? 0,
        },
        {
          sessions,
          filters: {
            query: params.query?.trim() || undefined,
            issueKey: params.issueKey?.trim() || undefined,
            host: params.host,
            status: params.status,
          },
          total: result.total,
        },
      );
    },
  );
}
