/**
 * Test fixtures and utilities for Footprint MCP Server tests
 * Provides shared setup, teardown, and test data generation
 */

import { FootprintServer, FootprintTestHelpers } from "../src/index.js";
import type { ServerConfig } from "../src/types.js";
import * as fs from "fs";
import * as path from "path";
import { tmpdir } from "node:os";

/**
 * Test environment setup result
 */
export interface TestEnvironment {
  server: FootprintServer;
  helpers: FootprintTestHelpers;
  testDbPath: string;
  tempDir: string;
  testPassword: string;
  cleanup: () => void;
}

/**
 * Create a test environment with temporary database
 *
 * @param password - Optional custom password (default: 'test-password-123')
 * @returns Test environment with server, helpers, and cleanup function
 *
 * @example
 * ```typescript
 * const env = createTestEnvironment();
 * // ... use env.server, env.helpers
 * env.cleanup(); // Clean up when done
 * ```
 */
export function createTestEnvironment(
  password: string = "test-password-123",
): TestEnvironment {
  // Create unique temporary directory for each test
  const tempDir = fs.mkdtempSync(path.join(tmpdir(), "evidence-mcp-test-"));
  const testDbPath = path.join(tempDir, "test-evidence.db");

  // Clean up any existing test database
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  const config: ServerConfig = {
    dbPath: testDbPath,
    password,
  };

  const server = new FootprintServer(config);
  const helpers = new FootprintTestHelpers(server);

  const cleanup = () => {
    try {
      if (server) {
        // Close any database connections if the server has them
      }
    } catch (error) {
      // Ignore close errors
    }

    try {
      if (tempDir && fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  };

  return {
    server,
    helpers,
    testDbPath,
    tempDir,
    testPassword: password,
    cleanup,
  };
}

/**
 * Sample conversation content for testing
 */
export const SAMPLE_CONVERSATION = {
  basic: "This is a test conversation about a project milestone.",
  withIP:
    "We discussed the new algorithm for patent filing and proprietary technology.",
  withLegal:
    "The contract terms and license agreement were reviewed by our legal team.",
  withBusiness: "Strategic decision on the roadmap and approval of the budget.",
  withResearch:
    "Our research findings and experiment data show promising results.",
  withCompliance:
    "Audit requirements and documentation for compliance with regulations.",
  casual: "Hey, how are you doing? The weather is nice today.",
  multiKeyword:
    "Contract agreement for proprietary algorithm research with compliance requirements.",
  large: "A".repeat(1024 * 1024 + 100), // >1MB content
  withSpecialChars: "Test with UTF-8: 你好 🎉 and emoji 🚀",
};

/**
 * Sample evidence parameters for testing capture-footprint
 */
export function createSampleEvidence(overrides?: {
  conversationId?: string;
  llmProvider?: string;
  content?: string;
  messageCount?: number;
  tags?: string;
}) {
  return {
    conversationId: overrides?.conversationId || "test-conversation-001",
    llmProvider: overrides?.llmProvider || "Claude Sonnet 4.5",
    content: overrides?.content || SAMPLE_CONVERSATION.basic,
    messageCount: overrides?.messageCount || 10,
    tags: overrides?.tags || "test,milestone",
  };
}

/**
 * Create multiple sample evidences for batch testing
 *
 * @param count - Number of evidences to create
 * @returns Array of evidence parameters
 */
export function createMultipleSampleEvidences(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    conversationId: `test-conversation-${String(i + 1).padStart(3, "0")}`,
    llmProvider: i % 2 === 0 ? "Claude Sonnet 4.5" : "GPT-4",
    content: `Test conversation content ${i + 1}`,
    messageCount: (i + 1) * 5,
    tags: i % 2 === 0 ? "test,even" : "test,odd",
  }));
}

/**
 * Wait for a condition to be true (useful for async operations)
 *
 * @param condition - Function that returns true when condition is met
 * @param timeout - Maximum time to wait in milliseconds
 * @param interval - Check interval in milliseconds
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100,
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Timeout waiting for condition after ${timeout}ms`);
}

/**
 * Generate a random test database name
 */
export function generateTestDbName(prefix: string = "test"): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${prefix}-${timestamp}-${random}.db`;
}
