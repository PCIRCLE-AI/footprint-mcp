#!/usr/bin/env npx tsx
/**
 * Seed realistic demo data into the Footprint database for screenshots.
 * Usage: FOOTPRINT_PASSPHRASE=demo npx tsx scripts/seed-demo.ts [--db path]
 */

import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import path from "node:path";

const dbPath = process.argv.includes("--db")
  ? process.argv[process.argv.indexOf("--db") + 1]!
  : path.resolve("evidence.db");

console.log(`Seeding demo data into: ${dbPath}`);
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const now = new Date();
function ago(minutes: number): string {
  return new Date(now.getTime() - minutes * 60_000).toISOString();
}

// ── Sessions ──────────────────────────────────────────────
const sessions = [
  {
    id: randomUUID(),
    host: "claude",
    projectRoot: "/Users/dev/projects/footprint",
    cwd: "/Users/dev/projects/footprint/packages/mcp-server",
    title: "Implement encrypted ZIP export with integrity verification",
    status: "completed",
    startedAt: ago(45),
    endedAt: ago(12),
    metadata: JSON.stringify({ branch: "feat/zip-export", transport: "stdio", model: "claude-opus-4-6" }),
  },
  {
    id: randomUUID(),
    host: "claude",
    projectRoot: "/Users/dev/projects/footprint",
    cwd: "/Users/dev/projects/footprint/packages/mcp-server",
    title: "Fix timeline rendering and add 90-day view support",
    status: "completed",
    startedAt: ago(120),
    endedAt: ago(85),
    metadata: JSON.stringify({ branch: "fix/timeline-90d", transport: "stdio", model: "claude-sonnet-4-6" }),
  },
  {
    id: randomUUID(),
    host: "gemini",
    projectRoot: "/Users/dev/projects/api-gateway",
    cwd: "/Users/dev/projects/api-gateway/src",
    title: "Refactor rate limiter to use sliding window algorithm",
    status: "completed",
    startedAt: ago(240),
    endedAt: ago(195),
    metadata: JSON.stringify({ branch: "refactor/rate-limiter", transport: "stdio", model: "gemini-2.5-pro" }),
  },
  {
    id: randomUUID(),
    host: "claude",
    projectRoot: "/Users/dev/projects/footprint",
    cwd: "/Users/dev/projects/footprint/docs",
    title: "Add multilingual i18n support for zh-TW, ja, zh-CN",
    status: "completed",
    startedAt: ago(360),
    endedAt: ago(310),
    metadata: JSON.stringify({ branch: "feat/i18n", transport: "stdio", model: "claude-opus-4-6" }),
  },
  {
    id: randomUUID(),
    host: "codex",
    projectRoot: "/Users/dev/projects/ml-pipeline",
    cwd: "/Users/dev/projects/ml-pipeline",
    title: "Debug CUDA memory leak in training loop",
    status: "failed",
    startedAt: ago(480),
    endedAt: ago(450),
    metadata: JSON.stringify({ branch: "fix/cuda-oom", transport: "stdio", model: "codex-o3" }),
  },
  {
    id: randomUUID(),
    host: "claude",
    projectRoot: "/Users/dev/projects/footprint",
    cwd: "/Users/dev/projects/footprint/packages/mcp-server",
    title: "Schema migration v7→v9 with trend cache backfill",
    status: "completed",
    startedAt: ago(600),
    endedAt: ago(555),
    metadata: JSON.stringify({ branch: "feat/schema-v9", transport: "pty", model: "claude-opus-4-6" }),
  },
  {
    id: randomUUID(),
    host: "gemini",
    projectRoot: "/Users/dev/projects/dashboard-ui",
    cwd: "/Users/dev/projects/dashboard-ui/src/components",
    title: "Build responsive chart components with D3.js",
    status: "completed",
    startedAt: ago(800),
    endedAt: ago(740),
    metadata: JSON.stringify({ branch: "feat/charts", transport: "stdio", model: "gemini-2.5-flash" }),
  },
  {
    id: randomUUID(),
    host: "claude",
    projectRoot: "/Users/dev/projects/footprint",
    cwd: "/Users/dev/projects/footprint/packages/mcp-server",
    title: "Add context flow: merge, split, and link sessions",
    status: "completed",
    startedAt: ago(1200),
    endedAt: ago(1140),
    metadata: JSON.stringify({ branch: "feat/context-flow", transport: "stdio", model: "claude-sonnet-4-6" }),
  },
  {
    id: randomUUID(),
    host: "claude",
    projectRoot: "/Users/dev/projects/footprint",
    cwd: "/Users/dev/projects/footprint/packages/mcp-server/ui",
    title: "CSS redesign: Light Modern Premium theme with aurora gradients",
    status: "running",
    startedAt: ago(8),
    endedAt: null,
    metadata: JSON.stringify({ branch: "feat/ui-redesign", transport: "stdio", model: "claude-opus-4-6" }),
  },
];

const insertSession = db.prepare(`
  INSERT INTO sessions (id, host, projectRoot, cwd, title, status, startedAt, endedAt, metadata)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMessage = db.prepare(`
  INSERT INTO messages (id, sessionId, seq, role, source, content, capturedAt, metadata)
  VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
`);

const insertEvent = db.prepare(`
  INSERT INTO timeline_events (id, sessionId, seq, eventType, eventSubType, source, summary, payload, startedAt, endedAt, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertArtifact = db.prepare(`
  INSERT INTO artifacts (id, sessionId, eventId, artifactType, path, metadata)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const insertNarrative = db.prepare(`
  INSERT INTO narratives (id, sessionId, kind, content, sourceRefs)
  VALUES (?, ?, ?, ?, '[]')
`);

const insertDecision = db.prepare(`
  INSERT INTO decisions (id, sessionId, title, summary, rationale, status, sourceRefs)
  VALUES (?, ?, ?, ?, ?, 'accepted', '[]')
`);

const insertHistoryCache = db.prepare(`
  INSERT INTO session_history_cache (sessionId, titleText, metadataText, messagesText, artifactsText, narrativesText, decisionsText)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertTrendAttempt = db.prepare(`
  INSERT INTO session_trend_attempts (artifactId, sessionId, issueKey, issueLabel, kind, issueFamilyKey, issueFamilyLabel, outcome, outcomeCategory, seenAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertTrendCacheState = db.prepare(`
  INSERT OR REPLACE INTO session_trend_cache_state (sessionId, updatedAt)
  VALUES (?, datetime('now'))
`);

const insertIssueKey = db.prepare(`
  INSERT INTO session_issue_keys (sessionId, issueKey)
  VALUES (?, ?)
`);

// ── Message content per session ───────────────────────────
const messagesData: Record<number, { role: string; content: string }[]> = {
  0: [
    { role: "user", content: "Implement an encrypted ZIP export feature. Users should be able to select sessions, preview what will be included, and download a ZIP bundle with integrity checksums." },
    { role: "assistant", content: "I'll implement the ZIP export with these components:\n1. Export selection UI with checkboxes\n2. Bundle preview showing file list and sizes\n3. AES-256-GCM encryption using the existing passphrase\n4. SHA-256 integrity hash per file\n5. Download endpoint returning the encrypted bundle" },
    { role: "user", content: "Add a verify-integrity button that re-checks the checksums after download." },
    { role: "assistant", content: "Done. The verify button reads each file from the ZIP, recomputes SHA-256, and compares against the manifest. Green checkmark for pass, red X for mismatch. All 23 tests pass including the tamper-detection edge case." },
  ],
  1: [
    { role: "user", content: "The timeline chart breaks when switching to 90-day view. It only shows 7 days of data regardless of the selected period." },
    { role: "assistant", content: "Found the bug: the query was hardcoded to WHERE startedAt > datetime('now', '-7 days') instead of using the selected period parameter. Fixed in timeline-query.ts:48. The 90-day view now correctly fetches and renders all data points." },
    { role: "assistant", content: "Also noticed the timeline bar widths weren't scaling properly for longer periods. Applied logarithmic scaling for periods > 30 days. All timeline tests pass." },
  ],
  2: [
    { role: "user", content: "Our rate limiter uses a fixed window which causes burst traffic at window boundaries. Refactor to sliding window." },
    { role: "assistant", content: "Implemented a sliding window rate limiter using Redis sorted sets. Each request adds a timestamped entry; the window slides continuously instead of resetting at fixed intervals. This eliminates the 2x burst problem at window edges. Benchmark: <1ms overhead per request at 10K req/s." },
  ],
  3: [
    { role: "user", content: "Add internationalization support. We need Traditional Chinese, Japanese, and Simplified Chinese translations for all UI strings." },
    { role: "assistant", content: "Created the i18n system with:\n- data-i18n attribute-based string replacement\n- Language selector persisted in localStorage\n- 4 locale files: en, zh-TW, ja, zh-CN\n- 287 translation keys covering all 7 UI pages\n- RTL-safe layout (future-proofing)\n\nAll translations verified by native speakers." },
  ],
  4: [
    { role: "user", content: "Training crashes with CUDA OOM after ~200 epochs. GPU memory keeps growing even though batch size is constant." },
    { role: "assistant", content: "Identified the leak: gradient tensors from the validation step were being retained in the computation graph because torch.no_grad() was missing around the validation loop. Each epoch accumulated ~50MB of dead gradients.\n\nHowever, after fixing this, there's still a secondary leak in the custom attention layer that I couldn't resolve in this session." },
  ],
  5: [
    { role: "user", content: "Upgrade the database schema from v7 to v9 with backwards compatibility. Need to add trend caching tables and backfill existing data." },
    { role: "assistant", content: "Migration chain implemented:\n- v7 to v8: Add session_trend_attempts and session_trend_cache_state tables\n- v8 to v9: Add composite indexes for trend queries\n- Eager backfill: existing artifacts parsed and trend rows populated\n- Zero-downtime: old clients can still read, new features gracefully degrade\n\nAll 112 tests pass including the legacy v3 to v9 migration path." },
  ],
  6: [
    { role: "user", content: "Build reusable chart components with D3.js for the analytics dashboard. Need line, bar, and area charts with responsive sizing." },
    { role: "assistant", content: "Created 3 chart components with shared utilities:\n- LineChart: time-series with hover tooltips, supports multiple series\n- BarChart: categorical with stacked/grouped modes\n- AreaChart: gradient fill with configurable opacity\n\nAll use ResizeObserver for responsive sizing. Animations use prefers-reduced-motion media query." },
  ],
  7: [
    { role: "user", content: "Implement context flow operations: merge multiple sessions into one context, split a context, and link related sessions." },
    { role: "assistant", content: "Built the context management system:\n- merge-contexts: combines 2+ sessions with conflict resolution\n- split-context: extracts a subset of messages into a new context\n- link-sessions: creates bidirectional references between related work\n- prepare-context: stages a merge/split for user review before committing\n\n28 new tests covering all operations and edge cases." },
  ],
  8: [
    { role: "user", content: "Complete visual makeover of the UI. Switch to a light premium theme with modern typography and subtle gradients." },
    { role: "assistant", content: "Implementing Light Modern Premium theme:\n- Google Fonts: Outfit (headings) + Work Sans (body)\n- Aurora background gradients (teal/blue/amber)\n- Glassmorphism cards with backdrop-blur\n- Pill-shaped buttons with hover accent bars\n- Brand color: teal #0D9488\n\nCurrently applying to all 7 UI pages..." },
  ],
};

// ── Timeline events per session ───────────────────────────
const eventsData: Record<number, { type: string; subType: string; summary: string; status: string }[]> = {
  0: [
    { type: "command.completed", subType: "vitest", summary: "vitest run --reporter=verbose", status: "passed" },
    { type: "file.written", subType: "ts", summary: "src/lib/export/zip-bundle.ts", status: "completed" },
    { type: "command.completed", subType: "tsc", summary: "tsc --noEmit", status: "passed" },
  ],
  1: [
    { type: "command.completed", subType: "vitest", summary: "vitest run tests/timeline.test.ts", status: "passed" },
    { type: "file.written", subType: "ts", summary: "src/lib/timeline-query.ts", status: "completed" },
  ],
  2: [
    { type: "command.completed", subType: "jest", summary: "jest rate-limiter.test.ts", status: "passed" },
    { type: "file.written", subType: "ts", summary: "src/middleware/rate-limiter.ts", status: "completed" },
  ],
  3: [
    { type: "file.written", subType: "ts", summary: "src/i18n/locales/zh-TW.ts", status: "completed" },
    { type: "file.written", subType: "ts", summary: "src/i18n/locales/ja.ts", status: "completed" },
    { type: "command.completed", subType: "vitest", summary: "vitest run tests/i18n.test.ts", status: "passed" },
  ],
  4: [
    { type: "command.completed", subType: "python", summary: "python train.py --epochs=200", status: "failed" },
  ],
  5: [
    { type: "command.completed", subType: "vitest", summary: "vitest run tests/schema-migrations.test.ts", status: "passed" },
    { type: "command.completed", subType: "vitest", summary: "vitest run --reporter=verbose", status: "passed" },
  ],
  6: [
    { type: "file.written", subType: "tsx", summary: "src/components/LineChart.tsx", status: "completed" },
    { type: "file.written", subType: "tsx", summary: "src/components/BarChart.tsx", status: "completed" },
    { type: "command.completed", subType: "vitest", summary: "vitest run tests/charts.test.ts", status: "passed" },
  ],
  7: [
    { type: "command.completed", subType: "vitest", summary: "vitest run tests/context-flow.test.ts", status: "passed" },
    { type: "file.written", subType: "ts", summary: "src/lib/context/merge.ts", status: "completed" },
  ],
  8: [
    { type: "file.written", subType: "css", summary: "ui/src/footprint-theme.css", status: "completed" },
  ],
};

// ── Narratives per session ────────────────────────────────
const narrativesData: Record<number, string> = {
  0: "Implemented encrypted ZIP export with AES-256-GCM. Users can select footprints, preview bundle contents, and verify integrity post-download. 23 tests added covering encryption, decryption, and tamper detection.",
  1: "Fixed timeline query that was hardcoded to 7-day window. Added logarithmic bar scaling for 90-day view. All timeline periods now render correctly.",
  2: "Replaced fixed-window rate limiter with sliding window using Redis sorted sets. Eliminates 2x burst at window boundaries. Sub-millisecond overhead at 10K req/s.",
  3: "Added full i18n support for 4 languages (en, zh-TW, ja, zh-CN) across all 7 UI pages. 287 translation keys with localStorage persistence.",
  4: "Partially fixed CUDA OOM: added torch.no_grad() to validation loop. Secondary leak in custom attention layer remains unresolved.",
  5: "Completed schema migration v7 to v9 with trend caching tables, composite indexes, and eager backfill. All 112 tests pass including legacy upgrade paths.",
  6: "Built 3 responsive D3.js chart components (Line, Bar, Area) with shared utilities. Supports dark mode, reduced motion, and ResizeObserver.",
  7: "Built context flow system: merge, split, link, and prepare operations for session management. 28 tests covering all operations.",
  8: "Redesigning UI with Light Modern Premium theme. Outfit + Work Sans fonts, aurora gradients, glassmorphism cards. In progress.",
};

// ── Decisions per session ─────────────────────────────────
const decisionsData: Record<number, { title: string; summary: string; rationale: string }[]> = {
  0: [{ title: "Use AES-256-GCM for ZIP encryption", summary: "Chose AES-256-GCM over ChaCha20-Poly1305 for ZIP bundle encryption", rationale: "AES-256-GCM has hardware acceleration on most CPUs and is the standard for archive encryption." }],
  5: [{ title: "Eager backfill over lazy migration", summary: "Backfill all trend cache rows at migration time instead of on first query", rationale: "Lazy migration would cause unpredictable latency spikes on first dashboard load. Eager backfill adds ~2s to migration but guarantees consistent query performance." }],
};

// ── Trend data ────────────────────────────────────────────
const trendData: { sessionIdx: number; issueKey: string; issueLabel: string; family: string; familyLabel: string; outcome: string }[] = [
  { sessionIdx: 0, issueKey: "test:vitest-zip", issueLabel: "vitest ZIP export", family: "test-family:vitest", familyLabel: "vitest tests", outcome: "passed" },
  { sessionIdx: 0, issueKey: "build:tsc", issueLabel: "tsc --noEmit", family: "build-family:typescript", familyLabel: "TypeScript builds", outcome: "passed" },
  { sessionIdx: 1, issueKey: "test:vitest-timeline", issueLabel: "vitest timeline", family: "test-family:vitest", familyLabel: "vitest tests", outcome: "passed" },
  { sessionIdx: 2, issueKey: "test:jest-rate-limiter", issueLabel: "jest rate-limiter", family: "test-family:jest", familyLabel: "jest tests", outcome: "passed" },
  { sessionIdx: 3, issueKey: "test:vitest-i18n", issueLabel: "vitest i18n", family: "test-family:vitest", familyLabel: "vitest tests", outcome: "passed" },
  { sessionIdx: 4, issueKey: "train:cuda-oom", issueLabel: "python train.py", family: "train-family:python", familyLabel: "Python training", outcome: "failed" },
  { sessionIdx: 5, issueKey: "test:vitest-schema", issueLabel: "vitest schema-migrations", family: "test-family:vitest", familyLabel: "vitest tests", outcome: "passed" },
  { sessionIdx: 5, issueKey: "test:vitest-full", issueLabel: "vitest full suite", family: "test-family:vitest", familyLabel: "vitest tests", outcome: "passed" },
  { sessionIdx: 6, issueKey: "test:vitest-charts", issueLabel: "vitest charts", family: "test-family:vitest", familyLabel: "vitest tests", outcome: "passed" },
  { sessionIdx: 7, issueKey: "test:vitest-context", issueLabel: "vitest context-flow", family: "test-family:vitest", familyLabel: "vitest tests", outcome: "passed" },
];

// ── Seed everything in a transaction ──────────────────────
db.exec("BEGIN");

try {
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i]!;
    insertSession.run(s.id, s.host, s.projectRoot, s.cwd, s.title, s.status, s.startedAt, s.endedAt, s.metadata);

    const msgs = messagesData[i] ?? [];
    for (let j = 0; j < msgs.length; j++) {
      const m = msgs[j]!;
      const msgId = `${s.id}-msg-${j + 1}`;
      const capturedAt = new Date(new Date(s.startedAt).getTime() + (j + 1) * 120_000).toISOString();
      insertMessage.run(msgId, s.id, j + 1, m.role, "wrapper", m.content, capturedAt);
    }

    const evts = eventsData[i] ?? [];
    for (let j = 0; j < evts.length; j++) {
      const e = evts[j]!;
      const evtId = `${s.id}-evt-${j + 1}`;
      const evtStart = new Date(new Date(s.startedAt).getTime() + (j + 1) * 90_000).toISOString();
      const evtEnd = new Date(new Date(evtStart).getTime() + 30_000).toISOString();
      insertEvent.run(evtId, s.id, j + 1, e.type, e.subType, "wrapper", e.summary, JSON.stringify({ command: e.subType }), evtStart, evtEnd, e.status);

      if (e.type === "command.completed") {
        const artId = `${s.id}-art-${j + 1}`;
        insertArtifact.run(artId, s.id, evtId, "command-output", null, JSON.stringify({
          summary: e.summary,
          category: "test",
          intent: "test",
          issueKey: `cmd:${e.subType}-${i}`,
          issueLabel: e.summary,
          outcome: e.status,
          eventType: e.type,
          sourceRefs: [{ type: "event", id: evtId }],
        }));
      }
    }

    if (narrativesData[i]) {
      insertNarrative.run(`${s.id}-narr-1`, s.id, "handoff", narrativesData[i]!);
    }

    const decs = decisionsData[i] ?? [];
    for (let j = 0; j < decs.length; j++) {
      const d = decs[j]!;
      insertDecision.run(`${s.id}-dec-${j + 1}`, s.id, d.title, d.summary, d.rationale);
    }

    const allMsgText = msgs.map(m => m.content).join(" ");
    const artText = (eventsData[i] ?? []).map(e => e.summary).join(" ");
    insertHistoryCache.run(s.id, s.title!, JSON.stringify(s.metadata), allMsgText, artText, narrativesData[i] ?? "", (decs[0]?.summary ?? ""));

    const sessionTrends = trendData.filter(t => t.sessionIdx === i);
    for (const t of sessionTrends) {
      insertIssueKey.run(s.id, t.issueKey);
    }
  }

  for (const t of trendData) {
    const s = sessions[t.sessionIdx]!;
    const artId = `${s.id}-trend-${t.issueKey.replace(/[^a-z0-9]/g, "-")}`;
    // Insert a matching artifact row so the FK constraint is satisfied
    insertArtifact.run(artId, s.id, null, "command-output", null, JSON.stringify({
      summary: t.issueLabel,
      category: "test",
      intent: "test",
      issueKey: t.issueKey,
      issueLabel: t.issueLabel,
      issueFamilyKey: t.family,
      issueFamilyLabel: t.familyLabel,
      outcome: t.outcome,
    }));
    insertTrendAttempt.run(
      artId, s.id, t.issueKey, t.issueLabel, "test",
      t.family, t.familyLabel,
      t.outcome, t.outcome,
      s.startedAt,
    );
    insertTrendCacheState.run(s.id);
  }

  db.exec("COMMIT");
  console.log(`Seeded ${sessions.length} sessions with messages, events, artifacts, narratives, decisions, and trends.`);
} catch (err) {
  db.exec("ROLLBACK");
  console.error("Seed failed:", err);
  process.exit(1);
} finally {
  db.close();
}
