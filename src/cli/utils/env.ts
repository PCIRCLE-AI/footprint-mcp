/* global console */

import * as fs from "fs";

/**
 * Escape string for safe use in shell single quotes
 * Prevents shell injection attacks by properly escaping special characters
 * POSIX shells (bash/zsh): end quote, escaped quote, restart quote
 * Fish shell: backslash-escaped single quote inside single quotes
 */
function escapeShellString(str: string, shell?: string): string {
  if (shell === "fish") {
    // Fish supports backslash escapes inside single quotes
    return `'${str.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  }
  // POSIX shells (bash/zsh)
  return `'${str.replace(/'/g, "'\\''")}'`;
}

/**
 * Generate environment variable export statement with proper escaping
 * Supports POSIX shells (bash/zsh) and fish shell syntax
 */
export function generateEnvExport(
  shell: string,
  dataDir: string,
  passphrase: string,
): string {
  if (shell === "fish") {
    return [
      "",
      "# Footprint MCP Server Environment Variables",
      `set -gx FOOTPRINT_DATA_DIR ${escapeShellString(dataDir, "fish")}`,
      `set -gx FOOTPRINT_PASSPHRASE ${escapeShellString(passphrase, "fish")}`,
      "",
    ].join("\n");
  }

  return [
    "",
    "# Footprint MCP Server Environment Variables",
    `export FOOTPRINT_DATA_DIR=${escapeShellString(dataDir)}`,
    `export FOOTPRINT_PASSPHRASE=${escapeShellString(passphrase)}`,
    "",
  ].join("\n");
}

const FOOTPRINT_HEADER = "# Footprint MCP Server";
const FOOTPRINT_BLOCK_REGEX =
  /\n?# Footprint MCP Server[^\n]*\n(?:(?:export |set -gx )FOOTPRINT_[^\n]*\n?)+/;

/**
 * Append environment variables to shell RC file with secure permissions (0o600)
 */
export function appendToShellRc(rcPath: string, content: string): void {
  if (!fs.existsSync(rcPath)) {
    throw new Error(`Shell RC file not found: ${rcPath}`);
  }

  const existing = fs.readFileSync(rcPath, "utf-8");
  if (FOOTPRINT_BLOCK_REGEX.test(existing)) {
    throw new Error(
      "Footprint already configured in shell RC file. " +
        "Please remove existing configuration before re-running setup, " +
        "or manually update the existing configuration.",
    );
  }

  // Add header if content doesn't already include it (defensive)
  const wrappedContent = content.includes(FOOTPRINT_HEADER)
    ? content
    : `\n${FOOTPRINT_HEADER}\n${content}`;

  fs.appendFileSync(rcPath, wrappedContent, "utf-8");

  // Set restrictive permissions (owner read/write only)
  try {
    fs.chmodSync(rcPath, 0o600);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `Warning: Could not set secure permissions on ${rcPath}: ${message}`,
    );
  }
}

/**
 * Remove Footprint environment block from shell RC file (used for rollback)
 * Returns true if block was found and removed
 */
export function removeFootprintFromRc(rcPath: string): boolean {
  if (!fs.existsSync(rcPath)) return false;

  const stat = fs.statSync(rcPath);
  const content = fs.readFileSync(rcPath, "utf-8");
  if (!FOOTPRINT_BLOCK_REGEX.test(content)) return false;

  const cleaned = content.replace(FOOTPRINT_BLOCK_REGEX, "");
  fs.writeFileSync(rcPath, cleaned, "utf-8");
  // Restore original file permissions
  fs.chmodSync(rcPath, stat.mode);
  return true;
}
