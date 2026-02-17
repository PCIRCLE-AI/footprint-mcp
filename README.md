# @pcircle/footprint

[![npm version](https://img.shields.io/npm/v/@pcircle/footprint)](https://www.npmjs.com/package/@pcircle/footprint)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

MCP server that automatically captures and encrypts AI conversations as verifiable records with Git timestamps and end-to-end encryption.

## Why Footprint?

- **Prove IP Ownership** — Timestamped evidence of AI-assisted work
- **Zero Effort** — Automatic capture via MCP protocol
- **Privacy First** — End-to-end encrypted, locally stored
- **Legally Valid** — Git timestamps + SHA-256 checksums

## Quick Start

```bash
npx @pcircle/footprint setup
```

The interactive wizard auto-detects your system, validates your encryption password, and configures Claude Desktop automatically.

### Manual Configuration

Add to Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

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

For Claude Code, add to `~/.claude/mcp_settings.json` with the same structure.

## MCP Tools (9 tools)

### capture-footprint

Capture and encrypt an LLM conversation. Use when: user explicitly asks to save, or high-value content (IP, legal, business, research, compliance).

| Parameter        | Required | Description                                                        |
| ---------------- | -------- | ------------------------------------------------------------------ |
| `conversationId` | Yes      | Unique ID, format: `{topic}-{descriptor}-{YYYY-MM-DD}`             |
| `content`        | Yes      | Full conversation text including both human and assistant messages |
| `tags`           | No       | Comma-separated tags                                               |
| `llmProvider`    | No       | Provider name (default: `"unknown"`)                               |
| `messageCount`   | No       | Number of messages (auto-calculated from content if omitted)       |

### list-footprints

List all captured evidence with pagination.

| Parameter | Required | Description                    |
| --------- | -------- | ------------------------------ |
| `limit`   | No       | Results per page (default: 10) |
| `offset`  | No       | Pagination offset              |

### get-footprint

Retrieve and decrypt specific evidence by ID.

| Parameter | Required | Description |
| --------- | -------- | ----------- |
| `id`      | Yes      | Evidence ID |

### search-footprints

Search conversations by query, tags, and date range. Query matches conversationId and tags (LIKE). Tags filter uses AND logic.

| Parameter  | Required | Description                    |
| ---------- | -------- | ------------------------------ |
| `query`    | No       | Search text                    |
| `tags`     | No       | Array of tags (AND logic)      |
| `dateFrom` | No       | Start date (ISO 8601)          |
| `dateTo`   | No       | End date (ISO 8601)            |
| `limit`    | No       | Results per page (default: 10) |
| `offset`   | No       | Pagination offset              |

### export-footprints

Export evidence to encrypted ZIP archive.

| Parameter     | Required | Description                                           |
| ------------- | -------- | ----------------------------------------------------- |
| `evidenceIds` | No       | Specific IDs to export (all if omitted)               |
| `outputMode`  | No       | `"file"`, `"base64"`, or `"both"` (default: `"both"`) |

### verify-footprint

Verify evidence integrity using stored checksums and Git timestamps.

| Parameter | Required | Description |
| --------- | -------- | ----------- |
| `id`      | Yes      | Evidence ID |

Returns: `integrityVerified`, `checksumValid`, `gitTimestamp`

### delete-footprints

Permanently delete evidence records. Uses two-step confirmation.

| Parameter       | Required | Description                                          |
| --------------- | -------- | ---------------------------------------------------- |
| `evidenceIds`   | Yes      | Array of evidence IDs                                |
| `confirmDelete` | No       | Set `true` to confirm (default: `false` for preview) |

### suggest-capture

AI-powered capture suggestion based on keyword analysis.

| Parameter | Required | Description                                          |
| --------- | -------- | ---------------------------------------------------- |
| `summary` | Yes      | Brief conversation summary or key content to analyze |

### manage-tags

Unified tag management with three actions: `stats`, `rename`, `remove`.

| Parameter | Required   | Description                           |
| --------- | ---------- | ------------------------------------- |
| `action`  | Yes        | `"stats"` \| `"rename"` \| `"remove"` |
| `tag`     | For remove | Tag to remove                         |
| `oldTag`  | For rename | Current tag name                      |
| `newTag`  | For rename | New tag name                          |

## MCP Prompts (3 prompts)

- **`footprint-skill`** — Full agent behavior guide (decision tree, triggers, workflows, error recovery)
- **`footprint-quick-ref`** — Condensed quick reference for tool selection and tag conventions
- **`footprint-should-capture`** — Semantic decision framework for evaluating capture worthiness (takes `conversationSummary` argument)

## Architecture

```
packages/mcp-server/
├── src/
│   ├── index.ts              # Main MCP server
│   ├── prompts/              # MCP prompt handlers
│   │   └── skill-prompt.ts
│   ├── tools/                # MCP tool handlers (9 tools)
│   │   ├── capture-footprint.ts
│   │   ├── list-footprints.ts
│   │   ├── get-footprint.ts
│   │   ├── search-footprints.ts
│   │   ├── export-footprints.ts
│   │   ├── verify-footprint.ts
│   │   ├── delete-footprints.ts
│   │   ├── suggest-capture.ts
│   │   └── manage-tags.ts
│   ├── analyzers/            # Content analysis
│   ├── cli/                  # Setup wizard
│   ├── lib/
│   │   ├── crypto/           # XChaCha20-Poly1305 + Argon2id
│   │   └── storage/          # SQLite + Git timestamps
│   └── ui/                   # Interactive dashboards
└── tests/
```

## Security

- **Encryption**: XChaCha20-Poly1305 (256-bit)
- **Key Derivation**: Argon2id (OWASP recommended)
- **Storage**: Local SQLite with encrypted BLOBs
- **No cloud, no tracking, no data collection**

> **Store your password securely** — loss means permanent data loss.

## Development

```bash
git clone https://github.com/PCIRCLE-AI/footprint-mcp.git
cd footprint-mcp
pnpm install
pnpm build
pnpm test
```

## Support

- [GitHub](https://github.com/PCIRCLE-AI/footprint-mcp)
- [Issues](https://github.com/PCIRCLE-AI/footprint-mcp/issues)
- [npm](https://www.npmjs.com/package/@pcircle/footprint)
- [Website](https://footprint.memesh.ai)

## License

MIT License — see [LICENSE](./LICENSE) for details.
