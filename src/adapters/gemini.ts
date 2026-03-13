import { createStructuredPrefixAdapter } from "./structured-prefix.js";

export const geminiAdapter = createStructuredPrefixAdapter({
  host: "gemini",
  name: "gemini-adapter",
  prefix: "FOOTPRINT_GEMINI_EVENT ",
});
