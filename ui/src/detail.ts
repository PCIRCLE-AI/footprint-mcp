import { App } from "@modelcontextprotocol/ext-apps";
import { getIntlLocale, initPageI18n, t } from "./i18n";

const app = new App({
  name: "Footprint Detail View",
  version: "1.1.1",
});

initPageI18n();

interface Evidence {
  id: string;
  timestamp: string;
  conversationId: string;
  llmProvider: string;
  content: string;
  messageCount: number;
  gitInfo?: {
    commitHash: string;
    timestamp: string;
  } | null;
  tags?: string | null;
}

let currentEvidence: Evidence | null = null;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

declare global {
  interface Window {
    goBack: () => void;
    exportEvidence: () => Promise<void>;
    verifyEvidence: () => Promise<void>;
    copyToClipboard: () => Promise<void>;
  }
}

function showError(message: string) {
  const container = document.getElementById("error-container");
  if (!container) return;

  container.innerHTML = `
    <div class="error">
      ${escapeHtml(message)}
    </div>
  `;
}

function showSuccess(message: string) {
  const container = document.getElementById("error-container");
  if (!container) return;

  container.innerHTML = `
    <div class="success">
      ${escapeHtml(message)}
    </div>
  `;
}

function setButtonLabel(button: HTMLButtonElement | null, label: string): void {
  if (!button) return;
  const span = button.querySelector("span");
  if (span) {
    span.textContent = label;
  } else {
    button.textContent = label;
  }
}

function hideLoading() {
  const loading = document.getElementById("loading");
  const detail = document.getElementById("detail-container");

  if (loading) loading.style.display = "none";
  if (detail) detail.style.display = "block";
}

function formatDate(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleString(getIntlLocale(), {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return timestamp;
  }
}

function formatTags(tags: string | null): string {
  if (!tags) return t("evidenceDetail.labels.none");

  const tagList = tags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
  return tagList
    .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
    .join("");
}

function renderEvidence(evidence: Evidence) {
  currentEvidence = evidence;

  // Update metadata
  const elements = {
    "evidence-id": evidence.id,
    "evidence-timestamp": formatDate(evidence.timestamp),
    "conversation-id": evidence.conversationId,
    "llm-provider": evidence.llmProvider,
    "message-count": evidence.messageCount.toString(),
  };

  Object.entries(elements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });

  // Update tags with HTML
  const tagsElement = document.getElementById("evidence-tags");
  if (tagsElement) {
    tagsElement.innerHTML = formatTags(evidence.tags);
  }

  // Update git info
  const gitContainer = document.getElementById("git-info-container");
  if (gitContainer) {
    if (evidence.gitInfo) {
      gitContainer.innerHTML = `
        <div class="git-info">
          <div style="margin-bottom: 0.5rem;">
            <span class="label">${escapeHtml(t("evidenceDetail.gitCommit"))}:</span>
            <span class="value">${escapeHtml(evidence.gitInfo.commitHash)}</span>
          </div>
          <div>
            <span class="label">${escapeHtml(t("evidenceDetail.gitTimestamp"))}:</span>
            <span class="value">${formatDate(evidence.gitInfo.timestamp)}</span>
          </div>
        </div>
      `;
    } else {
      gitContainer.innerHTML = "";
    }
  }

  // Update content
  const contentElement = document.getElementById("evidence-content");
  if (contentElement) {
    contentElement.textContent = evidence.content;
  }

  hideLoading();
}

// Handle tool results from the MCP server
app.ontoolresult = (result) => {
  console.log("Received tool result:", result);

  try {
    const textContent = result.content?.find((c) => c.type === "text")?.text;
    if (!textContent) {
      throw new Error(t("evidenceDetail.error.noText"));
    }

    // Try to parse structured content first, fallback to text parsing
    let data: Evidence;

    if (
      result.structuredContent &&
      typeof result.structuredContent === "object"
    ) {
      data = result.structuredContent as Evidence;
    } else {
      throw new Error(t("evidenceDetail.error.invalidPayload"));
    }

    console.log("Parsed evidence data:", data);
    renderEvidence(data);
  } catch (e) {
    console.error("Failed to parse tool result:", e);
    showError(
      t("evidenceDetail.error.load", {
        message: e instanceof Error ? e.message : t("common.unknownError"),
      }),
    );
    hideLoading();
  }
};

// Global functions for the UI
window.goBack = () => {
  // Navigate back to dashboard by calling list-evidences
  app
    .callServerTool({
      name: "list-evidences",
      arguments: {},
    })
    .catch((error) => {
      console.error("Failed to go back to dashboard:", error);
      showError(t("evidenceDetail.error.goBack"));
    });
};

window.exportEvidence = async () => {
  if (!currentEvidence) {
    showError(t("evidenceDetail.error.noEvidenceLoaded"));
    return;
  }

  try {
    const result = await app.callServerTool({
      name: "export-evidences",
      arguments: {
        evidenceIds: [currentEvidence.id],
        includeGitInfo: true,
      },
    });

    // Update model context to let AI know user exported evidence
    await app.updateModelContext({
      content: [
        {
          type: "text",
          text: `User exported evidence ${currentEvidence.id} from detail view`,
        },
      ],
    });

    console.log("Export result:", result);
    showSuccess(
      t("evidenceDetail.export.success", {
        id: currentEvidence.id.slice(0, 8),
      }),
    );
  } catch (error) {
    console.error("Export failed:", error);
    showError(
      t("evidenceDetail.error.export", {
        message:
          error instanceof Error ? error.message : t("common.unknownError"),
      }),
    );
  }
};

window.verifyEvidence = async () => {
  if (!currentEvidence) {
    showError(t("evidenceDetail.error.noEvidenceLoaded"));
    return;
  }

  try {
    const result = await app.callServerTool({
      name: "verify-evidence",
      arguments: { id: currentEvidence.id },
    });

    // Update model context
    await app.updateModelContext({
      content: [
        {
          type: "text",
          text: `User verified evidence ${currentEvidence.id} from detail view`,
        },
      ],
    });

    console.log("Verification result:", result);
    showSuccess(t("evidenceDetail.verify.success"));
  } catch (error) {
    console.error("Verification failed:", error);
    showError(
      t("evidenceDetail.error.verify", {
        message:
          error instanceof Error ? error.message : t("common.unknownError"),
      }),
    );
  }
};

window.copyToClipboard = async () => {
  if (!currentEvidence) {
    showError(t("evidenceDetail.error.noText"));
    return;
  }

  try {
    await navigator.clipboard.writeText(currentEvidence.content);

    // Visual feedback
    const button = document.querySelector(
      'button[onclick="copyToClipboard()"]',
    ) as HTMLButtonElement;
    if (button) {
      const originalText =
        button.querySelector("span")?.textContent ?? button.textContent ?? "";
      setButtonLabel(button, t("common.copied"));
      button.disabled = true;

      setTimeout(() => {
        setButtonLabel(button, originalText);
        button.disabled = false;
      }, 2000);
    }

    // Update model context
    await app.updateModelContext({
      content: [
        {
          type: "text",
          text: `User copied content of evidence ${currentEvidence.id} to clipboard`,
        },
      ],
    });
    showSuccess(t("evidenceDetail.copy.success"));
  } catch (error) {
    console.error("Copy failed:", error);
    showError(t("evidenceDetail.error.copy"));
  }
};

// Initialize the app
console.log("Connecting detail view to MCP host...");
app
  .connect()
  .then(() => {
    console.log("Detail view connected to MCP host successfully");
  })
  .catch((error) => {
    console.error("Failed to connect to MCP host:", error);
    showError(t("evidenceDetail.error.connect"));
    hideLoading();
  });
