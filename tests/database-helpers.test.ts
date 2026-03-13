import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { tmpdir } from "node:os";
import { EvidenceDatabase } from "../src/lib/storage/index.js";

describe("Database Helpers", () => {
  let tempDir: string;
  let dbPath: string;
  let db: EvidenceDatabase;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(tmpdir(), "footprint-helpers-"));
    dbPath = path.join(tempDir, "footprint.db");
    db = new EvidenceDatabase(dbPath);
  });

  afterEach(() => {
    try {
      db.close();
    } catch {
      // may already be closed in error tests
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function seedSessions(count: number): string[] {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const id = db.createSession({
        host: "claude",
        projectRoot: "/tmp/project",
        cwd: "/tmp/project",
        title: `Session ${i}`,
        status: "completed",
        startedAt: new Date(Date.now() - i * 60_000).toISOString(),
        endedAt: new Date(Date.now() - i * 60_000 + 30_000).toISOString(),
        metadata: null,
      });
      ids.push(id);
    }
    return ids;
  }

  describe("appendPaginationClause (via listSessions)", () => {
    it("returns all rows when no limit or offset", () => {
      seedSessions(5);
      expect(db.listSessions()).toHaveLength(5);
    });

    it("limits results when limit is set", () => {
      seedSessions(5);
      expect(db.listSessions({ limit: 3 })).toHaveLength(3);
    });

    it("offsets results when offset is set without limit", () => {
      seedSessions(5);
      const all = db.listSessions();
      const offset = db.listSessions({ offset: 2 });
      expect(offset).toHaveLength(3);
      expect(offset[0]!.id).toBe(all[2]!.id);
    });

    it("applies both limit and offset together", () => {
      seedSessions(10);
      const all = db.listSessions();
      const page = db.listSessions({ limit: 3, offset: 2 });
      expect(page).toHaveLength(3);
      expect(page[0]!.id).toBe(all[2]!.id);
      expect(page[2]!.id).toBe(all[4]!.id);
    });

    it("returns empty array when offset exceeds total", () => {
      seedSessions(3);
      expect(db.listSessions({ offset: 10 })).toHaveLength(0);
    });

    it("returns empty array when limit is zero", () => {
      seedSessions(3);
      expect(db.listSessions({ limit: 0 })).toHaveLength(0);
    });
  });

  describe("formatDbError (error chain preservation)", () => {
    it("preserves error cause chain on database failures", () => {
      db.close();

      try {
        db.listSessions();
        expect.unreachable("should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const err = error as Error;
        expect(err.message).toContain("Failed to");
        expect(err.cause).toBeInstanceOf(Error);
      }
    });

    it("includes action context in error message", () => {
      db.close();

      try {
        db.findSessionById("nonexistent");
        expect.unreachable("should have thrown");
      } catch (error) {
        const err = error as Error;
        expect(err.message).toMatch(/Failed to find session by ID/);
        expect(err.cause).toBeDefined();
      }
    });
  });
});
