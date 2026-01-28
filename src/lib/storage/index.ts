export { createSchema, verifySchema } from './schema.js';
export { EvidenceDatabase } from './database.js';
export type { Evidence, Metadata } from './types.js';
export { getCurrentCommit, type GitInfo } from './git.js';
export { exportEvidences, type ExportOptions, type ExportResult } from './export.js';
export { storeSalt, retrieveSalt, hasSalt } from './salt-storage.js';
