# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2026-02-18

### Changed

- Updated all dependencies to latest versions
  - `@noble/ciphers` v2.1.1, `@noble/hashes` v2.0.1 (Noble crypto v2 migration)
  - `zod` v4.3.6, `vitest` v4.0.18, `vite` v7.3.1
  - `isomorphic-git` v1.37.1, `ora` v9.3.0, `@types/node` v22.19.11

### Security

- Fixed Dependabot vulnerabilities via pnpm overrides (ajv ReDoS, qs arrayLimit bypass)
- Fixed ESM import paths for Noble crypto v2 compatibility

### Fixed

- Vitest v4 no longer runs compiled test files from `dist/`

## [1.4.0] - 2026-02-17

### Added

- **MCP Prompts** — 3 built-in prompts for AI agent integration:
  - `footprint-skill` — Full agent behavior guide (decision tree, triggers, workflows)
  - `footprint-quick-ref` — Condensed quick reference for tool selection
  - `footprint-should-capture` — Semantic decision framework for capture evaluation
- **Unified tag management** — `manage-tags` tool replaces 3 separate tools (rename-tag, remove-tag, get-tag-stats)
- Auto-calculated `messageCount` when omitted from capture
- Default `llmProvider` to `"unknown"` when not specified
- Two-step delete confirmation (`confirmDelete` parameter)
- Base64 export mode (`outputMode: "file" | "base64" | "both"`)
- Enriched tool descriptions with usage hints and parameter guidance
- Comprehensive feature coverage tests (112 tests across 13 files)

### Changed

- Reduced tool count from 11 to 9 (consolidated tag tools)
- Renamed `legalReadiness` to `integrityVerified` in verify-footprint response
- Search total count now respects all filters (tags, date range)

### Security

- Environment variable validation for passphrase/data directory
- UUID format validation for evidence IDs
- Parameterized queries to prevent LIKE injection
- Timing-safe comparison for cryptographic operations
- Fixed race conditions in export and pagination

### Fixed

- Pagination total count accuracy with filters
- Backup file selection (sort to ensure latest)
- Tag cleanup on evidence deletion

## [1.3.0] - 2026-01-29

### Added

- Interactive CLI setup with `npx @pcircle/footprint setup`
- Automatic system detection (OS, shell, Claude Desktop)
- Password strength validation with user feedback
- Automatic Claude Desktop configuration
- Environment variable setup for shell RC files
- Config file backup before modification
- Comprehensive error handling and user guidance

### Changed

- Simplified Quick Start documentation
- Updated Getting Started guide with interactive setup

## [1.2.0] - 2026-01-28

### Changed

- **Architecture Refactoring** - Complete codebase restructuring for maintainability
  - Phase 1: Created tool infrastructure (tool-wrapper, tool-response)
  - Phase 2: Applied infrastructure to all 11 tool handlers
  - Phase 3: Extracted tool handlers to separate modules (70% reduction in index.ts: 1168→343 lines)
  - Phase 4: Extracted content analyzer (76% reduction in suggest-capture: 200→47 lines)
- Modular architecture with separate tools/, analyzers/, and lib/ directories
- Improved type safety with Zod schema validation
- Enhanced error handling with consistent wrapper pattern
- Better separation of concerns across layers

### Added

- Test fixtures module (tests/fixtures.ts) for reusable test utilities
- Content analyzer module (src/analyzers/content-analyzer.ts) with keyword-based analysis
- Comprehensive tool parameter documentation in README
- Complete ARCHITECTURE.md with design patterns and extension points
- Architecture section in README with directory structure

### Developer Experience

- All 130 tests passing
- Reduced code duplication significantly
- Improved code readability and maintainability
- Better testability with dependency injection pattern

## [1.0.0] - 2026-01-28

### Changed

- **BREAKING**: Package renamed from `@pcircle/evidencemcp-server` to `@pcircle/footprint`
- **BREAKING**: CLI binary renamed from `evidencemcp` to `footprint`
- Repository renamed to `PCIRCLE-AI/footprint`
- Website moved to `https://footprint.memesh.ai`
- Updated all branding from "EvidenceMCP" to "Footprint"
- Terminology change: "Evidence" → "Audit" throughout UI

### Added

- Delete evidence records (`delete-evidences` tool)
- Tag management tools (`rename-tag`, `remove-tag`, `get-tag-stats`)
- Search with highlighting
- Lucide icons replacing emojis
- Batch operations in dashboard

### Migration

To migrate from `@pcircle/evidencemcp-server`:

```bash
npm uninstall @pcircle/evidencemcp-server
npm install @pcircle/footprint
```

Update your MCP config to use `footprint` instead of `evidencemcp`.

## [0.3.0] - 2026-01-28

### Added

- Delete evidence functionality
- Tag management (rename, remove, stats)
- Search with highlighting
- Batch operations UI

## [0.2.0] - 2026-01-26

### Added

- MCP Apps interactive UI dashboard
- Real-time capture status
- Timeline visualization
- Tag filtering

## [0.1.0] - 2026-01-24

### Added

- Initial release of EvidenceMCP MCP Server
- MCP tools for evidence management:
  - `capture-evidence` - Capture and encrypt LLM conversations
  - `list-evidences` - List all captured evidence with pagination
  - `get-evidence` - Retrieve and decrypt specific evidence
  - `export-evidences` - Export evidences to encrypted ZIP archive
- MCP resource: `evidence://{id}` - Access decrypted evidence via URI
- End-to-end encryption using XChaCha20-Poly1305 (256-bit keys)
- Password-based key derivation using Argon2id (OWASP recommended params)
- Git timestamp integration for provable timestamps
- SQLite database with encrypted BLOB storage
- SHA-256 content integrity verification
- Comprehensive test suite (19 tests covering tools, resources, integration, error handling)
- Complete API documentation in README
- Troubleshooting guide with 8 common issues
- Security documentation
- Architecture diagram
- TypeScript support with full type definitions
- Command-line interface via `evidencemcp-mcp` binary

### Security

- All conversation content encrypted at rest
- Encryption keys derived from user password (never stored)
- Content integrity verified with SHA-256 hashes
- Local-first architecture (no cloud dependencies)

### Documentation

- Complete README with Quick Start guide
- API documentation for all tools and resources
- Programmatic usage examples
- Security best practices
- Troubleshooting guide
- Architecture documentation

[0.1.0]: https://github.com/PCIRCLE-AI/evidencemcp/releases/tag/mcp-server-v0.1.0
