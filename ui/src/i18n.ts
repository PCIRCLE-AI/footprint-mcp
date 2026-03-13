export type UiLocale = "en" | "zh-TW" | "ja" | "zh-CN";

const LOCALE_STORAGE_KEY = "footprint.ui.locale";
const SUPPORTED_LOCALES: UiLocale[] = ["en", "zh-TW", "ja", "zh-CN"];

const INTL_LOCALE_BY_UI_LOCALE: Record<UiLocale, string> = {
  en: "en-US",
  "zh-TW": "zh-TW",
  ja: "ja-JP",
  "zh-CN": "zh-CN",
};

const FALLBACK_LOCALE: UiLocale = "en";

const DICTIONARY: Record<UiLocale, Record<string, string>> = {
  en: {
    "common.language": "Language",
    "common.exportZip": "Export ZIP",
    "common.downloadZip": "Download ZIP",
    "common.refreshPreview": "Refresh Preview",
    "common.back": "Back",
    "common.copyText": "Copy Text",
    "common.checkIntegrity": "Check Integrity",
    "common.locale.en": "English",
    "common.locale.zh-TW": "繁體中文",
    "common.locale.ja": "日本語",
    "common.locale.zh-CN": "简体中文",

    "sessionDashboard.documentTitle": "Footprint Work Overview",
    "sessionDashboard.documentTitleLive": "Footprint Local Live Work Overview",
    "sessionDashboard.kicker": "Footprint memory view",
    "sessionDashboard.title": "Work Overview",
    "sessionDashboard.summary.loading": "Loading your recent work...",
    "sessionDashboard.noteHtml":
      "Start with <strong>What Matters Now</strong>, then open a saved work record when you need the details. <strong>Ongoing Topics</strong> help you stay inside the right thread instead of guessing.",
    "sessionDashboard.findAndFilter": "Find & Filter",
    "sessionDashboard.findAndFilter.subtitle":
      "Narrow the view below, or leave filters empty to see everything.",
    "sessionDashboard.findPastWork": "Find Past Work",
    "sessionDashboard.findPastWork.placeholder":
      "A feature, file name, bug, or question...",
    "sessionDashboard.referenceCode": "Reference Code (Advanced)",
    "sessionDashboard.referenceCode.placeholder":
      "Only if someone already gave it to you",
    "sessionDashboard.aiHelper": "AI Helper",
    "sessionDashboard.allAssistants": "All AI assistants",
    "sessionDashboard.workState": "Work State",
    "sessionDashboard.allStates": "All states",
    "sessionDashboard.state.running": "In progress",
    "sessionDashboard.state.completed": "Done",
    "sessionDashboard.state.failed": "Needs attention",
    "sessionDashboard.state.interrupted": "Stopped",
    "sessionDashboard.groupBy": "Group Repeated Problems By",
    "sessionDashboard.groupBy.issue": "Specific problem",
    "sessionDashboard.groupBy.family": "Broader pattern",
    "sessionDashboard.updateView": "Update View",
    "sessionDashboard.exportView": "Export This View",
    "sessionDashboard.clear": "Clear",
    "sessionDashboard.handoff.title": "What Matters Now",
    "sessionDashboard.handoff.loading":
      "Loading the most important things to know...",
    "sessionDashboard.trends.title": "Problems That Came Back",
    "sessionDashboard.trends.loading":
      "Looking for issues that have shown up more than once...",
    "sessionDashboard.contexts.title": "Ongoing Topics",
    "sessionDashboard.contexts.loading":
      "Loading the ongoing topics Footprint already knows about...",
    "sessionDashboard.search.title": "Earlier Related Work",
    "sessionDashboard.search.loading":
      "Type above to find earlier work that may help.",
    "sessionDashboard.sessions.title": "Recent Work",
    "sessionDashboard.sessions.subtitle":
      "Newest first. Open one to see the plain-language overview first, then the detailed traces if needed.",
    "sessionDashboard.sessions.empty": "No saved work records yet.",
    "sessionDashboard.trends.empty": "No repeated problems found yet.",
    "sessionDashboard.contexts.empty": "No ongoing topics yet.",
    "sessionDashboard.search.empty": "Search results will appear here.",
    "sessionDashboard.loadMoreTrends": "Show More Repeated Problems",
    "sessionDashboard.loadMoreSearch": "Show More Results",
    "sessionDashboard.loadMoreSessions": "Show More Work",
    "sessionDashboard.liveBadge": "Local live product · Work Overview",

    "sessionDetail.documentTitle": "Footprint Work Record",
    "sessionDetail.documentTitleLive": "Footprint Local Live Work Record",
    "sessionDetail.kicker": "Work briefing",
    "sessionDetail.title": "This Work",
    "sessionDetail.subtitle.loading": "Loading this saved work record...",
    "sessionDetail.noteHtml":
      "If you are picking this up fresh, start with <strong>Read This First</strong> and <strong>Pickup Note</strong>. The conversation and activity log stay lower on the page so the first screen stays practical.",
    "sessionDetail.liveBadge": "Local live product · Back to Overview",
    "sessionDetail.refreshOverview": "Refresh Overview",
    "sessionDetail.loadSupportingDetails": "Load Supporting Details",
    "sessionDetail.loadSimpleSummary": "Load Simple Summary",
    "sessionDetail.loadKeyDecisions": "Load Key Decisions",
    "sessionDetail.readThisFirst": "Read This First",
    "sessionDetail.readThisFirst.subtitle":
      "Checking whether this work belongs to an existing topic...",
    "sessionDetail.noConfirmedTopic": "No confirmed topic summary yet.",
    "sessionDetail.refreshContext": "Check Again",
    "sessionDetail.moveTopic": "Move Into Another Topic",
    "sessionDetail.moveThere": "Move There",
    "sessionDetail.makeMainTopic": "Make This The Main Topic",
    "sessionDetail.startNewTopic": "Start A New Topic",
    "sessionDetail.startNewTopic.placeholder": "e.g. Invoice email follow-up",
    "sessionDetail.createTopic": "Create Topic",
    "sessionDetail.otherTopics": "Other Topics This Might Belong To",
    "sessionDetail.otherTopics.summary":
      "Footprint only suggests other topics when it sees enough supporting data.",
    "sessionDetail.otherTopics.empty":
      "No possible related topics for this work yet.",
    "sessionDetail.pickupNote": "Pickup Note",
    "sessionDetail.pickupNote.summary":
      "Pick one item from Related Earlier Work below to load a short pickup note.",
    "sessionDetail.pickupExport": "Export Pickup ZIP",
    "sessionDetail.simpleSummary": "Simple Summary",
    "sessionDetail.simpleSummary.subtitle":
      "A plain-language description of what happened in this session.",
    "sessionDetail.keyDecisions": "Key Decisions",
    "sessionDetail.keyDecisions.subtitle":
      "Choices made or confirmed during this session.",
    "sessionDetail.relatedEarlierWork": "Related Earlier Work",
    "sessionDetail.relatedEarlierWork.subtitle":
      "Earlier sessions that share a topic, issue key, or recurring problem with this one.",
    "sessionDetail.conversation": "Conversation",
    "sessionDetail.conversation.subtitle":
      "The messages exchanged with the AI during this session.",
    "sessionDetail.activityLog": "Automatic Activity Log",
    "sessionDetail.activityLog.subtitle":
      "Tool calls, file reads, and other actions recorded automatically.",
    "sessionDetail.supportingDetails": "Supporting Details",
    "sessionDetail.supportingDetails.subtitle":
      "Files, code snippets, and other artifacts saved during this session.",
    "sessionDetail.loadMoreNarratives": "Show More Summaries",
    "sessionDetail.loadMoreDecisions": "Show More Decisions",
    "sessionDetail.loadMoreRelatedWork": "Show More Related Work",
    "sessionDetail.loadMoreConversation": "Show More Conversation",
    "sessionDetail.loadMoreSteps": "Show More Steps",
    "sessionDetail.loadMoreSupporting": "Show More Supporting Details",

    "evidenceDashboard.documentTitle": "Footprint Saved Footprints",
    "evidenceDashboard.kicker": "Encrypted footprints",
    "evidenceDashboard.title": "Saved Footprints",
    "evidenceDashboard.subtitle":
      "Browse encrypted records of important AI work, filter them quickly, and export only what matters.",
    "evidenceDashboard.note":
      "Use this view when you need a durable record of what was said or done. Search first, then narrow by labels or time before exporting.",
    "evidenceDashboard.search.placeholder":
      "Search by topic, label, or AI assistant",
    "evidenceDashboard.stats.records": "Saved records",
    "evidenceDashboard.stats.today": "Saved today",
    "evidenceDashboard.stats.storage": "Storage used",
    "evidenceDashboard.stats.labels": "Labels",
    "evidenceDashboard.latestCaptures": "Recent Activity",
    "evidenceDashboard.latestCaptures.loading": "Loading recent activity...",
    "evidenceDashboard.timeline": "Activity Timeline",
    "evidenceDashboard.timeline.subtitle":
      "A quick view of when Footprint saved records, so you can jump into the right period first.",
    "evidenceDashboard.timeline.7d": "7 days",
    "evidenceDashboard.timeline.30d": "30 days",
    "evidenceDashboard.timeline.90d": "90 days",
    "evidenceDashboard.timeline.all": "All time",
    "evidenceDashboard.timeline.loading": "Loading timeline...",
    "evidenceDashboard.selected": "{{count}} selected",
    "evidenceDashboard.exportSelected": "Export Selected",
    "evidenceDashboard.deleteSelected": "Delete Selected",
    "evidenceDashboard.filterLabels": "Filter By Labels",
    "evidenceDashboard.filterLabels.subtitle":
      "Labels help you separate sensitive cases, teams, or audit categories.",
    "evidenceDashboard.manageLabels": "Manage Labels",
    "evidenceDashboard.match": "Match",
    "evidenceDashboard.match.all": "All",
    "evidenceDashboard.match.any": "Any",
    "evidenceDashboard.records.title": "Footprint Records",
    "evidenceDashboard.records.subtitle":
      "Open a record for the full decrypted conversation, Git context, and export actions.",
    "evidenceDashboard.table.record": "Record",
    "evidenceDashboard.table.conversation": "Conversation",
    "evidenceDashboard.table.captured": "Saved",
    "evidenceDashboard.table.labels": "Labels",
    "evidenceDashboard.records.loading": "Loading saved records...",
    "evidenceDashboard.labels.loading": "Loading labels...",

    "evidenceDetail.documentTitle": "Footprint Record",
    "evidenceDetail.kicker": "Saved footprint",
    "evidenceDetail.title": "Footprint Record",
    "evidenceDetail.subtitle":
      "Review the saved conversation, inspect its metadata, and export or verify it without leaving Footprint.",
    "evidenceDetail.note":
      "This page is for durable records, not day-to-day work pickup. Use it when you need an auditable record of what happened.",
    "evidenceDetail.loading": "Loading saved footprint...",
    "evidenceDetail.record": "Record",
    "evidenceDetail.captured": "Saved",
    "evidenceDetail.conversation": "Conversation",
    "evidenceDetail.aiAssistant": "AI Assistant",
    "evidenceDetail.messages": "Messages",
    "evidenceDetail.labels": "Labels",
    "evidenceDetail.savedConversation": "Saved Conversation",
    "evidenceDetail.savedConversation.subtitle":
      "This is the decrypted record currently loaded in the app.",

    "evidenceExport.documentTitle": "Footprint Export",
    "evidenceExport.kicker": "Export saved footprints",
    "evidenceExport.title": "Export ZIP Bundle",
    "evidenceExport.subtitle":
      "Choose which footprints to include, preview the bundle, then download an encrypted ZIP you can store or hand off.",
    "evidenceExport.note":
      "Use this when you need to archive footprints or share them with a smaller audience. Preview first so you only export what is actually needed.",
    "evidenceExport.whatToInclude": "What To Include",
    "evidenceExport.whatToInclude.subtitle":
      "Choose the scope first, then decide whether Git metadata should travel with the export.",
    "evidenceExport.records": "Records",
    "evidenceExport.records.all": "All saved footprints",
    "evidenceExport.records.recent": "Only the last 30 days",
    "evidenceExport.extraContext": "Extra Context",
    "evidenceExport.extraContext.git":
      "Include Git timestamps and commit hashes",
    "evidenceExport.preview": "Bundle Preview",
    "evidenceExport.preview.subtitle":
      "A quick sample of what will be packed into the ZIP.",
    "evidenceExport.preview.loading": "Loading preview...",
    "evidenceExport.preview.empty":
      "No saved footprints match this export view.",
    "evidenceExport.preview.emptyHint": "Try switching the scope above.",
    "evidenceExport.file.default": "footprint-export.zip",
    "evidenceExport.file.stats": "{{count}} records • Estimated size: {{size}}",
    "evidenceExport.info":
      "Footprint creates an encrypted ZIP archive with JSON metadata for each record.",

    "status.completed": "Done",
    "status.failed": "Needs Attention",
    "status.interrupted": "Stopped",
    "status.running": "In Progress",
    "role.user": "You",
    "role.assistant": "AI",
    "role.system": "System",
    "artifact.file-change": "File Change",
    "artifact.command-output": "Command Run",
    "artifact.test-result": "Test Result",
    "artifact.git-commit": "Saved Change",
    "narrative.project-summary": "Big-Picture Summary",
    "narrative.handoff": "What To Know Next",
    "decision.active": "Current",
    "decision.accepted": "Current",
    "decision.superseded": "Replaced",
    "decision.pending": "Open",
    "decision.rejected": "Not Chosen",
    "event.session.start": "Work started",
    "event.session.end": "Work ended",
    "event.session.started": "Work started",
    "event.session.completed": "Work finished",
    "event.session.failed": "Work ended with a problem",
    "event.session.interrupted": "Work stopped early",
    "event.message.user": "You sent a message",
    "event.message.user.submitted": "You sent a message",
    "event.message.assistant": "AI replied",
    "event.message.assistant.completed": "AI finished replying",
    "event.command.started": "A command started",
    "event.command.completed": "A command finished",
    "event.command.failed": "A command failed",
    "event.test.completed": "A test run finished",
    "event.error.observed": "A problem was noticed",
    "event.file.changed": "A file changed",
    "event.git.commit": "A saved change was created",
    "event.tool.started": "An AI tool started",
    "event.context.resolved": "A topic was suggested",
    "event.context.updated": "The topic link was updated",
    "context.savedTopic": "Saved Topic",
    "context.newTopicSuggestion": "New Topic Suggestion",
    "context.confidence.high": "Strong match",
    "context.confidence.medium": "Possible match",
    "context.confidence.low": "Weak match",
    "context.reason.sameFolder": "It happened in the same folder.",
    "context.reason.noOtherTopic":
      "No other saved topic is using this folder right now.",
    "context.reason.sameProblem":
      "It mentions the same problem as earlier work.",
    "context.reason.sameFailureFamily":
      "It matches the same kind of problem seen earlier.",
    "context.reason.similarGoal": "The goal sounds similar to earlier work.",
    "context.reason.recentContinuity": "It happened soon after related work.",
    "context.reason.preferred":
      "This topic is currently marked as the main one for this folder.",
    "context.topicFrom": "Topic from {{label}}",
    "context.untitledWork": "Untitled work",
    "context.untitledTopic": "Untitled topic",
    "context.sameFolder": "Folder",
    "context.bestCurrentPicture": "Best Current Picture",
    "context.stillBlocking": "Still Blocking",
    "context.stillUnclear": "Still Unclear",
    "context.currentDecisions": "Current Decisions",
    "context.olderDecisions": "Older Decisions That Were Replaced",
    "context.noBlockers": "No blockers are recorded right now.",
    "context.noQuestions": "No open questions are recorded right now.",
    "context.noCurrentDecisions": "No current decisions are recorded yet.",
    "context.noReplacedDecisions": "No replaced decisions are recorded yet.",
    "context.noConfirmedSummary": "No confirmed topic summary yet.",
    "context.noMatchingSignals": "No matching signals were saved.",
    "context.noEarlierWork": "No earlier related work",
    "context.preferredFolder":
      "This is currently the main topic for this folder.",
    "context.whySuggested": "Why Footprint thinks this may be the same topic:",
    "context.linkTopic": "Link To This Topic",
    "context.keepSeparate": "Keep Separate",
    "context.startNewTopic": "Start New Topic",
    "context.noSuggestedTopics": "No suggested topics for this work record.",
    "context.noOngoingTopics": "No ongoing topics yet.",
    "context.openLatestWork": "Open Latest Work",
    "context.latestRelatedWork": "Latest related work",
    "context.openLatest": "Open Latest",
    "context.findRelated": "Find Related Work",
    "context.showBroaderPattern": "Show Broader Pattern",
    "context.showThisProblem": "Show This Problem",
    "context.nothingUrgent": "Nothing urgent stands out in this view yet.",
    "context.needsAttention": "Needs Attention",
    "context.recentlyImproved": "Recently Improved",
    "context.openQuestions": "Open Questions",
    "context.noSimilarPastWork":
      "No similar past work found for this record yet.",
    "context.openLatestRelatedWork": "Open Latest Related Work",
    "context.openShortSummary": "Open Short Summary",
    "context.noConversation": "No conversation has been saved yet.",
    "context.noTimeline": "No step-by-step activity has been recorded yet.",
    "context.noNarratives": "No plain-language summaries have been loaded yet.",
    "context.noDecisions": "No key decisions have been loaded yet.",
    "context.noArtifacts": "No supporting details have been loaded yet.",
    "context.savedWorkRecord": "Saved work record",
    "context.open": "Open",
    "context.refreshSummary": "Refresh Summary",
    "context.inProgress": "In Progress",
    "context.onlyHost": "Only {{host}}",
    "context.whyThisMatches": "Why this matches:",
    "context.noHighlights": "No highlighted details yet.",
    "context.resultsHere": "Search results will appear here.",
    "context.repeatedTrouble": "Repeated trouble",
    "context.latestOutcome": "Most recent outcome",
    "context.seenWith": "Seen with",
    "context.recentRelatedWork": "Recent related work",
    "context.relatedIssues": "Related issues",
    "context.broaderPattern": "Broader pattern",
    "context.otherRelatedRecords": "Other related saved work records",
    "context.moreRelatedRecords": "+{{count}} more related saved work records",
    "context.noOverviewReady": "No overview is ready yet.",
    "context.latestFailed": "The latest related work ended with a problem.",
    "context.latestCompleted": "The latest related work finished normally.",
    "context.latestStopped": "The latest related work stopped early.",
    "context.mostRecentIssue": "Most recent issue: {{value}}",
    "context.stillBlockingLine": "Still blocking: {{value}}",
    "context.packageChanges": "Recent package or setup changes: {{value}}",
    "context.repeatedTroubleLine": "Repeated trouble seen here: {{value}}",
    "context.retryLoop": "Repeated retry loop: {{value}}",
    "context.nothingBlocking":
      "Nothing is blocking this line of work right now.",
    "context.quickCheck":
      "This looks like a quick tool or setup check, not a clearly described task.",
    "context.mainGoal": "Main goal: {{value}}",
    "context.problemSingle": "A problem showed up during this work.",
    "context.problemPlural": "{{count}} problems showed up during this work.",
    "context.loadMoreSummaries": "Show More Summaries",
    "context.loadMoreDecisions": "Show More Decisions",
    "context.loadMoreRelatedWork": "Show More Related Work",
    "context.loadMoreConversation": "Show More Conversation",
    "context.loadMoreSteps": "Show More Steps",
    "context.loadMoreSupportingDetails": "Show More Supporting Details",

    "evidence.noResults": 'No results found for "{{query}}"',
    "evidence.showingResults":
      "Showing {{filtered}} of {{total}} saved records",
    "evidence.noLabels": "No labels",
    "evidence.noSavedRecords": "No saved records found",
    "evidence.noSavedRecordsQuery": 'No saved records match "{{query}}"',
    "evidence.noSavedRecordsLabels":
      "No saved records match the selected label{{suffix}}: {{labels}}",
    "evidence.noSavedRecordsPeriod": "No saved records in this time period",
    "evidence.record": "record",
    "evidence.records": "records",
    "evidence.latestCaptures.none": "No recent activity yet",
    "evidence.label.none": "No labels found",
  },
  "zh-TW": {},
  ja: {},
  "zh-CN": {},
};

DICTIONARY["zh-TW"] = {
  ...DICTIONARY.en,
  "common.language": "語言",
  "common.exportZip": "匯出 ZIP",
  "common.downloadZip": "下載 ZIP",
  "common.refreshPreview": "重新整理預覽",
  "common.back": "返回",
  "common.copyText": "複製文字",
  "common.checkIntegrity": "檢查完整性",
  "sessionDashboard.documentTitle": "Footprint 工作總覽",
  "sessionDashboard.documentTitleLive": "Footprint 本地即時工作總覽",
  "sessionDashboard.kicker": "Footprint 記憶檢視",
  "sessionDashboard.title": "工作總覽",
  "sessionDashboard.summary.loading": "正在載入你的近期工作...",
  "sessionDashboard.noteHtml":
    "先看 <strong>現在最重要的事</strong>，需要細節時再打開單一工作紀錄。<strong>持續中的主題</strong> 會幫你留在正確脈絡裡，不用重新猜。",
  "sessionDashboard.findAndFilter": "尋找與篩選",
  "sessionDashboard.findAndFilter.subtitle":
    "縮小下方的顯示範圍，或留空篩選條件以查看全部。",
  "sessionDashboard.findPastWork": "找先前的工作",
  "sessionDashboard.findPastWork.placeholder": "功能、檔名、問題或待辦事項...",
  "sessionDashboard.referenceCode": "參考代碼（進階）",
  "sessionDashboard.referenceCode.placeholder":
    "只有在別人已經給你代碼時才需要",
  "sessionDashboard.aiHelper": "AI 助手",
  "sessionDashboard.allAssistants": "所有 AI 助手",
  "sessionDashboard.workState": "工作狀態",
  "sessionDashboard.allStates": "所有狀態",
  "sessionDashboard.state.running": "進行中",
  "sessionDashboard.state.completed": "已完成",
  "sessionDashboard.state.failed": "需要注意",
  "sessionDashboard.state.interrupted": "已停止",
  "sessionDashboard.groupBy": "重複問題分組方式",
  "sessionDashboard.groupBy.issue": "具體問題",
  "sessionDashboard.groupBy.family": "較大的模式",
  "sessionDashboard.updateView": "更新畫面",
  "sessionDashboard.exportView": "匯出這個檢視",
  "sessionDashboard.clear": "清除",
  "sessionDashboard.handoff.title": "現在最重要的事",
  "sessionDashboard.handoff.loading": "正在整理最重要的重點...",
  "sessionDashboard.trends.title": "反覆出現的問題",
  "sessionDashboard.trends.loading": "正在查看哪些問題曾重複出現...",
  "sessionDashboard.contexts.title": "持續中的主題",
  "sessionDashboard.contexts.loading": "正在載入 Footprint 已知的主題...",
  "sessionDashboard.search.title": "較早的相關工作",
  "sessionDashboard.search.loading":
    "在上方輸入內容後，就能找到較早的相關工作。",
  "sessionDashboard.sessions.title": "近期工作",
  "sessionDashboard.sessions.subtitle":
    "依時間新到舊排列。先看淺白摘要，需要時再往下看詳細軌跡。",
  "sessionDashboard.sessions.empty": "目前還沒有已儲存的工作紀錄。",
  "sessionDashboard.trends.empty": "目前還沒有反覆出現的問題。",
  "sessionDashboard.contexts.empty": "目前還沒有持續中的主題。",
  "sessionDashboard.search.empty": "搜尋結果會顯示在這裡。",
  "sessionDashboard.loadMoreTrends": "顯示更多重複問題",
  "sessionDashboard.loadMoreSearch": "顯示更多結果",
  "sessionDashboard.loadMoreSessions": "顯示更多工作",
  "sessionDashboard.liveBadge": "本地即時產品 · 工作總覽",
  "sessionDetail.documentTitle": "Footprint 工作紀錄",
  "sessionDetail.documentTitleLive": "Footprint 本地即時工作紀錄",
  "sessionDetail.kicker": "工作簡報",
  "sessionDetail.title": "這次工作",
  "sessionDetail.subtitle.loading": "正在載入這筆已儲存的工作紀錄...",
  "sessionDetail.noteHtml":
    "如果你是第一次接手，先從 <strong>先讀這裡</strong> 和 <strong>接手便條</strong> 開始。對話與活動紀錄放在下方，讓第一屏先給你可行的理解。",
  "sessionDetail.liveBadge": "本地即時產品 · 返回總覽",
  "sessionDetail.refreshOverview": "重新整理總覽",
  "sessionDetail.loadSupportingDetails": "載入補充細節",
  "sessionDetail.loadSimpleSummary": "載入簡單摘要",
  "sessionDetail.loadKeyDecisions": "載入關鍵決策",
  "sessionDetail.readThisFirst": "先讀這裡",
  "sessionDetail.noConfirmedTopic": "目前還沒有已確認的主題摘要。",
  "sessionDetail.refreshContext": "重新檢查",
  "sessionDetail.moveTopic": "移到另一個主題",
  "sessionDetail.moveThere": "移過去",
  "sessionDetail.makeMainTopic": "設成主要主題",
  "sessionDetail.startNewTopic": "開始新的主題",
  "sessionDetail.startNewTopic.placeholder": "例如：發票郵件追蹤",
  "sessionDetail.createTopic": "建立主題",
  "sessionDetail.otherTopics": "這次工作可能屬於的其他主題",
  "sessionDetail.otherTopics.summary":
    "只有在資訊足夠時，Footprint 才會建議其他主題。",
  "sessionDetail.otherTopics.empty": "這次工作目前沒有明顯相關的其他主題。",
  "sessionDetail.pickupNote": "接手便條",
  "sessionDetail.pickupNote.summary":
    "從下方的相關較早工作選一項，即可載入一段簡短的接手說明。",
  "sessionDetail.pickupExport": "匯出接手 ZIP",
  "sessionDetail.readThisFirst.subtitle": "正在確認這次工作是否屬於現有主題...",
  "sessionDetail.simpleSummary": "簡單摘要",
  "sessionDetail.simpleSummary.subtitle":
    "用白話描述這次工作階段發生了什麼事。",
  "sessionDetail.keyDecisions": "關鍵決策",
  "sessionDetail.keyDecisions.subtitle": "這次工作階段中做出或確認的選擇。",
  "sessionDetail.relatedEarlierWork": "相關較早工作",
  "sessionDetail.relatedEarlierWork.subtitle":
    "與這次工作共享主題、問題代碼或反覆出現問題的較早工作階段。",
  "sessionDetail.conversation": "對話內容",
  "sessionDetail.conversation.subtitle": "這次工作階段與 AI 交換的訊息。",
  "sessionDetail.activityLog": "自動活動紀錄",
  "sessionDetail.activityLog.subtitle":
    "自動記錄的工具呼叫、檔案讀取及其他操作。",
  "sessionDetail.supportingDetails": "補充細節",
  "sessionDetail.supportingDetails.subtitle":
    "這次工作階段儲存的檔案、程式碼片段及其他相關資料。",
  "sessionDetail.loadMoreNarratives": "顯示更多摘要",
  "sessionDetail.loadMoreDecisions": "顯示更多決策",
  "sessionDetail.loadMoreRelatedWork": "顯示更多相關工作",
  "sessionDetail.loadMoreConversation": "顯示更多對話",
  "sessionDetail.loadMoreSteps": "顯示更多步驟",
  "sessionDetail.loadMoreSupporting": "顯示更多補充細節",
  "evidenceDashboard.documentTitle": "Footprint 已儲存足跡",
  "evidenceDashboard.kicker": "加密足跡",
  "evidenceDashboard.title": "已儲存足跡",
  "evidenceDashboard.subtitle":
    "瀏覽重要 AI 工作的加密紀錄，快速篩選，只匯出真正需要的內容。",
  "evidenceDashboard.note":
    "當你需要可長期保存的紀錄時就看這裡。先搜尋，再用標籤或時間縮小範圍後匯出。",
  "evidenceDashboard.search.placeholder": "用主題、標籤或 AI 助手搜尋",
  "evidenceDashboard.stats.records": "已儲存紀錄",
  "evidenceDashboard.stats.today": "今天儲存",
  "evidenceDashboard.stats.storage": "使用空間",
  "evidenceDashboard.stats.labels": "標籤",
  "evidenceDashboard.latestCaptures": "近期活動",
  "evidenceDashboard.latestCaptures.loading": "正在載入近期活動...",
  "evidenceDashboard.timeline": "活動時間軸",
  "evidenceDashboard.timeline.subtitle":
    "快速查看 Footprint 何時儲存紀錄，好讓你先跳到正確時段。",
  "evidenceDashboard.timeline.loading": "正在載入時間軸...",
  "evidenceDashboard.filterLabels": "依標籤篩選",
  "evidenceDashboard.filterLabels.subtitle":
    "標籤可以幫你區分敏感案件、團隊或稽核分類。",
  "evidenceDashboard.manageLabels": "管理標籤",
  "evidenceDashboard.match": "符合",
  "evidenceDashboard.match.all": "全部",
  "evidenceDashboard.match.any": "任一",
  "evidenceDashboard.records.title": "足跡紀錄",
  "evidenceDashboard.records.subtitle":
    "打開單筆紀錄可查看解密後內容、Git 脈絡與匯出操作。",
  "evidenceDashboard.records.loading": "正在載入已儲存紀錄...",
  "evidenceDashboard.labels.loading": "正在載入標籤...",
  "evidenceDetail.documentTitle": "Footprint 足跡紀錄",
  "evidenceDetail.kicker": "已儲存足跡",
  "evidenceDetail.title": "足跡紀錄",
  "evidenceDetail.subtitle":
    "查看儲存的對話、檢查中繼資料，並直接在 Footprint 中匯出或驗證。",
  "evidenceDetail.note":
    "這頁是給可追溯、可稽核的紀錄使用，不是給日常接手工作。當你需要說明「當時發生了什麼」時就看這裡。",
  "evidenceDetail.loading": "正在載入已儲存足跡...",
  "evidenceDetail.record": "紀錄",
  "evidenceDetail.captured": "儲存時間",
  "evidenceDetail.conversation": "對話",
  "evidenceDetail.aiAssistant": "AI 助手",
  "evidenceDetail.messages": "訊息數",
  "evidenceDetail.labels": "標籤",
  "evidenceDetail.savedConversation": "已儲存對話",
  "evidenceDetail.savedConversation.subtitle":
    "這是目前在應用程式中載入的解密紀錄。",
  "evidenceExport.documentTitle": "Footprint 匯出已儲存足跡",
  "evidenceExport.kicker": "匯出已儲存足跡",
  "evidenceExport.title": "匯出 ZIP 封包",
  "evidenceExport.subtitle":
    "先選擇要包含哪些足跡，再預覽，最後下載可保存或交接的加密 ZIP。",
  "evidenceExport.note":
    "當你需要封存或把紀錄交給較小範圍的人時使用。先預覽，確保只匯出真正需要的內容。",
  "evidenceExport.whatToInclude": "要包含什麼",
  "evidenceExport.whatToInclude.subtitle":
    "先決定範圍，再決定是否把 Git 中繼資料一起帶走。",
  "evidenceExport.records": "紀錄範圍",
  "evidenceExport.records.all": "所有已儲存足跡",
  "evidenceExport.records.recent": "只含最近 30 天",
  "evidenceExport.extraContext": "額外脈絡",
  "evidenceExport.extraContext.git": "包含 Git 時間戳與 commit hash",
  "evidenceExport.preview": "封包預覽",
  "evidenceExport.preview.subtitle": "快速看一下 ZIP 裡大致會裝哪些內容。",
  "evidenceExport.preview.loading": "正在載入預覽...",
  "evidenceExport.preview.empty": "沒有符合的已儲存足跡。",
  "evidenceExport.preview.emptyHint": "試著切換上方的範圍。",
  "evidenceExport.info":
    "Footprint 會建立一個加密 ZIP，內含每筆紀錄的 JSON 中繼資料。",
  "status.completed": "已完成",
  "status.failed": "需要注意",
  "status.interrupted": "已停止",
  "status.running": "進行中",
  "role.user": "你",
  "role.assistant": "AI",
  "role.system": "系統",
  "context.savedTopic": "已儲存主題",
  "context.newTopicSuggestion": "新主題建議",
  "context.confidence.high": "高度相符",
  "context.confidence.medium": "可能相符",
  "context.confidence.low": "相符度低",
  "context.reason.sameFolder": "它發生在同一個資料夾。",
  "context.reason.noOtherTopic": "目前沒有其他已儲存主題在使用這個資料夾。",
  "context.reason.sameProblem": "它提到和先前工作相同的問題。",
  "context.reason.sameFailureFamily": "它符合先前看過的同類型問題。",
  "context.reason.similarGoal": "目標聽起來和先前工作相似。",
  "context.reason.recentContinuity": "它發生在相關工作之後不久。",
  "context.reason.preferred": "這個主題目前被標記為這個資料夾的主要主題。",
  "context.topicFrom": "來自 {{label}} 的主題",
  "context.untitledWork": "未命名工作",
  "context.untitledTopic": "未命名主題",
  "context.bestCurrentPicture": "目前最好的理解",
  "context.stillBlocking": "仍在阻擋",
  "context.stillUnclear": "仍不清楚",
  "context.currentDecisions": "目前決策",
  "context.olderDecisions": "已被取代的舊決策",
  "context.noBlockers": "目前沒有記錄到 blocker。",
  "context.noQuestions": "目前沒有記錄到待釐清問題。",
  "context.noCurrentDecisions": "目前還沒有記錄到有效決策。",
  "context.noReplacedDecisions": "目前還沒有記錄到被取代的決策。",
  "context.noConfirmedSummary": "目前還沒有已確認的主題摘要。",
  "context.noMatchingSignals": "沒有記錄到可對應的線索。",
  "context.noEarlierWork": "沒有較早的相關工作",
  "context.preferredFolder": "這個主題目前是此資料夾的主要主題。",
  "context.whySuggested": "Footprint 為什麼認為這可能是同一個主題：",
  "context.linkTopic": "連到這個主題",
  "context.keepSeparate": "保持分開",
  "context.startNewTopic": "開始新主題",
  "context.noSuggestedTopics": "這筆工作紀錄目前沒有建議主題。",
  "context.noOngoingTopics": "目前還沒有持續中的主題。",
  "context.openLatestWork": "打開最新工作",
  "context.latestRelatedWork": "最新相關工作",
  "context.openLatest": "打開最新一筆",
  "context.findRelated": "找相關工作",
  "context.showBroaderPattern": "查看更大的模式",
  "context.showThisProblem": "查看這個問題",
  "context.nothingUrgent": "這個檢視目前沒有特別急迫的事項。",
  "context.needsAttention": "需要注意",
  "context.recentlyImproved": "最近有改善",
  "context.openQuestions": "待釐清問題",
  "context.noSimilarPastWork": "這筆紀錄目前還沒有相似的過去工作。",
  "context.openLatestRelatedWork": "打開最新相關工作",
  "context.openShortSummary": "打開簡短摘要",
  "context.noConversation": "目前還沒有儲存對話內容。",
  "context.noTimeline": "目前還沒有逐步活動紀錄。",
  "context.noNarratives": "目前還沒有載入白話摘要。",
  "context.noDecisions": "目前還沒有載入關鍵決策。",
  "context.noArtifacts": "目前還沒有載入補充細節。",
  "context.savedWorkRecord": "工作紀錄",
  "context.open": "打開",
  "context.refreshSummary": "重新整理摘要",
  "context.inProgress": "進行中",
  "context.onlyHost": "只看 {{host}}",
  "context.whyThisMatches": "符合原因：",
  "context.noHighlights": "目前還沒有重點片段。",
  "context.resultsHere": "搜尋結果會顯示在這裡。",
  "evidence.noLabels": "沒有標籤",
  "evidence.noSavedRecords": "找不到已儲存紀錄",
  "evidence.noSavedRecordsPeriod": "這個時間範圍沒有已儲存紀錄",
  "evidence.record": "筆紀錄",
  "evidence.records": "筆紀錄",
};

DICTIONARY.ja = {
  ...DICTIONARY.en,
  "common.language": "言語",
  "common.exportZip": "ZIP を書き出す",
  "common.downloadZip": "ZIP をダウンロード",
  "common.refreshPreview": "プレビューを更新",
  "common.back": "戻る",
  "common.copyText": "テキストをコピー",
  "common.checkIntegrity": "整合性を確認",
  "sessionDashboard.documentTitle": "Footprint 作業概要",
  "sessionDashboard.documentTitleLive": "Footprint ローカルライブ作業概要",
  "sessionDashboard.kicker": "Footprint メモリービュー",
  "sessionDashboard.title": "作業概要",
  "sessionDashboard.summary.loading": "最近の作業を読み込んでいます...",
  "sessionDashboard.noteHtml":
    "まず <strong>今いちばん重要なこと</strong> を確認し、必要になったときだけ個別の作業記録を開いてください。<strong>進行中のトピック</strong> があれば、推測せずに正しい文脈へ戻れます。",
  "sessionDashboard.findAndFilter": "検索とフィルター",
  "sessionDashboard.findAndFilter.subtitle":
    "下の一覧を絞り込むか、フィルターを空にしてすべてを表示します。",
  "sessionDashboard.findPastWork": "過去の作業を探す",
  "sessionDashboard.aiHelper": "AI アシスタント",
  "sessionDashboard.workState": "作業状態",
  "sessionDashboard.groupBy": "再発した問題のまとめ方",
  "sessionDashboard.updateView": "表示を更新",
  "sessionDashboard.exportView": "この表示を書き出す",
  "sessionDashboard.clear": "クリア",
  "sessionDashboard.handoff.title": "今いちばん重要なこと",
  "sessionDashboard.trends.title": "再発した問題",
  "sessionDashboard.contexts.title": "進行中のトピック",
  "sessionDashboard.search.title": "関連する過去の作業",
  "sessionDashboard.sessions.title": "最近の作業",
  "sessionDashboard.liveBadge": "ローカルライブ製品 · 作業概要",
  "sessionDetail.documentTitle": "Footprint 作業記録",
  "sessionDetail.documentTitleLive": "Footprint ローカルライブ作業記録",
  "sessionDetail.kicker": "作業ブリーフ",
  "sessionDetail.title": "この作業",
  "sessionDetail.subtitle.loading": "保存された作業記録を読み込んでいます...",
  "sessionDetail.noteHtml":
    "初めて引き継ぐなら、まず <strong>最初に読む</strong> と <strong>引き継ぎメモ</strong> を確認してください。会話とアクティビティログは下にまとめ、最初の画面では実用的な要点だけを見せます。",
  "sessionDetail.liveBadge": "ローカルライブ製品 · 一覧へ戻る",
  "sessionDetail.refreshOverview": "概要を更新",
  "sessionDetail.loadSupportingDetails": "補足情報を読み込む",
  "sessionDetail.loadSimpleSummary": "簡単な要約を読み込む",
  "sessionDetail.loadKeyDecisions": "重要な判断を読み込む",
  "sessionDetail.readThisFirst": "最初に読む",
  "sessionDetail.readThisFirst.subtitle":
    "この作業が既存のトピックに属するか確認中...",
  "sessionDetail.pickupNote": "引き継ぎメモ",
  "sessionDetail.simpleSummary": "簡単な要約",
  "sessionDetail.simpleSummary.subtitle":
    "このセッションで何が起きたかをわかりやすく説明します。",
  "sessionDetail.keyDecisions": "重要な判断",
  "sessionDetail.keyDecisions.subtitle":
    "このセッション中に行われた、または確認された選択。",
  "sessionDetail.relatedEarlierWork": "関連する過去の作業",
  "sessionDetail.relatedEarlierWork.subtitle":
    "同じトピック、課題キー、または繰り返しの問題を共有する過去のセッション。",
  "sessionDetail.conversation": "会話",
  "sessionDetail.conversation.subtitle":
    "このセッション中に AI と交わしたメッセージ。",
  "sessionDetail.activityLog": "自動アクティビティログ",
  "sessionDetail.activityLog.subtitle":
    "自動で記録されたツール呼び出し、ファイル読み取り、その他の操作。",
  "sessionDetail.supportingDetails": "補足情報",
  "sessionDetail.supportingDetails.subtitle":
    "このセッション中に保存されたファイル、コードスニペット、その他の成果物。",
  "evidenceDashboard.documentTitle": "Footprint 保存済みフットプリント",
  "evidenceDashboard.kicker": "暗号化フットプリント",
  "evidenceDashboard.title": "保存済みフットプリント",
  "evidenceDashboard.subtitle":
    "重要な AI 作業の暗号化記録を見直し、すばやく絞り込み、必要なものだけを書き出します。",
  "evidenceDashboard.note":
    "長期保存できる記録が必要なときに使ってください。まず検索し、ラベルや期間で絞り込んでから書き出します。",
  "evidenceDashboard.search.placeholder":
    "トピック、ラベル、AI アシスタントで検索",
  "evidenceDashboard.stats.records": "保存済み記録",
  "evidenceDashboard.stats.today": "本日保存",
  "evidenceDashboard.stats.storage": "使用容量",
  "evidenceDashboard.stats.labels": "ラベル",
  "evidenceDashboard.latestCaptures": "最近のアクティビティ",
  "evidenceDashboard.timeline": "アクティビティタイムライン",
  "evidenceDashboard.filterLabels": "ラベルで絞り込む",
  "evidenceDashboard.manageLabels": "ラベルを管理",
  "evidenceDashboard.records.title": "フットプリントレコード",
  "evidenceDetail.documentTitle": "Footprint フットプリントレコード",
  "evidenceDetail.kicker": "保存済みフットプリント",
  "evidenceDetail.title": "フットプリントレコード",
  "evidenceDetail.subtitle":
    "保存した会話を確認し、メタデータを見直し、Footprint から直接書き出しや検証を行います。",
  "evidenceDetail.note":
    "この画面は日々の作業再開ではなく、監査用の記録確認に使います。",
  "evidenceExport.documentTitle": "Footprint 保存済みフットプリントの書き出し",
  "evidenceExport.kicker": "保存済みフットプリントを書き出す",
  "evidenceExport.title": "ZIP バンドルを書き出す",
  "evidenceExport.subtitle":
    "含めるフットプリントを選び、プレビューしてから、保管や共有に使える暗号化 ZIP をダウンロードします。",
  "evidenceExport.note":
    "フットプリントを保管したり、限られた相手に渡したりするときに使います。必要なものだけが入るよう、先にプレビューしてください。",
  "status.completed": "完了",
  "status.failed": "要確認",
  "status.interrupted": "停止",
  "status.running": "進行中",
  "sessionDashboard.findPastWork.placeholder":
    "機能名、ファイル名、バグ、質問など...",
  "sessionDashboard.referenceCode": "参照コード（上級向け）",
  "sessionDashboard.referenceCode.placeholder":
    "すでに誰かから渡されている場合だけ入力します",
  "sessionDashboard.state.running": "進行中",
  "sessionDashboard.state.completed": "完了",
  "sessionDashboard.state.failed": "要確認",
  "sessionDashboard.state.interrupted": "停止",
  "role.user": "あなた",
  "role.assistant": "AI",
  "role.system": "システム",
};

DICTIONARY["zh-CN"] = {
  ...DICTIONARY["zh-TW"],
  "common.locale.zh-TW": "繁體中文",
  "common.locale.zh-CN": "简体中文",
  "common.language": "语言",
  "common.copyText": "复制文字",
  "common.checkIntegrity": "检查完整性",
  "sessionDashboard.documentTitle": "Footprint 工作总览",
  "sessionDashboard.documentTitleLive": "Footprint 本地实时工作总览",
  "sessionDashboard.kicker": "Footprint 记忆视图",
  "sessionDashboard.title": "工作总览",
  "sessionDashboard.summary.loading": "正在载入你的近期工作...",
  "sessionDashboard.noteHtml":
    "先看 <strong>现在最重要的事</strong>，需要细节时再打开单一工作记录。<strong>持续中的主题</strong> 会帮你留在正确脉络里，不用重新猜。",
  "sessionDashboard.findAndFilter": "查找与筛选",
  "sessionDashboard.findAndFilter.subtitle":
    "缩小下方的显示范围，或留空筛选条件以查看全部。",
  "sessionDashboard.findPastWork": "找之前的工作",
  "sessionDashboard.findPastWork.placeholder":
    "功能、文件名、问题或待办事项...",
  "sessionDashboard.referenceCode": "参考代码（高级）",
  "sessionDashboard.referenceCode.placeholder":
    "只有在别人已经给你代号时才需要",
  "sessionDashboard.aiHelper": "AI 助手",
  "sessionDashboard.workState": "工作状态",
  "sessionDashboard.allStates": "所有状态",
  "sessionDashboard.state.running": "进行中",
  "sessionDashboard.state.completed": "已完成",
  "sessionDashboard.state.failed": "需要注意",
  "sessionDashboard.state.interrupted": "已停止",
  "sessionDashboard.groupBy": "重复问题分组方式",
  "sessionDashboard.groupBy.family": "更大的模式",
  "sessionDashboard.updateView": "更新画面",
  "sessionDashboard.exportView": "导出这个视图",
  "sessionDashboard.clear": "清除",
  "sessionDashboard.handoff.title": "现在最重要的事",
  "sessionDashboard.trends.title": "反复出现的问题",
  "sessionDashboard.contexts.title": "持续中的主题",
  "sessionDashboard.search.title": "较早的相关工作",
  "sessionDashboard.sessions.title": "近期工作",
  "sessionDashboard.liveBadge": "本地实时产品 · 工作总览",
  "sessionDetail.documentTitle": "Footprint 工作记录",
  "sessionDetail.documentTitleLive": "Footprint 本地实时工作记录",
  "sessionDetail.kicker": "工作简报",
  "sessionDetail.title": "这次工作",
  "sessionDetail.subtitle.loading": "正在载入这笔已保存的工作记录...",
  "sessionDetail.noteHtml":
    "如果你是第一次接手，先从 <strong>先读这里</strong> 和 <strong>接手便条</strong> 开始。对话与活动记录放在下方，让第一屏先给你可行的理解。",
  "sessionDetail.liveBadge": "本地实时产品 · 返回总览",
  "sessionDetail.refreshOverview": "刷新总览",
  "sessionDetail.loadSupportingDetails": "载入补充细节",
  "sessionDetail.loadSimpleSummary": "载入简单摘要",
  "sessionDetail.loadKeyDecisions": "载入关键决策",
  "sessionDetail.readThisFirst": "先读这里",
  "sessionDetail.readThisFirst.subtitle": "正在确认这次工作是否属于现有主题...",
  "sessionDetail.pickupNote": "接手便条",
  "sessionDetail.simpleSummary": "简单摘要",
  "sessionDetail.simpleSummary.subtitle":
    "用通俗语言描述这次工作会话发生了什么事。",
  "sessionDetail.keyDecisions": "关键决策",
  "sessionDetail.keyDecisions.subtitle": "这次工作会话中做出或确认的选择。",
  "sessionDetail.relatedEarlierWork": "相关较早工作",
  "sessionDetail.relatedEarlierWork.subtitle":
    "与这次工作共享主题、问题代码或反复出现问题的较早工作会话。",
  "sessionDetail.conversation": "对话内容",
  "sessionDetail.conversation.subtitle": "这次工作会话与 AI 交换的消息。",
  "sessionDetail.activityLog": "自动活动记录",
  "sessionDetail.activityLog.subtitle":
    "自动记录的工具调用、文件读取及其他操作。",
  "sessionDetail.supportingDetails": "补充细节",
  "sessionDetail.supportingDetails.subtitle":
    "这次工作会话保存的文件、代码片段及其他相关资料。",
  "evidenceDashboard.documentTitle": "Footprint 已保存足迹",
  "evidenceDashboard.kicker": "加密足迹",
  "evidenceDashboard.title": "已保存足迹",
  "evidenceDashboard.subtitle":
    "浏览重要 AI 工作的加密记录，快速筛选，只导出真正需要的内容。",
  "evidenceDashboard.note":
    "当你需要可长期保存的记录时就看这里。先搜索，再用标签或时间缩小范围后导出。",
  "evidenceDashboard.search.placeholder": "用主题、标签或 AI 助手搜索",
  "evidenceDashboard.stats.records": "已保存记录",
  "evidenceDashboard.stats.today": "今天保存",
  "evidenceDashboard.stats.storage": "已用空间",
  "evidenceDashboard.stats.labels": "标签",
  "evidenceDashboard.latestCaptures": "近期活动",
  "evidenceDashboard.timeline": "活动时间线",
  "evidenceDashboard.filterLabels": "按标签筛选",
  "evidenceDashboard.manageLabels": "管理标签",
  "evidenceDashboard.records.title": "足迹记录",
  "evidenceDetail.documentTitle": "Footprint 足迹记录",
  "evidenceDetail.kicker": "已保存足迹",
  "evidenceDetail.title": "足迹记录",
  "evidenceDetail.subtitle":
    "查看保存的对话、检查元数据，并直接在 Footprint 中导出或验证。",
  "evidenceExport.documentTitle": "Footprint 导出已保存足迹",
  "evidenceExport.kicker": "导出已保存足迹",
  "evidenceExport.title": "导出 ZIP 包",
  "evidenceExport.subtitle":
    "先选择要包含哪些足迹，再预览，最后下载可保存或交接的加密 ZIP。",
  "status.completed": "已完成",
  "status.failed": "需要注意",
  "status.interrupted": "已停止",
  "status.running": "进行中",
};

Object.assign(DICTIONARY.en, {
  "common.actions": "Actions",
  "common.clearAll": "Clear All",
  "common.clearSearch": "Clear search",
  "common.selectAll": "Select all",
  "common.notAvailable": "n/a",
  "common.savedWorkRecord": "saved work record",
  "common.savedWorkRecords": "saved work records",
  "common.attempt": "attempt",
  "common.attempts": "attempts",
  "common.time": "time",
  "common.times": "times",
  "common.message": "message",
  "common.messages": "messages",
  "common.step": "step",
  "common.steps": "steps",
  "common.item": "item",
  "common.items": "items",
  "common.relatedPattern": "related pattern",
  "common.relatedPatterns": "related patterns",
  "common.activeBlocker": "active blocker",
  "common.activeBlockers": "active blockers",
  "common.returnedProblem": "problem that came back",
  "common.returnedProblems": "problems that came back",

  "sessionDashboard.sessions.table.work": "Work",
  "sessionDashboard.sessions.table.ai": "AI",
  "sessionDashboard.sessions.table.state": "State",
  "sessionDashboard.sessions.table.started": "Started",

  "sessionDetail.liveProduct": "Local live product",
  "sessionDetail.backToOverview": "Back to Overview",

  "evidenceDashboard.search.label": "Search saved footprints",
  "evidenceDashboard.lastUpdated.never": "Never updated",
  "evidenceDashboard.selected.zero": "0 selected",
  "evidenceExport.file.records": "records",
  "evidenceExport.file.estimated": "Estimated size",

  "context.hostWork": "{{host}} work",
  "context.hostWorkOn": "{{host}} work on {{subject}}",
  "context.openShortSummaryBroader": "Open Broader Summary",

  "timeline.startedHost": "Started {{host}}.",
  "timeline.finishedHost": "{{host}} finished.",
  "timeline.sessionStarted": "This saved work record started.",
  "timeline.sessionCompleted": "This work finished normally.",
  "timeline.sessionFailed": "This work ended with a problem.",
  "timeline.sessionInterrupted": "This work was stopped early.",
  "timeline.closedUnexpectedly": "{{host}} closed unexpectedly.",

  "context.commandsObserved": "{{count}} commands were run.",
  "context.testsObserved": "{{count}} test runs were recorded.",

  "session.action.refreshSummaryDisabled":
    "This work is still in progress and cannot refresh yet.",
  "session.action.openSession": "Open session {{label}}",
  "session.action.refreshSummaryFor": "Refresh summary for {{label}}",
  "session.action.stillInProgress": "{{label}} is still in progress",
  "session.action.openMatchingSession": "Open matching session {{label}}",
  "session.action.onlyHostAria": "Only show work from {{host}}",
  "session.action.showBroaderPatternAria": "Show broader pattern {{label}}",
  "session.action.showThisProblemAria": "Show this problem {{label}}",
  "session.action.openLatestSessionAria": "Open latest session {{label}}",
  "session.action.searchForAria": "Search for {{label}}",
  "session.action.loadBroaderSummaryAria": "Load broader summary for {{label}}",
  "session.action.loadSummaryAria": "Load summary for {{label}}",
  "session.action.openLatestRelatedAria": "Open latest related work {{label}}",
  "session.action.linkTopicAria": "Link to topic {{label}}",
  "session.action.keepSeparateAria": "Keep {{label}} separate",
  "session.action.startNewTopicAria": "Start new topic {{label}}",
  "session.action.openLatestWorkAria": "Open latest work for {{label}}",

  "session.artifact.failure": "Failure",
  "session.artifact.errorCode": "Error code",
  "session.artifact.lintRule": "Lint rule",
  "session.artifact.test": "Test",
  "session.artifact.dependencies": "Dependencies",
  "session.artifact.dependencyChange": "change",
  "session.artifact.scope": "Scope",

  "session.context.folder": "Folder",
  "session.context.workedIn": "Worked in",
  "session.context.linkedToTopic": "linked to this topic",
  "session.context.inTopic": "in this topic",
  "session.context.latest": "latest",

  "session.trend.latestOutcomeFallback": "Latest outcome: {{outcome}}",
  "session.trend.blocking": "Still causing trouble",
  "session.trend.notBlocking": "Seen before, not currently blocking",
  "session.trend.lastSeen": "last seen {{value}}",
  "session.trend.seenIn": "Seen in {{sessions}} across {{attempts}}.",
  "session.trend.sessionBlocking": "This still appears to be a blocker.",
  "session.trend.sessionNotBlocking":
    "This has happened before but is not currently blocking.",
  "session.trend.encountered":
    "This work ran into this {{sessionAttempts}}; across related work it showed up {{globalAttempts}}.",

  "session.dashboard.summary.noWork": "No saved work yet.",
  "session.dashboard.summary.showingWork":
    "Showing {{visible}} of {{total}} recent saved work records. Open one to see what happened.",
  "session.dashboard.search.noMatches": "No earlier work matched that search.",
  "session.dashboard.search.showingMatches":
    "Showing {{visible}} earlier saved work records out of {{total}}.",
  "session.dashboard.search.placeholderSummary":
    "Type a word, file name, question, or problem to find earlier related work.",
  "session.dashboard.context.noTopics": "No ongoing topics are confirmed yet.",
  "session.dashboard.context.showingTopics":
    "Showing {{visible}} ongoing topics out of {{total}}.",
  "session.dashboard.trends.group.issue": "specific problem",
  "session.dashboard.trends.group.family": "broader pattern",
  "session.dashboard.trends.none":
    "No repeated problems stand out in this view right now.",
  "session.dashboard.trends.summary":
    "Showing {{visible}} {{grouping}} items out of {{total}}. {{active}} still need attention, {{recovered}} improved, and {{regressed}} came back again.",
  "session.dashboard.handoff.latest": "Latest work: {{label}} ({{startedAt}}).",
  "session.dashboard.handoff.latestNoTime": "Latest work: {{label}}.",
  "session.dashboard.handoff.summary":
    "{{sessions}} related work records found. {{blockers}} repeated blockers still need attention. {{latest}}",
  "session.dashboard.loading.work": "Loading Work...",
  "session.dashboard.loading.results": "Loading Results...",
  "session.dashboard.loading.trends": "Loading Repeated Problems...",
  "session.dashboard.export.success":
    "Exported {{count}} matching session bundle(s): {{filename}}",
  "session.dashboard.error.action": "Failed to run dashboard action.",
  "session.dashboard.error.filters": "Failed to apply dashboard filters.",
  "session.dashboard.error.connect": "Failed to connect UI.",

  "session.export.noArchive":
    "Session export did not return a downloadable archive.",
  "session.reingest.notReady":
    "Only finished or stopped work records can refresh their summary.",
  "session.reingest.inProgress": "Still In Progress",
  "session.reingest.whenStopped":
    "You can refresh the overview after this work stops running.",

  "session.detail.loading.conversation": "Loading Conversation...",
  "session.detail.loading.steps": "Loading Steps...",
  "session.detail.loading.relatedWork": "Loading Related Work...",
  "session.detail.loading.supporting": "Loading Supporting Details...",
  "session.detail.loading.summaries": "Loading Summaries...",
  "session.detail.loading.decisions": "Loading Decisions...",
  "session.detail.subtitle":
    "{{label}} · {{status}} · {{host}} · started {{startedAt}}",
  "session.detail.meta.aiHelper": "AI helper",
  "session.detail.meta.currentState": "Current state",
  "session.detail.meta.started": "Started",
  "session.detail.meta.finished": "Finished",
  "session.detail.meta.conversation": "Conversation so far",
  "session.detail.meta.timeline": "Automatic activity log",
  "session.detail.meta.supporting": "Supporting details",
  "session.detail.meta.related": "Related earlier work",
  "session.detail.meta.relatedNone": "No related earlier work yet",
  "session.detail.meta.relatedSummary":
    "{{patterns}} · {{blockers}} · {{regressed}}",
  "session.detail.meta.overview": "Simple overview",
  "session.detail.meta.ready": "Ready",
  "session.detail.meta.needsRefresh": "Needs refresh",
  "session.detail.meta.workedIn": "Worked in",
  "session.detail.meta.pathNote": "Full folder path available on hover.",
  "session.detail.context.none": "No confirmed topics yet",
  "session.detail.context.openRecord":
    "Open a saved work record to see whether it belongs to a longer-running topic.",
  "session.detail.context.confirmationRequired":
    "Footprint only suggests other topics when there is enough supporting data, and it waits for your confirmation.",
  "session.detail.context.noOtherTopics": "No other possible topics yet.",
  "session.detail.context.checking":
    "Checking whether this work belongs to an existing topic...",
  "session.detail.context.loadingConfirmed":
    "Loading confirmed topic summary...",
  "session.detail.context.loadingCandidatesSummary":
    "Footprint is gathering possible related topics.",
  "session.detail.context.loadingCandidates":
    "Loading possible related topics...",
  "session.detail.context.alreadyLinked":
    'This work is already part of "{{label}}". Start here before continuing.',
  "session.detail.context.reviewSuggestions":
    "No topic has been confirmed yet. Review the suggestions below before linking anything.",
  "session.detail.context.notLinked": "This work is not linked to a topic yet.",
  "session.detail.context.noSuggestions":
    "Footprint does not have any other topic suggestions for this work.",
  "session.detail.context.suggestionCount":
    "{{count}} possible topics found. Only link the ones that truly match.",
  "session.detail.context.refreshed": "Context review refreshed.",
  "session.detail.context.linked": "Linked session to context {{label}}.",
  "session.detail.context.createdFromRelated":
    "Created canonical context {{label}} from related sessions.",
  "session.detail.context.rejected": "Rejected suggested context {{label}}.",
  "session.detail.context.moved": "Moved session into {{label}}.",
  "session.detail.context.preferred":
    "Set {{label}} as the preferred context for this workspace.",
  "session.detail.context.newContext": "new context",
  "session.detail.context.refreshError": "Failed to refresh context review.",
  "session.detail.scope.exportingBroader": "Exporting Broader Summary...",
  "session.detail.scope.exportingPickup": "Exporting Pickup Summary...",
  "session.detail.scope.exportBroader": "Export Broader Summary ZIP",
  "session.detail.scope.exportPickup": "Export Pickup Summary ZIP",
  "session.detail.scope.loadFirst": "Load a short pickup note first.",
  "session.detail.scope.none": "No pickup note loaded yet.",
  "session.detail.scope.summaryText": "{{group}} · {{label}} · {{headline}}",
  "session.detail.scope.loadingFor":
    "Loading the short pickup note for {{label}}...",
  "session.detail.scope.loading": "Loading pickup note...",
  "session.detail.scope.exportSuccess":
    "Exported {{kind}} summary: {{filename}}",
  "session.detail.export.success": "Exported session bundle: {{filename}}",
  "session.detail.error.invalidContextResolution":
    "Context resolver did not return a valid result.",
  "session.detail.error.invalidContextList":
    "Context list tool did not return a valid result.",
  "session.detail.error.invalidContextMutation":
    "Context mutation did not return a valid result.",
  "session.detail.error.invalidScope":
    "History handoff tool did not return a valid scope.",
  "session.detail.error.invalidDetail":
    "Session detail tool did not return a valid session.",
  "session.detail.error.invalidMessages":
    "Session messages tool did not return a valid page.",
  "session.detail.error.invalidTimeline":
    "Session timeline tool did not return a valid page.",
  "session.detail.error.invalidTrends":
    "Session trends tool did not return a valid page.",
  "session.detail.error.invalidArtifacts":
    "Session artifacts tool did not return a valid page.",
  "session.detail.error.invalidNarratives":
    "Session narratives tool did not return a valid page.",
  "session.detail.error.invalidDecisions":
    "Session decisions tool did not return a valid page.",
  "session.detail.error.noSession": "No work record is loaded.",
  "session.detail.error.action": "Failed to run detail action.",
  "session.detail.error.sessionAction": "Failed to run session action.",
  "session.detail.error.connect": "Failed to connect UI.",
});

Object.assign(DICTIONARY["zh-TW"], {
  "common.actions": "操作",
  "common.clearAll": "全部清除",
  "common.clearSearch": "清除搜尋",
  "common.selectAll": "全選",
  "common.notAvailable": "無",
  "common.savedWorkRecord": "工作紀錄",
  "common.savedWorkRecords": "工作紀錄",
  "common.attempt": "次嘗試",
  "common.attempts": "次嘗試",
  "common.time": "次",
  "common.times": "次",
  "common.message": "則訊息",
  "common.messages": "則訊息",
  "common.step": "個步驟",
  "common.steps": "個步驟",
  "common.item": "項",
  "common.items": "項",
  "common.relatedPattern": "相關模式",
  "common.relatedPatterns": "相關模式",
  "common.activeBlocker": "個 blocker",
  "common.activeBlockers": "個 blocker",
  "common.returnedProblem": "個又出現的問題",
  "common.returnedProblems": "個又出現的問題",
  "sessionDashboard.sessions.table.work": "工作",
  "sessionDashboard.sessions.table.ai": "AI",
  "sessionDashboard.sessions.table.state": "狀態",
  "sessionDashboard.sessions.table.started": "開始時間",
  "sessionDetail.liveProduct": "本地即時產品",
  "sessionDetail.backToOverview": "返回總覽",
  "evidenceDashboard.search.label": "搜尋已儲存足跡",
  "evidenceDashboard.lastUpdated.never": "尚未更新",
  "evidenceDashboard.selected.zero": "已選 0 筆",
  "evidenceExport.file.records": "筆紀錄",
  "evidenceExport.file.estimated": "預估大小",
  "context.hostWork": "{{host}} 工作",
  "context.hostWorkOn": "{{host}} 在處理 {{subject}}",
  "context.openShortSummaryBroader": "打開較大模式摘要",
  "timeline.startedHost": "已啟動 {{host}}。",
  "timeline.finishedHost": "{{host}} 已結束。",
  "timeline.sessionStarted": "這筆工作紀錄已開始。",
  "timeline.sessionCompleted": "這次工作正常完成。",
  "timeline.sessionFailed": "這次工作以問題結束。",
  "timeline.sessionInterrupted": "這次工作被提前停止。",
  "timeline.closedUnexpectedly": "{{host}} 意外關閉。",
  "context.commandsObserved": "執行了 {{count}} 個指令。",
  "context.testsObserved": "記錄到 {{count}} 次測試執行。",
  "session.dashboard.summary.noWork": "目前還沒有已儲存的工作。",
  "session.dashboard.summary.showingWork":
    "顯示 {{visible}} / {{total}} 筆近期工作紀錄。",
  "session.dashboard.search.noMatches": "找不到符合的較早工作。",
  "session.dashboard.search.showingMatches":
    "顯示 {{visible}} / {{total}} 筆較早的相關工作。",
  "session.dashboard.search.placeholderSummary":
    "輸入關鍵字、檔名、問題或任務，即可找到較早的相關工作。",
  "session.dashboard.context.noTopics": "目前還沒有已確認的持續主題。",
  "session.dashboard.context.showingTopics":
    "顯示 {{visible}} / {{total}} 個持續主題。",
  "session.dashboard.trends.group.issue": "具體問題",
  "session.dashboard.trends.group.family": "較大模式",
  "session.dashboard.trends.none": "目前這個檢視裡沒有特別突出的重複問題。",
  "session.dashboard.trends.summary":
    "顯示 {{visible}} / {{total}} 個{{grouping}}。其中 {{active}} 個仍需注意，{{recovered}} 個最近有改善，{{regressed}} 個再次出現。",
  "session.dashboard.handoff.latest": "最新工作：{{label}}（{{startedAt}}）。",
  "session.dashboard.handoff.latestNoTime": "最新工作：{{label}}。",
  "session.dashboard.handoff.summary":
    "找到 {{sessions}} 筆相關工作紀錄。{{blockers}} 個重複 blocker 仍需注意。{{latest}}",
  "session.dashboard.loading.work": "正在載入工作...",
  "session.dashboard.loading.results": "正在載入結果...",
  "session.dashboard.loading.trends": "正在載入重複問題...",
  "session.dashboard.export.success":
    "已匯出 {{count}} 個符合條件的 session 封包：{{filename}}",
  "session.dashboard.error.action": "無法執行總覽操作。",
  "session.dashboard.error.filters": "無法套用篩選條件。",
  "session.dashboard.error.connect": "無法連線到介面。",
  "session.export.noArchive": "Session 匯出沒有回傳可下載的封包。",
  "session.reingest.notReady": "只有已完成或已停止的工作紀錄才能重新整理摘要。",
  "session.reingest.inProgress": "仍在進行中",
  "session.reingest.whenStopped": "等這次工作停止後才能重新整理摘要。",
  "session.detail.loading.conversation": "正在載入對話...",
  "session.detail.loading.steps": "正在載入步驟...",
  "session.detail.loading.relatedWork": "正在載入相關工作...",
  "session.detail.loading.supporting": "正在載入補充細節...",
  "session.detail.loading.summaries": "正在載入摘要...",
  "session.detail.loading.decisions": "正在載入決策...",
  "session.detail.subtitle":
    "{{label}} · {{status}} · {{host}} · 開始於 {{startedAt}}",
  "session.detail.meta.aiHelper": "AI 助手",
  "session.detail.meta.currentState": "目前狀態",
  "session.detail.meta.started": "開始時間",
  "session.detail.meta.finished": "結束時間",
  "session.detail.meta.conversation": "目前對話",
  "session.detail.meta.timeline": "自動活動紀錄",
  "session.detail.meta.supporting": "補充細節",
  "session.detail.meta.related": "相關較早工作",
  "session.detail.meta.relatedNone": "目前還沒有相關較早工作",
  "session.detail.meta.relatedSummary":
    "{{patterns}} · {{blockers}} · {{regressed}}",
  "session.detail.meta.overview": "簡單總覽",
  "session.detail.meta.ready": "已就緒",
  "session.detail.meta.needsRefresh": "需要更新",
  "session.detail.meta.workedIn": "工作資料夾",
  "session.detail.meta.pathNote": "將滑鼠移上去可查看完整路徑。",
  "session.detail.context.none": "目前還沒有已確認的主題",
  "session.detail.context.openRecord":
    "打開一筆工作紀錄後，就能查看它是否屬於某個較長期的主題。",
  "session.detail.context.confirmationRequired":
    "只有在資訊足夠時，Footprint 才會建議其他主題，並等待你確認。",
  "session.detail.context.noOtherTopics": "目前沒有其他可能的主題。",
  "session.detail.context.checking": "正在檢查這次工作是否屬於既有主題...",
  "session.detail.context.loadingConfirmed": "正在載入已確認主題摘要...",
  "session.detail.context.loadingCandidatesSummary":
    "Footprint 正在整理可能相關的主題。",
  "session.detail.context.loadingCandidates": "正在載入可能相關的主題...",
  "session.detail.context.alreadyLinked":
    "這次工作已屬於「{{label}}」。繼續前請先看這裡。",
  "session.detail.context.reviewSuggestions":
    "目前還沒有確認主題。連結前請先檢查下方建議。",
  "session.detail.context.notLinked": "這次工作目前尚未連到任何主題。",
  "session.detail.context.noSuggestions": "Footprint 目前沒有其他主題建議。",
  "session.detail.context.suggestionCount":
    "找到 {{count}} 個可能的主題，只連結真正相符的即可。",
  "session.detail.context.refreshed": "主題檢視已更新。",
  "session.detail.context.linked": "已把這筆工作連到主題 {{label}}。",
  "session.detail.context.createdFromRelated":
    "已從相關工作建立正式主題 {{label}}。",
  "session.detail.context.rejected": "已拒絕建議主題 {{label}}。",
  "session.detail.context.moved": "已把這筆工作移到 {{label}}。",
  "session.detail.context.preferred": "已將 {{label}} 設成此資料夾的主要主題。",
  "session.detail.context.newContext": "新主題",
  "session.detail.context.refreshError": "無法更新主題檢視。",
  "session.detail.scope.exportingBroader": "正在匯出較大模式摘要...",
  "session.detail.scope.exportingPickup": "正在匯出接手摘要...",
  "session.detail.scope.exportBroader": "匯出較大模式 ZIP",
  "session.detail.scope.exportPickup": "匯出接手摘要 ZIP",
  "session.detail.scope.loadFirst": "請先載入一段接手便條。",
  "session.detail.scope.none": "目前還沒有載入接手便條。",
  "session.detail.scope.summaryText": "{{group}} · {{label}} · {{headline}}",
  "session.detail.scope.loadingFor": "正在載入 {{label}} 的接手便條...",
  "session.detail.scope.loading": "正在載入接手便條...",
  "session.detail.scope.exportSuccess": "已匯出 {{kind}} 摘要：{{filename}}",
  "session.detail.export.success": "已匯出 session 封包：{{filename}}",
  "session.detail.error.invalidContextResolution":
    "Context resolver 回傳格式無效。",
  "session.detail.error.invalidContextList": "Context list 回傳格式無效。",
  "session.detail.error.invalidContextMutation":
    "Context mutation 回傳格式無效。",
  "session.detail.error.invalidScope": "History handoff 回傳格式無效。",
  "session.detail.error.invalidDetail": "Session detail 回傳格式無效。",
  "session.detail.error.invalidMessages": "Session messages 回傳分頁格式無效。",
  "session.detail.error.invalidTimeline": "Session timeline 回傳分頁格式無效。",
  "session.detail.error.invalidTrends": "Session trends 回傳分頁格式無效。",
  "session.detail.error.invalidArtifacts":
    "Session artifacts 回傳分頁格式無效。",
  "session.detail.error.invalidNarratives":
    "Session narratives 回傳分頁格式無效。",
  "session.detail.error.invalidDecisions":
    "Session decisions 回傳分頁格式無效。",
  "session.detail.error.noSession": "目前沒有載入工作紀錄。",
  "session.detail.error.action": "無法執行詳情頁操作。",
  "session.detail.error.sessionAction": "無法執行這筆 session 的操作。",
  "session.detail.error.connect": "無法連線到介面。",
});

Object.assign(DICTIONARY.ja, {
  "common.actions": "操作",
  "common.clearAll": "すべてクリア",
  "common.clearSearch": "検索をクリア",
  "common.selectAll": "すべて選択",
  "common.notAvailable": "なし",
  "sessionDashboard.sessions.table.work": "作業",
  "sessionDashboard.sessions.table.ai": "AI",
  "sessionDashboard.sessions.table.state": "状態",
  "sessionDashboard.sessions.table.started": "開始",
  "sessionDetail.liveProduct": "ローカルライブ製品",
  "sessionDetail.backToOverview": "一覧へ戻る",
  "evidenceDashboard.search.label": "保存済みフットプリントを検索",
  "evidenceDashboard.lastUpdated.never": "未更新",
  "evidenceDashboard.selected.zero": "0 件選択中",
  "evidenceExport.file.records": "件",
  "evidenceExport.file.estimated": "推定サイズ",
  "context.hostWork": "{{host}} の作業",
  "context.hostWorkOn": "{{host}} の {{subject}} 作業",
  "session.dashboard.summary.noWork": "保存済みの作業はまだありません。",
  "session.dashboard.loading.work": "作業を読み込み中...",
  "session.dashboard.loading.results": "結果を読み込み中...",
  "session.dashboard.loading.trends": "再発した問題を読み込み中...",
  "session.reingest.notReady":
    "要約を更新できるのは完了または停止した作業だけです。",
  "session.detail.loading.conversation": "会話を読み込み中...",
  "session.detail.loading.steps": "手順を読み込み中...",
  "session.detail.loading.relatedWork": "関連作業を読み込み中...",
  "session.detail.loading.supporting": "補足情報を読み込み中...",
  "session.detail.loading.summaries": "要約を読み込み中...",
  "session.detail.loading.decisions": "判断内容を読み込み中...",
  "session.detail.context.refreshed": "トピック確認を更新しました。",
  "session.detail.error.noSession": "作業記録が読み込まれていません。",
  "session.detail.error.action": "詳細画面の操作に失敗しました。",
  "session.detail.error.sessionAction": "この作業の操作に失敗しました。",
  "session.detail.error.connect": "UI に接続できませんでした。",
});

Object.assign(DICTIONARY["zh-CN"], {
  "common.actions": "操作",
  "common.clearAll": "全部清除",
  "common.clearSearch": "清除搜索",
  "common.selectAll": "全选",
  "common.notAvailable": "无",
  "sessionDashboard.sessions.table.work": "工作",
  "sessionDashboard.sessions.table.ai": "AI",
  "sessionDashboard.sessions.table.state": "状态",
  "sessionDashboard.sessions.table.started": "开始时间",
  "sessionDetail.liveProduct": "本地实时产品",
  "sessionDetail.backToOverview": "返回总览",
  "evidenceDashboard.search.label": "搜索已保存足迹",
  "evidenceDashboard.lastUpdated.never": "尚未更新",
  "evidenceDashboard.selected.zero": "已选 0 条",
  "evidenceExport.file.records": "条记录",
  "evidenceExport.file.estimated": "预计大小",
  "context.hostWork": "{{host}} 工作",
  "context.hostWorkOn": "{{host}} 在处理 {{subject}}",
  "session.dashboard.summary.noWork": "目前还没有已保存的工作。",
  "session.dashboard.loading.work": "正在加载工作...",
  "session.dashboard.loading.results": "正在加载结果...",
  "session.dashboard.loading.trends": "正在加载重复问题...",
  "session.reingest.notReady": "只有已完成或已停止的工作记录才能刷新摘要。",
  "session.detail.loading.conversation": "正在加载对话...",
  "session.detail.loading.steps": "正在加载步骤...",
  "session.detail.loading.relatedWork": "正在加载相关工作...",
  "session.detail.loading.supporting": "正在加载补充细节...",
  "session.detail.loading.summaries": "正在加载摘要...",
  "session.detail.loading.decisions": "正在加载决策...",
  "session.detail.context.refreshed": "主题检查已刷新。",
  "session.detail.error.noSession": "当前没有已加载的工作记录。",
  "session.detail.error.action": "无法执行详情页操作。",
  "session.detail.error.sessionAction": "无法执行这条工作记录的操作。",
  "session.detail.error.connect": "无法连接到界面。",
});

Object.assign(DICTIONARY.en, {
  "common.close": "Close",
  "common.savedRecord": "{{count}} saved record",
  "common.savedRecords": "{{count}} saved records",
  "common.justNow": "Just now",
  "common.minutesAgo": "{{count}}m ago",
  "common.hoursAgo": "{{count}}h ago",
  "common.daysAgo": "{{count}}d ago",
  "common.unknownAi": "Unknown AI",
  "common.unknownError": "Unknown error",
  "common.copied": "Copied",
  "evidenceDashboard.search.noResults": 'No results found for "{{query}}".',
  "evidenceDashboard.search.showingSome":
    "Showing {{shown}} of {{total}} saved records.",
  "evidenceDashboard.search.results": "{{count}} results",
  "evidenceDashboard.labels.none": "No labels found yet.",
  "evidenceDashboard.labels.rename": "Rename",
  "evidenceDashboard.labels.delete": "Delete",
  "evidenceDashboard.labels.renamePrompt": 'Rename label "{{tag}}" to:',
  "evidenceDashboard.labels.renameSuccess":
    'Renamed "{{oldTag}}" to "{{newTag}}" in {{count}} saved records.',
  "evidenceDashboard.labels.renameNoMatch":
    'No saved records use the label "{{tag}}".',
  "evidenceDashboard.labels.renameFailed":
    "Couldn't rename that label: {{message}}",
  "evidenceDashboard.labels.deleteConfirm":
    'Delete label "{{tag}}" from every saved record? This cannot be undone.',
  "evidenceDashboard.labels.deleteSuccess":
    'Removed "{{tag}}" from {{count}} saved records.',
  "evidenceDashboard.labels.deleteNoMatch":
    'No saved records use the label "{{tag}}".',
  "evidenceDashboard.labels.deleteFailed":
    "Couldn't delete that label: {{message}}",
  "evidenceDashboard.records.empty": "No saved records yet.",
  "evidenceDashboard.records.emptySearch":
    'No saved records match "{{query}}".',
  "evidenceDashboard.records.emptyLabels":
    "No saved records match these labels: {{labels}}.",
  "evidenceDashboard.records.loadError": "Could not load saved records.",
  "evidenceDashboard.records.connectError": "Could not connect to Footprint.",
  "evidenceDashboard.latestCaptures.empty": "No recent activity yet.",
  "evidenceDashboard.timeline.empty": "No saved records in this time period.",
  "evidenceDashboard.timeline.clickHint": "Click to view details",
  "evidenceDashboard.lastUpdated.time": "Updated {{value}}",
  "evidenceDashboard.notification.newRecords":
    "{{count}} new saved records added",
  "evidenceDashboard.selected.count": "{{count}} selected",
  "evidenceDashboard.selection.required":
    "Select one or more saved records first.",
  "evidenceDashboard.exporting": "Exporting...",
  "evidenceDashboard.deleting": "Deleting...",
  "evidenceDashboard.export.success": "Exported {{count}} saved records.",
  "evidenceDashboard.export.failed": "Export failed",
  "evidenceDashboard.export.partial":
    "The export finished, but Footprint could not read the response cleanly.",
  "evidenceDashboard.export.failedWithMessage": "Export failed: {{message}}",
  "evidenceDashboard.delete.confirm":
    "Delete {{count}} saved records? This cannot be undone.",
  "evidenceDashboard.delete.success": "Deleted {{count}} saved records.",
  "evidenceDashboard.delete.failed": "Delete failed",
  "evidenceDashboard.delete.failedWithMessage": "Delete failed: {{message}}",
  "evidenceDetail.labels.none": "No labels",
  "evidenceDetail.gitCommit": "Git commit",
  "evidenceDetail.gitTimestamp": "Git timestamp",
  "evidenceDetail.messagesCount": "{{count}} messages",
  "evidenceDetail.export.success": "Exported footprint {{id}}.",
  "evidenceDetail.verify.success": "Integrity check completed.",
  "evidenceDetail.copy.success": "Copied the saved text.",
  "evidenceDetail.error.noText": "There is no saved text to show or copy yet.",
  "evidenceDetail.error.invalidPayload":
    "The footprint view expected structured content but did not receive it.",
  "evidenceDetail.error.load":
    "Could not load this saved footprint: {{message}}",
  "evidenceDetail.error.goBack": "Could not return to the footprint overview.",
  "evidenceDetail.error.noEvidenceLoaded": "No saved footprint is loaded yet.",
  "evidenceDetail.error.export": "Export failed: {{message}}",
  "evidenceDetail.error.verify": "Integrity check failed: {{message}}",
  "evidenceDetail.error.copy": "Could not copy the saved text.",
  "evidenceDetail.error.connect": "Could not connect to Footprint.",
  "evidenceExport.preview.more": "... and {{count}} more saved records",
  "evidenceExport.success":
    "Export complete. {{count}} saved records added to {{filename}}.",
  "evidenceExport.exporting": "Exporting...",
  "evidenceExport.error.failed": "Export failed. Please try again.",
  "evidenceExport.error.process": "Failed to process result: {{message}}",
  "evidenceExport.error.goBack": "Could not return to the footprint overview.",
  "evidenceExport.error.refresh": "Could not refresh the preview: {{message}}",
  "evidenceExport.error.export": "Export failed: {{message}}",
  "evidenceExport.error.connect": "Could not connect to Footprint.",
  "liveDemo.error.hostRequired":
    "This live view needs the Footprint local preview host. Start the local demo backend, then reload this page.",
  "liveDemo.error.invalidJson":
    "The local demo returned an unexpected response: {{message}}",
  "liveDemo.empty.subtitle":
    "No recorded sessions yet. Run Footprint once, then reload this page.",
  "liveDemo.empty.body":
    "Footprint did not find any recorded sessions in the current local database.",
});

Object.assign(DICTIONARY["zh-TW"], {
  "common.close": "關閉",
  "common.savedRecord": "{{count}} 筆已儲存紀錄",
  "common.savedRecords": "{{count}} 筆已儲存紀錄",
  "common.savedWorkRecord": "工作紀錄",
  "common.savedWorkRecords": "工作紀錄",
  "common.justNow": "剛剛",
  "common.minutesAgo": "{{count}} 分鐘前",
  "common.hoursAgo": "{{count}} 小時前",
  "common.daysAgo": "{{count}} 天前",
  "common.unknownAi": "未知 AI",
  "common.unknownError": "未知錯誤",
  "common.copied": "已複製",
  "evidenceDashboard.search.noResults": "找不到和「{{query}}」相關的結果。",
  "evidenceDashboard.search.showingSome":
    "目前顯示 {{shown}} / {{total}} 筆已儲存紀錄。",
  "evidenceDashboard.search.results": "共 {{count}} 筆結果",
  "evidenceDashboard.labels.none": "目前還沒有標籤。",
  "evidenceDashboard.labels.rename": "重新命名",
  "evidenceDashboard.labels.delete": "刪除",
  "evidenceDashboard.labels.renamePrompt": "把標籤「{{tag}}」改成：",
  "evidenceDashboard.labels.renameSuccess":
    "已把「{{oldTag}}」改成「{{newTag}}」，共更新 {{count}} 筆紀錄。",
  "evidenceDashboard.labels.renameNoMatch":
    "沒有任何已儲存紀錄使用「{{tag}}」這個標籤。",
  "evidenceDashboard.labels.renameFailed": "無法重新命名標籤：{{message}}",
  "evidenceDashboard.labels.deleteConfirm":
    "要從所有已儲存紀錄刪除標籤「{{tag}}」嗎？這個動作無法復原。",
  "evidenceDashboard.labels.deleteSuccess":
    "已從 {{count}} 筆紀錄移除「{{tag}}」。",
  "evidenceDashboard.labels.deleteNoMatch":
    "沒有任何已儲存紀錄使用「{{tag}}」這個標籤。",
  "evidenceDashboard.labels.deleteFailed": "無法刪除標籤：{{message}}",
  "evidenceDashboard.records.empty": "目前還沒有已儲存紀錄。",
  "evidenceDashboard.records.emptySearch":
    "沒有符合「{{query}}」的已儲存紀錄。",
  "evidenceDashboard.records.emptyLabels":
    "沒有符合這些標籤的已儲存紀錄：{{labels}}。",
  "evidenceDashboard.records.loadError": "無法載入已儲存紀錄。",
  "evidenceDashboard.records.connectError": "無法連線到 Footprint。",
  "evidenceDashboard.latestCaptures.empty": "目前還沒有最近的保存紀錄。",
  "evidenceDashboard.timeline.empty": "這段時間內沒有已儲存紀錄。",
  "evidenceDashboard.timeline.clickHint": "點一下可查看細節",
  "evidenceDashboard.lastUpdated.time": "上次更新：{{value}}",
  "evidenceDashboard.notification.newRecords": "新增加 {{count}} 筆已儲存紀錄",
  "evidenceDashboard.selected.count": "已選 {{count}} 筆",
  "evidenceDashboard.selection.required": "請先選擇一筆或多筆已儲存紀錄。",
  "evidenceDashboard.exporting": "匯出中...",
  "evidenceDashboard.deleting": "刪除中...",
  "evidenceDashboard.export.success": "已匯出 {{count}} 筆已儲存紀錄。",
  "evidenceDashboard.export.failed": "匯出失敗",
  "evidenceDashboard.export.partial":
    "匯出已完成，但 Footprint 無法完整解析回傳內容。",
  "evidenceDashboard.export.failedWithMessage": "匯出失敗：{{message}}",
  "evidenceDashboard.delete.confirm":
    "要刪除 {{count}} 筆已儲存紀錄嗎？這個動作無法復原。",
  "evidenceDashboard.delete.success": "已刪除 {{count}} 筆已儲存紀錄。",
  "evidenceDashboard.delete.failed": "刪除失敗",
  "evidenceDashboard.delete.failedWithMessage": "刪除失敗：{{message}}",
  "evidenceDetail.labels.none": "沒有標籤",
  "evidenceDetail.gitCommit": "Git commit",
  "evidenceDetail.gitTimestamp": "Git 時間戳",
  "evidenceDetail.messagesCount": "{{count}} 則訊息",
  "evidenceDetail.export.success": "已匯出足跡 {{id}}。",
  "evidenceDetail.verify.success": "完整性檢查已完成。",
  "evidenceDetail.copy.success": "已複製保存文字。",
  "evidenceDetail.error.noText": "目前沒有可顯示或可複製的保存文字。",
  "evidenceDetail.error.invalidPayload":
    "足跡頁面預期收到結構化資料，但實際沒有收到。",
  "evidenceDetail.error.load": "無法載入這筆已儲存足跡：{{message}}",
  "evidenceDetail.error.goBack": "無法返回足跡總覽。",
  "evidenceDetail.error.noEvidenceLoaded": "目前還沒有載入已儲存足跡。",
  "evidenceDetail.error.export": "匯出失敗：{{message}}",
  "evidenceDetail.error.verify": "完整性檢查失敗：{{message}}",
  "evidenceDetail.error.copy": "無法複製保存文字。",
  "evidenceDetail.error.connect": "無法連線到 Footprint。",
  "evidenceExport.preview.more": "... 還有 {{count}} 筆已儲存紀錄",
  "evidenceExport.success":
    "匯出完成。{{count}} 筆已儲存紀錄已加入 {{filename}}。",
  "evidenceExport.exporting": "匯出中...",
  "evidenceExport.error.failed": "匯出失敗，請再試一次。",
  "evidenceExport.error.process": "無法處理結果：{{message}}",
  "evidenceExport.error.goBack": "無法返回足跡總覽。",
  "evidenceExport.error.refresh": "無法更新預覽：{{message}}",
  "evidenceExport.error.export": "匯出失敗：{{message}}",
  "evidenceExport.error.connect": "無法連線到 Footprint。",
  "liveDemo.error.hostRequired":
    "這個即時檢視需要 Footprint 本機預覽主機。請先啟動本地 demo backend，再重新整理。",
  "liveDemo.error.invalidJson": "本地 demo 回傳了非預期內容：{{message}}",
  "liveDemo.empty.subtitle":
    "目前還沒有錄製過的工作。先執行一次 Footprint，再重新整理這個頁面。",
  "liveDemo.empty.body": "Footprint 在目前的本機資料庫裡找不到任何已錄製工作。",
  "session.context.folder": "資料夾",
  "session.context.workedIn": "工作於",
  "session.context.linkedToTopic": "已連到這個主題",
  "session.context.inTopic": "屬於這個主題",
  "session.context.latest": "最新",
});

Object.assign(DICTIONARY.ja, {
  "common.close": "閉じる",
  "common.savedRecord": "{{count}} 件の保存記録",
  "common.savedRecords": "{{count}} 件の保存記録",
  "common.justNow": "たった今",
  "common.minutesAgo": "{{count}} 分前",
  "common.hoursAgo": "{{count}} 時間前",
  "common.daysAgo": "{{count}} 日前",
  "common.unknownAi": "不明な AI",
  "common.unknownError": "不明なエラー",
  "common.copied": "コピーしました",
  "evidenceDashboard.search.noResults":
    "「{{query}}」に一致する結果はありません。",
  "evidenceDashboard.search.showingSome":
    "{{total}} 件中 {{shown}} 件を表示しています。",
  "evidenceDashboard.search.results": "{{count}} 件の結果",
  "evidenceDashboard.labels.none": "ラベルはまだありません。",
  "evidenceDashboard.labels.rename": "名前を変える",
  "evidenceDashboard.labels.delete": "削除",
  "evidenceDashboard.labels.renamePrompt": "ラベル「{{tag}}」の新しい名前:",
  "evidenceDashboard.labels.renameSuccess":
    "「{{oldTag}}」を「{{newTag}}」に変更し、{{count}} 件を更新しました。",
  "evidenceDashboard.labels.renameNoMatch":
    "ラベル「{{tag}}」を使っている保存記録はありません。",
  "evidenceDashboard.labels.renameFailed":
    "ラベル名を変更できませんでした: {{message}}",
  "evidenceDashboard.labels.deleteConfirm":
    "すべての保存記録からラベル「{{tag}}」を削除しますか？この操作は元に戻せません。",
  "evidenceDashboard.labels.deleteSuccess":
    "「{{tag}}」を {{count}} 件の記録から削除しました。",
  "evidenceDashboard.labels.deleteNoMatch":
    "ラベル「{{tag}}」を使っている保存記録はありません。",
  "evidenceDashboard.labels.deleteFailed":
    "ラベルを削除できませんでした: {{message}}",
  "evidenceDashboard.records.empty": "保存済みの記録はまだありません。",
  "evidenceDashboard.records.emptySearch":
    "「{{query}}」に一致する保存記録はありません。",
  "evidenceDashboard.records.emptyLabels":
    "これらのラベルに一致する保存記録はありません: {{labels}}。",
  "evidenceDashboard.records.loadError": "保存記録を読み込めませんでした。",
  "evidenceDashboard.records.connectError":
    "Footprint に接続できませんでした。",
  "evidenceDashboard.latestCaptures.empty": "最近の保存記録はまだありません。",
  "evidenceDashboard.timeline.empty": "この期間に保存記録はありません。",
  "evidenceDashboard.timeline.clickHint": "クリックすると詳細を見られます",
  "evidenceDashboard.lastUpdated.time": "更新: {{value}}",
  "evidenceDashboard.notification.newRecords":
    "{{count}} 件の新しい保存記録があります",
  "evidenceDashboard.selected.count": "{{count}} 件選択中",
  "evidenceDashboard.selection.required":
    "まず 1 件以上の保存記録を選択してください。",
  "evidenceDashboard.exporting": "書き出し中...",
  "evidenceDashboard.deleting": "削除中...",
  "evidenceDashboard.export.success":
    "{{count}} 件の保存記録を書き出しました。",
  "evidenceDashboard.export.failed": "書き出しに失敗しました",
  "evidenceDashboard.export.partial":
    "書き出しは完了しましたが、Footprint が結果を完全には読み取れませんでした。",
  "evidenceDashboard.export.failedWithMessage":
    "書き出しに失敗しました: {{message}}",
  "evidenceDashboard.delete.confirm":
    "{{count}} 件の保存記録を削除しますか？この操作は元に戻せません。",
  "evidenceDashboard.delete.success": "{{count}} 件の保存記録を削除しました。",
  "evidenceDashboard.delete.failed": "削除に失敗しました",
  "evidenceDashboard.delete.failedWithMessage":
    "削除に失敗しました: {{message}}",
  "evidenceDetail.labels.none": "ラベルなし",
  "evidenceDetail.gitCommit": "Git コミット",
  "evidenceDetail.gitTimestamp": "Git 時刻",
  "evidenceDetail.messagesCount": "{{count}} 件のメッセージ",
  "evidenceDetail.export.success": "フットプリント {{id}} を書き出しました。",
  "evidenceDetail.verify.success": "整合性チェックが完了しました。",
  "evidenceDetail.copy.success": "保存テキストをコピーしました。",
  "evidenceDetail.error.noText":
    "表示またはコピーできる保存テキストがまだありません。",
  "evidenceDetail.error.invalidPayload":
    "フットプリント画面は構造化データを期待していましたが受け取れませんでした。",
  "evidenceDetail.error.load":
    "この保存フットプリントを読み込めませんでした: {{message}}",
  "evidenceDetail.error.goBack": "フットプリント一覧に戻れませんでした。",
  "evidenceDetail.error.noEvidenceLoaded":
    "保存フットプリントがまだ読み込まれていません。",
  "evidenceDetail.error.export": "書き出しに失敗しました: {{message}}",
  "evidenceDetail.error.verify": "整合性チェックに失敗しました: {{message}}",
  "evidenceDetail.error.copy": "保存テキストをコピーできませんでした。",
  "evidenceDetail.error.connect": "Footprint に接続できませんでした。",
  "evidenceExport.preview.more": "... さらに {{count}} 件の保存記録",
  "evidenceExport.success":
    "書き出しが完了しました。{{count}} 件を {{filename}} に追加しました。",
  "evidenceExport.exporting": "書き出し中...",
  "evidenceExport.error.failed":
    "書き出しに失敗しました。もう一度試してください。",
  "evidenceExport.error.process": "結果を処理できませんでした: {{message}}",
  "evidenceExport.error.goBack": "フットプリント一覧に戻れませんでした。",
  "evidenceExport.error.refresh":
    "プレビューを更新できませんでした: {{message}}",
  "evidenceExport.error.export": "書き出しに失敗しました: {{message}}",
  "evidenceExport.error.connect": "Footprint に接続できませんでした。",
  "liveDemo.error.hostRequired":
    "このライブ表示には Footprint のローカルプレビューホストが必要です。先にローカル demo backend を起動してから再読み込みしてください。",
  "liveDemo.error.invalidJson":
    "ローカル demo から想定外の応答が返りました: {{message}}",
  "liveDemo.empty.subtitle":
    "記録済みの作業はまだありません。まず Footprint を一度実行してから、このページを再読み込みしてください。",
  "liveDemo.empty.body":
    "現在のローカルデータベースには記録済みの作業が見つかりませんでした。",
  "session.context.folder": "フォルダ",
  "session.context.workedIn": "作業フォルダ",
  "session.context.linkedToTopic": "このトピックに紐づく",
  "session.context.inTopic": "このトピック内",
  "session.context.latest": "最新",
  "sessionDashboard.allAssistants": "すべての AI アシスタント",
  "sessionDashboard.allStates": "すべての状態",
  "sessionDashboard.groupBy.issue": "具体的な問題",
  "sessionDashboard.groupBy.family": "より大きなパターン",
  "sessionDashboard.search.loading":
    "上にキーワードを入れると、関連する過去の作業を探せます。",
  "sessionDashboard.sessions.subtitle":
    "新しい順です。まずわかりやすい要約を見て、必要なときだけ詳しい履歴を開いてください。",
  "sessionDashboard.sessions.empty": "保存済みの作業記録はまだありません。",
  "sessionDashboard.trends.empty": "目立つ再発問題はまだありません。",
  "sessionDashboard.contexts.empty": "進行中のトピックはまだありません。",
  "sessionDashboard.search.empty": "検索結果はここに表示されます。",
  "sessionDashboard.loadMoreTrends": "再発問題をもっと見る",
  "sessionDashboard.loadMoreSearch": "結果をもっと見る",
  "sessionDashboard.loadMoreSessions": "作業をもっと見る",
  "session.dashboard.summary.showingWork":
    "最近の保存済み作業 {{total}} 件中 {{visible}} 件を表示しています。",
  "session.dashboard.search.noMatches":
    "一致する過去の作業はありませんでした。",
  "session.dashboard.search.showingMatches":
    "過去の関連作業 {{total}} 件中 {{visible}} 件を表示しています。",
  "session.dashboard.search.placeholderSummary":
    "単語、ファイル名、質問、問題を入力すると、関連する過去の作業を探せます。",
  "session.dashboard.context.noTopics":
    "確認済みの進行中トピックはまだありません。",
  "session.dashboard.context.showingTopics":
    "進行中トピック {{total}} 件中 {{visible}} 件を表示しています。",
  "session.dashboard.trends.group.issue": "具体的な問題",
  "session.dashboard.trends.group.family": "より大きなパターン",
  "session.dashboard.trends.none": "この表示では目立つ再発問題はありません。",
  "session.dashboard.trends.summary":
    "{{grouping}} を {{total}} 件中 {{visible}} 件表示しています。{{active}} 件はまだ注意が必要で、{{recovered}} 件は改善し、{{regressed}} 件は再発しました。",
  "session.dashboard.handoff.latest":
    "最新の作業: {{label}}（{{startedAt}}）。",
  "session.dashboard.handoff.latestNoTime": "最新の作業: {{label}}。",
  "session.dashboard.handoff.summary":
    "関連作業記録は {{sessions}} 件見つかりました。再発 blocker は {{blockers}} 件がまだ注意を要します。{{latest}}",
  "session.dashboard.export.success":
    "条件に一致する session バンドル {{count}} 件を {{filename}} に書き出しました。",
  "session.dashboard.error.action": "ダッシュボード操作に失敗しました。",
  "session.dashboard.error.filters": "フィルターの適用に失敗しました。",
  "session.dashboard.error.connect": "UI に接続できませんでした。",
  "context.noOngoingTopics": "進行中のトピックはまだありません。",
  "context.openLatestWork": "最新の作業を開く",
  "context.latestRelatedWork": "最新の関連作業",
  "context.openLatest": "最新を開く",
  "context.findRelated": "関連作業を探す",
  "context.resultsHere": "検索結果はここに表示されます。",
  "context.open": "開く",
  "context.refreshSummary": "要約を更新",
  "context.inProgress": "進行中",
  "context.onlyHost": "{{host}} だけ見る",
});

Object.assign(DICTIONARY["zh-CN"], {
  "common.close": "关闭",
  "common.savedRecord": "{{count}} 条已保存记录",
  "common.savedRecords": "{{count}} 条已保存记录",
  "common.justNow": "刚刚",
  "common.minutesAgo": "{{count}} 分钟前",
  "common.hoursAgo": "{{count}} 小时前",
  "common.daysAgo": "{{count}} 天前",
  "common.unknownAi": "未知 AI",
  "common.unknownError": "未知错误",
  "common.copied": "已复制",
  "evidenceDashboard.search.noResults": "没有找到和“{{query}}”相关的结果。",
  "evidenceDashboard.search.showingSome":
    "当前显示 {{shown}} / {{total}} 条已保存记录。",
  "evidenceDashboard.search.results": "共 {{count}} 条结果",
  "evidenceDashboard.labels.none": "目前还没有标签。",
  "evidenceDashboard.labels.rename": "重命名",
  "evidenceDashboard.labels.delete": "删除",
  "evidenceDashboard.labels.renamePrompt": "把标签“{{tag}}”改成：",
  "evidenceDashboard.labels.renameSuccess":
    "已把“{{oldTag}}”改为“{{newTag}}”，共更新 {{count}} 条记录。",
  "evidenceDashboard.labels.renameNoMatch":
    "没有任何已保存记录使用“{{tag}}”这个标签。",
  "evidenceDashboard.labels.renameFailed": "无法重命名标签：{{message}}",
  "evidenceDashboard.labels.deleteConfirm":
    "要从所有已保存记录删除标签“{{tag}}”吗？此操作无法撤销。",
  "evidenceDashboard.labels.deleteSuccess":
    "已从 {{count}} 条记录移除“{{tag}}”。",
  "evidenceDashboard.labels.deleteNoMatch":
    "没有任何已保存记录使用“{{tag}}”这个标签。",
  "evidenceDashboard.labels.deleteFailed": "无法删除标签：{{message}}",
  "evidenceDashboard.records.empty": "目前还没有已保存记录。",
  "evidenceDashboard.records.emptySearch": "没有符合“{{query}}”的已保存记录。",
  "evidenceDashboard.records.emptyLabels":
    "没有符合这些标签的已保存记录：{{labels}}。",
  "evidenceDashboard.records.loadError": "无法加载已保存记录。",
  "evidenceDashboard.records.connectError": "无法连接到 Footprint。",
  "evidenceDashboard.latestCaptures.empty": "目前还没有最近的保存记录。",
  "evidenceDashboard.timeline.empty": "这段时间内没有已保存记录。",
  "evidenceDashboard.timeline.clickHint": "点击可查看详情",
  "evidenceDashboard.lastUpdated.time": "上次更新：{{value}}",
  "evidenceDashboard.notification.newRecords": "新增了 {{count}} 条已保存记录",
  "evidenceDashboard.selected.count": "已选 {{count}} 条",
  "evidenceDashboard.selection.required": "请先选择一条或多条已保存记录。",
  "evidenceDashboard.exporting": "导出中...",
  "evidenceDashboard.deleting": "删除中...",
  "evidenceDashboard.export.success": "已导出 {{count}} 条已保存记录。",
  "evidenceDashboard.export.failed": "导出失败",
  "evidenceDashboard.export.partial":
    "导出已完成，但 Footprint 无法完整解析返回内容。",
  "evidenceDashboard.export.failedWithMessage": "导出失败：{{message}}",
  "evidenceDashboard.delete.confirm":
    "要删除 {{count}} 条已保存记录吗？此操作无法撤销。",
  "evidenceDashboard.delete.success": "已删除 {{count}} 条已保存记录。",
  "evidenceDashboard.delete.failed": "删除失败",
  "evidenceDashboard.delete.failedWithMessage": "删除失败：{{message}}",
  "evidenceDetail.labels.none": "没有标签",
  "evidenceDetail.gitCommit": "Git commit",
  "evidenceDetail.gitTimestamp": "Git 时间戳",
  "evidenceDetail.messagesCount": "{{count}} 条消息",
  "evidenceDetail.export.success": "已导出足迹 {{id}}。",
  "evidenceDetail.verify.success": "完整性检查已完成。",
  "evidenceDetail.copy.success": "已复制保存文本。",
  "evidenceDetail.error.noText": "目前没有可显示或可复制的保存文本。",
  "evidenceDetail.error.invalidPayload":
    "足迹页面预期收到结构化数据，但实际没有收到。",
  "evidenceDetail.error.load": "无法加载这条已保存足迹：{{message}}",
  "evidenceDetail.error.goBack": "无法返回足迹总览。",
  "evidenceDetail.error.noEvidenceLoaded": "目前还没有加载已保存足迹。",
  "evidenceDetail.error.export": "导出失败：{{message}}",
  "evidenceDetail.error.verify": "完整性检查失败：{{message}}",
  "evidenceDetail.error.copy": "无法复制保存文本。",
  "evidenceDetail.error.connect": "无法连接到 Footprint。",
  "evidenceExport.preview.more": "... 还有 {{count}} 条已保存记录",
  "evidenceExport.success":
    "导出完成。{{count}} 条已保存记录已加入 {{filename}}。",
  "evidenceExport.exporting": "导出中...",
  "evidenceExport.error.failed": "导出失败，请再试一次。",
  "evidenceExport.error.process": "无法处理结果：{{message}}",
  "evidenceExport.error.goBack": "无法返回足迹总览。",
  "evidenceExport.error.refresh": "无法刷新预览：{{message}}",
  "evidenceExport.error.export": "导出失败：{{message}}",
  "evidenceExport.error.connect": "无法连接到 Footprint。",
  "liveDemo.error.hostRequired":
    "这个实时视图需要 Footprint 本地预览主机。请先启动本地 demo backend，再刷新页面。",
  "liveDemo.error.invalidJson": "本地 demo 返回了非预期内容：{{message}}",
  "liveDemo.empty.subtitle":
    "目前还没有录制过的工作。先运行一次 Footprint，再刷新这个页面。",
  "liveDemo.empty.body": "Footprint 在当前本地数据库中找不到任何已录制工作。",
  "session.context.folder": "文件夹",
  "session.context.workedIn": "工作于",
  "session.context.linkedToTopic": "已连到这个主题",
  "session.context.inTopic": "属于这个主题",
  "session.context.latest": "最新",
  "sessionDashboard.allAssistants": "所有 AI 助手",
  "sessionDashboard.groupBy.issue": "具体问题",
  "sessionDashboard.search.loading":
    "在上方输入内容后，就能找到较早的相关工作。",
  "sessionDashboard.sessions.subtitle":
    "按时间从新到旧排列。先看白话摘要，需要时再往下看详细轨迹。",
  "sessionDashboard.sessions.empty": "目前还没有已保存的工作记录。",
  "sessionDashboard.trends.empty": "目前还没有反复出现的问题。",
  "sessionDashboard.contexts.empty": "目前还没有持续中的主题。",
  "sessionDashboard.search.empty": "搜索结果会显示在这里。",
  "sessionDashboard.loadMoreTrends": "显示更多重复问题",
  "sessionDashboard.loadMoreSearch": "显示更多结果",
  "sessionDashboard.loadMoreSessions": "显示更多工作",
  "session.dashboard.summary.showingWork":
    "显示 {{visible}} / {{total}} 条近期工作记录。",
  "session.dashboard.search.noMatches": "找不到符合的较早工作。",
  "session.dashboard.search.showingMatches":
    "显示 {{visible}} / {{total}} 条较早的相关工作。",
  "session.dashboard.search.placeholderSummary":
    "输入关键词、文件名、问题或任务，即可找到较早的相关工作。",
  "session.dashboard.context.noTopics": "目前还没有已确认的持续主题。",
  "session.dashboard.context.showingTopics":
    "显示 {{visible}} / {{total}} 个持续主题。",
  "session.dashboard.trends.group.issue": "具体问题",
  "session.dashboard.trends.group.family": "更大模式",
  "session.dashboard.trends.none": "目前这个视图里没有特别突出的重复问题。",
  "session.dashboard.trends.summary":
    "显示 {{visible}} / {{total}} 个{{grouping}}。其中 {{active}} 个仍需注意，{{recovered}} 个最近有改善，{{regressed}} 个再次出现。",
  "session.dashboard.handoff.latest": "最新工作：{{label}}（{{startedAt}}）。",
  "session.dashboard.handoff.latestNoTime": "最新工作：{{label}}。",
  "session.dashboard.handoff.summary":
    "找到 {{sessions}} 条相关工作记录。仍需注意的重复阻碍有 {{blockers}} 个。{{latest}}",
  "session.dashboard.export.success":
    "已导出 {{count}} 个符合条件的 session 包：{{filename}}",
  "session.dashboard.error.action": "无法执行总览操作。",
  "session.dashboard.error.filters": "无法应用筛选条件。",
  "session.dashboard.error.connect": "无法连接到界面。",
  "context.noOngoingTopics": "目前还没有持续中的主题。",
  "context.openLatestWork": "打开最新工作",
  "context.latestRelatedWork": "最新相关工作",
  "context.openLatest": "打开最新一条",
  "context.findRelated": "找相关工作",
  "context.resultsHere": "搜索结果会显示在这里。",
  "context.open": "打开",
  "context.refreshSummary": "刷新摘要",
  "context.inProgress": "进行中",
  "context.onlyHost": "只看 {{host}}",
});

Object.assign(DICTIONARY.ja, {
  "common.exportZip": "ZIP を書き出す",
  "common.savedWorkRecord": "作業記録",
  "common.savedWorkRecords": "作業記録",
  "common.attempt": "回",
  "common.attempts": "回",
  "common.message": "件のメッセージ",
  "common.messages": "件のメッセージ",
  "common.step": "手順",
  "common.steps": "手順",
  "common.item": "件",
  "common.items": "件",
  "common.relatedPattern": "関連パターン",
  "common.relatedPatterns": "関連パターン",
  "common.activeBlocker": "件の blocker",
  "common.activeBlockers": "件の blocker",
  "common.returnedProblem": "件の再発問題",
  "common.returnedProblems": "件の再発問題",
  "status.completed": "完了",
  "status.failed": "要確認",
  "status.interrupted": "停止",
  "status.running": "進行中",
  "role.user": "あなた",
  "role.assistant": "AI",
  "role.system": "システム",
  "event.session.start": "作業を開始",
  "event.session.end": "作業を終了",
  "event.session.started": "作業を開始",
  "event.session.completed": "作業が完了",
  "event.session.failed": "作業が問題付きで終了",
  "event.session.interrupted": "作業が途中で停止",
  "event.message.user": "あなたの入力",
  "event.message.user.submitted": "あなたの入力",
  "event.message.assistant": "AI の応答",
  "event.message.assistant.completed": "AI の応答が完了",
  "event.command.started": "コマンドを開始",
  "event.command.completed": "コマンドが完了",
  "event.command.failed": "コマンドが失敗",
  "event.test.completed": "テストが完了",
  "event.error.observed": "問題を検出",
  "event.file.changed": "ファイルが変更された",
  "event.git.commit": "保存された変更が作られた",
  "event.tool.started": "AI ツールを開始",
  "event.context.resolved": "トピック候補が見つかった",
  "event.context.updated": "トピックの紐付けを更新",
  "timeline.startedHost": "{{host}} を開始しました。",
  "timeline.finishedHost": "{{host}} が完了しました。",
  "timeline.sessionStarted": "この作業記録が始まりました。",
  "timeline.sessionCompleted": "この作業は通常どおり完了しました。",
  "timeline.sessionFailed": "この作業は問題付きで終了しました。",
  "timeline.sessionInterrupted": "この作業は途中で止まりました。",
  "timeline.closedUnexpectedly": "{{host}} が予期せず終了しました。",
  "context.savedWorkRecord": "作業記録",
  "context.bestCurrentPicture": "今の全体像",
  "context.stillBlocking": "まだ止まっていること",
  "context.stillUnclear": "まだはっきりしていないこと",
  "context.currentDecisions": "現在有効な判断",
  "context.olderDecisions": "置き換えられた以前の判断",
  "context.noBlockers": "今は止まっていることは記録されていません。",
  "context.noQuestions": "未解決の問いはまだありません。",
  "context.noCurrentDecisions": "現在有効な判断はまだありません。",
  "context.noReplacedDecisions": "置き換えられた判断はまだありません。",
  "context.noConfirmedSummary": "確定したトピック要約はまだありません。",
  "context.noMatchingSignals": "一致した手がかりはまだ保存されていません。",
  "context.noEarlierWork": "関連する以前の作業はありません",
  "context.preferredFolder":
    "このフォルダでは、今このトピックが優先されています。",
  "context.whySuggested": "Footprint が同じトピックかもしれないと考える理由:",
  "context.linkTopic": "このトピックに紐付ける",
  "context.keepSeparate": "別のままにする",
  "context.startNewTopic": "新しいトピックを作る",
  "context.noSuggestedTopics": "この作業記録には候補トピックがありません。",
  "context.latestRelatedWork": "最新の関連作業",
  "context.showBroaderPattern": "より広いパターンを見る",
  "context.showThisProblem": "この問題だけを見る",
  "context.noConversation": "会話はまだ記録されていません。",
  "context.noTimeline": "手順の記録はまだありません。",
  "context.noNarratives": "読みやすい要約はまだ読み込まれていません。",
  "context.noDecisions": "主要な判断はまだ読み込まれていません。",
  "context.noArtifacts": "補足情報はまだ読み込まれていません。",
  "context.nothingUrgent": "今すぐ対応が必要な項目はまだ見つかっていません。",
  "context.noSimilarPastWork": "この作業記録に似た過去の作業はまだありません。",
  "context.noHighlights": "まだ目立つ抜粋はありません。",
  "context.relatedIssues": "関連する問題",
  "context.broaderPattern": "より広いパターン",
  "context.otherRelatedRecords": "他の関連作業記録",
  "context.moreRelatedRecords": "さらに {{count}} 件の関連作業記録",
  "context.noOverviewReady": "まだ要約は準備されていません。",
  "context.latestFailed": "最新の関連作業は問題付きで終わりました。",
  "context.latestCompleted": "最新の関連作業は正常に終わりました。",
  "context.latestStopped": "最新の関連作業は途中で止まりました。",
  "context.mostRecentIssue": "最新の問題: {{value}}",
  "context.stillBlockingLine": "まだ止まっていること: {{value}}",
  "context.packageChanges": "最近のパッケージや設定変更: {{value}}",
  "context.repeatedTroubleLine": "繰り返し出ている問題: {{value}}",
  "context.retryLoop": "何度もやり直している箇所: {{value}}",
  "context.nothingBlocking": "今この流れを止めていることはありません。",
  "context.quickCheck":
    "これは明確なタスクというより、簡単なツール確認や設定確認に見えます。",
  "context.mainGoal": "主な目的: {{value}}",
  "context.commandsObserved": "{{count}} 個のコマンドが実行されました。",
  "context.testsObserved": "{{count}} 回のテスト実行が記録されました。",
  "context.problemSingle": "この作業中に問題が 1 つ見つかりました。",
  "context.problemPlural": "この作業中に {{count}} 個の問題が見つかりました。",
  "context.repeatedTrouble": "繰り返し起きている問題: {{value}}",
  "context.onlyHost": "{{host}} だけ見る",
  "context.resultsHere": "検索結果はここに表示されます。",
  "context.openShortSummaryBroader": "より広い要約を開く",
  "session.action.openSession": "作業記録 {{label}} を開く",
  "session.action.refreshSummaryFor": "{{label}} の要約を更新",
  "session.action.stillInProgress": "{{label}} はまだ進行中です",
  "session.action.openMatchingSession": "一致した作業 {{label}} を開く",
  "session.action.onlyHostAria": "{{host}} の作業だけを見る",
  "session.action.showBroaderPatternAria": "より広いパターン {{label}} を表示",
  "session.action.showThisProblemAria": "問題 {{label}} を表示",
  "session.action.openLatestSessionAria": "最新の作業 {{label}} を開く",
  "session.action.searchForAria": "{{label}} を検索",
  "session.action.loadBroaderSummaryAria": "{{label}} の広い要約を読み込む",
  "session.action.loadSummaryAria": "{{label}} の要約を読み込む",
  "session.action.openLatestRelatedAria": "最新の関連作業 {{label}} を開く",
  "session.action.linkTopicAria": "トピック {{label}} に紐付ける",
  "session.action.keepSeparateAria": "{{label}} を別トピックとして保つ",
  "session.action.startNewTopicAria": "新しいトピック {{label}} を始める",
  "session.action.openLatestWorkAria": "{{label}} の最新作業を開く",
  "session.detail.subtitle":
    "{{label}} · {{status}} · {{host}} · 開始 {{startedAt}}",
  "session.detail.meta.aiHelper": "AI アシスタント",
  "session.detail.meta.currentState": "現在の状態",
  "session.detail.meta.started": "開始",
  "session.detail.meta.finished": "終了",
  "session.detail.meta.conversation": "これまでの会話",
  "session.detail.meta.timeline": "自動アクティビティログ",
  "session.detail.meta.supporting": "補足情報",
  "session.detail.meta.related": "関連する以前の作業",
  "session.detail.meta.relatedNone": "関連する以前の作業はまだありません",
  "session.detail.meta.relatedSummary":
    "{{patterns}} · {{blockers}} · {{regressed}}",
  "session.detail.meta.overview": "簡単な概要",
  "session.detail.meta.ready": "準備完了",
  "session.detail.meta.needsRefresh": "更新が必要",
  "session.detail.meta.workedIn": "作業フォルダ",
  "session.detail.meta.pathNote": "完全なフォルダパスはホバーで確認できます。",
  "session.detail.context.none": "確定したトピックはまだありません",
  "session.detail.context.openRecord":
    "保存された作業記録を開くと、長く続くトピックに属するか確認できます。",
  "session.detail.context.confirmationRequired":
    "十分な手がかりがあるときだけ Footprint はトピック候補を出し、必ず確認を待ちます。",
  "session.detail.context.noOtherTopics":
    "今のところ他の候補トピックはありません。",
  "session.detail.context.checking":
    "この作業が既存トピックに入るか確認しています...",
  "session.detail.context.loadingConfirmed":
    "確定済みトピックの要約を読み込み中...",
  "session.detail.context.loadingCandidatesSummary":
    "関連しそうなトピックを集めています。",
  "session.detail.context.loadingCandidates": "候補トピックを読み込み中...",
  "session.detail.context.alreadyLinked":
    "この作業はすでに「{{label}}」の一部です。続ける前にここから確認してください。",
  "session.detail.context.reviewSuggestions":
    "まだトピックは確定していません。紐付ける前に下の候補を確認してください。",
  "session.detail.context.notLinked":
    "この作業はまだトピックに紐付いていません。",
  "session.detail.context.noSuggestions":
    "この作業に対する他のトピック候補はありません。",
  "session.detail.context.suggestionCount":
    "{{count}} 件の候補トピックがあります。本当に一致するものだけ紐付けてください。",
  "session.detail.context.linked": "作業をトピック {{label}} に紐付けました。",
  "session.detail.context.createdFromRelated":
    "関連する作業から正式なトピック {{label}} を作成しました。",
  "session.detail.context.rejected": "候補トピック {{label}} を却下しました。",
  "session.detail.context.moved": "作業を {{label}} に移動しました。",
  "session.detail.context.preferred":
    "{{label}} をこの作業フォルダの優先トピックに設定しました。",
  "session.detail.context.newContext": "新しいトピック",
  "session.detail.context.refreshError": "トピック確認を更新できませんでした。",
  "session.detail.scope.exportingBroader": "より広い要約を ZIP に書き出し中...",
  "session.detail.scope.exportingPickup": "引き継ぎメモを ZIP に書き出し中...",
  "session.detail.scope.exportBroader": "より広い要約 ZIP を書き出す",
  "session.detail.scope.exportPickup": "引き継ぎ ZIP を書き出す",
  "session.detail.scope.loadFirst":
    "先に短い引き継ぎメモを読み込んでください。",
  "session.detail.scope.none": "引き継ぎメモはまだ読み込まれていません。",
  "session.detail.scope.summaryText": "{{group}} · {{label}} · {{headline}}",
  "session.detail.scope.loadingFor":
    "{{label}} の短い引き継ぎメモを読み込み中...",
  "session.detail.scope.loading": "引き継ぎメモを読み込み中...",
  "session.detail.scope.exportSuccess":
    "{{kind}} 要約を書き出しました: {{filename}}",
  "session.detail.export.success":
    "session バンドルを書き出しました: {{filename}}",
  "sessionDashboard.handoff.loading": "今いちばん大事なことを整理しています...",
  "sessionDashboard.contexts.loading":
    "Footprint が把握している進行中トピックを読み込み中...",
  "session.dashboard.handoff.summary":
    "関連作業記録は {{sessions}} 件見つかりました。まだ注意が必要な再発阻害は {{blockers}} 件です。{{latest}}",
  "sessionDetail.refreshContext": "もう一度確認する",
  "sessionDetail.moveTopic": "別のトピックへ移す",
  "sessionDetail.moveThere": "ここへ移す",
  "sessionDetail.makeMainTopic": "このトピックをメインにする",
  "sessionDetail.startNewTopic": "新しいトピックを始める",
  "sessionDetail.startNewTopic.placeholder": "例: 請求メールのフォローアップ",
  "sessionDetail.createTopic": "トピックを作る",
  "sessionDetail.otherTopics": "この作業が属していそうな他のトピック",
  "sessionDetail.otherTopics.summary":
    "十分な根拠があるときだけ、Footprint は他のトピック候補を出します。",
  "sessionDetail.otherTopics.empty":
    "この作業に関連しそうな別のトピックはまだありません。",
  "sessionDetail.pickupNote": "引き継ぎメモ",
  "sessionDetail.pickupNote.summary":
    "下の関連作業から 1 件選ぶと、短い引き継ぎメモを読み込めます。",
  "sessionDetail.pickupExport": "引き継ぎ ZIP を書き出す",
  "sessionDetail.loadMoreNarratives": "要約をもっと見る",
  "sessionDetail.loadMoreDecisions": "判断をもっと見る",
  "sessionDetail.loadMoreRelatedWork": "関連作業をもっと見る",
  "sessionDetail.loadMoreConversation": "会話をもっと見る",
  "sessionDetail.loadMoreSteps": "手順をもっと見る",
  "sessionDetail.loadMoreSupporting": "補足情報をもっと見る",
});

Object.assign(DICTIONARY["zh-CN"], {
  "common.exportZip": "导出 ZIP",
  "common.savedWorkRecord": "工作记录",
  "common.savedWorkRecords": "工作记录",
  "common.attempt": "次尝试",
  "common.attempts": "次尝试",
  "common.message": "条消息",
  "common.messages": "条消息",
  "common.step": "个步骤",
  "common.steps": "个步骤",
  "common.item": "项",
  "common.items": "项",
  "common.relatedPattern": "个相关模式",
  "common.relatedPatterns": "个相关模式",
  "common.activeBlocker": "个 blocker",
  "common.activeBlockers": "个 blocker",
  "common.returnedProblem": "个再次出现的问题",
  "common.returnedProblems": "个再次出现的问题",
  "status.completed": "已完成",
  "status.failed": "需要注意",
  "status.interrupted": "已停止",
  "status.running": "进行中",
  "role.user": "你",
  "role.assistant": "AI",
  "role.system": "系统",
  "event.session.start": "工作开始",
  "event.session.end": "工作结束",
  "event.session.started": "工作开始",
  "event.session.completed": "工作完成",
  "event.session.failed": "工作带着问题结束",
  "event.session.interrupted": "工作提前停止",
  "event.message.user": "你发送了一条消息",
  "event.message.user.submitted": "你发送了一条消息",
  "event.message.assistant": "AI 已回复",
  "event.message.assistant.completed": "AI 回复完成",
  "event.command.started": "命令开始执行",
  "event.command.completed": "命令执行完成",
  "event.command.failed": "命令执行失败",
  "event.test.completed": "测试执行完成",
  "event.error.observed": "发现了一个问题",
  "event.file.changed": "文件发生了变化",
  "event.git.commit": "生成了一次已保存的修改",
  "event.tool.started": "AI 工具开始运行",
  "event.context.resolved": "找到了一个主题建议",
  "event.context.updated": "主题关联已更新",
  "timeline.startedHost": "已启动 {{host}}。",
  "timeline.finishedHost": "{{host}} 已结束。",
  "timeline.sessionStarted": "这条工作记录已开始。",
  "timeline.sessionCompleted": "这次工作已正常完成。",
  "timeline.sessionFailed": "这次工作带着问题结束。",
  "timeline.sessionInterrupted": "这次工作被提前停止。",
  "timeline.closedUnexpectedly": "{{host}} 意外关闭。",
  "context.savedWorkRecord": "工作记录",
  "context.bestCurrentPicture": "目前最好的理解",
  "context.stillBlocking": "仍在阻挡",
  "context.stillUnclear": "仍不清楚",
  "context.currentDecisions": "当前决策",
  "context.olderDecisions": "已被取代的旧决策",
  "context.noBlockers": "目前没有记录到阻碍事项。",
  "context.noQuestions": "目前没有记录到待澄清的问题。",
  "context.noCurrentDecisions": "目前还没有记录到当前决策。",
  "context.noReplacedDecisions": "目前还没有记录到被取代的决策。",
  "context.noConfirmedSummary": "目前还没有已确认的主题摘要。",
  "context.noMatchingSignals": "还没有保存到匹配信号。",
  "context.noEarlierWork": "没有更早的相关工作",
  "context.preferredFolder": "这个文件夹目前把这个主题当成主要主题。",
  "context.whySuggested": "Footprint 认为这可能是同一主题的原因：",
  "context.linkTopic": "连到这个主题",
  "context.keepSeparate": "保持分开",
  "context.startNewTopic": "开始新主题",
  "context.noSuggestedTopics": "这条工作记录目前没有主题建议。",
  "context.latestRelatedWork": "最新相关工作",
  "context.showBroaderPattern": "看更大的模式",
  "context.showThisProblem": "只看这个问题",
  "context.noConversation": "目前还没有记录到对话内容。",
  "context.noTimeline": "目前还没有记录到步骤日志。",
  "context.noNarratives": "目前还没有载入白话摘要。",
  "context.noDecisions": "目前还没有载入关键决策。",
  "context.noArtifacts": "目前还没有载入补充细节。",
  "context.nothingUrgent": "这个视图里目前没有特别紧急的事项。",
  "context.noSimilarPastWork": "这条工作记录目前还没有相似的过去工作。",
  "context.noHighlights": "目前还没有重点片段。",
  "context.relatedIssues": "相关问题",
  "context.broaderPattern": "更大的模式",
  "context.otherRelatedRecords": "其他相关工作记录",
  "context.moreRelatedRecords": "还有 {{count}} 条相关工作记录",
  "context.noOverviewReady": "目前还没有可用的总览。",
  "context.latestFailed": "最新的相关工作带着问题结束。",
  "context.latestCompleted": "最新的相关工作正常完成。",
  "context.latestStopped": "最新的相关工作提前停止。",
  "context.mostRecentIssue": "最近一次问题：{{value}}",
  "context.stillBlockingLine": "仍在阻挡：{{value}}",
  "context.packageChanges": "最近的依赖或设置变更：{{value}}",
  "context.repeatedTroubleLine": "这里反复出现的问题：{{value}}",
  "context.retryLoop": "反复重试的地方：{{value}}",
  "context.nothingBlocking": "目前没有任何事情挡住这条工作线。",
  "context.quickCheck":
    "这看起来更像一次快速工具检查或设置检查，而不是描述清楚的任务。",
  "context.mainGoal": "主要目标：{{value}}",
  "context.commandsObserved": "执行了 {{count}} 条命令。",
  "context.testsObserved": "记录到 {{count}} 次测试执行。",
  "context.problemSingle": "这次工作里出现了 1 个问题。",
  "context.problemPlural": "这次工作里出现了 {{count}} 个问题。",
  "context.repeatedTrouble": "反复出现的问题：{{value}}",
  "context.resultsHere": "搜索结果会显示在这里。",
  "context.openShortSummaryBroader": "打开更大模式的摘要",
  "session.action.openSession": "打开工作记录 {{label}}",
  "session.action.refreshSummaryFor": "刷新 {{label}} 的摘要",
  "session.action.stillInProgress": "{{label}} 仍在进行中",
  "session.action.openMatchingSession": "打开匹配的工作记录 {{label}}",
  "session.action.onlyHostAria": "只看 {{host}} 的工作",
  "session.action.showBroaderPatternAria": "查看更大的模式 {{label}}",
  "session.action.showThisProblemAria": "查看问题 {{label}}",
  "session.action.openLatestSessionAria": "打开最新工作记录 {{label}}",
  "session.action.searchForAria": "搜索 {{label}}",
  "session.action.loadBroaderSummaryAria": "载入 {{label}} 的更大模式摘要",
  "session.action.loadSummaryAria": "载入 {{label}} 的摘要",
  "session.action.openLatestRelatedAria": "打开最新相关工作 {{label}}",
  "session.action.linkTopicAria": "把 {{label}} 连到主题",
  "session.action.keepSeparateAria": "让 {{label}} 保持分开",
  "session.action.startNewTopicAria": "开始新主题 {{label}}",
  "session.action.openLatestWorkAria": "打开 {{label}} 的最新工作",
  "session.detail.subtitle":
    "{{label}} · {{status}} · {{host}} · 开始于 {{startedAt}}",
  "session.detail.meta.aiHelper": "AI 助手",
  "session.detail.meta.currentState": "当前状态",
  "session.detail.meta.started": "开始时间",
  "session.detail.meta.finished": "结束时间",
  "session.detail.meta.conversation": "目前对话",
  "session.detail.meta.timeline": "自动活动记录",
  "session.detail.meta.supporting": "补充细节",
  "session.detail.meta.related": "相关较早工作",
  "session.detail.meta.relatedNone": "目前还没有相关较早工作",
  "session.detail.meta.relatedSummary":
    "{{patterns}} · {{blockers}} · {{regressed}}",
  "session.detail.meta.overview": "简单总览",
  "session.detail.meta.ready": "已就绪",
  "session.detail.meta.needsRefresh": "需要刷新",
  "session.detail.meta.workedIn": "工作于",
  "session.detail.meta.pathNote": "把鼠标停在上面即可看到完整文件夹路径。",
  "session.detail.context.none": "目前还没有已确认的主题",
  "session.detail.context.openRecord":
    "打开一条已保存的工作记录后，就能查看它是否属于某条更长的工作线。",
  "session.detail.context.confirmationRequired":
    "只有信息足够时，Footprint 才会建议其他主题，而且一定会等待你的确认。",
  "session.detail.context.noOtherTopics": "目前还没有其他可能的主题。",
  "session.detail.context.checking": "正在检查这条工作是否属于已有主题...",
  "session.detail.context.loadingConfirmed": "正在加载已确认主题的摘要...",
  "session.detail.context.loadingCandidatesSummary":
    "Footprint 正在整理可能相关的主题。",
  "session.detail.context.loadingCandidates": "正在加载可能相关的主题...",
  "session.detail.context.alreadyLinked":
    "这条工作已经属于“{{label}}”。继续之前先从这里开始看。",
  "session.detail.context.reviewSuggestions":
    "目前还没有确认主题。先看下面的建议，再决定要不要连过去。",
  "session.detail.context.notLinked": "这条工作目前还没有连到主题。",
  "session.detail.context.noSuggestions":
    "Footprint 目前没有这条工作的其他主题建议。",
  "session.detail.context.suggestionCount":
    "找到 {{count}} 个可能的主题。只把真正匹配的连起来。",
  "session.detail.context.linked": "已把工作连到主题 {{label}}。",
  "session.detail.context.createdFromRelated":
    "已从相关工作创建正式主题 {{label}}。",
  "session.detail.context.rejected": "已拒绝主题建议 {{label}}。",
  "session.detail.context.moved": "已把工作移到 {{label}}。",
  "session.detail.context.preferred":
    "已把 {{label}} 设为这个工作区的主要主题。",
  "session.detail.context.newContext": "新主题",
  "session.detail.context.refreshError": "无法刷新主题检查。",
  "session.detail.scope.exportingBroader": "正在导出更大模式摘要 ZIP...",
  "session.detail.scope.exportingPickup": "正在导出接手摘要 ZIP...",
  "session.detail.scope.exportBroader": "导出更大模式摘要 ZIP",
  "session.detail.scope.exportPickup": "导出接手摘要 ZIP",
  "session.detail.scope.loadFirst": "请先载入一段简短的接手说明。",
  "session.detail.scope.none": "目前还没有载入接手便条。",
  "session.detail.scope.summaryText": "{{group}} · {{label}} · {{headline}}",
  "session.detail.scope.loadingFor": "正在加载 {{label}} 的简短接手说明...",
  "session.detail.scope.loading": "正在加载接手说明...",
  "session.detail.scope.exportSuccess": "已导出 {{kind}} 摘要：{{filename}}",
  "session.detail.export.success": "已导出 session 包：{{filename}}",
  "sessionDashboard.handoff.loading": "正在整理现在最重要的事...",
  "sessionDashboard.contexts.loading": "正在加载 Footprint 已确认的持续主题...",
  "sessionDetail.refreshContext": "重新检查",
  "sessionDetail.moveTopic": "移到另一个主题",
  "sessionDetail.moveThere": "移过去",
  "sessionDetail.makeMainTopic": "设成主要主题",
  "sessionDetail.startNewTopic": "开始新的主题",
  "sessionDetail.startNewTopic.placeholder": "例如：发票邮件跟进",
  "sessionDetail.createTopic": "建立主题",
  "sessionDetail.otherTopics": "这次工作可能属于的其他主题",
  "sessionDetail.otherTopics.summary":
    "只有信息足够时，Footprint 才会建议其他主题。",
  "sessionDetail.otherTopics.empty": "这次工作目前还没有明显相关的其他主题。",
  "sessionDetail.pickupNote": "接手便条",
  "sessionDetail.pickupNote.summary":
    "从下方的相关较早工作选一项，即可载入一段简短的接手说明。",
  "sessionDetail.pickupExport": "导出接手 ZIP",
  "sessionDetail.loadMoreNarratives": "显示更多摘要",
  "sessionDetail.loadMoreDecisions": "显示更多决策",
  "sessionDetail.loadMoreRelatedWork": "显示更多相关工作",
  "sessionDetail.loadMoreConversation": "显示更多对话",
  "sessionDetail.loadMoreSteps": "显示更多步骤",
  "sessionDetail.loadMoreSupporting": "显示更多补充细节",
});

function normalizeLocale(input: string | null | undefined): UiLocale {
  if (!input) {
    return FALLBACK_LOCALE;
  }

  const normalized = input.trim().toLowerCase();
  if (normalized === "zh-tw" || normalized === "zh_tw") {
    return "zh-TW";
  }
  if (
    normalized === "zh-cn" ||
    normalized === "zh_cn" ||
    normalized === "zh-hans"
  ) {
    return "zh-CN";
  }
  if (normalized.startsWith("ja")) {
    return "ja";
  }
  if (normalized.startsWith("zh")) {
    return "zh-CN";
  }
  if (normalized.startsWith("en")) {
    return "en";
  }

  return SUPPORTED_LOCALES.includes(input as UiLocale)
    ? (input as UiLocale)
    : FALLBACK_LOCALE;
}

function interpolate(
  template: string,
  variables?: Record<string, string | number>,
): string {
  if (!variables) {
    return template;
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    String(variables[key] ?? ""),
  );
}

export function getUiLocale(): UiLocale {
  if (typeof window === "undefined") {
    return FALLBACK_LOCALE;
  }

  const queryLocale = new URLSearchParams(window.location.search).get("lang");
  if (queryLocale) {
    const normalizedQuery = normalizeLocale(queryLocale);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, normalizedQuery);
    return normalizedQuery;
  }

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored) {
    return normalizeLocale(stored);
  }

  return normalizeLocale(window.navigator.language);
}

export function setUiLocale(locale: UiLocale): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
}

export function getIntlLocale(): string {
  return INTL_LOCALE_BY_UI_LOCALE[getUiLocale()];
}

export function t(
  key: string,
  variables?: Record<string, string | number>,
): string {
  const locale = getUiLocale();
  const localized = DICTIONARY[locale][key] ?? DICTIONARY.en[key] ?? key;
  return interpolate(localized, variables);
}

export function applyStaticI18n(root: ParentNode = document): void {
  if (typeof document === "undefined") {
    return;
  }

  const locale = getUiLocale();
  document.documentElement.lang = INTL_LOCALE_BY_UI_LOCALE[locale];

  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (!key) {
      return;
    }
    if (element.dataset.i18nHtml !== undefined) {
      element.innerHTML = t(key);
    } else {
      element.textContent = t(key);
    }
  });

  root
    .querySelectorAll<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >("[data-i18n-placeholder]")
    .forEach((element) => {
      const key = element.dataset.i18nPlaceholder;
      if (key) {
        element.placeholder = t(key);
      }
    });

  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((element) => {
    const key = element.dataset.i18nTitle;
    if (key) {
      element.title = t(key);
    }
  });

  root
    .querySelectorAll<HTMLElement>("[data-i18n-aria-label]")
    .forEach((element) => {
      const key = element.dataset.i18nAriaLabel;
      if (key) {
        element.setAttribute("aria-label", t(key));
      }
    });

  const localeSelect = document.getElementById(
    "locale-select",
  ) as HTMLSelectElement | null;
  if (localeSelect) {
    localeSelect.value = locale;
    localeSelect.addEventListener("change", () => {
      const nextLocale = normalizeLocale(localeSelect.value);
      setUiLocale(nextLocale);
      if (typeof window !== "undefined") {
        window.location.reload();
      }
    });
  }
}

export function initPageI18n(): UiLocale {
  if (typeof document === "undefined") {
    return getUiLocale();
  }
  applyStaticI18n(document);
  return getUiLocale();
}
