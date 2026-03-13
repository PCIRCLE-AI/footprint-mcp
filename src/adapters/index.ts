import { claudeAdapter } from "./claude.js";
import { codexAdapter } from "./codex.js";
import { geminiAdapter } from "./gemini.js";
import type { HostAdapter } from "./types.js";
import type { SessionHost } from "../lib/storage/index.js";

const adapters = new Map<SessionHost, HostAdapter>([
  ["claude", claudeAdapter],
  ["gemini", geminiAdapter],
  ["codex", codexAdapter],
]);

export type {
  AdapterContext,
  AdapterEventEnvelope,
  AdapterParseResult,
  HostAdapter,
} from "./types.js";

export function getHostAdapter(host: SessionHost): HostAdapter | null {
  return adapters.get(host) ?? null;
}
