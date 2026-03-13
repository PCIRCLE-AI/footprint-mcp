import { afterEach, describe, expect, it, vi } from "vitest";
import {
  traceAsyncOperation,
  traceSyncOperation,
} from "../src/lib/observability.js";

describe("Observability", () => {
  afterEach(() => {
    delete process.env.FOOTPRINT_DEBUG_PERF;
    vi.restoreAllMocks();
  });

  it("does not emit perf traces when debug perf logging is disabled", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const syncResult = traceSyncOperation(
      "sync-op",
      { scope: "test" },
      () => 7,
    );
    const asyncResult = await traceAsyncOperation(
      "async-op",
      { scope: "test" },
      async () => "ok",
    );

    expect(syncResult).toBe(7);
    expect(asyncResult).toBe("ok");
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("emits success traces when debug perf logging is enabled", async () => {
    process.env.FOOTPRINT_DEBUG_PERF = "1";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await traceAsyncOperation(
      "history.export-sessions",
      { host: "claude", sessionIds: 2 },
      async () => ({ ok: true }),
    );

    expect(result).toEqual({ ok: true });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toContain("[Footprint][perf]");
    expect(errorSpy.mock.calls[0]?.[0]).toContain(
      '"operation":"history.export-sessions"',
    );
    expect(errorSpy.mock.calls[0]?.[0]).toContain('"ok":true');
    expect(errorSpy.mock.calls[0]?.[0]).toContain('"sessionIds":2');
  });

  it("emits failure traces and rethrows errors", () => {
    process.env.FOOTPRINT_DEBUG_PERF = "1";
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() =>
      traceSyncOperation("db.query-sessions-by-history", { limit: 10 }, () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0]?.[0]).toContain('"ok":false');
    expect(errorSpy.mock.calls[0]?.[0]).toContain('"error":"boom"');
    expect(errorSpy.mock.calls[0]?.[0]).toContain('"limit":10');
  });
});
