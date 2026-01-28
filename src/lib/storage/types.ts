/**
 * Evidence record stored in the database
 */
export interface Evidence {
  id: string;
  timestamp: string; // ISO 8601 format
  conversationId: string | null;
  llmProvider: string | null;
  encryptedContent: Uint8Array;
  nonce: Uint8Array;
  contentHash: string; // SHA-256 hex string
  messageCount: number;
  gitCommitHash: string | null;
  gitTimestamp: string | null; // ISO 8601 format
  tags: string | null; // JSON array stored as string
  createdAt: string; // ISO 8601 format
  updatedAt: string; // ISO 8601 format
}

/**
 * Metadata key-value pairs for schema versioning and other system data
 */
export interface Metadata {
  key: string;
  value: string;
}
