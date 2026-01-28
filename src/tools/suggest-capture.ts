import * as z from "zod";
import { wrapToolHandler } from "../lib/tool-wrapper.js";
import { createToolResponse } from "../lib/tool-response.js";
import { analyzeContent } from "../analyzers/content-analyzer.js";

export const suggestCaptureSchema = {
  inputSchema: {
    summary: z
      .string()
      .describe("Conversation summary or key content to analyze"),
  },
  outputSchema: {
    shouldCapture: z.boolean(),
    reason: z.string(),
    suggestedTags: z.array(z.string()),
    suggestedConversationId: z.string(),
    confidence: z.number(),
  },
};

export const suggestCaptureMetadata = {
  title: "Suggest Capture",
  description:
    "Analyze conversation content and suggest whether to capture it as evidence",
};

export function createSuggestCaptureHandler() {
  return wrapToolHandler(
    "suggest-capture",
    "Ensure summary is not empty.",
    async (params: { summary: string }) => {
      if (!params.summary || params.summary.trim().length === 0) {
        throw new Error("Summary cannot be empty");
      }

      // Analyze content using content analyzer
      const analysis = analyzeContent(params.summary);

      // Format result text
      const resultText = analysis.shouldCapture
        ? `💡 Capture suggested (${Math.round(analysis.confidence * 100)}% confidence)\n🔍 Reason: ${analysis.reason}\n🏷️  Tags: ${analysis.suggestedTags.join(", ")}\n📝 ID: ${analysis.suggestedConversationId}`
        : `🤷 Capture not recommended (${Math.round(analysis.confidence * 100)}% confidence)\n💬 ${analysis.reason}`;

      return createToolResponse(resultText, analysis);
    },
  );
}
