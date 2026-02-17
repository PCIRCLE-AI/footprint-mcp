import { describe, it, expect } from "vitest";
import * as os from "os";
import * as path from "path";
import {
  validatePassword,
  validatePath,
} from "../../../src/cli/utils/validation.js";

describe("Password Validation", () => {
  it("should reject weak passwords", () => {
    const result = validatePassword("123456789012");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("weak");
  });

  it("should reject short passwords", () => {
    const result = validatePassword("short");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("12 characters");
  });

  it("should accept strong passwords", () => {
    const result = validatePassword("MyS3cur3P@ssw0rd!2024");
    expect(result.valid).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(2);
  });
});

describe("Path Validation", () => {
  it("should accept valid absolute paths within home directory", () => {
    // Use actual home directory for security compliance
    const validPath = path.join(os.homedir(), ".footprint");
    const result = validatePath(validPath);
    expect(result.valid).toBe(true);
    expect(result.normalizedPath).toBe(validPath);
  });

  it("should expand tilde in paths", () => {
    const result = validatePath("~/.footprint");
    expect(result.valid).toBe(true);
    expect(result.normalizedPath).toBe(path.join(os.homedir(), ".footprint"));
  });

  it("should reject relative paths", () => {
    const result = validatePath("./data");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("absolute");
  });

  it("should reject paths outside home directory", () => {
    const result = validatePath("/tmp/footprint");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("home directory");
  });

  it("should reject paths with shell special characters", () => {
    const result = validatePath("~/.footprint; rm -rf /");
    expect(result.valid).toBe(false);
    expect(result.message).toContain("invalid characters");
  });
});
