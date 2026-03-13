import type { ArtifactRecord } from "./storage/index.js";

export interface ArtifactSourceRef {
  type: "message" | "event" | "artifact";
  id: string;
}

export interface ArtifactMetadataView {
  sourceRefs: ArtifactSourceRef[];
  summary: string | null;
  category: string | null;
  status: string | null;
  outcome: string | null;
  intent: string | null;
  commandFamily: string | null;
  command: string | null;
  args: string[];
  framework: string | null;
  packageManager: string | null;
  scriptName: string | null;
  dependencyAction: string | null;
  dependencyNames: string[];
  failureSignatureKey: string | null;
  failureSignatureLabel: string | null;
  errorCode: string | null;
  lintRuleId: string | null;
  testSuite: string | null;
  testCase: string | null;
  issueKey: string | null;
  issueLabel: string | null;
  issueFamilyKey: string | null;
  issueFamilyLabel: string | null;
  pathCategory: string | null;
  changeScope: string | null;
  manifestKind: string | null;
  previousHead: string | null;
  currentHead: string | null;
  details: Record<string, unknown>;
}

export interface ArtifactSummaryView {
  total: number;
  byType: {
    fileChange: number;
    commandOutput: number;
    testResult: number;
    gitCommit: number;
  };
}

function parseJsonRecord(value: string | null): Record<string, unknown> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function parseSourceRefs(value: unknown): ArtifactSourceRef[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is ArtifactSourceRef =>
    Boolean(
      item &&
      typeof item === "object" &&
      (item as ArtifactSourceRef).id &&
      typeof (item as ArtifactSourceRef).id === "string" &&
      ["message", "event", "artifact"].includes(
        (item as ArtifactSourceRef).type,
      ),
    ),
  );
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function parseArtifactMetadata(
  metadata: string | null,
): ArtifactMetadataView {
  const parsed = parseJsonRecord(metadata);

  return {
    sourceRefs: parseSourceRefs(parsed.sourceRefs),
    summary: getString(parsed.summary),
    category: getString(parsed.category),
    status: getString(parsed.status),
    outcome: getString(parsed.outcome),
    intent: getString(parsed.intent),
    commandFamily: getString(parsed.commandFamily),
    command: getString(parsed.command),
    args: toStringArray(parsed.args),
    framework: getString(parsed.framework),
    packageManager: getString(parsed.packageManager),
    scriptName: getString(parsed.scriptName),
    dependencyAction: getString(parsed.dependencyAction),
    dependencyNames: toStringArray(parsed.dependencyNames),
    failureSignatureKey: getString(parsed.failureSignatureKey),
    failureSignatureLabel: getString(parsed.failureSignatureLabel),
    errorCode: getString(parsed.errorCode),
    lintRuleId: getString(parsed.lintRuleId),
    testSuite: getString(parsed.testSuite),
    testCase: getString(parsed.testCase),
    issueKey: getString(parsed.issueKey),
    issueLabel: getString(parsed.issueLabel),
    issueFamilyKey: getString(parsed.issueFamilyKey),
    issueFamilyLabel: getString(parsed.issueFamilyLabel),
    pathCategory: getString(parsed.pathCategory),
    changeScope: getString(parsed.changeScope),
    manifestKind: getString(parsed.manifestKind),
    previousHead: getString(parsed.previousHead),
    currentHead: getString(parsed.currentHead),
    details: parsed,
  };
}

export function getArtifactSummaryText(
  artifact: Pick<ArtifactRecord, "artifactType" | "path" | "metadata">,
): string {
  const metadata = parseArtifactMetadata(artifact.metadata);
  if (metadata.summary) {
    return metadata.summary;
  }

  if (artifact.artifactType === "file-change") {
    return artifact.path ? `File changed: ${artifact.path}` : "File changed";
  }

  if (artifact.artifactType === "git-commit") {
    return metadata.currentHead
      ? `Git commit: ${metadata.currentHead}`
      : "Git commit captured";
  }

  if (artifact.artifactType === "test-result") {
    return "Test result captured";
  }

  return "Command activity captured";
}

export function buildArtifactSummary(
  artifacts: ArtifactRecord[],
): ArtifactSummaryView {
  return {
    total: artifacts.length,
    byType: {
      fileChange: artifacts.filter(
        (artifact) => artifact.artifactType === "file-change",
      ).length,
      commandOutput: artifacts.filter(
        (artifact) => artifact.artifactType === "command-output",
      ).length,
      testResult: artifacts.filter(
        (artifact) => artifact.artifactType === "test-result",
      ).length,
      gitCommit: artifacts.filter(
        (artifact) => artifact.artifactType === "git-commit",
      ).length,
    },
  };
}

export function getArtifactSearchableText(
  artifact: Pick<ArtifactRecord, "artifactType" | "path" | "metadata">,
): string[] {
  const metadata = parseArtifactMetadata(artifact.metadata);

  return [
    artifact.artifactType,
    artifact.path ?? "",
    metadata.summary ?? "",
    metadata.category ?? "",
    metadata.status ?? "",
    metadata.outcome ?? "",
    metadata.intent ?? "",
    metadata.commandFamily ?? "",
    metadata.command ?? "",
    metadata.framework ?? "",
    metadata.packageManager ?? "",
    metadata.scriptName ?? "",
    metadata.dependencyAction ?? "",
    metadata.dependencyNames.join(" "),
    metadata.failureSignatureKey ?? "",
    metadata.failureSignatureLabel ?? "",
    metadata.errorCode ?? "",
    metadata.lintRuleId ?? "",
    metadata.testSuite ?? "",
    metadata.testCase ?? "",
    metadata.issueKey ?? "",
    metadata.issueLabel ?? "",
    metadata.issueFamilyKey ?? "",
    metadata.issueFamilyLabel ?? "",
    metadata.pathCategory ?? "",
    metadata.changeScope ?? "",
    metadata.manifestKind ?? "",
    metadata.previousHead ?? "",
    metadata.currentHead ?? "",
  ].filter(Boolean);
}
