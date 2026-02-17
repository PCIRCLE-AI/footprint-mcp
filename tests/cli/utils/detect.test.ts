import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs module before imports
vi.mock('fs', () => ({
  existsSync: vi.fn(),
}));

import { detectSystem, detectShell, findClaudeConfig } from '../../../src/cli/utils/detect.js';
import * as fs from 'fs';

describe('System Detection', () => {
  let originalPlatform: NodeJS.Platform;
  let originalShell: string | undefined;

  beforeEach(() => {
    originalPlatform = process.platform;
    originalShell = process.env.SHELL;
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
      writable: true,
      configurable: true,
    });
    if (originalShell !== undefined) {
      process.env.SHELL = originalShell;
    } else {
      delete process.env.SHELL;
    }
  });

  it('should detect macOS platform', () => {
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      writable: true,
      configurable: true,
    });
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const info = detectSystem();
    expect(info.platform).toBe('darwin');
  });

  it('should detect shell from SHELL env', () => {
    process.env.SHELL = '/bin/zsh';
    const shell = detectShell();
    expect(shell).toBe('zsh');
  });

  it('should find Claude config on macOS', () => {
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      writable: true,
      configurable: true,
    });
    vi.mocked(fs.existsSync).mockReturnValue(true);

    const configPath = findClaudeConfig();
    expect(configPath).toContain('claude_desktop_config.json');
  });

  it('should return null if Claude config not found', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const configPath = findClaudeConfig();
    expect(configPath).toBeNull();
  });
});
