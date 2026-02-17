# Architecture

## Overview

Footprint MCP Server is a modular, layered architecture following the [Model Context Protocol](https://modelcontextprotocol.io) specification. Built with TypeScript, it provides end-to-end encrypted evidence management through MCP tools, prompts, and resources.

## Directory Structure

```
src/
├── index.ts                    # Main MCP server class
├── types.ts                    # Shared TypeScript types
│
├── prompts/                    # MCP Prompt Handlers (3 prompts)
│   └── skill-prompt.ts         # Agent behavior guide & decision framework
│
├── tools/                      # MCP Tool Handlers (9 tools)
│   ├── index.ts                # Re-exports all tools
│   ├── capture-footprint.ts    # Capture & encrypt conversations
│   ├── list-footprints.ts      # List evidence with pagination
│   ├── get-footprint.ts        # Retrieve & decrypt evidence
│   ├── export-footprints.ts    # Export to encrypted ZIP (file/base64)
│   ├── search-footprints.ts    # Search by query/tags/date
│   ├── verify-footprint.ts     # Integrity verification
│   ├── suggest-capture.ts      # Keyword-based capture suggestions
│   ├── delete-footprints.ts    # Delete with two-step confirmation
│   └── manage-tags.ts          # Unified tag management (stats/rename/remove)
│
├── analyzers/                  # Content Analysis
│   └── content-analyzer.ts     # Keyword-based content analysis (5 categories)
│
├── lib/
│   ├── crypto/                 # Cryptography Layer
│   │   ├── types.ts            # Crypto types & KDF parameters
│   │   ├── key-derivation.ts   # Argon2id key derivation
│   │   ├── encrypt.ts          # XChaCha20-Poly1305 encryption
│   │   └── decrypt.ts          # XChaCha20-Poly1305 decryption
│   │
│   ├── storage/                # Data Persistence Layer
│   │   ├── types.ts            # Storage types
│   │   ├── schema.ts           # SQLite schema
│   │   ├── database.ts         # Database operations
│   │   ├── salt-storage.ts     # Salt management
│   │   ├── git.ts              # Git timestamping
│   │   └── export.ts           # ZIP export functionality
│   │
│   ├── tool-wrapper.ts         # Error handling wrapper
│   └── tool-response.ts        # Response formatters
│
├── cli/                        # Interactive Setup
│   └── index.ts                # CLI setup wizard
│
└── ui/                         # Interactive Dashboards
    └── register.ts             # UI resource registration

tests/
├── fixtures.ts                 # Shared test utilities
├── setup.ts                    # Test environment setup
├── integration.test.ts         # End-to-end workflows
├── tools.test.ts               # Tool handler tests
├── resources.test.ts           # Resource tests
├── error-handling.test.ts      # Edge case tests
├── prompts.test.ts             # Prompt registration tests
├── feature-coverage.test.ts    # Feature coverage validation
└── cli/                        # CLI-specific tests
```

## Key Design Patterns

### Tool Handler Pattern

Each tool uses a factory function with dependency injection:

```typescript
export function createToolHandler(
  db: EvidenceDatabase,
  getDerivedKey: () => Promise<Uint8Array>,
) {
  return wrapToolHandler("tool-name", "Validation hint", async (params) => {
    return createToolResponse(text, data);
  });
}
```

### Encryption Stack

- **Key Derivation**: Argon2id (OWASP recommended — 64MB memory, 3 iterations, 4 threads)
- **Encryption**: XChaCha20-Poly1305 (256-bit key, 24-byte random nonce, built-in AEAD)
- **Integrity**: SHA-256 content hashing

### Database Schema

```sql
CREATE TABLE evidences (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  conversationId TEXT NOT NULL,
  llmProvider TEXT NOT NULL,
  messageCount INTEGER NOT NULL,
  encryptedContent BLOB NOT NULL,
  nonce TEXT NOT NULL,
  contentHash TEXT NOT NULL,
  tags TEXT,
  gitCommitHash TEXT,
  gitTimestamp TEXT
);

CREATE TABLE salts (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  salt TEXT NOT NULL UNIQUE
);
```

## Testing

- **112 tests** across 13 files
- Unit, integration, tool, resource, prompt, and feature coverage tests
- All tests use in-memory SQLite for isolation

## Adding New Tools

1. Create tool file in `src/tools/`
2. Define Zod schema, metadata, and factory handler
3. Export from `src/tools/index.ts`
4. Register in `src/index.ts`

## References

- [MCP Specification](https://modelcontextprotocol.io)
- [XChaCha20-Poly1305](https://libsodium.gitbook.io/doc/secret-key_cryptography/aead/chacha20-poly1305)
- [Argon2](https://github.com/P-H-C/phc-winner-argon2)
- [Zod Validation](https://zod.dev)
