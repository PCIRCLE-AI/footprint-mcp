# Architecture

## Overview

`@pcircle/footprint` is one MCP server with two product surfaces:

1. Evidence workflows: capture, encrypt, verify, search, export, and manage preserved conversation records.
2. Session history workflows: record CLI sessions, preserve raw transcript and timeline, derive artifacts, narratives, and decisions, then build conservative context memory on top of that history.

The server keeps both surfaces in the same SQLite database, but the data models are intentionally separate. Evidence records remain blob-oriented. Session history is append-only and event-oriented.

## Top-Level Runtime

### MCP Server

[index.ts](/Users/ktseng/Developer/Projects/footprint/packages/mcp-server/src/index.ts) owns:

- database initialization
- encryption key lifecycle
- tool registration
- prompt registration
- resource registration

The MCP surface currently exposes:

- evidence tools
- session tools
- context-memory tools
- prompt resources
- MCP app resources for evidence and session UIs

### CLI Runtime

[index.ts](/Users/ktseng/Developer/Projects/footprint/packages/mcp-server/src/cli/index.ts) owns:

- `footprint setup`
- `footprint run claude -- <args...>`
- `footprint run gemini -- <args...>`
- `footprint run codex -- <args...>`
- `footprint sessions list [--query <text>] [--issue-key <issue-key>] [--host <host>] [--status <status>]`
- `footprint contexts list`
- `footprint session show <id> [--message-limit <n>] [--message-offset <n>] [--trend-limit <n>] [--trend-offset <n>] [--timeline-limit <n>] [--timeline-offset <n>] [--artifact-limit <n>] [--artifact-offset <n>] [--narrative-limit <n>] [--narrative-offset <n>] [--decision-limit <n>] [--decision-offset <n>]`
- `footprint context show <id>`
- `footprint context resolve [--session <id>] [--cwd <path>] [--title <text>] [--host <host>]`
- `footprint context confirm <session-id> [<session-id> ...] [--context <id>] [--label <label>] [--set-preferred]`
- `footprint context reject <session-id> --context <id>`
- `footprint context move <session-id> [--context <id>] [--label <label>] [--set-preferred]`
- `footprint context merge <source-context-id> <target-context-id>`
- `footprint context split <context-id> --sessions <id,id,...> [--label <label>] [--set-preferred]`
- `footprint context activate <context-id> [--cwd <path>]`
- `footprint session ingest <id>`
- `footprint session export <id> [--group-by <issue|family>]`
- `footprint session messages|timeline <id> [--limit <n>] [--offset <n>]`
- `footprint session artifacts <id> [--limit <n>] [--offset <n>]`
- `footprint session trends <id> [--limit <n>] [--offset <n>]`
- `footprint session narratives <id> [--kind <journal|project-summary|handoff>] [--limit <n>] [--offset <n>]`
- `footprint session decisions <id> [--limit <n>] [--offset <n>]`
- `footprint history search <query> [--host <host>] [--status <status>]`
- `footprint history trends [--query <text>] [--issue-key <issue-key>] [--host <host>] [--status <status>] [--group-by <issue|family>]`
- `footprint history handoff [--query <text>] [--issue-key <issue-key>] [--host <host>] [--status <status>] [--group-by <issue|family>]`
- `footprint export-sessions [<id> ...] [--query <text>] [--issue-key <issue-key>] [--host <host>] [--status <status>] [--group-by <issue|family>]`
- compatibility aliases such as `list-sessions`, `get-session`, `export-sessions`, `get-history-trends`, and `get-history-handoff`
- context compatibility aliases such as `list-contexts`, `get-context`, `resolve-context`, `confirm-context-link`, and `set-active-context`

Query-oriented CLI commands also support `--json` so the local recorder surface can be scripted without going through MCP.

The human-readable `footprint session show` path is intentionally condensed for operators: it prints session metadata, recurring-trend/artifact/decision previews, and paginated transcript/timeline previews instead of dumping the full session body by default. Large transcript, recurring-trend, timeline, artifact, narrative, and decision panes are all expected to continue through explicit `limit` / `offset` calls rather than a single unbounded detail payload, and the CLI now exposes `--trend-*`, `--artifact-*`, `--narrative-*`, and `--decision-*` preview pagination on `session show` / `get-session` so condensed handoff views stay incremental too.

Recorder execution lives in [session-runtime.ts](/Users/ktseng/Developer/Projects/footprint/packages/mcp-server/src/cli/session-runtime.ts).

The session dashboard UI is no longer just a list view. It can now render:

- confirmed canonical contexts from `list-contexts`
- recent sessions from `list-sessions`
- a handoff-style scope summary from `get-history-handoff`
- pinned snippet results from `search-history`
- recurring execution-backed issue clusters from `get-history-trends`, including optional broader failure-family grouping
- interactive investigation filters for query, issue key, host, status, and trend grouping
- server-backed pagination for recent sessions, search matches, and recurring trends
- filtered ZIP export via `export-sessions`
- drill-down actions that either open session detail or focus the current dashboard on one host, issue cluster, or broader failure family

The session detail surface now includes:

- session metadata, transcript, and timeline
- paginated transcript and timeline slices with server-backed load-more actions
- server-backed recurring trend context for the current session, including related-session drill-down
- context review and correction UI for confirmed context briefings, suggested candidates, move/create actions, and preferred-context updates
- cross-session handoff loading for the selected exact issue or broader failure family
- on-demand artifacts, narratives, and decisions
- in-app export of either the current session or the currently selected recurring-trend scope, plus reingest actions

The history handoff surface lives in [history-handoff.ts](/Users/ktseng/Developer/Projects/footprint/packages/mcp-server/src/lib/history-handoff.ts) and [get-history-handoff.ts](/Users/ktseng/Developer/Projects/footprint/packages/mcp-server/src/tools/get-history-handoff.ts). It reuses the same server-backed session filters as `list-sessions` and `get-history-trends`, including the shared `issue` vs `family` grouping mode, then summarizes blockers, recoveries, regressions, follow-up questions, and recent sessions for the active investigation scope.

Cross-session text filters are now backed by a SQLite session history cache instead of hydrating every session detail payload into JavaScript first. `list-sessions(query|issueKey)` and `search-history` query cached title/metadata/transcript/derived text plus exact issue-key rows, then hydrate full detail only for the paginated snippet slice that `search-history` needs to render. Recurring trends and handoff summaries now use a sibling materialized `session_trend_attempts` surface plus direct message queries for follow-up questions, and session-detail trend context reads only the current session's related issue keys from that same cache instead of scanning the full trend history.

Context resolution reuses the same session-history signals, but it applies them conservatively. Same workspace alone is not enough to join canonical contexts. The resolver scores issue-key overlap, issue-family overlap, title overlap, host continuity, and temporal continuity, then returns suggestions instead of mutating storage. Rejections suppress repeat suggestions for the same session/context pair, and preferred workspace context is only a hint that can still be overridden.

## Code Layout

```text
packages/mcp-server/
├── src/
│   ├── index.ts
│   ├── types.ts
│   ├── analyzers/
│   │   └── content-analyzer.ts
│   ├── adapters/
│   │   ├── index.ts
│   │   ├── claude.ts
│   │   ├── codex.ts
│   │   ├── gemini.ts
│   │   └── structured-prefix.ts
│   ├── cli/
│   │   ├── index.ts
│   │   ├── launch-spec.ts
│   │   ├── pty-transcript.ts
│   │   ├── setup.ts
│   │   ├── session-runtime.ts
│   │   └── utils/
│   ├── ingestion/
│   │   ├── index.ts
│   │   ├── deterministic.ts
│   │   ├── semantic.ts
│   │   └── types.ts
│   ├── lib/
│   │   ├── crypto/
│   │   ├── context-memory.ts
│   │   ├── storage/
│   │   ├── session-artifacts.ts
│   │   ├── session-history.ts
│   │   ├── session-trends.ts
│   │   ├── tool-response.ts
│   │   └── tool-wrapper.ts
│   ├── prompts/
│   │   └── skill-prompt.ts
│   ├── tools/
│   │   ├── evidence tools
│   │   ├── context-memory tools
│   │   └── session tools
│   └── ui/
│       └── register.ts
├── ui/
│   ├── *.html
│   └── src/
│       ├── dashboard.ts
│       ├── detail.ts
│       ├── export.ts
│       ├── session-dashboard.ts
│       ├── session-dashboard-view.ts
│       ├── session-detail.ts
│       ├── session-detail-view.ts
│       └── session-ui.ts
├── vitest.browser.config.ts
└── tests/
    ├── evidence, resource, and prompt tests
    ├── browser/ session UI workflow tests
    ├── session tool and ingestion tests
    └── cli/ recorder and setup tests
```

## Data Model

Schema creation lives in [schema.ts](/Users/ktseng/Developer/Projects/footprint/packages/mcp-server/src/lib/storage/schema.ts). The current schema version is `8`.

### Evidence Tables

- `evidences`
- `metadata`
- `crypto_keys`

These tables support the original encrypted evidence flow.

### Session History Tables

- `sessions`
- `messages`
- `timeline_events`
- `artifacts`
- `decisions`
- `narratives`
- `ingestion_runs`
- `session_history_cache`
- `session_issue_keys`
- `session_trend_attempts`
- `session_trend_cache_state`

These tables support recorder workflows and derived history views.

### Context Memory Tables

- `contexts`
- `context_session_links`
- `context_link_rejections`
- `context_workspace_preferences`

These tables support canonical context identity, explicit correction, and workspace-level preferred context hints. Sessions remain unlinked until a user confirms membership.

## Runtime Flows

### Evidence Flow

1. `capture-footprint` accepts a conversation payload.
2. The server derives or re-derives the encryption key.
3. Content is encrypted before being persisted.
4. Query, export, verification, and tag management tools operate on stored evidence rows.

This path is still supported and remains part of the product.

### Session Recorder Flow

1. The CLI wrapper creates a `sessions` row with `status=running`.
2. The target host process is launched.
3. Wrapper I/O is mirrored to the user and normalized into `messages` plus `timeline_events`.
4. Optional host adapters may emit additional events.
5. On session close, the recorder finalizes status as `completed`, `failed`, or `interrupted`.
6. File and git provenance is appended from before/after repository snapshots.

Important current constraints:

- interactive BSD/macOS sessions use `script -r` transcript replay, and Linux sessions use util-linux advanced timing logs plus split input/output captures
- non-interactive or unsupported environments fall back to piped stdio and record the fallback reason
- Claude, Gemini, and Codex all support structured adapter enrichment via host-specific prefixes
- raw session history is append-only once written

### Ingestion Flow

Ingestion entrypoints live in [index.ts](/Users/ktseng/Developer/Projects/footprint/packages/mcp-server/src/ingestion/index.ts).

1. Deterministic ingestion derives structured artifacts from raw messages and timeline events.
2. Semantic ingestion derives narratives and decisions from raw history plus deterministic outputs.
3. Re-ingestion replaces derived state while preserving the original transcript and timeline.

Guardrails:

- `running` sessions cannot be re-ingested
- provenance references are kept on derived outputs
- raw history is not rewritten during regeneration

Current semantic outputs include:

- deterministic artifact summaries for commands, tests, file changes, and git commits
- richer command classification metadata such as intent, package-manager script, issue keys, dependency actions, failure signatures, lint rules, and test suite / case extraction
- richer file-change metadata such as change scope and manifest / lockfile kind
- project summaries with failure counts, dependency-change summaries, richer issue clusters, and retry hotspots
- handoff views with blocking failures, dependency-change summaries, blocker / recovery cluster semantics, retry hotspots, and unresolved follow-ups
- decisions inferred from accepted or proposed planning language
- opt-in perf tracing for reingest, history-query, trend, handoff, and export paths via `FOOTPRINT_DEBUG_PERF=1`

### Session Export Flow

Session export lives in [export-sessions.ts](/Users/ktseng/Developer/Projects/footprint/packages/mcp-server/src/tools/export-sessions.ts) and [export-sessions.ts](/Users/ktseng/Developer/Projects/footprint/packages/mcp-server/src/lib/storage/export-sessions.ts). Filtered exports preserve the selected history grouping in their manifest and reuse that same grouping for top-level trend and handoff summaries. Filtered selection resolves session IDs through the cached history-query layer first, then hydrates only the matched session details for archive generation.

Legacy database upgrades are versioned through the `metadata.schema_version` key. Current migration confidence is covered with `v3`, `v4`, and `v6` fixtures, and opening one of those older databases now proactively backfills missing `session_history_cache`, `session_issue_keys`, `session_trend_attempts`, and `session_trend_cache_state` rows.

1. The caller selects one or more session IDs, or omits IDs to export all recorded sessions.
2. The exporter reads raw `sessions`, `messages`, `timeline_events`, and derived tables for each selected session.
3. The archive is written as a ZIP bundle containing:
   - `sessions/index.json`
   - `history-trends.json` and `history-trends.md` for recurring issue rollups across the exported session set
   - `history-handoff.json` and `history-handoff.md` for the same exported session scope summarized as blockers, follow-ups, and recent sessions
   - per-session JSON files for raw and derived state
   - `handoff.md` for human-readable project status, open items, and recurring trend context
   - `transcript.md` for ordered transcript review
4. The tool can return a filesystem path, base64 payload, or both, depending on caller needs.

### Context Threading Flow

Context resolution lives in [context-memory.ts](/Users/ktseng/Developer/Projects/footprint/packages/mcp-server/src/lib/context-memory.ts) and the `resolve-context` / `get-context` tool family.

1. `resolve-context` accepts a `sessionId`, `cwd`, or both.
2. The resolver scores candidate canonical contexts using workspace path, issue keys, issue families, title overlap, host continuity, and temporal continuity.
3. Rejected pairs are filtered out before suggestions are returned.
4. The resolver returns one of:
   - an already linked canonical context
   - a preferred context for the workspace
   - suggested existing contexts
   - a suggested new context created from related unlinked sessions
5. The resolver never mutates storage. If ambiguity remains, it sets `confirmationRequired` so the client or interactive CLI can ask the user.
6. Explicit mutation tools then apply user intent:
   - `confirm-context-link`
   - `reject-context-link`
   - `move-session-context`
   - `merge-contexts`
   - `split-context`
   - `set-active-context`

For shell-driven workflows, `footprint context prepare --interactive` and `footprint run ... --prepare-context` sit on top of this flow. They resolve likely contexts before continuing a new session, ask the user in the terminal when `confirmationRequired` is true, and only then record `context.resolved` / `context.updated` on the session timeline.

The system intentionally optimizes for precision over recall: same repo or same workspace is not sufficient to auto-merge canonical context membership.

### MCP App UI Flow

[register.ts](/Users/ktseng/Developer/Projects/footprint/packages/mcp-server/src/ui/register.ts) registers five app resources:

- evidence dashboard
- evidence detail
- evidence export
- session dashboard
- session detail

Session tools now attach resource metadata consistently, so MCP clients can open the relevant dashboard or detail UI directly from session list, search, export, transcript, timeline, artifact, narrative, decision, and re-ingest flows.

The session detail surface can now load deterministic artifacts, derived narratives, and decisions independently. It can also load a cross-session handoff summary for the selected recurring issue or failure family, then export either the current session or that selected scope as a ZIP bundle, so raw transcript, timeline, derived views, and handoff output can be inspected or handed off side by side.

`get-session` now returns paginated transcript, recurring-trend, and timeline slices with explicit page metadata. The detail UI consumes those initial slices, then continues with `get-session-messages`, `get-session-trends`, and `get-session-timeline` `limit` / `offset` calls so large sessions do not require a single oversized payload to become inspectable.

The current quality model uses two complementary test layers for session UIs:

- unit and registration tests under the default Vitest runner
- browser-mode workflow smoke tests under `pnpm --dir packages/mcp-server test:browser`

Context correction currently ships through MCP tools and CLI commands. The MCP server can signal uncertainty, but the asking step belongs to the host or the interactive CLI rather than the server itself.

Release/install hardening now has its own repo-native smoke entrypoint under `pnpm --dir packages/mcp-server test:pack-smoke`. It runs `pnpm pack`, installs the generated tarball into a clean temp project, verifies the `footprint` CLI bin, imports `FootprintServer` from the published package entrypoint, and reads built session app resources through the MCP SDK path.

Linux recorder transport now has its own repo-native smoke entrypoint under `pnpm --dir packages/mcp-server test:linux-smoke`, and macOS recorder transport has a matching BSD smoke entrypoint under `pnpm --dir packages/mcp-server test:macos-smoke`.

`.github/workflows/ci.yml` runs those smoke paths on `ubuntu-latest` and `macos-latest`, so PTY behavior is validated on real Linux and BSD/macOS runners instead of only through local or SSH-based manual checks.

An additional optional manual smoke entrypoint lives under `pnpm --dir packages/mcp-server test:real-host-smoke`. It is intentionally not part of required CI because public runners do not ship with authenticated `claude`, `gemini`, or `codex` binaries. When run on a developer machine, it records real `--version` sessions for whichever host CLIs are installed and verifies wrapper-level transcript + metadata persistence without relying on fixture prefixes.

## Design Decisions

### Shared Server, Separate Models

The evidence and session surfaces share infrastructure, but not a forced common table model. That keeps legacy evidence tooling stable while letting the recorder evolve around event history.

### Wrapper-First Recorder

All hosts can be recorded through the wrapper. Adapters are enrichment, not a requirement for correctness.

### Derived State Is Regenerable

Artifacts, narratives, and decisions are disposable derived views. If ingestion logic changes, `reingest-session` can rebuild them from raw history.

### Local-First Operation

The server runs locally, stores state locally, and keeps evidence encryption inside the local process boundary.

## Extension Points

### Adding A New Session Tool

1. Create a handler in `src/tools/`.
2. Export schema, metadata, and factory from `src/tools/index.ts`.
3. Register the tool in `src/index.ts`.
4. Add tool tests and, if relevant, UI/resource coverage.

### Adding A New Host Adapter

1. Implement the adapter in `src/adapters/`.
2. Register it in `src/adapters/index.ts`.
3. Ensure wrapper-only capture still works when the adapter is absent or silent.
4. Add recorder tests that verify both transcript preservation and adapter event provenance.

### Evolving Ingestion

1. Add deterministic extractors or semantic derivations under `src/ingestion/`.
2. Preserve stable source references back to messages or timeline events.
3. Rebuild derived state through `reingest-session` rather than mutating raw history.

## Quality Gates

The repository pre-commit flow currently validates:

- lint
- dependency audit
- sensitive-file checks
- full Vitest suite

This matters for the recorder because storage, ingestion, CLI flows, and MCP registration all share one package and one release artifact.
