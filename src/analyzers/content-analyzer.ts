/**
 * Content analyzer for determining if conversation content should be captured as evidence
 * Analyzes keywords, calculates confidence, and generates appropriate metadata
 */

export interface AnalysisResult {
  shouldCapture: boolean;
  reason: string;
  suggestedTags: string[];
  suggestedConversationId: string;
  confidence: number;
  [key: string]: unknown;
}

interface KeywordMatch {
  category: string;
  keywords: string[];
  weight: number;
}

/**
 * Keyword categories for detecting important content
 */
const KEYWORD_CATEGORIES = {
  ip: [
    "patent",
    "intellectual property",
    "invention",
    "algorithm",
    "proprietary",
    "innovation",
    "design",
  ],
  legal: [
    "contract",
    "agreement",
    "legal",
    "copyright",
    "license",
    "terms",
    "clause",
    "liability",
  ],
  business: [
    "decision",
    "milestone",
    "deliverable",
    "approval",
    "strategy",
    "roadmap",
    "budget",
    "timeline",
  ],
  research: [
    "hypothesis",
    "findings",
    "proof",
    "research",
    "study",
    "experiment",
    "analysis",
    "data",
  ],
  compliance: [
    "audit",
    "compliance",
    "evidence",
    "documentation",
    "regulation",
    "policy",
    "requirement",
  ],
};

/**
 * Match whole words only to avoid false positives
 * (e.g., "logarithm" should not match "algorithm")
 */
function matchesWord(text: string, word: string): boolean {
  const regex = new RegExp(
    `\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
    "i",
  );
  return regex.test(text);
}

/**
 * Detect matching keyword categories in the text
 */
function findKeywordMatches(text: string): KeywordMatch[] {
  const matches: KeywordMatch[] = [];

  for (const [category, keywords] of Object.entries(KEYWORD_CATEGORIES)) {
    const foundKeywords = keywords.filter((keyword) =>
      matchesWord(text, keyword),
    );
    if (foundKeywords.length > 0) {
      const weight = foundKeywords.length / keywords.length;
      matches.push({ category, keywords: foundKeywords, weight });
    }
  }

  return matches;
}

/**
 * Calculate confidence score based on keyword matches and text characteristics
 *
 * @param matches - Keyword matches found in text
 * @param wordCount - Total word count in text
 * @returns Confidence score between 0 and 1
 */
function calculateConfidence(
  matches: KeywordMatch[],
  wordCount: number,
): number {
  if (matches.length === 0) {
    // No keywords found = low importance confidence
    // Longer text without keywords = slightly higher (might have missed something)
    const lengthFactor = Math.min(wordCount / 200, 0.3); // Max 0.3 for very long text
    return 0.1 + lengthFactor; // Range: 0.1 to 0.4
  }

  // More keywords and categories = higher importance confidence
  const totalKeywords = matches.reduce(
    (sum, match) => sum + match.keywords.length,
    0,
  );
  const keywordDensity = totalKeywords / Math.max(wordCount, 1);
  const categoryBonus = matches.length * 0.15;
  const keywordBonus = Math.min(totalKeywords * 0.1, 0.4);

  return Math.min(0.95, 0.3 + categoryBonus + keywordBonus + keywordDensity);
}

/**
 * Generate human-readable reason for capture recommendation
 */
function generateReason(matches: KeywordMatch[]): string {
  if (matches.length === 0) {
    return "Appears to be casual conversation with no critical business, legal, or IP content";
  }

  const categories = matches.map((m) =>
    m.category === "ip" ? "IP" : m.category,
  );

  if (categories.length === 1) {
    return `Contains ${categories[0]} keywords: ${matches[0].keywords.join(", ")}`;
  }

  return `Contains multiple important categories: ${categories.join(", ")}`;
}

/**
 * Generate suggested tags from keyword matches
 */
function generateTags(matches: KeywordMatch[]): string[] {
  if (matches.length === 0) {
    return [];
  }

  return [
    ...new Set(matches.flatMap((m) => [m.category, ...m.keywords.slice(0, 2)])),
  ];
}

/**
 * Generate conversation ID based on matches and current date
 */
function generateConversationId(matches: KeywordMatch[]): string {
  const currentDate = new Date().toISOString().slice(0, 10);

  if (matches.length === 0) {
    return `conversation-${currentDate}`;
  }

  // Extract key terms for ID generation
  const primaryKeywords = matches[0].keywords.slice(0, 2);
  const cleanKeywords = primaryKeywords
    .map((k) => k.replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""))
    .filter((k) => k.length > 0);

  if (cleanKeywords.length > 0) {
    return `${cleanKeywords.join("-")}-${currentDate}`;
  }

  return `${matches[0].category}-discussion-${currentDate}`;
}

/**
 * Analyze conversation content and determine if it should be captured as evidence
 *
 * @param summary - Conversation summary or key content to analyze
 * @returns Analysis result with capture recommendation and metadata
 */
export function analyzeContent(summary: string): AnalysisResult {
  const normalizedText = summary.toLowerCase();
  const wordCount = normalizedText.split(/\s+/).length;

  // Find keyword matches
  const matches = findKeywordMatches(normalizedText);
  const shouldCapture = matches.length > 0;

  // Calculate confidence
  const confidence = calculateConfidence(matches, wordCount);

  // Generate metadata
  const reason = generateReason(matches);
  const suggestedTags = generateTags(matches);
  const suggestedConversationId = generateConversationId(matches);

  return {
    shouldCapture,
    reason,
    suggestedTags,
    suggestedConversationId,
    confidence: Math.round(confidence * 100) / 100,
  };
}
