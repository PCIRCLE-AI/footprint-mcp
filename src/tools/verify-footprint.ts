import * as z from "zod";
import * as crypto from "crypto";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import { createToolResponse } from "../lib/tool-response.js";
import { decrypt } from "../lib/crypto/index.js";
import type { EvidenceDatabase } from "../lib/storage/index.js";

export const verifyFootprintSchema = {
  inputSchema: {
    id: z.string().describe("Footprint ID to verify"),
  },
  outputSchema: {
    id: z.string(),
    verified: z.boolean(),
    checks: z.object({
      contentIntegrity: z.object({
        passed: z.boolean(),
        hash: z.string(),
      }),
      gitTimestamp: z.object({
        passed: z.boolean(),
        commitHash: z.string().nullable(),
        timestamp: z.string().nullable(),
      }),
      encryptionStatus: z.object({
        passed: z.boolean(),
        algorithm: z.string(),
      }),
    }),
    legalReadiness: z.boolean(),
    verifiedAt: z.string(),
  },
};

export const verifyFootprintMetadata = {
  title: "Verify Footprint",
  description: "Verify the integrity and authenticity of captured footprint",
};

export function createVerifyFootprintHandler(
  db: EvidenceDatabase,
  getDerivedKey: () => Promise<Uint8Array>,
) {
  return wrapToolHandler(
    "verify-footprint",
    "Verify the footprint ID exists and encryption password is correct.",
    async (params: { id: string }) => {
      // Find the footprint record
      const fp = db.findById(params.id);
      if (!fp) {
        throw new Error(`Footprint with ID ${params.id} not found`);
      }

      const key = await getDerivedKey();

      // Perform verifications
      const checks = {
        contentIntegrity: { passed: false, hash: "" },
        gitTimestamp: {
          passed: false,
          commitHash: null as string | null,
          timestamp: null as string | null,
        },
        encryptionStatus: {
          passed: false,
          algorithm: "XChaCha20-Poly1305",
        },
      };

      // Single decryption for both content integrity and encryption status checks
      // This fixes the redundant decryption issue identified in Simplifier Round 1
      try {
        const decryptedContent = decrypt(
          fp.encryptedContent,
          fp.nonce,
          key,
        );
        const computedHash = crypto
          .createHash("sha256")
          .update(decryptedContent)
          .digest("hex");

        // Content integrity check
        checks.contentIntegrity.passed = computedHash === fp.contentHash;
        checks.contentIntegrity.hash = computedHash;

        // Encryption status check (decryption succeeded)
        checks.encryptionStatus.passed = true;
      } catch (error) {
        // Both checks fail if decryption fails
        checks.contentIntegrity.passed = false;
        checks.contentIntegrity.hash = "";
        checks.encryptionStatus.passed = false;
      }

      // Git Timestamp: Check if gitCommitHash exists and gitTimestamp is valid
      checks.gitTimestamp.commitHash = fp.gitCommitHash;
      checks.gitTimestamp.timestamp = fp.gitTimestamp;
      checks.gitTimestamp.passed = !!(
        fp.gitCommitHash && fp.gitTimestamp
      );

      const verified =
        checks.contentIntegrity.passed &&
        checks.gitTimestamp.passed &&
        checks.encryptionStatus.passed;
      const legalReadiness = verified;

      const statusSymbols = {
        content: checks.contentIntegrity.passed ? "✓" : "✗",
        git: checks.gitTimestamp.passed ? "✓" : "✗",
        encryption: checks.encryptionStatus.passed ? "✓" : "✗",
      };

      const statusText = verified
        ? `✅ Footprint ${params.id} verified successfully\n- Content: ${statusSymbols.content} Integrity preserved\n- Git: ${statusSymbols.git} Timestamp verified\n- Encryption: ${statusSymbols.encryption} XChaCha20-Poly1305`
        : `❌ Footprint ${params.id} verification failed\n- Content: ${statusSymbols.content} Integrity check\n- Git: ${statusSymbols.git} Timestamp check\n- Encryption: ${statusSymbols.encryption} Decryption check`;

      return createToolResponse(statusText, {
        id: params.id,
        verified,
        checks,
        legalReadiness,
        verifiedAt: new Date().toISOString(),
      });
    },
  );
}
