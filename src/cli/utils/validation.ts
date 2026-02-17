import zxcvbn from "zxcvbn";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import type { ValidationResult } from "../types.js";
import { MIN_PASSWORD_SCORE, MIN_PASSWORD_LENGTH } from "../constants.js";

/** Characters not allowed in paths (shell injection prevention) */
const DANGEROUS_PATH_CHARS = /[;&|`$()]/g;

export type PathValidationResult = ValidationResult & {
  normalizedPath?: string;
};

/**
 * Validate password strength using zxcvbn
 */
export function validatePassword(password: string): ValidationResult {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    };
  }

  const result = zxcvbn(password);
  if (result.score < MIN_PASSWORD_SCORE) {
    return {
      valid: false,
      message: `Password is too weak. ${result.feedback.suggestions.join(" ")}`,
      score: result.score,
    };
  }

  return { valid: true, score: result.score };
}

/**
 * Helper to create invalid result
 */
function invalid(message: string): PathValidationResult {
  return { valid: false, message };
}

/**
 * Validate and normalize file path with security checks:
 * - Rejects dangerous shell characters
 * - Expands tilde (~) to home directory
 * - Ensures path is absolute and within home directory
 * - Rejects symbolic links (could point outside allowed directories)
 */
export function validatePath(inputPath: string): PathValidationResult {
  if (!inputPath || typeof inputPath !== "string") {
    return invalid("Path must be a non-empty string");
  }

  // Security: Reject dangerous shell characters
  if (DANGEROUS_PATH_CHARS.test(inputPath)) {
    return invalid(
      "Path contains invalid characters. Special shell characters are not allowed.",
    );
  }

  // Expand tilde to home directory
  const homeDir = os.homedir();
  const expanded = inputPath.startsWith("~")
    ? path.join(homeDir, inputPath.slice(1))
    : inputPath;

  if (!path.isAbsolute(expanded)) {
    return invalid(
      "Path must be absolute (e.g., /Users/name/data or ~/.footprint)",
    );
  }

  // Normalize to prevent path traversal attacks (../)
  const normalized = path.resolve(path.normalize(expanded));

  // Security: Ensure path is within user's home directory
  if (!normalized.startsWith(homeDir)) {
    return invalid(`Path must be within your home directory (${homeDir})`);
  }

  // Security: Reject symbolic links (could point outside allowed directories)
  if (fs.existsSync(normalized)) {
    try {
      if (fs.lstatSync(normalized).isSymbolicLink()) {
        return invalid(
          "Symbolic links are not allowed for security reasons. Please use a real directory path.",
        );
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return invalid(`Failed to validate path: ${message}`);
    }
  }

  return { valid: true, normalizedPath: normalized };
}
