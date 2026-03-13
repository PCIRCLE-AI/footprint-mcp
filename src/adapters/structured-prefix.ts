import type {
  AdapterEventEnvelope,
  AdapterParseResult,
  HostAdapter,
} from "./types.js";
import type { SessionHost } from "../lib/storage/index.js";

interface StructuredPrefixAdapterConfig {
  host: SessionHost;
  name: string;
  prefix: string;
}

function parseEnvelope(
  line: string,
  prefix: string,
): AdapterEventEnvelope | null {
  if (!line.startsWith(prefix)) {
    return null;
  }

  const json = line.slice(prefix.length).trim();
  if (!json) {
    return null;
  }

  const parsed = JSON.parse(json) as AdapterEventEnvelope;
  if (!parsed.eventType) {
    return null;
  }

  return parsed;
}

export function createStructuredPrefixAdapter(
  config: StructuredPrefixAdapterConfig,
): HostAdapter {
  return {
    host: config.host,
    name: config.name,
    parseLine(line, stream, _context): AdapterParseResult | null {
      try {
        const envelope = parseEnvelope(line, config.prefix);
        if (!envelope) {
          return null;
        }

        return {
          handled: true,
          suppressTranscript: true,
          events: [
            {
              ...envelope,
              payload: {
                ...(envelope.payload ?? {}),
                stream,
              },
            },
          ],
        };
      } catch {
        return {
          handled: true,
          suppressTranscript: false,
          events: [
            {
              eventType: "error.observed",
              summary: `${config.name} failed to parse host event`,
              payload: {
                line,
                stream,
              },
              status: "parse-error",
            },
          ],
        };
      }
    },
  };
}
