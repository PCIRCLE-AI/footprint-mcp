import { App } from "@modelcontextprotocol/ext-apps";

const app = new App({
  name: "Footprint Export View",
  version: "1.1.1",
});

interface Evidence {
  id: string;
  timestamp: string;
  conversationId: string;
  llmProvider: string;
  messageCount: number;
  tags: string | null;
}

interface ExportResult {
  filename: string;
  checksum: string;
  evidenceCount: number;
  success: boolean;
}

let currentEvidences: Evidence[] = [];
let exportResult: ExportResult | null = null;

function showError(message: string) {
  const container = document.getElementById("error-container");
  if (!container) return;
  
  container.innerHTML = `
    <div class="error">
      ❌ Error: ${message}
    </div>
  `;
}

function showSuccess(message: string) {
  const container = document.getElementById("error-container");
  if (!container) return;
  
  container.innerHTML = `
    <div class="success">
      ✅ ${message}
    </div>
  `;
}

function clearMessages() {
  const container = document.getElementById("error-container");
  if (!container) return;
  container.innerHTML = "";
}

function formatDate(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return timestamp;
  }
}

function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  
  return `${size.toFixed(1)}${units[unitIndex]}`;
}

function getSelectionMode(): 'all' | 'recent' {
  const allRadio = document.getElementById("export-all") as HTMLInputElement;
  return allRadio?.checked ? 'all' : 'recent';
}

function getIncludeGit(): boolean {
  const gitCheckbox = document.getElementById("include-git") as HTMLInputElement;
  return gitCheckbox?.checked || false;
}

function filterEvidences(evidences: Evidence[]): Evidence[] {
  const mode = getSelectionMode();
  
  if (mode === 'recent') {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    return evidences.filter(e => {
      try {
        const evidenceDate = new Date(e.timestamp);
        return evidenceDate >= thirtyDaysAgo;
      } catch {
        return false;
      }
    });
  }
  
  return evidences;
}

function renderPreview(evidences: Evidence[]) {
  const filteredEvidences = filterEvidences(evidences);
  
  const previewLoading = document.getElementById("preview-loading");
  const previewContent = document.getElementById("preview-content");
  const previewEmpty = document.getElementById("preview-empty");
  const previewItems = document.getElementById("preview-items");
  const downloadBtn = document.getElementById("download-btn") as HTMLButtonElement;
  
  if (previewLoading) previewLoading.style.display = "none";
  
  if (filteredEvidences.length === 0) {
    if (previewContent) previewContent.classList.remove("active");
    if (previewEmpty) previewEmpty.style.display = "block";
    if (downloadBtn) downloadBtn.disabled = true;
    hideFileInfo();
    return;
  }
  
  if (previewEmpty) previewEmpty.style.display = "none";
  if (previewContent) previewContent.classList.add("active");
  
  // Render preview items (show first 5 + summary)
  if (previewItems) {
    const itemsToShow = filteredEvidences.slice(0, 5);
    previewItems.innerHTML = itemsToShow.map(e => `
      <div class="preview-item">
        <div class="preview-meta">
          ${e.id.slice(0, 8)}... • ${formatDate(e.timestamp)} • ${e.messageCount} messages
        </div>
        <div>
          <strong>${e.conversationId}</strong> (${e.llmProvider})
          ${e.tags ? ` • Tags: ${e.tags}` : ''}
        </div>
      </div>
    `).join('');
    
    if (filteredEvidences.length > 5) {
      previewItems.innerHTML += `
        <div class="preview-item" style="background: #f8fafc; color: #6b7280; text-align: center; font-style: italic;">
          ... and ${filteredEvidences.length - 5} more evidence records
        </div>
      `;
    }
  }
  
  // Update file info
  showFileInfo(filteredEvidences);
  
  // Enable download button
  if (downloadBtn) downloadBtn.disabled = false;
}

function showFileInfo(evidences: Evidence[]) {
  const fileInfo = document.getElementById("file-info");
  const fileName = document.getElementById("file-name");
  const fileCount = document.getElementById("file-count");
  const fileSize = document.getElementById("file-size");
  
  if (!fileInfo || !fileName || !fileCount || !fileSize) return;
  
  // Generate filename based on selection
  const mode = getSelectionMode();
  const timestamp = new Date().toISOString().slice(0, 10);
  const name = mode === 'recent' 
    ? `evidence-export-recent-${timestamp}.zip`
    : `evidence-export-${timestamp}.zip`;
  
  // Estimate size (rough calculation)
  const avgSizePerEvidence = 2048; // Rough estimate in bytes
  const estimatedSize = evidences.length * avgSizePerEvidence;
  
  fileName.textContent = name;
  fileCount.textContent = evidences.length.toString();
  fileSize.textContent = formatSize(estimatedSize);
  
  fileInfo.style.display = "block";
}

function hideFileInfo() {
  const fileInfo = document.getElementById("file-info");
  if (fileInfo) fileInfo.style.display = "none";
}

function resetPreview() {
  const previewLoading = document.getElementById("preview-loading");
  const previewContent = document.getElementById("preview-content");
  const previewEmpty = document.getElementById("preview-empty");
  const downloadBtn = document.getElementById("download-btn") as HTMLButtonElement;
  
  if (previewLoading) previewLoading.style.display = "block";
  if (previewContent) previewContent.classList.remove("active");
  if (previewEmpty) previewEmpty.style.display = "none";
  if (downloadBtn) downloadBtn.disabled = true;
  
  hideFileInfo();
}

// Handle tool results from the MCP server
app.ontoolresult = (result) => {
  console.log("Received tool result:", result);
  
  try {
    // Check if this is a list-evidences result (for preview)
    if (result.structuredContent && 'evidences' in result.structuredContent) {
      const data = result.structuredContent as { evidences: Evidence[], total: number };
      currentEvidences = data.evidences;
      renderPreview(currentEvidences);
      return;
    }
    
    // Check if this is an export-evidences result
    if (result.structuredContent && 'filename' in result.structuredContent) {
      exportResult = result.structuredContent as ExportResult;
      
      if (exportResult.success) {
        showSuccess(`Export completed! ${exportResult.evidenceCount} evidence files exported to ${exportResult.filename}`);
        
        // Update model context to inform AI
        app.updateModelContext({
          content: [{
            type: "text",
            text: `User successfully exported ${exportResult.evidenceCount} evidence files. Export saved as: ${exportResult.filename} (checksum: ${exportResult.checksum})`
          }]
        }).catch(console.error);
      } else {
        showError("Export failed. Please try again.");
      }
      return;
    }
    
    console.warn("Unexpected tool result format:", result);
  } catch (e) {
    console.error("Failed to parse tool result:", e);
    showError(`Failed to process result: ${e instanceof Error ? e.message : 'Unknown error'}`);
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

(window as any).refreshPreview = async () => {
  try {
    clearMessages();
    resetPreview();
    
    // Fetch latest evidence list
    await app.callServerTool({
      name: "list-evidences",
      arguments: { limit: 1000 } // Get all for preview
    });
  } catch (error) {
    console.error("Failed to refresh preview:", error);
    showError(`Failed to refresh preview: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

(window as any).downloadExport = async () => {
  try {
    clearMessages();
    
    const downloadBtn = document.getElementById("download-btn") as HTMLButtonElement;
    if (downloadBtn) {
      downloadBtn.disabled = true;
      downloadBtn.innerHTML = '⏳ Exporting...';
    }
    
    // Determine which evidences to export
    const filteredEvidences = filterEvidences(currentEvidences);
    const evidenceIds = filteredEvidences.map(e => e.id);
    const includeGit = getIncludeGit();
    
    if (evidenceIds.length === 0) {
      showError("No evidence selected for export");
      return;
    }
    
    // Call export tool
    await app.callServerTool({
      name: "export-evidences",
      arguments: {
        evidenceIds,
        includeGitInfo: includeGit
      }
    });
    
  } catch (error) {
    console.error("Export failed:", error);
    showError(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    // Reset button
    const downloadBtn = document.getElementById("download-btn") as HTMLButtonElement;
    if (downloadBtn) {
      downloadBtn.disabled = false;
      downloadBtn.innerHTML = '📥 Download Export';
    }
  }
};

// Set up event listeners for option changes
function setupEventListeners() {
  const selectionRadios = document.querySelectorAll('input[name="selection"]');
  const gitCheckbox = document.getElementById("include-git");
  
  selectionRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (currentEvidences.length > 0) {
        renderPreview(currentEvidences);
      }
    });
  });
  
  if (gitCheckbox) {
    gitCheckbox.addEventListener('change', () => {
      // Git info doesn't affect preview, but update UI feedback
      console.log("Git info toggle:", getIncludeGit());
    });
  }
}

// Initialize the app
console.log("Connecting export view to MCP host...");
app.connect().then(() => {
  console.log("Export view connected to MCP host successfully");
  
  setupEventListeners();
  
  // Load initial preview
  (window as any).refreshPreview();
}).catch(error => {
  console.error("Failed to connect to MCP host:", error);
  showError("Failed to connect to MCP server");
});