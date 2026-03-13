/**
 * Tool handlers for Footprint MCP Server
 * Each tool is extracted to its own module for better maintainability
 */

export {
  captureFootprintSchema,
  captureFootprintMetadata,
  createCaptureFootprintHandler,
} from "./capture-footprint.js";

export {
  listFootprintsSchema,
  listFootprintsMetadata,
  createListFootprintsHandler,
} from "./list-footprints.js";

export {
  exportFootprintsSchema,
  exportFootprintsMetadata,
  createExportFootprintsHandler,
} from "./export-footprints.js";

export {
  getFootprintSchema,
  getFootprintMetadata,
  createGetFootprintHandler,
} from "./get-footprint.js";

export {
  searchFootprintsSchema,
  searchFootprintsMetadata,
  createSearchFootprintsHandler,
} from "./search-footprints.js";

export {
  verifyFootprintSchema,
  verifyFootprintMetadata,
  createVerifyFootprintHandler,
} from "./verify-footprint.js";

export {
  suggestCaptureSchema,
  suggestCaptureMetadata,
  createSuggestCaptureHandler,
} from "./suggest-capture.js";

export {
  deleteFootprintsSchema,
  deleteFootprintsMetadata,
  createDeleteFootprintsHandler,
} from "./delete-footprints.js";

export {
  manageTagsSchema,
  manageTagsMetadata,
  createManageTagsHandler,
} from "./manage-tags.js";

export {
  listSessionsSchema,
  listSessionsMetadata,
  createListSessionsHandler,
} from "./list-sessions.js";

export {
  listContextsSchema,
  listContextsMetadata,
  createListContextsHandler,
} from "./list-contexts.js";

export {
  getContextSchema,
  getContextMetadata,
  createGetContextHandler,
} from "./get-context.js";

export {
  resolveContextSchema,
  resolveContextMetadata,
  createResolveContextHandler,
} from "./resolve-context.js";

export {
  confirmContextLinkSchema,
  confirmContextLinkMetadata,
  createConfirmContextLinkHandler,
} from "./confirm-context-link.js";

export {
  rejectContextLinkSchema,
  rejectContextLinkMetadata,
  createRejectContextLinkHandler,
} from "./reject-context-link.js";

export {
  moveSessionContextSchema,
  moveSessionContextMetadata,
  createMoveSessionContextHandler,
} from "./move-session-context.js";

export {
  mergeContextsSchema,
  mergeContextsMetadata,
  createMergeContextsHandler,
} from "./merge-contexts.js";

export {
  splitContextSchema,
  splitContextMetadata,
  createSplitContextHandler,
} from "./split-context.js";

export {
  setActiveContextSchema,
  setActiveContextMetadata,
  createSetActiveContextHandler,
} from "./set-active-context.js";

export {
  getSessionSchema,
  getSessionMetadata,
  createGetSessionHandler,
} from "./get-session.js";

export {
  exportSessionsSchema,
  exportSessionsMetadata,
  createExportSessionsHandler,
} from "./export-sessions.js";

export {
  getSessionMessagesSchema,
  getSessionMessagesMetadata,
  createGetSessionMessagesHandler,
} from "./get-session-messages.js";

export {
  getSessionTrendsSchema,
  getSessionTrendsMetadata,
  createGetSessionTrendsHandler,
} from "./get-session-trends.js";

export {
  getSessionTimelineSchema,
  getSessionTimelineMetadata,
  createGetSessionTimelineHandler,
} from "./get-session-timeline.js";

export {
  getSessionArtifactsSchema,
  getSessionArtifactsMetadata,
  createGetSessionArtifactsHandler,
} from "./get-session-artifacts.js";

export {
  getSessionNarrativeSchema,
  getSessionNarrativeMetadata,
  createGetSessionNarrativeHandler,
} from "./get-session-narrative.js";

export {
  getSessionDecisionsSchema,
  getSessionDecisionsMetadata,
  createGetSessionDecisionsHandler,
} from "./get-session-decisions.js";

export {
  searchHistorySchema,
  searchHistoryMetadata,
  createSearchHistoryHandler,
} from "./search-history.js";

export {
  getHistoryTrendsSchema,
  getHistoryTrendsMetadata,
  createGetHistoryTrendsHandler,
} from "./get-history-trends.js";

export {
  getHistoryHandoffSchema,
  getHistoryHandoffMetadata,
  createGetHistoryHandoffHandler,
} from "./get-history-handoff.js";

export {
  reingestSessionSchema,
  reingestSessionMetadata,
  createReingestSessionHandler,
} from "./reingest-session.js";
