import { createStructuredPrefixAdapter } from "./structured-prefix.js";

export const codexAdapter = createStructuredPrefixAdapter({
  host: "codex",
  name: "codex-adapter",
  prefix: "FOOTPRINT_CODEX_EVENT ",
});
