function isPerfDebugEnabled(): boolean {
  return process.env.FOOTPRINT_DEBUG_PERF === "1";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error);
}

function normalizeAttributes(
  attributes: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!attributes) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(attributes).filter(([, value]) => value !== undefined),
  );
}

function emitPerfTrace(
  name: string,
  startedAt: bigint,
  attributes?: Record<string, unknown>,
  error?: unknown,
): void {
  if (!isPerfDebugEnabled()) {
    return;
  }

  const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
  const payload = {
    operation: name,
    durationMs: Number(durationMs.toFixed(3)),
    ok: error === undefined,
    ...normalizeAttributes(attributes),
    ...(error !== undefined ? { error: getErrorMessage(error) } : {}),
  };

  console.error(`[Footprint][perf] ${JSON.stringify(payload)}`);
}

export function traceSyncOperation<T>(
  name: string,
  attributes: Record<string, unknown> | undefined,
  operation: () => T,
): T {
  if (!isPerfDebugEnabled()) {
    return operation();
  }

  const startedAt = process.hrtime.bigint();
  try {
    const result = operation();
    emitPerfTrace(name, startedAt, attributes);
    return result;
  } catch (error) {
    emitPerfTrace(name, startedAt, attributes, error);
    throw error;
  }
}

export async function traceAsyncOperation<T>(
  name: string,
  attributes: Record<string, unknown> | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  if (!isPerfDebugEnabled()) {
    return operation();
  }

  const startedAt = process.hrtime.bigint();
  try {
    const result = await operation();
    emitPerfTrace(name, startedAt, attributes);
    return result;
  } catch (error) {
    emitPerfTrace(name, startedAt, attributes, error);
    throw error;
  }
}
