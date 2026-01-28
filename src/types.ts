/**
 * Configuration for Footprint Server
 */
export interface ServerConfig {
  /** Path to encrypted evidence database */
  dbPath: string;

  /** Password for encrypting/decrypting evidence */
  password: string;

  /** Server name (for MCP protocol) */
  name?: string;

  /** Server version */
  version?: string;
}

/**
 * Evidence capture request parameters
 */
export interface CaptureEvidenceParams {
  /** Conversation ID (e.g., Claude session ID) */
  conversationId: string;

  /** LLM provider name */
  llmProvider: string;

  /** Conversation content (messages, prompts, responses) */
  content: string;

  /** Number of messages in conversation */
  messageCount: number;

  /** Optional tags for categorization */
  tags?: string;
}
