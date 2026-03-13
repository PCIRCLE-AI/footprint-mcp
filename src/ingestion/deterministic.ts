import type {
  ArtifactRecord,
  EvidenceDatabase,
  SessionDetail,
  SessionMessageRecord,
  TimelineEventRecord,
} from "../lib/storage/index.js";
import type { SourceRef } from "./types.js";

interface ArtifactCandidate {
  artifactType: ArtifactRecord["artifactType"];
  path: string | null;
  metadata: Record<string, unknown>;
  eventId: string | null;
}

const COMMAND_PREFIXES = [
  "pnpm",
  "npm",
  "yarn",
  "bun",
  "npx",
  "node",
  "python",
  "pytest",
  "vitest",
  "jest",
  "cargo",
  "go test",
  "git",
  "docker",
  "make",
] as const;
const COMMAND_PATTERN =
  /\b(?:pnpm|npm|yarn|bun|npx|node|python|pytest|vitest|jest|cargo|go test|git|docker|make)\b/i;
const TEST_PATTERN =
  /\b(?:test|tests|vitest|jest|pytest|spec|PASS|FAIL|failing)\b/i;
const DECISIONLESS_ERROR_PATTERN = /\b(?:error|failed|retry|exception)\b/i;
const FILE_PATTERN =
  /\b(?:[\w.-]+\/)+[\w.-]+\.[A-Za-z0-9]+|\b[\w.-]+\.(?:ts|tsx|js|jsx|json|md|yml|yaml|py|go|rs|sql|sh)\b/g;

function truncate(value: string, maxLength: number = 140): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 3)}...`;
}

function parseJson(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getPrimaryCommand(text: string): string | null {
  const normalized = text.trim().toLowerCase();
  for (const prefix of COMMAND_PREFIXES) {
    if (
      normalized === prefix ||
      normalized.startsWith(`${prefix} `) ||
      normalized.includes(` ${prefix} `)
    ) {
      return prefix;
    }
  }

  return null;
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function sanitizeIssueKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveCommandParts(
  commandInput: string | null,
  argInput: string[],
  fallbackText: string,
): {
  command: string | null;
  args: string[];
  invocation: string;
} {
  let command = normalizeWhitespace(commandInput ?? "");
  let args = [...argInput];

  if (command && args.length === 0 && /\s/.test(command)) {
    const [first, ...rest] = command.split(" ");
    command = first;
    args = rest;
  }

  const fallbackInvocation = normalizeWhitespace(fallbackText);
  const joinedInvocation = normalizeWhitespace(
    [command, ...args].filter(Boolean).join(" "),
  );
  const invocation = joinedInvocation || fallbackInvocation;
  const primaryCommand = getPrimaryCommand(invocation) ?? (command || null);

  if (args.length === 0 && invocation) {
    const tokens = invocation.split(" ");
    if (primaryCommand?.includes(" ")) {
      const primaryTokens = primaryCommand.split(" ");
      if (
        primaryTokens.every(
          (token, index) => tokens[index]?.toLowerCase() === token,
        )
      ) {
        args = tokens.slice(primaryTokens.length);
      }
    } else if (primaryCommand && tokens[0]?.toLowerCase() === primaryCommand) {
      args = tokens.slice(1);
    }
  }

  return {
    command: primaryCommand,
    args,
    invocation: invocation || "Command activity captured",
  };
}

function getPackageManager(command: string | null): string | null {
  return command && /^(?:pnpm|npm|yarn|bun)$/i.test(command) ? command : null;
}

function getScriptName(
  packageManager: string | null,
  args: string[],
): string | null {
  if (!packageManager) {
    return null;
  }

  const scriptArgs = args.filter((arg) => arg && !arg.startsWith("-"));
  if (scriptArgs.length === 0) {
    return null;
  }

  if (["run", "exec", "dlx"].includes(scriptArgs[0]!)) {
    return scriptArgs[1] ?? null;
  }

  return scriptArgs[0] ?? null;
}

function getPayloadText(payload: Record<string, unknown> | null): string[] {
  if (!payload) {
    return [];
  }

  const textFields = [
    "stderr",
    "stdout",
    "output",
    "error",
    "message",
    "details",
  ];
  return textFields
    .map((key) => payload[key])
    .filter(
      (value): value is string =>
        typeof value === "string" && Boolean(value.trim()),
    );
}

function extractDependencyMetadata(
  category: string,
  packageManager: string | null,
  args: string[],
): { dependencyAction: string | null; dependencyNames: string[] } {
  if (category !== "install" || !packageManager) {
    return { dependencyAction: null, dependencyNames: [] };
  }

  const tokens = args.filter((arg) => Boolean(arg));
  const actionIndex = tokens.findIndex((token) => !token.startsWith("-"));
  if (actionIndex === -1) {
    return { dependencyAction: "install", dependencyNames: [] };
  }

  const actionToken = tokens[actionIndex]!.toLowerCase();
  const normalizedAction =
    actionToken === "add"
      ? "add"
      : ["remove", "rm", "uninstall"].includes(actionToken)
        ? "remove"
        : ["upgrade", "up", "update"].includes(actionToken)
          ? "update"
          : "install";
  const dependencyNames = tokens
    .slice(actionIndex + 1)
    .filter(
      (token) =>
        token &&
        !token.startsWith("-") &&
        !/^(?:install|add|remove|rm|uninstall|upgrade|up|update)$/i.test(token),
    );

  return {
    dependencyAction: normalizedAction,
    dependencyNames,
  };
}

function extractErrorCode(text: string): string | null {
  const tsMatch = text.match(/\bTS\d{3,5}\b/i);
  if (tsMatch) {
    return tsMatch[0]!.toUpperCase();
  }

  const nodeMatch = text.match(/\b(?:E[A-Z0-9]{3,}|ERR_[A-Z0-9_]+)\b/);
  return nodeMatch?.[0] ?? null;
}

function extractLintRuleId(text: string, category: string): string | null {
  if (category !== "lint") {
    return null;
  }

  const lines = text.split(/\r?\n/).reverse();
  const lintRulePattern =
    /(?:^|\s)(?:\d+:\d+\s+)?(?:error|warning)\s+.+?(?:\s{2,}|\t+)((?:@[\w-]+\/)?[a-z][\w-]*(?:\/[a-z][\w-]*)?(?:-[a-z0-9][\w-]*)*)\s*$/i;

  for (const line of lines) {
    const match = line.match(lintRulePattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function extractTestIdentifiers(text: string): {
  testSuite: string | null;
  testCase: string | null;
} {
  const explicitLine = text
    .split(/\r?\n/)
    .find((candidate) => /\b(?:FAIL|PASS)\b/i.test(candidate));
  if (!explicitLine) {
    return { testSuite: null, testCase: null };
  }

  const line = explicitLine;
  const normalized = normalizeWhitespace(
    line.replace(/^\s*(?:FAIL|PASS)\s+/i, ""),
  );
  if (!normalized) {
    return { testSuite: null, testCase: null };
  }

  const [suitePart, ...caseParts] = normalized
    .split(/\s+>\s+/)
    .map((part) => truncate(part, 96));

  return {
    testSuite: suitePart ?? null,
    testCase: caseParts.length > 0 ? caseParts.join(" > ") : null,
  };
}

function extractFailureSignature(
  text: string,
  category: string,
): {
  failureSignatureKey: string | null;
  failureSignatureLabel: string | null;
  errorCode: string | null;
  lintRuleId: string | null;
} {
  const errorCode = extractErrorCode(text);
  const lintRuleId = extractLintRuleId(text, category);

  if (lintRuleId) {
    return {
      failureSignatureKey: `lint-rule:${sanitizeIssueKey(lintRuleId)}`,
      failureSignatureLabel: `ESLint ${lintRuleId}`,
      errorCode,
      lintRuleId,
    };
  }

  if (errorCode?.startsWith("TS")) {
    return {
      failureSignatureKey: `typescript:${sanitizeIssueKey(errorCode)}`,
      failureSignatureLabel: `TypeScript ${errorCode}`,
      errorCode,
      lintRuleId: null,
    };
  }

  const signatures: Array<{ pattern: RegExp; key: string; label: string }> = [
    {
      pattern: /\b(?:EACCES|EPERM|permission denied)\b/i,
      key: "permission-denied",
      label: "Permission denied",
    },
    {
      pattern:
        /\b(?:ENOTFOUND|ECONNRESET|EAI_AGAIN|network error|connection refused)\b/i,
      key: "network",
      label: "Network failure",
    },
    {
      pattern: /\b(?:cannot find module|module not found|cannot resolve)\b/i,
      key: "module-not-found",
      label: "Module not found",
    },
    {
      pattern: /\b(?:command not found|missing script|script not found)\b/i,
      key: "missing-command",
      label: "Command or script missing",
    },
    {
      pattern: /\b(?:timed? out|timeout)\b/i,
      key: "timeout",
      label: "Timeout",
    },
    {
      pattern: /\b(?:unauthorized|forbidden|401|403)\b/i,
      key: "auth",
      label: "Authentication or authorization failure",
    },
    {
      pattern: /\bassert(?:ion(?:error)?)?\b/i,
      key: "assertion",
      label: "Assertion failure",
    },
  ];

  const matched = signatures.find((signature) => signature.pattern.test(text));
  if (matched) {
    return {
      failureSignatureKey:
        category === "command" ? matched.key : `${category}:${matched.key}`,
      failureSignatureLabel: matched.label,
      errorCode,
      lintRuleId: null,
    };
  }

  return {
    failureSignatureKey: errorCode
      ? `${category}:${sanitizeIssueKey(errorCode)}`
      : null,
    failureSignatureLabel: errorCode ? `Error code ${errorCode}` : null,
    errorCode,
    lintRuleId: null,
  };
}

function classifyCommandCategory(text: string): string {
  if (
    /\b(?:vitest|jest|pytest|cargo test|go test|pnpm test|npm test|yarn test|bun test)\b/i.test(
      text,
    )
  ) {
    return "test";
  }

  if (/\b(?:typecheck|tsc(?:\s|$)|tsc --noEmit|vue-tsc)\b/i.test(text)) {
    return "typecheck";
  }

  if (/\b(?:lint|eslint|oxlint|biome check|ruff check)\b/i.test(text)) {
    return "lint";
  }

  if (/\b(?:build|vite build|next build|rollup|webpack|tsup)\b/i.test(text)) {
    return "build";
  }

  if (
    /\b(?:format|prettier|biome format|ruff format|cargo fmt|gofmt)\b/i.test(
      text,
    )
  ) {
    return "format";
  }

  if (
    /\b(?:pnpm|npm|yarn|bun)\b/i.test(text) &&
    /\b(?:install|add|remove|upgrade|update|dedupe|prune|unlink|link)\b/i.test(
      text,
    )
  ) {
    return "install";
  }

  if (
    /\b(?:migrate|migration|db push|prisma(?:\s+db\s+push|\s+migrate)|drizzle-kit|alembic|flyway|sequelize db:migrate|knex migrate)\b/i.test(
      text,
    )
  ) {
    return "migration";
  }

  if (
    /\b(?:deploy|release|publish|wrangler deploy|vercel(?:\s|$)|docker push|kubectl apply|terraform apply)\b/i.test(
      text,
    )
  ) {
    return "deploy";
  }

  if (
    /\b(?:dev|start|serve|preview|watch)\b/i.test(text) &&
    /\b(?:pnpm|npm|yarn|bun|vite|next|wrangler)\b/i.test(text)
  ) {
    return "dev-server";
  }

  if (/\bgit\b/i.test(text)) {
    return "git";
  }

  if (/\b(?:docker|podman|kubectl|helm)\b/i.test(text)) {
    return "container";
  }

  if (/\b(?:pnpm|npm|yarn|bun|npx)\b/i.test(text)) {
    return "package-manager";
  }

  if (/\b(?:node|python|tsx|bash|sh|deno)\b/i.test(text)) {
    return "runtime";
  }

  return "command";
}

function classifyCommandFamily(
  command: string | null,
  invocation: string,
): string {
  if (getPackageManager(command)) {
    return "package-manager";
  }

  if (command === "git") {
    return "git";
  }

  if (/\b(?:docker|podman|kubectl|helm)\b/i.test(invocation)) {
    return "container";
  }

  if (
    command &&
    /^(?:node|python|tsx|bash|sh|deno|pytest|vitest|jest|cargo test|go test)$/i.test(
      command,
    )
  ) {
    return "runtime";
  }

  if (command === "make") {
    return "task-runner";
  }

  return "command";
}

function humanizeKey(value: string): string {
  return value.replace(/-/g, " ");
}

function buildIssueFamilyIdentity(options: {
  category: string;
  command: string | null;
  commandFamily: string | null;
  packageManager: string | null;
  scriptName: string | null;
  framework?: string | null;
}): { issueFamilyKey: string | null; issueFamilyLabel: string | null } {
  if (["command", "package-manager"].includes(options.category)) {
    return { issueFamilyKey: null, issueFamilyLabel: null };
  }

  let familyBase: string | null = null;
  let familyLabel: string | null = null;

  if (options.category === "test") {
    if (options.framework && options.framework !== "generic") {
      familyBase = options.framework;
      familyLabel = `${options.framework} tests`;
    } else if (options.packageManager) {
      familyBase = options.packageManager;
      familyLabel = `${options.packageManager} tests`;
    } else if (options.commandFamily && options.commandFamily !== "command") {
      familyBase = options.commandFamily;
      familyLabel = `${humanizeKey(options.commandFamily)} tests`;
    } else if (options.command) {
      familyBase = options.command;
      familyLabel = `${options.command} tests`;
    }
  } else if (options.category === "migration") {
    if (options.scriptName && options.scriptName !== "migrate") {
      familyBase = options.scriptName;
      familyLabel = `${options.scriptName} migrations`;
    } else if (options.command) {
      familyBase = options.command;
      familyLabel = `${options.command} migrations`;
    }
  } else if (options.category === "deploy") {
    if (options.command) {
      familyBase = options.command;
      familyLabel = `${options.command} deploy`;
    }
  } else if (options.packageManager) {
    familyBase = options.packageManager;
    familyLabel = `${options.packageManager} ${humanizeKey(options.category)}`;
  } else if (options.commandFamily && options.commandFamily !== "command") {
    familyBase = options.commandFamily;
    familyLabel = `${humanizeKey(options.commandFamily)} ${humanizeKey(options.category)}`;
  } else if (options.command) {
    familyBase = options.command;
    familyLabel = `${options.command} ${humanizeKey(options.category)}`;
  }

  const sanitized = familyBase ? sanitizeIssueKey(familyBase) : "";
  return {
    issueFamilyKey: sanitized
      ? `${options.category}-family:${sanitized}`
      : null,
    issueFamilyLabel: familyLabel ? truncate(familyLabel, 96) : null,
  };
}

function buildIssueIdentity(options: {
  category: string;
  command: string | null;
  commandFamily: string | null;
  invocation: string;
  packageManager: string | null;
  scriptName: string | null;
  framework?: string | null;
}): {
  issueKey: string | null;
  issueLabel: string | null;
  issueFamilyKey: string | null;
  issueFamilyLabel: string | null;
} {
  if (["command", "package-manager"].includes(options.category)) {
    return {
      issueKey: null,
      issueLabel: null,
      issueFamilyKey: null,
      issueFamilyLabel: null,
    };
  }

  const issueBase =
    options.packageManager &&
    options.scriptName &&
    [
      "test",
      "lint",
      "typecheck",
      "build",
      "format",
      "install",
      "dev-server",
    ].includes(options.category)
      ? `${options.packageManager} ${options.scriptName}`
      : options.invocation;
  const normalizedBase = normalizeWhitespace(issueBase);
  if (!normalizedBase) {
    return {
      issueKey: null,
      issueLabel: null,
      ...buildIssueFamilyIdentity(options),
    };
  }

  const issueLabel =
    options.category === "test" &&
    options.framework &&
    options.framework !== "generic"
      ? truncate(`${normalizedBase} / ${options.framework}`, 96)
      : truncate(normalizedBase, 96);
  const issueKeyBase =
    options.packageManager &&
    options.scriptName &&
    [
      "test",
      "lint",
      "typecheck",
      "build",
      "format",
      "install",
      "dev-server",
    ].includes(options.category)
      ? `${options.packageManager} ${options.scriptName}`
      : normalizedBase;
  const sanitized = sanitizeIssueKey(issueKeyBase);

  return {
    issueKey: sanitized ? `${options.category}:${sanitized}` : null,
    issueLabel,
    ...buildIssueFamilyIdentity(options),
  };
}

function classifyTestFramework(text: string): string {
  if (/\bvitest\b/i.test(text)) {
    return "vitest";
  }

  if (/\bjest\b/i.test(text)) {
    return "jest";
  }

  if (/\bpytest\b/i.test(text)) {
    return "pytest";
  }

  if (/\bcargo test\b/i.test(text)) {
    return "cargo";
  }

  if (/\bgo test\b/i.test(text)) {
    return "go-test";
  }

  return "generic";
}

function classifyPathCategory(filePath: string | null): string | null {
  if (!filePath) {
    return null;
  }

  if (/(^|\/)(README|CHANGELOG|LICENSE)\b|\.md$/i.test(filePath)) {
    return "docs";
  }

  if (
    /(^|\/)(package|tsconfig|eslint|vite|vitest|pnpm-lock)\b|\.ya?ml$/i.test(
      filePath,
    )
  ) {
    return "config";
  }

  if (
    /(^|\/)(tests?|__tests__|fixtures?)\//i.test(filePath) ||
    /\.(test|spec)\./i.test(filePath)
  ) {
    return "test";
  }

  if (/\.(sql|prisma)$/i.test(filePath)) {
    return "schema";
  }

  return "source";
}

function classifyChangeScope(filePath: string | null): string | null {
  if (!filePath) {
    return null;
  }

  if (
    /(^|\/)(package\.json|pyproject\.toml|requirements\.txt|Pipfile|Cargo\.toml|go\.mod)$/i.test(
      filePath,
    )
  ) {
    return "dependency-manifest";
  }

  if (
    /(^|\/)(pnpm-lock\.ya?ml|package-lock\.json|yarn\.lock|bun\.lockb|Pipfile\.lock|poetry\.lock|Cargo\.lock|go\.sum)$/i.test(
      filePath,
    )
  ) {
    return "dependency-lockfile";
  }

  if (
    /(^|\/)(migrations?|prisma|drizzle)\//i.test(filePath) ||
    /\.(sql|prisma)$/i.test(filePath)
  ) {
    return "migration";
  }

  return classifyPathCategory(filePath);
}

function getManifestKind(filePath: string | null): string | null {
  if (!filePath) {
    return null;
  }

  const segments = filePath.split("/");
  return segments.at(-1) ?? null;
}

function inferOutcome(
  status: string | null,
  payload: Record<string, unknown> | null,
): string | null {
  if (typeof payload?.exitCode === "number") {
    return payload.exitCode === 0 ? "succeeded" : "failed";
  }

  if (typeof payload?.passed === "boolean") {
    return payload.passed ? "passed" : "failed";
  }

  if (!status) {
    return null;
  }

  if (/^(?:completed|captured|success|succeeded)$/i.test(status)) {
    return "succeeded";
  }

  if (/^passed$/i.test(status)) {
    return "passed";
  }

  if (/^(?:failed|error|parse-error|interrupted)$/i.test(status)) {
    return "failed";
  }

  if (/^running$/i.test(status)) {
    return "running";
  }

  return status.toLowerCase();
}

function buildCommandMetadata(
  sourceRefs: SourceRef[],
  payload: Record<string, unknown> | null,
  options: {
    eventType?: string;
    eventSubType?: string | null;
    summary?: string | null;
    status?: string | null;
    content?: string;
    role?: string;
    source?: string;
  },
): Record<string, unknown> {
  const resolved = resolveCommandParts(
    getString(payload?.command),
    toStringArray(payload?.args),
    options.content ?? options.summary ?? "Command activity captured",
  );
  const payloadText = getPayloadText(payload);
  const textCorpus = [
    resolved.invocation,
    resolved.command ?? "",
    ...resolved.args,
    options.summary ?? "",
    options.content ?? "",
    ...payloadText,
  ].join("\n");
  const category = classifyCommandCategory(textCorpus);
  const commandFamily = classifyCommandFamily(
    resolved.command,
    resolved.invocation,
  );
  const packageManager = getPackageManager(resolved.command);
  const scriptName = getScriptName(packageManager, resolved.args);
  const outcome = inferOutcome(options.status ?? null, payload);
  const dependencyMetadata = extractDependencyMetadata(
    category,
    packageManager,
    resolved.args,
  );
  const framework =
    category === "test" ? classifyTestFramework(textCorpus) : null;
  const testIdentifiers =
    category === "test"
      ? extractTestIdentifiers(textCorpus)
      : { testSuite: null, testCase: null };
  const failureSignature =
    outcome === "failed"
      ? extractFailureSignature(textCorpus, category)
      : {
          failureSignatureKey: null,
          failureSignatureLabel: null,
          errorCode: null,
          lintRuleId: null,
        };
  const issueIdentity = buildIssueIdentity({
    category,
    command: resolved.command,
    commandFamily,
    invocation: resolved.invocation,
    packageManager,
    scriptName,
    framework,
  });
  const invocation = truncate(options.summary ?? resolved.invocation);

  return {
    sourceRefs,
    eventType: options.eventType ?? null,
    eventSubType: options.eventSubType ?? null,
    summary: invocation,
    category,
    intent: category,
    commandFamily,
    command: resolved.command,
    args: resolved.args,
    framework,
    packageManager,
    scriptName,
    ...dependencyMetadata,
    ...testIdentifiers,
    ...failureSignature,
    ...issueIdentity,
    status: options.status ?? null,
    outcome,
    payload,
    content: options.content ?? null,
    role: options.role ?? null,
    source: options.source ?? null,
  };
}

function buildTestMetadata(
  sourceRefs: SourceRef[],
  payload: Record<string, unknown> | null,
  options: {
    eventType?: string;
    summary?: string | null;
    status?: string | null;
    content?: string;
    role?: string;
    source?: string;
  },
): Record<string, unknown> {
  const commandInput = getString(payload?.command);
  const payloadText = getPayloadText(payload);
  const resolved = resolveCommandParts(
    commandInput,
    toStringArray(payload?.args),
    [options.summary ?? "", options.content ?? "", commandInput ?? ""].join(
      " ",
    ),
  );
  const summary = truncate(
    options.summary ?? options.content ?? "Test activity captured",
  );
  const haystack = [
    summary,
    options.content ?? "",
    resolved.invocation,
    ...payloadText,
  ].join("\n");
  const framework = classifyTestFramework(haystack);
  const packageManager = getPackageManager(resolved.command);
  const scriptName = getScriptName(packageManager, resolved.args);
  const commandFamily = classifyCommandFamily(
    resolved.command,
    resolved.invocation,
  );
  const outcome = inferOutcome(options.status ?? null, payload);
  const testIdentifiers = extractTestIdentifiers(haystack);
  const failureSignature =
    outcome === "failed"
      ? extractFailureSignature(haystack, "test")
      : {
          failureSignatureKey: null,
          failureSignatureLabel: null,
          errorCode: null,
          lintRuleId: null,
        };
  const issueIdentity = buildIssueIdentity({
    category: "test",
    command: resolved.command,
    commandFamily,
    invocation: resolved.invocation || summary,
    packageManager,
    scriptName,
    framework,
  });

  return {
    sourceRefs,
    eventType: options.eventType ?? null,
    summary,
    category: "test",
    intent: "test",
    commandFamily,
    command: resolved.command,
    args: resolved.args,
    framework,
    packageManager,
    scriptName,
    ...testIdentifiers,
    ...failureSignature,
    ...issueIdentity,
    status: options.status ?? null,
    outcome,
    passed:
      typeof payload?.passed === "boolean"
        ? payload.passed
        : /^passed$/i.test(options.status ?? ""),
    payload,
    content: options.content ?? null,
    role: options.role ?? null,
    source: options.source ?? null,
    markers: options.content
      ? {
          failed: DECISIONLESS_ERROR_PATTERN.test(options.content),
        }
      : undefined,
  };
}

function buildFileMetadata(
  sourceRefs: SourceRef[],
  filePath: string | null,
  payload: Record<string, unknown> | null,
  options: {
    eventType?: string;
    summary?: string | null;
    status?: string | null;
    content?: string;
  },
): Record<string, unknown> {
  return {
    sourceRefs,
    eventType: options.eventType ?? null,
    summary: truncate(
      options.summary ??
        (filePath
          ? `File changed: ${filePath}`
          : (options.content ?? "File change captured")),
    ),
    category: "file-change",
    pathCategory: classifyPathCategory(filePath),
    changeScope: classifyChangeScope(filePath),
    manifestKind: getManifestKind(filePath),
    status: options.status ?? null,
    payload,
    content: options.content ?? null,
  };
}

function buildGitMetadata(
  sourceRefs: SourceRef[],
  payload: Record<string, unknown> | null,
  options: {
    eventType?: string;
    summary?: string | null;
    status?: string | null;
  },
): Record<string, unknown> {
  return {
    sourceRefs,
    eventType: options.eventType ?? null,
    summary: truncate(options.summary ?? "Git commit captured"),
    category: "git",
    status: options.status ?? null,
    previousHead: getString(payload?.previousHead),
    currentHead: getString(payload?.currentHead),
    payload,
  };
}

function getEventForMessage(
  detail: SessionDetail,
  message: SessionMessageRecord,
): TimelineEventRecord | null {
  return (
    detail.timeline.find((event) => event.relatedMessageId === message.id) ??
    null
  );
}

function makeSourceRefs(...refs: SourceRef[]): SourceRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.type}:${ref.id}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function fromTimelineEvent(
  event: TimelineEventRecord,
): ArtifactCandidate | null {
  if (event.eventType.startsWith("command.")) {
    const payload = parseJson(event.payload);
    return {
      artifactType: "command-output",
      path: null,
      eventId: event.id,
      metadata: buildCommandMetadata(
        makeSourceRefs({ type: "event", id: event.id }),
        payload,
        {
          eventType: event.eventType,
          eventSubType: event.eventSubType,
          summary: event.summary,
          status: event.status,
        },
      ),
    };
  }

  if (event.eventType.startsWith("test.")) {
    const payload = parseJson(event.payload);
    return {
      artifactType: "test-result",
      path: null,
      eventId: event.id,
      metadata: buildTestMetadata(
        makeSourceRefs({ type: "event", id: event.id }),
        payload,
        {
          eventType: event.eventType,
          summary: event.summary,
          status: event.status,
        },
      ),
    };
  }

  if (event.eventType === "file.changed") {
    const payload = parseJson(event.payload);
    const filePath = typeof payload?.path === "string" ? payload.path : null;
    return {
      artifactType: "file-change",
      path: filePath,
      eventId: event.id,
      metadata: buildFileMetadata(
        makeSourceRefs({ type: "event", id: event.id }),
        filePath,
        payload,
        {
          eventType: event.eventType,
          summary: event.summary,
          status: event.status,
        },
      ),
    };
  }

  if (event.eventType === "git.commit") {
    const payload = parseJson(event.payload);
    return {
      artifactType: "git-commit",
      path: null,
      eventId: event.id,
      metadata: buildGitMetadata(
        makeSourceRefs({ type: "event", id: event.id }),
        payload,
        {
          eventType: event.eventType,
          summary: event.summary,
          status: event.status,
        },
      ),
    };
  }

  return null;
}

function fromMessage(
  detail: SessionDetail,
  message: SessionMessageRecord,
): ArtifactCandidate[] {
  const event = getEventForMessage(detail, message);
  const refs = makeSourceRefs(
    { type: "message", id: message.id },
    ...(event ? [{ type: "event" as const, id: event.id }] : []),
  );
  const candidates: ArtifactCandidate[] = [];

  if (COMMAND_PATTERN.test(message.content)) {
    candidates.push({
      artifactType: "command-output",
      path: null,
      eventId: event?.id ?? null,
      metadata: buildCommandMetadata(refs, null, {
        summary: message.content,
        content: message.content,
        role: message.role,
        source: message.source,
      }),
    });
  }

  if (TEST_PATTERN.test(message.content)) {
    candidates.push({
      artifactType: "test-result",
      path: null,
      eventId: event?.id ?? null,
      metadata: buildTestMetadata(refs, null, {
        summary: message.content,
        content: message.content,
        role: message.role,
        source: message.source,
      }),
    });
  }

  const fileMatches = message.content.match(FILE_PATTERN) ?? [];
  for (const filePath of [...new Set(fileMatches)]) {
    candidates.push({
      artifactType: "file-change",
      path: filePath,
      eventId: event?.id ?? null,
      metadata: buildFileMetadata(refs, filePath, null, {
        summary: `Referenced file: ${filePath}`,
        content: message.content,
      }),
    });
  }

  return candidates;
}

export function runDeterministicIngestion(
  db: EvidenceDatabase,
  sessionId: string,
): ArtifactRecord[] {
  const detail = db.getSessionDetail(sessionId);
  if (!detail) {
    throw new Error(`Session not found: ${sessionId}`);
  }

  const run = db.createIngestionRun({
    sessionId,
    stage: "deterministic",
    status: "running",
  });

  try {
    const artifactCandidates: ArtifactCandidate[] = [];

    for (const event of detail.timeline) {
      const candidate = fromTimelineEvent(event);
      if (candidate) {
        artifactCandidates.push(candidate);
      }
    }

    for (const message of detail.messages) {
      artifactCandidates.push(...fromMessage(detail, message));
    }

    const deduped = new Map<string, Omit<ArtifactRecord, "id" | "createdAt">>();
    for (const artifact of artifactCandidates) {
      const key = [
        artifact.artifactType,
        artifact.eventId ?? "",
        artifact.path ?? "",
        JSON.stringify(artifact.metadata),
      ].join("|");

      if (!deduped.has(key)) {
        deduped.set(key, {
          sessionId,
          eventId: artifact.eventId,
          artifactType: artifact.artifactType,
          path: artifact.path,
          metadata: JSON.stringify(artifact.metadata),
        });
      }
    }

    const artifacts = db.replaceArtifactsForSession(
      sessionId,
      Array.from(deduped.values()),
    );
    db.completeIngestionRun(run.id, "completed");
    return artifacts;
  } catch (error) {
    db.completeIngestionRun(
      run.id,
      "failed",
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}
