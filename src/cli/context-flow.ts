/* global process */

import { createInterface } from "node:readline/promises";
import {
  confirmContextLink,
  getContextReport,
  listContexts,
  mergeContexts,
  moveSessionContext,
  rejectContextLink,
  resolveContext,
  setActiveContext,
  splitContext,
} from "../lib/context-memory.js";
import { truncateSummary } from "../lib/session-history.js";
import {
  EvidenceDatabase,
  type ContextLinkSource,
  type SessionHost,
} from "../lib/storage/index.js";
import {
  appendTimelineEvent,
  ensureParentDir,
  resolveDbPath,
} from "./session-execution.js";
import {
  printContextBriefing,
  printJson,
  printSection,
} from "./session-display.js";

type PromptReader = ReturnType<typeof createInterface>;

export type ContextActionStatus =
  | "confirmed"
  | "preferred"
  | "skipped"
  | "none"
  | "used-linked"
  | "used-preferred"
  | "create-new";

export interface PreparedContextSelection {
  action: ContextActionStatus;
  contextId: string | null;
  report: ReturnType<typeof getContextReport> | null;
  note: string;
  contextLabel: string | null;
  relatedSessionIds: string[];
}

function canPromptInteractively(forceInteractive?: boolean): boolean {
  return Boolean(
    forceInteractive || (process.stdin.isTTY && process.stderr.isTTY),
  );
}

function shouldAskFollowUpQuestion(): boolean {
  return Boolean(process.stdin.isTTY && process.stderr.isTTY);
}

async function promptChoice(options: {
  reader: PromptReader;
  title: string;
  choices: Array<{ key: string; label: string }>;
}): Promise<string> {
  process.stderr.write(`\n${options.title}\n`);
  options.choices.forEach((choice, index) => {
    process.stderr.write(`  ${index + 1}. ${choice.label}\n`);
  });

  while (true) {
    const answer = (await options.reader.question("Select an option: ")).trim();
    const numeric = Number.parseInt(answer, 10);
    if (
      Number.isInteger(numeric) &&
      numeric >= 1 &&
      numeric <= options.choices.length
    ) {
      return options.choices[numeric - 1]!.key;
    }

    const direct = options.choices.find(
      (choice) => choice.key.toLowerCase() === answer.toLowerCase(),
    );
    if (direct) {
      return direct.key;
    }

    process.stderr.write("Invalid choice. Enter the number shown above.\n");
  }
}

async function promptOptionalText(
  reader: PromptReader,
  prompt: string,
): Promise<string | null> {
  const answer = (await reader.question(`${prompt}: `)).trim();
  return answer || null;
}

export function listContextsCli(options?: { json?: boolean }): void {
  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);
  const db = new EvidenceDatabase(dbPath);

  try {
    const result = listContexts(db);
    if (options?.json) {
      printJson(result);
      return;
    }

    console.log(`Contexts: ${result.contexts.length}`);
    for (const context of result.contexts) {
      console.log(
        `${context.id} | ${context.label} | sessions ${context.sessionCount} | latest ${context.latestSessionLabel}`,
      );
    }
  } finally {
    db.close();
  }
}

export function showContextCli(id: string, options?: { json?: boolean }): void {
  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);
  const db = new EvidenceDatabase(dbPath);

  try {
    const report = getContextReport(db, id);
    if (options?.json) {
      printJson(report);
      return;
    }

    printContextBriefing(report);
  } finally {
    db.close();
  }
}

export function appendContextTimelineEvent(
  db: EvidenceDatabase,
  sessionId: string,
  eventSeq: number,
  input: {
    eventType: string;
    summary: string;
    payload?: Record<string, unknown>;
    status?: string;
  },
): number {
  return appendTimelineEvent(db, {
    sessionId,
    eventSeq,
    eventType: input.eventType,
    source: "wrapper",
    summary: input.summary,
    payload: input.payload,
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    status: input.status,
  });
}

async function applyInteractiveContextSelection(
  db: EvidenceDatabase,
  resolution: ReturnType<typeof resolveContext>,
  options: {
    sessionId?: string;
    cwd?: string;
    allowInteractive: boolean;
    defaultNewContextLabel?: string | null;
    linkSource?: ContextLinkSource;
    promptReader?: PromptReader | null;
  },
): Promise<{
  action:
    | "confirmed"
    | "preferred"
    | "skipped"
    | "none"
    | "used-linked"
    | "used-preferred";
  contextId: string | null;
  report: ReturnType<typeof getContextReport> | null;
  note: string;
  relatedSessionIds: string[];
}> {
  if (
    resolution.mode === "linked" &&
    resolution.currentContext &&
    resolution.briefing
  ) {
    return {
      action: "used-linked",
      contextId: resolution.currentContext.id,
      report: resolution.briefing,
      note: "Session already linked to a confirmed context.",
      relatedSessionIds: [],
    };
  }

  if (
    resolution.mode === "preferred" &&
    resolution.currentContext &&
    resolution.briefing
  ) {
    return {
      action: "used-preferred",
      contextId: resolution.currentContext.id,
      report: resolution.briefing,
      note: "Using the preferred context for this workspace.",
      relatedSessionIds: [],
    };
  }

  if (!options.allowInteractive) {
    return {
      action: resolution.candidates.length === 0 ? "none" : "skipped",
      contextId: null,
      report: resolution.briefing,
      note:
        resolution.candidates.length === 0
          ? "No strong context candidate was found."
          : "Context confirmation is required; rerun with interactive mode to confirm or correct the link.",
      relatedSessionIds: [],
    };
  }

  if (!options.promptReader) {
    throw new Error("Interactive context selection requires a prompt reader");
  }

  const choices = resolution.candidates.map((candidate, index) => ({
    key: `candidate:${index}`,
    label: `${candidate.label} [${candidate.kind}] | ${candidate.confidence} | ${candidate.reasons.join(", ") || "no reasons"}`,
  }));

  if (options.sessionId) {
    choices.push({
      key: "create:new",
      label: "Create a new canonical context for this session",
    });
  } else if (
    resolution.candidates.some(
      (candidate) => candidate.kind === "existing-context",
    )
  ) {
    choices.push({
      key: "use:preferred",
      label:
        "Set one of the candidate contexts as the preferred active context for this workspace",
    });
  }

  choices.push({
    key: "skip",
    label: "Skip for now and leave the session/context unchanged",
  });

  const choice = await promptChoice({
    reader: options.promptReader,
    title:
      "Footprint found possible contexts. Confirm how this work should be grouped.",
    choices,
  });

  if (choice === "skip") {
    return {
      action: "skipped",
      contextId: null,
      report: resolution.briefing,
      note: "Left the session unlinked for now.",
      relatedSessionIds: [],
    };
  }

  if (choice === "use:preferred") {
    const existingCandidates = resolution.candidates.filter(
      (candidate) =>
        candidate.kind === "existing-context" && candidate.contextId,
    );
    if (existingCandidates.length === 0) {
      return {
        action: "none",
        contextId: null,
        report: resolution.briefing,
        note: "No existing context candidate is available to set as preferred.",
        relatedSessionIds: [],
      };
    }
    const preferredChoice = await promptChoice({
      reader: options.promptReader,
      title: "Choose the preferred context for this workspace",
      choices: existingCandidates.map((candidate, index) => ({
        key: `preferred:${index}`,
        label: `${candidate.label} | ${candidate.reasons.join(", ") || "no reasons"}`,
      })),
    });
    const preferredIndex = Number.parseInt(
      preferredChoice.split(":")[1] ?? "-1",
      10,
    );
    const selected = existingCandidates[preferredIndex];
    if (!selected?.contextId) {
      throw new Error("Invalid preferred context choice");
    }
    const result = setActiveContext(db, selected.contextId, options.cwd);
    return {
      action: "preferred",
      contextId: result.contextId,
      report: result.contextId ? getContextReport(db, result.contextId) : null,
      note: "Updated the preferred context for this workspace.",
      relatedSessionIds: [],
    };
  }

  if (choice === "create:new") {
    if (!options.sessionId) {
      throw new Error("A sessionId is required to create a new context here");
    }
    const label = shouldAskFollowUpQuestion()
      ? ((await promptOptionalText(
          options.promptReader,
          "New context label (leave blank to use the session title)",
        )) ??
        options.defaultNewContextLabel ??
        undefined)
      : (options.defaultNewContextLabel ?? undefined);
    const result = confirmContextLink(db, {
      sessionIds: [options.sessionId],
      label,
      linkSource: options.linkSource ?? "confirmed",
    });
    return {
      action: "confirmed",
      contextId: result.contextId,
      report: result.contextId ? getContextReport(db, result.contextId) : null,
      note: "Created a new canonical context for this session.",
      relatedSessionIds: [],
    };
  }

  const candidateIndex = Number.parseInt(choice.split(":")[1] ?? "-1", 10);
  const candidate = resolution.candidates[candidateIndex];
  if (!candidate) {
    throw new Error("Invalid context candidate choice");
  }

  if (candidate.kind === "existing-context" && candidate.contextId) {
    if (options.sessionId) {
      const result = confirmContextLink(db, {
        sessionIds: [options.sessionId],
        contextId: candidate.contextId,
        linkSource: options.linkSource ?? "confirmed",
      });
      return {
        action: "confirmed",
        contextId: result.contextId,
        report: result.contextId
          ? getContextReport(db, result.contextId)
          : null,
        note: "Confirmed the suggested existing context.",
        relatedSessionIds: [],
      };
    }

    const result = setActiveContext(db, candidate.contextId, options.cwd);
    return {
      action: "preferred",
      contextId: result.contextId,
      report: result.contextId ? getContextReport(db, result.contextId) : null,
      note: "Set the selected context as preferred for this workspace.",
      relatedSessionIds: [],
    };
  }

  if (candidate.kind === "new-context") {
    if (!options.sessionId) {
      return {
        action: "none",
        contextId: null,
        report: null,
        note: "A session must exist before Footprint can confirm a new context from related sessions.",
        relatedSessionIds: [],
      };
    }
    const label = shouldAskFollowUpQuestion()
      ? ((await promptOptionalText(
          options.promptReader,
          "New context label (leave blank to use the suggested session title)",
        )) ??
        options.defaultNewContextLabel ??
        undefined)
      : (options.defaultNewContextLabel ?? undefined);
    const sessionIds = candidate.sessionIds.includes(options.sessionId)
      ? candidate.sessionIds
      : [options.sessionId, ...candidate.sessionIds];
    const result = confirmContextLink(db, {
      sessionIds,
      label,
      linkSource: options.linkSource ?? "confirmed",
    });
    return {
      action: "confirmed",
      contextId: result.contextId,
      report: result.contextId ? getContextReport(db, result.contextId) : null,
      note: "Created a new canonical context from the suggested related sessions.",
      relatedSessionIds: sessionIds,
    };
  }

  return {
    action: "none",
    contextId: null,
    report: resolution.briefing,
    note: "No context change was applied.",
    relatedSessionIds: [],
  };
}

async function prepareContextFlow(
  db: EvidenceDatabase,
  options: {
    sessionId?: string;
    cwd?: string;
    title?: string;
    host?: SessionHost;
    interactive?: boolean;
    printTo?: "stdout" | "stderr";
    linkSource?: ContextLinkSource;
    verbose?: boolean;
  },
): Promise<{
  resolution: ReturnType<typeof resolveContext>;
  action:
    | "confirmed"
    | "preferred"
    | "skipped"
    | "none"
    | "used-linked"
    | "used-preferred";
  contextId: string | null;
  report: ReturnType<typeof getContextReport> | null;
  note: string;
}> {
  const writeLine =
    options.printTo === "stderr"
      ? (line: string) => process.stderr.write(`${line}\n`)
      : (line: string) => console.log(line);
  let titleHint = options.title?.trim() || undefined;
  const allowInteractive = canPromptInteractively(options.interactive);
  const promptReader = allowInteractive
    ? createInterface({
        input: process.stdin,
        output: process.stderr,
        terminal: Boolean(process.stdin.isTTY && process.stderr.isTTY),
      })
    : null;

  try {
    if (options.sessionId && titleHint) {
      db.updateSessionTitle(options.sessionId, truncateSummary(titleHint));
    }

    let resolution = resolveContext(db, {
      sessionId: options.sessionId,
      cwd: options.cwd,
      title: titleHint,
      host: options.host,
    });

    if (
      options.sessionId &&
      allowInteractive &&
      resolution.mode === "none" &&
      !titleHint &&
      promptReader
    ) {
      const hintedTitle = await promptOptionalText(
        promptReader,
        "Short task summary for context matching (leave blank to skip)",
      );
      if (hintedTitle) {
        titleHint = hintedTitle;
        db.updateSessionTitle(options.sessionId, truncateSummary(hintedTitle));
        resolution = resolveContext(db, {
          sessionId: options.sessionId,
          cwd: options.cwd,
          title: hintedTitle,
          host: options.host,
        });
      }
    }

    if (options.verbose !== false) {
      writeLine(`Context mode: ${resolution.mode}`);
      writeLine(
        `Confirmation required: ${resolution.confirmationRequired ? "yes" : "no"}`,
      );
      writeLine(`Recommended action: ${resolution.recommendedAction}`);
      if (resolution.currentContext) {
        writeLine(
          `Current context: ${resolution.currentContext.id} | ${resolution.currentContext.label}`,
        );
      }
      if (resolution.candidates.length > 0) {
        printSection(
          "Context Candidates",
          resolution.candidates.map(
            (candidate) =>
              `${candidate.label} | ${candidate.kind} | ${candidate.confidence} (${candidate.confidenceScore}) | ${candidate.reasons.join(", ") || "no reasons"}`,
          ),
          writeLine,
        );
      }
    }

    const applied = await applyInteractiveContextSelection(db, resolution, {
      sessionId: options.sessionId,
      cwd: options.cwd,
      allowInteractive,
      defaultNewContextLabel: titleHint ?? null,
      linkSource: options.linkSource,
      promptReader,
    });

    if (options.verbose !== false) {
      writeLine(applied.note);
    }
    if (applied.report && options.verbose !== false) {
      writeLine("");
      writeLine("Context Briefing:");
      printContextBriefing(applied.report, writeLine);
    }

    return {
      resolution,
      action: applied.action,
      contextId: applied.contextId,
      report: applied.report,
      note: applied.note,
    };
  } finally {
    promptReader?.close();
  }
}

function buildPendingContextChoices(
  resolution: ReturnType<typeof resolveContext>,
): Array<{
  key: string;
  label: string;
  kind: "existing-context" | "new-context";
  contextId: string | null;
  report: ReturnType<typeof getContextReport> | null;
  sessionIds: string[];
}> {
  const choices = resolution.candidates.map((candidate, index) => ({
    key: `candidate:${index}`,
    label: `${candidate.label} [${candidate.kind}] | ${candidate.confidence} | ${candidate.reasons.join(", ") || "no reasons"}`,
    kind: candidate.kind,
    contextId: candidate.contextId,
    report:
      candidate.kind === "existing-context" &&
      candidate.contextId &&
      resolution.briefing?.context.id === candidate.contextId
        ? resolution.briefing
        : null,
    sessionIds: candidate.sessionIds,
  }));

  if (
    resolution.mode === "preferred" &&
    resolution.currentContext &&
    !choices.some(
      (choice) => choice.contextId === resolution.currentContext?.id,
    )
  ) {
    choices.unshift({
      key: "preferred:current",
      label: `${resolution.currentContext.label} [existing-context] | high | preferred workspace context`,
      kind: "existing-context",
      contextId: resolution.currentContext.id,
      report: resolution.briefing,
      sessionIds: [],
    });
  }

  return choices;
}

export async function preparePendingRunContextFlow(
  db: EvidenceDatabase,
  options: {
    cwd: string;
    title?: string;
    host: SessionHost;
    interactive?: boolean;
    printTo?: "stdout" | "stderr";
    verbose?: boolean;
  },
): Promise<{
  resolution: ReturnType<typeof resolveContext>;
  action: ContextActionStatus;
  contextId: string | null;
  report: ReturnType<typeof getContextReport> | null;
  note: string;
  title: string | null;
  contextLabel: string | null;
  relatedSessionIds: string[];
}> {
  const writeLine =
    options.printTo === "stderr"
      ? (line: string) => process.stderr.write(`${line}\n`)
      : (line: string) => console.log(line);
  let titleHint = options.title?.trim() || undefined;
  const allowInteractive = canPromptInteractively(options.interactive);
  const promptReader = allowInteractive
    ? createInterface({
        input: process.stdin,
        output: process.stderr,
        terminal: Boolean(process.stdin.isTTY && process.stderr.isTTY),
      })
    : null;

  try {
    let resolution = resolveContext(db, {
      cwd: options.cwd,
      title: titleHint,
      host: options.host,
    });

    if (
      allowInteractive &&
      resolution.mode === "none" &&
      !titleHint &&
      promptReader
    ) {
      const hintedTitle = await promptOptionalText(
        promptReader,
        "Short task summary for context matching (leave blank to skip)",
      );
      if (hintedTitle) {
        titleHint = hintedTitle;
        resolution = resolveContext(db, {
          cwd: options.cwd,
          title: hintedTitle,
          host: options.host,
        });
      }
    }

    if (options.verbose !== false) {
      writeLine(`Context mode: ${resolution.mode}`);
      writeLine(
        `Confirmation required: ${resolution.confirmationRequired ? "yes" : "no"}`,
      );
      writeLine(`Recommended action: ${resolution.recommendedAction}`);
      if (resolution.currentContext) {
        writeLine(
          `Current context: ${resolution.currentContext.id} | ${resolution.currentContext.label}`,
        );
      }
      if (resolution.candidates.length > 0) {
        printSection(
          "Context Candidates",
          resolution.candidates.map(
            (candidate) =>
              `${candidate.label} | ${candidate.kind} | ${candidate.confidence} (${candidate.confidenceScore}) | ${candidate.reasons.join(", ") || "no reasons"}`,
          ),
          writeLine,
        );
      }
    }

    const pendingChoices = buildPendingContextChoices(resolution);
    if (!allowInteractive) {
      return {
        resolution,
        action:
          resolution.mode === "preferred" && resolution.currentContext
            ? "used-preferred"
            : pendingChoices.length === 0
              ? "none"
              : "skipped",
        contextId:
          resolution.mode === "preferred" && resolution.currentContext
            ? resolution.currentContext.id
            : null,
        report:
          resolution.mode === "preferred" && resolution.currentContext
            ? resolution.briefing
            : null,
        note:
          resolution.mode === "preferred" && resolution.currentContext
            ? "Using the preferred context for this workspace."
            : pendingChoices.length === 0
              ? "No strong context candidate was found."
              : "Context confirmation is required; rerun with interactive mode to confirm or correct the link.",
        title: titleHint ?? null,
        contextLabel: null,
        relatedSessionIds: [],
      };
    }

    if (!promptReader) {
      throw new Error(
        "Interactive context preparation requires a prompt reader",
      );
    }

    const choice = await promptChoice({
      reader: promptReader,
      title:
        "Footprint found possible contexts. Confirm how this work should be grouped.",
      choices: [
        ...pendingChoices.map((candidate) => ({
          key: candidate.key,
          label: candidate.label,
        })),
        {
          key: "create:new",
          label: "Create a new canonical context for this session",
        },
        {
          key: "skip",
          label: "Skip for now and leave the session unlinked",
        },
      ],
    });

    let prepared: PreparedContextSelection;
    if (choice === "skip") {
      prepared = {
        action: "skipped",
        contextId: null,
        report: resolution.briefing,
        note: "Left the session unlinked for now.",
        contextLabel: null,
        relatedSessionIds: [],
      };
    } else if (choice === "create:new") {
      const label = shouldAskFollowUpQuestion()
        ? ((await promptOptionalText(
            promptReader,
            "New context label (leave blank to use the session title)",
          )) ??
          titleHint ??
          null)
        : (titleHint ?? null);
      prepared = {
        action: "create-new",
        contextId: null,
        report: null,
        note: "Will create a new canonical context for this session.",
        contextLabel: label,
        relatedSessionIds: [],
      };
    } else {
      const selected = pendingChoices.find(
        (candidate) => candidate.key === choice,
      );
      if (!selected) {
        throw new Error("Invalid pending context choice");
      }

      prepared =
        selected.kind === "existing-context" && selected.contextId
          ? {
              action:
                resolution.mode === "preferred"
                  ? "used-preferred"
                  : "confirmed",
              contextId: selected.contextId,
              report:
                selected.report ?? getContextReport(db, selected.contextId),
              note:
                resolution.mode === "preferred"
                  ? "Using the preferred context for this workspace."
                  : "Confirmed the suggested existing context.",
              contextLabel: null,
              relatedSessionIds: [],
            }
          : {
              action: "create-new",
              contextId: null,
              report: null,
              note: "Will create a new canonical context from the suggested related sessions.",
              contextLabel: shouldAskFollowUpQuestion()
                ? ((await promptOptionalText(
                    promptReader,
                    "New context label (leave blank to use the suggested session title)",
                  )) ??
                  titleHint ??
                  selected.label)
                : (titleHint ?? selected.label),
              relatedSessionIds: selected.sessionIds,
            };
    }

    if (options.verbose !== false) {
      writeLine(prepared.note);
    }
    if (prepared.report && options.verbose !== false) {
      writeLine("");
      writeLine("Context Briefing:");
      printContextBriefing(prepared.report, writeLine);
    }

    return {
      resolution,
      action: prepared.action,
      contextId: prepared.contextId,
      report: prepared.report,
      note: prepared.note,
      title: titleHint ?? null,
      contextLabel: prepared.contextLabel,
      relatedSessionIds: prepared.relatedSessionIds,
    };
  } finally {
    promptReader?.close();
  }
}

export function resolveContextCli(options: {
  json?: boolean;
  sessionId?: string;
  cwd?: string;
  title?: string;
  host?: SessionHost;
}): void {
  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);
  const db = new EvidenceDatabase(dbPath);

  try {
    const result = resolveContext(db, options);
    if (options.json) {
      printJson(result);
      return;
    }

    console.log(`Mode: ${result.mode}`);
    console.log(
      `Confirmation required: ${result.confirmationRequired ? "yes" : "no"}`,
    );
    console.log(`Recommended action: ${result.recommendedAction}`);
    if (result.currentContext) {
      console.log(
        `Current context: ${result.currentContext.id} | ${result.currentContext.label}`,
      );
    }
    if (result.briefing) {
      printSection("Current Truth", [result.briefing.currentTruth.summary]);
    }
    if (result.candidates.length > 0) {
      printSection(
        "Candidates",
        result.candidates.map(
          (candidate) =>
            `${candidate.kind} | ${candidate.label} | ${candidate.confidence} (${candidate.confidenceScore}) | ${candidate.reasons.join(", ") || "no reasons"}`,
        ),
      );
    }
  } finally {
    db.close();
  }
}

export async function prepareContextCli(options: {
  json?: boolean;
  sessionId?: string;
  cwd?: string;
  title?: string;
  host?: SessionHost;
  interactive?: boolean;
}): Promise<void> {
  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);
  const db = new EvidenceDatabase(dbPath);

  try {
    const prepared = await prepareContextFlow(db, {
      sessionId: options.sessionId?.trim() || undefined,
      cwd: options.cwd?.trim() || undefined,
      title: options.title?.trim() || undefined,
      host: options.host,
      interactive: options.interactive,
      printTo: "stdout",
      linkSource: "confirmed",
      verbose: !options.json,
    });
    if (options.json) {
      printJson({
        resolution: prepared.resolution,
        action: prepared.action,
        contextId: prepared.contextId,
        note: prepared.note,
        report: prepared.report,
      });
    }
  } finally {
    db.close();
  }
}

export function confirmContextLinkCli(options: {
  json?: boolean;
  sessionIds: string[];
  contextId?: string;
  label?: string;
  setPreferred?: boolean;
}): void {
  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);
  const db = new EvidenceDatabase(dbPath);

  try {
    const result = confirmContextLink(db, options);
    if (options.json) {
      printJson(result);
      return;
    }

    console.log(`Action: ${result.action}`);
    console.log(
      `Context: ${result.context?.label ?? result.contextId ?? "unknown"}`,
    );
    console.log(`Sessions: ${result.affectedSessionIds.join(", ")}`);
  } finally {
    db.close();
  }
}

export function rejectContextLinkCli(options: {
  json?: boolean;
  sessionId: string;
  contextId: string;
}): void {
  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);
  const db = new EvidenceDatabase(dbPath);

  try {
    const result = rejectContextLink(db, options.sessionId, options.contextId);
    if (options.json) {
      printJson(result);
      return;
    }

    console.log(`Action: ${result.action}`);
    console.log(`Session: ${options.sessionId}`);
    console.log(`Rejected context: ${options.contextId}`);
  } finally {
    db.close();
  }
}

export function moveSessionContextCli(options: {
  json?: boolean;
  sessionId: string;
  contextId?: string;
  label?: string;
  setPreferred?: boolean;
}): void {
  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);
  const db = new EvidenceDatabase(dbPath);

  try {
    const result = moveSessionContext(db, options);
    if (options.json) {
      printJson(result);
      return;
    }

    console.log(`Action: ${result.action}`);
    console.log(`Session: ${options.sessionId}`);
    console.log(
      `Context: ${result.context?.label ?? result.contextId ?? "unknown"}`,
    );
  } finally {
    db.close();
  }
}

export function mergeContextsCli(options: {
  json?: boolean;
  sourceContextId: string;
  targetContextId: string;
}): void {
  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);
  const db = new EvidenceDatabase(dbPath);

  try {
    const result = mergeContexts(
      db,
      options.sourceContextId,
      options.targetContextId,
    );
    if (options.json) {
      printJson(result);
      return;
    }

    console.log(`Action: ${result.action}`);
    console.log(`Merged from: ${options.sourceContextId}`);
    console.log(
      `Merged into: ${result.context?.label ?? result.contextId ?? "unknown"}`,
    );
  } finally {
    db.close();
  }
}

export function splitContextCli(options: {
  json?: boolean;
  contextId: string;
  sessionIds: string[];
  label?: string;
  setPreferred?: boolean;
}): void {
  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);
  const db = new EvidenceDatabase(dbPath);

  try {
    const result = splitContext(db, options);
    if (options.json) {
      printJson(result);
      return;
    }

    console.log(`Action: ${result.action}`);
    console.log(`Source context: ${options.contextId}`);
    console.log(
      `New context: ${result.context?.label ?? result.contextId ?? "unknown"}`,
    );
    console.log(`Sessions: ${result.affectedSessionIds.join(", ")}`);
  } finally {
    db.close();
  }
}

export function setActiveContextCli(options: {
  json?: boolean;
  contextId: string;
  cwd?: string;
}): void {
  const dbPath = resolveDbPath();
  ensureParentDir(dbPath);
  const db = new EvidenceDatabase(dbPath);

  try {
    const result = setActiveContext(db, options.contextId, options.cwd);
    if (options.json) {
      printJson(result);
      return;
    }

    console.log(`Action: ${result.action}`);
    console.log(
      `Context: ${result.context?.label ?? result.contextId ?? "unknown"}`,
    );
    console.log(
      `Workspace: ${options.cwd ?? result.context?.workspaceKey ?? "default"}`,
    );
  } finally {
    db.close();
  }
}
