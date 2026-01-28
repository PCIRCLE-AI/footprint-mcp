import { App } from "@modelcontextprotocol/ext-apps";

const app = new App({
  name: "Footprint Dashboard",
  version: "1.1.1",
});

let lastDashboardData: DashboardData | null = null;
let activeTagFilters: Set<string> = new Set();
let filterMode: 'AND' | 'OR' = 'AND';
let allEvidences: Evidence[] = [];
let lastActivityCheck: Date | null = null;
let pollingInterval: number | null = null;
let isConnected = false;
let selectedEvidenceIds: Set<string> = new Set();
let searchQuery: string = '';

interface Evidence {
  id: string;
  conversationId: string;
  timestamp: string;
  tags: string[];
  llmProvider: string;
  messageCount: number;
  encrypted?: boolean;
  size?: number;
}

interface DashboardData {
  evidences: Evidence[];
  total?: number;
  todayCount?: number;
  totalSize?: number;
  tagCount?: number;
}

interface TimelinePoint {
  date: string;
  count: number;
  evidences: Evidence[];
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

function formatDate(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return timestamp;
  }
}

// Tag Management Functions
function getAllTags(evidences: Evidence[]): string[] {
  const tagSet = new Set<string>();
  evidences.forEach(evidence => {
    evidence.tags?.forEach(tag => tagSet.add(tag));
  });
  return Array.from(tagSet).sort();
}

function getTagColor(tag: string): string {
  // Simple hash function to generate consistent colors for tags
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1'
  ];
  return colors[Math.abs(hash) % colors.length];
}

function createTagChip(tag: string, options: {
  isActive?: boolean;
  isClickable?: boolean;
  showClose?: boolean;
  color?: string;
} = {}): string {
  const { isActive = false, isClickable = true, showClose = false, color } = options;
  const chipColor = color || getTagColor(tag);
  const classes = `tag-chip ${isActive ? 'active' : ''} ${isClickable ? 'clickable' : ''}`;
  const style = isActive ? '' : `border-color: ${chipColor}20; background: ${chipColor}10; color: ${chipColor}`;
  const closeButton = showClose ? `<span class="tag-close" data-tag="${tag}">&times;</span>` : '';
  
  return `<span class="${classes}" data-tag="${tag}" style="${style}">${tag}${closeButton}</span>`;
}

function filterEvidences(evidences: Evidence[]): Evidence[] {
  let filtered = evidences;
  
  // Apply search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(evidence => {
      const searchableText = [
        evidence.id,
        evidence.conversationId,
        evidence.llmProvider,
        ...(evidence.tags || [])
      ].join(' ').toLowerCase();
      return searchableText.includes(query);
    });
  }
  
  // Apply tag filter
  if (activeTagFilters.size > 0) {
    filtered = filtered.filter(evidence => {
      const evidenceTags = evidence.tags || [];
      const filterTags = Array.from(activeTagFilters);
      
      if (filterMode === 'AND') {
        return filterTags.every(tag => evidenceTags.includes(tag));
      } else {
        return filterTags.some(tag => evidenceTags.includes(tag));
      }
    });
  }
  
  return filtered;
}

// Search highlighting function
function highlightText(text: string, query: string): string {
  if (!query.trim()) return text;
  
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  return text.replace(regex, '<span class="highlight">$1</span>');
}

// Update search results info
function updateSearchInfo(totalCount: number, filteredCount: number) {
  const info = document.getElementById('search-results-info');
  if (!info) return;
  
  if (searchQuery.trim()) {
    if (filteredCount === 0) {
      info.textContent = `No results found for "${searchQuery}"`;
    } else if (filteredCount < totalCount) {
      info.textContent = `Showing ${filteredCount} of ${totalCount} evidence (filtered by search)`;
    } else {
      info.textContent = `${filteredCount} results`;
    }
  } else {
    info.textContent = '';
  }
}

function updateTagFilters() {
  const container = document.getElementById('tag-filter-chips');
  const clearBtn = document.getElementById('clear-filters-btn');
  
  if (!container || !clearBtn) return;
  
  const allTags = getAllTags(allEvidences);
  
  container.innerHTML = allTags.map(tag => 
    createTagChip(tag, { 
      isActive: activeTagFilters.has(tag),
      showClose: activeTagFilters.has(tag)
    })
  ).join('');
  
  clearBtn.style.display = activeTagFilters.size > 0 ? 'block' : 'none';
  
  // Add click listeners
  container.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('tag-close')) {
      const tag = target.getAttribute('data-tag');
      if (tag) {
        activeTagFilters.delete(tag);
        updateView();
      }
    } else if (target.classList.contains('tag-chip')) {
      const tag = target.getAttribute('data-tag');
      if (tag) {
        toggleTagFilter(tag);
      }
    }
  });
}

function toggleTagFilter(tag: string) {
  if (activeTagFilters.has(tag)) {
    activeTagFilters.delete(tag);
  } else {
    activeTagFilters.add(tag);
  }
  updateView();
}

function updateView() {
  if (!allEvidences.length) return;
  
  const filteredEvidences = filterEvidences(allEvidences);
  renderTable(filteredEvidences);
  renderTimeline(filteredEvidences);
  updateStats({ evidences: filteredEvidences });
  updateTagFilters();
}

// Modal Management Functions
function showTagModal() {
  const modal = document.getElementById('tag-modal');
  const tagList = document.getElementById('tag-list');
  if (!modal || !tagList) return;
  
  modal.classList.add('show');
  renderTagList();
}

function hideTagModal() {
  const modal = document.getElementById('tag-modal');
  if (modal) {
    modal.classList.remove('show');
  }
}

function renderTagList() {
  const tagList = document.getElementById('tag-list');
  if (!tagList) return;
  
  const allTags = getAllTags(allEvidences);
  if (allTags.length === 0) {
    tagList.innerHTML = '<div class="no-tags">No tags found</div>';
    return;
  }
  
  // Calculate tag counts
  const tagCounts = new Map<string, number>();
  allEvidences.forEach(evidence => {
    evidence.tags?.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });
  });
  
  tagList.innerHTML = allTags.map(tag => {
    const count = tagCounts.get(tag) || 0;
    const color = getTagColor(tag);
    return `
      <div class="tag-item">
        <div class="tag-item-info">
          ${createTagChip(tag, { isClickable: false, color })}
          <span class="tag-count">${count}</span>
        </div>
        <div class="tag-item-actions">
          <button class="btn-sm" onclick="editTag('${tag.replace(/'/g, "\\'")}')">Rename</button>
          <button class="btn-sm danger" onclick="deleteTag('${tag.replace(/'/g, "\\'")}')">Delete</button>
        </div>
      </div>
    `;
  }).join('');
}

async function editTag(oldTag: string) {
  const newTag = prompt(`Rename tag "${oldTag}" to:`, oldTag);
  if (newTag && newTag.trim() && newTag !== oldTag) {
    try {
      const result = await app.callServerTool({
        name: 'rename-tag',
        arguments: { oldTag, newTag: newTag.trim() }
      });
      
      const structuredContent = result.structuredContent as { updatedCount: number; success: boolean } | undefined;
      
      if (structuredContent?.success) {
        alert(`Renamed tag "${oldTag}" to "${newTag.trim()}" in ${structuredContent.updatedCount} evidence(s)`);
        // Refresh data to show updated tags
        await refreshData();
        renderTagList();
      } else {
        alert(`No evidence found with tag "${oldTag}"`);
      }
    } catch (error) {
      console.error('Failed to rename tag:', error);
      alert(`Failed to rename tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

async function deleteTag(tag: string) {
  if (confirm(`Delete tag "${tag}" from all evidence? This cannot be undone.`)) {
    try {
      const result = await app.callServerTool({
        name: 'remove-tag',
        arguments: { tag }
      });
      
      const structuredContent = result.structuredContent as { updatedCount: number; success: boolean } | undefined;
      
      if (structuredContent?.success) {
        alert(`Removed tag "${tag}" from ${structuredContent.updatedCount} evidence(s)`);
        // Refresh data to show updated tags
        await refreshData();
        renderTagList();
      } else {
        alert(`No evidence found with tag "${tag}"`);
      }
    } catch (error) {
      console.error('Failed to delete tag:', error);
      alert(`Failed to delete tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

function updateStats(data: DashboardData) {
  const totalElement = document.getElementById("total-count");
  const todayElement = document.getElementById("today-count");
  const sizeElement = document.getElementById("total-size");
  const tagElement = document.getElementById("tag-count");
  
  if (totalElement) {
    totalElement.textContent = String(data.total ?? data.evidences?.length ?? 0);
  }
  
  if (todayElement) {
    const today = new Date().toDateString();
    const todayCount = data.evidences?.filter(e => 
      new Date(e.timestamp).toDateString() === today
    ).length ?? 0;
    todayElement.textContent = String(data.todayCount ?? todayCount);
  }
  
  if (sizeElement) {
    const totalSize = data.totalSize ?? 
      data.evidences?.reduce((sum, e) => sum + (e.size ?? 0), 0) ?? 0;
    sizeElement.textContent = formatSize(totalSize);
  }
  
  if (tagElement) {
    const uniqueTags = new Set(data.evidences?.flatMap(e => e.tags) ?? []);
    tagElement.textContent = String(data.tagCount ?? uniqueTags.size);
  }
}

function renderTable(evidences: Evidence[]) {
  const tbody = document.querySelector("#evidence-table tbody");
  if (!tbody) return;
  
  // Update search results info
  updateSearchInfo(allEvidences.length, evidences.length);
  
  if (!evidences || evidences.length === 0) {
    let noResultsMessage = 'No evidence found';
    if (searchQuery.trim()) {
      noResultsMessage = `No evidence matches "${searchQuery}"`;
    } else if (activeTagFilters.size > 0) {
      noResultsMessage = `No evidence matches the selected tag${activeTagFilters.size > 1 ? 's' : ''}: ${Array.from(activeTagFilters).join(', ')}`;
    }
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="loading">${noResultsMessage}</td>
      </tr>
    `;
    return;
  }
  
  tbody.innerHTML = evidences.map(e => {
    const tagChips = e.tags?.length 
      ? e.tags.map(tag => createTagChip(tag, { isClickable: true })).join(' ')
      : '<span style="color: #9ca3af; font-style: italic;">No tags</span>';
    
    // Apply highlighting to searchable fields
    const displayId = highlightText(e.id.slice(0, 8), searchQuery) + '...';
    const displayConversationId = highlightText(e.conversationId || 'N/A', searchQuery);
    const displayProvider = searchQuery.trim() ? highlightText(e.llmProvider || '', searchQuery) : '';
    
    return `
      <tr data-evidence-id="${e.id}">
        <td class="checkbox-cell">
          <input type="checkbox" class="evidence-checkbox" value="${e.id}" ${selectedEvidenceIds.has(e.id) ? 'checked' : ''}>
        </td>
        <td title="${e.id}">${displayId}</td>
        <td>${displayConversationId}${displayProvider ? ` <small style="color:#6b7280">(${displayProvider})</small>` : ''}</td>
        <td>${formatDate(e.timestamp)}</td>
        <td class="tag-cell">${tagChips}</td>
      </tr>
    `;
  }).join("");
  
  // Re-attach event listeners for checkboxes
  setupEvidenceCheckboxes();
  
  // Add click listeners for tag chips in table
  tbody.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('tag-chip') && target.classList.contains('clickable')) {
      const tag = target.getAttribute('data-tag');
      if (tag) {
        toggleTagFilter(tag);
      }
    }
  });
}

function getTimelinePeriod(): string {
  const activeBtn = document.querySelector('.timeline-btn.active');
  return activeBtn?.getAttribute('data-period') || '7d';
}

function filterEvidencesByPeriod(evidences: Evidence[], period: string): Evidence[] {
  if (period === 'all') return evidences;
  
  const now = new Date();
  const days = parseInt(period.replace('d', ''));
  const cutoff = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
  
  return evidences.filter(e => {
    try {
      return new Date(e.timestamp) >= cutoff;
    } catch {
      return false;
    }
  });
}

function groupEvidencesByDate(evidences: Evidence[]): TimelinePoint[] {
  const groups = new Map<string, Evidence[]>();
  
  evidences.forEach(evidence => {
    try {
      const date = new Date(evidence.timestamp).toISOString().split('T')[0];
      if (!groups.has(date)) {
        groups.set(date, []);
      }
      groups.get(date)!.push(evidence);
    } catch {
      // Skip invalid timestamps
    }
  });
  
  return Array.from(groups.entries())
    .map(([date, evidences]) => ({
      date,
      count: evidences.length,
      evidences
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function renderTimeline(evidences: Evidence[]) {
  const timeline = document.getElementById('timeline');
  const timelineLoading = document.getElementById('timeline-loading');
  
  if (!timeline || !timelineLoading) return;
  
  const period = getTimelinePeriod();
  const filteredEvidences = filterEvidencesByPeriod(evidences, period);
  const timelinePoints = groupEvidencesByDate(filteredEvidences);
  
  timelineLoading.style.display = 'none';
  
  // Clear existing timeline points
  const existingPoints = timeline.querySelectorAll('.timeline-point, .timeline-label, .timeline-tooltip');
  existingPoints.forEach(el => el.remove());
  
  if (timelinePoints.length === 0) {
    timeline.innerHTML = '<div class="timeline-axis"></div><div style="text-align: center; padding: 2rem; color: #6b7280;">No evidence in this time period</div>';
    return;
  }
  
  // Calculate positions
  const containerWidth = timeline.clientWidth || 800;
  const margin = 40;
  const availableWidth = containerWidth - (margin * 2);
  
  // Determine date range
  let startDate: Date, endDate: Date;
  
  if (period === 'all') {
    startDate = new Date(timelinePoints[0].date);
    endDate = new Date(timelinePoints[timelinePoints.length - 1].date);
  } else {
    const now = new Date();
    const days = parseInt(period.replace('d', ''));
    startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
    endDate = now;
  }
  
  const timeRange = endDate.getTime() - startDate.getTime();
  
  timelinePoints.forEach(point => {
    const pointDate = new Date(point.date);
    const relativePosition = (pointDate.getTime() - startDate.getTime()) / timeRange;
    const x = margin + (relativePosition * availableWidth);
    
    // Create timeline point
    const pointElement = document.createElement('div');
    pointElement.className = `timeline-point ${point.count > 1 ? 'multiple' : ''}`;
    pointElement.style.left = `${x}px`;
    
    // Create label
    const labelElement = document.createElement('div');
    labelElement.className = 'timeline-label';
    labelElement.style.left = `${x}px`;
    
    if (period === '7d') {
      labelElement.textContent = pointDate.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
    } else if (period === '30d') {
      labelElement.textContent = pointDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      labelElement.textContent = pointDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
    
    // Create tooltip
    const tooltipElement = document.createElement('div');
    tooltipElement.className = 'timeline-tooltip';
    tooltipElement.style.left = `${x}px`;
    
    if (point.count === 1) {
      const evidence = point.evidences[0];
      tooltipElement.innerHTML = `
        <div><strong>${evidence.conversationId}</strong></div>
        <div>${evidence.llmProvider}</div>
        <div>${point.count} evidence</div>
      `;
    } else {
      tooltipElement.innerHTML = `
        <div><strong>${point.count} evidence items</strong></div>
        <div>${pointDate.toLocaleDateString()}</div>
        <div>Click to view details</div>
      `;
    }
    
    // Add hover events
    pointElement.addEventListener('mouseenter', () => {
      tooltipElement.style.display = 'block';
    });
    
    pointElement.addEventListener('mouseleave', () => {
      tooltipElement.style.display = 'none';
    });
    
    // Add click event to filter table
    pointElement.addEventListener('click', () => {
      renderTable(point.evidences);
      
      // Visual feedback
      document.querySelectorAll('.timeline-point').forEach(p => p.style.boxShadow = '0 0 0 1px #e5e7eb');
      pointElement.style.boxShadow = '0 0 0 2px #2563eb';
    });
    
    timeline.appendChild(pointElement);
    timeline.appendChild(labelElement);
    timeline.appendChild(tooltipElement);
  });
}

// Recent Activity Functions
function getRecentEvidences(evidences: Evidence[], count: number = 5): Evidence[] {
  return evidences
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, count);
}

function formatRelativeTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  } catch {
    return 'Unknown';
  }
}

function updateLastUpdatedDisplay() {
  const lastUpdatedText = document.getElementById('last-updated-text');
  const statusDot = document.getElementById('status-dot');
  
  if (lastUpdatedText && statusDot) {
    const now = new Date();
    lastUpdatedText.textContent = `Updated ${now.toLocaleTimeString()}`;
    
    // Update connection status
    statusDot.className = `status-dot ${isConnected ? '' : 'offline'}`;
  }
}

function renderRecentActivity(evidences: Evidence[]) {
  const activityList = document.getElementById('activity-list');
  const activityBadge = document.getElementById('activity-badge');
  
  if (!activityList || !activityBadge) return;
  
  const recentEvidences = getRecentEvidences(evidences);
  
  if (recentEvidences.length === 0) {
    activityList.innerHTML = `
      <li class="empty-activity">No recent activity</li>
    `;
    activityBadge.textContent = '0';
    return;
  }
  
  // Calculate new items since last check
  const newItemsCount = lastActivityCheck ? 
    recentEvidences.filter(e => new Date(e.timestamp) > lastActivityCheck!).length : 0;
  
  // Update badge
  activityBadge.textContent = recentEvidences.length.toString();
  if (newItemsCount > 0) {
    activityBadge.classList.add('pulse');
    setTimeout(() => activityBadge.classList.remove('pulse'), 3000);
  }
  
  // Render activity items
  activityList.innerHTML = recentEvidences.map((evidence, index) => {
    const isNewItem = lastActivityCheck && new Date(evidence.timestamp) > lastActivityCheck;
    return `
      <li class="activity-item ${isNewItem ? 'new-item' : ''}" data-evidence-id="${evidence.id}">
        <div class="activity-content">
          <div class="activity-title-text">${evidence.conversationId || evidence.id.slice(0, 12)}</div>
          <div class="activity-meta">
            ${evidence.llmProvider} • ${evidence.tags?.join(', ') || 'No tags'}
          </div>
        </div>
        <div class="activity-time">${formatRelativeTime(evidence.timestamp)}</div>
      </li>
    `;
  }).join('');
  
  // Add click handlers for activity items
  activityList.querySelectorAll('.activity-item').forEach(item => {
    item.addEventListener('click', () => {
      const evidenceId = item.getAttribute('data-evidence-id');
      if (evidenceId) {
        // Scroll to evidence in table and highlight it
        const tableRows = document.querySelectorAll('#evidence-table tbody tr');
        tableRows.forEach(row => {
          const cellText = row.firstElementChild?.textContent || '';
          if (cellText.includes(evidenceId.slice(0, 8))) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.style.backgroundColor = '#eff6ff';
            setTimeout(() => {
              row.style.backgroundColor = '';
            }, 2000);
          }
        });
      }
    });
  });
  
  updateLastUpdatedDisplay();
}

// Real-time update functionality
async function refreshData() {
  try {
    // Call the list-evidences tool to get fresh data
    const result = await app.callServerTool({
      name: "list-evidences",
      arguments: { limit: 100, offset: 0 }
    });
    
    if (result && result.content) {
      const textContent = result.content.find(c => c.type === "text")?.text;
      if (textContent) {
        const data: DashboardData = JSON.parse(textContent);
        
        // Check for new evidence since last update
        if (lastDashboardData && data.evidences) {
          const newEvidences = data.evidences.filter(newEvidence => {
            return !lastDashboardData!.evidences.some(oldEvidence => 
              oldEvidence.id === newEvidence.id
            );
          });
          
          if (newEvidences.length > 0) {
            console.log(`Found ${newEvidences.length} new evidence items`);
            // Show notification or visual indicator for new evidence
            showNewEvidenceNotification(newEvidences.length);
          }
        }
        
        lastDashboardData = data;
        
        if (data.evidences) {
          renderTable(data.evidences);
          renderTimeline(data.evidences);
          renderRecentActivity(data.evidences);
          updateStats(data);
        }
        
        lastActivityCheck = new Date();
      }
    }
    
    isConnected = true;
  } catch (error) {
    console.error("Failed to refresh data:", error);
    isConnected = false;
    updateLastUpdatedDisplay();
  }
}

function showNewEvidenceNotification(count: number) {
  // Create a temporary notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 1rem;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    animation: slideIn 0.3s ease-out;
  `;
  notification.textContent = `${count} new evidence item${count > 1 ? 's' : ''} captured!`;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function startPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  
  // Initial data load
  refreshData();
  
  // Set up polling every 5 seconds
  pollingInterval = window.setInterval(refreshData, 5000);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

function updateSelectionCounter() {
  const counter = document.getElementById('selection-counter');
  const exportBtn = document.getElementById('export-selected-btn') as HTMLButtonElement;
  const deleteBtn = document.getElementById('delete-selected-btn') as HTMLButtonElement;
  
  if (counter) {
    const count = selectedEvidenceIds.size;
    counter.textContent = `${count} selected`;
  }
  
  // Enable/disable batch action buttons
  const hasSelection = selectedEvidenceIds.size > 0;
  if (exportBtn) exportBtn.disabled = !hasSelection;
  if (deleteBtn) deleteBtn.disabled = !hasSelection;
}

function updateSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById('select-all-checkbox') as HTMLInputElement;
  if (!selectAllCheckbox) return;
  
  const evidenceCheckboxes = document.querySelectorAll('.evidence-checkbox') as NodeListOf<HTMLInputElement>;
  const totalCheckboxes = evidenceCheckboxes.length;
  const checkedCheckboxes = Array.from(evidenceCheckboxes).filter(cb => cb.checked).length;
  
  if (checkedCheckboxes === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  } else if (checkedCheckboxes === totalCheckboxes) {
    selectAllCheckbox.checked = true;
    selectAllCheckbox.indeterminate = false;
  } else {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = true;
  }
}

function setupEvidenceCheckboxes() {
  const evidenceCheckboxes = document.querySelectorAll('.evidence-checkbox');
  
  evidenceCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const evidenceId = target.value;
      
      if (target.checked) {
        selectedEvidenceIds.add(evidenceId);
      } else {
        selectedEvidenceIds.delete(evidenceId);
      }
      
      updateSelectionCounter();
      updateSelectAllCheckbox();
    });
  });
}

function setupSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById('select-all-checkbox');
  
  selectAllCheckbox?.addEventListener('change', (e) => {
    const target = e.target as HTMLInputElement;
    const evidenceCheckboxes = document.querySelectorAll('.evidence-checkbox') as NodeListOf<HTMLInputElement>;
    
    selectedEvidenceIds.clear();
    
    evidenceCheckboxes.forEach(checkbox => {
      checkbox.checked = target.checked;
      if (target.checked) {
        selectedEvidenceIds.add(checkbox.value);
      }
    });
    
    updateSelectionCounter();
  });
}

async function exportSelectedEvidences() {
  if (selectedEvidenceIds.size === 0) {
    alert('Please select evidences to export');
    return;
  }
  
  const exportBtn = document.getElementById('export-selected-btn') as HTMLButtonElement;
  const originalText = exportBtn.textContent;
  
  try {
    exportBtn.disabled = true;
    exportBtn.textContent = '📤 Exporting...';
    
    // Call the export-evidences tool with selected IDs
    const selectedIds = Array.from(selectedEvidenceIds);
    console.log('Exporting evidences:', selectedIds);
    
    const result = await app.callServerTool({
      name: 'export-evidences',
      arguments: { evidenceIds: selectedIds }
    });
    
    console.log('Export result:', result);
    
    // Handle the export result
    if (result.isError) {
      throw new Error(result.content?.find(c => c.type === "text")?.text || 'Export failed');
    }
    
    const textContent = result.content?.find(c => c.type === "text")?.text;
    if (textContent) {
      try {
        const exportData = JSON.parse(textContent);
        if (exportData.success) {
          alert(`Successfully exported ${selectedIds.length} evidences`);
          // Clear selection after successful export
          selectedEvidenceIds.clear();
          updateSelectionCounter();
          updateSelectAllCheckbox();
          
          // Uncheck all checkboxes
          const checkboxes = document.querySelectorAll('.evidence-checkbox') as NodeListOf<HTMLInputElement>;
          checkboxes.forEach(cb => cb.checked = false);
          const selectAllCheckbox = document.getElementById('select-all-checkbox') as HTMLInputElement;
          if (selectAllCheckbox) selectAllCheckbox.checked = false;
        } else {
          throw new Error(exportData.message || 'Export failed');
        }
      } catch (parseError) {
        console.error('Failed to parse export result:', parseError);
        alert('Export completed but result format was unexpected');
      }
    }
    
  } catch (error) {
    console.error('Export failed:', error);
    alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    exportBtn.disabled = false;
    exportBtn.textContent = originalText;
  }
}

async function deleteSelectedEvidences() {
  if (selectedEvidenceIds.size === 0) {
    alert('Please select evidences to delete');
    return;
  }
  
  const selectedIds = Array.from(selectedEvidenceIds);
  if (!confirm(`Are you sure you want to delete ${selectedIds.length} evidence item(s)? This action cannot be undone.`)) {
    return;
  }
  
  const deleteBtn = document.getElementById('delete-selected-btn') as HTMLButtonElement;
  const originalText = deleteBtn.textContent;
  
  try {
    deleteBtn.disabled = true;
    deleteBtn.textContent = '🗑️ Deleting...';
    
    console.log('Deleting evidences:', selectedIds);
    
    const result = await app.callServerTool({
      name: 'delete-evidences',
      arguments: { evidenceIds: selectedIds }
    });
    
    console.log('Delete result:', result);
    
    if (result.isError) {
      throw new Error(result.content?.find(c => c.type === "text")?.text || 'Delete failed');
    }
    
    // Parse structured content or text content
    const structuredContent = result.structuredContent as { deletedCount: number; success: boolean } | undefined;
    
    if (structuredContent?.success) {
      alert(`Successfully deleted ${structuredContent.deletedCount} evidence(s)`);
      
      // Clear selection
      selectedEvidenceIds.clear();
      updateSelectionCounter();
      updateSelectAllCheckbox();
      
      // Uncheck all checkboxes
      const checkboxes = document.querySelectorAll('.evidence-checkbox') as NodeListOf<HTMLInputElement>;
      checkboxes.forEach(cb => cb.checked = false);
      const selectAllCheckbox = document.getElementById('select-all-checkbox') as HTMLInputElement;
      if (selectAllCheckbox) selectAllCheckbox.checked = false;
      
      // Refresh data
      await refreshData();
    } else {
      throw new Error('Delete operation did not succeed');
    }
    
  } catch (error) {
    console.error('Delete failed:', error);
    alert(`Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    deleteBtn.disabled = false;
    deleteBtn.textContent = originalText;
  }
}

function setupBatchOperations() {
  const exportBtn = document.getElementById('export-selected-btn');
  const deleteBtn = document.getElementById('delete-selected-btn');
  
  exportBtn?.addEventListener('click', exportSelectedEvidences);
  deleteBtn?.addEventListener('click', deleteSelectedEvidences);
}

// Handle tool results from the MCP server
app.ontoolresult = (result) => {
  console.log("Received tool result:", result);
  
  try {
    const textContent = result.content?.find(c => c.type === "text")?.text;
    if (!textContent) {
      console.warn("No text content in tool result");
      return;
    }
    
    const data: DashboardData = JSON.parse(textContent);
    console.log("Parsed data:", data);
    
    lastDashboardData = data;
    
    if (data.evidences) {
      allEvidences = data.evidences;
      updateView();
      renderRecentActivity(data.evidences);
    } else {
      console.warn("No evidences array in parsed data");
    }
  } catch (e) {
    console.error("Failed to parse tool result:", e);
    const tbody = document.querySelector("#evidence-table tbody");
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" class="loading">Error loading data</td>
        </tr>
      `;
    }
  }
};

// Handle resource updates (real-time updates from the server)
app.onresourceupdate = (update) => {
  console.log("Received resource update:", update);
  
  try {
    // Check if this is evidence-related data
    if (update.uri && update.uri.includes('evidence')) {
      console.log("Evidence data updated, refreshing dashboard...");
      refreshData();
    }
  } catch (error) {
    console.error("Failed to handle resource update:", error);
  }
};

// Set up timeline controls
function setupTimelineControls() {
  const timelineButtons = document.querySelectorAll('.timeline-btn');
  
  timelineButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state
      timelineButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Re-render timeline with new period
      if (allEvidences.length > 0) {
        const filteredEvidences = filterEvidences(allEvidences);
        renderTimeline(filteredEvidences);
      }
    });
  });
}

// Set up tag management controls
function setupTagControls() {
  // Manage tags button
  const manageTagsBtn = document.getElementById('manage-tags-btn');
  if (manageTagsBtn) {
    manageTagsBtn.addEventListener('click', showTagModal);
  }
  
  // Modal close button
  const modalClose = document.getElementById('modal-close');
  if (modalClose) {
    modalClose.addEventListener('click', hideTagModal);
  }
  
  // Close modal when clicking outside
  const modal = document.getElementById('tag-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        hideTagModal();
      }
    });
  }
  
  // Clear filters button
  const clearFiltersBtn = document.getElementById('clear-filters-btn');
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', () => {
      activeTagFilters.clear();
      updateView();
    });
  }
  
  // Filter mode buttons
  const filterModeAndBtn = document.getElementById('filter-mode-and');
  const filterModeOrBtn = document.getElementById('filter-mode-or');
  
  if (filterModeAndBtn && filterModeOrBtn) {
    filterModeAndBtn.addEventListener('click', () => {
      if (filterMode !== 'AND') {
        filterMode = 'AND';
        filterModeAndBtn.classList.add('active');
        filterModeOrBtn.classList.remove('active');
        if (activeTagFilters.size > 1) {
          updateView();
        }
      }
    });
    
    filterModeOrBtn.addEventListener('click', () => {
      if (filterMode !== 'OR') {
        filterMode = 'OR';
        filterModeOrBtn.classList.add('active');
        filterModeAndBtn.classList.remove('active');
        if (activeTagFilters.size > 1) {
          updateView();
        }
      }
    });
  }
}

// Make functions globally available for onclick handlers
(window as any).editTag = editTag;
(window as any).deleteTag = deleteTag;

// Set up search controls
function setupSearchControls() {
  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  const searchClear = document.getElementById('search-clear') as HTMLButtonElement;
  
  if (!searchInput || !searchClear) return;
  
  // Debounce search for performance
  let searchTimeout: number | null = null;
  
  searchInput.addEventListener('input', () => {
    searchClear.style.display = searchInput.value ? 'block' : 'none';
    
    // Debounce the search
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    searchTimeout = window.setTimeout(() => {
      searchQuery = searchInput.value;
      updateView();
    }, 200);
  });
  
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchQuery = '';
    searchClear.style.display = 'none';
    updateView();
    searchInput.focus();
  });
  
  // Handle Enter key to search immediately
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
      searchQuery = searchInput.value;
      updateView();
    }
    
    // Handle Escape to clear
    if (e.key === 'Escape') {
      searchInput.value = '';
      searchQuery = '';
      searchClear.style.display = 'none';
      updateView();
    }
  });
}

// Initialize the app
console.log("Connecting to MCP host...");
app.connect().then(() => {
  console.log("Connected to MCP host successfully");
  isConnected = true;
  setupSearchControls();
  setupTimelineControls();
  setupTagControls();
  setupSelectAllCheckbox();
  setupBatchOperations();
  
  // Start real-time polling
  console.log("Starting real-time polling...");
  startPolling();
}).catch(error => {
  console.error("Failed to connect to MCP host:", error);
  isConnected = false;
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopPolling();
});