# Architecture Documentation

## Overview

Footprint MCP Server is designed as a modular, layered architecture following MCP (Model Context Protocol) specifications. The codebase emphasizes type safety, testability, and maintainability.

## Directory Structure

```
src/
├── index.ts                    # Main MCP server class
├── types.ts                    # Shared TypeScript types
├── test-helpers.ts             # Test utilities
│
├── tools/                      # MCP Tool Handlers (11 tools)
│   ├── index.ts                # Re-exports all tools
│   ├── capture-footprint.ts    # Capture & encrypt conversations
│   ├── list-footprints.ts      # List footprints with pagination
│   ├── get-footprint.ts        # Retrieve & decrypt footprint
│   ├── export-footprints.ts    # Export to encrypted ZIP
│   ├── search-footprints.ts    # Search by query/tags/date
│   ├── verify-footprint.ts     # Integrity verification
│   ├── suggest-capture.ts      # AI-powered suggestions
│   ├── delete-footprints.ts    # Delete footprint records
│   ├── rename-tag.ts           # Rename tags globally
│   ├── remove-tag.ts           # Remove tags globally
│   └── get-tag-stats.ts        # Tag usage statistics
│
├── analyzers/                  # Content Analysis Modules
│   └── content-analyzer.ts     # Keyword-based content analysis
│
├── lib/
│   ├── crypto/                 # Cryptography Layer
│   │   ├── index.ts            # Crypto exports
│   │   ├── types.ts            # Crypto types
│   │   ├── key-derivation.ts   # Argon2id key derivation
│   │   ├── encrypt.ts          # XChaCha20-Poly1305 encryption
│   │   └── decrypt.ts          # XChaCha20-Poly1305 decryption
│   │
│   ├── storage/                # Data Persistence Layer
│   │   ├── index.ts            # Storage exports
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
├── ui/                         # Interactive Dashboards
│   └── register.ts             # UI resource registration
│
└── tests/                      # Test Suite
    ├── fixtures.ts             # Shared test utilities
    ├── integration.test.ts     # End-to-end tests
    ├── tools.test.ts           # Tool handler tests
    ├── resources.test.ts       # Resource tests
    └── error-handling.test.ts  # Edge case tests
```

## Architectural Layers

### 1. MCP Server Layer (index.ts)

**Responsibilities:**

- MCP protocol implementation
- Server lifecycle management
- Tool and resource registration
- Request routing

**Key Components:**

- `FootprintServer` - Main server class extending MCP SDK
- Tool registration with dependency injection
- Resource handler for `footprint://{id}` URIs

### 2. Tool Handler Layer (tools/)

**Pattern:**
Each tool module follows a consistent structure:

```typescript
// Schema definitions
export const toolSchema = {
  inputSchema: {
    /* Zod schema */
  },
  outputSchema: {
    /* Zod schema */
  },
};

// Metadata
export const toolMetadata = {
  title: "Tool Title",
  description: "Tool description",
};

// Factory function with dependency injection
export function createToolHandler(
  db: EvidenceDatabase,
  getDerivedKey: () => Promise<Uint8Array>,
) {
  return wrapToolHandler("tool-name", "Validation hint", async (params) => {
    // Tool implementation
    return createToolResponse(text, data);
  });
}
```

**Benefits:**

- Self-contained modules
- Easy to test in isolation
- Consistent error handling
- Type-safe with Zod validation

### 3. Analyzer Layer (analyzers/)

**Content Analyzer** (`content-analyzer.ts`):

Analyzes conversation content using keyword matching across 5 categories:

- **IP**: Patents, algorithms, proprietary technology
- **Legal**: Contracts, licenses, agreements
- **Business**: Decisions, milestones, approvals
- **Research**: Findings, hypotheses, experiments
- **Compliance**: Audits, regulations, documentation

**Algorithm:**

1. Normalize text to lowercase
2. Match keywords using whole-word regex (prevents false positives)
3. Calculate confidence score based on keyword density
4. Generate suggested tags and conversation ID
5. Return analysis result with recommendation

### 4. Infrastructure Layer (lib/)

#### Crypto Module

**Key Derivation:**

- Algorithm: Argon2id (OWASP recommended)
- Memory cost: 64MB
- Time cost: 3 iterations
- Parallelism: 4 threads
- Output: 32-byte key

**Encryption:**

- Algorithm: XChaCha20-Poly1305
- Key size: 256 bits
- Nonce: 24 bytes (randomly generated)
- Authentication: Built-in AEAD

#### Storage Module

**Database Schema:**

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

**Git Timestamping:**

- Captures git commit hash and timestamp
- Provides cryptographic proof of when evidence was captured
- Immutable once committed to git history

### 5. Tool Infrastructure (lib/tool-\*.ts)

**Tool Wrapper** (`tool-wrapper.ts`):

- Higher-order function wrapping tool handlers
- Consistent error handling and logging
- Type-safe parameter validation
- Automatic error formatting

**Tool Response** (`tool-response.ts`):

- Standardized response format
- Success/error response builders
- Structured content with metadata
- Human-readable text formatting

## Design Patterns

### 1. Factory Pattern

Tool handlers use factory functions with dependency injection:

```typescript
export function createToolHandler(db, getDerivedKey) {
  return wrapToolHandler(/* ... */);
}
```

**Benefits:**

- Testable (inject mock dependencies)
- Flexible (different configurations)
- Encapsulated (hide implementation details)

### 2. Higher-Order Functions

Tool wrapper pattern:

```typescript
function wrapToolHandler(name, hint, handler) {
  return async (params) => {
    try {
      return await handler(params);
    } catch (error) {
      // Consistent error handling
    }
  };
}
```

### 3. Repository Pattern

Database operations abstracted through `EvidenceDatabase` class:

```typescript
class EvidenceDatabase {
  insert(evidence): void;
  findById(id): Evidence | null;
  findAll(options): Evidence[];
  search(criteria): Evidence[];
  delete(ids): number;
  // ...
}
```

### 4. Builder Pattern

Response builders for consistent formatting:

```typescript
createToolResponse(text, data);
formatSuccessResponse(message, summary, data);
```

## Type Safety

### Zod Schema Validation

All tool inputs/outputs validated with Zod:

```typescript
const inputSchema = z.object({
  id: z.string(),
  limit: z.number().int().positive().optional(),
});

// Runtime validation
const validated = inputSchema.parse(params);
```

### TypeScript Strict Mode

- `strict: true` in tsconfig.json
- No implicit `any`
- Null checking enabled
- Unused locals/parameters detected

## Testing Strategy

### Test Categories

1. **Unit Tests**: Individual functions in isolation
2. **Integration Tests**: End-to-end workflows
3. **Tool Tests**: Tool handler behavior
4. **Resource Tests**: MCP resource handling
5. **Error Tests**: Edge cases and error scenarios

### Test Fixtures

Reusable test utilities in `tests/fixtures.ts`:

```typescript
// Test environment setup
createTestEnvironment(password): TestEnvironment

// Sample data
SAMPLE_CONVERSATION = {
  basic: "...",
  withIP: "...",
  withLegal: "..."
}

// Helper functions
createSampleEvidence(overrides)
createMultipleSampleEvidences(count)
```

### Coverage

- 130 tests total
- All critical paths covered
- Edge cases tested
- Error scenarios validated

## Security Considerations

### Encryption at Rest

- All conversation content encrypted before storage
- Encryption keys derived from password (never stored)
- Nonces randomly generated per encryption
- Content integrity verified with SHA-256

### Password Management

- Argon2id key derivation (resistant to GPU attacks)
- Salt stored separately from evidence
- No password storage (stateless key derivation)
- User responsible for password security

### Local-First Architecture

- No external dependencies
- No network requests
- No cloud storage
- Complete data sovereignty

## Performance Considerations

### Database Indexing

```sql
CREATE INDEX idx_conversationId ON evidences(conversationId);
CREATE INDEX idx_timestamp ON evidences(timestamp);
```

### Lazy Loading

- Evidence content only decrypted when needed
- List operations return metadata only
- Full content retrieved on-demand

### Batch Operations

- Export multiple evidence at once
- Delete operations support arrays
- Tag operations update all records efficiently

## Extension Points

### Adding New Tools

1. Create tool file in `src/tools/`
2. Define schema, metadata, and handler
3. Export from `src/tools/index.ts`
4. Register in `src/index.ts`

### Adding New Analyzers

1. Create analyzer in `src/analyzers/`
2. Export analysis function
3. Use in tool handlers as needed

### Adding New Storage

1. Implement storage interface
2. Update database schema
3. Add migration if needed

## References

- [MCP Specification](https://modelcontextprotocol.io)
- [XChaCha20-Poly1305](https://libsodium.gitbook.io/doc/secret-key_cryptography/aead/chacha20-poly1305)
- [Argon2](https://github.com/P-H-C/phc-winner-argon2)
- [Zod Validation](https://zod.dev)
