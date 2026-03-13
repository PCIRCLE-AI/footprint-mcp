import { fileURLToPath } from "url";
import * as path from "path";
import * as fs from "fs";
import * as z from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Resolve SKILL.md from the package root.
 * Handles both dev (src/prompts/) and built (dist/prompts/) paths.
 */
function findSkillMd(): string {
  const candidates = [
    path.resolve(__dirname, "../../SKILL.md"), // from dist/prompts/ or src/prompts/
    path.resolve(__dirname, "../../../SKILL.md"), // fallback
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return fs.readFileSync(p, "utf-8");
  }
  throw new Error("SKILL.md not found");
}

const QUICK_REFERENCE = `# Footprint Quick Reference

## Decision Tree
Should I capture this conversation?
\u251C\u2500 User explicitly asked \u2192 YES (capture immediately)
\u251C\u2500 High-value content (IP/Legal/Business/Research/Compliance) \u2192 SUGGEST to user
\u251C\u2500 Casual chat/small talk \u2192 NO
\u2514\u2500 Uncertain \u2192 ASK user

Should I reuse prior work context?
\u251C\u2500 Continuing or resuming work \u2192 resolve-context first
\u251C\u2500 resolve-context says confirmationRequired \u2192 ASK user
\u251C\u2500 In interactive CLI, use context prepare / run --prepare-context to ask before recording
\u251C\u2500 No strong candidate \u2192 create or confirm a new context
\u2514\u2500 User corrected the context before \u2192 trust confirmed context, not guesswork

## Tool Selection
- Save conversation \u2192 capture-footprint
- Browse/overview \u2192 list-footprints
- Full content retrieval \u2192 get-footprint
- Find by query/tags/dates \u2192 search-footprints
- Legal/audit export \u2192 export-footprints
- Session browse/detail \u2192 list-sessions / get-session
- Session handoff export \u2192 export-sessions
- Resolve likely work context \u2192 resolve-context
- Inspect confirmed context briefing \u2192 list-contexts / get-context
- Confirm or correct session-to-context links \u2192 confirm-context-link / reject-context-link / move-session-context
- Reorganize contexts \u2192 merge-contexts / split-context / set-active-context
- Verify integrity \u2192 verify-footprint
- Tag management \u2192 manage-tags (stats/rename/remove)
- Keyword pre-filter \u2192 suggest-capture
- Semantic assessment \u2192 Use footprint-should-capture prompt

## Tag Conventions
Format: 3-6 tags, comma-separated
Types: decision, milestone, research, review, approval
Domains: api, ui, database, security, legal, business
Status: draft, finalized, approved, rejected

## conversationId Format
{topic-type}-{descriptive-name}-{YYYY-MM-DD}`;

/**
 * Register all Footprint MCP prompts on the server.
 */
export function registerSkillPrompts(server: McpServer): void {
  const skillContent = findSkillMd();

  // Full SKILL.md content
  server.registerPrompt(
    "footprint-skill",
    {
      description:
        "Complete Footprint agent skill guide — decision tree, tool reference, best practices, error recovery, and workflow examples",
    },
    async () => ({
      messages: [
        {
          role: "user" as const,
          content: { type: "text" as const, text: skillContent },
        },
      ],
    }),
  );

  // Condensed quick reference
  server.registerPrompt(
    "footprint-quick-ref",
    {
      description:
        "Condensed quick reference for Footprint — decision tree, tool selection, tag conventions",
    },
    async () => ({
      messages: [
        {
          role: "user" as const,
          content: { type: "text" as const, text: QUICK_REFERENCE },
        },
      ],
    }),
  );

  // Semantic capture decision framework
  server.registerPrompt(
    "footprint-should-capture",
    {
      description:
        "Semantic decision framework for whether to capture a conversation as evidence. Provides structured criteria for the AI to assess, unlike suggest-capture which uses keyword matching.",
      argsSchema: {
        conversationSummary: z
          .string()
          .min(1, "Conversation summary cannot be empty")
          .max(10000, "Conversation summary too long (max 10000 characters)")
          .describe("Brief summary of the conversation content to evaluate"),
      },
    },
    async ({ conversationSummary }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: `Evaluate whether this conversation should be captured as evidence using Footprint.

## Conversation Summary
${conversationSummary}

## Decision Criteria
Rate each category 0-3 (0=none, 1=low, 2=medium, 3=high):

1. **Intellectual Property Value**: Does it contain inventions, algorithms, novel approaches, patents, trade secrets?
2. **Legal Significance**: Does it involve contracts, agreements, licenses, legal obligations, regulatory requirements?
3. **Business Decision Impact**: Does it record decisions, approvals, milestones, deliverables, strategic direction?
4. **Research Value**: Does it contain hypotheses, findings, experimental results, data analysis, methodology?
5. **Compliance/Audit Need**: Does it need to be documented for audit trails, regulatory compliance, evidence preservation?

## Decision Rules
- Any category >= 2 \u2192 RECOMMEND CAPTURE
- Multiple categories >= 1 \u2192 RECOMMEND CAPTURE
- All categories = 0 \u2192 DO NOT CAPTURE
- Uncertain \u2192 ASK USER

## Response Format
Respond with:
- **Capture**: yes/no/ask
- **Confidence**: 0.0-1.0
- **Primary Reason**: One sentence
- **Suggested Tags**: comma-separated
- **Suggested conversationId**: {topic}-{descriptor}-{YYYY-MM-DD} format`,
          },
        },
      ],
    }),
  );
}
