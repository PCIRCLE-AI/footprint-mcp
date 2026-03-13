# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0] - 2026-03-12

### Added

- Confirmation-first context memory with resolve, confirm, reject, move, merge, split, and activate flows
- Context review and correction UI surfaces inside the session dashboard and detail views
- Paginated session detail surfaces for messages, timeline, artifacts, narratives, decisions, and related trends
- Multilingual project site with additional product screenshots and clearer install guidance
- GitHub Actions workflow for npm publish plus maintainer release documentation

### Changed

- Session and history surfaces now read more like product briefings instead of raw technical dumps
- Quick-try docs now correctly use `npx @pcircle/footprint ...` when the CLI is not installed globally
- Package publish metadata now enables public access and provenance by default

### Fixed

- Context preflight no longer silently overuses workspace-preferred contexts for unrelated work
- History cache upgrades rebuild stale materialized data instead of preserving outdated rows forever
- Handoff and trend summaries now preserve full blocker and recovery totals beyond preview limits

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
