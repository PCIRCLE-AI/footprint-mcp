import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import type { SystemInfo } from '../types.js';
import { CLAUDE_CONFIG_PATHS, SHELL_RC_FILES } from '../constants.js';

/**
 * Detect current operating system and environment
 */
export function detectSystem(): SystemInfo {
  const platform = os.platform() as SystemInfo['platform'];
  const shell = detectShell();
  const homeDir = os.homedir();
  const claudeConfigPath = findClaudeConfig();
  const shellRcPath = findShellRcPath(shell, homeDir);

  return {
    platform,
    shell,
    claudeConfigPath,
    homeDir,
    shellRcPath,
  };
}

/**
 * Detect user's default shell
 */
export function detectShell(): SystemInfo['shell'] {
  const shellEnv = process.env.SHELL || '';

  if (shellEnv.includes('zsh')) return 'zsh';
  if (shellEnv.includes('bash')) return 'bash';
  if (shellEnv.includes('fish')) return 'fish';
  if (process.platform === 'win32') return 'powershell';

  return 'bash'; // Default fallback
}

/**
 * Find Claude Desktop config file path
 */
export function findClaudeConfig(): string | null {
  const platform = os.platform() as keyof typeof CLAUDE_CONFIG_PATHS;
  const configPath = CLAUDE_CONFIG_PATHS[platform];

  if (!configPath) return null;

  return fs.existsSync(configPath) ? configPath : null;
}

/**
 * Find shell RC file path
 */
function findShellRcPath(shell: string, homeDir: string): string | null {
  const rcFile = SHELL_RC_FILES[shell as keyof typeof SHELL_RC_FILES];
  if (!rcFile) return null;

  const rcPath = path.join(homeDir, rcFile);
  return fs.existsSync(rcPath) ? rcPath : null;
}
