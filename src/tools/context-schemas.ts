import * as z from "zod";

export const sessionHostEnum = z.enum(["claude", "gemini", "codex"]);
export const sessionStatusEnum = z.enum([
  "running",
  "completed",
  "failed",
  "interrupted",
]);
export const contextConfidenceEnum = z.enum(["high", "medium", "low"]);

export const contextSessionSummarySchema = z.object({
  id: z.string(),
  label: z.string(),
  host: sessionHostEnum,
  status: sessionStatusEnum,
  startedAt: z.string(),
  endedAt: z.string().nullable(),
});

export const contextListItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  workspaceKey: z.string(),
  latestSessionId: z.string(),
  latestSessionLabel: z.string(),
  latestStartedAt: z.string(),
  latestEndedAt: z.string().nullable(),
  sessionCount: z.number(),
  hosts: z.array(sessionHostEnum),
  statuses: z.array(sessionStatusEnum),
  confidence: contextConfidenceEnum,
  confidenceScore: z.number(),
  signals: z.array(z.string()),
});

export const contextDecisionSchema = z.object({
  decisionId: z.string(),
  topic: z.string(),
  sessionId: z.string(),
  sessionLabel: z.string(),
  title: z.string(),
  summary: z.string(),
  rationale: z.string().nullable(),
  status: z.enum(["proposed", "accepted", "rejected", "open"]),
  createdAt: z.string(),
});

export const supersededContextDecisionSchema = contextDecisionSchema.extend({
  supersededByDecisionId: z.string().nullable(),
  supersededByTitle: z.string().nullable(),
});

export const contextChangeSchema = z.object({
  kind: z.enum(["decision-updated", "context-refreshed"]),
  summary: z.string(),
  sessionId: z.string().nullable(),
  sessionLabel: z.string().nullable(),
  createdAt: z.string().nullable(),
});

export const contextCurrentTruthSchema = z.object({
  summary: z.string(),
  latestSessionId: z.string(),
  latestSessionLabel: z.string(),
  latestSummaryNarrative: z.string().nullable(),
  latestHandoff: z.string().nullable(),
  activeBlockers: z.array(z.string()),
  openQuestions: z.array(z.string()),
});

export const contextTrendSchema = z.object({
  groupBy: z.enum(["issue", "family"]),
  issueKey: z.string(),
  label: z.string(),
  kind: z.string().nullable(),
  relatedIssueKeys: z.array(z.string()),
  blockerCategory: z.string(),
  blockerState: z.enum(["active", "resolved"]),
  remediationState: z.enum(["unresolved", "recovered", "regressed", "stable"]),
  remediationSummary: z.string(),
  latestOutcome: z.string(),
  latestFailureAt: z.string().nullable(),
  latestSuccessAt: z.string().nullable(),
  lastSeenAt: z.string(),
  attemptCount: z.number(),
  sessionCount: z.number(),
  failedAttempts: z.number(),
  succeededAttempts: z.number(),
  otherAttempts: z.number(),
  hosts: z.array(sessionHostEnum),
  statuses: z.array(sessionStatusEnum),
  sessions: z.array(
    z.object({
      sessionId: z.string(),
      label: z.string(),
      host: sessionHostEnum,
      status: sessionStatusEnum,
      startedAt: z.string(),
      lastAttemptAt: z.string(),
      attempts: z.number(),
      latestOutcome: z.string(),
    }),
  ),
});

export const contextReportSchema = z.object({
  context: contextListItemSchema,
  currentTruth: contextCurrentTruthSchema,
  activeDecisions: z.array(contextDecisionSchema),
  supersededDecisions: z.array(supersededContextDecisionSchema),
  changeLog: z.array(contextChangeSchema),
  sessions: z.array(contextSessionSummarySchema),
  trends: z.array(contextTrendSchema),
  handoff: z.object({
    summary: z.object({
      groupBy: z.enum(["issue", "family"]),
      headline: z.string(),
      matchingSessions: z.number(),
      matchingHosts: z.array(sessionHostEnum),
      statuses: z.array(sessionStatusEnum),
      totalTrends: z.number(),
      blockingTrends: z.number(),
      recoveredTrends: z.number(),
      regressedTrends: z.number(),
      unresolvedQuestions: z.number(),
      latestSessionId: z.string().nullable(),
      latestSessionLabel: z.string().nullable(),
      latestStartedAt: z.string().nullable(),
    }),
    followUps: z.array(z.string()),
    blockers: z.array(z.string()),
  }),
  markdown: z.string(),
});

export const contextCandidateSchema = z.object({
  kind: z.enum(["existing-context", "new-context"]),
  contextId: z.string().nullable(),
  label: z.string(),
  workspaceKey: z.string(),
  confidence: contextConfidenceEnum,
  confidenceScore: z.number(),
  reasons: z.array(z.string()),
  sessionIds: z.array(z.string()),
  latestSessionId: z.string().nullable(),
  latestSessionLabel: z.string().nullable(),
  preferred: z.boolean(),
  confirmationRequired: z.boolean(),
});

export const contextResolutionSchema = z.object({
  mode: z.enum(["linked", "preferred", "suggested", "none"]),
  sessionId: z.string().nullable(),
  cwd: z.string().nullable(),
  confirmationRequired: z.boolean(),
  recommendedAction: z.enum([
    "use-linked",
    "use-preferred",
    "confirm-existing",
    "create-new-context",
    "choose-candidate",
    "none",
  ]),
  linkedContextId: z.string().nullable(),
  currentContext: contextListItemSchema.nullable(),
  briefing: contextReportSchema.nullable(),
  candidates: z.array(contextCandidateSchema),
});

export const contextMutationSchema = z.object({
  action: z.enum([
    "confirmed",
    "rejected",
    "moved",
    "merged",
    "split",
    "preferred",
  ]),
  context: contextListItemSchema.nullable(),
  affectedSessionIds: z.array(z.string()),
  contextId: z.string().nullable(),
  mergedFromContextId: z.string().nullable(),
});
