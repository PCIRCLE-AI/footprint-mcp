#!/usr/bin/env node
/* global console, process, Buffer, NodeJS */

import prompts from "prompts";
import chalk from "chalk";
import ora from "ora";
import { timingSafeEqual } from "crypto";
import * as path from "path";
import { detectSystem } from "./utils/detect.js";
import { validatePassword, validatePath } from "./utils/validation.js";
import {
  readClaudeConfig,
  writeClaudeConfig,
  backupConfig,
  addFootprintToConfig,
} from "./utils/config.js";
import {
  generateEnvExport,
  appendToShellRc,
  removeFootprintFromRc,
} from "./utils/env.js";
import { DEFAULT_DATA_DIR } from "./constants.js";
import type { SetupConfig } from "./types.js";
import * as fs from "fs";

/**
 * Extract error message from unknown error type
 */
function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  const maxLen = Math.max(bufA.length, bufB.length);
  const paddedA = Buffer.alloc(maxLen);
  const paddedB = Buffer.alloc(maxLen);
  bufA.copy(paddedA);
  bufB.copy(paddedB);
  return bufA.length === bufB.length && timingSafeEqual(paddedA, paddedB);
}

/**
 * Welcome message
 */
function printWelcome(): void {
  console.log(chalk.bold.cyan("\n🦶 Welcome to Footprint Setup!\n"));
  console.log("Let's configure your AI audit trail in 3 simple steps.\n");
}

/**
 * Print system info
 */
function printSystemInfo(system: ReturnType<typeof detectSystem>): void {
  console.log(chalk.gray("Detected System:"));
  console.log(chalk.gray(`  OS: ${system.platform}`));
  console.log(chalk.gray(`  Shell: ${system.shell}`));

  if (system.claudeConfigPath) {
    console.log(
      chalk.green(`  ✅ Claude Desktop found at: ${system.claudeConfigPath}`),
    );
  } else {
    console.log(chalk.yellow(`  ⚠️  Claude Desktop config not found`));
  }
  console.log("");
}

/**
 * Prompt for setup configuration
 */
async function promptSetup(
  system: ReturnType<typeof detectSystem>,
): Promise<SetupConfig | null> {
  const response = await prompts([
    {
      type: "text",
      name: "dataDir",
      message: "Where should we store your data?",
      initial: DEFAULT_DATA_DIR,
      validate: (value: string) => {
        const result = validatePath(value);
        return result.valid ? true : result.message!;
      },
    },
    {
      type: "password",
      name: "passphrase",
      message: "Create a secure passphrase (min 12 characters):",
      validate: (value: string) => {
        const result = validatePassword(value);
        return result.valid ? true : result.message!;
      },
    },
    {
      type: "password",
      name: "confirmPassphrase",
      message: "Confirm your passphrase:",
      validate: (value: string, previous: Record<string, string>) => {
        // Use timing-safe comparison to prevent timing attacks
        return safeCompare(value, previous.passphrase)
          ? true
          : "Passphrases do not match";
      },
    },
    {
      type: system.claudeConfigPath ? "confirm" : null,
      name: "autoConfig",
      message: "Auto-configure Claude Desktop?",
      initial: true,
    },
  ]);

  if (!response.passphrase) {
    return null; // User cancelled
  }

  return {
    dataDir: response.dataDir,
    passphrase: response.passphrase,
    autoConfig: response.autoConfig ?? false,
  };
}

/**
 * Print security warning about password storage
 */
function printSecurityWarning(): void {
  console.log(chalk.bold.yellow("\n⚠️  Security Notice:\n"));
  console.log(
    chalk.yellow(
      "Your passphrase will be stored in configuration files on this system.",
    ),
  );
  console.log(
    chalk.yellow(
      "We set restrictive permissions (600/700), but anyone with system access",
    ),
  );
  console.log(
    chalk.yellow("or file system backups may be able to access it.\n"),
  );
  console.log(chalk.gray("Recommendations:"));
  console.log(chalk.gray("  • Use a unique passphrase (not reused elsewhere)"));
  console.log(
    chalk.gray("  • Ensure only you have access to this user account"),
  );
  console.log(
    chalk.gray("  • Encrypt your backups if they contain config files\n"),
  );
}

/**
 * Configure Claude Desktop with improved error handling
 */
async function configureClaudeDesktop(
  configPath: string,
  config: SetupConfig,
): Promise<void> {
  const spinner = ora("Configuring Claude Desktop...").start();

  try {
    // Backup existing config
    if (fs.existsSync(configPath)) {
      const backupPath = backupConfig(configPath);
      spinner.info(chalk.gray(`Backed up existing config to: ${backupPath}`));
    }

    // Read and update config
    const claudeConfig = readClaudeConfig(configPath);
    const updatedConfig = addFootprintToConfig(
      claudeConfig,
      config.dataDir,
      config.passphrase,
    );

    writeClaudeConfig(configPath, updatedConfig);
    spinner.succeed(chalk.green("Claude Desktop configured!"));
  } catch (error: unknown) {
    spinner.fail(
      chalk.red(
        `Failed to configure Claude Desktop: ${getErrorMessage(error)}`,
      ),
    );
    throw error;
  }
}

/**
 * Setup environment variables with improved error handling
 */
async function setupEnvironment(
  system: ReturnType<typeof detectSystem>,
  config: SetupConfig,
): Promise<boolean> {
  if (!system.shellRcPath) {
    console.log(
      chalk.yellow("\n⚠️  Shell RC file not found. Manual setup required:"),
    );
    console.log(
      chalk.gray(
        generateEnvExport(system.shell, config.dataDir, config.passphrase),
      ),
    );
    return false;
  }

  const { setupEnv } = await prompts({
    type: "confirm",
    name: "setupEnv",
    message: `Add environment variables to ${system.shellRcPath}?`,
    initial: true,
  });

  if (!setupEnv) return false;

  const spinner = ora("Setting up environment variables...").start();

  try {
    const envExport = generateEnvExport(
      system.shell,
      config.dataDir,
      config.passphrase,
    );
    appendToShellRc(system.shellRcPath, envExport);
    spinner.succeed(chalk.green("Environment variables configured!"));
    return true;
  } catch (error: unknown) {
    spinner.fail(
      chalk.red(`Failed to setup environment: ${getErrorMessage(error)}`),
    );
    throw error; // Propagate error for rollback
  }
}

/**
 * Create data directory with secure permissions (0o700)
 */
async function createDataDirectory(dataDir: string): Promise<void> {
  const spinner = ora("Creating data directory...").start();
  const normalized = validatePath(dataDir).normalizedPath!;

  try {
    fs.mkdirSync(normalized, { recursive: true, mode: 0o700 });
    spinner.succeed(chalk.green(`Data directory created: ${normalized}`));
  } catch (error: unknown) {
    const nodeError = error as NodeJS.ErrnoException;

    if (nodeError.code === "EEXIST") {
      spinner.info(chalk.gray(`Data directory already exists: ${normalized}`));
      // Ensure secure permissions on existing directory
      try {
        fs.chmodSync(normalized, 0o700);
      } catch (chmodError: unknown) {
        spinner.warn(
          chalk.yellow(
            `Could not set permissions: ${getErrorMessage(chmodError)}`,
          ),
        );
      }
      return;
    }

    spinner.fail(
      chalk.red(`Failed to create directory: ${getErrorMessage(error)}`),
    );
    throw error;
  }
}

/**
 * Print manual configuration instructions when Claude Desktop not found
 */
function printManualConfigInstructions(config: SetupConfig): void {
  console.log(
    chalk.yellow(
      "\n⚠️  Claude Desktop not found. Manual configuration required.",
    ),
  );
  console.log(chalk.gray("Add to claude_desktop_config.json:"));
  console.log(
    chalk.gray(
      JSON.stringify(
        {
          mcpServers: {
            footprint: {
              command: "npx",
              args: ["@pcircle/footprint"],
              env: {
                FOOTPRINT_DATA_DIR: config.dataDir,
                FOOTPRINT_PASSPHRASE: config.passphrase,
              },
            },
          },
        },
        null,
        2,
      ),
    ),
  );
}

/**
 * Print next steps
 */
function printNextSteps(_config: SetupConfig): void {
  console.log(chalk.bold.green("\n🎉 Setup Complete!\n"));
  console.log(chalk.bold("Next steps:"));
  console.log(chalk.gray("  1. Close Claude Desktop completely"));
  console.log(chalk.gray("  2. Reopen Claude Desktop"));
  console.log(chalk.gray('  3. Say "capture this conversation" to test\n'));

  console.log(chalk.yellow("⚠️  Important: Keep your passphrase safe!"));
  console.log(chalk.gray("  Loss means permanent data loss.\n"));
}

/**
 * Rollback action function type
 */
type RollbackAction = () => void | Promise<void>;

/**
 * Create rollback action for directory removal
 */
function createDirectoryRollback(dirPath: string): RollbackAction {
  return () => {
    try {
      if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true });
        console.log(chalk.gray(`  Rolled back: Removed ${dirPath}`));
      }
    } catch (error: unknown) {
      console.warn(
        chalk.yellow(
          `  Warning: Failed to remove ${dirPath}: ${getErrorMessage(error)}`,
        ),
      );
    }
  };
}

/**
 * Create rollback action for config restoration
 */
function createConfigRollback(
  backupPath: string,
  configPath: string,
): RollbackAction {
  return () => {
    try {
      if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, configPath);
        console.log(chalk.gray(`  Rolled back: Restored config from backup`));
      }
    } catch (error: unknown) {
      console.warn(
        chalk.yellow(
          `  Warning: Failed to restore config: ${getErrorMessage(error)}`,
        ),
      );
    }
  };
}

/**
 * Create rollback action for shell RC file modification
 */
function createShellRcRollback(rcPath: string): RollbackAction {
  return () => {
    try {
      if (removeFootprintFromRc(rcPath)) {
        console.log(
          chalk.gray(`  Rolled back: Removed Footprint config from ${rcPath}`),
        );
      }
    } catch (error: unknown) {
      console.warn(
        chalk.yellow(
          `  Warning: Failed to clean ${rcPath}: ${getErrorMessage(error)}`,
        ),
      );
    }
  };
}

/**
 * Find the most recent backup file for a config
 */
function findLatestBackup(configPath: string): string | null {
  const dir = path.dirname(configPath);
  const basename = path.basename(configPath);

  const backupFiles = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(`${basename}.backup`))
    .sort();
  if (backupFiles.length === 0) return null;

  return path.join(dir, backupFiles[backupFiles.length - 1]);
}

/**
 * Main setup flow with transaction-like rollback on failure
 */
export async function runSetup(): Promise<void> {
  // Track all changes for potential rollback
  const rollbackActions: RollbackAction[] = [];

  try {
    printWelcome();

    const system = detectSystem();
    printSystemInfo(system);

    const config = await promptSetup(system);
    if (!config) {
      console.log(chalk.yellow("\nSetup cancelled."));
      process.exit(0);
    }

    // Print security warning about password storage
    printSecurityWarning();

    // Create data directory (tracked for rollback)
    const normalized = validatePath(config.dataDir).normalizedPath!;
    const directoryCreated = !fs.existsSync(normalized);

    await createDataDirectory(config.dataDir);

    if (directoryCreated) {
      rollbackActions.push(createDirectoryRollback(normalized));
    }

    // Configure Claude Desktop if requested (tracked for rollback)
    if (config.autoConfig && system.claudeConfigPath) {
      await configureClaudeDesktop(system.claudeConfigPath, config);

      // Track config backup for rollback
      const backupPath = findLatestBackup(system.claudeConfigPath);
      if (backupPath) {
        rollbackActions.push(
          createConfigRollback(backupPath, system.claudeConfigPath),
        );
      }
    } else if (!system.claudeConfigPath) {
      printManualConfigInstructions(config);
    }

    // Setup environment variables (tracked for rollback only if modified)
    const envModified = await setupEnvironment(system, config);
    if (envModified && system.shellRcPath) {
      rollbackActions.push(createShellRcRollback(system.shellRcPath));
    }

    // If we get here, setup succeeded - discard rollback actions
    rollbackActions.length = 0;

    printNextSteps(config);
  } catch (error: unknown) {
    console.error(chalk.red(`\n❌ Setup failed: ${getErrorMessage(error)}`));

    // Perform rollback if any changes were made
    if (rollbackActions.length > 0) {
      console.log(chalk.yellow("\n🔄 Rolling back changes...\n"));
      // Execute rollback actions in reverse order
      for (const action of rollbackActions.reverse()) {
        await action();
      }
      console.log(
        chalk.green("\n✅ Rollback complete. No changes were made.\n"),
      );
    }

    console.log(chalk.gray("\nTroubleshooting:"));
    console.log(chalk.gray("  • Check file permissions"));
    console.log(chalk.gray("  • Ensure Claude Desktop is not running"));
    console.log(chalk.gray("  • Verify disk space is available\n"));

    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSetup();
}
