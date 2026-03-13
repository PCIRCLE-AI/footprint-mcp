import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/browser/**/*.browser.test.ts"],
    pool: "forks",
    fileParallelism: false,
  },
});
