import { describe, it, expect } from "vitest";
import {
  generateEnvExport,
  appendToShellRc,
  removeFootprintFromRc,
} from "../../../src/cli/utils/env.js";
import * as fs from "fs";
import * as path from "path";
import { tmpdir } from "os";

describe("Environment Setup", () => {
  it("should generate bash export statement with shell escaping", () => {
    const result = generateEnvExport("bash", "/data", "pass123");
    // Now uses single quotes for security (shell escaping)
    expect(result).toContain("export FOOTPRINT_DATA_DIR='/data'");
    expect(result).toContain("export FOOTPRINT_PASSPHRASE='pass123'");
  });

  it("should generate zsh export statement with shell escaping", () => {
    const result = generateEnvExport("zsh", "/data", "pass123");
    // Now uses single quotes for security (shell escaping)
    expect(result).toContain("export FOOTPRINT_DATA_DIR='/data'");
  });

  it("should generate fish shell syntax with set -gx", () => {
    const result = generateEnvExport("fish", "/data", "pass123");
    expect(result).toContain("set -gx FOOTPRINT_DATA_DIR '/data'");
    expect(result).toContain("set -gx FOOTPRINT_PASSPHRASE 'pass123'");
    expect(result).not.toContain("export ");
  });

  it("should append to shell RC file", () => {
    const tempRc = path.join(tmpdir(), ".testrc");
    fs.writeFileSync(tempRc, "# Existing config\n");

    appendToShellRc(tempRc, "export TEST=1");

    const content = fs.readFileSync(tempRc, "utf-8");
    expect(content).toContain("# Footprint MCP Server");
    expect(content).toContain("export TEST=1");

    fs.unlinkSync(tempRc);
  });

  it("should remove footprint block from shell RC (rollback)", () => {
    const tempRc = path.join(tmpdir(), ".testrc-rollback");
    const original = "# My shell config\nalias ll='ls -la'\n";
    const footprintBlock =
      "\n# Footprint MCP Server Environment Variables\n" +
      "export FOOTPRINT_DATA_DIR='/data'\n" +
      "export FOOTPRINT_PASSPHRASE='secret'\n";
    fs.writeFileSync(tempRc, original + footprintBlock);

    const removed = removeFootprintFromRc(tempRc);

    expect(removed).toBe(true);
    const content = fs.readFileSync(tempRc, "utf-8");
    expect(content).toContain("alias ll='ls -la'");
    expect(content).not.toContain("FOOTPRINT");

    fs.unlinkSync(tempRc);
  });

  it("should remove fish-style footprint block from shell RC (rollback)", () => {
    const tempRc = path.join(tmpdir(), ".testrc-fish-rollback");
    const original = "# Fish config\nset -gx EDITOR vim\n";
    const footprintBlock =
      "\n# Footprint MCP Server Environment Variables\n" +
      "set -gx FOOTPRINT_DATA_DIR '/data'\n" +
      "set -gx FOOTPRINT_PASSPHRASE 'secret'\n";
    fs.writeFileSync(tempRc, original + footprintBlock);

    const removed = removeFootprintFromRc(tempRc);

    expect(removed).toBe(true);
    const content = fs.readFileSync(tempRc, "utf-8");
    expect(content).toContain("set -gx EDITOR vim");
    expect(content).not.toContain("FOOTPRINT");

    fs.unlinkSync(tempRc);
  });

  it("should return false when file does not exist", () => {
    const removed = removeFootprintFromRc("/tmp/nonexistent-rc-file-12345");
    expect(removed).toBe(false);
  });

  it("should return false when file has no footprint block", () => {
    const tempRc = path.join(tmpdir(), ".testrc-noblock");
    fs.writeFileSync(tempRc, "# My shell config\nalias ll='ls -la'\n");

    const removed = removeFootprintFromRc(tempRc);
    expect(removed).toBe(false);

    // File should be unchanged
    const content = fs.readFileSync(tempRc, "utf-8");
    expect(content).toBe("# My shell config\nalias ll='ls -la'\n");

    fs.unlinkSync(tempRc);
  });

  it("should preserve file permissions after rollback", () => {
    const tempRc = path.join(tmpdir(), ".testrc-perms");
    const original = "# Config\n";
    const footprintBlock =
      "\n# Footprint MCP Server Environment Variables\n" +
      "export FOOTPRINT_DATA_DIR='/data'\n" +
      "export FOOTPRINT_PASSPHRASE='secret'\n";
    fs.writeFileSync(tempRc, original + footprintBlock);
    fs.chmodSync(tempRc, 0o600);

    removeFootprintFromRc(tempRc);

    const stat = fs.statSync(tempRc);

    expect(stat.mode & 0o777).toBe(0o600);

    fs.unlinkSync(tempRc);
  });

  it("should escape single quotes correctly for fish shell", () => {
    const result = generateEnvExport("fish", "/data's dir", "pass'phrase");
    expect(result).toContain("set -gx FOOTPRINT_DATA_DIR '/data\\'s dir'");
    expect(result).toContain("set -gx FOOTPRINT_PASSPHRASE 'pass\\'phrase'");
  });

  it("should escape single quotes correctly for bash shell", () => {
    const result = generateEnvExport("bash", "/data's dir", "pass'phrase");
    expect(result).toContain("export FOOTPRINT_DATA_DIR='/data'\\''s dir'");
    expect(result).toContain("export FOOTPRINT_PASSPHRASE='pass'\\''phrase'");
  });
});
