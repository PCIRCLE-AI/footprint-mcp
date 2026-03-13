import type { SessionHost, SessionStatus } from "../lib/storage/index.js";

export interface AdapterContext {
  host: SessionHost;
  cwd: string;
  args: string[];
}

export interface AdapterEventEnvelope {
  eventType: string;
  eventSubType?: string | null;
  summary?: string | null;
  payload?: Record<string, unknown> | null;
  status?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  relatedMessageRole?: "user" | "assistant" | "system" | null;
}

export interface AdapterParseResult {
  handled: boolean;
  suppressTranscript?: boolean;
  events?: AdapterEventEnvelope[];
}

export interface HostAdapter {
  host: SessionHost;
  name: string;
  parseLine(
    line: string,
    stream: "stdout" | "stderr",
    context: AdapterContext,
  ): AdapterParseResult | null;
  onSessionStart?(context: AdapterContext): AdapterEventEnvelope[];
  onSessionEnd?(
    context: AdapterContext,
    result: { exitCode: number; status: SessionStatus },
  ): AdapterEventEnvelope[];
}
