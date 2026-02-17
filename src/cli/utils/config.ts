/* global console, NodeJS */

import * as fs from "fs";
import * as path from "path";
import type { ClaudeConfig } from "../types.js";

/** Secure file permissions: owner read/write only */
const SECURE_FILE_MODE = 0o600;
/** Secure directory permissions: owner read/write/execute only */
const SECURE_DIR_MODE = 0o700;

/**
 * Safely set file permissions with warning on failure
 */
function setSecurePermissions(filePath: string, showManualHint = false): void {
  try {
    fs.chmodSync(filePath, SECURE_FILE_MODE);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `Warning: Could not set secure permissions on ${filePath}: ${message}`,
    );
    if (showManualHint) {
      console.warn(
        "  Please manually restrict access to this file (chmod 600 on Unix).",
      );
    }
  }
}

/**
 * Read Claude Desktop config file
 */
export function readClaudeConfig(configPath: string): ClaudeConfig {
  try {
    if (!fs.existsSync(configPath)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;
    if (nodeError.code === "ENOENT") {
      return {};
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to read config at ${configPath}: ${message}`);
  }
}

/**
 * Write Claude Desktop config file with secure permissions (0o600)
 * CRITICAL: Config contains passphrase, must be owner-only readable
 */
export function writeClaudeConfig(
  configPath: string,
  config: ClaudeConfig,
): void {
  const dir = path.dirname(configPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: SECURE_DIR_MODE });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  setSecurePermissions(configPath, true);
}

/**
 * Backup existing config file with secure permissions (0o600)
 */
export function backupConfig(configPath: string): string {
  if (!fs.existsSync(configPath)) {
    throw new Error("Config file does not exist");
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${configPath}.backup-${timestamp}`;

  fs.copyFileSync(configPath, backupPath);
  setSecurePermissions(backupPath);

  return backupPath;
}

/**
 * Add Footprint to Claude config
 */
export function addFootprintToConfig(
  config: ClaudeConfig,
  dataDir: string,
  passphrase: string,
): ClaudeConfig {
  return {
    ...config,
    mcpServers: {
      ...config.mcpServers,
      footprint: {
        command: "npx",
        args: ["@pcircle/footprint"],
        env: {
          FOOTPRINT_DATA_DIR: dataDir,
          FOOTPRINT_PASSPHRASE: passphrase,
        },
      },
    },
  };
}
