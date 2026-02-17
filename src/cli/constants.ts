/**
 * CLI constants for setup process
 */
import * as os from "os";
import * as path from "path";

export const DEFAULT_DATA_DIR = path.join(os.homedir(), ".footprint");

export const CLAUDE_CONFIG_PATHS = {
  darwin: path.join(
    os.homedir(),
    "Library/Application Support/Claude/claude_desktop_config.json",
  ),
  linux: path.join(os.homedir(), ".config/Claude/claude_desktop_config.json"),
  win32: path.join(
    os.homedir(),
    "AppData/Roaming/Claude/claude_desktop_config.json",
  ),
};

export const SHELL_RC_FILES = {
  bash: ".bashrc",
  zsh: ".zshrc",
  fish: ".config/fish/config.fish",
};

export const MIN_PASSWORD_SCORE = 2; // zxcvbn score (0-4)
export const MIN_PASSWORD_LENGTH = 12;

export const COLORS = {
  success: "#00FF00",
  error: "#FF0000",
  warning: "#FFA500",
  info: "#00BFFF",
};
