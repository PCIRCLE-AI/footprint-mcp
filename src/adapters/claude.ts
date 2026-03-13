import { createStructuredPrefixAdapter } from "./structured-prefix.js";

export const claudeAdapter = createStructuredPrefixAdapter({
  host: "claude",
  name: "claude-adapter",
  prefix: "FOOTPRINT_CLAUDE_EVENT ",
});
