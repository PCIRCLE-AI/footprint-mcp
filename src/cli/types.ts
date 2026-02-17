/**
 * CLI types for interactive setup
 */

export interface SetupConfig {
  /** Directory to store Footprint data */
  dataDir: string;
  /** Encryption passphrase */
  passphrase: string;
  /** Auto-configure Claude Desktop */
  autoConfig: boolean;
  /** Skip backup of existing config */
  skipBackup?: boolean;
}

export interface SystemInfo {
  /** Operating system platform */
  platform: "darwin" | "linux" | "win32";
  /** Default shell */
  shell: "bash" | "zsh" | "fish" | "powershell";
  /** Path to Claude Desktop config */
  claudeConfigPath: string | null;
  /** User home directory */
  homeDir: string;
  /** Shell RC file path */
  shellRcPath: string | null;
}

export interface ClaudeConfig {
  mcpServers?: Record<
    string,
    {
      command: string;
      args: string[];
      env?: Record<string, string>;
    }
  >;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
  score?: number; // For password strength
}
