/* global Buffer */
/**
 * Feature coverage tests for AI-native & UX improvements
 *
 * Covers test cases required by the improvement plan:
 * - A3: getFilteredCount() with tags-only, date-only, combined filters
 * - A4: capture without messageCount, without llmProvider (defaults)
 * - B1: delete-footprints two-step confirmation flow
 * - B2: export-footprints output modes (file, base64, both)
 * - B4: manage-tags unified tool (stats, rename, remove)
 * - B5: verify-footprint integrityVerified field
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createTestEnvironment, type TestEnvironment } from "./fixtures.js";
import * as fs from "fs";

interface EvidenceItem {
  id: string;
  conversationId: string;
  tags: string | null;
}

interface TagItem {
  tag: string;
  count: number;
}

interface PreviewItem {
  id: string;
  conversationId: string;
  timestamp: string;
}

describe("Feature Coverage: AI-Native & UX Improvements", () => {
  let env: TestEnvironment;

  beforeEach(() => {
    env = createTestEnvironment();
  });

  afterEach(() => {
    // Clean up exported files
    try {
      const exports = fs
        .readdirSync(".")
        .filter((f) => f.startsWith("footprint-export-"));
      exports.forEach((f) => fs.unlinkSync(f));
    } catch {
      // Ignore cleanup errors
    }
    env.cleanup();
  });

  // Helper to seed evidence records
  async function seedEvidence(overrides: Record<string, unknown> = {}) {
    return env.helpers.callTool("capture-footprint", {
      conversationId: "test-conv",
      llmProvider: "Claude",
      content: "Human: Hello\nAssistant: Hi there",
      messageCount: 2,
      tags: "test,seed",
      ...overrides,
    });
  }

  // ─────────────────────────────────────────────────────────
  // A3: getFilteredCount respects all filters
  // ─────────────────────────────────────────────────────────
  describe("A3: Search filtered count accuracy", () => {
    beforeEach(async () => {
      // Seed 3 records with different tags and timestamps
      await seedEvidence({
        conversationId: "api-design-2026-01-01",
        tags: "api,design",
      });
      await seedEvidence({
        conversationId: "legal-review-2026-01-15",
        tags: "legal,review",
      });
      await seedEvidence({
        conversationId: "api-security-2026-02-01",
        tags: "api,security",
      });
    });

    it("should return correct total for tags-only search", async () => {
      const result = await env.helpers.callTool("search-footprints", {
        tags: ["api"],
      });

      expect(result.structuredContent.total).toBe(2);
      expect(
        (result.structuredContent.footprints as EvidenceItem[]).length,
      ).toBe(2);
    });

    it("should return correct total for query-only search", async () => {
      const result = await env.helpers.callTool("search-footprints", {
        query: "legal",
      });

      expect(result.structuredContent.total).toBe(1);
      expect(
        (result.structuredContent.footprints as EvidenceItem[]).length,
      ).toBe(1);
    });

    it("should return correct total for date-only search", async () => {
      // All records have timestamps close to "now", so dateFrom=yesterday should match all
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      const result = await env.helpers.callTool("search-footprints", {
        dateFrom: yesterday,
      });

      expect(result.structuredContent.total).toBe(3);
    });

    it("should return correct total for combined query + tags filter", async () => {
      const result = await env.helpers.callTool("search-footprints", {
        query: "api",
        tags: ["security"],
      });

      // Only api-security matches both query "api" and tag "security"
      expect(result.structuredContent.total).toBe(1);
      expect(
        (result.structuredContent.footprints as EvidenceItem[])[0]
          .conversationId,
      ).toBe("api-security-2026-02-01");
    });

    it("should return total matching result count when paginated", async () => {
      const result = await env.helpers.callTool("search-footprints", {
        tags: ["api"],
        limit: 1,
        offset: 0,
      });

      // Total should be 2 (all matching), but only 1 result returned
      expect(result.structuredContent.total).toBe(2);
      expect(
        (result.structuredContent.footprints as EvidenceItem[]).length,
      ).toBe(1);
    });

    it("should return correct total even when offset exceeds results", async () => {
      const result = await env.helpers.callTool("search-footprints", {
        tags: ["api"],
        limit: 10,
        offset: 100, // Way beyond the 2 matching records
      });

      expect(result.structuredContent.total).toBe(2);
      expect(
        (result.structuredContent.footprints as EvidenceItem[]).length,
      ).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────
  // A4: Capture parameter defaults
  // ─────────────────────────────────────────────────────────
  describe("A4: Capture parameter defaults", () => {
    it("should auto-calculate messageCount when omitted", async () => {
      const result = await env.helpers.callTool("capture-footprint", {
        conversationId: "auto-count-test",
        content:
          "Human: What is 2+2?\nAssistant: 4\nHuman: Thanks\nAssistant: You're welcome",
      });

      expect(result.structuredContent.success).toBe(true);
      const id = result.structuredContent.id as string;

      // Retrieve and verify message count was auto-calculated
      const getResult = await env.helpers.callTool("get-footprint", { id });
      // 4 turns: Human, Assistant, Human, Assistant
      expect(getResult.structuredContent.messageCount).toBe(4);
    });

    it("should default llmProvider to 'unknown' when omitted", async () => {
      const result = await env.helpers.callTool("capture-footprint", {
        conversationId: "default-provider-test",
        content: "Test content",
      });

      expect(result.structuredContent.success).toBe(true);
      const id = result.structuredContent.id as string;

      const getResult = await env.helpers.callTool("get-footprint", { id });
      expect(getResult.structuredContent.llmProvider).toBe("unknown");
    });

    it("should use explicit messageCount and llmProvider when provided", async () => {
      const result = await env.helpers.callTool("capture-footprint", {
        conversationId: "explicit-params-test",
        llmProvider: "Claude Opus 4.6",
        content: "Human: Hi\nAssistant: Hello",
        messageCount: 42,
      });

      expect(result.structuredContent.success).toBe(true);
      const id = result.structuredContent.id as string;

      const getResult = await env.helpers.callTool("get-footprint", { id });
      expect(getResult.structuredContent.messageCount).toBe(42);
      expect(getResult.structuredContent.llmProvider).toBe("Claude Opus 4.6");
    });

    it("should default messageCount to 1 when no turn markers found", async () => {
      const result = await env.helpers.callTool("capture-footprint", {
        conversationId: "no-markers-test",
        content: "Just some plain text without any turn markers",
      });

      expect(result.structuredContent.success).toBe(true);
      const id = result.structuredContent.id as string;

      const getResult = await env.helpers.callTool("get-footprint", { id });
      expect(getResult.structuredContent.messageCount).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────
  // B1: Delete confirmation flow
  // ─────────────────────────────────────────────────────────
  describe("B1: Delete two-step confirmation", () => {
    let evidenceId: string;

    beforeEach(async () => {
      const result = await seedEvidence({
        conversationId: "delete-test",
        tags: "deleteme",
      });
      evidenceId = result.structuredContent.id as string;
    });

    it("should preview without deleting when confirmDelete is false", async () => {
      const result = await env.helpers.callTool("delete-footprints", {
        evidenceIds: [evidenceId],
        confirmDelete: false,
      });

      expect(result.structuredContent.deletedCount).toBe(0);
      expect(result.structuredContent.previewed).toBeDefined();
      const previewed = result.structuredContent.previewed as PreviewItem[];
      expect(previewed).toHaveLength(1);
      expect(previewed[0].id).toBe(evidenceId);

      // Verify record still exists
      const getResult = await env.helpers.callTool("get-footprint", {
        id: evidenceId,
      });
      expect(getResult.structuredContent.id).toBe(evidenceId);
    });

    it("should preview by default when confirmDelete is omitted", async () => {
      const result = await env.helpers.callTool("delete-footprints", {
        evidenceIds: [evidenceId],
      });

      // Default is false → preview mode
      expect(result.structuredContent.deletedCount).toBe(0);
      expect(result.structuredContent.previewed).toBeDefined();
    });

    it("should actually delete when confirmDelete is true", async () => {
      const result = await env.helpers.callTool("delete-footprints", {
        evidenceIds: [evidenceId],
        confirmDelete: true,
      });

      expect(result.structuredContent.deletedCount).toBe(1);
      expect(result.structuredContent.success).toBe(true);

      // Verify record is gone
      await expect(
        env.helpers.callTool("get-footprint", { id: evidenceId }),
      ).rejects.toThrow("Footprint not found");
    });

    it("should handle preview of non-existent IDs gracefully", async () => {
      const result = await env.helpers.callTool("delete-footprints", {
        evidenceIds: ["nonexistent-id"],
        confirmDelete: false,
      });

      expect(result.structuredContent.deletedCount).toBe(0);
      const previewed = result.structuredContent.previewed as PreviewItem[];
      expect(previewed).toHaveLength(0);
    });

    it("should reject more than 100 IDs", async () => {
      const ids = Array.from({ length: 101 }, (_, i) => `id-${i}`);
      await expect(
        env.helpers.callTool("delete-footprints", {
          evidenceIds: ids,
          confirmDelete: true,
        }),
      ).rejects.toThrow("Too many IDs");
    });

    it("should report notFoundIds when some IDs don't exist", async () => {
      const result = await env.helpers.callTool("delete-footprints", {
        evidenceIds: [evidenceId, "nonexistent-id"],
        confirmDelete: true,
      });

      expect(result.structuredContent.deletedCount).toBe(1);
      expect(result.structuredContent.notFoundIds).toEqual(["nonexistent-id"]);
      expect(result.structuredContent.success).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────
  // B2: Export output modes
  // ─────────────────────────────────────────────────────────
  describe("B2: Export output modes", () => {
    beforeEach(async () => {
      await seedEvidence({ conversationId: "export-test" });
    });

    it("should write file only with outputMode='file'", async () => {
      const result = await env.helpers.callTool("export-footprints", {
        outputMode: "file",
      });

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.filename).toBeDefined();
      expect(result.structuredContent.base64Data).toBeUndefined();
      expect(fs.existsSync(result.structuredContent.filename as string)).toBe(
        true,
      );
    });

    it("should return base64 only with outputMode='base64'", async () => {
      const result = await env.helpers.callTool("export-footprints", {
        outputMode: "base64",
      });

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.base64Data).toBeDefined();
      expect(result.structuredContent.filename).toBeUndefined();

      // Verify base64 is valid
      const decoded = Buffer.from(
        result.structuredContent.base64Data as string,
        "base64",
      );
      expect(decoded.length).toBeGreaterThan(0);
    });

    it("should write file and return base64 with outputMode='both'", async () => {
      const result = await env.helpers.callTool("export-footprints", {
        outputMode: "both",
      });

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.filename).toBeDefined();
      expect(result.structuredContent.base64Data).toBeDefined();
      expect(fs.existsSync(result.structuredContent.filename as string)).toBe(
        true,
      );
    });

    it("should default to 'both' when outputMode is omitted", async () => {
      const result = await env.helpers.callTool("export-footprints", {});

      expect(result.structuredContent.success).toBe(true);
      expect(result.structuredContent.filename).toBeDefined();
      expect(result.structuredContent.base64Data).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────
  // B4: Manage-tags unified tool
  // ─────────────────────────────────────────────────────────
  describe("B4: Manage-tags unified tool", () => {
    beforeEach(async () => {
      await seedEvidence({
        conversationId: "tag-test-1",
        tags: "alpha,beta",
      });
      await seedEvidence({
        conversationId: "tag-test-2",
        tags: "beta,gamma",
      });
    });

    describe("stats action", () => {
      it("should return all tags with counts", async () => {
        const result = await env.helpers.callTool("manage-tags", {
          action: "stats",
        });

        expect(result.structuredContent.success).toBe(true);
        expect(result.structuredContent.action).toBe("stats");
        expect(result.structuredContent.totalTags).toBe(3);

        const tags = result.structuredContent.tags as TagItem[];
        expect(tags).toContainEqual({ tag: "beta", count: 2 });
        expect(tags).toContainEqual({ tag: "alpha", count: 1 });
        expect(tags).toContainEqual({ tag: "gamma", count: 1 });
      });
    });

    describe("rename action", () => {
      it("should rename a tag across all records", async () => {
        const result = await env.helpers.callTool("manage-tags", {
          action: "rename",
          oldTag: "beta",
          newTag: "delta",
        });

        expect(result.structuredContent.success).toBe(true);
        expect(result.structuredContent.action).toBe("rename");
        expect(result.structuredContent.updatedCount).toBe(2);

        // Verify via stats
        const statsResult = await env.helpers.callTool("manage-tags", {
          action: "stats",
        });
        const tags = statsResult.structuredContent.tags as TagItem[];
        expect(tags).toContainEqual({ tag: "delta", count: 2 });
        expect(tags.find((t) => t.tag === "beta")).toBeUndefined();
      });

      it("should require both oldTag and newTag", async () => {
        await expect(
          env.helpers.callTool("manage-tags", {
            action: "rename",
            oldTag: "beta",
          }),
        ).rejects.toThrow("Both oldTag and newTag are required");
      });

      it("should reject renaming to same tag", async () => {
        await expect(
          env.helpers.callTool("manage-tags", {
            action: "rename",
            oldTag: "beta",
            newTag: "beta",
          }),
        ).rejects.toThrow("New tag must be different from old tag");
      });

      it("should reject newTag exceeding 100 characters", async () => {
        const longTag = "x".repeat(101);
        await expect(
          env.helpers.callTool("manage-tags", {
            action: "rename",
            oldTag: "beta",
            newTag: longTag,
          }),
        ).rejects.toThrow("Tag too long (max 100 characters)");
      });
    });

    describe("remove action", () => {
      it("should remove a tag from all records", async () => {
        const result = await env.helpers.callTool("manage-tags", {
          action: "remove",
          tag: "beta",
        });

        expect(result.structuredContent.success).toBe(true);
        expect(result.structuredContent.action).toBe("remove");
        expect(result.structuredContent.updatedCount).toBe(2);

        // Verify via stats
        const statsResult = await env.helpers.callTool("manage-tags", {
          action: "stats",
        });
        const tags = statsResult.structuredContent.tags as TagItem[];
        expect(tags.find((t) => t.tag === "beta")).toBeUndefined();
      });

      it("should require tag parameter", async () => {
        await expect(
          env.helpers.callTool("manage-tags", { action: "remove" }),
        ).rejects.toThrow("tag is required for remove action");
      });

      it("should return success=false for non-existent tag", async () => {
        const result = await env.helpers.callTool("manage-tags", {
          action: "remove",
          tag: "nonexistent",
        });

        expect(result.structuredContent.success).toBe(false);
        expect(result.structuredContent.updatedCount).toBe(0);
      });
    });
  });

  // ─────────────────────────────────────────────────────────
  // B5: Verify integrityVerified field
  // ─────────────────────────────────────────────────────────
  describe("B5: Verify integrityVerified field", () => {
    it("should return integrityVerified: true for valid evidence", async () => {
      const captureResult = await seedEvidence({
        conversationId: "verify-integrity-test",
      });
      const id = captureResult.structuredContent.id as string;

      const result = await env.helpers.callTool("verify-footprint", { id });

      expect(result.structuredContent.verified).toBe(true);
      expect(result.structuredContent.integrityVerified).toBe(true);
      expect(result.structuredContent.verifiedAt).toBeDefined();
      expect(result.structuredContent.checks).toBeDefined();
    });

    it("should not contain legalReadiness field", async () => {
      const captureResult = await seedEvidence({
        conversationId: "no-legal-readiness-test",
      });
      const id = captureResult.structuredContent.id as string;

      const result = await env.helpers.callTool("verify-footprint", { id });

      expect(result.structuredContent).not.toHaveProperty("legalReadiness");
      expect(result.structuredContent).toHaveProperty("integrityVerified");
    });
  });
});
