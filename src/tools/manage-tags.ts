import * as z from "zod";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import { createToolResponse } from "../lib/tool-response.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";

export const manageTagsSchema = {
  inputSchema: {
    action: z
      .enum(["stats", "rename", "remove"])
      .describe(
        "Tag operation to perform: 'stats' returns all tags with usage counts, 'rename' renames a tag across all records, 'remove' deletes a tag from all records.",
      ),
    tag: z
      .string()
      .min(1)
      .optional()
      .describe("Tag name to remove (required when action='remove')"),
    oldTag: z
      .string()
      .min(1)
      .optional()
      .describe("Current tag name to rename (required when action='rename')"),
    newTag: z
      .string()
      .min(1)
      .optional()
      .describe("New tag name (required when action='rename')"),
  },
  outputSchema: {
    action: z.string(),
    tags: z
      .array(
        z.object({
          tag: z.string(),
          count: z.number(),
        }),
      )
      .optional(),
    totalTags: z.number().optional(),
    updatedCount: z.number().optional(),
    success: z.boolean(),
  },
};

export const manageTagsMetadata = {
  title: "Manage Tags",
  description:
    "Unified tag management: get tag statistics, rename tags across all records, or remove tags. Replaces individual tag tools for lower cognitive load. All rename/remove operations are atomic (transactional).",
};

export function createManageTagsHandler(db: EvidenceDatabase) {
  return wrapToolHandler(
    "manage-tags",
    "Ensure action is valid, and required parameters are provided for the chosen action.",
    async (params: {
      action: "stats" | "rename" | "remove";
      tag?: string;
      oldTag?: string;
      newTag?: string;
    }) => {
      // Runtime validation for direct callers (Zod enum only applies through MCP SDK)
      if (!["stats", "rename", "remove"].includes(params.action)) {
        throw new Error(
          `Unknown action: ${params.action as string}. Valid actions: stats, rename, remove`,
        );
      }

      switch (params.action) {
        case "stats": {
          const tagCounts = db.getTagCounts();
          const tags = Array.from(tagCounts.entries())
            .map(([tag, count]) => ({ tag, count }))
            .sort((a, b) => b.count - a.count);

          const resultText =
            tags.length > 0
              ? `📊 Tag Statistics:\n${tags.map((t) => `  • ${t.tag}: ${t.count}`).join("\n")}`
              : `📊 No tags found in any footprint records`;

          return createToolResponse(resultText, {
            action: "stats",
            tags,
            totalTags: tags.length,
            success: true,
          });
        }

        case "rename": {
          if (!params.oldTag || !params.newTag) {
            throw new Error(
              "Both oldTag and newTag are required for rename action",
            );
          }
          if (params.oldTag.trim() === params.newTag.trim()) {
            throw new Error("New tag must be different from old tag");
          }
          // eslint-disable-next-line no-control-regex
          if (/[\x00\n\r,]/.test(params.newTag)) {
            throw new Error(
              `Invalid tag format: "${params.newTag}". Tags cannot contain null bytes, newlines, or commas.`,
            );
          }
          if (params.newTag.trim().length > 100) {
            throw new Error("Tag too long (max 100 characters)");
          }

          const updatedCount = db.renameTag(
            params.oldTag.trim(),
            params.newTag.trim(),
          );
          const success = updatedCount > 0;

          const resultText = success
            ? `🏷️ Renamed tag "${params.oldTag}" to "${params.newTag}" in ${updatedCount} record${updatedCount > 1 ? "s" : ""}`
            : `⚠️ No records found with tag "${params.oldTag}"`;

          return createToolResponse(resultText, {
            action: "rename",
            updatedCount,
            success,
          });
        }

        case "remove": {
          if (!params.tag) {
            throw new Error("tag is required for remove action");
          }

          const updatedCount = db.removeTag(params.tag.trim());
          const success = updatedCount > 0;

          const resultText = success
            ? `🗑️ Removed tag "${params.tag}" from ${updatedCount} record${updatedCount > 1 ? "s" : ""}`
            : `⚠️ No records found with tag "${params.tag}"`;

          return createToolResponse(resultText, {
            action: "remove",
            updatedCount,
            success,
          });
        }

        default:
          throw new Error(
            `Unknown action: ${params.action}. Valid actions: stats, rename, remove`,
          );
      }
    },
  );
}
