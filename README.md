# @pcircle/footprint

[![npm version](https://img.shields.io/npm/v/@pcircle/footprint)](https://www.npmjs.com/package/@pcircle/footprint)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Project site: [footprint.memesh.ai](https://footprint.memesh.ai/)

`@pcircle/footprint` is a local-first MCP server for AI-assisted work continuity. It gives you one place to:

- keep a usable history of ongoing AI-assisted work, including context memory and handoff-friendly summaries
- preserve specific conversations as encrypted evidence when they need verification and export

It is open source. No seats, no usage pricing, and no hosted-memory lock-in.

The session recorder preserves raw transcript and timeline data first, then derives artifacts, narratives, decisions, and user-correctable context threads from that source history.

Interactive sessions use `script`-backed PTY transport on BSD/macOS and Linux. BSD/macOS replays native `script -r` transcripts, while Linux replays util-linux advanced timing logs so transcript attribution stays consistent across platforms.

## Start Here

If you are new to Footprint, use this order:

1. [Open the project site](https://footprint.memesh.ai/) and look at the product screenshots first.
2. Run `npx @pcircle/footprint setup` to try it quickly, or install the CLI with `npm install -g @pcircle/footprint`.
3. If you are still using the quick `npx` path, open the local product with `npx @pcircle/footprint demo --open`. If you installed the CLI, use `footprint demo --open`.
4. Start recording real work with `footprint run ...`.

## Quick Start

If you only want to see the product locally first:

```bash
npx @pcircle/footprint setup
npx @pcircle/footprint demo --open
```

If you want the CLI installed for repeated use:

```bash
npm install -g @pcircle/footprint
footprint setup
```

If you want to start recording live CLI work immediately:

```bash
footprint run claude -- <args...>
footprint run gemini -- <args...>
footprint run codex -- <args...>
```

If you want Footprint to suggest the right context before a run begins:

```bash
footprint run codex --prepare-context -- <args...>
```

### Install And Configure

```bash
npx @pcircle/footprint setup
```

Persistent install:

```bash
npm install -g @pcircle/footprint
footprint setup
```

The setup wizard:

- creates the local data directory
- validates the passphrase
- configures Claude Desktop when available
- optionally appends environment variables to the active shell rc file

Node.js `>=22` is required.

If you stay on the quick `npx` path, use `npx @pcircle/footprint ...` for later commands too. The bare `footprint` command is only available after a global install.

### Open The Local Live Product

```bash
npx @pcircle/footprint demo
```

If you installed the CLI globally, use `footprint demo` or `footprint demo --open`.

This starts a local browser-facing surface for the current Footprint database and prints a localhost URL for:

- the session dashboard
- deep-linked session detail pages
- context review and correction flows
- export and handoff interactions

Optional flags:

```bash
footprint demo --host 127.0.0.1 --port 4310
footprint demo --open
```

Recorder inspection commands:

```bash
footprint sessions list [--query "<text>"] [--issue-key "<issue-key>"] [--host <claude|gemini|codex>] [--status <running|completed|failed|interrupted>]
footprint session show <session-id> [--message-limit <n>] [--message-offset <n>] [--trend-limit <n>] [--trend-offset <n>] [--timeline-limit <n>] [--timeline-offset <n>] [--artifact-limit <n>] [--artifact-offset <n>] [--narrative-limit <n>] [--narrative-offset <n>] [--decision-limit <n>] [--decision-offset <n>]
footprint session ingest <session-id>
footprint session export <session-id> [--group-by <issue|family>]
footprint session messages <session-id> [--limit <n>] [--offset <n>]
footprint session trends <session-id> [--limit <n>] [--offset <n>]
footprint session timeline <session-id> [--limit <n>] [--offset <n>]
footprint session artifacts <session-id> [--limit <n>] [--offset <n>]
footprint session narratives <session-id> [--kind <journal|project-summary|handoff>] [--limit <n>] [--offset <n>]
footprint session decisions <session-id> [--limit <n>] [--offset <n>]
footprint history search "<query>" [--host <claude|gemini|codex>] [--status <running|completed|failed|interrupted>]
footprint history trends [--query "<text>"] [--issue-key "<issue-key>"] [--host <claude|gemini|codex>] [--status <running|completed|failed|interrupted>] [--group-by <issue|family>]
footprint history handoff [--query "<text>"] [--issue-key "<issue-key>"] [--host <claude|gemini|codex>] [--status <running|completed|failed|interrupted>] [--group-by <issue|family>]
```

Context memory commands:

```bash
footprint contexts list
footprint context resolve [--session <session-id>] [--cwd <path>] [--title "<text>"] [--host <claude|gemini|codex>]
footprint context prepare [--session <session-id>] [--cwd <path>] [--title "<text>"] [--host <claude|gemini|codex>] [--interactive] [--json]
footprint context show <context-id>
footprint context confirm <session-id> [<session-id> ...] [--context <context-id>] [--label "<label>"] [--set-preferred]
footprint context reject <session-id> --context <context-id>
footprint context move <session-id> [--context <context-id>] [--label "<label>"] [--set-preferred]
footprint context merge <source-context-id> <target-context-id>
footprint context split <context-id> --sessions <session-id,session-id,...> [--label "<label>"] [--set-preferred]
footprint context activate <context-id> [--cwd <path>]
footprint demo [--host <address>] [--port <number>] [--open]
```

Add `--json` to the query commands above when you want scriptable output.

### Run As An MCP Server

When invoked without a CLI subcommand, Footprint starts the MCP server on stdio.

### Manual MCP Configuration

Claude Desktop example:

```json
{
  "mcpServers": {
    "footprint": {
      "command": "npx",
      "args": ["@pcircle/footprint"],
      "env": {
        "FOOTPRINT_DATA_DIR": "/path/to/footprint-data",
        "FOOTPRINT_PASSPHRASE": "your-secure-passphrase"
      }
    }
  }
}
```

For Claude Code, use the same server definition in `~/.claude/mcp_settings.json`.

## Product Surfaces

### Session History And Context Memory

Use the recorder when you care about staying in the right line of work, seeing what happened, and handing it off cleanly:

- ordered user and assistant transcript
- wrapper and adapter timeline events
- command and test activity with richer command intent classification
- file and git changes
- conservative context-thread suggestions for new or resumed sessions
- canonical context briefings with current truth, blockers, open questions, active decisions, and superseded decisions
- correction operations so users can confirm, reject, move, merge, split, and prefer contexts instead of accepting black-box auto-linking
- cross-session issue trends built from execution-backed retries and failures, with optional broader failure-family grouping
- derived narratives and decisions, including retry-aware handoff summaries and clustered issue rollups
- downloadable ZIP handoff bundles with raw and derived session state

Primary MCP tools:

- `list-sessions`
- `list-contexts`
- `get-context`
- `resolve-context`
- `confirm-context-link`
- `reject-context-link`
- `move-session-context`
- `merge-contexts`
- `split-context`
- `set-active-context`
- `get-session`
- `export-sessions`
- `get-session-messages`
- `get-session-trends`
- `get-session-timeline`
- `get-session-artifacts`
- `get-session-narrative`
- `get-session-decisions`
- `search-history`
- `get-history-trends`
- `get-history-handoff`
- `reingest-session`

Primary UI resources:

- `ui://footprint/session-dashboard.html`
- `ui://footprint/session-detail.html`

### Encrypted Evidence

Use the evidence flow when you need a discrete preserved record of a conversation.

Primary MCP tools:

- `capture-footprint`
- `list-footprints`
- `get-footprint`
- `search-footprints`
- `export-footprints`
- `verify-footprint`
- `delete-footprints`
- `manage-tags`
- `suggest-capture`

Primary UI resources:

- `ui://footprint/dashboard.html`
- `ui://footprint/detail.html`
- `ui://footprint/export.html`

## Storage Model

Footprint uses one local SQLite database with three logical models:

- evidence tables for encrypted conversation capture
- session-history tables for recorder transcript, events, artifacts, narratives, and decisions
- context tables for canonical context threads, explicit corrections, and workspace preferences

Evidence content is encrypted at rest. Session history is preserved as raw transcript plus raw timeline, derived views can be regenerated through `reingest-session`, and session exports package both raw and derived views into a portable ZIP archive. Context threading is suggestion-first and correction-driven: unresolved sessions stay isolated until the user confirms a canonical link. Cross-session filtering is backed by cached session-history text and exact issue-key rows inside SQLite so search and list surfaces stay incremental as histories grow.

## Security

- **Encryption**: XChaCha20-Poly1305 (256-bit)
- **Key Derivation**: Argon2id (OWASP recommended)
- **Storage**: Local SQLite with encrypted BLOBs
- **No cloud, no tracking, no data collection**

> **Store your password securely** — loss means permanent data loss.

## Architecture

Key runtime components:

- MCP server registration in `src/index.ts`
- CLI setup and recorder runtime in `src/cli/`
- host adapters in `src/adapters/`
- deterministic and semantic ingestion in `src/ingestion/`
- SQLite schema and persistence in `src/lib/storage/`
- MCP app resource registration in `src/ui/register.ts`

See [ARCHITECTURE.md](./ARCHITECTURE.md) for further reading.

## Prompts

Footprint registers three prompts for MCP clients:

- `footprint-skill`
- `footprint-quick-ref`
- `footprint-should-capture`

## Development

```bash
git clone https://github.com/PCIRCLE-AI/footprint-mcp.git
cd footprint-mcp
pnpm install
pnpm build
pnpm test:run
```

Repository CI runs Ubuntu and macOS jobs: Ubuntu covers install, lint, tarball install smoke, the default Vitest suite, the Linux PTY smoke path, browser-mode session UI tests, and the package publish gate; macOS covers recorder-focused PTY tests plus a real BSD `script -r` smoke path.

`pnpm test:publish-gate` is the package-level release check. It runs audit, build, the package Vitest suite, and the tarball install smoke so `prepublishOnly` blocks releases that are not installable from the packed artifact.

Set `FOOTPRINT_DEBUG_PERF=1` when you want lightweight timing traces for reingest, history query, and export paths while debugging large session sets.

## Links

- Repository: <https://github.com/PCIRCLE-AI/footprint-mcp>
- Package: <https://www.npmjs.com/package/@pcircle/footprint>
- Project site: <https://footprint.memesh.ai/>
- Issues: <https://github.com/PCIRCLE-AI/footprint-mcp/issues>

## License

MIT License — see [LICENSE](./LICENSE) for details.
