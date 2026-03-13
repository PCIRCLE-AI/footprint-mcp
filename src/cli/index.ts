#!/usr/bin/env node
/* global console, process */

import { runSetup } from "./setup.js";
import { runLiveDemoCli } from "./live-demo.js";
import {
  confirmContextLinkCli,
  exportSessionsCli,
  ingestSessionCli,
  listSessionsCli,
  listContextsCli,
  mergeContextsCli,
  moveSessionContextCli,
  prepareContextCli,
  rejectContextLinkCli,
  resolveContextCli,
  runClaudeSession,
  runCodexSession,
  runGeminiSession,
  searchHistoryCli,
  setActiveContextCli,
  showContextCli,
  showHistoryHandoffCli,
  showSessionArtifactsCli,
  showSessionDecisionsCli,
  showHistoryTrendsCli,
  showSessionMessagesCli,
  showSessionTrendsCli,
  showSessionNarrativesCli,
  showSessionCli,
  showSessionTimelineCli,
  splitContextCli,
} from "./session-runtime.js";
import type {
  ArtifactType,
  NarrativeKind,
  SessionHost,
  SessionStatus,
} from "../lib/storage/index.js";

const args = process.argv.slice(2);
const command = args[0];
const sessionHosts = new Set<SessionHost>(["claude", "gemini", "codex"]);
const sessionStatuses = new Set<SessionStatus>([
  "running",
  "completed",
  "failed",
  "interrupted",
]);
const artifactTypes = new Set<ArtifactType>([
  "file-change",
  "command-output",
  "test-result",
  "git-commit",
]);
const narrativeKinds = new Set<NarrativeKind>([
  "journal",
  "project-summary",
  "handoff",
]);
const exportOutputModes = new Set<"file" | "base64" | "both">([
  "file",
  "base64",
  "both",
]);
const historyTrendGroups = new Set<"issue" | "family">(["issue", "family"]);

function consumeFlag(
  values: string[],
  flag: string,
): {
  present: boolean;
  rest: string[];
} {
  const rest: string[] = [];
  let present = false;

  for (const value of values) {
    if (value === flag) {
      present = true;
      continue;
    }
    rest.push(value);
  }

  return { present, rest };
}

function consumeOption(
  values: string[],
  flag: string,
): {
  value: string | undefined;
  rest: string[];
} {
  const rest: string[] = [];
  let value: string | undefined;

  for (let index = 0; index < values.length; index += 1) {
    const current = values[index];
    if (current === flag) {
      const next = values[index + 1];
      if (!next || next.startsWith("--")) {
        throw new Error(`Missing value for ${flag}`);
      }
      value = next;
      index += 1;
      continue;
    }
    rest.push(current);
  }

  return { value, rest };
}

function parseJsonOption(values: string[]): { json: boolean; rest: string[] } {
  const { present, rest } = consumeFlag(values, "--json");
  return { json: present, rest };
}

function assertNoExtraArgs(values: string[], usage: string): void {
  if (values.length > 0) {
    throw new Error(usage);
  }
}

function parseEnumValue<T extends string>(
  value: string | undefined,
  allowed: Set<T>,
  flag: string,
): T | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!allowed.has(value as T)) {
    throw new Error(`Invalid value for ${flag}: ${value}`);
  }

  return value as T;
}

function parseIntegerOption(
  value: string | undefined,
  flag: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!/^-?\d+$/.test(value)) {
    throw new Error(`Invalid value for ${flag}: ${value}`);
  }

  return Number.parseInt(value, 10);
}

async function main() {
  switch (command) {
    case "setup": {
      await runSetup();
      break;
    }

    case "demo": {
      const openParse = consumeFlag(args.slice(1), "--open");
      const hostParse = consumeOption(openParse.rest, "--host");
      const portParse = consumeOption(hostParse.rest, "--port");
      assertNoExtraArgs(
        portParse.rest,
        'Usage: "footprint demo [--host <address>] [--port <number>] [--open]"',
      );

      await runLiveDemoCli({
        host: hostParse.value,
        port: parseIntegerOption(portParse.value, "--port"),
        open: openParse.present,
      });
      break;
    }

    case "run": {
      const host = args[1];
      const separatorIndex = args.indexOf("--");
      const runOptionArgs =
        separatorIndex >= 0 ? args.slice(2, separatorIndex) : args.slice(2);
      let commandArgs =
        separatorIndex >= 0 ? args.slice(separatorIndex + 1) : [];
      const prepareParse = consumeFlag(runOptionArgs, "--prepare-context");
      const skipPrepareParse = consumeFlag(
        prepareParse.rest,
        "--no-context-prepare",
      );
      const interactiveParse = consumeFlag(
        skipPrepareParse.rest,
        "--interactive-context",
      );
      const contextTitleParse = consumeOption(
        interactiveParse.rest,
        "--context-title",
      );
      if (separatorIndex >= 0) {
        assertNoExtraArgs(
          contextTitleParse.rest,
          'Usage: "footprint run <claude|gemini|codex> [--prepare-context] [--no-context-prepare] [--interactive-context] [--context-title <text>] -- <args...>"',
        );
      } else {
        commandArgs = contextTitleParse.rest;
      }
      const prepareContext = skipPrepareParse.present
        ? false
        : prepareParse.present ||
          (Boolean(process.stdin.isTTY) && Boolean(process.stderr.isTTY));
      const interactiveContext =
        interactiveParse.present ||
        (prepareContext &&
          Boolean(process.stdin.isTTY) &&
          Boolean(process.stderr.isTTY));

      switch (host) {
        case "claude":
          process.exitCode = await runClaudeSession(commandArgs, {
            prepareContext,
            interactiveContext,
            contextTitle: contextTitleParse.value,
          });
          break;
        case "gemini":
          process.exitCode = await runGeminiSession(commandArgs, {
            prepareContext,
            interactiveContext,
            contextTitle: contextTitleParse.value,
          });
          break;
        case "codex":
          process.exitCode = await runCodexSession(commandArgs, {
            prepareContext,
            interactiveContext,
            contextTitle: contextTitleParse.value,
          });
          break;
        default:
          throw new Error(
            `Unsupported host "${host}". Supported hosts: claude, gemini, codex.`,
          );
      }
      break;
    }

    case "sessions": {
      if (args[1] !== "list") {
        throw new Error('Supported command: "footprint sessions list"');
      }
      const jsonParse = parseJsonOption(args.slice(2));
      const queryParse = consumeOption(jsonParse.rest, "--query");
      const issueKeyParse = consumeOption(queryParse.rest, "--issue-key");
      const hostParse = consumeOption(issueKeyParse.rest, "--host");
      const statusParse = consumeOption(hostParse.rest, "--status");
      assertNoExtraArgs(
        statusParse.rest,
        'Usage: "footprint sessions list [--query <text>] [--issue-key <issue-key>] [--host <claude|gemini|codex>] [--status <running|completed|failed|interrupted>] [--json]"',
      );
      listSessionsCli({
        json: jsonParse.json,
        query: queryParse.value,
        issueKey: issueKeyParse.value,
        host: parseEnumValue(hostParse.value, sessionHosts, "--host"),
        status: parseEnumValue(statusParse.value, sessionStatuses, "--status"),
      });
      break;
    }

    case "contexts": {
      if (args[1] !== "list") {
        throw new Error('Supported command: "footprint contexts list"');
      }
      const jsonParse = parseJsonOption(args.slice(2));
      assertNoExtraArgs(
        jsonParse.rest,
        'Usage: "footprint contexts list [--json]"',
      );
      listContextsCli({ json: jsonParse.json });
      break;
    }

    case "session": {
      const subcommand = args[1];
      const sessionId = args[2];
      if (!sessionId) {
        throw new Error(
          'Usage: "footprint session <show|ingest|export|messages|trends|timeline|artifacts|narratives|decisions> <id> [options]".',
        );
      }

      if (subcommand === "show") {
        const jsonParse = parseJsonOption(args.slice(3));
        const messageLimitParse = consumeOption(
          jsonParse.rest,
          "--message-limit",
        );
        const messageOffsetParse = consumeOption(
          messageLimitParse.rest,
          "--message-offset",
        );
        const trendLimitParse = consumeOption(
          messageOffsetParse.rest,
          "--trend-limit",
        );
        const trendOffsetParse = consumeOption(
          trendLimitParse.rest,
          "--trend-offset",
        );
        const timelineLimitParse = consumeOption(
          trendOffsetParse.rest,
          "--timeline-limit",
        );
        const timelineOffsetParse = consumeOption(
          timelineLimitParse.rest,
          "--timeline-offset",
        );
        const artifactLimitParse = consumeOption(
          timelineOffsetParse.rest,
          "--artifact-limit",
        );
        const artifactOffsetParse = consumeOption(
          artifactLimitParse.rest,
          "--artifact-offset",
        );
        const narrativeLimitParse = consumeOption(
          artifactOffsetParse.rest,
          "--narrative-limit",
        );
        const narrativeOffsetParse = consumeOption(
          narrativeLimitParse.rest,
          "--narrative-offset",
        );
        const decisionLimitParse = consumeOption(
          narrativeOffsetParse.rest,
          "--decision-limit",
        );
        const decisionOffsetParse = consumeOption(
          decisionLimitParse.rest,
          "--decision-offset",
        );
        assertNoExtraArgs(
          decisionOffsetParse.rest,
          'Usage: "footprint session show <id> [--message-limit <n>] [--message-offset <n>] [--trend-limit <n>] [--trend-offset <n>] [--timeline-limit <n>] [--timeline-offset <n>] [--artifact-limit <n>] [--artifact-offset <n>] [--narrative-limit <n>] [--narrative-offset <n>] [--decision-limit <n>] [--decision-offset <n>] [--json]"',
        );
        showSessionCli(sessionId, {
          json: jsonParse.json,
          messageLimit: parseIntegerOption(
            messageLimitParse.value,
            "--message-limit",
          ),
          messageOffset: parseIntegerOption(
            messageOffsetParse.value,
            "--message-offset",
          ),
          trendLimit: parseIntegerOption(
            trendLimitParse.value,
            "--trend-limit",
          ),
          trendOffset: parseIntegerOption(
            trendOffsetParse.value,
            "--trend-offset",
          ),
          timelineLimit: parseIntegerOption(
            timelineLimitParse.value,
            "--timeline-limit",
          ),
          timelineOffset: parseIntegerOption(
            timelineOffsetParse.value,
            "--timeline-offset",
          ),
          artifactLimit: parseIntegerOption(
            artifactLimitParse.value,
            "--artifact-limit",
          ),
          artifactOffset: parseIntegerOption(
            artifactOffsetParse.value,
            "--artifact-offset",
          ),
          narrativeLimit: parseIntegerOption(
            narrativeLimitParse.value,
            "--narrative-limit",
          ),
          narrativeOffset: parseIntegerOption(
            narrativeOffsetParse.value,
            "--narrative-offset",
          ),
          decisionLimit: parseIntegerOption(
            decisionLimitParse.value,
            "--decision-limit",
          ),
          decisionOffset: parseIntegerOption(
            decisionOffsetParse.value,
            "--decision-offset",
          ),
        });
        break;
      }

      if (subcommand === "ingest") {
        const { json, rest } = parseJsonOption(args.slice(3));
        assertNoExtraArgs(
          rest,
          'Usage: "footprint session ingest <id> [--json]"',
        );
        ingestSessionCli(sessionId, { json });
        break;
      }

      if (subcommand === "export") {
        const jsonParse = parseJsonOption(args.slice(3));
        const groupByParse = consumeOption(jsonParse.rest, "--group-by");
        const outputModeParse = consumeOption(
          groupByParse.rest,
          "--output-mode",
        );
        assertNoExtraArgs(
          outputModeParse.rest,
          'Usage: "footprint session export <id> [--group-by <issue|family>] [--output-mode <file|base64|both>] [--json]"',
        );
        await exportSessionsCli([sessionId], {
          json: jsonParse.json,
          groupBy: parseEnumValue(
            groupByParse.value,
            historyTrendGroups,
            "--group-by",
          ),
          outputMode: parseEnumValue(
            outputModeParse.value,
            exportOutputModes,
            "--output-mode",
          ),
        });
        break;
      }

      if (subcommand === "messages") {
        const jsonParse = parseJsonOption(args.slice(3));
        const limitParse = consumeOption(jsonParse.rest, "--limit");
        const offsetParse = consumeOption(limitParse.rest, "--offset");
        assertNoExtraArgs(
          offsetParse.rest,
          'Usage: "footprint session messages <id> [--limit <n>] [--offset <n>] [--json]"',
        );
        showSessionMessagesCli(sessionId, {
          json: jsonParse.json,
          limit: parseIntegerOption(limitParse.value, "--limit"),
          offset: parseIntegerOption(offsetParse.value, "--offset"),
        });
        break;
      }

      if (subcommand === "timeline") {
        const jsonParse = parseJsonOption(args.slice(3));
        const limitParse = consumeOption(jsonParse.rest, "--limit");
        const offsetParse = consumeOption(limitParse.rest, "--offset");
        assertNoExtraArgs(
          offsetParse.rest,
          'Usage: "footprint session timeline <id> [--limit <n>] [--offset <n>] [--json]"',
        );
        showSessionTimelineCli(sessionId, {
          json: jsonParse.json,
          limit: parseIntegerOption(limitParse.value, "--limit"),
          offset: parseIntegerOption(offsetParse.value, "--offset"),
        });
        break;
      }

      if (subcommand === "trends") {
        const jsonParse = parseJsonOption(args.slice(3));
        const limitParse = consumeOption(jsonParse.rest, "--limit");
        const offsetParse = consumeOption(limitParse.rest, "--offset");
        assertNoExtraArgs(
          offsetParse.rest,
          'Usage: "footprint session trends <id> [--limit <n>] [--offset <n>] [--json]"',
        );
        showSessionTrendsCli(sessionId, {
          json: jsonParse.json,
          limit: parseIntegerOption(limitParse.value, "--limit"),
          offset: parseIntegerOption(offsetParse.value, "--offset"),
        });
        break;
      }

      if (subcommand === "artifacts") {
        const jsonParse = parseJsonOption(args.slice(3));
        const typeParse = consumeOption(jsonParse.rest, "--type");
        const limitParse = consumeOption(typeParse.rest, "--limit");
        const offsetParse = consumeOption(limitParse.rest, "--offset");
        assertNoExtraArgs(
          offsetParse.rest,
          'Usage: "footprint session artifacts <id> [--type <file-change|command-output|test-result|git-commit>] [--limit <n>] [--offset <n>] [--json]"',
        );
        showSessionArtifactsCli(sessionId, {
          json: jsonParse.json,
          artifactType: parseEnumValue(
            typeParse.value,
            artifactTypes,
            "--type",
          ),
          limit: parseIntegerOption(limitParse.value, "--limit"),
          offset: parseIntegerOption(offsetParse.value, "--offset"),
        });
        break;
      }

      if (subcommand === "narratives") {
        const jsonParse = parseJsonOption(args.slice(3));
        const kindParse = consumeOption(jsonParse.rest, "--kind");
        const limitParse = consumeOption(kindParse.rest, "--limit");
        const offsetParse = consumeOption(limitParse.rest, "--offset");
        assertNoExtraArgs(
          offsetParse.rest,
          'Usage: "footprint session narratives <id> [--kind <journal|project-summary|handoff>] [--limit <n>] [--offset <n>] [--json]"',
        );
        showSessionNarrativesCli(sessionId, {
          json: jsonParse.json,
          kind: parseEnumValue(kindParse.value, narrativeKinds, "--kind"),
          limit: parseIntegerOption(limitParse.value, "--limit"),
          offset: parseIntegerOption(offsetParse.value, "--offset"),
        });
        break;
      }

      if (subcommand === "decisions") {
        const jsonParse = parseJsonOption(args.slice(3));
        const limitParse = consumeOption(jsonParse.rest, "--limit");
        const offsetParse = consumeOption(limitParse.rest, "--offset");
        assertNoExtraArgs(
          offsetParse.rest,
          'Usage: "footprint session decisions <id> [--limit <n>] [--offset <n>] [--json]"',
        );
        showSessionDecisionsCli(sessionId, {
          json: jsonParse.json,
          limit: parseIntegerOption(limitParse.value, "--limit"),
          offset: parseIntegerOption(offsetParse.value, "--offset"),
        });
        break;
      }

      throw new Error(
        'Usage: "footprint session <show|ingest|export|messages|trends|timeline|artifacts|narratives|decisions> <id> [options]".',
      );
    }

    case "context": {
      const subcommand = args[1];

      if (subcommand === "show") {
        const contextId = args[2];
        if (!contextId) {
          throw new Error(
            'Usage: "footprint context show <context-id> [--json]"',
          );
        }
        const jsonParse = parseJsonOption(args.slice(3));
        assertNoExtraArgs(
          jsonParse.rest,
          'Usage: "footprint context show <context-id> [--json]"',
        );
        showContextCli(contextId, { json: jsonParse.json });
        break;
      }

      if (subcommand === "resolve") {
        const jsonParse = parseJsonOption(args.slice(2));
        const sessionParse = consumeOption(jsonParse.rest, "--session");
        const cwdParse = consumeOption(sessionParse.rest, "--cwd");
        const titleParse = consumeOption(cwdParse.rest, "--title");
        const hostParse = consumeOption(titleParse.rest, "--host");
        assertNoExtraArgs(
          hostParse.rest,
          'Usage: "footprint context resolve [--session <id>] [--cwd <path>] [--title <text>] [--host <claude|gemini|codex>] [--json]"',
        );
        resolveContextCli({
          json: jsonParse.json,
          sessionId: sessionParse.value,
          cwd: cwdParse.value,
          title: titleParse.value,
          host: parseEnumValue(hostParse.value, sessionHosts, "--host"),
        });
        break;
      }

      if (subcommand === "prepare") {
        const jsonParse = parseJsonOption(args.slice(2));
        const interactiveParse = consumeFlag(jsonParse.rest, "--interactive");
        const sessionParse = consumeOption(interactiveParse.rest, "--session");
        const cwdParse = consumeOption(sessionParse.rest, "--cwd");
        const titleParse = consumeOption(cwdParse.rest, "--title");
        const hostParse = consumeOption(titleParse.rest, "--host");
        assertNoExtraArgs(
          hostParse.rest,
          'Usage: "footprint context prepare [--session <id>] [--cwd <path>] [--title <text>] [--host <claude|gemini|codex>] [--interactive] [--json]"',
        );
        await prepareContextCli({
          json: jsonParse.json,
          interactive: interactiveParse.present,
          sessionId: sessionParse.value,
          cwd: cwdParse.value,
          title: titleParse.value,
          host: parseEnumValue(hostParse.value, sessionHosts, "--host"),
        });
        break;
      }

      if (subcommand === "confirm") {
        const jsonParse = parseJsonOption(args.slice(2));
        const contextParse = consumeOption(jsonParse.rest, "--context");
        const labelParse = consumeOption(contextParse.rest, "--label");
        const preferredParse = consumeFlag(labelParse.rest, "--set-preferred");
        if (preferredParse.rest.length === 0) {
          throw new Error(
            'Usage: "footprint context confirm <session-id> [<session-id> ...] [--context <context-id>] [--label <label>] [--set-preferred] [--json]"',
          );
        }
        confirmContextLinkCli({
          json: jsonParse.json,
          sessionIds: preferredParse.rest,
          contextId: contextParse.value,
          label: labelParse.value,
          setPreferred: preferredParse.present,
        });
        break;
      }

      if (subcommand === "reject") {
        const sessionId = args[2];
        if (!sessionId) {
          throw new Error(
            'Usage: "footprint context reject <session-id> --context <context-id> [--json]"',
          );
        }
        const jsonParse = parseJsonOption(args.slice(3));
        const contextParse = consumeOption(jsonParse.rest, "--context");
        if (!contextParse.value) {
          throw new Error(
            'Usage: "footprint context reject <session-id> --context <context-id> [--json]"',
          );
        }
        assertNoExtraArgs(
          contextParse.rest,
          'Usage: "footprint context reject <session-id> --context <context-id> [--json]"',
        );
        rejectContextLinkCli({
          json: jsonParse.json,
          sessionId,
          contextId: contextParse.value,
        });
        break;
      }

      if (subcommand === "move") {
        const sessionId = args[2];
        if (!sessionId) {
          throw new Error(
            'Usage: "footprint context move <session-id> [--context <context-id>] [--label <label>] [--set-preferred] [--json]"',
          );
        }
        const jsonParse = parseJsonOption(args.slice(3));
        const contextParse = consumeOption(jsonParse.rest, "--context");
        const labelParse = consumeOption(contextParse.rest, "--label");
        const preferredParse = consumeFlag(labelParse.rest, "--set-preferred");
        assertNoExtraArgs(
          preferredParse.rest,
          'Usage: "footprint context move <session-id> [--context <context-id>] [--label <label>] [--set-preferred] [--json]"',
        );
        moveSessionContextCli({
          json: jsonParse.json,
          sessionId,
          contextId: contextParse.value,
          label: labelParse.value,
          setPreferred: preferredParse.present,
        });
        break;
      }

      if (subcommand === "merge") {
        const sourceContextId = args[2];
        const targetContextId = args[3];
        if (!sourceContextId || !targetContextId) {
          throw new Error(
            'Usage: "footprint context merge <source-context-id> <target-context-id> [--json]"',
          );
        }
        const jsonParse = parseJsonOption(args.slice(4));
        assertNoExtraArgs(
          jsonParse.rest,
          'Usage: "footprint context merge <source-context-id> <target-context-id> [--json]"',
        );
        mergeContextsCli({
          json: jsonParse.json,
          sourceContextId,
          targetContextId,
        });
        break;
      }

      if (subcommand === "split") {
        const contextId = args[2];
        if (!contextId) {
          throw new Error(
            'Usage: "footprint context split <context-id> --sessions <id,id,...> [--label <label>] [--set-preferred] [--json]"',
          );
        }
        const jsonParse = parseJsonOption(args.slice(3));
        const sessionsParse = consumeOption(jsonParse.rest, "--sessions");
        const labelParse = consumeOption(sessionsParse.rest, "--label");
        const preferredParse = consumeFlag(labelParse.rest, "--set-preferred");
        if (!sessionsParse.value) {
          throw new Error(
            'Usage: "footprint context split <context-id> --sessions <id,id,...> [--label <label>] [--set-preferred] [--json]"',
          );
        }
        assertNoExtraArgs(
          preferredParse.rest,
          'Usage: "footprint context split <context-id> --sessions <id,id,...> [--label <label>] [--set-preferred] [--json]"',
        );
        splitContextCli({
          json: jsonParse.json,
          contextId,
          sessionIds: sessionsParse.value
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean),
          label: labelParse.value,
          setPreferred: preferredParse.present,
        });
        break;
      }

      if (subcommand === "activate") {
        const contextId = args[2];
        if (!contextId) {
          throw new Error(
            'Usage: "footprint context activate <context-id> [--cwd <path>] [--json]"',
          );
        }
        const jsonParse = parseJsonOption(args.slice(3));
        const cwdParse = consumeOption(jsonParse.rest, "--cwd");
        assertNoExtraArgs(
          cwdParse.rest,
          'Usage: "footprint context activate <context-id> [--cwd <path>] [--json]"',
        );
        setActiveContextCli({
          json: jsonParse.json,
          contextId,
          cwd: cwdParse.value,
        });
        break;
      }

      throw new Error(
        'Usage: "footprint context <show|resolve|prepare|confirm|reject|move|merge|split|activate> ..."',
      );
    }

    case "history": {
      if (args[1] === "search" && !args[2]) {
        throw new Error(
          'Usage: "footprint history search <query> [--host <claude|gemini|codex>] [--status <running|completed|failed|interrupted>] [--limit <n>] [--offset <n>] [--json]"',
        );
      }

      if (args[1] === "search" && args[2]) {
        const jsonParse = parseJsonOption(args.slice(3));
        const hostParse = consumeOption(jsonParse.rest, "--host");
        const statusParse = consumeOption(hostParse.rest, "--status");
        const limitParse = consumeOption(statusParse.rest, "--limit");
        const offsetParse = consumeOption(limitParse.rest, "--offset");
        assertNoExtraArgs(
          offsetParse.rest,
          'Usage: "footprint history search <query> [--host <claude|gemini|codex>] [--status <running|completed|failed|interrupted>] [--limit <n>] [--offset <n>] [--json]"',
        );

        searchHistoryCli(args[2], {
          json: jsonParse.json,
          host: parseEnumValue(hostParse.value, sessionHosts, "--host"),
          status: parseEnumValue(
            statusParse.value,
            sessionStatuses,
            "--status",
          ),
          limit: limitParse.value
            ? Number.parseInt(limitParse.value, 10)
            : undefined,
          offset: offsetParse.value
            ? Number.parseInt(offsetParse.value, 10)
            : undefined,
        });
        break;
      }

      if (args[1] === "handoff") {
        const jsonParse = parseJsonOption(args.slice(2));
        const queryParse = consumeOption(jsonParse.rest, "--query");
        const issueKeyParse = consumeOption(queryParse.rest, "--issue-key");
        const hostParse = consumeOption(issueKeyParse.rest, "--host");
        const statusParse = consumeOption(hostParse.rest, "--status");
        const groupByParse = consumeOption(statusParse.rest, "--group-by");
        assertNoExtraArgs(
          groupByParse.rest,
          'Usage: "footprint history handoff [--query <text>] [--issue-key <issue-key>] [--host <claude|gemini|codex>] [--status <running|completed|failed|interrupted>] [--group-by <issue|family>] [--json]"',
        );

        showHistoryHandoffCli({
          json: jsonParse.json,
          query: queryParse.value,
          issueKey: issueKeyParse.value,
          host: parseEnumValue(hostParse.value, sessionHosts, "--host"),
          status: parseEnumValue(
            statusParse.value,
            sessionStatuses,
            "--status",
          ),
          groupBy: parseEnumValue(
            groupByParse.value,
            historyTrendGroups,
            "--group-by",
          ),
        });
        break;
      }

      if (args[1] !== "trends") {
        throw new Error(
          'Usage: "footprint history <search|trends|handoff> ..."',
        );
      }

      const jsonParse = parseJsonOption(args.slice(2));
      const queryParse = consumeOption(jsonParse.rest, "--query");
      const issueKeyParse = consumeOption(queryParse.rest, "--issue-key");
      const hostParse = consumeOption(issueKeyParse.rest, "--host");
      const statusParse = consumeOption(hostParse.rest, "--status");
      const groupByParse = consumeOption(statusParse.rest, "--group-by");
      const limitParse = consumeOption(groupByParse.rest, "--limit");
      const offsetParse = consumeOption(limitParse.rest, "--offset");
      assertNoExtraArgs(
        offsetParse.rest,
        'Usage: "footprint history trends [--query <text>] [--issue-key <issue-key>] [--host <claude|gemini|codex>] [--status <running|completed|failed|interrupted>] [--group-by <issue|family>] [--limit <n>] [--offset <n>] [--json]"',
      );

      showHistoryTrendsCli({
        json: jsonParse.json,
        query: queryParse.value,
        issueKey: issueKeyParse.value,
        host: parseEnumValue(hostParse.value, sessionHosts, "--host"),
        status: parseEnumValue(statusParse.value, sessionStatuses, "--status"),
        groupBy: parseEnumValue(
          groupByParse.value,
          historyTrendGroups,
          "--group-by",
        ),
        limit: limitParse.value
          ? Number.parseInt(limitParse.value, 10)
          : undefined,
        offset: offsetParse.value
          ? Number.parseInt(offsetParse.value, 10)
          : undefined,
      });
      break;
    }

    case "list-sessions": {
      const jsonParse = parseJsonOption(args.slice(1));
      const queryParse = consumeOption(jsonParse.rest, "--query");
      const issueKeyParse = consumeOption(queryParse.rest, "--issue-key");
      const hostParse = consumeOption(issueKeyParse.rest, "--host");
      const statusParse = consumeOption(hostParse.rest, "--status");
      assertNoExtraArgs(
        statusParse.rest,
        'Usage: "footprint list-sessions [--query <text>] [--issue-key <issue-key>] [--host <claude|gemini|codex>] [--status <running|completed|failed|interrupted>] [--json]"',
      );
      listSessionsCli({
        json: jsonParse.json,
        query: queryParse.value,
        issueKey: issueKeyParse.value,
        host: parseEnumValue(hostParse.value, sessionHosts, "--host"),
        status: parseEnumValue(statusParse.value, sessionStatuses, "--status"),
      });
      break;
    }

    case "list-contexts": {
      const jsonParse = parseJsonOption(args.slice(1));
      assertNoExtraArgs(
        jsonParse.rest,
        'Usage: "footprint list-contexts [--json]"',
      );
      listContextsCli({ json: jsonParse.json });
      break;
    }

    case "get-context": {
      const contextId = args[1];
      if (!contextId) {
        throw new Error('Usage: "footprint get-context <context-id> [--json]"');
      }
      const jsonParse = parseJsonOption(args.slice(2));
      assertNoExtraArgs(
        jsonParse.rest,
        'Usage: "footprint get-context <context-id> [--json]"',
      );
      showContextCli(contextId, { json: jsonParse.json });
      break;
    }

    case "resolve-context": {
      const jsonParse = parseJsonOption(args.slice(1));
      const sessionParse = consumeOption(jsonParse.rest, "--session");
      const cwdParse = consumeOption(sessionParse.rest, "--cwd");
      const titleParse = consumeOption(cwdParse.rest, "--title");
      const hostParse = consumeOption(titleParse.rest, "--host");
      assertNoExtraArgs(
        hostParse.rest,
        'Usage: "footprint resolve-context [--session <id>] [--cwd <path>] [--title <text>] [--host <claude|gemini|codex>] [--json]"',
      );
      resolveContextCli({
        json: jsonParse.json,
        sessionId: sessionParse.value,
        cwd: cwdParse.value,
        title: titleParse.value,
        host: parseEnumValue(hostParse.value, sessionHosts, "--host"),
      });
      break;
    }

    case "prepare-context": {
      const jsonParse = parseJsonOption(args.slice(1));
      const interactiveParse = consumeFlag(jsonParse.rest, "--interactive");
      const sessionParse = consumeOption(interactiveParse.rest, "--session");
      const cwdParse = consumeOption(sessionParse.rest, "--cwd");
      const titleParse = consumeOption(cwdParse.rest, "--title");
      const hostParse = consumeOption(titleParse.rest, "--host");
      assertNoExtraArgs(
        hostParse.rest,
        'Usage: "footprint prepare-context [--session <id>] [--cwd <path>] [--title <text>] [--host <claude|gemini|codex>] [--interactive] [--json]"',
      );
      await prepareContextCli({
        json: jsonParse.json,
        interactive: interactiveParse.present,
        sessionId: sessionParse.value,
        cwd: cwdParse.value,
        title: titleParse.value,
        host: parseEnumValue(hostParse.value, sessionHosts, "--host"),
      });
      break;
    }

    case "confirm-context-link": {
      const jsonParse = parseJsonOption(args.slice(1));
      const contextParse = consumeOption(jsonParse.rest, "--context");
      const labelParse = consumeOption(contextParse.rest, "--label");
      const preferredParse = consumeFlag(labelParse.rest, "--set-preferred");
      if (preferredParse.rest.length === 0) {
        throw new Error(
          'Usage: "footprint confirm-context-link <session-id> [<session-id> ...] [--context <context-id>] [--label <label>] [--set-preferred] [--json]"',
        );
      }
      confirmContextLinkCli({
        json: jsonParse.json,
        sessionIds: preferredParse.rest,
        contextId: contextParse.value,
        label: labelParse.value,
        setPreferred: preferredParse.present,
      });
      break;
    }

    case "reject-context-link": {
      const sessionId = args[1];
      if (!sessionId) {
        throw new Error(
          'Usage: "footprint reject-context-link <session-id> --context <context-id> [--json]"',
        );
      }
      const jsonParse = parseJsonOption(args.slice(2));
      const contextParse = consumeOption(jsonParse.rest, "--context");
      if (!contextParse.value) {
        throw new Error(
          'Usage: "footprint reject-context-link <session-id> --context <context-id> [--json]"',
        );
      }
      assertNoExtraArgs(
        contextParse.rest,
        'Usage: "footprint reject-context-link <session-id> --context <context-id> [--json]"',
      );
      rejectContextLinkCli({
        json: jsonParse.json,
        sessionId,
        contextId: contextParse.value,
      });
      break;
    }

    case "move-session-context": {
      const sessionId = args[1];
      if (!sessionId) {
        throw new Error(
          'Usage: "footprint move-session-context <session-id> [--context <context-id>] [--label <label>] [--set-preferred] [--json]"',
        );
      }
      const jsonParse = parseJsonOption(args.slice(2));
      const contextParse = consumeOption(jsonParse.rest, "--context");
      const labelParse = consumeOption(contextParse.rest, "--label");
      const preferredParse = consumeFlag(labelParse.rest, "--set-preferred");
      assertNoExtraArgs(
        preferredParse.rest,
        'Usage: "footprint move-session-context <session-id> [--context <context-id>] [--label <label>] [--set-preferred] [--json]"',
      );
      moveSessionContextCli({
        json: jsonParse.json,
        sessionId,
        contextId: contextParse.value,
        label: labelParse.value,
        setPreferred: preferredParse.present,
      });
      break;
    }

    case "merge-contexts": {
      const sourceContextId = args[1];
      const targetContextId = args[2];
      if (!sourceContextId || !targetContextId) {
        throw new Error(
          'Usage: "footprint merge-contexts <source-context-id> <target-context-id> [--json]"',
        );
      }
      const jsonParse = parseJsonOption(args.slice(3));
      assertNoExtraArgs(
        jsonParse.rest,
        'Usage: "footprint merge-contexts <source-context-id> <target-context-id> [--json]"',
      );
      mergeContextsCli({
        json: jsonParse.json,
        sourceContextId,
        targetContextId,
      });
      break;
    }

    case "split-context": {
      const contextId = args[1];
      if (!contextId) {
        throw new Error(
          'Usage: "footprint split-context <context-id> --sessions <id,id,...> [--label <label>] [--set-preferred] [--json]"',
        );
      }
      const jsonParse = parseJsonOption(args.slice(2));
      const sessionsParse = consumeOption(jsonParse.rest, "--sessions");
      const labelParse = consumeOption(sessionsParse.rest, "--label");
      const preferredParse = consumeFlag(labelParse.rest, "--set-preferred");
      if (!sessionsParse.value) {
        throw new Error(
          'Usage: "footprint split-context <context-id> --sessions <id,id,...> [--label <label>] [--set-preferred] [--json]"',
        );
      }
      assertNoExtraArgs(
        preferredParse.rest,
        'Usage: "footprint split-context <context-id> --sessions <id,id,...> [--label <label>] [--set-preferred] [--json]"',
      );
      splitContextCli({
        json: jsonParse.json,
        contextId,
        sessionIds: sessionsParse.value
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        label: labelParse.value,
        setPreferred: preferredParse.present,
      });
      break;
    }

    case "set-active-context": {
      const contextId = args[1];
      if (!contextId) {
        throw new Error(
          'Usage: "footprint set-active-context <context-id> [--cwd <path>] [--json]"',
        );
      }
      const jsonParse = parseJsonOption(args.slice(2));
      const cwdParse = consumeOption(jsonParse.rest, "--cwd");
      assertNoExtraArgs(
        cwdParse.rest,
        'Usage: "footprint set-active-context <context-id> [--cwd <path>] [--json]"',
      );
      setActiveContextCli({
        json: jsonParse.json,
        contextId,
        cwd: cwdParse.value,
      });
      break;
    }

    case "get-session": {
      if (!args[1]) {
        throw new Error('Usage: "footprint get-session <id>"');
      }
      const jsonParse = parseJsonOption(args.slice(2));
      const messageLimitParse = consumeOption(
        jsonParse.rest,
        "--message-limit",
      );
      const messageOffsetParse = consumeOption(
        messageLimitParse.rest,
        "--message-offset",
      );
      const trendLimitParse = consumeOption(
        messageOffsetParse.rest,
        "--trend-limit",
      );
      const trendOffsetParse = consumeOption(
        trendLimitParse.rest,
        "--trend-offset",
      );
      const timelineLimitParse = consumeOption(
        trendOffsetParse.rest,
        "--timeline-limit",
      );
      const timelineOffsetParse = consumeOption(
        timelineLimitParse.rest,
        "--timeline-offset",
      );
      const artifactLimitParse = consumeOption(
        timelineOffsetParse.rest,
        "--artifact-limit",
      );
      const artifactOffsetParse = consumeOption(
        artifactLimitParse.rest,
        "--artifact-offset",
      );
      const narrativeLimitParse = consumeOption(
        artifactOffsetParse.rest,
        "--narrative-limit",
      );
      const narrativeOffsetParse = consumeOption(
        narrativeLimitParse.rest,
        "--narrative-offset",
      );
      const decisionLimitParse = consumeOption(
        narrativeOffsetParse.rest,
        "--decision-limit",
      );
      const decisionOffsetParse = consumeOption(
        decisionLimitParse.rest,
        "--decision-offset",
      );
      assertNoExtraArgs(
        decisionOffsetParse.rest,
        'Usage: "footprint get-session <id> [--message-limit <n>] [--message-offset <n>] [--trend-limit <n>] [--trend-offset <n>] [--timeline-limit <n>] [--timeline-offset <n>] [--artifact-limit <n>] [--artifact-offset <n>] [--narrative-limit <n>] [--narrative-offset <n>] [--decision-limit <n>] [--decision-offset <n>] [--json]"',
      );
      showSessionCli(args[1], {
        json: jsonParse.json,
        messageLimit: parseIntegerOption(
          messageLimitParse.value,
          "--message-limit",
        ),
        messageOffset: parseIntegerOption(
          messageOffsetParse.value,
          "--message-offset",
        ),
        trendLimit: parseIntegerOption(trendLimitParse.value, "--trend-limit"),
        trendOffset: parseIntegerOption(
          trendOffsetParse.value,
          "--trend-offset",
        ),
        timelineLimit: parseIntegerOption(
          timelineLimitParse.value,
          "--timeline-limit",
        ),
        timelineOffset: parseIntegerOption(
          timelineOffsetParse.value,
          "--timeline-offset",
        ),
        artifactLimit: parseIntegerOption(
          artifactLimitParse.value,
          "--artifact-limit",
        ),
        artifactOffset: parseIntegerOption(
          artifactOffsetParse.value,
          "--artifact-offset",
        ),
        narrativeLimit: parseIntegerOption(
          narrativeLimitParse.value,
          "--narrative-limit",
        ),
        narrativeOffset: parseIntegerOption(
          narrativeOffsetParse.value,
          "--narrative-offset",
        ),
        decisionLimit: parseIntegerOption(
          decisionLimitParse.value,
          "--decision-limit",
        ),
        decisionOffset: parseIntegerOption(
          decisionOffsetParse.value,
          "--decision-offset",
        ),
      });
      break;
    }

    case "export-sessions": {
      const jsonParse = parseJsonOption(args.slice(1));
      const queryParse = consumeOption(jsonParse.rest, "--query");
      const issueKeyParse = consumeOption(queryParse.rest, "--issue-key");
      const hostParse = consumeOption(issueKeyParse.rest, "--host");
      const statusParse = consumeOption(hostParse.rest, "--status");
      const groupByParse = consumeOption(statusParse.rest, "--group-by");
      const outputModeParse = consumeOption(groupByParse.rest, "--output-mode");
      await exportSessionsCli(outputModeParse.rest, {
        json: jsonParse.json,
        query: queryParse.value,
        issueKey: issueKeyParse.value,
        host: parseEnumValue(hostParse.value, sessionHosts, "--host"),
        status: parseEnumValue(statusParse.value, sessionStatuses, "--status"),
        groupBy: parseEnumValue(
          groupByParse.value,
          historyTrendGroups,
          "--group-by",
        ),
        outputMode: parseEnumValue(
          outputModeParse.value,
          exportOutputModes,
          "--output-mode",
        ),
      });
      break;
    }

    case "get-session-messages": {
      if (!args[1]) {
        throw new Error(
          'Usage: "footprint get-session-messages <id> [--limit <n>] [--offset <n>] [--json]"',
        );
      }
      const jsonParse = parseJsonOption(args.slice(2));
      const limitParse = consumeOption(jsonParse.rest, "--limit");
      const offsetParse = consumeOption(limitParse.rest, "--offset");
      assertNoExtraArgs(
        offsetParse.rest,
        'Usage: "footprint get-session-messages <id> [--limit <n>] [--offset <n>] [--json]"',
      );
      showSessionMessagesCli(args[1], {
        json: jsonParse.json,
        limit: parseIntegerOption(limitParse.value, "--limit"),
        offset: parseIntegerOption(offsetParse.value, "--offset"),
      });
      break;
    }

    case "get-session-timeline": {
      if (!args[1]) {
        throw new Error(
          'Usage: "footprint get-session-timeline <id> [--limit <n>] [--offset <n>] [--json]"',
        );
      }
      const jsonParse = parseJsonOption(args.slice(2));
      const limitParse = consumeOption(jsonParse.rest, "--limit");
      const offsetParse = consumeOption(limitParse.rest, "--offset");
      assertNoExtraArgs(
        offsetParse.rest,
        'Usage: "footprint get-session-timeline <id> [--limit <n>] [--offset <n>] [--json]"',
      );
      showSessionTimelineCli(args[1], {
        json: jsonParse.json,
        limit: parseIntegerOption(limitParse.value, "--limit"),
        offset: parseIntegerOption(offsetParse.value, "--offset"),
      });
      break;
    }

    case "get-session-trends": {
      if (!args[1]) {
        throw new Error(
          'Usage: "footprint get-session-trends <id> [--limit <n>] [--offset <n>] [--json]"',
        );
      }
      const jsonParse = parseJsonOption(args.slice(2));
      const limitParse = consumeOption(jsonParse.rest, "--limit");
      const offsetParse = consumeOption(limitParse.rest, "--offset");
      assertNoExtraArgs(
        offsetParse.rest,
        'Usage: "footprint get-session-trends <id> [--limit <n>] [--offset <n>] [--json]"',
      );
      showSessionTrendsCli(args[1], {
        json: jsonParse.json,
        limit: parseIntegerOption(limitParse.value, "--limit"),
        offset: parseIntegerOption(offsetParse.value, "--offset"),
      });
      break;
    }

    case "get-session-artifacts": {
      if (!args[1]) {
        throw new Error(
          'Usage: "footprint get-session-artifacts <id> [--type <file-change|command-output|test-result|git-commit>] [--limit <n>] [--offset <n>] [--json]"',
        );
      }
      const jsonParse = parseJsonOption(args.slice(2));
      const typeParse = consumeOption(jsonParse.rest, "--type");
      const limitParse = consumeOption(typeParse.rest, "--limit");
      const offsetParse = consumeOption(limitParse.rest, "--offset");
      assertNoExtraArgs(
        offsetParse.rest,
        'Usage: "footprint get-session-artifacts <id> [--type <file-change|command-output|test-result|git-commit>] [--limit <n>] [--offset <n>] [--json]"',
      );
      showSessionArtifactsCli(args[1], {
        json: jsonParse.json,
        artifactType: parseEnumValue(typeParse.value, artifactTypes, "--type"),
        limit: parseIntegerOption(limitParse.value, "--limit"),
        offset: parseIntegerOption(offsetParse.value, "--offset"),
      });
      break;
    }

    case "get-session-narrative": {
      if (!args[1]) {
        throw new Error(
          'Usage: "footprint get-session-narrative <id> [--kind <journal|project-summary|handoff>] [--limit <n>] [--offset <n>] [--json]"',
        );
      }
      const jsonParse = parseJsonOption(args.slice(2));
      const kindParse = consumeOption(jsonParse.rest, "--kind");
      const limitParse = consumeOption(kindParse.rest, "--limit");
      const offsetParse = consumeOption(limitParse.rest, "--offset");
      assertNoExtraArgs(
        offsetParse.rest,
        'Usage: "footprint get-session-narrative <id> [--kind <journal|project-summary|handoff>] [--limit <n>] [--offset <n>] [--json]"',
      );
      showSessionNarrativesCli(args[1], {
        json: jsonParse.json,
        kind: parseEnumValue(kindParse.value, narrativeKinds, "--kind"),
        limit: parseIntegerOption(limitParse.value, "--limit"),
        offset: parseIntegerOption(offsetParse.value, "--offset"),
      });
      break;
    }

    case "get-session-decisions": {
      if (!args[1]) {
        throw new Error(
          'Usage: "footprint get-session-decisions <id> [--limit <n>] [--offset <n>] [--json]"',
        );
      }
      const jsonParse = parseJsonOption(args.slice(2));
      const limitParse = consumeOption(jsonParse.rest, "--limit");
      const offsetParse = consumeOption(limitParse.rest, "--offset");
      assertNoExtraArgs(
        offsetParse.rest,
        'Usage: "footprint get-session-decisions <id> [--limit <n>] [--offset <n>] [--json]"',
      );
      showSessionDecisionsCli(args[1], {
        json: jsonParse.json,
        limit: parseIntegerOption(limitParse.value, "--limit"),
        offset: parseIntegerOption(offsetParse.value, "--offset"),
      });
      break;
    }

    case "search-history": {
      if (!args[1]) {
        throw new Error(
          'Usage: "footprint search-history <query> [--host <claude|gemini|codex>] [--status <running|completed|failed|interrupted>] [--limit <n>] [--offset <n>] [--json]"',
        );
      }
      const jsonParse = parseJsonOption(args.slice(2));
      const hostParse = consumeOption(jsonParse.rest, "--host");
      const statusParse = consumeOption(hostParse.rest, "--status");
      const limitParse = consumeOption(statusParse.rest, "--limit");
      const offsetParse = consumeOption(limitParse.rest, "--offset");
      assertNoExtraArgs(
        offsetParse.rest,
        'Usage: "footprint search-history <query> [--host <claude|gemini|codex>] [--status <running|completed|failed|interrupted>] [--limit <n>] [--offset <n>] [--json]"',
      );

      searchHistoryCli(args[1], {
        json: jsonParse.json,
        host: parseEnumValue(hostParse.value, sessionHosts, "--host"),
        status: parseEnumValue(statusParse.value, sessionStatuses, "--status"),
        limit: limitParse.value
          ? Number.parseInt(limitParse.value, 10)
          : undefined,
        offset: offsetParse.value
          ? Number.parseInt(offsetParse.value, 10)
          : undefined,
      });
      break;
    }

    case "get-history-trends": {
      const jsonParse = parseJsonOption(args.slice(1));
      const queryParse = consumeOption(jsonParse.rest, "--query");
      const issueKeyParse = consumeOption(queryParse.rest, "--issue-key");
      const hostParse = consumeOption(issueKeyParse.rest, "--host");
      const statusParse = consumeOption(hostParse.rest, "--status");
      const groupByParse = consumeOption(statusParse.rest, "--group-by");
      const limitParse = consumeOption(groupByParse.rest, "--limit");
      const offsetParse = consumeOption(limitParse.rest, "--offset");
      assertNoExtraArgs(
        offsetParse.rest,
        'Usage: "footprint get-history-trends [--query <text>] [--issue-key <issue-key>] [--host <claude|gemini|codex>] [--status <running|completed|failed|interrupted>] [--group-by <issue|family>] [--limit <n>] [--offset <n>] [--json]"',
      );

      showHistoryTrendsCli({
        json: jsonParse.json,
        query: queryParse.value,
        issueKey: issueKeyParse.value,
        host: parseEnumValue(hostParse.value, sessionHosts, "--host"),
        status: parseEnumValue(statusParse.value, sessionStatuses, "--status"),
        groupBy: parseEnumValue(
          groupByParse.value,
          historyTrendGroups,
          "--group-by",
        ),
        limit: limitParse.value
          ? Number.parseInt(limitParse.value, 10)
          : undefined,
        offset: offsetParse.value
          ? Number.parseInt(offsetParse.value, 10)
          : undefined,
      });
      break;
    }

    case "get-history-handoff": {
      const jsonParse = parseJsonOption(args.slice(1));
      const queryParse = consumeOption(jsonParse.rest, "--query");
      const issueKeyParse = consumeOption(queryParse.rest, "--issue-key");
      const hostParse = consumeOption(issueKeyParse.rest, "--host");
      const statusParse = consumeOption(hostParse.rest, "--status");
      const groupByParse = consumeOption(statusParse.rest, "--group-by");
      assertNoExtraArgs(
        groupByParse.rest,
        'Usage: "footprint get-history-handoff [--query <text>] [--issue-key <issue-key>] [--host <claude|gemini|codex>] [--status <running|completed|failed|interrupted>] [--group-by <issue|family>] [--json]"',
      );

      showHistoryHandoffCli({
        json: jsonParse.json,
        query: queryParse.value,
        issueKey: issueKeyParse.value,
        host: parseEnumValue(hostParse.value, sessionHosts, "--host"),
        status: parseEnumValue(statusParse.value, sessionStatuses, "--status"),
        groupBy: parseEnumValue(
          groupByParse.value,
          historyTrendGroups,
          "--group-by",
        ),
      });
      break;
    }

    default: {
      // No command or unknown command - start MCP server
      // Import and run server
      const { main: startServer } = await import("../index.js");
      await startServer();
      break;
    }
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
