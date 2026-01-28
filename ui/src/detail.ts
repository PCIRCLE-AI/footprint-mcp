import { App } from "@modelcontextprotocol/ext-apps";

const app = new App({
  name: "Footprint Detail View",
  version: "1.1.1",
});

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

function showError(message: string) {
  const container = document.getElementById("error-container");
  if (!container) return;
  
  container.innerHTML = `
    <div class="error">
      ❌ Error: ${message}
    </div>
  `;
}

function hideLoading() {
  const loading = document.getElementById("loading");
  const detail = document.getElementById("detail-container");
  
  if (loading) loading.style.display = "none";
  if (detail) detail.style.display = "block";
}

function formatDate(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
  } catch {
    return timestamp;
  }
}

function formatTags(tags: string | null): string {
  if (!tags) return 'None';
  
  const tagList = tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
  return tagList.map(tag => `<span class="tag">${tag}</span>`).join('');
}

function truncateId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}...${id.slice(-4)}` : id;
}

function renderEvidence(evidence: Evidence) {
  currentEvidence = evidence;
  
  // Update metadata
  const elements = {
    'evidence-id': evidence.id,
    'evidence-timestamp': formatDate(evidence.timestamp),
    'conversation-id': evidence.conversationId,
    'llm-provider': evidence.llmProvider,
    'message-count': evidence.messageCount.toString(),
  };
  
  Object.entries(elements).forEach(([id, value]) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  });
  
  // Update tags with HTML
  const tagsElement = document.getElementById('evidence-tags');
  if (tagsElement) {
    tagsElement.innerHTML = formatTags(evidence.tags);
  }
  
  // Update git info
  const gitContainer = document.getElementById('git-info-container');
  if (gitContainer) {
    if (evidence.gitInfo) {
      gitContainer.innerHTML = `
        <div class="git-info">
          <div style="margin-bottom: 0.5rem;">
            <span class="label">Git Commit:</span>
            <span class="value">${evidence.gitInfo.commitHash}</span>
          </div>
          <div>
            <span class="label">Git Timestamp:</span>
            <span class="value">${formatDate(evidence.gitInfo.timestamp)}</span>
          </div>
        </div>
      `;
    } else {
      gitContainer.innerHTML = '';
    }
  }
  
  // Update content
  const contentElement = document.getElementById('evidence-content');
  if (contentElement) {
    contentElement.textContent = evidence.content;
  }
  
  hideLoading();
}

// Handle tool results from the MCP server
app.ontoolresult = (result) => {
  console.log("Received tool result:", result);
  
  try {
    const textContent = result.content?.find(c => c.type === "text")?.text;
    if (!textContent) {
      throw new Error("No text content in tool result");
    }
    
    // Try to parse structured content first, fallback to text parsing
    let data: Evidence;
    
    if (result.structuredContent && typeof result.structuredContent === 'object') {
      data = result.structuredContent as Evidence;
    } else {
      // Fallback: parse from text content (though get-evidence should have structured content)
      throw new Error("get-evidence tool should provide structured content");
    }
    
    console.log("Parsed evidence data:", data);
    renderEvidence(data);
  } catch (e) {
    console.error("Failed to parse tool result:", e);
    showError(`Failed to load evidence details: ${e instanceof Error ? e.message : 'Unknown error'}`);
    hideLoading();
  }
};

// Global functions for the UI
(window as any).goBack = () => {
  // Navigate back to dashboard by calling list-evidences
  app.callServerTool({
    name: "list-evidences",
    arguments: {}
  }).catch(error => {
    console.error("Failed to go back to dashboard:", error);
    showError("Failed to navigate back to dashboard");
  });
};

(window as any).exportEvidence = async () => {
  if (!currentEvidence) {
    showError("No evidence loaded");
    return;
  }
  
  try {
    const result = await app.callServerTool({
      name: "export-evidences", 
      arguments: { 
        evidenceIds: [currentEvidence.id],
        includeGitInfo: true 
      }
    });
    
    // Update model context to let AI know user exported evidence
    await app.updateModelContext({
      content: [{
        type: "text",
        text: `User exported evidence ${currentEvidence.id} from detail view`
      }]
    });
    
    console.log("Export result:", result);
  } catch (error) {
    console.error("Export failed:", error);
    showError(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

(window as any).verifyEvidence = async () => {
  if (!currentEvidence) {
    showError("No evidence loaded");
    return;
  }
  
  try {
    const result = await app.callServerTool({
      name: "verify-evidence",
      arguments: { id: currentEvidence.id }
    });
    
    // Update model context
    await app.updateModelContext({
      content: [{
        type: "text", 
        text: `User verified evidence ${currentEvidence.id} from detail view`
      }]
    });
    
    console.log("Verification result:", result);
  } catch (error) {
    console.error("Verification failed:", error);
    showError(`Verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

(window as any).copyToClipboard = async () => {
  if (!currentEvidence) {
    showError("No evidence content to copy");
    return;
  }
  
  try {
    await navigator.clipboard.writeText(currentEvidence.content);
    
    // Visual feedback
    const button = document.querySelector('button[onclick="copyToClipboard()"]') as HTMLButtonElement;
    if (button) {
      const originalText = button.innerHTML;
      button.innerHTML = '✓ Copied!';
      button.disabled = true;
      
      setTimeout(() => {
        button.innerHTML = originalText;
        button.disabled = false;
      }, 2000);
    }
    
    // Update model context
    await app.updateModelContext({
      content: [{
        type: "text",
        text: `User copied content of evidence ${currentEvidence.id} to clipboard`
      }]
    });
  } catch (error) {
    console.error("Copy failed:", error);
    showError("Failed to copy content to clipboard");
  }
};

// Initialize the app
console.log("Connecting detail view to MCP host...");
app.connect().then(() => {
  console.log("Detail view connected to MCP host successfully");
}).catch(error => {
  console.error("Failed to connect to MCP host:", error);
  showError("Failed to connect to MCP server");
  hideLoading();
});