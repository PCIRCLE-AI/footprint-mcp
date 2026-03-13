// Re-export everything for backwards compatibility.
// This file is now a thin re-export hub. The actual implementations live in:
//   - session-execution.ts  (session recording & execution)
//   - session-display.ts    (session data display & formatting)
//   - context-flow.ts       (context resolution & management)
//   - history-display.ts    (history search & trends display)

export {
  runClaudeSession,
  runGeminiSession,
  runCodexSession,
} from "./session-execution.js";

export {
  listSessionsCli,
  showSessionCli,
  exportSessionsCli,
  ingestSessionCli,
  showSessionMessagesCli,
  showSessionTrendsCli,
  showSessionTimelineCli,
  showSessionArtifactsCli,
  showSessionNarrativesCli,
  showSessionDecisionsCli,
} from "./session-display.js";

export {
  listContextsCli,
  showContextCli,
  resolveContextCli,
  prepareContextCli,
  confirmContextLinkCli,
  rejectContextLinkCli,
  moveSessionContextCli,
  mergeContextsCli,
  splitContextCli,
  setActiveContextCli,
} from "./context-flow.js";

export {
  searchHistoryCli,
  showHistoryTrendsCli,
  showHistoryHandoffCli,
} from "./history-display.js";
