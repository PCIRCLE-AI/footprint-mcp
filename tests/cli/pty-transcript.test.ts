import { describe, expect, it } from "vitest";
import {
  controlEchoTokens,
  decodeTranscriptInputText,
  decodeTranscriptOutputText,
  parseUtilLinuxTranscript,
  parseScriptTranscript,
} from "../../src/cli/pty-transcript.js";

function createRecord(
  direction: "s" | "i" | "o" | "e",
  payload: Buffer,
  seconds = 1_773_080_540,
  micros = 123_456,
): Buffer {
  const header = Buffer.alloc(24);
  header.writeBigUInt64LE(BigInt(payload.length), 0);
  header.writeBigUInt64LE(BigInt(seconds), 8);
  header.writeUInt32LE(micros, 16);
  header.writeUInt32LE(direction.charCodeAt(0), 20);
  return Buffer.concat([header, payload]);
}

describe("PTY transcript parser", () => {
  it("parses BSD script -r records in sequence", () => {
    const buffer = Buffer.concat([
      createRecord("s", Buffer.alloc(0)),
      createRecord("i", Buffer.from("ship slice a\n", "utf8")),
      createRecord("o", Buffer.from("done:ship slice a\r\n", "utf8")),
      createRecord("e", Buffer.alloc(0)),
    ]);

    const result = parseScriptTranscript(buffer);

    expect(result.remainder).toHaveLength(0);
    expect(result.records.map((record) => record.direction)).toEqual([
      "s",
      "i",
      "o",
      "e",
    ]);
    expect(result.records[1]?.payload.toString("utf8")).toBe("ship slice a\n");
    expect(result.records[2]?.payload.toString("utf8")).toBe(
      "done:ship slice a\r\n",
    );
  });

  it("returns trailing bytes as remainder when the transcript is incomplete", () => {
    const completeRecord = createRecord("i", Buffer.from("hello\n", "utf8"));
    const truncatedRecord = createRecord("o", Buffer.from("done\r\n", "utf8"));
    const buffer = Buffer.concat([
      completeRecord,
      truncatedRecord.subarray(0, truncatedRecord.length - 2),
    ]);

    const result = parseScriptTranscript(buffer);

    expect(result.records).toHaveLength(1);
    expect(result.records[0]?.direction).toBe("i");
    expect(result.remainder).toHaveLength(truncatedRecord.length - 2);
  });

  it("replays util-linux advanced timing logs across input and output streams", () => {
    const input = Buffer.from("ship slice a\n", "utf8");
    const output = Buffer.from("ready\r\ndone\r\n", "utf8");
    const timing = [
      "H 0.000000 START_TIME 2026-03-10T00:00:00Z",
      "I 0.050000 13",
      "O 0.010000 7",
      "S 0.000100 SIGWINCH ROWS=24 COLS=80",
      "O 0.020000 6",
    ].join("\n");

    const result = parseUtilLinuxTranscript({ timing, input, output });

    expect(result.records.map((record) => record.direction)).toEqual([
      "i",
      "o",
      "o",
    ]);
    expect(result.records[0]?.payload.toString("utf8")).toBe("ship slice a\n");
    expect(result.records[1]?.payload.toString("utf8")).toBe("ready\r\n");
    expect(result.records[2]?.payload.toString("utf8")).toBe("done\r\n");
    expect(result.inputRemainder).toHaveLength(0);
    expect(result.outputRemainder).toHaveLength(0);
  });

  it("strips util-linux script banner lines before replaying timed payloads", () => {
    const input = Buffer.from(
      [
        'Script started on 2026-03-10 14:58:11+08:00 [COMMAND="bash -lc ..."]',
        "ship slice a",
        "",
        'Script done on 2026-03-10 14:58:11+08:00 [COMMAND_EXIT_CODE="0"]',
      ].join("\n"),
      "utf8",
    );
    const output = Buffer.from(
      [
        'Script started on 2026-03-10 14:58:11+08:00 [COMMAND="bash -lc ..."]',
        "assistant:ship slice a\r",
        "done:ship slice a\r",
        "",
        'Script done on 2026-03-10 14:58:11+08:00 [COMMAND_EXIT_CODE="0"]',
      ].join("\n"),
      "utf8",
    );
    const timing = [
      "H 0.000000 START_TIME 2026-03-10 14:58:11+08:00",
      "I 0.000036 13",
      "O 0.261624 43",
      "H 0.000000 EXIT_CODE 0",
    ].join("\n");

    const result = parseUtilLinuxTranscript({ timing, input, output });

    expect(result.records.map((record) => record.direction)).toEqual([
      "i",
      "o",
    ]);
    expect(result.records[0]?.payload.toString("utf8")).toBe("ship slice a\n");
    expect(result.records[1]?.payload.toString("utf8")).toBe(
      "assistant:ship slice a\r\ndone:ship slice a\r\n",
    );
    expect(result.inputRemainder).toHaveLength(0);
    expect(result.outputRemainder).toHaveLength(0);
  });

  it("returns util-linux remainders when a timed payload is incomplete", () => {
    const input = Buffer.from("ship slice a\n", "utf8");
    const output = Buffer.from("ready\r\ndone", "utf8");
    const timing = ["I 0.050000 13", "O 0.010000 7", "O 0.020000 6"].join("\n");

    const result = parseUtilLinuxTranscript({ timing, input, output });

    expect(result.records.map((record) => record.direction)).toEqual([
      "i",
      "o",
    ]);
    expect(result.inputRemainder).toHaveLength(0);
    expect(result.outputRemainder.toString("utf8")).toBe("done");
  });

  it("normalizes transcript payloads for recorder replay", () => {
    expect(
      decodeTranscriptInputText(
        Buffer.from([0x73, 0x68, 0x69, 0x70, 0x0a, 0x04]),
      ),
    ).toBe("ship\n");
    expect(
      decodeTranscriptOutputText(Buffer.from("^D\b\bready\r\n", "utf8")),
    ).toBe("ready\n");
    expect(controlEchoTokens(Buffer.from([0x0a, 0x04, 0x03]))).toEqual([
      "^D",
      "^C",
    ]);
  });
});
