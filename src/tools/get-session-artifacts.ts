import * as z from "zod";
import {
  buildPageInfo,
  DEFAULT_SESSION_DETAIL_PAGE_LIMIT,
  MAX_SESSION_DETAIL_PAGE_LIMIT,
} from "../lib/session-history.js";
import { parseArtifactMetadata } from "../lib/session-artifacts.js";
import { formatSuccessResponse } from "../lib/tool-response.js";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import type { ArtifactType, EvidenceDatabase } from "../lib/storage/index.js";
import { sessionDetailUiMetadata } from "./session-ui-metadata.js";

const artifactTypeEnum = z.enum([
  "file-change",
  "command-output",
  "test-result",
  "git-commit",
]);
const pageInfoSchema = z.object({
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
  returned: z.number(),
  hasMore: z.boolean(),
  nextOffset: z.number().nullable(),
});

export const getSessionArtifactsSchema = {
  inputSchema: {
    id: z.string().describe("ID of the recorded session"),
    artifactType: artifactTypeEnum
      .optional()
      .describe("Optional deterministic artifact type filter"),
    limit: z
      .number()
      .int()
      .positive()
      .max(MAX_SESSION_DETAIL_PAGE_LIMIT)
      .optional()
      .describe(
        `Optional page size for the artifact slice. Defaults to ${DEFAULT_SESSION_DETAIL_PAGE_LIMIT}.`,
      ),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("Optional offset for the artifact slice."),
  },
  outputSchema: {
    sessionId: z.string(),
    artifactSummary: z.object({
      total: z.number(),
      byType: z.object({
        fileChange: z.number(),
        commandOutput: z.number(),
        testResult: z.number(),
        gitCommit: z.number(),
      }),
    }),
    page: pageInfoSchema,
    artifacts: z.array(
      z.object({
        id: z.string(),
        sessionId: z.string(),
        eventId: z.string().nullable(),
        artifactType: artifactTypeEnum,
        path: z.string().nullable(),
        createdAt: z.string(),
        summary: z.string(),
        category: z.string().nullable(),
        status: z.string().nullable(),
        outcome: z.string().nullable(),
        intent: z.string().nullable(),
        commandFamily: z.string().nullable(),
        command: z.string().nullable(),
        args: z.array(z.string()),
        framework: z.string().nullable(),
        packageManager: z.string().nullable(),
        scriptName: z.string().nullable(),
        dependencyAction: z.string().nullable(),
        dependencyNames: z.array(z.string()),
        failureSignatureKey: z.string().nullable(),
        failureSignatureLabel: z.string().nullable(),
        errorCode: z.string().nullable(),
        lintRuleId: z.string().nullable(),
        testSuite: z.string().nullable(),
        testCase: z.string().nullable(),
        issueKey: z.string().nullable(),
        issueLabel: z.string().nullable(),
        issueFamilyKey: z.string().nullable(),
        issueFamilyLabel: z.string().nullable(),
        pathCategory: z.string().nullable(),
        changeScope: z.string().nullable(),
        manifestKind: z.string().nullable(),
        previousHead: z.string().nullable(),
        currentHead: z.string().nullable(),
        sourceRefs: z.array(
          z.object({
            type: z.enum(["message", "event", "artifact"]),
            id: z.string(),
          }),
        ),
        details: z.record(z.string(), z.unknown()),
      }),
    ),
  },
};

export const getSessionArtifactsMetadata = {
  title: "Get Session Artifacts",
  description:
    "Return paginated deterministic artifacts extracted from a session history, including commands, tests, file changes, and git commits.",
  ...sessionDetailUiMetadata,
};

export function createGetSessionArtifactsHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "get-session-artifacts",
    "Run reingest-session first if deterministic artifacts have not been generated yet.",
    async (params: {
      id: string;
      artifactType?: ArtifactType;
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

      const summary = db.getSessionArtifactSummary(params.id);
      const total = db.countSessionArtifacts(params.id, {
        artifactType: params.artifactType,
      });
      const artifacts = db
        .getSessionArtifacts(params.id, {
          artifactType: params.artifactType,
          limit,
          offset,
        })
        .map((artifact) => {
          const metadata = parseArtifactMetadata(artifact.metadata);
          return {
            id: artifact.id,
            sessionId: artifact.sessionId,
            eventId: artifact.eventId,
            artifactType: artifact.artifactType,
            path: artifact.path,
            createdAt: artifact.createdAt,
            summary: metadata.summary ?? artifact.path ?? artifact.artifactType,
            category: metadata.category,
            status: metadata.status,
            outcome: metadata.outcome,
            intent: metadata.intent,
            commandFamily: metadata.commandFamily,
            command: metadata.command,
            args: metadata.args,
            framework: metadata.framework,
            packageManager: metadata.packageManager,
            scriptName: metadata.scriptName,
            dependencyAction: metadata.dependencyAction,
            dependencyNames: metadata.dependencyNames,
            failureSignatureKey: metadata.failureSignatureKey,
            failureSignatureLabel: metadata.failureSignatureLabel,
            errorCode: metadata.errorCode,
            lintRuleId: metadata.lintRuleId,
            testSuite: metadata.testSuite,
            testCase: metadata.testCase,
            issueKey: metadata.issueKey,
            issueLabel: metadata.issueLabel,
            issueFamilyKey: metadata.issueFamilyKey,
            issueFamilyLabel: metadata.issueFamilyLabel,
            pathCategory: metadata.pathCategory,
            changeScope: metadata.changeScope,
            manifestKind: metadata.manifestKind,
            previousHead: metadata.previousHead,
            currentHead: metadata.currentHead,
            sourceRefs: metadata.sourceRefs,
            details: metadata.details,
          };
        });
      const page = buildPageInfo(total, artifacts.length, {
        offset,
        limit,
      });

      return formatSuccessResponse(
        "Session artifacts retrieved successfully",
        {
          Session: params.id,
          Artifacts: artifacts.length,
          Filter: params.artifactType ?? "all",
          Offset: offset,
          Limit: limit,
        },
        {
          sessionId: params.id,
          artifactSummary: summary,
          page,
          artifacts,
        },
      );
    },
  );
}
