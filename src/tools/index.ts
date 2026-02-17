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
