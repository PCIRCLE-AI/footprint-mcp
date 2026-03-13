const SCRIPT_RECORD_HEADER_BYTES = 24;

export type ScriptTranscriptDirection = "s" | "i" | "o" | "e";

export interface ScriptTranscriptRecord {
  payloadLength: number;
  seconds: number;
  micros: number;
  direction: ScriptTranscriptDirection;
  payload: Buffer;
}

export interface ParsedScriptTranscript {
  records: ScriptTranscriptRecord[];
  remainder: Buffer;
}

export interface UtilLinuxTranscriptRecord {
  delaySeconds: number;
  direction: "i" | "o";
  payloadLength: number;
  payload: Buffer;
}

export interface ParsedUtilLinuxTranscript {
  records: UtilLinuxTranscriptRecord[];
  inputRemainder: Buffer;
  outputRemainder: Buffer;
}

function trimUtilLinuxScriptBanner(buffer: Buffer): Buffer {
  const startPrefix = Buffer.from("Script started on ", "utf8");
  if (!buffer.subarray(0, startPrefix.length).equals(startPrefix)) {
    return buffer;
  }

  const firstNewline = buffer.indexOf(0x0a);
  if (firstNewline === -1) {
    return buffer;
  }

  return buffer.subarray(firstNewline + 1);
}

function trimUtilLinuxScriptFooter(buffer: Buffer): Buffer {
  const footerMarker = Buffer.from("\nScript done on ", "utf8");
  const footerStart = buffer.lastIndexOf(footerMarker);
  if (footerStart === -1) {
    return buffer;
  }

  return buffer.subarray(0, footerStart);
}

function normalizeUtilLinuxTranscriptStream(buffer: Buffer): Buffer {
  return trimUtilLinuxScriptFooter(trimUtilLinuxScriptBanner(buffer));
}

function isKnownDirection(value: string): value is ScriptTranscriptDirection {
  return value === "s" || value === "i" || value === "o" || value === "e";
}

export function parseScriptTranscript(buffer: Buffer): ParsedScriptTranscript {
  const records: ScriptTranscriptRecord[] = [];
  let offset = 0;

  while (offset + SCRIPT_RECORD_HEADER_BYTES <= buffer.length) {
    const payloadLengthBig = buffer.readBigUInt64LE(offset);
    if (payloadLengthBig > BigInt(Number.MAX_SAFE_INTEGER)) {
      break;
    }

    const payloadLength = Number(payloadLengthBig);
    const recordEnd = offset + SCRIPT_RECORD_HEADER_BYTES + payloadLength;
    if (recordEnd > buffer.length) {
      break;
    }

    const direction = String.fromCharCode(
      buffer.readUInt32LE(offset + 20),
    ).toLowerCase();
    if (!isKnownDirection(direction)) {
      break;
    }

    records.push({
      payloadLength,
      seconds: Number(buffer.readBigUInt64LE(offset + 8)),
      micros: buffer.readUInt32LE(offset + 16),
      direction,
      payload: buffer.subarray(offset + SCRIPT_RECORD_HEADER_BYTES, recordEnd),
    });
    offset = recordEnd;
  }

  return {
    records,
    remainder: buffer.subarray(offset),
  };
}

function parseUtilLinuxTimingLine(
  line: string,
): Omit<UtilLinuxTranscriptRecord, "payload"> | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  const [entryType, delayText, payloadLengthText] = trimmed.split(/\s+/, 4);
  if (entryType !== "I" && entryType !== "O") {
    return null;
  }

  const delaySeconds = Number.parseFloat(delayText ?? "");
  const payloadLength = Number.parseInt(payloadLengthText ?? "", 10);
  if (
    !Number.isFinite(delaySeconds) ||
    !Number.isInteger(payloadLength) ||
    payloadLength < 0
  ) {
    return null;
  }

  return {
    delaySeconds,
    direction: entryType.toLowerCase() as "i" | "o",
    payloadLength,
  };
}

export function parseUtilLinuxTranscript(options: {
  timing: Buffer | string;
  input: Buffer;
  output: Buffer;
}): ParsedUtilLinuxTranscript {
  const timingText = Buffer.isBuffer(options.timing)
    ? options.timing.toString("utf8")
    : options.timing;
  const normalizedInput = normalizeUtilLinuxTranscriptStream(options.input);
  const normalizedOutput = normalizeUtilLinuxTranscriptStream(options.output);
  const records: UtilLinuxTranscriptRecord[] = [];
  let inputOffset = 0;
  let outputOffset = 0;

  for (const line of timingText.split(/\r?\n/)) {
    const record = parseUtilLinuxTimingLine(line);
    if (!record) {
      continue;
    }

    if (record.direction === "i") {
      const nextOffset = inputOffset + record.payloadLength;
      if (nextOffset > normalizedInput.length) {
        break;
      }

      records.push({
        ...record,
        payload: normalizedInput.subarray(inputOffset, nextOffset),
      });
      inputOffset = nextOffset;
      continue;
    }

    const nextOffset = outputOffset + record.payloadLength;
    if (nextOffset > normalizedOutput.length) {
      break;
    }

    records.push({
      ...record,
      payload: normalizedOutput.subarray(outputOffset, nextOffset),
    });
    outputOffset = nextOffset;
  }

  return {
    records,
    inputRemainder: normalizedInput.subarray(inputOffset),
    outputRemainder: normalizedOutput.subarray(outputOffset),
  };
}

function stripControlBytes(text: string): string {
  let result = "";

  for (const char of text) {
    const code = char.charCodeAt(0);
    const isControl =
      (code >= 0x00 && code <= 0x08) ||
      code === 0x0b ||
      code === 0x0c ||
      (code >= 0x0e && code <= 0x1f) ||
      code === 0x7f;

    if (!isControl) {
      result += char;
    }
  }

  return result;
}

function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function applyBackspaces(text: string): string {
  let result = "";

  for (const char of text) {
    if (char === "\b" || char === "\u007f") {
      result = result.slice(0, -1);
      continue;
    }

    result += char;
  }

  return result;
}

export function decodeScriptTranscriptPayload(payload: Buffer): string {
  return payload.toString("utf8");
}

export function decodeTranscriptInputText(payload: Buffer): string {
  return normalizeLineEndings(
    stripControlBytes(decodeScriptTranscriptPayload(payload)),
  );
}

export function decodeTranscriptOutputText(payload: Buffer): string {
  return normalizeLineEndings(
    applyBackspaces(
      Array.from(decodeScriptTranscriptPayload(payload))
        .filter((char) => char.charCodeAt(0) !== 0x00)
        .join(""),
    ),
  );
}

export function controlEchoTokens(payload: Buffer): string[] {
  const tokens: string[] = [];

  for (const byte of payload) {
    if (byte === 0x09 || byte === 0x0a || byte === 0x0d) {
      continue;
    }

    if (byte >= 1 && byte <= 26) {
      tokens.push(`^${String.fromCharCode(byte + 64)}`);
    }
  }

  return tokens;
}
