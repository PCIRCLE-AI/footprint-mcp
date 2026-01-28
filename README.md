# @pcircle/footprint

[![npm version](https://img.shields.io/npm/v/@pcircle/footprint)](https://www.npmjs.com/package/@pcircle/footprint)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Model Context Protocol (MCP) server that automatically captures and encrypts LLM conversations as timestamped footprints.

## Why Footprint?

- **Prove IP Ownership** - Timestamped footprints of LLM-assisted work
- **Zero Effort** - Automatic capture via MCP protocol
- **Privacy First** - End-to-end encrypted, locally stored
- **Legally Valid** - Git timestamps + SHA-256 checksums

## Installation

```bash
npm install -g @pcircle/footprint
```

## Quick Start

1. **Set environment variables:**

```bash
export FOOTPRINT_DB_PATH="./footprints.db"
export FOOTPRINT_PASSWORD="your-secure-password"
```

2. **Configure Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "footprint": {
      "command": "npx",
      "args": ["footprint"],
      "env": {
        "FOOTPRINT_DB_PATH": "/path/to/footprints.db",
        "FOOTPRINT_PASSWORD": "your-password"
      }
    }
  }
}
```

3. **Restart Claude Desktop** - Footprint collection starts automatically

## Features

- 🔐 XChaCha20-Poly1305 encryption
- 🕒 Git commit timestamps
- 📦 Tamper-proof ZIP exports
- 🔍 Search and retrieve footprints
- 🤖 AI-powered capture suggestions
- ✅ Integrity verification
- 🏷️ Tag management
- 📊 Interactive UI dashboard

## Architecture

The Footprint MCP server follows a modular, layered architecture:

```
src/
├── index.ts              # Main MCP server
├── tools/                # MCP tool handlers (11 tools)
│   ├── capture-footprint.ts
│   ├── list-footprints.ts
│   ├── get-footprint.ts
│   ├── export-footprints.ts
│   ├── search-footprints.ts
│   ├── verify-footprint.ts
│   ├── suggest-capture.ts
│   ├── delete-footprints.ts
│   ├── rename-tag.ts
│   ├── remove-tag.ts
│   └── get-tag-stats.ts
├── analyzers/            # Content analysis modules
│   └── content-analyzer.ts
├── lib/
│   ├── crypto/           # Encryption & key derivation
│   ├── storage/          # Database & export
│   ├── tool-wrapper.ts   # Error handling wrapper
│   └── tool-response.ts  # Response formatters
└── ui/                   # Interactive dashboards
```

### Design Principles

- **Modular**: Each tool is self-contained with schema, metadata, and handler
- **Type-Safe**: Full TypeScript with Zod schema validation
- **Testable**: Dependency injection enables isolated testing
- **Secure**: Encrypted storage with integrity verification
- **Maintainable**: Clear separation of concerns across layers

## MCP Tools

### Core Tools

#### capture-footprint

Captures and encrypts an LLM conversation as a footprint.

**Parameters:**

- `conversationId` - Unique identifier for the conversation
- `llmProvider` - LLM provider name (e.g., "Claude Sonnet 4.5")
- `content` - Full conversation content
- `messageCount` - Number of messages in conversation
- `tags` (optional) - Comma-separated tags

#### list-footprints

Lists all captured footprints with pagination support.

**Parameters:**

- `limit` (optional) - Maximum results per page
- `offset` (optional) - Pagination offset

#### get-footprint

Retrieves and decrypts a specific footprint by ID.

**Parameters:**

- `id` - Footprint ID

#### export-footprints

Exports footprints to tamper-proof encrypted ZIP archive.

**Parameters:**

- `ids` - Array of footprint IDs to export
- `includeGitInfo` (optional) - Include git metadata

### Search & Discovery

#### search-footprints

Search and filter footprints by query, tags, or date range.

**Parameters:**

- `query` (optional) - Search text (matches conversationId, tags)
- `tags` (optional) - Array of tags to filter by
- `dateFrom` (optional) - Start date (ISO format)
- `dateTo` (optional) - End date (ISO format)
- `limit` (optional) - Maximum results
- `offset` (optional) - Pagination offset

#### suggest-capture

Analyze conversation content and suggest whether to capture it as a footprint.

**Parameters:**

- `summary` - Conversation summary or key content to analyze

**Returns:**

- `shouldCapture` - Whether to capture (based on keyword analysis)
- `reason` - Human-readable explanation
- `suggestedTags` - Recommended tags
- `suggestedConversationId` - Recommended ID
- `confidence` - Confidence score (0-1)

### Verification

#### verify-footprint

Verify the integrity and authenticity of a captured footprint.

**Parameters:**

- `id` - Footprint ID to verify

**Returns:**

- `verified` - Overall verification status
- `checks` - Detailed checks (content integrity, git timestamp, encryption)
- `legalReadiness` - Whether footprint meets legal standards

### Management

#### delete-footprints

Delete footprint records permanently.

**Parameters:**

- `ids` - Array of footprint IDs to delete

#### rename-tag

Rename a tag across all footprints.

**Parameters:**

- `oldTag` - Current tag name
- `newTag` - New tag name

#### remove-tag

Remove a tag from all footprints.

**Parameters:**

- `tag` - Tag name to remove

#### get-tag-stats

Get statistics about tag usage.

**Returns:**

- Tag names and their usage counts

## Security

- **Encryption**: XChaCha20-Poly1305 (256-bit)
- **Key Derivation**: Argon2id (OWASP recommended)
- **Storage**: Local SQLite with encrypted BLOBs

⚠️ **Store your password securely** - Loss means permanent data loss.

## Support

- [Documentation](https://github.com/PCIRCLE-AI/footprint#readme)
- [Issues](https://github.com/PCIRCLE-AI/footprint/issues)
- [License](https://github.com/PCIRCLE-AI/footprint/blob/main/LICENSE)
